# 🏃‍♀️ innerAthlete — Website & Brand Overview

## Short Description

innerAthlete is a **single-page site** promoting premium, modest activewear made for confident movement and everyday performance.

## Brand Positioning

| Aspect | Details |
| :--- | :--- |
| **Value Proposition** | Performance fabrics + modest, thoughtful design. |
| **Target Audience** | Modest dressers seeking functional, high-quality activewear. |
| **Tone** | Confident, respectful, community-focused, inclusive. |

## Repository Purpose

* Static single-page marketing site (`index.html` + assets).
* SEO-ready basics included (**meta tags, open graph, canonical, sitemap, robots**).

---

## 📁 Files of Interest

| File/Folder | Description |
| :--- | :--- |
| `index.html` | Single-page site content, metadata, and canonical link. |
| `css/style.css` | Primary site styles. |
| `js/main.js` | Interactive behavior and animations. |
| `sitemap.xml` | Sitemap for search engine crawlers. |
| `robots.txt` | Crawler rules and sitemap pointer. |
| `img/` | Site images and favicons. |
| `js/plugins/` & `css/plugins/` | Third-party libraries (GSAP, Swiper, FontAwesome, etc). |

---

## 👩‍💻 Flomo Notio — Marketing Agency (Footer Credit)

* This indicates **Flomo Notio** acted as the marketing/creative agency for the project (design, development, or launch support).
* **Keep the footer credit link intact** unless contract/branding changes require removal.
* If the agency needs to be listed in site metadata (for press or portfolio), add a brief **JSON-LD Organization entry** or a small "Credits" section on the site.

---

## 🔎 SEO & Sitemap Notes

### Sitemap Configuration (`sitemap.xml`)
* This is a single-page site — `sitemap.xml` should list the root URL only:
    ```xml
    <loc>[https://innerathleteactive.com/](https://innerathleteactive.com/)</loc>
    ```
* Keep `lastmod` current when you update content.

### File Accessibility
* Ensure the **canonical link** in `index.html` matches your production domain.
* Make `sitemap.xml` and `robots.txt` publicly accessible at:
    * `https://innerathleteactive.com/sitemap.xml`
    * `https://innerathleteactive.com/robots.txt`

### Robots Recommendations (`robots.txt`)
* Allow all common user-agents but block private folders (if any).
* Include **Sitemap directive** (absolute URL).
* An example is included in the repository at `robots.txt`.

---

## 🚀 Performance & Accessibility Tips (Quick)

* Optimize and lazy-load images (already using `loading="lazy"`).
* Use descriptive **alt text** for images (already present).
* Keep critical CSS inline or ensure CSS is loaded early.
* Verify social image (`og:image`) is accessible and sized **~1200x630** for best preview.

## 📊 Analytics & Tracking (Optional)

* Add Google Analytics / GA4 or server logs for traffic insights.
* Add structured data (JSON-LD) for Organization / WebSite if desired.

## ✍️ Content & Marketing

* Keep the **meta description** concise and unique.
* Update **OG and Twitter card images** when launching campaigns.
* Use consistent brand links (replace placeholder social links when pages are ready).

---

## 📞 Contact

* **For site updates:** Update `index.html`, `sitemap.xml`, `robots.txt` and redeploy.
* **Brand contact (visible on site):** inquiries.innerathlete@outlook.com

## ⚖️ License

* Content and assets: owned by **innerAthlete** (or as specified). Code in this repo is permissive for editing.

## 🔁 Change Log

* Track manual updates in version control commits.