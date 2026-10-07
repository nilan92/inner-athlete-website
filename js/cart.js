import { products } from './data.js';
import { getUserRegion } from './state.js';
import { updateCartUI, triggerBounceAnimation, runFlyingAnimation } from './ui.js';

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let isFirstCartClick = true;

export function getCart() { return cart; }

export function addToCart(productId, options = {}) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const card = document.getElementById(`product-${productId}`);
    const clickedBtn = options.sourceBtn || (card ? card.querySelector('.btn-add') : null);
    
    let size = options.size;
    if (size === undefined) {
        const sizeInput = document.getElementById(`size-${productId}`);
        size = sizeInput ? sizeInput.value : "-";
    }
    
    let color = options.color;
    if (!color && card) {
        color = card.getAttribute('data-selected-color');
    }
    if (!color && product.colors && product.colors.length > 0) {
        color = product.colors[0].name;
    }
    
    const qty = Math.max(1, parseInt(options.qty || 1, 10));
    const region = getUserRegion();
    
    let finalPrice = product.priceUSD;
    if (region.code === 'LKR') finalPrice = product.priceLKR;
    if (region.code === 'MVR') finalPrice = product.priceMVR;
    
    const variantId = `${product.id}-${size}-${color}-${region.code}`;
    const existing = cart.find(item => item.variantId === variantId);

    if (existing) existing.qty += qty;
    else cart.push({
        variantId, id: product.id, name: product.name, price: finalPrice,
        currency: region.code, symbol: region.symbol, size, color, qty
    });

    saveCart();

    if (clickedBtn) {
        if (isFirstCartClick) { runFlyingAnimation(clickedBtn); isFirstCartClick = false; } 
        else { triggerBounceAnimation(); } 

        const originalText = clickedBtn.innerHTML;
        clickedBtn.innerHTML = `Added! <i class="fa-solid fa-check"></i>`;
        const originalBg = clickedBtn.style.background;
        const originalColor = clickedBtn.style.color;
        clickedBtn.style.background = "#1da851"; 
        clickedBtn.style.color = "#fff";
        if (clickedBtn.feedbackTimeout) clearTimeout(clickedBtn.feedbackTimeout);
        clickedBtn.feedbackTimeout = setTimeout(() => {
            clickedBtn.innerHTML = originalText;
            clickedBtn.style.background = originalBg; 
            clickedBtn.style.color = originalColor;
        }, 1500);
    } else {
        triggerBounceAnimation();
    }
    
    // PASS CART DATA HERE
    updateCartUI(cart);
}

export function removeFromCart(variantId) {
    cart = cart.filter(item => item.variantId !== variantId);
    saveCart();
    updateCartUI(cart); // PASS DATA
}

export function increaseQty(variantId) {
    const item = cart.find(i => i.variantId === variantId);
    if (item) { item.qty++; saveCart(); updateCartUI(cart); } // PASS DATA
}

export function decreaseQty(variantId) {
    const item = cart.find(i => i.variantId === variantId);
    if (item) {
        item.qty--;
        if (item.qty <= 0) removeFromCart(variantId);
        else { saveCart(); updateCartUI(cart); } // PASS DATA
    }
}

export function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

export function refreshCartPrices() {
    const region = getUserRegion();
    let itemsRemoved = false;

    cart = cart.map(item => {
        const product = products.find(p => p.id === item.id);
        if (region.country === 'MV' && (item.id === 1 || item.id === 2)) {
            itemsRemoved = true; return null;
        }
        let newPrice = product.priceUSD;
        if (region.code === 'LKR') newPrice = product.priceLKR;
        if (region.code === 'MVR') newPrice = product.priceMVR;
        
        return {
            ...item, price: newPrice, symbol: region.symbol, currency: region.code,
            variantId: `${item.id}-${item.size}-${item.color}-${region.code}`
        };
    }).filter(item => item !== null);

    if (itemsRemoved) alert("Note: Some items were removed as they are not available in Maldives.");
    saveCart();
    updateCartUI(cart); // PASS DATA
}