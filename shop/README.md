# 🛍️ innerAthlete — Shop (Web App)

## Overview
This is a custom-built, serverless e-commerce interface for **innerAthlete**. Unlike standard static pages, this module functions as a lightweight Web Application with state management, geolocation-based personalization, and dynamic currency conversion.

**Live Demo:** [innerathleteactive.com/shop/](https://innerathleteactive.com/shop/)

## 🛠️ Technical Stack
* **Core:** HTML5, CSS3 (Variables, Flexbox/Grid), Vanilla JavaScript (ES6+).
* **State Management:** `localStorage` + Runtime JS Objects.
* **External APIs:** Cloudflare Trace (Geolocation), WhatsApp API (Checkout).
* **Architecture:** Client-side SPA (Single Page Application) behavior without heavy frameworks.

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

---

## 📂 Project Structure

shop/
├── index.html       # Main application markup
├── styles.css       # Scoped styles & animations
├── script.js        # Core logic (Geolocation, Cart, UI)
└── img/             # Product assets (WebP optimized)

## 🚀 How to Run Locally
Clone the repository.

Navigate to the shop folder.

Open index.html in a browser.

Note: Geolocation features require a live environment or a local server to avoid CORS issues with the trace API.

## 👨‍💻 Developer Notes
Built by Flomo Notio. This module demonstrates how to implement complex e-commerce logic (Region-based inventory, Dynamic Pricing) using only lightweight, native web technologies for maximum performance and zero backend maintenance costs.


### Why this is good for you:
1.  **"Smart" Words:** Terms like *State Management*, *Serverless*, *Runtime JS*, and *CORS* show you understand concepts beyond just "making a website."
2.  **Problem/Solution:** It explains *why* you used WhatsApp (lean startup model) and *how* you solved the Maldives inventory issue.
3.  **Separation:** By putting this in `shop/`, you keep your root folder clean while giving tech-savvy visitors exactly what they want to read when they browse your code.