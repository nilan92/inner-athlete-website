import { setUserRegion, getUserRegion, getActivePhone, flagMap, saveRegionToStorage, clearRegionStorage, loadRegionFromStorage } from './state.js';
import { renderProducts, updateCartUI, toggleCart, toggleSizeModal, selectColor, initTypewriter, initScrollObserver, initSnow, updateFAQ, initFAQAccordion } from './ui.js';
import { addToCart, removeFromCart, increaseQty, decreaseQty, refreshCartPrices, getCart } from './cart.js';
import { loadProducts } from './data.js';

// Banner copy lives in content/banner.json (editable via /admin). Falls back
// to the static HTML text if the fetch fails, so a network hiccup never
// leaves the bar blank.
let bannerCopy = null;
async function loadBanner() {
    try {
        const res = await fetch('content/banner.json');
        bannerCopy = await res.json();
    } catch (e) {
        console.warn("Banner content fetch failed, using default markup.");
    }
}

// Exports
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.increaseQty = increaseQty;
window.decreaseQty = decreaseQty;
window.toggleCart = toggleCart;
window.toggleSizeModal = toggleSizeModal;
window.selectColor = selectColor;

async function initApp() {

    // Content (products + banner copy) is fetched, not bundled, so the CMS
    // can publish an edit without a rebuild. Runs in parallel with region
    // detection below since neither depends on the other.
    const contentReady = Promise.all([loadProducts(), loadBanner()]);

    // Christmas Effects: Snow and Santa Hat (December + Jan 1-3)
    const now = new Date();
    const isChristmas = (now.getMonth() === 11) || (now.getMonth() === 0 && now.getDate() <= 3);
    if (isChristmas) {
        // Enable snow effect
        initSnow();
        // Add Santa hat to logo
        const logo = document.querySelector('.logo');
        if (logo) logo.classList.add('christmas-hat');
    }
    
    // 1. CHECK IF USER "OPTED IN" TO SAVING
    // We strictly check the flag. If false/null, we ignore any saved region data.
    const shouldRemember = localStorage.getItem("region_preference_saved") === "true";
    let locationSet = false;

    // Sync Checkbox UI
    const saveCheckbox = document.getElementById("region-save-check");
    if(saveCheckbox) saveCheckbox.checked = shouldRemember;

    if (shouldRemember) {
        if (loadRegionFromStorage()) {
            console.log("💾 Restore: Used saved location preference.");
            locationSet = true;
            refreshCartPrices();
        }
    }

    // 2. IF NOT SAVED, RUN AUTO-DETECT (Default fallback)
    if (!locationSet) {
        // Clear any stale storage just in case
        clearRegionStorage();

        // DEV OVERRIDE
        const urlParams = new URLSearchParams(window.location.search);
        const forceLoc = urlParams.get('loc');

        if (forceLoc) {
            setUserRegion(forceLoc);
            refreshCartPrices();
        } else {
            // REAL DETECTION
            try {
                let countryCode = 'US'; // Fallback default
                let detected = false;

                // Try Cloudflare Trace
                try {
                    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                    const url = isLocal ? 'https://www.cloudflare.com/cdn-cgi/trace' : '/cdn-cgi/trace';
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.text();
                        const lines = data.split('\n');
                        const locLine = lines.find(line => line.startsWith('loc='));
                        if (locLine) {
                            countryCode = locLine.split('=')[1];
                            detected = true;
                        }
                    }
                } catch (e) { console.warn("Trace failed"); }

                // Try IPAPI Trace
                if (!detected) {
                    try {
                        const response = await fetch('https://ipapi.co/json/');
                        if (response.ok) {
                            const data = await response.json();
                            if (data.country_code) countryCode = data.country_code;
                        }
                    } catch (e) { console.warn("IPAPI failed"); }
                }

                console.log("📍 Auto-Detect Result:", countryCode);
                setUserRegion(countryCode);
                refreshCartPrices();

            } catch (e) { 
                console.warn("Detection completely failed, using default US");
            }
        }
    }

    // 3. START UI & LISTENERS
    await contentReady;
    updateUIComponents();
    initStickyPromo();
    initTypewriter();
    initScrollObserver();
    initFAQAccordion();

    // Checkbox Listener
    if(saveCheckbox) {
        saveCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                saveRegionToStorage();
            } else {
                clearRegionStorage();
            }
        });
    }

    // Checkout Button
    const btn = document.getElementById("checkout-btn");
    if(btn) {
        btn.addEventListener("click", () => {
            const cart = getCart();
            const region = getUserRegion();
            const phone = getActivePhone();
            if (cart.length === 0) return alert("Add items first!");
            
            let msg = `Hello! I'd like to place an order via InnerAthlete (${region.code}):\n\n`;
            let total = 0;
            cart.forEach(i => {
                const sub = i.price * i.qty; total += sub;
                msg += `▪ ${i.name} (${i.size}/${i.color})\n   ${i.symbol}${i.price} x ${i.qty} = ${i.symbol}${sub.toFixed(2)}\n`;
            });
            msg += `\nTotal: ${region.symbol} ${total.toFixed(2)}`;
            window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
        });
    }

    window.onclick = function(event) {
        const modal = document.getElementById("size-modal");
        if (event.target === modal) toggleSizeModal(false);
    };
}

// The promo bar is sticky, so the nav has to sit below whatever height it
// actually is. Observing it covers text wrapping, region copy swaps, resizes
// and dismissal without hardcoding a pixel offset anywhere.
function initStickyPromo() {
    const bar = document.getElementById("promo-bar");
    if (!bar) return;

    const syncHeight = () => document.documentElement.style
        .setProperty('--promo-h', bar.offsetHeight + 'px');

    syncHeight();
    new ResizeObserver(syncHeight).observe(bar);
}

// Only adds the class: the collapse is CSS, and the ResizeObserver above
// drives --promo-h down with it, so the nav glides up in lockstep.
window.dismissPromo = function() {
    const bar = document.getElementById("promo-bar");
    if (bar) bar.classList.add('dismissed');
};

function updateUIComponents() {
    const region = getUserRegion();
    const cart = getCart(); 

    const flagEl = document.getElementById("nav-flag");
    if(flagEl) flagEl.innerText = flagMap[region.country] || "🌍";
    
    const promo = document.getElementById("promo-text");
    if(promo && bannerCopy) {
        promo.innerHTML = bannerCopy[region.country] || bannerCopy.default;
    }
    
    const selector = document.getElementById("region-select");
    if(selector) selector.value = (region.country === 'LK' || region.country === 'MV') ? region.country : 'US';

    const phoneLink = document.getElementById("footer-phone");
    if (phoneLink) {
        const activePhone = getActivePhone();
        phoneLink.innerText = region.country === 'MV' ? "+960 971 8918" : "+94 77 188 9532";
        phoneLink.href = `tel:${activePhone}`;
    }

    renderProducts();
    updateCartUI(cart);
    updateFAQ(region);
}

// Manual Override Logic
window.manualChangeRegion = function(code) {
    setUserRegion(code);
    refreshCartPrices();
    updateUIComponents();
    
    // Check if the user wants this new setting saved
    const saveCheckbox = document.getElementById("region-save-check");
    if (saveCheckbox && saveCheckbox.checked) {
        saveRegionToStorage();
    } else {
        clearRegionStorage(); // If unchecked, keep it temporary
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}

document.addEventListener("DOMContentLoaded", initApp);