// Minimal GitHub OAuth proxy for Decap CMS (admin/config.yml -> backend.base_url).
//
// GitHub Pages serves static files only, so the CMS login (which needs a
// client secret exchanged server-side) has to live somewhere else. This
// Worker is that "somewhere else" - it never sees repo content, it only
// turns a GitHub login into a token and hands it back to the CMS tab.
//
// Routes:
//   GET /auth      Decap opens this in a popup -> we redirect to GitHub.
//   GET /callback  GitHub redirects here with a code -> we exchange it for
//                  a token and postMessage it back to the tab that opened
//                  the popup, in the exact format Decap's github backend
//                  expects (see their oauth-provider docs).
//
// Secrets (never in this file - set with `wrangler secret put`):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const state = crypto.randomUUID();
      const authUrl = new URL("https://github.com/login/oauth/authorize");
      authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", `${url.origin}/callback`);
      authUrl.searchParams.set("scope", "repo");
      authUrl.searchParams.set("state", state);

      return new Response(null, {
        status: 302,
        headers: {
          Location: authUrl.toString(),
          // Short-lived, checked on /callback to block CSRF login attempts.
          "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; Max-Age=600; Path=/; SameSite=Lax`,
        },
      });
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const savedState = (request.headers.get("Cookie") || "").match(/oauth_state=([^;]+)/)?.[1];

      if (!code || !state || state !== savedState) {
        return new Response("Login link expired or invalid. Close this tab and try again from the admin page.", { status: 400 });
      }

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error) {
        return new Response(`GitHub login failed: ${tokenData.error_description || tokenData.error || tokenRes.status}`, { status: 400 });
      }

      // Decap's github backend listens for this exact postMessage shape from
      // the popup it opened. It sends "authorizing:github" first as a
      // handshake; we only reply once we've heard that.
      const html = `<!doctype html><html><body>
<p>Logging in&hellip;</p>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:success:' + JSON.stringify({ token: ${JSON.stringify(tokenData.access_token)}, provider: 'github' }),
      e.origin
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
<\/script>
</body></html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html",
          "Set-Cookie": "oauth_state=; Max-Age=0; Path=/",
        },
      });
    }

    return new Response("innerAthlete CMS login helper.", { status: 200 });
  },
};
