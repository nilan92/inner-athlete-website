#!/bin/bash

# Sync product prices from content/products.json into index.html's JSON-LD
echo "Syncing product content into index.html..."
python3 content/sync_content.py

# Minify CSS
echo "Minifying styles.css..."
npx minify styles.css > styles.min.css

# Bundle and minify JS files
echo "Bundling and minifying JS files..."
npx rollup js/main.js --format es --file js/bundle.js --sourcemap
npx terser js/bundle.js -o js/bundle.min.js --source-map "content='js/bundle.js.map',url='bundle.min.js.map'"

# Clean up intermediate bundle file
rm js/bundle.js

# Update cache busting in HTML
python3 cache_buster.py

echo "Minification and cache busting complete. Ready for production."