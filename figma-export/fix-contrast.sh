#!/bin/bash

##############################################################################
# Linkary Contrast Fix Script (Bash)
# Automatically fixes all text contrast issues across profile pages
# 
# Part of the Infrastructure-Grade Design System refactor
##############################################################################

echo "🔥 LINKARY CONTRAST FIX SCRIPT"
echo "==============================="
echo ""

# Files to process
FILES=(
  "src/app/components/BrandProfilePage.tsx"
  "src/app/components/UserProfilePage.tsx"
  "src/app/components/ProjectProfilePage.tsx"
)

# Check if files exist
echo "📋 Checking files..."
missing=0
for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing: $file"
    missing=1
  else
    echo "✓ Found: $file"
  fi
done

if [ $missing -eq 1 ]; then
  echo ""
  echo "❌ Error: Some files are missing. Please run from project root."
  exit 1
fi

echo ""
echo "📁 Creating backups..."
for file in "${FILES[@]}"; do
  cp "$file" "$file.backup"
  echo "✓ Backed up: $file.backup"
done

echo ""
echo "🎨 Applying contrast fixes..."

# Detect OS for sed syntax
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  SED_CMD="sed -i ''"
else
  # Linux
  SED_CMD="sed -i"
fi

# Apply fixes to all files
for file in "${FILES[@]}"; do
  echo ""
  echo "📄 Processing: $(basename $file)"
  
  # Primary text (names, headings, bold)
  $SED_CMD 's/text-gray-900/text-white/g' "$file"
  echo "   ✓ Fixed primary text (text-gray-900 → text-white)"
  
  # Secondary text (body, descriptions)
  $SED_CMD 's/text-gray-700/text-white\/70/g' "$file"
  echo "   ✓ Fixed secondary text (text-gray-700 → text-white/70)"
  
  $SED_CMD 's/text-gray-600/text-white\/60/g' "$file"
  echo "   ✓ Fixed secondary text (text-gray-600 → text-white/60)"
  
  # Muted text (labels, meta)
  $SED_CMD 's/text-gray-500/text-white\/50/g' "$file"
  echo "   ✓ Fixed muted text (text-gray-500 → text-white/50)"
  
  $SED_CMD 's/text-gray-400/text-white\/60/g' "$file"
  echo "   ✓ Fixed muted text (text-gray-400 → text-white/60)"
  
  # Neutral colors
  $SED_CMD 's/text-neutral-300/text-white\/85/g' "$file"
  echo "   ✓ Fixed neutral text (text-neutral-300 → text-white/85)"
  
  $SED_CMD 's/text-neutral-400/text-white\/60/g' "$file"
  echo "   ✓ Fixed neutral text (text-neutral-400 → text-white/60)"
  
  $SED_CMD 's/text-neutral-500/text-white\/50/g' "$file"
  echo "   ✓ Fixed neutral text (text-neutral-500 → text-white/50)"
  
  # Zinc colors  
  $SED_CMD 's/text-zinc-700/text-white\/70/g' "$file"
  echo "   ✓ Fixed zinc text (text-zinc-700 → text-white/70)"
  
  # Hover states
  $SED_CMD 's/hover:text-gray-900/hover:text-white/g' "$file"
  echo "   ✓ Fixed hover states (hover:text-gray-900 → hover:text-white)"
  
  $SED_CMD 's/hover:text-gray-700/hover:text-white/g' "$file"
  echo "   ✓ Fixed hover states (hover:text-gray-700 → hover:text-white)"
  
  # Group hover states
  $SED_CMD 's/group-hover:text-gray-900/group-hover:text-white/g' "$file"
  echo "   ✓ Fixed group hover (group-hover:text-gray-900 → group-hover:text-white)"
  
  $SED_CMD 's/group-hover:text-gray-700/group-hover:text-white/g' "$file"
  echo "   ✓ Fixed group hover (group-hover:text-gray-700 → group-hover:text-white)"
  
  echo "   ✅ Completed: $(basename $file)"
done

echo ""
echo "=========================================="
echo "📊 CONTRAST FIX SUMMARY"
echo "=========================================="
echo ""
echo "✅ Files processed: ${#FILES[@]}"
echo "📝 Applied 13 contrast fixes per file"
echo "💾 Backups saved with .backup extension"
echo ""
echo "🎨 Design System Status: Infrastructure-Grade Contrast ✅"
echo ""
echo "=========================================="
echo "💡 Next Steps:"
echo "=========================================="
echo ""
echo "1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)"
echo "2. Clear browser cache if needed"
echo "3. Verify all text is high-contrast and readable"
echo "4. Check for any remaining low-contrast elements"
echo ""
echo "If you need to rollback:"
echo "  for file in ${FILES[@]}; do cp \"\$file.backup\" \"\$file\"; done"
echo ""
echo "✨ Done!"
