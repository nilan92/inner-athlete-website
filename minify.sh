#!/bin/bash

# Minify CSS
echo "Minifying styles.css..."
npx minify styles.css > styles.min.css

# Minify JS
echo "Minifying script.js..."
npx terser script.js -o script.min.js

echo "Minification complete."