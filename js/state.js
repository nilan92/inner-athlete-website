// --- CONFIGURATION ---
export const PHONES = {
    DEFAULT: "+94771889532", // Sri Lanka & Rest of World
    MV: "+9609718918"        // Maldives
};

export const flagMap = {
    "LK": "🇱🇰",
    "MV": "🇲🇻",
    "US": "🇺🇸", 
    "default": "🌍"
};

// --- GLOBAL STATE ---
// CRITICAL FIX: We default to generic US. We do NOT read localStorage here anymore.
// This ensures every refresh starts "clean" unless main.js deliberately loads a save.
let userRegion = {
    code: "USD",
    symbol: "$",
    country: "US" 
};

let activePhoneNumber = PHONES.DEFAULT;

// --- GETTERS ---
export function getUserRegion() { return userRegion; }
export function getActivePhone() { return activePhoneNumber; }

// --- SETTERS ---
export function setUserRegion(countryCode) {
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
}

// --- STORAGE HELPERS (Only called if User Opts-in) ---
export function saveRegionToStorage() {
    localStorage.setItem("user_region", JSON.stringify(userRegion));
    localStorage.setItem("region_preference_saved", "true");
}

export function clearRegionStorage() {
    localStorage.removeItem("user_region");
    localStorage.removeItem("region_preference_saved");
}

export function loadRegionFromStorage() {
    // We only call this if the checkbox was checked
    const saved = localStorage.getItem("user_region");
    if (saved) {
        userRegion = JSON.parse(saved);
        // Sync phone number with the loaded region
        activePhoneNumber = (userRegion.country === 'MV') ? PHONES.MV : PHONES.DEFAULT;
        return true; 
    }
    return false;
}