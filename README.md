# 🛍️ innerAthlete — Modest Activewear Website

## Overview
This is the main website for **innerAthlete**, a brand offering premium modest activewear for women. The site features an e-commerce interface with geolocation-based personalization, dynamic currency conversion, and a reactive cart system. Built as a lightweight web application using modern web technologies.

**Live Site:** [innerathleteactive.com](https://www.innerathleteactive.com/)

## 🛠️ Technical Stack
* **Frontend:** HTML5, CSS3 (Variables, Flexbox/Grid), Vanilla JavaScript (ES6 Modules).
* **State Management:** `localStorage` + Runtime JS Objects.
* **External APIs:** Cloudflare Trace (Geolocation), WhatsApp API (Checkout).
* **Build Tools:** Rollup (Bundling), Terser (Minification), Minify (CSS).
* **Architecture:** Client-side SPA behavior with modular JS structure.

---

## 🌍 Key Features & Logic

### 1. Smart Geolocation & Region Locking
The app automatically detects the user's country to serve a localized experience.
* **Method:** Fetches client data via `/cdn-cgi/trace` to determine the ISO country code.
* **Logic:**
    * **Maldives (`MV`):** Switches currency to **MVR (Rf)**, updates support number to the local agent, and **locks** specific products (Top/Hijab separates) that are unavailable in that region.
    * **Sri Lanka (`LK`):** Switches currency to **LKR (Rs)** and uses the HQ support number.
    * **Rest of World:** Defaults to **USD ($)**.

### 2. Reactive Cart System
Built a custom cart engine from scratch without external dependencies.
* **Persistency:** Cart data survives page refreshes via `localStorage`.
* **Reactivity:** Adding items instantly updates the UI (Badge count, Cart Sidebar, Total Price) without page reloads.
* **Dynamic Feedback:** "Add to Cart" buttons provide visual feedback (text change + animation) to confirm actions.

### 3. Serverless WhatsApp Checkout
To minimize costs and friction for a lean startup model, the checkout process bypasses traditional gateways.
* **Process:** The app parses the cart object and constructs a pre-filled, URL-encoded WhatsApp message.
* **Routing:** The message is dynamically routed to the correct sales agent based on the detected region (Maldives Agent vs. HQ).

### 4. Performance & UX
* **Animations:** Custom CSS keyframe animations for cart interactions (Flying particle effect) and scroll-reveal elements.
* **Optimized Assets:** Mobile-first responsive images using the `<picture>` tag for art direction (serving different crops for Mobile vs. Desktop).
* **Modular JS:** Code split into logical modules (`main.js`, `state.js`, `ui.js`, `cart.js`, `data.js`) for maintainability.

---

## 📂 Project Structure

```
website_separatejs/
├── index.html              # Main application markup
├── styles.css              # Main styles
├── styles.min.css          # Minified CSS (generated)
├── js/
│   ├── main.js             # Entry point & app initialization
│   ├── state.js            # Geolocation & region logic
│   ├── ui.js               # UI rendering & interactions
│   ├── cart.js             # Cart management
│   ├── data.js             # Product data
│   └── bundle.min.js       # Bundled & minified JS (generated)
├── img/                    # Optimized images
├── minify.sh               # Build script for minification
├── README.md               # This file
├── robots.txt              # SEO
├── sitemap.xml             # SEO
├── site.webmanifest        # PWA manifest
├── CNAME                   # GitHub Pages domain
└── cache_buster.py         # Utility for cache busting
```

## 🏗️ Building for Production
Run the minification script to bundle, optimize assets, and update cache busting:

```bash
./minify.sh
```

This will:
- Minify `styles.css` to `styles.min.css`.
- Bundle all JS modules starting from `js/main.js` into `js/bundle.min.js` using Rollup, then minify with Terser.
- Generate source maps for debugging.
- Update `index.html` with cache-busting version hashes for all assets.

**Note:** The site loads `js/bundle.min.js` and `styles.min.css` in production. Keep source files for development.

## 🚀 Pushing to GitHub
1. Commit and push your changes (GitHub Actions will auto-run `./minify.sh` and update cache busting).
2. Or, run `./minify.sh` locally first, then push.
3. If using GitHub Pages, the site will auto-deploy from the `main` branch.

## 🖥️ Running Locally
1. Clone the repository.
2. Open `index.html` in a modern browser.
3. For full functionality (geolocation), serve via a local server to avoid CORS issues:
   ```bash
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000`.

## ✍️ Content Management (Client Editing)
Non-technical edits — adding/removing products, changing prices, locking a
product out of a market, editing the size chart, or uploading product photos —
are done through a CMS at **`/admin`** (powered by [Decap CMS](https://decapcms.org/)),
no code required.

* **Source of truth:** `content/products/*.json` and `content/size-chart.json`.
  The CMS reads/writes these files directly (each save = a commit to `main`).
* **Markets:** Each product has a `markets` field (`US`, `LK`, `MV`). Unticking
  a market in the CMS instantly hides that product for shoppers in that region —
  this replaced the old hardcoded Maldives product filter in `js/ui.js`.
* **Auto SEO:** `scripts/build_content.py` regenerates `js/data.js`, the
  `Product` JSON-LD structured data, and the size-guide table in `index.html`
  straight from the content files — so a new product automatically gets correct
  search-engine markup with no manual SEO editing. This script runs
  automatically in CI before `minify.sh` (see `.github/workflows/minify.yml`).
* **Images:** Product photo uploads from the CMS land in `img/products/`.
* **Login backend:** The CMS needs a small OAuth proxy to let the client log in
  with GitHub — see `cms-oauth-worker/README.md` for one-time setup
  (a free Cloudflare Worker).

## 👨‍💻 Developer Notes
Built by Flomo Notio. This project showcases building a performant e-commerce site with complex features using only native web technologies—no heavy frameworks, zero backend costs.

## 🔧 Potential Improvements
- **SEO Enhancements:** Structured data added; consider product-specific schemas.
- **Performance:** Minification, lazy loading, cache busting implemented.
- **PWA:** Service worker added for offline caching.
- **Accessibility:** Test with Lighthouse for ARIA improvements.
- **Analytics:** GA4 integrated.
- **Testing:** Lighthouse CI runs on pushes.
- **CI/CD:** GitHub Actions auto-builds and tests.