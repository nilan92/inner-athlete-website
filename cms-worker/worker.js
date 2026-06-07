/**
 * Backend for the custom innerAthlete Store Manager (admin/).
 *
 * Runs as a Cloudflare Worker. It does two jobs:
 *   1. Authenticates the client with a plain username + password
 *      (no GitHub account/branding involved) and issues a signed session cookie.
 *   2. Proxies content edits (products, size chart, images) to this repo via
 *      the GitHub Contents API, using one shared service-account token that
 *      never reaches the browser.
 *
 * Every save becomes a commit on `main`, which triggers the existing GitHub
 * Action to rebuild SEO data and deploy — same pipeline as before.
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 *   ADMIN_USERNAME     - the login username you give your client
 *   ADMIN_PASSWORD     - the login password you give your client
 *   SESSION_SECRET     - random string used to sign session cookies
 *   GITHUB_TOKEN       - fine-grained PAT with Contents read/write on this repo
 *
 * Required variables (see wrangler.toml):
 *   GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, ALLOWED_ORIGIN
 */

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const GITHUB_API = "https://api.github.com";
const PRODUCTS_DIR = "content/products";
const SIZE_CHART_PATH = "content/size-chart.json";
const IMAGES_DIR = "img/products";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ---------- generic helpers ----------

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function withCORS(response, env) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function corsPreflight(env) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    },
  });
}

// ---------- crypto / session helpers ----------

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

function base64ToUtf8(b64) {
  return new TextDecoder().decode(base64ToBytes(b64));
}

function base64UrlEncode(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const pad = (4 - (str.length % 4)) % 4;
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return base64ToBytes(padded);
}

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return new Uint8Array(buf);
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function createSessionToken(env) {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_DURATION_MS });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const sig = await hmacSign(env.SESSION_SECRET, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function verifySessionToken(token, env) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = await hmacSign(env.SESSION_SECRET, payloadB64);
  if (!timingSafeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expectedSig))) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function sessionCookie(token, maxAgeSeconds) {
  return `session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSeconds}`;
}

const CLEAR_SESSION_COOKIE = "session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0";

// ---------- auth endpoints ----------

async function login(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const username = (body && body.username || "").trim();
  const password = body && body.password || "";
  if (!username || !password) {
    return json({ error: "Username and password required" }, 400);
  }

  const [given, expected] = await Promise.all([
    sha256(`${username}:${password}`),
    sha256(`${env.ADMIN_USERNAME}:${env.ADMIN_PASSWORD}`),
  ]);
  if (!timingSafeEqual(given, expected)) {
    return json({ error: "Incorrect username or password" }, 401);
  }

  const token = await createSessionToken(env);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token, SESSION_DURATION_MS / 1000) });
}

function logout() {
  return json({ ok: true }, 200, { "Set-Cookie": CLEAR_SESSION_COOKIE });
}

async function requireSession(request, env) {
  return verifySessionToken(getCookie(request, "session"), env);
}

// ---------- GitHub Contents API helpers ----------

async function gh(env, path, options = {}) {
  return fetch(`${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "innerAthlete-store-manager",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
}

async function ghGetFile(env, path) {
  const res = await gh(env, `/contents/${path}?ref=${env.GITHUB_BRANCH}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(`Could not read ${path} from GitHub (${res.status})`, 502);
  return res.json();
}

async function ghListDir(env, path) {
  const res = await gh(env, `/contents/${path}?ref=${env.GITHUB_BRANCH}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new ApiError(`Could not list ${path} from GitHub (${res.status})`, 502);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function ghPutFile(env, path, contentBase64, message, sha) {
  const body = { message, content: contentBase64, branch: env.GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const res = await gh(env, `/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new ApiError(`GitHub rejected the save for "${path}": ${detail}`, 502);
  }
  return res.json();
}

async function ghDeleteFile(env, path, message, sha) {
  const res = await gh(env, `/contents/${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch: env.GITHUB_BRANCH }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new ApiError(`GitHub rejected the delete for "${path}": ${detail}`, 502);
  }
  return res.json();
}

// ---------- content endpoints ----------

async function listProducts(env) {
  const entries = await ghListDir(env, PRODUCTS_DIR);
  const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".json"));
  const products = await Promise.all(
    files.map(async (entry) => {
      const file = await ghGetFile(env, entry.path);
      return {
        filename: entry.name,
        sha: file.sha,
        data: JSON.parse(base64ToUtf8(file.content)),
      };
    })
  );
  products.sort((a, b) => (a.data.id || 0) - (b.data.id || 0));
  return json({ products });
}

const FILENAME_RE = /^[a-z0-9-]+\.json$/;

async function saveProduct(request, env, filename) {
  if (!FILENAME_RE.test(filename)) return json({ error: "Invalid filename" }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const data = body && body.data;
  const sha = body && body.sha;
  if (!data || typeof data.id !== "number" || !data.slug || !data.name) {
    return json({ error: "Product must include at least an id, name and slug" }, 400);
  }

  const path = `${PRODUCTS_DIR}/${filename}`;
  const content = utf8ToBase64(JSON.stringify(data, null, 4) + "\n");
  const message = sha ? `Store Manager: update product "${data.name}"` : `Store Manager: add product "${data.name}"`;
  const result = await ghPutFile(env, path, content, message, sha || undefined);
  return json({ ok: true, sha: result.content.sha });
}

async function deleteProduct(request, env, filename) {
  if (!FILENAME_RE.test(filename)) return json({ error: "Invalid filename" }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body.sha) return json({ error: "Missing sha" }, 400);

  await ghDeleteFile(env, `${PRODUCTS_DIR}/${filename}`, `Store Manager: delete product (${filename})`, body.sha);
  return json({ ok: true });
}

async function getSizeChart(env) {
  const file = await ghGetFile(env, SIZE_CHART_PATH);
  if (!file) return json({ error: "Size chart file not found in repo" }, 404);
  return json({ sha: file.sha, data: JSON.parse(base64ToUtf8(file.content)) });
}

async function saveSizeChart(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const data = body && body.data;
  const sha = body && body.sha;
  if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
    return json({ error: "Size chart must include at least one row" }, 400);
  }

  const content = utf8ToBase64(JSON.stringify(data, null, 4) + "\n");
  const result = await ghPutFile(env, SIZE_CHART_PATH, content, "Store Manager: update size chart", sha || undefined);
  return json({ ok: true, sha: result.content.sha });
}

const IMAGE_FILENAME_RE = /^[a-z0-9-]+\.(webp|jpg|jpeg|png)$/i;

async function uploadImage(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const filename = body && body.filename;
  const contentBase64 = body && body.contentBase64;
  if (!filename || !contentBase64 || !IMAGE_FILENAME_RE.test(filename)) {
    return json({ error: "Provide a filename (lowercase letters, numbers, dashes) ending in .webp, .jpg, .jpeg or .png" }, 400);
  }

  const path = `${IMAGES_DIR}/${filename}`;
  const existing = await ghGetFile(env, path);
  const result = await ghPutFile(env, path, contentBase64, `Store Manager: upload image ${filename}`, existing ? existing.sha : undefined);
  return json({ ok: true, path, sha: result.content.sha });
}

// ---------- router ----------

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") return corsPreflight(env);

    try {
      if (pathname === "/api/login" && request.method === "POST") {
        return withCORS(await login(request, env), env);
      }
      if (pathname === "/api/logout" && request.method === "POST") {
        return withCORS(logout(), env);
      }

      if (pathname.startsWith("/api/")) {
        if (!(await requireSession(request, env))) {
          return withCORS(json({ error: "Session expired — please sign in again" }, 401), env);
        }

        if (pathname === "/api/me" && request.method === "GET") {
          return withCORS(json({ ok: true }), env);
        }
        if (pathname === "/api/products" && request.method === "GET") {
          return withCORS(await listProducts(env), env);
        }

        const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
        if (productMatch) {
          const filename = decodeURIComponent(productMatch[1]);
          if (request.method === "PUT") return withCORS(await saveProduct(request, env, filename), env);
          if (request.method === "DELETE") return withCORS(await deleteProduct(request, env, filename), env);
        }

        if (pathname === "/api/size-chart" && request.method === "GET") {
          return withCORS(await getSizeChart(env), env);
        }
        if (pathname === "/api/size-chart" && request.method === "PUT") {
          return withCORS(await saveSizeChart(request, env), env);
        }
        if (pathname === "/api/upload-image" && request.method === "POST") {
          return withCORS(await uploadImage(request, env), env);
        }
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      return withCORS(json({ error: err.message || "Internal error" }, status), env);
    }

    return withCORS(new Response("Not found", { status: 404 }), env);
  },
};
