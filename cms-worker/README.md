# Store Manager Backend (Cloudflare Worker)

This is the backend for the custom **Store Manager** at `/admin`. It does two
things, with no GitHub branding ever shown to your client:

1. Logs the client in with a plain **username and password you choose**.
2. Saves their edits (products, size chart, photos) by committing directly to
   this repo, using one shared service-account token that lives only on the
   server — the client never sees or needs a GitHub account.

Every save is a normal commit on `main`, so the existing GitHub Action still
runs automatically: it regenerates the SEO data from the new content and
deploys the site.

## 1. Create a GitHub Personal Access Token (the "service account")

This token is what lets the Worker commit to the repo on the client's behalf.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**
   (https://github.com/settings/personal-access-tokens/new)
2. **Resource owner:** your account (`nilan92`)
3. **Repository access:** "Only select repositories" → `inner-athlete-website`
4. **Permissions → Repository permissions → Contents:** Read and write
5. Generate the token and copy it — you'll paste it in step 4 below. Treat it
   like a password; anyone with it can write to this repo.

## 2. Choose credentials & secrets

Decide on:
- A **username** and **password** for your client (keep it simple but not guessable).
- A random **session secret** — any long random string, e.g. generate one with:
  ```bash
  openssl rand -base64 32
  ```

## 3. Install Wrangler and deploy

```bash
npm install -g wrangler
wrangler login
```

From this folder (`cms-worker/`):

```bash
wrangler deploy
```

This prints the Worker's URL, e.g.
`https://inner-athlete-store-manager.<your-subdomain>.workers.dev`.

## 4. Set the secrets

Wrangler will prompt you to paste each value:

```bash
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET
wrangler secret put GITHUB_TOKEN
```

## 5. Point the admin page at your Worker

Open `admin/admin.js` and set `API_BASE` to your Worker's URL:

```js
const API_BASE = "https://inner-athlete-store-manager.<your-subdomain>.workers.dev";
```

Commit and push that change.

## 6. Hand it over

Give your client:
- The URL: `https://www.innerathleteactive.com/admin/`
- The username and password from step 2

They can now add/edit/delete products, lock products out of specific markets,
edit the size chart, and upload product photos — all from a clean, branded
screen with no mention of GitHub.

## Notes

- **Changing the password later:** just run `wrangler secret put ADMIN_PASSWORD`
  again with a new value — no redeploy needed.
- **Session length:** logins last 12 hours (see `SESSION_DURATION_MS` in
  `worker.js`); after that the client simply logs in again.
- **The GitHub token is the only sensitive secret that can modify the repo.**
  If it's ever compromised, revoke it from GitHub's token settings and issue
  a new one (step 1), then `wrangler secret put GITHUB_TOKEN` again.
