#!/bin/bash
# Ultra-dry design - remove ALL emojis and excess padding

echo "Applying ultra-dry design to all pages..."

# Remove emojis from page headers and titles
files=$(find src/pages -name "*.astro" -type f)

for file in $files; do
  echo "Processing: $file"

  # Remove common emojis from headers
  sed -i '' 's/🆕 New/New/g' "$file"
  sed -i '' 's/📚 Past/Past/g' "$file"
  sed -i '' 's/💬 Recent/Recent/g' "$file"
  sed -i '' 's/❓ Ask/Ask/g' "$file"
  sed -i '' 's/🎨 Show/Show/g' "$file"
  sed -i '' 's/🔥 Hot/Hot/g' "$file"
  sed -i '' 's/🔥 Trending/Trending/g' "$file"
  sed -i '' 's/💰 Price/Price/g' "$file"

  # Standardize padding in page headers
  sed -i '' 's/padding: 2rem;/padding: 1rem;/g' "$file"
  sed -i '' 's/padding: 1.5rem;/padding: 0.75rem;/g' "$file"
  sed -i '' 's/margin-bottom: 1rem;/margin-bottom: 0.5rem;/g' "$file"

  # Reduce header font sizes
  sed -i '' 's/font-size: 2rem;/font-size: 1.5rem;/g' "$file"
  sed -i '' 's/font-size: 1.5rem;/font-size: 1.25rem;/g' "$file"

  # Remove border-radius for sharper look
  sed -i '' 's/border-radius: 0.5rem;/border-radius: 0;/g' "$file"
  sed -i '' 's/border-radius: 0.375rem;/border-radius: 0;/g' "$file"
  sed -i '' 's/border-radius: 0.25rem;/border-radius: 0;/g' "$file"
done

echo "✅ Ultra-dry design applied!"
