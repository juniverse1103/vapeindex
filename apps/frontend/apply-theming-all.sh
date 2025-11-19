#!/bin/bash
# Apply comprehensive theming to all Astro pages

echo "Applying theming to all .astro files..."

# Find all .astro files in src/pages
files=$(find src/pages -name "*.astro" -type f)

for file in $files; do
  echo "Processing: $file"

  # Background colors
  sed -i '' 's/background: white;/background: var(--bg-elevated);/g' "$file"
  sed -i '' 's/background: #FFFFFF;/background: var(--bg-elevated);/g' "$file"
  sed -i '' 's/background: #fff;/background: var(--bg-elevated);/g' "$file"
  sed -i '' 's/background: #F9FAFB;/background: var(--bg-secondary);/g' "$file"
  sed -i '' 's/background: #f9f9f9;/background: var(--bg-secondary);/g' "$file"
  sed -i '' 's/background: #F3F4F6;/background: var(--bg-tertiary);/g' "$file"
  sed -i '' 's/background: #f0f0f0;/background: var(--bg-hover);/g' "$file"
  sed -i '' 's/background: #f6f6ef;/background: var(--bg-secondary);/g' "$file"

  # Text colors
  sed -i '' 's/color: #000000;/color: var(--text-primary);/g' "$file"
  sed -i '' 's/color: #000;/color: var(--text-primary);/g' "$file"
  sed -i '' 's/color: #111827;/color: var(--text-primary);/g' "$file"
  sed -i '' 's/color: #4B5563;/color: var(--text-secondary);/g' "$file"
  sed -i '' 's/color: #666666;/color: var(--text-secondary);/g' "$file"
  sed -i '' 's/color: #666;/color: var(--text-secondary);/g' "$file"
  sed -i '' 's/color: #6B7280;/color: var(--text-tertiary);/g' "$file"
  sed -i '' 's/color: #999999;/color: var(--text-tertiary);/g' "$file"
  sed -i '' 's/color: #999;/color: var(--text-tertiary);/g' "$file"
  sed -i '' 's/color: #9CA3AF;/color: var(--text-disabled);/g' "$file"
  sed -i '' 's/color: #333333;/color: var(--text-secondary);/g' "$file"
  sed -i '' 's/color: #333;/color: var(--text-secondary);/g' "$file"

  # Borders - more specific patterns to avoid conflicts
  sed -i '' 's/border: 1px solid var(--border);/border: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border: 1px solid #DDDDDD;/border: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border: 1px solid #ddd;/border: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border: 1px solid #E5E7EB;/border: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border: 1px solid #e0e0e0;/border: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border-bottom: 1px solid #f0f0f0;/border-bottom: 1px solid var(--divider);/g' "$file"
  sed -i '' 's/border-bottom: 1px solid var(--border);/border-bottom: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border-left: 1px solid #f0f0f0;/border-left: 1px solid var(--divider);/g' "$file"
  sed -i '' 's/border-left: 1px solid var(--border);/border-left: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border-top: 1px solid #f0f0f0;/border-top: 1px solid var(--divider);/g' "$file"
  sed -i '' 's/border-top: 1px solid var(--border);/border-top: 1px solid var(--border-primary);/g' "$file"
  sed -i '' 's/border-right: 1px solid var(--border);/border-right: 1px solid var(--border-primary);/g' "$file"
done

echo "✅ Theming applied to all .astro files!"
echo "Please review the changes and test the site."
