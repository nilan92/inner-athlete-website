// --- CONFIGURATION ---
let activePhoneNumber = "+94771889532"; 
const PHONES = {
    DEFAULT: "+94771889532", // Sri Lanka & Rest of World
    MV: "+9609718918"        // Maldives
};

// --- GLOBAL STATE FOR CURRENCY ---
// Default to USD (Rest of World)
const savedRegion = localStorage.getItem("user_region");
let userRegion = savedRegion ? JSON.parse(savedRegion) : {
    code: "USD",
    symbol: "$",
    country: "US" // default
};

// --- DATA ---
const products = [
    {
        id: 1,
        name: "Longline Active Top (Top Only)",

        // DEFINED PRICES FOR REGIONS
        priceUSD: 40.00,  
        priceLKR: 6400,
        priceMVR: 550, // <--- UPDATE THIS

        sizes: ["S", "M", "L", "XL"],
        colors: [
            { name: "Black", hex: "#000000", imgMobile: "img/longline-modest-active-top-black-mobile.webp", imgDesktop: "img/longline-modest-active-top-black-desktop.webp" },
            { name: "Navy Blue", hex: "#000080", imgMobile: "img/longline-modest-active-top-navy-mobile.webp", imgDesktop: "img/longline-modest-active-top-navy-desktop.webp" },
            { name: "Silver", hex: "#C0C0C0", imgMobile: "img/longline-modest-active-top-silver-mobile.webp", imgDesktop: "img/longline-modest-active-top-silver-desktop.webp" },
            { name: "Maroon", hex: "#800000", imgMobile: "img/longline-modest-active-top-maroon-mobile.webp", imgDesktop: "img/longline-modest-active-top-maroon-desktop.webp" }
        ]
    },
    {
        id: 2,
        name: "Performance Sports Hijab",

        // DEFINED PRICES FOR REGIONS
        priceUSD: 12.00,
        priceLKR: 1800,
        priceMVR: 400, // <--- UPDATE THIS

        sizes: [], // Empty array = No size selector
        colors: [
            { name: "Black", hex: "#000000", imgMobile: "img/performance-sports-hijab-black-mobile.webp", imgDesktop: "img/performance-sports-hijab-black-desktop.webp" },
            { name: "Navy Blue", hex: "#000080", imgMobile: "img/performance-sports-hijab-navy-mobile.webp", imgDesktop: "img/performance-sports-hijab-navy-desktop.webp" },
            { name: "Silver", hex: "#C0C0C0", imgMobile: "img/performance-sports-hijab-silver-mobile.webp", imgDesktop: "img/performance-sports-hijab-silver-desktop.webp" },
            { name: "Maroon", hex: "#800000", imgMobile: "img/performance-sports-hijab-maroon-mobile.webp", imgDesktop: "img/performance-sports-hijab-maroon-desktop.webp" }
        ]
    },
    {
        id: 3,
        name: "Active Top & Hijab Set",

        // DEFINED PRICES FOR REGIONS
        priceUSD: 47.00,
        priceLKR: 7600,
        priceMVR: 899, // <--- UPDATE THIS

        sizes: ["S", "M", "L", "XL"],
        colors: [
            { name: "Black", hex: "#000000", imgMobile: "img/modest-activewear-set-black-mobile.webp", imgDesktop: "img/modest-activewear-set-black-desktop.webp" },
            { name: "Navy Blue", hex: "#000080", imgMobile: "img/modest-activewear-set-navy-mobile.webp", imgDesktop: "img/modest-activewear-set-navy-desktop.webp" },
            { name: "Silver", hex: "#C0C0C0", imgMobile: "img/modest-activewear-set-silver-mobile.webp", imgDesktop: "img/modest-activewear-set-silver-desktop.webp" },
            { name: "Maroon", hex: "#800000", imgMobile: "img/modest-activewear-set-maroon-mobile.webp", imgDesktop: "img/modest-activewear-set-maroon-desktop.webp" }
        ]
    }
];

// --- LOCATION DETECTION ---
async function detectLocation() {
    // 1. DEV TESTING: Check if URL has ?loc=XX
    // Example: Open index.html?loc=MV to test Maldives prices
    const urlParams = new URLSearchParams(window.location.search);
    const forceLoc = urlParams.get('loc');

    if (forceLoc) {
        console.log(`🔧 Testing Mode: Forcing location to ${forceLoc}`);
        applyRegionSettings(forceLoc);
        return;
    }
    // B. DETERMINE FETCH URL
        // If Localhost: Use external Cloudflare URL (might have CORS warnings but ok for dev)
        // If Production: Use Relative URL (Stable, requires Orange Cloud in Cloudflare)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const traceUrl = isLocal 
        ? 'https://www.cloudflare.com/cdn-cgi/trace' 
        : '/cdn-cgi/trace';

    // 2. REAL DETECTION (Cloudflare)
    try {
        const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const data = await response.text();
        
        const lines = data.split('\n');
        const locLine = lines.find(line => line.startsWith('loc='));
        const countryCode = locLine ? locLine.split('=')[1] : 'US';

 // Only re-render if the location is different from what we already have
        if (countryCode !== userRegion.country) {
            console.log("📍 Detected New Location:", countryCode);
            applyRegionSettings(countryCode);
        } else {
            console.log("✅ Location verified (Matches Cache):", countryCode);
        }

    } catch (error) {
        console.warn("Location detection failed/blocked. Using default/cached.", error);
    }
}

// Helper function to handle the logic
// Map country codes to Emoji Flags
const flagMap = {
    "LK": "🇱🇰",
    "MV": "🇲🇻",
    "US": "🇺🇸", // Default for others
    "default": "🌍"
};

function applyRegionSettings(countryCode) {
    // 1. Set Region Data & Phone Number
    if (countryCode === 'LK') {
        userRegion = { code: "LKR", symbol: "Rs", country: "LK" };
        activePhoneNumber = PHONES.DEFAULT;
    } else if (countryCode === 'MV') {
        userRegion = { code: "MVR", symbol: "Rf", country: "MV" };
        activePhoneNumber = PHONES.MV; 
    } else {
        userRegion = { code: "USD", symbol: "$", country: "US" };
        activePhoneNumber = PHONES.DEFAULT;
    }

    // 2. Save to Storage
    // localStorage.setItem("user_region", JSON.stringify(userRegion));

    // 3. Update Flag in Nav
    // Check if we have a specific flag, otherwise default
    const flagEmoji = flagMap[userRegion.country] || flagMap["default"];
    const flagEl = document.getElementById("nav-flag");
    if(flagEl) flagEl.innerText = flagEmoji;

    // 4. Update Footer Dropdown (Sync UI with State)
    const selector = document.getElementById("region-select");
    if(selector) selector.value = (userRegion.country === 'LK' || userRegion.country === 'MV') ? userRegion.country : 'US';

    // 4.5. Update Footer Phone Link
    const phoneLink = document.getElementById("footer-phone");
    if (phoneLink) {
        const displayNum = userRegion.country === 'MV' ? "+960 971 8918" : "+94 77 188 9532";
        phoneLink.innerText = displayNum;
        phoneLink.href = `tel:${activePhoneNumber}`;
    }

    // --- 5. NEW: DYNAMIC BANNER TEXT ---
    const promoText = document.getElementById("promo-text");
    if (promoText) {
        if (userRegion.country === 'MV') {
            promoText.innerHTML = `🎉 <strong>Maldives Launch:</strong> Exclusive Full Sets Available Now!`;
        } else if (userRegion.country === 'LK') {
            promoText.innerHTML = `🚚 <strong>Island-wide Delivery:</strong> Get your gear in 2-3 working days.`;
        } else {
            promoText.innerHTML = `✈️ <strong>International Shipping:</strong> Now shipping globally.`;
        }
    }

    // --- NEW: Refresh Cart Prices ---
    // We only run this if the cart actually has items
    if (cart.length > 0) {
        refreshCartForNewRegion();
    }

    // Re-render Products (Products needs to re-render to show/hide "Coming Soon")
    renderProducts();
    // updateCartUI is already called inside refreshCartForNewRegion, so we don't need it here.
    if (cart.length === 0) updateCartUI();
}

// Helper to get the price based on current region
function getPrice(product) {
    if (userRegion.code === 'LKR') return product.priceLKR;
    if (userRegion.code === 'MVR') return product.priceMVR;
    return product.priceUSD;
}

// --- STATE ---
let cart = JSON.parse(localStorage.getItem("cart")) || [];
// NEW FLAG: Tracks if the user has clicked add to cart yet
let isFirstCartClick = true;

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
    renderProducts();
    updateCartUI();
    detectLocation(); // Start location detection on load
});

// --- RENDER PRODUCTS ---
function renderProducts() {
    const list = document.getElementById("product-list");
    const isMaldives = userRegion.country === 'MV';

    // FILTER LOGIC: 
    // If Maldives: Show only Product ID 3 (Set).
    // Else: Show all products.
    const visibleProducts = isMaldives 
        ? products.filter(p => p.id === 3) 
        : products;

    // 1. Generate HTML for active products
    let html = visibleProducts.map(p => {
        const defaultColor = p.colors[0];
        const currentPrice = getPrice(p);
        const symbol = userRegion.symbol;
        
        // ... (Keep your existing Size Selector logic here) ...
        let sizeSelectorHTML = '';
        if (p.sizes.length > 0) {
            sizeSelectorHTML = `
                <div class="size-row">
                    <label for="size-${p.id}">Size</label>
                    <button class="size-btn" onclick="toggleSizeModal(true)">Guide</button>
                </div>
                <select id="size-${p.id}">${p.sizes.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
            `;
        } else {
            sizeSelectorHTML = `<input type="hidden" id="size-${p.id}" value="-">`;
        }
        // ... (End Size Selector Logic) ...

        return `
        <div class="product-card" id="product-${p.id}" data-selected-color="${defaultColor.name}">
            <div class="card-img-container">
                <picture>
                    <source srcset="${defaultColor.imgDesktop}" media="(min-width: 768px)" class="source-${p.id} ">
                    <img src="${defaultColor.imgMobile}" class="card-img main-img-${p.id}" alt="${p.name}">
                </picture>
            </div>
            
            <div class="card-body">
                <div class="card-header">
                    <h3>${p.name}</h3>
                    <span class="price">${symbol} ${currentPrice.toFixed(2)}</span>
                </div>

                <div class="options-area">
                    ${sizeSelectorHTML}
                    <label style="display:block; margin-bottom:8px">Color</label>
                    <div class="color-options">
                        ${p.colors.map((c, index) => `
                            <div class="color-circle ${index === 0 ? 'active' : ''}" 
                                 style="background-color: ${c.hex};" 
                                 onclick="selectColor(${p.id}, '${c.name}', '${c.imgMobile}', '${c.imgDesktop}', this)">
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

    // 2. MALDIVES EXCLUSIVE: Append "Coming Soon" Card
    if (isMaldives) {
        // We use a random image from the other products as a blurred background
        html += `
        <div class="product-card coming-soon-card">
            <div class="card-img-container">
                 <div class="cs-overlay">
                    <h3>COMING SOON</h3>
                    <p>Individual Pieces</p>
                 </div>
                 <img src="img/longline-modest-active-top-black-mobile.webp" class="card-img"> 
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

// --- COLOR SELECTION LOGIC ---
function selectColor(productId, colorName, mobilePath, desktopPath, element) {
    const card = document.getElementById(`product-${productId}`);
    
    // 1. Update data attribute
    card.setAttribute('data-selected-color', colorName);
    
    // 2. Visual update: active ring
    const circles = card.querySelectorAll('.color-circle');
    circles.forEach(c => c.classList.remove('active'));
    element.classList.add('active');

   // 3. IMAGE UPDATE WITH SIMPLE FADE
    const mobileImg = card.querySelector(`.main-img-${productId}`);
    const desktopSource = card.querySelector(`.source-${productId}`);

    // A. Dim the image immediately to show interaction
    mobileImg.style.opacity = "0.5";

    // B. Preload the new image in background
    const loader = new Image();
    loader.src = mobilePath;

    loader.onload = () => {
        // C. Swap sources once ready
        desktopSource.srcset = desktopPath;
        mobileImg.src = mobilePath;

        // D. Fade In (Restore opacity)
        mobileImg.style.opacity = "1";
    };
}

// --- ADD TO CART ---
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const card = document.getElementById(`product-${productId}`);

    // Find the specific button that was clicked to start animation from there
    const clickedBtn = card.querySelector('.btn-add');
    
    // Get Size (or "-" if hidden)
    const sizeInput = document.getElementById(`size-${productId}`);
    const size = sizeInput ? sizeInput.value : "-";
    
    const color = card.getAttribute('data-selected-color');
    
    // NEW: Get the correct price for the current region
    const finalPrice = getPrice(product);
    
    // Unique ID includes currency now to prevent mixing currencies if they travel (edge case)
    const variantId = `${product.id}-${size}-${color}-${userRegion.code}`;

    const existing = cart.find(item => item.variantId === variantId);
    let newQty = 1;

    if (existing) {
        existing.qty++;
        newQty = existing.qty;
    } else {
        cart.push({
            variantId: variantId,
            id: product.id,
            name: product.name,
            price: finalPrice, // Save the specific regional price
            currency: userRegion.code, // Save the currency code
            symbol: userRegion.symbol, // Save the symbol
            size: size,
            color: color,
            qty: 1
        });
    }

    saveCart();
    // --- NEW ANIMATION LOGIC ---
    if (isFirstCartClick) {
        // Run the big flying animation
        runFlyingAnimation(clickedBtn);
        // Set flag to false so it doesn't happen again
        isFirstCartClick = false;
    } else {
        // Run the existing subtle bounce animation
        triggerBounceAnimation(); 
    } 
    // --- 2. BUTTON FEEDBACK (New Elegant Logic) ---
    const originalText = `Add to Cart <i class="fa-solid fa-plus"></i>`;
    
    // Change button style to "Success" look
    clickedBtn.innerHTML = `Added! ( ${newQty} ) <i class="fa-solid fa-check"></i>`;
    clickedBtn.style.background = "#333"; // Or your accent color
    clickedBtn.style.color = "#fff";

    // Revert back after 1.5 seconds
    // We use a property on the element to clear previous timers if they click fast
    if (clickedBtn.feedbackTimeout) clearTimeout(clickedBtn.feedbackTimeout);
    
    clickedBtn.feedbackTimeout = setTimeout(() => {
        clickedBtn.innerHTML = originalText;
        clickedBtn.style.background = ""; // Revert to CSS default
        clickedBtn.style.color = "";
    }, 1500);
}

// --- NEW FLYING ANIMATION FUNCTION ---
function runFlyingAnimation(startBtn) {
    // 1. Get coordinates of the starting button
    const startRect = startBtn.getBoundingClientRect();
    // Calculate center of button
    const startX = startRect.left + (startRect.width / 2);
    const startY = startRect.top + (startRect.height / 2);

    // 2. Get coordinates of the destination (the cart icon in navbar)
    const cartIcon = document.querySelector('.cart-icon i');
    const endRect = cartIcon.getBoundingClientRect();
    // Calculate center of cart icon
    const endX = endRect.left + (endRect.width / 2);
    const endY = endRect.top + (endRect.height / 2);

    // 3. Create the particle element
    const particle = document.createElement('div');
    particle.classList.add('flying-particle');
    document.body.appendChild(particle);

    // 4. Set initial position (centered on the start button)
    // We subtract half the particle width/height (12px) to center it perfectly
    particle.style.left = `${startX - 12}px`;
    particle.style.top = `${startY - 12}px`;

    // 5. Calculate distances for CSS variables
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    // Pass these distances to CSS so the keyframes know where to go
    particle.style.setProperty('--end-x', `${deltaX}px`);
    particle.style.setProperty('--end-y', `${deltaY}px`);

    // 6. Cleanup: Remove particle when animation ends
    particle.addEventListener('animationend', () => {
        particle.remove();
        // Optional: Trigger the navbar bounce right as the particle lands
        triggerBounceAnimation();
    });
}


// --- ANIMATION ---
function triggerBounceAnimation() {
    const cartIconBigger = document.querySelector('.cart-icon i'); 
    cartIconBigger.style.animation = 'none';
    cartIconBigger.offsetHeight; 
    cartIconBigger.style.animation = null; 
    cartIconBigger.style.animation = 'bounce-add 0.8s ease';
}

// --- STANDARD CART FUNCTIONS ---
function removeFromCart(variantId) {
    cart = cart.filter(item => item.variantId !== variantId);
    saveCart();
}

function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartUI();
}

// Helper functions for the sidebar controls
function increaseQty(variantId) {
    const item = cart.find(i => i.variantId === variantId);
    if (item) {
        item.qty++;
        saveCart();
    }
}

function decreaseQty(variantId) {
    const item = cart.find(i => i.variantId === variantId);
    if (item) {
        item.qty--;
        if (item.qty <= 0) {
            removeFromCart(variantId); // Remove if 0
        } else {
            saveCart();
        }
    }
}

function updateCartUI() {
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
        totalEl.innerText = `${userRegion.symbol} 0.00`; //dynamic symbol
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
                        ${item.size !== 'One Size' ? `Size: <b>${item.size}</b> | ` : ''} 
                        Color: <b>${item.color}</b><br>
                        
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
                        <button onclick="decreaseQty('${item.variantId}')" style="padding:2px 8px; cursor: pointer; font-size: 1rem; border:1px solid #ddd; background:#fff; border-radius:4px;">-</button>
                        <span>${item.qty}</span>
                        <button onclick="increaseQty('${item.variantId}')" style="padding:2px 8px; cursor: pointer; font-size: 1rem; border:1px solid #ddd; background:#fff; border-radius:4px;">+</button>
                    </div>
                </div>
                <div class="item-right">
                <div style="font-weight:bold;">${item.symbol} ${(item.price * item.qty).toFixed(2)}</div>
                <button class="remove-btn" onclick="removeFromCart('${item.variantId}')">Remove</button>
            </div>
            </li>
        `;
    }).join("");

    totalEl.innerText = `${userRegion.symbol} ${total.toFixed(2)}`;
}

function toggleCart(show) {
    const sidebar = document.getElementById("cart-sidebar");
    const overlay = document.getElementById("cart-overlay");
    if (show) { sidebar.classList.add("open"); overlay.style.display = "block"; } 
    else { sidebar.classList.remove("open"); overlay.style.display = "none"; }
}

// --- UPDATED MODAL LOGIC (Click Outside to Close) ---
function toggleSizeModal(show) {
    const modal = document.getElementById("size-modal");
    modal.style.display = show ? "flex" : "none";
}

// Global Event Listener for clicking outside the modal box
window.onclick = function(event) {
    const modal = document.getElementById("size-modal");
    if (event.target === modal) {
        toggleSizeModal(false);
    }
}

document.getElementById("checkout-btn").addEventListener("click", () => {
    if (cart.length === 0) return alert("Add items first!");
    
    let msg = `Hello! I'd like to place an order via InnerAthlete (${userRegion.code}):\n\n`;
    let total = 0;
    
    cart.forEach(item => {
        const sub = item.price * item.qty;
        total += sub;
        msg += `▪ ${item.name} (${item.size}/${item.color})\n   ${item.symbol}${item.price} x ${item.qty} = ${item.symbol}${sub.toFixed(2)}\n`;
    });

    msg += `\nTotal: ${userRegion.symbol} ${total.toFixed(2)}`;
    
    window.open(`https://api.whatsapp.com/send?phone=${activePhoneNumber}&text=${encodeURIComponent(msg)}`, '_blank');
});

// --- SCROLL ANIMATIONS ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Initial Render of products (from your existing code)
    renderProducts();
    updateCartUI();

    // 2. Setup Scroll Observer
    const observerOptions = {
        threshold: 0.15, // Trigger when 15% of the element is visible
        rootMargin: "0px 0px -50px 0px" // Offset slightly to trigger before bottom
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
            } else {
                // Only remove the class (reset) if the element is BELOW the viewport.
                // This means we scrolled UP and it exited via the bottom.
                // So next time we scroll down, it will animate again.
                if (entry.boundingClientRect.top > 0) {
                    entry.target.classList.remove("active");
                }
                // If entry.boundingClientRect.top < 0, it means the element is ABOVE 
                // the viewport (we scrolled past it down). We leave the class 
                // so it stays visible if we scroll back up.
            }
        });
    }, observerOptions);

    // Target elements
    const elementsToAnimate = document.querySelectorAll('.scroll-reveal, .fade-in-up, .fade-in-left');
    elementsToAnimate.forEach(el => observer.observe(el));
});

// --- MANUAL REGION CHANGE ---
function manualChangeRegion(selectedCountry) {
    console.log("Manual override to:", selectedCountry);
    applyRegionSettings(selectedCountry);
    // Optional: Scroll to top to see the flag change or pricing update
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

//Change entire cart based on region change
function refreshCartForNewRegion() {
    let itemsRemoved = false;

    // 1. Map through cart and update prices
    cart = cart.map(item => {
        // Find the original product data
        const product = products.find(p => p.id === item.id);
        
        // MALDIVES CHECK: If switching TO Maldives, mark restricted items for removal
        if (userRegion.country === 'MV' && (item.id === 1 || item.id === 2)) {
            itemsRemoved = true;
            return null; // Will filter this out later
        }

        // Update Price & Symbol
        const newPrice = getPrice(product);
        
        // Update Variant ID (Because it contains the currency code)
        // Format: ID-SIZE-COLOR-CURRENCY
        const newVariantId = `${item.id}-${item.size}-${item.color}-${userRegion.code}`;

        return {
            ...item,
            price: newPrice,
            symbol: userRegion.symbol,
            currency: userRegion.code,
            variantId: newVariantId
        };
    }).filter(item => item !== null); // Remove the nulls (restricted items)

    // 2. Alert user if we removed items
    if (itemsRemoved) {
        alert("Note: Some items in your cart are not available in the Maldives region and have been removed.");
    }

    // 3. Save and Render
    saveCart();
    updateCartUI();
}

// --- TYPEWRITER EFFECT ---
document.addEventListener('DOMContentLoaded', () => {
    const textElement = document.getElementById("typewriter-text");
    
    // The phrases to cycle through
    const phrases = [
        "Premium Modest Activewear", 
        "Engineered for Motion", 
        "Designed for Confidence",
        "Uncompromising Quality"
    ];
    
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function typeEffect() {
        const currentPhrase = phrases[phraseIndex];

        // 1. Determine Text Content based on mode
        if (isDeleting) {
            textElement.textContent = currentPhrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            textElement.textContent = currentPhrase.substring(0, charIndex + 1);
            charIndex++;
        }

        // 2. Determine Typing Speed
        let typeSpeed = isDeleting ? 40 : 90; // Deleting is faster than typing

        // 3. Handle Transitions
        if (!isDeleting && charIndex === currentPhrase.length) {
            // Phrase complete: Pause for 2 seconds before deleting
            typeSpeed = 2000; 
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            // Deletion complete: Pause briefly, then move to next phrase
            isDeleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length; // Loop back to 0
            typeSpeed = 500; 
        }

        // 4. Loop
        setTimeout(typeEffect, typeSpeed);
    }

    // Start the loop
    typeEffect();
});

// --- CHRISTMAS SNOW EFFECT ---
function createSnowflake() {
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    
    // 1. Random Size (Much smaller: 2px to 5px)
    const size = Math.random() * 3 + 2; 
    snowflake.style.width = `${size}px`;
    snowflake.style.height = `${size}px`;
    
    // 2. Random Horizontal Position
    snowflake.style.left = Math.random() * 100 + 'vw';
    
    // 3. Random Opacity (Very subtle: 0.1 to 0.5)
    snowflake.style.opacity = Math.random() * 0.4 + 0.1;

    // 4. Random Fall Duration (Slower: 10s to 20s)
    const duration = Math.random() * 10 + 10;
    
    // 5. Animation
    snowflake.animate([
        { transform: 'translateY(0px)' }, 
        { transform: `translateY(100vh)` }
    ], {
        duration: duration * 1000,
        easing: 'linear',
        fill: 'forwards'
    });

    document.body.appendChild(snowflake);

    // Clean up
    setTimeout(() => { snowflake.remove(); }, duration * 1000);
}

// Start the snow
setInterval(createSnowflake, 200); // Less frequent (every 200ms) for a cleaner look