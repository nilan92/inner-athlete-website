#!/usr/bin/env python3
"""
Generates js/data.js, the Product structured-data (JSON-LD), and the size
chart table in index.html from the CMS-editable source files in content/.

Run this before minify.sh (the GitHub Action does this automatically).
Source of truth:
  content/products/*.json   -> js/data.js + JSON-LD product schema
  content/size-chart.json   -> size guide table in index.html
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_PRODUCTS = ROOT / "content" / "products"
CONTENT_SIZE_CHART = ROOT / "content" / "size-chart.json"
DATA_JS = ROOT / "js" / "data.js"
INDEX_HTML = ROOT / "index.html"

SITE_URL = "https://www.innerathleteactive.com"

# Market code -> (currency, price field on product, schema.org availability)
MARKETS = {
    "US": {"currency": "USD", "priceField": "priceUSD"},
    "LK": {"currency": "LKR", "priceField": "priceLKR"},
    "MV": {"currency": "MVR", "priceField": "priceMVR"},
}


def load_products():
    products = []
    for f in sorted(CONTENT_PRODUCTS.glob("*.json")):
        products.append(json.loads(f.read_text(encoding="utf-8")))
    products.sort(key=lambda p: p["id"])
    return products


def js_string(value):
    return json.dumps(value)


def build_data_js(products):
    lines = ["export const products = ["]
    for i, p in enumerate(products):
        lines.append("    {")
        lines.append(f"        id: {p['id']},")
        lines.append(f"        name: {js_string(p['name'])},")
        lines.append(f"        slug: {js_string(p['slug'])},")
        lines.append(f"        sku: {js_string(p['sku'])},")
        lines.append(f"        description: {js_string(p['description'])},")
        lines.append("        // PRICES")
        lines.append(f"        priceUSD: {p['priceUSD']},")
        lines.append(f"        priceLKR: {p['priceLKR']},")
        lines.append(f"        priceMVR: {p['priceMVR']},")
        lines.append("        // OPTIONS")
        lines.append(f"        sizes: {json.dumps(p['sizes'])},")
        lines.append(f"        markets: {json.dumps(p['markets'])},")
        colors_lines = ["        colors: ["]
        for j, c in enumerate(p["colors"]):
            comma = "," if j < len(p["colors"]) - 1 else ""
            colors_lines.append(
                "            { "
                f"name: {js_string(c['name'])}, "
                f"hex: {js_string(c['hex'])}, "
                f"imgMobile: {js_string(c['imgMobile'])}, "
                f"imgDesktop: {js_string(c['imgDesktop'])} "
                "}" + comma
            )
        colors_lines.append("        ]")
        lines.extend(colors_lines)
        closing = "    }" + ("," if i < len(products) - 1 else "")
        lines.append(closing)
    lines.append("];")
    return "\n".join(lines) + "\n"


def build_product_schema(products):
    graph = []
    for p in products:
        offers = []
        for market in p["markets"]:
            cfg = MARKETS[market]
            price = p[cfg["priceField"]]
            offers.append({
                "@type": "Offer",
                "areaServed": market,
                "priceCurrency": cfg["currency"],
                "price": f"{price:.2f}" if isinstance(price, float) else str(price),
                "priceValidUntil": "2026-12-31",
                "availability": "https://schema.org/InStock",
                "hasMerchantReturnPolicy": {
                    "@type": "MerchantReturnPolicy",
                    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
                    "merchantReturnDays": 7,
                    "returnMethod": "https://schema.org/ReturnByMail"
                },
                "shippingDetails": {
                    "@type": "OfferShippingDetails",
                    "shippingDestination": {"@type": "DefinedRegion", "addressCountry": market}
                }
            })

        image = p["colors"][0]["imgDesktop"] if p["colors"] else ""
        graph.append({
            "@type": "Product",
            "name": p["name"],
            "description": p["description"],
            "image": f"{SITE_URL}/{image}",
            "sku": p["sku"],
            "brand": {"@type": "Brand", "name": "innerAthlete"},
            "offers": offers
        })

    schema = {"@context": "https://schema.org", "@graph": graph}
    return json.dumps(schema, indent=2)


def build_size_chart_rows():
    chart = json.loads(CONTENT_SIZE_CHART.read_text(encoding="utf-8"))
    rows = []
    for row in chart["rows"]:
        rows.append(
            f"                <tr><td>{row['size']}</td><td>{row['shoulder']}</td>"
            f"<td>{row['chest']}</td><td>{row['length']}</td></tr>"
        )
    return "\n".join(rows)


def main():
    products = load_products()

    DATA_JS.write_text(build_data_js(products), encoding="utf-8")
    print(f"Wrote {DATA_JS.relative_to(ROOT)} ({len(products)} products)")

    html = INDEX_HTML.read_text(encoding="utf-8")

    schema_json = build_product_schema(products)
    schema_block = (
        '<!-- AUTO-GENERATED: PRODUCT SCHEMA START (edit content/products/*.json, then run scripts/build_content.py) -->\n'
        '    <script type="application/ld+json">\n'
        f'{schema_json}\n'
        '    </script>\n'
        '    <!-- AUTO-GENERATED: PRODUCT SCHEMA END -->'
    )
    html = re.sub(
        r'<!-- AUTO-GENERATED: PRODUCT SCHEMA START.*?AUTO-GENERATED: PRODUCT SCHEMA END -->',
        lambda _: schema_block.replace("\\", "\\\\"),
        html,
        flags=re.DOTALL
    )

    size_rows = build_size_chart_rows()
    size_block = (
        '<!-- AUTO-GENERATED: SIZE CHART START (edit content/size-chart.json, then run scripts/build_content.py) -->\n'
        f'{size_rows}\n'
        '                <!-- AUTO-GENERATED: SIZE CHART END -->'
    )
    html = re.sub(
        r'<!-- AUTO-GENERATED: SIZE CHART START.*?AUTO-GENERATED: SIZE CHART END -->',
        lambda _: size_block.replace("\\", "\\\\"),
        html,
        flags=re.DOTALL
    )

    INDEX_HTML.write_text(html, encoding="utf-8")
    print(f"Updated {INDEX_HTML.relative_to(ROOT)} (product schema + size chart)")


if __name__ == "__main__":
    main()
