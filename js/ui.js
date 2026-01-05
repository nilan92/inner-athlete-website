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
            <div class="card-img-container">
                <picture>
                    <source srcset="${defaultColor.imgDesktop}" media="(min-width: 768px)" class="source-${p.id}">
                    <img src="${defaultColor.imgMobile}" class="card-img main-img-${p.id}" alt="${p.name}">
                </picture>
            </div>
            
            <div class="card-body">
                <div class="card-header">
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
        if (contactTextEl) contactTextEl.innerText = 'Reach out via WhatsApp at +94 77 188 9532 for Sri Lanka.';
        if (phoneLK) phoneLK.style.display = 'inline';
        if (phoneMV) phoneMV.style.display = 'none';
    } else if (region.country === 'MV') {
        if (shippingEl) shippingEl.innerText = 'Yes! We offer fast delivery across the Maldives (Malé and nearby atolls).';
        if (contactEl) contactEl.innerText = 'How can I contact you?';
        if (contactTextEl) contactTextEl.innerText = 'Reach out via WhatsApp at +960 971 8918 for Maldives.';
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