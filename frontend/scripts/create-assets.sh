#!/bin/bash

# This script creates placeholder assets for the BrainGauge app
# You should replace these with proper branded assets before publishing

ASSETS_DIR="$(dirname "$0")/../assets"

# Create a simple SVG icon that can be converted to PNG
cat > "$ASSETS_DIR/icon.svg" << 'EOF'
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#1a1a2e"/>
  <circle cx="512" cy="512" r="300" fill="#6366F1" opacity="0.3"/>
  <circle cx="512" cy="512" r="200" fill="#6366F1" opacity="0.5"/>
  <circle cx="512" cy="512" r="100" fill="#6366F1"/>
  <text x="512" y="550" text-anchor="middle" fill="white" font-size="80" font-family="Arial, sans-serif" font-weight="bold">BG</text>
</svg>
EOF

echo "SVG icon created at $ASSETS_DIR/icon.svg"
echo ""
echo "To generate PNG assets, you can:"
echo "1. Use an online tool like https://cloudconvert.com/svg-to-png"
echo "2. Use ImageMagick: convert icon.svg -resize 1024x1024 icon.png"
echo "3. Use a design tool like Figma to create proper branded assets"
echo ""
echo "Required asset sizes:"
echo "  - icon.png: 1024x1024"
echo "  - splash.png: 1284x2778"
echo "  - adaptive-icon.png: 1024x1024"
echo "  - favicon.png: 48x48"
