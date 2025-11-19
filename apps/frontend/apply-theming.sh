#!/bin/bash
# Apply theming to all Astro pages

# Color mappings
declare -A replacements=(
  # Backgrounds
  ["background: white"]="background: var(--bg-elevated)"
  ["background: #FFFFFF"]="background: var(--bg-elevated)"
  ["background: #ffffff"]="background: var(--bg-elevated)"
  ["background: #fff"]="background: var(--bg-elevated)"
  ["background: #F9FAFB"]="background: var(--bg-secondary)"
  ["background: #f9f9f9"]="background: var(--bg-secondary)"
  ["background: #F3F4F6"]="background: var(--bg-tertiary)"
  ["background: #f0f0f0"]="background: var(--bg-tertiary)"
  ["background: #f6f6ef"]="background: var(--bg-secondary)"

  # Text colors
  ["color: #000000"]="color: var(--text-primary)"
  ["color: #000"]="color: var(--text-primary)"
  ["color: #111827"]="color: var(--text-primary)"
  ["color: #4B5563"]="color: var(--text-secondary)"
  ["color: #666"]="color: var(--text-secondary)"
  ["color: #6B7280"]="color: var(--text-tertiary)"
  ["color: #999"]="color: var(--text-tertiary)"
  ["color: #9CA3AF"]="color: var(--text-disabled)"
  ["color: #333"]="color: var(--text-secondary)"
  ["color: #333333"]="color: var(--text-secondary)"

  # Borders
  ["border: 1px solid #DDDDDD"]="border: 1px solid var(--border-primary)"
  ["border: 1px solid #ddd"]="border: 1px solid var(--border-primary)"
  ["border: 1px solid #E5E7EB"]="border: 1px solid var(--border-primary)"
  ["border: 1px solid #e0e0e0"]="border: 1px solid var(--border-primary)"
  ["border-bottom: 1px solid #f0f0f0"]="border-bottom: 1px solid var(--divider)"
  ["border-left: 1px solid #f0f0f0"]="border-left: 1px solid var(--divider)"
  ["border-top: 1px solid #f0f0f0"]="border-top: 1px solid var(--divider)"
)

# Find all .astro files
files=$(find src/pages -name "*.astro")

for file in $files; do
  echo "Processing: $file"

  # Create backup
  cp "$file" "$file.bak"

  # Apply replacements
  for search in "${!replacements[@]}"; do
    replace="${replacements[$search]}"
    sed -i '' "s|$search|$replace|g" "$file"
  done
done

echo "Theming applied! Backups saved as .bak files"
echo "Review changes and delete .bak files if satisfied"
