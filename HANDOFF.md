I have a website project at `github.com/nilan92/inner-athlete-website`. All the code for a custom Store Manager CMS is already built and pushed to branch `claude/new-session-QeR4w`. I need you to complete the deployment. Here's the full context:

**What's already done (don't redo any of this):**
- `admin/` — branded login + dashboard (HTML/CSS/JS)
- `cms-worker/` — Cloudflare Worker that handles auth + proxies GitHub commits
- `content/products/*.json` + `content/size-chart.json` — CMS data files
- `scripts/build_content.py` — auto-regenerates SEO data from content files
- `.github/workflows/minify.yml` — runs build_content.py in CI before minify

**What still needs to happen (in order):**

1. Clone/pull the repo and check out branch `claude/new-session-QeR4w`

2. Create a fine-grained GitHub Personal Access Token at `https://github.com/settings/personal-access-tokens/new`:
   - Token name: `innerAthlete Store Manager`
   - Resource owner: `nilan92`
   - Repository access: Only `inner-athlete-website`
   - Permissions → Repository permissions → Contents: **Read and write**
   - Copy the token

3. Install Wrangler and deploy the worker:
   ```
   npm install -g wrangler
   wrangler login
   cd cms-worker
   wrangler deploy
   ```
   Copy the worker URL it prints (looks like `https://inner-athlete-store-manager.XXXX.workers.dev`)

4. Set the 4 secrets (paste these exact values when prompted):
   ```
   wrangler secret put ADMIN_USERNAME   → innerathlete-store
   wrangler secret put ADMIN_PASSWORD   → jrgkWBXiZfdFMSy9
   wrangler secret put SESSION_SECRET   → fdV_rkLJsh6KuHXvRdtTAi-6dO88Ti3i7M1rk-IHNio
   wrangler secret put GITHUB_TOKEN     → (the token from step 2)
   ```

5. In `admin/admin.js`, find this line near the top:
   ```js
   const API_BASE = "https://inner-athlete-store-manager.YOUR-SUBDOMAIN.workers.dev";
   ```
   Replace `YOUR-SUBDOMAIN` with the real subdomain from the URL you copied in step 3.

6. Commit and push the `admin/admin.js` change to `claude/new-session-QeR4w`.

7. Merge `claude/new-session-QeR4w` into `main`.

The client's login details are username `innerathlete-store`, password `jrgkWBXiZfdFMSy9`. The admin panel will be live at `https://www.innerathleteactive.com/admin/` after the GitHub Pages deploy finishes.
