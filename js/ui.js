import { products } from './data.js';
import { getUserRegion } from './state.js';

// NOTE: We removed imports from 'cart.js' to prevent circular dependency crashes.
// The functions addToCart, removeFromCart, etc., work because they are attached 
// to 'window' in main.js.

// --- RENDER PRODUCTS ---
export function renderProducts() {
    const list = document.getElementById("product-list");
    if (!list) return;

    const region = getUserRegion();
    const isMaldives = region.country === 'MV';

    const visibleProducts = isMaldives ? products.filter(p => p.id === 3) : products;

    let html = visibleProducts.map(p => {
        let price = region.code === 'LKR' ? p.priceLKR : (region.code === 'MVR' ? p.priceMVR : p.priceUSD);
        const defaultColor = p.colors[0];
        
        let sizeHTML = '';
        if (p.sizes.length > 0) {
            sizeHTML = `
                <div class="size-row">
                    <label>Size</label>
                    <button class="size-btn" onclick="toggleSizeModal(true)">Guide</button>
                </div>
                <select id="size-${p.id}" aria-label="Select size">${p.sizes.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
            `;
        } else {
            sizeHTML = `<input type="hidden" id="size-${p.id}" value="-">`;
        }

        return `
        <div class="product-card" id="product-${p.id}" data-selected-color="${defaultColor.name}">
            <div class="card-img-container" onclick="openProductModal(${p.id})" role="button" tabindex="0" aria-label="View details for ${p.name}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProductModal(${p.id});}">
                <picture>
                    <source srcset="${defaultColor.imgDesktop}" media="(min-width: 768px)" class="source-${p.id}">
                    <img src="${defaultColor.imgMobile}" class="card-img main-img-${p.id}" alt="${p.name}">
                </picture>
                <div class="card-quick-overlay">
                    <span class="card-quick-btn">
                        <i class="fa-solid fa-bolt"></i> View Details
                    </span>
                </div>
            </div>
            
            <div class="card-body">
                <div class="card-header" onclick="openProductModal(${p.id})" role="button" tabindex="0" title="View details for ${p.name}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProductModal(${p.id});}">
                    <h3>${p.name}</h3>
                    <span class="price">${region.symbol} ${price.toFixed(2)}</span>
                </div>

                <div class="options-area">
                    ${sizeHTML}
                    <label style="display:block; margin-bottom:8px">Color</label>
                    <div class="color-options">
                        ${p.colors.map((c, i) => `
                            <div class="color-circle ${i === 0 ? 'active' : ''}" 
                                 style="background-color: ${c.hex};" 
                                 onclick="selectColor(${p.id}, '${c.name}', '${c.imgMobile}', '${c.imgDesktop}', this)"
                                 aria-label="Select ${c.name} color">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <button class="btn-add" onclick="addToCart(${p.id})">
                    Add to Cart <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        </div>
        `;
    }).join("");

    if (isMaldives) {
        html += `
        <div class="product-card coming-soon-card">
            <div class="card-img-container">
                 <div class="cs-overlay">
                    <h3>COMING SOON</h3>
                    <p>Separates</p>
                 </div>
                 <img src="img/longline-modest-active-top-black-mobile.webp" class="card-img" style="opacity:0.3; filter:grayscale(100%);"> 
            </div>
            <div class="card-body">
                <div class="card-header">
                     <h3 style="color:#999;">Top & Hijab Separates</h3>
                     <span class="price" style="color:#aaa;">Dropping Later</span>
                </div>
                <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; text-align:center; color:#777; font-size:0.9rem;">
                    <p>Currently available exclusively as a full set for our Maldives launch.</p>
                </div>
                <button class="btn-add" style="background:#ccc; cursor:not-allowed;">
                    Locked
                </button>
            </div>
        </div>
        `;
    }

    list.innerHTML = html;
}

// --- CART UI (Fixed: Accepts cart data as argument) ---
export function updateCartUI(cart) {
    const region = getUserRegion();
    const badge = document.getElementById("cart-badge");
    const itemsList = document.getElementById("cart-items");
    const totalEl = document.getElementById("total-price");
    
    const count = cart.reduce((acc, item) => acc + item.qty, 0);
    badge.innerText = count;
    badge.classList.toggle("hidden", count === 0);

    if (cart.length === 0) {
        itemsList.innerHTML = `
            <li style="list-style:none; text-align:center; padding:20px; color:#555;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                    <i class="fa-solid fa-basket-shopping" style="font-size:2rem;"></i>
                    <p style="margin:0;">Your bag is empty</p>
                </div>
            </li>`;
        totalEl.innerText = `${region.symbol} 0.00`;
        return;
    }

    let total = 0;
    itemsList.innerHTML = cart.map(item => {
        total += item.price * item.qty;
        return `
            <li class="cart-item">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <div class="item-meta">
                        ${item.size !== '-' ? `Size: <b>${item.size}</b> | ` : ''} 
                        Color: <b>${item.color}</b>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
                        <button onclick="decreaseQty('${item.variantId}')" style="padding:2px 8px; cursor: pointer; border:1px solid #ddd; background:#fff; border-radius:4px;">-</button>
                        <span>${item.qty}</span>
                        <button onclick="increaseQty('${item.variantId}')" style="padding:2px 8px; cursor: pointer; border:1px solid #ddd; background:#fff; border-radius:4px;">+</button>
                    </div>
                </div>
                <div class="item-right">
                    <div style="font-weight:bold;">${item.symbol} ${(item.price * item.qty).toFixed(2)}</div>
                    <button class="remove-btn" onclick="removeFromCart('${item.variantId}')">Remove</button>
                </div>
            </li>
        `;
    }).join("");

    totalEl.innerText = `${region.symbol} ${total.toFixed(2)}`;
}

// --- UPDATE FAQ BASED ON REGION ---
export function updateFAQ(region) {
    const shippingEl = document.getElementById('faq-shipping');
    const contactEl = document.getElementById('faq-contact');
    const contactTextEl = document.getElementById('faq-contact-text');
    const phoneLK = document.getElementById('faq-phone');
    const phoneMV = document.getElementById('faq-phone-mv');

    if (region.country === 'LK') {
        if (shippingEl) shippingEl.innerText = 'Yes! We offer fast delivery across Sri Lanka (Colombo and island-wide).';
        if (contactEl) contactEl.innerText = 'How can I contact you?';
        if (contactTextEl) contactTextEl.innerText = 'Reach out via WhatsApp at +94 77 188 9532 for immediate assistance.';
        if (phoneLK) phoneLK.style.display = 'inline';
        if (phoneMV) phoneMV.style.display = 'none';
    } else if (region.country === 'MV') {
        if (shippingEl) shippingEl.innerText = 'Yes! We offer fast delivery to the Maldives (Malé and nearby atolls).';
        if (contactEl) contactEl.innerText = 'How can I contact you?';
        if (contactTextEl) contactTextEl.innerText = 'Reach out via WhatsApp at +960 971 8918 for immediate assistance.';
        if (phoneLK) phoneLK.style.display = 'none';
        if (phoneMV) phoneMV.style.display = 'inline';
    } else {
        if (shippingEl) shippingEl.innerText = 'Yes! We offer international shipping. Contact us for rates and delivery times.';
        if (contactEl) contactEl.innerText = 'How can I contact you?';
        if (contactTextEl) contactTextEl.innerText = 'Reach out via WhatsApp at +94 77 188 9532 for global inquiries.';
        if (phoneLK) phoneLK.style.display = 'inline';
        if (phoneMV) phoneMV.style.display = 'none';
    }
}

// --- FAQ ACCORDION ---
export function initFAQAccordion() {
    const faqContainer = document.querySelector('.faq');
    if (!faqContainer) return;

    faqContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.faq-question');
        if (!button) return;

        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', !isExpanded);
    });
}

// --- INTERACTION HANDLERS ---
export function selectColor(productId, colorName, mobilePath, desktopPath, element) {
    const card = document.getElementById(`product-${productId}`);
    card.setAttribute('data-selected-color', colorName);
    
    const circles = card.querySelectorAll('.color-circle');
    circles.forEach(c => c.classList.remove('active'));
    element.classList.add('active');

    const mobileImg = card.querySelector(`.main-img-${productId}`);
    const desktopSource = card.querySelector(`.source-${productId}`);

    mobileImg.style.opacity = "0.5";
    mobileImg.classList.add('skeleton'); // Add skeleton loading state
    const loader = new Image();
    loader.src = mobilePath;

    loader.onload = () => {
        desktopSource.srcset = desktopPath;
        mobileImg.src = mobilePath;
        mobileImg.style.opacity = "1";
        mobileImg.classList.remove('skeleton'); // Remove skeleton
    };
}

export function toggleCart(show) {
    const sidebar = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");
    const cartIcon = document.querySelector('.cart-icon');
    if (show) { 
        closeProductModal();
        sidebar.classList.add("open"); 
        overlay.style.display = "block"; 
        if (cartIcon) cartIcon.setAttribute('aria-expanded', 'true');
    } else { 
        sidebar.classList.remove("open"); 
        overlay.style.display = "none"; 
        if (cartIcon) cartIcon.setAttribute('aria-expanded', 'false');
    }
}

export function toggleSizeModal(show) {
    document.getElementById("size-modal").style.display = show ? "flex" : "none";
}

// --- PRODUCT DETAILS MODAL ---
const PRODUCT_SPECS = {
    1: {
        tagline: "PRO ELITE // MODEST ATHLETIC TOP",
        badge: "4-WAY STRETCH",
        fabric: "88% Premium Polyester, 12% Spandex High-Density Athletic Weave",
        fit: "Tailored Longline Silhouette (Full Modest Coverage)",
        highlights: [
            { icon: "fa-shield-halved", title: "Full Coverage Cut", desc: "Elongated hemline stays securely in place through deep squats, jumps, and sprints." },
            { icon: "fa-wind", title: "Hydro-Wick Tech", desc: "Breathable rapid-dry weave actively draws perspiration away to keep you cool." },
            { icon: "fa-person-running", title: "4-Way Mobility", desc: "Engineered multi-directional stretch ensures unrestricted athletic movement." },
            { icon: "fa-sun", title: "Zero Sheer Opacity", desc: "Dense performance knit guarantees 100% squat-proof confidence with zero bulk." }
        ],
        care: "Machine wash cold with like colors • Do not bleach • Tumble dry low or air dry"
    },
    2: {
        tagline: "PRO ELITE // PERFORMANCE SPORTS HIJAB",
        badge: "PINLESS SECURE FIT",
        fabric: "90% Technical Micro-Poly, 10% Elastane Breathable Knit",
        fit: "Ergonomic Slip-Resistant Fit (Contoured Neck Coverage)",
        highlights: [
            { icon: "fa-bolt", title: "Instant Pinless Fit", desc: "Engineered contour stays locked through sprints, HIIT, and cardio with zero pins." },
            { icon: "fa-feather", title: "Featherlight Airflow", desc: "Laser-tuned breathability expels excess heat around head and neck." },
            { icon: "fa-droplet-slash", title: "Rapid Evaporation", desc: "Moisture-transporting fibers keep hair and skin comfortably dry." },
            { icon: "fa-arrows-rotate", title: "Zero Distraction", desc: "Soft, irritation-free stretch adapts naturally to every workout." }
        ],
        care: "Hand wash or gentle machine wash cold • Air dry recommended • Do not iron"
    },
    3: {
        tagline: "PRO ELITE // SIGNATURE 2-PIECE SYSTEM",
        badge: "COMPLETE ATHLETIC SET",
        fabric: "Longline Active Top + Matching Performance Sports Hijab",
        fit: "Complete Coordinated System (Top & Hijab Included)",
        highlights: [
            { icon: "fa-layer-group", title: "Complete Modest Kit", desc: "Full synergy between active top and sports hijab in one cohesive package." },
            { icon: "fa-shield-halved", title: "Head-to-Hem Coverage", desc: "Designed for confident high-intensity gym, running, and competitive sports." },
            { icon: "fa-wind", title: "Sync Airflow Fabric", desc: "Matching breathable, lightweight performance fibers with maximum stretch." },
            { icon: "fa-award", title: "Best Value Signature Set", desc: "The ultimate innerAthlete experience engineered for modern modest athletes." }
        ],
        care: "Machine wash cold on gentle cycle • Line dry • Wash like colors together"
    }
};

let currentModalProduct = null;
let currentModalColor = null;
let currentModalSize = null;
let currentModalQty = 1;

export function openProductModal(productId, colorName) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById("product-modal");
    const modalBody = document.getElementById("product-modal-content");
    if (!modal || !modalBody) return;

    currentModalProduct = product;

    // Determine current color (prefer param, then card attribute, then first color)
    const card = document.getElementById(`product-${productId}`);
    const cardColor = card ? card.getAttribute('data-selected-color') : null;
    const targetColorName = colorName || cardColor || (product.colors[0] ? product.colors[0].name : '');
    currentModalColor = product.colors.find(c => c.name === targetColorName) || product.colors[0];

    // Determine current size
    const cardSizeSelect = document.getElementById(`size-${productId}`);
    const cardSize = cardSizeSelect ? cardSizeSelect.value : null;
    if (product.sizes && product.sizes.length > 0) {
        currentModalSize = (cardSize && product.sizes.includes(cardSize)) ? cardSize : product.sizes[0];
    } else {
        currentModalSize = '-';
    }

    currentModalQty = 1;

    renderProductModalContent();

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

export function closeProductModal() {
    const modal = document.getElementById("product-modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function renderProductModalContent() {
    const modalBody = document.getElementById("product-modal-content");
    if (!modalBody || !currentModalProduct) return;

    const p = currentModalProduct;
    const region = getUserRegion();
    const price = region.code === 'LKR' ? p.priceLKR : (region.code === 'MVR' ? p.priceMVR : p.priceUSD);
    const spec = PRODUCT_SPECS[p.id] || {
        tagline: "PRO ELITE // ACTIVEWEAR",
        badge: "HIGH PERFORMANCE",
        fabric: "Premium Modest Athletic Blend",
        fit: "Athletic Cut",
        highlights: [
            { icon: "fa-shield-halved", title: "Full Coverage", desc: "Designed for confident modest athletic performance." },
            { icon: "fa-wind", title: "Breathable Tech", desc: "High-airflow moisture management fabric." }
        ],
        care: "Machine wash cold with like colors • Air dry"
    };

    modalBody.innerHTML = `
        <div class="pm-container">
            <div class="pm-racing-stripe"></div>
            <div class="pm-grid">
                <!-- Media / Gallery Column -->
                <div class="pm-media-col">
                    <div class="pm-image-wrapper">
                        <span class="pm-badge-tag"><i class="fa-solid fa-bolt"></i> ${spec.badge}</span>
                        <picture id="pm-picture">
                            <source id="pm-desktop-source" srcset="${currentModalColor.imgDesktop}" media="(min-width: 768px)">
                            <img id="pm-main-image" src="${currentModalColor.imgMobile}" alt="${p.name} - ${currentModalColor.name}" class="pm-image">
                        </picture>
                    </div>
                    <div class="pm-thumbs-strip" aria-label="Color options">
                        ${p.colors.map(c => `
                            <button type="button" class="pm-thumb-btn ${c.name === currentModalColor.name ? 'active' : ''}" 
                                    onclick="selectModalColor('${c.name}')" 
                                    title="${c.name}" aria-label="View ${c.name} color">
                                <img src="${c.imgMobile}" alt="${c.name}">
                                <span class="pm-thumb-color-dot" style="background-color: ${c.hex};"></span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Product Details Column -->
                <div class="pm-info-col">
                    <div class="pm-header-row">
                        <span class="pm-kicker"><i class="fa-solid fa-bolt"></i> ${spec.tagline}</span>
                        <h2 id="pm-title" class="pm-title">${p.name}</h2>
                        <div class="pm-price-row">
                            <span class="pm-price" id="pm-unit-price">${region.symbol} ${price.toFixed(2)}</span>
                            <span class="pm-curr-tag">${region.code}</span>
                            <span class="pm-status-tag"><i class="fa-solid fa-circle-check"></i> In Stock</span>
                        </div>
                    </div>

                    <p class="pm-description">${p.description}</p>

                    <!-- Athletic Key Highlights Grid -->
                    <div class="pm-highlights-grid">
                        ${spec.highlights.map(h => `
                            <div class="pm-highlight-card">
                                <div class="pm-highlight-icon"><i class="fa-solid ${h.icon}"></i></div>
                                <div class="pm-highlight-text">
                                    <strong>${h.title}</strong>
                                    <span>${h.desc}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Color Selection -->
                    <div class="pm-section">
                        <div class="pm-section-label">
                            <span>Color:</span>
                            <strong id="pm-selected-color-name">${currentModalColor.name}</strong>
                        </div>
                        <div class="pm-color-swatches">
                            ${p.colors.map(c => `
                                <button type="button" class="pm-swatch ${c.name === currentModalColor.name ? 'active' : ''}" 
                                        onclick="selectModalColor('${c.name}')" 
                                        aria-label="Select ${c.name} color">
                                    <span class="pm-swatch-circle" style="background-color: ${c.hex};"></span>
                                    <span class="pm-swatch-name">${c.name}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Size Selection -->
                    ${p.sizes && p.sizes.length > 0 ? `
                    <div class="pm-section">
                        <div class="pm-section-label">
                            <span>Select Size</span>
                            <button type="button" class="pm-size-guide-btn" onclick="toggleSizeModal(true)">
                                <i class="fa-solid fa-ruler-combined"></i> Size Guide
                            </button>
                        </div>
                        <div class="pm-size-chips" role="radiogroup" aria-label="Available sizes">
                            ${p.sizes.map(s => `
                                <button type="button" class="pm-size-chip ${s === currentModalSize ? 'active' : ''}" 
                                        onclick="selectModalSize('${s}')" 
                                        aria-pressed="${s === currentModalSize}">
                                    ${s}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    ` : `
                    <div class="pm-section">
                        <div class="pm-one-size-badge">
                            <i class="fa-solid fa-check"></i> One Size • Ergonomic Stretch Fit
                        </div>
                    </div>
                    `}

                    <!-- Quantity & Add to Cart -->
                    <div class="pm-action-row">
                        <div class="pm-qty-stepper">
                            <button type="button" class="pm-qty-btn" onclick="updateModalQty(-1)" aria-label="Decrease quantity">
                                <i class="fa-solid fa-minus"></i>
                            </button>
                            <span id="pm-qty-display" class="pm-qty-val">${currentModalQty}</span>
                            <button type="button" class="pm-qty-btn" onclick="updateModalQty(1)" aria-label="Increase quantity">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                        <button type="button" id="pm-add-btn" class="pm-btn-add" onclick="addModalProductToCart(${p.id})">
                            <span class="pm-btn-text">Add to Cart</span>
                            <span class="pm-btn-price" id="pm-btn-total">${region.symbol} ${(price * currentModalQty).toFixed(2)}</span>
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>

                    <!-- Sporty Specs Accordion -->
                    <div class="pm-accordion">
                        <details class="pm-accordion-item" open>
                            <summary><i class="fa-solid fa-shirt"></i> Fabric & Fit</summary>
                            <div class="pm-accordion-content">
                                <p><strong>Fabric:</strong> ${spec.fabric}</p>
                                <p><strong>Fit:</strong> ${spec.fit}</p>
                            </div>
                        </details>
                        <details class="pm-accordion-item">
                            <summary><i class="fa-solid fa-rotate-left"></i> Care & Washing</summary>
                            <div class="pm-accordion-content">
                                <p>${spec.care}</p>
                            </div>
                        </details>
                        <details class="pm-accordion-item">
                            <summary><i class="fa-solid fa-truck-fast"></i> Shipping & Support</summary>
                            <div class="pm-accordion-content">
                                <p>Direct delivery across Sri Lanka and Maldives. Fast WhatsApp customer support for sizing advice and questions.</p>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function selectModalColor(colorName) {
    if (!currentModalProduct) return;
    const colorObj = currentModalProduct.colors.find(c => c.name === colorName);
    if (!colorObj) return;

    currentModalColor = colorObj;

    // Transition image with sleek opacity & scale dip
    const mainImg = document.getElementById("pm-main-image");
    const desktopSource = document.getElementById("pm-desktop-source");
    if (mainImg) {
        mainImg.classList.add("pm-switching");
        const loader = new Image();
        loader.src = colorObj.imgMobile;
        loader.onload = () => {
            if (desktopSource) desktopSource.srcset = colorObj.imgDesktop;
            mainImg.src = colorObj.imgMobile;
            mainImg.alt = `${currentModalProduct.name} - ${colorObj.name}`;
            mainImg.classList.remove("pm-switching");
        };
    }

    // Update color label
    const nameEl = document.getElementById("pm-selected-color-name");
    if (nameEl) nameEl.textContent = colorObj.name;

    // Update swatch active classes
    const swatches = document.querySelectorAll(".pm-swatch");
    swatches.forEach(swatch => {
        const isMatch = swatch.getAttribute("aria-label")?.includes(colorObj.name);
        swatch.classList.toggle("active", Boolean(isMatch));
    });

    // Update thumbnail buttons
    const thumbs = document.querySelectorAll(".pm-thumb-btn");
    thumbs.forEach(thumb => {
        const isMatch = thumb.getAttribute("title") === colorObj.name;
        thumb.classList.toggle("active", Boolean(isMatch));
    });

    // Sync background card
    const card = document.getElementById(`product-${currentModalProduct.id}`);
    if (card) {
        card.setAttribute('data-selected-color', colorObj.name);
        const circles = card.querySelectorAll('.color-circle');
        circles.forEach(c => c.classList.remove('active'));
        const matchingCircle = card.querySelector(`.color-circle[aria-label*="${colorObj.name}"]`);
        if (matchingCircle) {
            matchingCircle.classList.add('active');
            const cardMobileImg = card.querySelector(`.main-img-${currentModalProduct.id}`);
            const cardDesktopSource = card.querySelector(`.source-${currentModalProduct.id}`);
            if (cardMobileImg) cardMobileImg.src = colorObj.imgMobile;
            if (cardDesktopSource) cardDesktopSource.srcset = colorObj.imgDesktop;
        }
    }
}

export function selectModalSize(size) {
    currentModalSize = size;
    const chips = document.querySelectorAll(".pm-size-chip");
    chips.forEach(chip => {
        const isMatch = chip.textContent.trim() === size;
        chip.classList.toggle("active", isMatch);
        chip.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });

    // Sync card size select
    if (currentModalProduct) {
        const cardSelect = document.getElementById(`size-${currentModalProduct.id}`);
        if (cardSelect) cardSelect.value = size;
    }
}

export function updateModalQty(delta) {
    currentModalQty = Math.max(1, Math.min(20, currentModalQty + delta));
    const qtyDisplay = document.getElementById("pm-qty-display");
    if (qtyDisplay) {
        qtyDisplay.textContent = currentModalQty;
        qtyDisplay.classList.add("pm-qty-bump");
        setTimeout(() => qtyDisplay.classList.remove("pm-qty-bump"), 200);
    }

    // Update total on button
    if (currentModalProduct) {
        const region = getUserRegion();
        const price = region.code === 'LKR' ? currentModalProduct.priceLKR : (region.code === 'MVR' ? currentModalProduct.priceMVR : currentModalProduct.priceUSD);
        const totalEl = document.getElementById("pm-btn-total");
        if (totalEl) totalEl.textContent = `${region.symbol} ${(price * currentModalQty).toFixed(2)}`;
    }
}

export function addModalProductToCart(productId) {
    if (!currentModalProduct || currentModalProduct.id !== productId) return;

    const modalBtn = document.getElementById("pm-add-btn");
    
    // Call addToCart from cart.js via window.addToCart
    if (typeof window.addToCart === 'function') {
        window.addToCart(productId, {
            size: currentModalSize,
            color: currentModalColor.name,
            qty: currentModalQty,
            sourceBtn: modalBtn
        });
    }

    if (modalBtn) {
        const originalContent = modalBtn.innerHTML;
        modalBtn.innerHTML = `<span class="pm-btn-text">Added to Bag!</span> <i class="fa-solid fa-check"></i>`;
        modalBtn.style.background = "#1da851";
        modalBtn.style.borderColor = "#1da851";
        setTimeout(() => {
            modalBtn.innerHTML = originalContent;
            modalBtn.style.background = "";
            modalBtn.style.borderColor = "";
        }, 1500);
    }
}

// --- ANIMATIONS ---
export function triggerBounceAnimation() {
    const cartIconBigger = document.querySelector('.cart-icon i'); 
    cartIconBigger.style.animation = 'none';
    cartIconBigger.offsetHeight; 
    cartIconBigger.style.animation = 'bounce-add 0.8s ease';
}

export function runFlyingAnimation(startBtn) {
    const startRect = startBtn.getBoundingClientRect();
    const startX = startRect.left + (startRect.width / 2);
    const startY = startRect.top + (startRect.height / 2);

    const cartIcon = document.querySelector('.cart-icon i');
    const endRect = cartIcon.getBoundingClientRect();
    
    const particle = document.createElement('div');
    particle.classList.add('flying-particle');
    document.body.appendChild(particle);

    particle.style.left = `${startX - 12}px`;
    particle.style.top = `${startY - 12}px`;

    const deltaX = (endRect.left + endRect.width / 2) - startX;
    const deltaY = (endRect.top + endRect.height / 2) - startY;

    particle.style.setProperty('--end-x', `${deltaX}px`);
    particle.style.setProperty('--end-y', `${deltaY}px`);

    particle.addEventListener('animationend', () => {
        particle.remove();
        triggerBounceAnimation();
    });
}

export function initTypewriter() {
    const textElement = document.getElementById("typewriter-text");
    if (!textElement) return;

    const phrases = ["Premium Modest Activewear", "Engineered for Motion", "Designed for Confidence"];
    let phraseIndex = 0; let charIndex = 0; let isDeleting = false;

    function typeEffect() {
        const currentPhrase = phrases[phraseIndex];
        if (isDeleting) {
            textElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            textElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
        }
        let typeSpeed = isDeleting ? 40 : 90;
        if (!isDeleting && charIndex === currentPhrase.length) {
            typeSpeed = 2000; isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false; phraseIndex = (phraseIndex + 1) % phrases.length; typeSpeed = 500; 
        }
        setTimeout(typeEffect, typeSpeed);
    }
    typeEffect();
}

export function initSnow() {
    function createSnowflake() {
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');
        const size = Math.random() * 3 + 2; 
        snowflake.style.width = `${size}px`; snowflake.style.height = `${size}px`;
        snowflake.style.left = Math.random() * 100 + 'vw';
        snowflake.style.opacity = Math.random() * 0.4 + 0.1;
        const duration = Math.random() * 10 + 10;
        
        snowflake.animate([
            { transform: 'translateY(0px)' }, 
            { transform: `translateY(100vh)` }
        ], { duration: duration * 1000, easing: 'linear', fill: 'forwards' });
        document.body.appendChild(snowflake);
        setTimeout(() => { snowflake.remove(); }, duration * 1000);
    }
    setInterval(createSnowflake, 400); 
}

export function initScrollObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add("active");
            else if (entry.boundingClientRect.top > 0) entry.target.classList.remove("active");
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });
    
    document.querySelectorAll('.scroll-reveal, .fade-in-up, .fade-in-left').forEach(el => observer.observe(el));
}