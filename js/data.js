// Product catalog lives in content/products.json (edited via the /admin CMS,
// or by hand). Fetched at runtime so a content edit needs no rebuild - only
// the JSON-LD blocks in index.html need the build-time sync in
// content/sync_content.py to pick up a price change for SEO.
export let products = [];

export async function loadProducts() {
    const res = await fetch('content/products.json');
    const data = await res.json();
    products = data.products;
    return products;
}
