"use strict";

// Set this to your deployed Worker URL — see cms-worker/README.md for setup.
const API_BASE = "https://inner-athlete-store-manager.YOUR-SUBDOMAIN.workers.dev";

const MARKET_LABELS = { US: "Rest of World (USD)", LK: "Sri Lanka (LKR)", MV: "Maldives (MVR)" };
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];
const SITE_BASE = "https://www.innerathleteactive.com/";

const state = { products: [] };

const app = () => document.getElementById("app");

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
}

function imgUrl(path) {
    return path ? SITE_BASE + path : "";
}

function slugify(text) {
    return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

// ---------- API ----------

async function api(path, options = {}) {
    const res = await fetch(API_BASE + path, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });
    if (res.status === 401) {
        const err = new Error("Your session expired — please sign in again.");
        err.unauthorized = true;
        throw err;
    }
    let data = {};
    try { data = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status})`);
    return data;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read the selected file"));
        reader.readAsDataURL(file);
    });
}

async function uploadColorImage(file, productSlug, colorName, kind) {
    const ext = (file.name.split(".").pop() || "webp").toLowerCase();
    const filename = `${productSlug}-${slugify(colorName)}-${kind}.${ext}`;
    const contentBase64 = await fileToBase64(file);
    const result = await api("/api/upload-image", {
        method: "POST",
        body: JSON.stringify({ filename, contentBase64 }),
    });
    return result.path;
}

// ---------- boot ----------

(async function init() {
    try {
        await api("/api/me");
        await showDashboard();
    } catch {
        showLogin();
    }
})();

// ---------- login ----------

function showLogin(notice) {
    app().innerHTML = `
        <div class="login-screen">
            <form id="login-form" class="login-card">
                <h1 class="brand">inner<span>Athlete</span></h1>
                <p class="sub">Store Manager — sign in to manage your shop</p>
                ${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ""}
                <label>Username
                    <input type="text" name="username" autocomplete="username" required autofocus>
                </label>
                <label>Password
                    <input type="password" name="password" autocomplete="current-password" required>
                </label>
                <p class="error" id="login-error" hidden></p>
                <button type="submit" class="btn-primary">Sign In</button>
            </form>
        </div>
    `;
    app().querySelector("#login-form").addEventListener("submit", handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const errorEl = form.querySelector("#login-error");
    const btn = form.querySelector("button");
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
        const res = await fetch(API_BASE + "/api/login", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: form.username.value.trim(), password: form.password.value }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Sign in failed");
        await showDashboard();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        btn.disabled = false;
        btn.textContent = "Sign In";
    }
}

async function handleLogout() {
    try { await fetch(API_BASE + "/api/logout", { method: "POST", credentials: "include" }); } catch (_) { /* ignore */ }
    showLogin("You've been signed out.");
}

// ---------- dashboard shell ----------

async function showDashboard() {
    app().innerHTML = `
        <div class="shell">
            <header class="topbar">
                <h1 class="brand">inner<span>Athlete</span> <small>Store Manager</small></h1>
                <nav class="tabs">
                    <button class="tab-btn active" data-tab="products">Products</button>
                    <button class="tab-btn" data-tab="sizes">Size Chart</button>
                </nav>
                <button class="btn-ghost" id="logout-btn">Log Out</button>
            </header>
            <main id="tab-panel"></main>
        </div>
    `;
    app().querySelector("#logout-btn").addEventListener("click", handleLogout);
    app().querySelectorAll(".tab-btn").forEach((btn) =>
        btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    );
    await switchTab("products");
}

async function switchTab(tab) {
    app().querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    const panel = document.getElementById("tab-panel");
    panel.innerHTML = `<p class="loading">Loading…</p>`;
    try {
        if (tab === "products") await renderProductsList();
        else await renderSizeChart();
    } catch (err) {
        if (err.unauthorized) return showLogin(err.message);
        panel.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
}

// ---------- products: list ----------

async function renderProductsList() {
    const panel = document.getElementById("tab-panel");
    const { products } = await api("/api/products");
    state.products = products;

    panel.innerHTML = `
        <div class="panel-head">
            <h2>Products</h2>
            <button class="btn-primary" id="add-product-btn">+ Add Product</button>
        </div>
        <div class="card-grid" id="product-grid"></div>
    `;
    panel.querySelector("#add-product-btn").addEventListener("click", () => renderProductForm(null));

    const grid = panel.querySelector("#product-grid");
    if (products.length === 0) {
        grid.innerHTML = `<p class="empty">No products yet — click "Add Product" to create your first one.</p>`;
        return;
    }
    grid.innerHTML = products.map(productCardHtml).join("");
    grid.querySelectorAll("[data-edit]").forEach((btn) =>
        btn.addEventListener("click", () => {
            const product = state.products.find((p) => p.filename === btn.dataset.edit);
            renderProductForm(product);
        })
    );
    grid.querySelectorAll("[data-delete]").forEach((btn) =>
        btn.addEventListener("click", () => confirmDeleteProduct(btn.dataset.delete))
    );
}

function productCardHtml(p) {
    const d = p.data;
    const thumb = d.colors && d.colors[0] ? d.colors[0].imgMobile : "";
    const markets = (d.markets || []).map((m) => MARKET_LABELS[m] || m).join(", ") || "Hidden in all markets";
    return `
        <article class="product-card">
            ${thumb
                ? `<img src="${escapeHtml(imgUrl(thumb))}" alt="" loading="lazy">`
                : `<div class="thumb-placeholder">No photo yet</div>`}
            <div class="card-body">
                <h3>${escapeHtml(d.name)}</h3>
                <p class="muted small">${escapeHtml(d.sku || "")}</p>
                <p class="price-row">$${Number(d.priceUSD).toFixed(2)} · Rs ${Number(d.priceLKR)} · Rf ${Number(d.priceMVR)}</p>
                <p class="muted small">Sold in: ${escapeHtml(markets)}</p>
            </div>
            <div class="card-actions">
                <button class="btn-secondary" data-edit="${escapeHtml(p.filename)}">Edit</button>
                <button class="btn-danger" data-delete="${escapeHtml(p.filename)}">Delete</button>
            </div>
        </article>
    `;
}

async function confirmDeleteProduct(filename) {
    const product = state.products.find((p) => p.filename === filename);
    if (!product) return;
    if (!confirm(`Delete "${product.data.name}"? This removes it from the shop immediately and can't be undone here.`)) return;
    try {
        await api(`/api/products/${encodeURIComponent(filename)}`, {
            method: "DELETE",
            body: JSON.stringify({ sha: product.sha }),
        });
        await renderProductsList();
    } catch (err) {
        alert(err.message);
    }
}

// ---------- products: add/edit form ----------

function nextProductId() {
    return state.products.reduce((max, p) => Math.max(max, p.data.id || 0), 0) + 1;
}

function blankProduct() {
    return {
        id: nextProductId(),
        name: "", slug: "", sku: "", description: "",
        priceUSD: 0, priceLKR: 0, priceMVR: 0,
        sizes: ["S", "M", "L", "XL"],
        markets: ["US", "LK", "MV"],
        colors: [],
    };
}

function renderProductForm(existing) {
    const panel = document.getElementById("tab-panel");
    const isNew = !existing;
    const data = existing ? JSON.parse(JSON.stringify(existing.data)) : blankProduct();
    data.colors = (data.colors || []).map((c) => ({ ...c }));

    panel.innerHTML = `
        <div class="panel-head">
            <h2>${isNew ? "Add Product" : `Edit "${escapeHtml(data.name)}"`}</h2>
            <button class="btn-ghost" id="back-btn">&larr; Back to Products</button>
        </div>
        <form id="product-form" class="product-form" novalidate>
            <div class="form-grid">
                <label>Product Name
                    <input type="text" name="name" required value="${escapeHtml(data.name)}">
                </label>
                <label>URL Slug <span class="hint">Lowercase, dashes only — best left alone once published.</span>
                    <input type="text" name="slug" required value="${escapeHtml(data.slug)}" pattern="[a-z0-9-]+">
                </label>
                <label>SKU
                    <input type="text" name="sku" value="${escapeHtml(data.sku)}">
                </label>
                <label class="full">Description <span class="hint">Shown to customers and used for search engine listings — be clear and specific.</span>
                    <textarea name="description" rows="3">${escapeHtml(data.description)}</textarea>
                </label>
            </div>

            <fieldset class="prices">
                <legend>Prices</legend>
                <label>Rest of World (USD)
                    <input type="number" step="0.01" min="0" name="priceUSD" required value="${data.priceUSD}">
                </label>
                <label>Sri Lanka (LKR)
                    <input type="number" step="0.01" min="0" name="priceLKR" required value="${data.priceLKR}">
                </label>
                <label>Maldives (MVR)
                    <input type="number" step="0.01" min="0" name="priceMVR" required value="${data.priceMVR}">
                </label>
            </fieldset>

            <fieldset class="checkbox-group">
                <legend>Available Sizes — leave all unticked if this product has no sizes (e.g. a hijab)</legend>
                ${SIZE_OPTIONS.map((s) => `
                    <label class="checkbox"><input type="checkbox" name="sizes" value="${s}" ${data.sizes.includes(s) ? "checked" : ""}> ${s}</label>
                `).join("")}
            </fieldset>

            <fieldset class="checkbox-group">
                <legend>Markets — untick a market to instantly hide this product from shoppers there</legend>
                ${Object.entries(MARKET_LABELS).map(([code, label]) => `
                    <label class="checkbox"><input type="checkbox" name="markets" value="${code}" ${data.markets.includes(code) ? "checked" : ""}> ${label}</label>
                `).join("")}
            </fieldset>

            <fieldset>
                <legend>Colors &amp; Photos — the first color is shown by default; each needs a mobile (portrait) and desktop (landscape) photo</legend>
                <div id="color-list"></div>
                <button type="button" class="btn-secondary" id="add-color-btn">+ Add Color</button>
            </fieldset>

            <p class="error" id="form-error" hidden></p>
            <div class="form-actions">
                <button type="button" class="btn-ghost" id="cancel-btn">Cancel</button>
                <button type="submit" class="btn-primary" id="save-btn">${isNew ? "Create Product" : "Save Changes"}</button>
            </div>
        </form>
    `;

    panel.querySelector("#back-btn").addEventListener("click", renderProductsList);
    panel.querySelector("#cancel-btn").addEventListener("click", renderProductsList);

    if (isNew) {
        const nameInput = panel.querySelector('[name="name"]');
        const slugInput = panel.querySelector('[name="slug"]');
        nameInput.addEventListener("input", () => {
            if (!slugInput.dataset.touched) slugInput.value = slugify(nameInput.value);
        });
        slugInput.addEventListener("input", () => { slugInput.dataset.touched = "true"; });
    }

    renderColorList(data.colors);
    panel.querySelector("#add-color-btn").addEventListener("click", () => {
        data.colors.push({ name: "", hex: "#000000", imgMobile: "", imgDesktop: "" });
        renderColorList(data.colors);
    });

    panel.querySelector("#product-form").addEventListener("submit", (e) => handleProductSubmit(e, existing, data, isNew));
}

function renderColorList(colors) {
    const list = document.getElementById("color-list");
    list.innerHTML = colors.length
        ? colors.map((c, i) => colorRowHtml(c, i)).join("")
        : `<p class="empty">No colors yet — add at least one.</p>`;

    colors.forEach((color, i) => {
        const row = list.querySelector(`[data-color-index="${i}"]`);
        if (!row) return;
        row.querySelector('[name="color-name"]').addEventListener("input", (e) => { color.name = e.target.value; });
        row.querySelector('[name="color-hex"]').addEventListener("input", (e) => { color.hex = e.target.value; });
        row.querySelector("[data-remove-color]").addEventListener("click", () => {
            colors.splice(i, 1);
            renderColorList(colors);
        });
        row.querySelector("[data-mobile-input]").addEventListener("change", (e) => readColorImage(e, color, "mobile", colors));
        row.querySelector("[data-desktop-input]").addEventListener("change", (e) => readColorImage(e, color, "desktop", colors));
    });
}

function colorRowHtml(c, i) {
    const mobilePreview = c._mobilePreview || imgUrl(c.imgMobile);
    const desktopPreview = c._desktopPreview || imgUrl(c.imgDesktop);
    return `
        <div class="color-row" data-color-index="${i}">
            <div class="color-row-fields">
                <label>Color Name
                    <input type="text" name="color-name" value="${escapeHtml(c.name)}" required>
                </label>
                <label>Swatch
                    <input type="color" name="color-hex" value="${escapeHtml(c.hex || "#000000")}">
                </label>
                <button type="button" class="btn-danger small" data-remove-color>Remove Color</button>
            </div>
            <div class="image-pickers">
                <div class="image-picker">
                    <span>Mobile photo (portrait)</span>
                    ${mobilePreview ? `<img src="${escapeHtml(mobilePreview)}" alt="" class="preview">` : `<div class="preview placeholder">No photo</div>`}
                    <input type="file" accept="image/*" data-mobile-input>
                </div>
                <div class="image-picker">
                    <span>Desktop photo (landscape)</span>
                    ${desktopPreview ? `<img src="${escapeHtml(desktopPreview)}" alt="" class="preview">` : `<div class="preview placeholder">No photo</div>`}
                    <input type="file" accept="image/*" data-desktop-input>
                </div>
            </div>
        </div>
    `;
}

function readColorImage(e, color, kind, colors) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        color[`_${kind}File`] = file;
        color[`_${kind}Preview`] = reader.result;
        renderColorList(colors);
    };
    reader.readAsDataURL(file);
}

async function handleProductSubmit(e, existing, data, isNew) {
    e.preventDefault();
    const form = e.currentTarget;
    const errorEl = form.querySelector("#form-error");
    const saveBtn = form.querySelector("#save-btn");
    errorEl.hidden = true;

    const name = form.name.value.trim();
    const slug = slugify(form.slug.value);
    if (!name || !slug) return showFormError(errorEl, "Name and slug are required.");
    if (data.colors.length === 0) return showFormError(errorEl, "Add at least one color.");
    for (const c of data.colors) {
        if (!c.name.trim()) return showFormError(errorEl, "Every color needs a name.");
        if (!(c.imgMobile || c._mobileFile) || !(c.imgDesktop || c._desktopFile)) {
            return showFormError(errorEl, `"${c.name}" needs both a mobile and a desktop photo.`);
        }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
        for (const c of data.colors) {
            if (c._mobileFile) c.imgMobile = await uploadColorImage(c._mobileFile, slug, c.name, "mobile");
            if (c._desktopFile) c.imgDesktop = await uploadColorImage(c._desktopFile, slug, c.name, "desktop");
            delete c._mobileFile; delete c._desktopFile; delete c._mobilePreview; delete c._desktopPreview;
        }

        const payload = {
            id: data.id,
            name,
            slug,
            sku: form.sku.value.trim(),
            description: form.description.value.trim(),
            priceUSD: Number(form.priceUSD.value),
            priceLKR: Number(form.priceLKR.value),
            priceMVR: Number(form.priceMVR.value),
            sizes: [...form.querySelectorAll('[name="sizes"]:checked')].map((el) => el.value),
            markets: [...form.querySelectorAll('[name="markets"]:checked')].map((el) => el.value),
            colors: data.colors.map(({ name, hex, imgMobile, imgDesktop }) => ({ name, hex, imgMobile, imgDesktop })),
        };

        const filename = `${payload.id}-${payload.slug}.json`;
        const requestBody = { data: payload };
        if (existing && existing.filename === filename) requestBody.sha = existing.sha;

        await api(`/api/products/${encodeURIComponent(filename)}`, { method: "PUT", body: JSON.stringify(requestBody) });

        // If the ID or slug changed, the filename changed too — clean up the old file.
        if (existing && existing.filename !== filename) {
            await api(`/api/products/${encodeURIComponent(existing.filename)}`, {
                method: "DELETE",
                body: JSON.stringify({ sha: existing.sha }),
            });
        }

        await renderProductsList();
    } catch (err) {
        showFormError(errorEl, err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = isNew ? "Create Product" : "Save Changes";
    }
}

function showFormError(el, message) {
    el.textContent = message;
    el.hidden = false;
}

// ---------- size chart ----------

async function renderSizeChart() {
    const panel = document.getElementById("tab-panel");
    const { data, sha } = await api("/api/size-chart");

    panel.innerHTML = `
        <div class="panel-head"><h2>Size Chart</h2></div>
        <p class="hint">This table appears in the "Size Guide" pop-up that customers see on the site.</p>
        <form id="size-chart-form" class="size-chart-form" novalidate>
            <table class="size-chart-table">
                <thead><tr><th>Size</th><th>Shoulder (in)</th><th>Chest (in)</th><th>Length (in)</th><th></th></tr></thead>
                <tbody id="size-rows"></tbody>
            </table>
            <button type="button" class="btn-secondary" id="add-row-btn">+ Add Row</button>
            <p class="error" id="size-error" hidden></p>
            <div class="form-actions">
                <button type="submit" class="btn-primary" id="size-save-btn">Save Size Chart</button>
            </div>
        </form>
    `;

    const rows = data.rows.map((r) => ({ ...r }));
    renderSizeRows(rows);
    panel.querySelector("#add-row-btn").addEventListener("click", () => {
        rows.push({ size: "", shoulder: "", chest: "", length: "" });
        renderSizeRows(rows);
    });
    panel.querySelector("#size-chart-form").addEventListener("submit", (e) => handleSizeChartSubmit(e, rows, sha));
}

function renderSizeRows(rows) {
    const tbody = document.getElementById("size-rows");
    tbody.innerHTML = rows.map((r, i) => `
        <tr data-row-index="${i}">
            <td><input type="text" name="size" value="${escapeHtml(r.size)}" required></td>
            <td><input type="text" name="shoulder" value="${escapeHtml(r.shoulder)}"></td>
            <td><input type="text" name="chest" value="${escapeHtml(r.chest)}"></td>
            <td><input type="text" name="length" value="${escapeHtml(r.length)}"></td>
            <td><button type="button" class="btn-danger small" data-remove-row title="Remove row">&times;</button></td>
        </tr>
    `).join("");

    tbody.querySelectorAll("tr").forEach((tr, i) => {
        ["size", "shoulder", "chest", "length"].forEach((field) => {
            tr.querySelector(`[name="${field}"]`).addEventListener("input", (e) => { rows[i][field] = e.target.value; });
        });
        tr.querySelector("[data-remove-row]").addEventListener("click", () => {
            rows.splice(i, 1);
            renderSizeRows(rows);
        });
    });
}

async function handleSizeChartSubmit(e, rows, sha) {
    e.preventDefault();
    const form = e.currentTarget;
    const errorEl = form.querySelector("#size-error");
    const btn = form.querySelector("#size-save-btn");
    errorEl.hidden = true;

    if (rows.length === 0 || rows.some((r) => !r.size.trim())) {
        return showFormError(errorEl, "Every row needs a size label.");
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
        await api("/api/size-chart", { method: "PUT", body: JSON.stringify({ data: { rows }, sha }) });
        await renderSizeChart();
    } catch (err) {
        showFormError(errorEl, err.message);
        btn.disabled = false;
        btn.textContent = "Save Size Chart";
    }
}
