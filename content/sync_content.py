"""
Pushes prices from content/products.json into every embedded JSON-LD block
in index.html that describes one of those products, so a CMS-driven price
edit doesn't leave Google's copy of the price stale.

index.html carries product pricing three separate times (two standalone
Product blocks and one @graph block with return/shipping info) - a legacy
of iterative SEO work, not something this script tries to clean up. It
walks each <script type="application/ld+json"> block looking for any
dict with "name" + "offers", matches it to a product by name, and updates
each offer's price by priceCurrency. Everything else in the block (sku,
return policy, shipping regions) is left untouched.

A product with no existing JSON-LD entry is left alone - adding one is a
one-time manual edit, not something worth auto-generating return-policy
and shipping schema for.
"""
import json
import re
from pathlib import Path

INDEX_FILE = Path(__file__).parent.parent / "index.html"
PRODUCTS_FILE = Path(__file__).parent / "products.json"

CURRENCY_FIELD = {"USD": "priceUSD", "LKR": "priceLKR", "MVR": "priceMVR"}


def format_price(currency, value):
    return f"{value:.2f}" if currency == "USD" else str(int(value))


def patch_offers(node, by_name):
    """Recursively find {"name", "offers": [...]} dicts and patch prices in
    place. Returns True if any price value actually changed, so the caller
    can leave already-correct blocks byte-for-byte untouched."""
    changed = False
    if isinstance(node, dict):
        if "offers" in node and node.get("name") in by_name:
            product = by_name[node["name"]]
            for offer in node["offers"]:
                field = CURRENCY_FIELD.get(offer.get("priceCurrency"))
                if field and field in product:
                    new_price = format_price(offer["priceCurrency"], product[field])
                    if offer.get("price") != new_price:
                        offer["price"] = new_price
                        changed = True
        for value in node.values():
            changed = patch_offers(value, by_name) or changed
    elif isinstance(node, list):
        for item in node:
            changed = patch_offers(item, by_name) or changed
    return changed


def main():
    products = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))["products"]
    by_name = {p["name"]: p for p in products}

    html = INDEX_FILE.read_text(encoding="utf-8")

    def replace_block(match):
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            return match.group(0)
        # Only reformat blocks that actually needed a price change - leaves
        # every already-correct block byte-for-byte untouched.
        if not patch_offers(data, by_name):
            return match.group(0)
        return f'<script type="application/ld+json">\n{json.dumps(data, indent=2)}\n</script>'

    updated = re.sub(
        r'<script type="application/ld\+json">(.*?)</script>',
        replace_block,
        html,
        flags=re.S,
    )

    if updated != html:
        INDEX_FILE.write_text(updated, encoding="utf-8")
        print("--- Synced product prices into index.html JSON-LD blocks ---")
    else:
        print("--- JSON-LD prices already in sync ---")


if __name__ == "__main__":
    main()
