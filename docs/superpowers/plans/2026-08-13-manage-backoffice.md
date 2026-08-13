# /manage Back Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Decap CMS admin at `/admin` with a custom-built back office at `/manage` — a Catalog tab (products/prices/banner, committed to this repo via GitHub's API) and a Sales tab (a manually-entered order log, backed by Cloudflare D1) — sharing one password-gated login.

**Architecture:** One Cloudflare Worker (`innerathlete-backoffice`) serves a small JSON API behind a custom HMAC-signed session token. It holds two credentials as Worker secrets: a fine-grained GitHub PAT (repo-scoped, Contents read/write — already created) for the Catalog tab, and a D1 database binding for the Sales tab. The frontend is a plain HTML/CSS/vanilla-JS single-page app at `/manage/`, no build step, no framework.

**Tech Stack:** Cloudflare Workers, Cloudflare D1 (SQLite), native Web Crypto API (HMAC-SHA256), GitHub REST API (Contents endpoint), vanilla JS (native ES modules, `<canvas>` for image resizing), Node's built-in `node:test`/`node:assert` for pure-logic unit tests.

## Global Constraints

- No frameworks, no new npm dependencies — every new capability (routing, HMAC, image resize, CSV) uses a native platform API or ~15 lines of plain code.
- No changes to the live storefront except two, both explicitly approved: the footer copyright link (`index.html`), and `renderProducts()` in `js/ui.js` reading `visibleRegions` from data instead of the hardcoded Maldives rule.
- Sales entry is manual only — no endpoint is ever called from the public storefront.
- All D1 queries are parameterized (`.bind()`); never string-concatenated SQL.
- Staff-entered text is escaped wherever it's re-rendered in `/manage`.
- Currencies (USD/LKR/MVR) are never summed together or converted — every total is per-currency.
- Spec: `docs/superpowers/specs/2026-08-13-manage-backoffice-design.md` — read it before starting; this plan implements it exactly.

---

## File Structure

```
backoffice/                      (new Worker, replaces cms-auth/)
  wrangler.toml
  schema.sql
  src/
    index.js                     router + JSON/CORS helpers
    auth.js                      password check, session token sign/verify
    github.js                    GitHub Contents API wrapper
    products.js                  GET/PUT /api/products, POST /api/images
    banner.js                    GET/PUT /api/banner
    sales.js                     sales CRUD + totals + CSV export
  test/
    auth.test.js                 node:test, pure logic, no Workers runtime needed

manage/                          (new frontend, replaces admin/)
  index.html
  manage.css
  js/
    api.js                       fetch wrapper, attaches session token
    toast.js                     tiny confirmation-toast component
    auth.js                      login screen, token storage
    imageOptimize.js             canvas resize + WebP encode
    catalog.js                   Catalog tab: products + banner forms
    sales.js                     Sales tab: entry form, list, totals, CSV
    main.js                      entry point, tab switching
```

Each Worker module owns exactly one concern (auth, one GitHub wrapper, one handler file per resource) so a task can be reviewed and tested without reading the others. Frontend files split the same way: one file per tab, plus small shared helpers (`api.js`, `toast.js`) that both tabs use.

---

### Task 1: D1 database and schema

**Files:**
- Create: `backoffice/schema.sql`
- Create: `backoffice/wrangler.toml`

**Interfaces:**
- Produces: a `sales` table other tasks query via the `DB` binding in `env`.

- [ ] **Step 1: Create the D1 database**

```bash
cd ~/Desktop/inner-athlete-website
mkdir -p backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
cd backoffice && npx --yes wrangler d1 create innerathlete-sales
```

Copy the `database_id` from the output — the next step needs it.

- [ ] **Step 2: Write the schema file**

```sql
-- backoffice/schema.sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid')),
  currency TEXT NOT NULL CHECK (currency IN ('USD','LKR','MVR')),
  items TEXT NOT NULL,        -- JSON array: [{name,size,color,qty,price}]
  total REAL NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT
);

CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_created_at ON sales(created_at);
```

- [ ] **Step 3: Write wrangler.toml**

```toml
# backoffice/wrangler.toml
name = "innerathlete-backoffice"
main = "src/index.js"
compatibility_date = "2026-08-13"

[[d1_databases]]
binding = "DB"
database_name = "innerathlete-sales"
database_id = "PASTE_THE_DATABASE_ID_FROM_STEP_1_HERE"
```

- [ ] **Step 4: Apply the schema, remotely and locally**

```bash
cd backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler d1 execute innerathlete-sales --remote --file=schema.sql
npx --yes wrangler d1 execute innerathlete-sales --local --file=schema.sql
```

- [ ] **Step 5: Verify the table exists**

```bash
npx --yes wrangler d1 execute innerathlete-sales --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```
Expected: output includes a row with `name: sales`.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/schema.sql backoffice/wrangler.toml
git commit -m "Add D1 database and schema for sales tracking"
```

---

### Task 2: Auth module — session tokens

**Files:**
- Create: `backoffice/src/auth.js`
- Test: `backoffice/test/auth.test.js`

**Interfaces:**
- Produces: `createToken(secret, ttlMs?) -> Promise<string>`, `verifyToken(token, secret) -> Promise<boolean>`, `checkPassword(candidate, secret) -> boolean`. Task 3's router imports all three.

- [ ] **Step 1: Write the failing tests**

```javascript
// backoffice/test/auth.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToken, verifyToken, checkPassword } from '../src/auth.js';

test('a freshly created token verifies successfully', async () => {
  const token = await createToken('test-secret');
  assert.equal(await verifyToken(token, 'test-secret'), true);
});

test('a token verified with the wrong secret fails', async () => {
  const token = await createToken('test-secret');
  assert.equal(await verifyToken(token, 'wrong-secret'), false);
});

test('a tampered token fails verification', async () => {
  const token = await createToken('test-secret');
  const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  assert.equal(await verifyToken(tampered, 'test-secret'), false);
});

test('an expired token fails verification', async () => {
  const token = await createToken('test-secret', -1000); // already expired
  assert.equal(await verifyToken(token, 'test-secret'), false);
});

test('garbage input never throws, just fails', async () => {
  assert.equal(await verifyToken('', 'test-secret'), false);
  assert.equal(await verifyToken('not.a.real.token', 'test-secret'), false);
  assert.equal(await verifyToken(undefined, 'test-secret'), false);
});

test('checkPassword matches only the exact secret', () => {
  assert.equal(checkPassword('correct-horse', 'correct-horse'), true);
  assert.equal(checkPassword('wrong', 'correct-horse'), false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backoffice && node --test test/auth.test.js
```
Expected: FAIL — `src/auth.js` doesn't exist yet.

- [ ] **Step 3: Implement auth.js**

```javascript
// backoffice/src/auth.js
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hmac(payloadB64, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  return base64url(new Uint8Array(sig));
}

/** Signed session token: base64url(json payload) + "." + HMAC signature. */
export async function createToken(secret, ttlMs = 24 * 60 * 60 * 1000) {
  const payload = JSON.stringify({ exp: Date.now() + ttlMs });
  const payloadB64 = base64url(new TextEncoder().encode(payload));
  const sig = await hmac(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.');
  try {
    const expectedSig = await hmac(payloadB64, secret);
    if (sig !== expectedSig) return false;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function checkPassword(candidate, secret) {
  return typeof candidate === 'string' && candidate === secret;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backoffice && node --test test/auth.test.js
```
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/auth.js backoffice/test/auth.test.js
git commit -m "Add session token auth module with tests"
```

---

### Task 3: Worker router, /auth endpoint, JSON helpers

**Files:**
- Create: `backoffice/src/http.js`
- Create: `backoffice/src/index.js`

**Interfaces:**
- Consumes: `createToken`, `verifyToken`, `checkPassword` from Task 2.
- Produces: `json(data, status?) -> Response` (in its own module so every
  handler file — including `index.js` itself — imports it the same way;
  putting it inside `index.js` would make `index.js` and every handler
  file that needs `json` import from each other, a needless circular
  dependency), `requireAuth(request, env) -> Promise<boolean>` and
  `registerRoute(method, path, handler)` (both stay in `index.js`, since
  nothing outside it calls `requireAuth` directly and `registerRoute` is
  only ever called once per handler file, immediately after import), and
  the `POST /auth` route.

- [ ] **Step 1: Implement the JSON helper**

```javascript
// backoffice/src/http.js
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Implement the router**

```javascript
// backoffice/src/index.js
import { createToken, verifyToken, checkPassword } from './auth.js';
import { json } from './http.js';

export async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyToken(token, env.SESSION_SECRET);
}

async function handleAuth(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const { password } = await request.json().catch(() => ({}));
  if (!checkPassword(password, env.STAFF_PASSWORD)) {
    return json({ error: 'Wrong password' }, 401);
  }
  const token = await createToken(env.SESSION_SECRET);
  return json({ token });
}

const routes = []; // [method, pathPrefix, handler] — populated by later tasks via registerRoute

export function registerRoute(method, path, handler) {
  routes.push({ method, path, handler });
}

registerRoute('POST', '/auth', handleAuth);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    for (const route of routes) {
      if (request.method !== route.method) continue;
      if (typeof route.path === 'string' ? route.path === url.pathname : route.path.test(url.pathname)) {
        if (route.path !== '/auth' && !(await requireAuth(request, env))) {
          return json({ error: 'Unauthorized' }, 401);
        }
        return route.handler(request, env, url);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
```

- [ ] **Step 3: Run it locally and smoke-test /auth**

```bash
cd backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler dev --local --var SESSION_SECRET:test-secret --var STAFF_PASSWORD:test-pass &
sleep 3
curl -s -X POST http://localhost:8787/auth -H "Content-Type: application/json" -d '{"password":"wrong"}' -o /dev/null -w "wrong password: %{http_code}\n"
curl -s -X POST http://localhost:8787/auth -H "Content-Type: application/json" -d '{"password":"test-pass"}'
kill %1
```
Expected: `wrong password: 401`, then a JSON body containing a `token` field for the correct password.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/http.js backoffice/src/index.js
git commit -m "Add Worker router, /auth endpoint, and auth middleware"
```

---

### Task 4: GitHub Contents API wrapper

**Files:**
- Create: `backoffice/src/github.js`

**Interfaces:**
- Produces: `getFile(path, token) -> Promise<{content: string, sha: string}>`, `putFile(path, content, sha, token, message, opts?) -> Promise<object>` where `opts.binary` (default `false`) skips UTF-8 text encoding for already-base64 content (image uploads).

- [ ] **Step 1: Implement github.js**

```javascript
// backoffice/src/github.js
const GITHUB_API = 'https://api.github.com';
const REPO = 'nilan92/inner-athlete-website';
const BRANCH = 'main';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'innerathlete-backoffice',
  };
}

/** Reads a text file from the repo. Returns its decoded content and git SHA
 *  (the SHA is required by putFile to update rather than overwrite blindly). */
export async function getFile(path, token) {
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`GitHub getFile ${path} failed: ${res.status}`);
  const data = await res.json();
  return { content: decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))), sha: data.sha };
}

/** Creates or updates a file, committing directly to main.
 *  content: text (default) or already-base64 data when opts.binary is true.
 *  sha: omit when creating a brand-new file; required when updating one. */
export async function putFile(path, content, sha, token, message, opts = {}) {
  const base64 = opts.binary ? content : btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: base64, branch: BRANCH };
  if (sha) body.sha = sha;

  const res = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub putFile ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}
```

- [ ] **Step 2: Verify against the real repo**

There's no practical way to mock GitHub's API, so this is verified directly — carefully, against a harmless path first.

```bash
cd backoffice
node -e "
import('./src/github.js').then(async ({getFile}) => {
  const token = process.env.GITHUB_PAT;
  const { content, sha } = await getFile('content/banner.json', token);
  console.log('sha:', sha);
  console.log('content:', content.slice(0, 60));
});
" 
```
(Run with `GITHUB_PAT=<the token you have from earlier> node -e "..."` — reading a file only, no write, safe to run against production.)

Expected: prints a SHA and the start of the real `banner.json` content.

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/github.js
git commit -m "Add GitHub Contents API wrapper for the Catalog tab"
```

---

### Task 5: Products API — GET/PUT /api/products, POST /api/images

**Files:**
- Create: `backoffice/src/products.js`
- Modify: `backoffice/src/index.js` (register the new routes)

**Interfaces:**
- Consumes: `getFile`, `putFile` from Task 4; `json`, `registerRoute` from Task 3.
- Produces: nothing consumed elsewhere — this is a leaf handler module.

- [ ] **Step 1: Implement products.js**

```javascript
// backoffice/src/products.js
import { getFile, putFile } from './github.js';
import { json } from './http.js';

export async function handleGetProducts(request, env) {
  const { content, sha } = await getFile('content/products.json', env.GITHUB_PAT);
  return json({ ...JSON.parse(content), sha });
}

export async function handlePutProducts(request, env) {
  const body = await request.json();
  const { sha, ...rest } = body;
  const content = JSON.stringify(rest, null, 2) + '\n';
  const result = await putFile(
    'content/products.json', content, sha, env.GITHUB_PAT,
    'Update products via /manage'
  );
  return json({ sha: result.content.sha });
}

export async function handlePostImage(request, env) {
  const { filename, base64 } = await request.json();
  if (!filename || !base64) return json({ error: 'filename and base64 required' }, 400);
  const path = `img/uploads/${filename}`;
  const result = await putFile(
    path, base64, undefined, env.GITHUB_PAT,
    `Upload ${filename} via /manage`, { binary: true }
  );
  return json({ path, sha: result.content.sha });
}
```

- [ ] **Step 2: Register the routes**

```javascript
// backoffice/src/index.js — add near the top, after the handleAuth import block
import { handleGetProducts, handlePutProducts, handlePostImage } from './products.js';

// add below registerRoute('POST', '/auth', handleAuth);
registerRoute('GET', '/api/products', handleGetProducts);
registerRoute('PUT', '/api/products', handlePutProducts);
registerRoute('POST', '/api/images', handlePostImage);
```

- [ ] **Step 3: Smoke-test locally against the real repo**

```bash
cd backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler dev --local --var SESSION_SECRET:test-secret --var STAFF_PASSWORD:test-pass --var GITHUB_PAT:"$GITHUB_PAT" &
sleep 3
TOKEN=$(curl -s -X POST http://localhost:8787/auth -d '{"password":"test-pass"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
curl -s http://localhost:8787/api/products -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
kill %1
```
Expected: the real product catalog, plus a `sha` field. (Skip actually testing the PUT here — a live commit belongs in the end-to-end smoke test in Task 15, not an ad-hoc local run.)

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/products.js backoffice/src/index.js
git commit -m "Add Catalog products API (GET/PUT, image upload)"
```

---

### Task 6: Banner API — GET/PUT /api/banner

**Files:**
- Create: `backoffice/src/banner.js`
- Modify: `backoffice/src/index.js` (register routes)

**Interfaces:**
- Consumes: `getFile`, `putFile` from Task 4; `json`, `registerRoute` from Task 3. Identical shape to Task 5, smaller payload.

- [ ] **Step 1: Implement banner.js**

```javascript
// backoffice/src/banner.js
import { getFile, putFile } from './github.js';
import { json } from './http.js';

export async function handleGetBanner(request, env) {
  const { content, sha } = await getFile('content/banner.json', env.GITHUB_PAT);
  return json({ ...JSON.parse(content), sha });
}

export async function handlePutBanner(request, env) {
  const body = await request.json();
  const { sha, ...rest } = body;
  const content = JSON.stringify(rest, null, 2) + '\n';
  const result = await putFile(
    'content/banner.json', content, sha, env.GITHUB_PAT,
    'Update banner via /manage'
  );
  return json({ sha: result.content.sha });
}
```

- [ ] **Step 2: Register the routes**

```javascript
// backoffice/src/index.js
import { handleGetBanner, handlePutBanner } from './banner.js';

registerRoute('GET', '/api/banner', handleGetBanner);
registerRoute('PUT', '/api/banner', handlePutBanner);
```

- [ ] **Step 3: Smoke-test**

```bash
cd backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler dev --local --var SESSION_SECRET:test-secret --var STAFF_PASSWORD:test-pass --var GITHUB_PAT:"$GITHUB_PAT" &
sleep 3
TOKEN=$(curl -s -X POST http://localhost:8787/auth -d '{"password":"test-pass"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
curl -s http://localhost:8787/api/banner -H "Authorization: Bearer $TOKEN"
kill %1
```
Expected: the real `content/banner.json` contents plus `sha`.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/banner.js backoffice/src/index.js
git commit -m "Add banner API (GET/PUT)"
```

---

### Task 7: Sales API — create, list, update

**Files:**
- Create: `backoffice/src/sales.js`
- Modify: `backoffice/src/index.js` (register routes)

**Interfaces:**
- Consumes: `env.DB` (D1 binding from Task 1), `json` from Task 3.
- Produces: nothing consumed elsewhere in this task, but Task 8 (totals) and Task 9 (CSV export) add functions to this same file.

- [ ] **Step 1: Implement create + list + update**

```javascript
// backoffice/src/sales.js
import { json } from './http.js';

export async function handlePostSale(request, env) {
  const s = await request.json();
  if (!s.currency || !s.items || !Array.isArray(s.items) || s.items.length === 0) {
    return json({ error: 'currency and at least one item are required' }, 400);
  }
  const result = await env.DB.prepare(
    `INSERT INTO sales (status, currency, items, total, customer_name, customer_phone, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    s.status === 'pending' ? 'pending' : 'paid',
    s.currency,
    JSON.stringify(s.items),
    Number(s.total) || 0,
    s.customer_name || null,
    s.customer_phone || null,
    s.notes || null
  ).run();
  return json({ id: result.meta.last_row_id }, 201);
}

export async function handleGetSales(request, env, url) {
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let sql = 'SELECT * FROM sales WHERE 1=1';
  const binds = [];
  if (status) { sql += ' AND status = ?'; binds.push(status); }
  if (from) { sql += ' AND created_at >= ?'; binds.push(from); }
  if (to) { sql += ' AND created_at <= ?'; binds.push(to); }
  sql += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const sales = results.map(r => ({ ...r, items: JSON.parse(r.items) }));
  return json({ sales });
}

export async function handlePatchSale(request, env, url) {
  const id = url.pathname.split('/').pop();
  const s = await request.json();
  const fields = [];
  const binds = [];
  for (const [key, col] of [
    ['status', 'status'], ['total', 'total'], ['customer_name', 'customer_name'],
    ['customer_phone', 'customer_phone'], ['notes', 'notes'],
  ]) {
    if (s[key] !== undefined) { fields.push(`${col} = ?`); binds.push(s[key]); }
  }
  if (s.items !== undefined) { fields.push('items = ?'); binds.push(JSON.stringify(s.items)); }
  if (fields.length === 0) return json({ error: 'nothing to update' }, 400);
  fields.push("updated_at = datetime('now')");
  binds.push(id);

  await env.DB.prepare(`UPDATE sales SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
  return json({ ok: true });
}
```

- [ ] **Step 2: Register the routes**

```javascript
// backoffice/src/index.js
import { handlePostSale, handleGetSales, handlePatchSale } from './sales.js';

registerRoute('POST', '/api/sales', handlePostSale);
registerRoute('GET', '/api/sales', handleGetSales);
registerRoute('PATCH', /^\/api\/sales\/\d+$/, handlePatchSale);
```

- [ ] **Step 3: Smoke-test against local D1**

```bash
cd backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler dev --local --var SESSION_SECRET:test-secret --var STAFF_PASSWORD:test-pass &
sleep 3
TOKEN=$(curl -s -X POST http://localhost:8787/auth -d '{"password":"test-pass"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

curl -s -X POST http://localhost:8787/api/sales -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"currency":"LKR","items":[{"name":"Test Item","size":"M","color":"Black","qty":1,"price":1000}],"total":1000,"customer_name":"Test Customer"}'

curl -s http://localhost:8787/api/sales -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

curl -s -X PATCH http://localhost:8787/api/sales/1 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"paid"}' -o /dev/null -w "patch status: %{http_code}\n"
kill %1
```
Expected: POST returns `{"id":1}` with 201, GET lists it, PATCH returns 200.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/sales.js backoffice/src/index.js
git commit -m "Add sales CRUD API (create, list, update)"
```

---

### Task 8: Sales totals

**Files:**
- Modify: `backoffice/src/sales.js` (add `handleGetTotals`)
- Modify: `backoffice/src/index.js` (register route)

**Interfaces:**
- Consumes: `env.DB`, `json` — same as Task 7.

- [ ] **Step 1: Add the totals handler**

```javascript
// backoffice/src/sales.js — append
export async function handleGetTotals(request, env) {
  const { results: todayRows } = await env.DB.prepare(
    `SELECT currency, SUM(total) as sum FROM sales
     WHERE status = 'paid' AND date(created_at) = date('now') GROUP BY currency`
  ).all();
  const { results: monthRows } = await env.DB.prepare(
    `SELECT currency, SUM(total) as sum FROM sales
     WHERE status = 'paid' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
     GROUP BY currency`
  ).all();
  const { results: allTimeRows } = await env.DB.prepare(
    `SELECT currency, SUM(total) as sum FROM sales WHERE status = 'paid' GROUP BY currency`
  ).all();

  const toMap = (rows) => Object.fromEntries(rows.map(r => [r.currency, r.sum]));
  return json({ today: toMap(todayRows), thisMonth: toMap(monthRows), allTime: toMap(allTimeRows) });
}
```

- [ ] **Step 2: Register the route**

```javascript
// backoffice/src/index.js
import { handlePostSale, handleGetSales, handlePatchSale, handleGetTotals } from './sales.js';

registerRoute('GET', '/api/sales/totals', handleGetTotals);
```

Note: register this route *before* the generic `GET /api/sales` route would ever be reachable by pattern accident — here it's fine since the router does an exact-or-regex match per registered path (`/api/sales/totals` never matches the string `/api/sales`), but double-check route order stays correct if the router logic changes later.

- [ ] **Step 3: Smoke-test**

```bash
cd backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler dev --local --var SESSION_SECRET:test-secret --var STAFF_PASSWORD:test-pass &
sleep 3
TOKEN=$(curl -s -X POST http://localhost:8787/auth -d '{"password":"test-pass"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
curl -s -X POST http://localhost:8787/api/sales -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"currency":"LKR","status":"paid","items":[{"name":"x","qty":1,"price":500}],"total":500}' -o /dev/null
curl -s http://localhost:8787/api/sales/totals -H "Authorization: Bearer $TOKEN"
kill %1
```
Expected: `{"today":{"LKR":500},"thisMonth":{"LKR":500},"allTime":{"LKR":500}}` (plus whatever Task 7's test row added, if the local DB persisted between runs).

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/sales.js backoffice/src/index.js
git commit -m "Add sales totals endpoint (today/month/all-time, paid only)"
```

---

### Task 9: CSV export

**Files:**
- Modify: `backoffice/src/sales.js` (add `handleExportSales`)
- Modify: `backoffice/src/index.js` (register route)

**Interfaces:**
- Consumes: `env.DB` — same query shape as Task 7's `handleGetSales`.

- [ ] **Step 1: Add the CSV handler**

```javascript
// backoffice/src/sales.js — append
function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function handleExportSales(request, env, url) {
  const status = url.searchParams.get('status');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let sql = 'SELECT * FROM sales WHERE 1=1';
  const binds = [];
  if (status) { sql += ' AND status = ?'; binds.push(status); }
  if (from) { sql += ' AND created_at >= ?'; binds.push(from); }
  if (to) { sql += ' AND created_at <= ?'; binds.push(to); }
  sql += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...binds).all();

  const header = ['Date', 'Status', 'Currency', 'Total', 'Customer', 'Phone', 'Items', 'Notes'];
  const rows = results.map(r => [
    r.created_at, r.status, r.currency, r.total, r.customer_name, r.customer_phone,
    JSON.parse(r.items).map(i => `${i.qty}x ${i.name} (${i.size || '-'}/${i.color || '-'})`).join('; '),
    r.notes,
  ]);
  const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="innerathlete-sales.csv"',
    },
  });
}
```

- [ ] **Step 2: Register the route**

```javascript
// backoffice/src/index.js
import { handlePostSale, handleGetSales, handlePatchSale, handleGetTotals, handleExportSales } from './sales.js';

registerRoute('GET', '/api/sales/export', handleExportSales);
```

- [ ] **Step 3: Smoke-test**

```bash
cd backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler dev --local --var SESSION_SECRET:test-secret --var STAFF_PASSWORD:test-pass &
sleep 3
TOKEN=$(curl -s -X POST http://localhost:8787/auth -d '{"password":"test-pass"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
curl -s http://localhost:8787/api/sales/export -H "Authorization: Bearer $TOKEN"
kill %1
```
Expected: a CSV with a header row and one line per sale created in earlier smoke tests.

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/inner-athlete-website
git add backoffice/src/sales.js backoffice/src/index.js
git commit -m "Add sales CSV export"
```

---

### Task 10: Frontend shell, login, API/toast helpers

**Files:**
- Create: `manage/index.html`
- Create: `manage/manage.css`
- Create: `manage/js/api.js`
- Create: `manage/js/toast.js`
- Create: `manage/js/auth.js`
- Create: `manage/js/main.js`

**Interfaces:**
- Produces: `apiFetch(path, options?) -> Promise<Response>` (attaches the stored session token; other frontend tasks use this for every Worker call), `showToast(message)`, `isLoggedIn()`, `login(password) -> Promise<boolean>`, `logout()`.

- [ ] **Step 1: Write the HTML shell**

```html
<!-- manage/index.html -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>innerAthlete — Manage</title>
  <link rel="stylesheet" href="../styles.min.css" />
  <link rel="stylesheet" href="manage.css" />
</head>
<body>
  <div id="login-screen">
    <div class="login-card">
      <div class="logo-mark">iA</div>
      <h1>innerAthlete</h1>
      <input type="password" id="login-password" placeholder="Password" autofocus />
      <button id="login-btn">Log in</button>
      <p id="login-error" class="error hidden">Wrong password, try again.</p>
    </div>
  </div>

  <div id="app" class="hidden">
    <nav class="manage-nav">
      <span class="logo-mark small">iA</span>
      <div class="tabs">
        <button class="tab-btn active" data-tab="catalog">Catalog</button>
        <button class="tab-btn" data-tab="sales">Sales</button>
      </div>
      <button id="logout-btn">Log out</button>
    </nav>

    <main>
      <section id="tab-catalog" class="tab-panel active"></section>
      <section id="tab-sales" class="tab-panel"></section>
    </main>
  </div>

  <div id="toast-container"></div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write api.js and toast.js**

```javascript
// manage/js/api.js
const BASE = 'https://innerathlete-backoffice.thenilan92.workers.dev';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('manage_token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('manage_token');
    location.reload();
    throw new Error('Session expired');
  }
  return res;
}
```

```javascript
// manage/js/toast.js
export function showToast(message, isError = false) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast${isError ? ' toast-error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}
```

- [ ] **Step 3: Write auth.js**

```javascript
// manage/js/auth.js
import { apiFetch } from './api.js';

export function isLoggedIn() {
  return !!localStorage.getItem('manage_token');
}

export async function login(password) {
  const res = await fetch('https://innerathlete-backoffice.thenilan92.workers.dev/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) return false;
  const { token } = await res.json();
  localStorage.setItem('manage_token', token);
  return true;
}

export function logout() {
  localStorage.removeItem('manage_token');
  location.reload();
}
```

- [ ] **Step 4: Write main.js (wires login + tab switching)**

```javascript
// manage/js/main.js
import { isLoggedIn, login, logout } from './auth.js';
import { showToast } from './toast.js';
import { initCatalogTab } from './catalog.js';
import { initSalesTab } from './sales.js';

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initCatalogTab();
  initSalesTab();
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const password = document.getElementById('login-password').value;
  const ok = await login(password);
  if (ok) { showApp(); } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
});

document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('logout-btn').addEventListener('click', logout);

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

if (isLoggedIn()) showApp();
```

Note: this imports `initCatalogTab` and `initSalesTab`, which don't exist until Tasks 12 and 13. That's expected — this task's own test (Step 5) only exercises the login screen, not the tabs.

- [ ] **Step 5: Write manage.css (base layer — login screen, nav, tabs, toast)**

```css
/* manage/manage.css */
body { margin: 0; background: #f4f4f4; font-family: var(--font-body, sans-serif); }
.hidden { display: none !important; }

#login-screen { display: flex; align-items: center; justify-content: center; height: 100vh; }
.login-card { background: #fff; padding: 40px 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,.1); width: 280px; text-align: center; }
.logo-mark { display: inline-block; font-family: var(--font-head, sans-serif); font-size: 2rem; color: #fff; background: var(--primary, #111); padding: 10px 20px; border-radius: 8px; margin-bottom: 16px; }
.logo-mark.small { font-size: 1.2rem; padding: 6px 12px; }
.login-card input { width: 100%; box-sizing: border-box; padding: 10px; margin: 16px 0; border: 1px solid #ddd; border-radius: 6px; }
.login-card button, .manage-nav button { background: var(--primary, #111); color: #fff; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 1rem; }
.error { color: #c0392b; font-size: .85rem; }

.manage-nav { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: var(--primary, #111); }
.tabs { display: flex; gap: 8px; }
.tab-btn { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.3); padding: 8px 16px; border-radius: 6px; cursor: pointer; }
.tab-btn.active { background: var(--accent, #3ce76a); color: #111; border-color: var(--accent, #3ce76a); }

main { padding: 24px; max-width: 900px; margin: 0 auto; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }

#toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 999; }
.toast { background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; margin-top: 8px; opacity: 0; transform: translateY(10px); transition: opacity .3s, transform .3s; }
.toast.show { opacity: 1; transform: translateY(0); }
.toast-error { background: #c0392b; }
```

- [ ] **Step 6: Serve locally and verify the login screen renders and rejects a wrong password**

```bash
cd ~/Desktop/inner-athlete-website && python3 -m http.server 8899 &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8899/manage/
kill %1
```
Expected: `200`. Then open `http://localhost:8899/manage/` in a browser (the Worker must be deployed — see Task 15 — for a real login attempt; until then, confirm visually that the styled login card renders with the `iA` mark, matching brand colors).

- [ ] **Step 7: Commit**

```bash
git add manage/
git commit -m "Add /manage frontend shell: login, tabs, api/toast helpers"
```

---

### Task 11: Image optimization helper

**Files:**
- Create: `manage/js/imageOptimize.js`

**Interfaces:**
- Produces: `resizeToWebp(file, width, height) -> Promise<string>` (returns a base64 string, no `data:` prefix). Task 12's catalog.js calls this twice per uploaded photo — once at 533×800 (mobile), once at 1280×1920 (desktop) — matching the site's existing convention confirmed in the spec.

- [ ] **Step 1: Implement the resize/encode helper**

```javascript
// manage/js/imageOptimize.js

/** Loads an uploaded File into an <img>, draws it center-cropped onto a
 *  canvas at the target size (cover-fit, matching how the site's existing
 *  product photos are framed), and returns base64-encoded WebP. */
export async function resizeToWebp(file, width, height, quality = 0.85) {
  const bitmap = await createImageBitmap(file);

  const srcRatio = bitmap.width / bitmap.height;
  const targetRatio = width / height;
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (srcRatio > targetRatio) {
    sw = bitmap.height * targetRatio;
    sx = (bitmap.width - sw) / 2;
  } else {
    sh = bitmap.width / targetRatio;
    sy = (bitmap.height - sh) / 2;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
```

- [ ] **Step 2: Verify in a browser console**

This depends on browser APIs (`createImageBitmap`, `OffscreenCanvas`) not available under Node, so it's verified manually rather than with `node:test`:

```bash
cd ~/Desktop/inner-athlete-website && python3 -m http.server 8899 &
```
In Chrome devtools console, on `http://localhost:8899/manage/`:
```javascript
const { resizeToWebp } = await import('./js/imageOptimize.js');
const input = document.createElement('input');
input.type = 'file';
input.onchange = async () => {
  const b64 = await resizeToWebp(input.files[0], 533, 800);
  console.log('mobile size (base64 chars):', b64.length);
  const b64desktop = await resizeToWebp(input.files[0], 1280, 1920);
  console.log('desktop size (base64 chars):', b64desktop.length);
};
input.click();
```
Expected: pick any photo, both base64 strings print with no error — desktop noticeably larger than mobile.

- [ ] **Step 3: Commit**

```bash
git add manage/js/imageOptimize.js
git commit -m "Add client-side image resize/WebP encode for product photo uploads"
```

---

### Task 12: Catalog tab UI (products, banner, region availability)

**Files:**
- Create: `manage/js/catalog.js`
- Modify: `content/products.json` (add `visibleRegions` to all three existing products, seeded to match today's live behavior exactly — not a uniform default)
- Modify: `js/ui.js:16` (the hardcoded `p.id === 3` Maldives rule)
- Modify: `manage/manage.css` (append form styles)

**Interfaces:**
- Consumes: `apiFetch` (Task 10), `showToast` (Task 10), `resizeToWebp` (Task 11).
- Produces: `initCatalogTab()` (called by `main.js`, already wired in Task 10).

This task makes the one approved change to live storefront behavior. Do the `content/products.json` and `js/ui.js` edits first and verify them in isolation before building the UI that edits them going forward.

- [ ] **Step 1: Seed `visibleRegions` on the three existing products**

```json
// content/products.json — add "visibleRegions" to each product object.
// Top (id 1) and Hijab (id 2): not shown in Maldives today — preserve that.
// "visibleRegions": ["LK", "US"]
//
// Set (id 3): shown everywhere today — preserve that.
// "visibleRegions": ["LK", "US", "MV"]
```
Edit the file directly, adding the field to each of the three product objects (do not change any other field).

- [ ] **Step 2: Update the storefront filter to read it**

```javascript
// js/ui.js:16 — replace:
// const visibleProducts = isMaldives ? products.filter(p => p.id === 3) : products;
// with:
const visibleProducts = products.filter(p => p.visibleRegions.includes(region.country));
```

- [ ] **Step 3: Rebuild and verify the storefront behavior is unchanged**

```bash
cd ~/Desktop/inner-athlete-website && ./minify.sh
python3 -m http.server 8899 &
sleep 2
```
Load `http://localhost:8899/?loc=MV` in a browser — expect only the Set to show, exactly as before. Load with `?loc=LK` — expect all three. This is the real regression check the spec's Testing section calls for; don't skip it.

```bash
kill %1
```

- [ ] **Step 4: Commit the storefront change on its own**

```bash
git add content/products.json js/ui.js js/bundle.min.js js/bundle.min.js.map js/bundle.js.map
git commit -m "Make region availability data-driven (visibleRegions) instead of hardcoded"
git push origin main
```
Push this one immediately and let CI build it — it's the one live-site change in this project and deserves its own verified deploy, separate from the rest of `/manage` which isn't live-facing.

- [ ] **Step 5: Build the Catalog tab UI**

```javascript
// manage/js/catalog.js
import { apiFetch } from './api.js';
import { showToast } from './toast.js';
import { resizeToWebp } from './imageOptimize.js';

const REGIONS = [['LK', 'Sri Lanka'], ['MV', 'Maldives'], ['US', 'International']];
const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

let productsState = null; // { products: [...], sha }
let bannerState = null;   // { LK, MV, default, sha }

export async function initCatalogTab() {
  const panel = document.getElementById('tab-catalog');
  panel.innerHTML = '<p>Loading…</p>';

  const [productsRes, bannerRes] = await Promise.all([
    apiFetch('/api/products'), apiFetch('/api/banner'),
  ]);
  productsState = await productsRes.json();
  bannerState = await bannerRes.json();

  render();
}

function render() {
  const panel = document.getElementById('tab-catalog');
  panel.innerHTML = `
    <h2>Products</h2>
    <div id="product-forms"></div>
    <h2>Banner Messages</h2>
    <div id="banner-form"></div>
  `;
  productsState.products.forEach((p, i) => renderProductForm(p, i));
  renderBannerForm();
}

function renderProductForm(product, index) {
  const container = document.getElementById('product-forms');
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <h3>${escapeHtml(product.name)}</h3>
    <label>Name <input data-field="name" value="${escapeHtml(product.name)}" /></label>
    <label>Description <textarea data-field="description">${escapeHtml(product.description || '')}</textarea></label>
    <div class="price-row">
      <label>USD <input type="number" step="0.01" data-field="priceUSD" value="${product.priceUSD}" /></label>
      <label>LKR <input type="number" data-field="priceLKR" value="${product.priceLKR}" /></label>
      <label>MVR <input type="number" data-field="priceMVR" value="${product.priceMVR}" /></label>
    </div>
    <fieldset class="sizes">
      <legend>Sizes</legend>
      ${SIZES.map(s => `<label><input type="checkbox" data-size="${s}" ${product.sizes.includes(s) ? 'checked' : ''}/> ${s}</label>`).join('')}
    </fieldset>
    <fieldset class="regions">
      <legend>Available in</legend>
      ${REGIONS.map(([code, label]) => `<label><input type="checkbox" data-region="${code}" ${product.visibleRegions.includes(code) ? 'checked' : ''}/> ${label}</label>`).join('')}
    </fieldset>
    <button class="save-product-btn">Save</button>
  `;
  container.appendChild(el);

  el.querySelector('.save-product-btn').addEventListener('click', async () => {
    productsState.products[index] = {
      ...product,
      name: el.querySelector('[data-field="name"]').value,
      description: el.querySelector('[data-field="description"]').value,
      priceUSD: parseFloat(el.querySelector('[data-field="priceUSD"]').value),
      priceLKR: parseInt(el.querySelector('[data-field="priceLKR"]').value, 10),
      priceMVR: parseInt(el.querySelector('[data-field="priceMVR"]').value, 10),
      sizes: [...el.querySelectorAll('[data-size]:checked')].map(c => c.dataset.size),
      visibleRegions: [...el.querySelectorAll('[data-region]:checked')].map(c => c.dataset.region),
    };
    await saveProducts();
  });
}

function renderBannerForm() {
  const container = document.getElementById('banner-form');
  container.innerHTML = `
    <label>Sri Lanka <input data-field="LK" value="${escapeHtml(bannerState.LK)}" /></label>
    <label>Maldives <input data-field="MV" value="${escapeHtml(bannerState.MV)}" /></label>
    <label>International <input data-field="default" value="${escapeHtml(bannerState.default)}" /></label>
    <button id="save-banner-btn">Save</button>
  `;
  container.querySelector('#save-banner-btn').addEventListener('click', async () => {
    bannerState.LK = container.querySelector('[data-field="LK"]').value;
    bannerState.MV = container.querySelector('[data-field="MV"]').value;
    bannerState.default = container.querySelector('[data-field="default"]').value;
    const res = await apiFetch('/api/banner', { method: 'PUT', body: JSON.stringify(bannerState) });
    if (res.ok) {
      const { sha } = await res.json();
      bannerState.sha = sha;
      showToast('Banner saved');
    } else {
      showToast('Save failed', true);
    }
  });
}

async function saveProducts() {
  const res = await apiFetch('/api/products', { method: 'PUT', body: JSON.stringify(productsState) });
  if (res.ok) {
    const { sha } = await res.json();
    productsState.sha = sha;
    showToast('Product saved');
  } else {
    showToast('Save failed', true);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 6: Append form styles to manage.css**

```css
/* manage/manage.css — append */
.card { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.card label { display: block; margin: 10px 0; font-size: .9rem; }
.card input[type="text"], .card input[type="number"], .card input:not([type]), .card textarea { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #ddd; border-radius: 6px; margin-top: 4px; }
.price-row { display: flex; gap: 12px; }
.price-row label { flex: 1; }
fieldset { border: 1px solid #eee; border-radius: 8px; margin: 12px 0; }
fieldset label { display: inline-block; width: auto; margin-right: 12px; }
.save-product-btn, #save-banner-btn { margin-top: 12px; }
```

- [ ] **Step 7: Manual verification (Worker must be deployed — Task 15)**

Log into `/manage`, edit a price, save, confirm a toast appears and the change lands in `content/products.json` on GitHub within a few seconds.

- [ ] **Step 8: Commit**

```bash
git add manage/js/catalog.js manage/manage.css
git commit -m "Add Catalog tab UI: products, banner, region checkboxes"
```

---

### Task 13: Sales tab UI

**Files:**
- Create: `manage/js/sales.js`
- Modify: `manage/manage.css` (append sales-table styles)

**Interfaces:**
- Consumes: `apiFetch`, `showToast` from Task 10; reads `productsState` shape indirectly by re-fetching `/api/products` for the line-item dropdown (kept independent of `catalog.js`'s module-level state, so this tab works even if opened before the Catalog tab has loaded).
- Produces: `initSalesTab()` (called by `main.js`, already wired in Task 10).

- [ ] **Step 1: Implement sales.js**

```javascript
// manage/js/sales.js
import { apiFetch } from './api.js';
import { showToast } from './toast.js';

let catalog = [];
let lineItems = [];

export async function initSalesTab() {
  const panel = document.getElementById('tab-sales');
  panel.innerHTML = '<p>Loading…</p>';

  const productsRes = await apiFetch('/api/products');
  catalog = (await productsRes.json()).products;

  render();
  await refreshTotals();
  await refreshList();
}

function render() {
  const panel = document.getElementById('tab-sales');
  panel.innerHTML = `
    <div id="totals" class="card"></div>

    <div class="card">
      <h2>New Sale</h2>
      <div id="line-items"></div>
      <button id="add-item-btn" type="button">+ Add item</button>
      <label>Currency
        <select id="sale-currency"><option>LKR</option><option>USD</option><option>MVR</option></select>
      </label>
      <label>Total <input id="sale-total" type="number" step="0.01" /></label>
      <label>Customer name <input id="sale-name" /></label>
      <label>Customer phone <input id="sale-phone" /></label>
      <label>Status
        <select id="sale-status"><option value="paid" selected>Paid</option><option value="pending">Pending</option></select>
      </label>
      <label>Notes <textarea id="sale-notes"></textarea></label>
      <button id="save-sale-btn">Save Sale</button>
    </div>

    <div class="card">
      <h2>Sales Log</h2>
      <div class="filters">
        <select id="filter-status"><option value="">All</option><option value="paid">Paid</option><option value="pending">Pending</option></select>
        <input type="date" id="filter-from" />
        <input type="date" id="filter-to" />
        <button id="apply-filter-btn">Filter</button>
        <a id="export-btn" href="#">Export CSV</a>
      </div>
      <table id="sales-table"><thead><tr>
        <th>Date</th><th>Status</th><th>Customer</th><th>Items</th><th>Total</th><th></th>
      </tr></thead><tbody></tbody></table>
    </div>
  `;

  lineItems = [];
  addLineItemRow();
  document.getElementById('add-item-btn').addEventListener('click', addLineItemRow);
  document.getElementById('save-sale-btn').addEventListener('click', saveSale);
  document.getElementById('apply-filter-btn').addEventListener('click', refreshList);
  document.getElementById('sale-total').addEventListener('focus', recomputeTotal);
}

function addLineItemRow() {
  const container = document.getElementById('line-items');
  const row = document.createElement('div');
  row.className = 'line-item-row';
  row.innerHTML = `
    <select class="item-product">
      ${catalog.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
    </select>
    <input class="item-size" placeholder="Size" />
    <input class="item-color" placeholder="Color" />
    <input class="item-qty" type="number" value="1" min="1" />
    <input class="item-price" type="number" step="0.01" placeholder="Price" />
  `;
  container.appendChild(row);

  const productSelect = row.querySelector('.item-product');
  const priceInput = row.querySelector('.item-price');
  const fillPrice = () => {
    const product = catalog.find(p => p.id == productSelect.value);
    const currency = document.getElementById('sale-currency').value;
    if (product) priceInput.value = product[`price${currency}`];
    recomputeTotal();
  };
  productSelect.addEventListener('change', fillPrice);
  fillPrice();

  [row.querySelector('.item-qty'), priceInput].forEach(input =>
    input.addEventListener('input', recomputeTotal)
  );
}

function recomputeTotal() {
  const rows = document.querySelectorAll('.line-item-row');
  let total = 0;
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    total += qty * price;
  });
  document.getElementById('sale-total').value = total.toFixed(2);
}

function collectLineItems() {
  return [...document.querySelectorAll('.line-item-row')].map(row => {
    const product = catalog.find(p => p.id == row.querySelector('.item-product').value);
    return {
      name: product?.name || '',
      size: row.querySelector('.item-size').value,
      color: row.querySelector('.item-color').value,
      qty: parseFloat(row.querySelector('.item-qty').value) || 0,
      price: parseFloat(row.querySelector('.item-price').value) || 0,
    };
  });
}

async function saveSale() {
  const body = {
    currency: document.getElementById('sale-currency').value,
    total: parseFloat(document.getElementById('sale-total').value) || 0,
    customer_name: document.getElementById('sale-name').value,
    customer_phone: document.getElementById('sale-phone').value,
    status: document.getElementById('sale-status').value,
    notes: document.getElementById('sale-notes').value,
    items: collectLineItems(),
  };
  const res = await apiFetch('/api/sales', { method: 'POST', body: JSON.stringify(body) });
  if (res.ok) {
    showToast('Sale saved');
    render();
    await refreshTotals();
    await refreshList();
  } else {
    showToast('Save failed', true);
  }
}

function currentFilterQuery() {
  const status = document.getElementById('filter-status')?.value;
  const from = document.getElementById('filter-from')?.value;
  const to = document.getElementById('filter-to')?.value;
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params.toString();
}

async function refreshTotals() {
  const res = await apiFetch('/api/sales/totals');
  const { today, thisMonth, allTime } = await res.json();
  const fmt = (obj) => Object.entries(obj).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(', ') || '—';
  document.getElementById('totals').innerHTML = `
    <h2>Totals (paid only)</h2>
    <p><strong>Today:</strong> ${fmt(today)}</p>
    <p><strong>This month:</strong> ${fmt(thisMonth)}</p>
    <p><strong>All time:</strong> ${fmt(allTime)}</p>
  `;
}

async function refreshList() {
  const qs = currentFilterQuery();
  const res = await apiFetch(`/api/sales${qs ? '?' + qs : ''}`);
  const { sales } = await res.json();
  const tbody = document.querySelector('#sales-table tbody');
  tbody.innerHTML = sales.map(s => `
    <tr data-id="${s.id}">
      <td>${escapeHtml(s.created_at)}</td>
      <td>
        <select class="row-status">
          <option value="paid" ${s.status === 'paid' ? 'selected' : ''}>Paid</option>
          <option value="pending" ${s.status === 'pending' ? 'selected' : ''}>Pending</option>
        </select>
      </td>
      <td>${escapeHtml(s.customer_name || '')}</td>
      <td>${escapeHtml(s.items.map(i => `${i.qty}x ${i.name}`).join(', '))}</td>
      <td>${s.currency} ${Number(s.total).toFixed(2)}</td>
      <td></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.row-status').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      const res = await apiFetch(`/api/sales/${id}`, {
        method: 'PATCH', body: JSON.stringify({ status: e.target.value }),
      });
      if (res.ok) { showToast('Updated'); refreshTotals(); }
      else showToast('Update failed', true);
    });
  });

  document.getElementById('export-btn').href =
    `https://innerathlete-backoffice.thenilan92.workers.dev/api/sales/export${qs ? '?' + qs : ''}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

Note: the CSV export link points straight at the Worker URL rather than going through `apiFetch`, since a `<a href>` download can't attach an `Authorization` header. This means `/api/sales/export` is reachable without a session token as written. **Before this task is done, revisit Task 3's `requireAuth` check** — either accept the export endpoint being unauthenticated (low stakes: read-only, no PII beyond what's already in the export itself) or switch the export button to a `fetch` + `Blob` download (attaches the token properly, slightly more code). Pick one explicitly rather than leaving it unexamined; the spec didn't settle this, so flag it to the user rather than deciding silently.

- [ ] **Step 2: Append sales styles to manage.css**

```css
/* manage/manage.css — append */
.line-item-row { display: flex; gap: 8px; margin-bottom: 8px; }
.line-item-row select, .line-item-row input { flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 6px; }
.filters { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
#sales-table { width: 100%; border-collapse: collapse; }
#sales-table th, #sales-table td { text-align: left; padding: 8px; border-bottom: 1px solid #eee; font-size: .9rem; }
#export-btn { margin-left: auto; }
```

- [ ] **Step 3: Manual verification (Worker must be deployed — Task 15)**

Log in, add a sale with two line items, confirm the total auto-sums, save, confirm it appears in the list and totals update. Toggle its status and confirm totals update again (a pending sale shouldn't count; flipping it to paid should).

- [ ] **Step 4: Commit**

```bash
git add manage/js/sales.js manage/manage.css
git commit -m "Add Sales tab UI: entry form, list, totals, CSV export"
```

---

### Task 14: Deploy the Worker

**Files:** none (deployment + secret configuration only)

- [ ] **Step 1: Deploy**

```bash
cd ~/Desktop/inner-athlete-website/backoffice
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler deploy
```
Note the deployed URL — confirm it matches `https://innerathlete-backoffice.thenilan92.workers.dev` (the URL already hardcoded into `manage/js/api.js`, `manage/js/auth.js`, and `manage/js/sales.js`'s export link in earlier tasks). If Cloudflare assigns a different subdomain, update those three files before continuing.

- [ ] **Step 2: Set secrets**

`STAFF_PASSWORD` can be reused if it hasn't been rotated since it was set on the old Worker:
```bash
printf 'ridge-coral-opal-3549' | npx --yes wrangler secret put STAFF_PASSWORD
```
If it *has* been rotated, use the current value instead — ask the user rather than guessing.

`GITHUB_PAT` was deliberately not kept after Task 4 of the original CMS setup — it needs to be re-supplied. Same pattern as before: the user runs this themselves so it never passes through chat:
```bash
npx --yes wrangler secret put GITHUB_PAT
```

`SESSION_SECRET` is new and purely operational — generate and set it directly:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))" | npx --yes wrangler secret put SESSION_SECRET
```

- [ ] **Step 3: Verify the deployed Worker responds**

```bash
curl -s -X POST https://innerathlete-backoffice.thenilan92.workers.dev/auth -d '{"password":"wrong"}' -o /dev/null -w "%{http_code}\n"
```
Expected: `401` (confirms the Worker is live and secrets are wired, without needing the real password in this check).

- [ ] **Step 4: No commit** — this task only changes deployed state, not repo files.

---

### Task 15: End-to-end smoke test and Decap migration

**Files:**
- Delete: `admin/index.html`, `admin/config.yml`
- Delete: `cms-auth/worker.js`, `cms-auth/wrangler.toml`

- [ ] **Step 1: Full end-to-end smoke test against production**

In a real browser, at `https://www.innerathleteactive.com/manage/` (once `index.html`'s footer link is added — see Step 4):
1. Log in with the real password.
2. Catalog: edit a product's price, save, confirm the toast, confirm the commit lands on GitHub within seconds and the existing `Build and Minify Assets` Action fires.
3. Catalog: uncheck a region on a product, save, reload the storefront with `?loc=<that region>`, confirm it's gone.
4. Catalog: upload a new photo for a color, confirm both a mobile and desktop file appear under `img/uploads/` on GitHub.
5. Sales: add a sale with two line items, confirm the total auto-sums, save.
6. Sales: confirm it appears in the list and in "Today"'s total.
7. Sales: toggle it to Pending, confirm the total drops; toggle back to Paid, confirm it returns.
8. Sales: export CSV, confirm it downloads and opens with the right columns.
9. Log out, confirm the login screen reappears and the stored token is gone (`localStorage.getItem('manage_token')` is `null` in devtools).

- [ ] **Step 2: Retire the old Worker**

```bash
source ~/.cloudflare/credentials && export CLOUDFLARE_API_TOKEN
npx --yes wrangler delete --name innerathlete-cms-auth --force
```

- [ ] **Step 3: Remove Decap and the old Worker's source**

```bash
cd ~/Desktop/inner-athlete-website
rm -rf admin/ cms-auth/
```

- [ ] **Step 4: Add the footer link (the second approved live-site change)**

```html
<!-- index.html — in the footer, change: -->
<!-- &copy; 2026 <a href="/manage/">innerAthlete</a>. All Rights Reserved. -->
```
Find the exact current line (`&copy; 2026 innerAthlete. All Rights Reserved.`) and wrap only the brand name in the link, matching the spec's "Entry point" section.

- [ ] **Step 5: Rebuild and verify no leftover references**

```bash
./minify.sh
grep -r "decap-cms" index.html   # expect: no output
grep -r "innerathlete-cms-auth" . --include="*.js" --include="*.html" --include="*.yml"  # expect: no output
```

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "Retire Decap CMS; /manage is now the only admin interface"
git pull --rebase origin main
git push origin main
```

- [ ] **Step 7: Confirm the live footer link works**

```bash
sleep 60
curl -s "https://www.innerathleteactive.com/?x=$RANDOM" | grep -o '<a href="/manage/">innerAthlete</a>'
```
Expected: the link is present in the served HTML.

---

## Self-Review Notes

- **Spec coverage:** every section of the spec maps to a task — Architecture/Auth → Tasks 1–3, Catalog (incl. region availability, image optimization) → Tasks 4–6, 11–12, Sales (incl. totals, CSV) → Tasks 7–9, 13, Look and feel → woven into Tasks 10, 12, 13's CSS steps, Entry point → Task 15 Steps 4 & 7, Migration from Decap → Task 15 Steps 2–3, Security → enforced throughout (parameterized D1 queries in Task 7, escaping in Tasks 12–13, fine-grained PAT reused not widened). Future: blog is intentionally not a task — it's a non-goal, documented in the spec only.
- **Open item surfaced, not buried:** Task 13 flags that the CSV export link bypasses `apiFetch`'s auth header (a `<a href>` can't set one) and asks the user to explicitly choose between accepting that or switching to a `fetch`+`Blob` download — this wasn't decided in the spec and I'm not deciding it silently.
- **Type/name consistency checked:** `apiFetch` (Task 10) is the one function every later frontend task imports for Worker calls — verified Tasks 12 and 13 both import it by that exact name, not a variant. `requireAuth`/`registerRoute`/`json` (Task 3) are the three router exports every backend task after it consumes — verified Tasks 5–9 import the same three names. The Worker URL (`innerathlete-backoffice.thenilan92.workers.dev`) is hardcoded identically in `api.js`, `auth.js`, and `sales.js`'s export link — Task 14 Step 1 explicitly calls out updating all three if Cloudflare assigns a different subdomain, so they can't drift silently.
