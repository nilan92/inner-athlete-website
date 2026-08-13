// Shared-password login for Decap CMS's github backend (admin/config.yml).
//
// Staff type one shared password instead of logging into a GitHub account -
// there's no per-user account at all. The credential that actually matters
// (a GitHub token with write access to this one repo) never leaves this
// Worker: it's read from a secret and handed to the CMS tab only after the
// password checks out. Neither the password nor the token is ever in this
// file or in the repo.
//
// Secrets (set with `wrangler secret put`, never committed):
//   STAFF_PASSWORD  the shared password staff type in
//   GITHUB_PAT      a fine-grained GitHub token scoped to just this repo,
//                   Contents: Read and write - nothing else
//
// Route: Decap opens a popup at base_url + '/auth'. GET shows the password
// form; POST checks it and, if correct, hands back the token using the
// exact postMessage handshake Decap's github backend expects.

const LOGIN_PAGE = (showError) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>innerAthlete Admin Login</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f4f4; }
  form { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,.08); width: 260px; }
  h1 { font-size: 1.1rem; margin: 0 0 20px; }
  input { width: 100%; padding: 10px; margin-bottom: 14px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 1rem; }
  button { width: 100%; padding: 10px; background: #111; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
  .err { color: #c0392b; font-size: .85rem; margin: -6px 0 14px; }
</style></head><body>
<form method="POST">
  <h1>innerAthlete Admin</h1>
  ${showError ? '<div class="err">Wrong password, try again.</div>' : ''}
  <input type="password" name="password" placeholder="Password" autofocus required />
  <button type="submit">Log in</button>
</form>
</body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/auth") {
      return new Response("innerAthlete CMS login helper.", { status: 200 });
    }

    if (request.method === "GET") {
      return new Response(LOGIN_PAGE(false), { headers: { "Content-Type": "text/html" } });
    }

    if (request.method === "POST") {
      const form = await request.formData();
      const password = form.get("password") || "";

      if (password !== env.STAFF_PASSWORD) {
        return new Response(LOGIN_PAGE(true), { status: 401, headers: { "Content-Type": "text/html" } });
      }

      const html = `<!doctype html><html><body>
<p>Logging in&hellip;</p>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:success:' + JSON.stringify({ token: ${JSON.stringify(env.GITHUB_PAT)}, provider: 'github' }),
      e.origin
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
<\/script>
</body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    return new Response("Method not allowed", { status: 405 });
  },
};
