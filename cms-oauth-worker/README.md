# CMS Login Backend (Cloudflare Worker)

The `/admin` content manager (Decap CMS) lets your client log in with a
GitHub account and edit products directly. GitHub doesn't allow the
browser to exchange a login code for an access token by itself, so a tiny
server is needed in between — this Worker is that server. It only ever
sees a short-lived login code and hands back a token to the popup window;
it stores nothing.

## 1. Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   (https://github.com/settings/developers)
2. Fill in:
   - **Application name:** innerAthlete CMS
   - **Homepage URL:** `https://www.innerathleteactive.com/admin/`
   - **Authorization callback URL:** `https://inner-athlete-cms-auth.<your-subdomain>.workers.dev/callback`
     (use your actual Worker URL — see step 3 for how to find it)
3. Click **Register application**, then **Generate a new client secret**.
   Copy the **Client ID** and **Client Secret** — you'll need them in step 3.

## 2. Install Wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
wrangler login
```

## 3. Deploy the Worker

From this folder (`cms-oauth-worker/`):

```bash
wrangler deploy
```

This prints the Worker's URL, e.g. `https://inner-athlete-cms-auth.<your-subdomain>.workers.dev`.
If the callback URL you registered in step 1 doesn't match this exactly
(including `/callback`), go back and update the GitHub OAuth App.

Now set the two secrets from step 1 (Wrangler will prompt you to paste each one):

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

## 4. Point the CMS at your Worker

Open `admin/config.yml` and set `base_url` to your Worker's URL:

```yaml
backend:
  name: github
  repo: nilan92/inner-athlete-website
  branch: main
  base_url: https://inner-athlete-cms-auth.<your-subdomain>.workers.dev
  auth_endpoint: auth
```

Commit and push that change.

## 5. Give your client access

Your client needs a GitHub account that's a **collaborator** on this repo
(Settings → Collaborators → Add people) so the OAuth login can commit
changes on their behalf. They'll then log in at:

`https://www.innerathleteactive.com/admin/`

## How it works (for reference)

1. Client clicks **Login with GitHub** in `/admin` → CMS opens a popup to
   `<worker-url>/auth`.
2. The Worker redirects to GitHub's OAuth consent screen.
3. GitHub redirects back to `<worker-url>/callback?code=...`.
4. The Worker exchanges that code for an access token (server-to-server,
   using the client secret) and passes the token back to the CMS popup via
   `postMessage`.
5. The CMS uses that token to read/write files in this repo directly —
   every save becomes a commit on `main`, which triggers the existing
   GitHub Action to rebuild and deploy the site.
