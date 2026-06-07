/**
 * Minimal GitHub OAuth proxy for Decap CMS, deployed as a Cloudflare Worker.
 *
 * Decap CMS's GitHub backend needs a server to perform the OAuth "code -> token"
 * exchange (GitHub doesn't allow this from the browser). This worker implements
 * the two endpoints Decap expects:
 *
 *   GET /auth      -> redirects the client to GitHub's authorize page
 *   GET /callback  -> exchanges the ?code for an access token and hands it
 *                     back to the CMS popup window via postMessage
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 *
 * Required variable (set in wrangler.toml [vars] or as a secret):
 *   ALLOWED_ORIGIN   e.g. "https://www.innerathleteactive.com"
 *                    (the origin the /admin page is served from — used to
 *                    restrict where the auth result message is allowed to go)
 */

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPE = "repo,user";

function randomState() {
  return crypto.randomUUID();
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/callback`;
  const state = randomState();

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SCOPE);
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({ Location: authorizeUrl.toString() });
  // Stash the state in a short-lived cookie so /callback can verify it (CSRF protection).
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  return new Response(null, { status: 302, headers });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function renderResultPage(status, payload, allowedOrigin) {
  // Decap CMS listens for a postMessage from the popup in this exact format.
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;

  return `<!DOCTYPE html>
<html><body>
<script>
  (function() {
    function receiveMessage(e) {
      window.opener.postMessage(
        ${JSON.stringify(message)},
        e.origin
      );
      window.removeEventListener("message", receiveMessage, false);
    }
    window.addEventListener("message", receiveMessage, false);
    window.opener.postMessage("authorizing:github", ${JSON.stringify(allowedOrigin)});
  })();
</script>
</body></html>`;
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = getCookie(request, "oauth_state");
  const allowedOrigin = env.ALLOWED_ORIGIN;

  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response(
      renderResultPage("error", { error: "Invalid OAuth state" }, allowedOrigin),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const redirectUri = `${url.origin}/callback`;

  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
    return new Response(
      renderResultPage("error", { error: tokenData.error_description || "Token exchange failed" }, allowedOrigin),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const headers = new Headers({ "Content-Type": "text/html" });
  // Clear the state cookie now that it's been used.
  headers.append("Set-Cookie", "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");

  return new Response(
    renderResultPage("success", { token: tokenData.access_token, provider: "github" }, allowedOrigin),
    { status: 200, headers }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      return handleAuth(request, env);
    }
    if (url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
