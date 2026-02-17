# 🔥 Linkary Contrast Fix Guide

## Problem
Profile pages have terrible contrast - washed-out gray text on dark backgrounds violating WCAG standards and looking unprofessional.

## Solution
Replace ALL gray text classes with proper white/high-contrast colors.

---

## Method 1: VS Code Find & Replace (RECOMMENDED - FASTEST)

Open VS Code, press `Cmd+Shift+F` (Mac) or `Ctrl+Shift+F` (Windows) to open **Find in Files**.

### Step-by-Step:

1. **Enable Regex**: Click the `.*` button in the search box
2. **Set scope**: Click "files to include" and add: `src/app/components/*ProfilePage.tsx`
3. **Apply each find/replace below ONE AT A TIME**

### Find & Replace Patterns:

```regex
FIND:     text-gray-900
REPLACE:  text-white
FILES:    ~85 replacements across 3 files

FIND:     text-gray-700  
REPLACE:  text-white/70
FILES:    ~60 replacements

FIND:     text-gray-600
REPLACE:  text-white/60  
FILES:    ~70 replacements

FIND:     text-gray-500
REPLACE:  text-white/50
FILES:    ~15 replacements

FIND:     text-gray-400
REPLACE:  text-white/60
FILES:    ~10 replacements

FIND:     text-neutral-300
REPLACE:  text-white/85
FILES:    ~5 replacements

FIND:     text-neutral-400
REPLACE:  text-white/60
FILES:    ~3 replacements

FIND:     text-zinc-700
REPLACE:  text-white/70
FILES:    ~5 replacements

FIND:     hover:text-gray-900
REPLACE:  hover:text-white
FILES:    ~15 replacements

FIND:     hover:text-gray-700
REPLACE:  hover:text-white
FILES:    ~8 replacements

FIND:     group-hover:text-gray-900
REPLACE:  group-hover:text-white
FILES:    ~12 replacements

FIND:     group-hover:text-gray-700  
REPLACE:  group-hover:text-white
FILES:    ~5 replacements
```

### Total Expected: **~300+ replacements** across:
- `/src/app/components/BrandProfilePage.tsx`
- `/src/app/components/UserProfilePage.tsx`
- `/src/app/components/ProjectProfilePage.tsx`

---

## Method 2: Run Node.js Script

```bash
# From project root
node fix-contrast.js
```

The script will:
- ✅ Process all 3 profile pages
- ✅ Apply all 12 contrast fixes
- ✅ Show detailed statistics
- ✅ Backup originals automatically

---

## Method 3: Manual Command Line (Unix/Mac)

```bash
# Backup files first
cp src/app/components/BrandProfilePage.tsx src/app/components/BrandProfilePage.tsx.backup
cp src/app/components/UserProfilePage.tsx src/app/components/UserProfilePage.tsx.backup
cp src/app/components/ProjectProfilePage.tsx src/app/components/ProjectProfilePage.tsx.backup

# Apply fixes with sed
sed -i '' 's/text-gray-900/text-white/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/text-gray-700/text-white\/70/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/text-gray-600/text-white\/60/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/text-gray-500/text-white\/50/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/text-gray-400/text-white\/60/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/text-neutral-300/text-white\/85/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/text-neutral-400/text-white\/60/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/hover:text-gray-900/hover:text-white/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/hover:text-gray-700/hover:text-white/g' src/app/components/*ProfilePage.tsx
sed -i '' 's/group-hover:text-gray-900/group-hover:text-white/g' src/app/components/*ProfilePage.tsx
```

**For Linux**, remove the `''` after `-i`:
```bash
sed -i 's/text-gray-900/text-white/g' src/app/components/*ProfilePage.tsx
```

---

## Verification

After applying fixes:

1. **Hard refresh browser**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Clear cache** if needed
3. **Check these elements**:
   - ✅ Profile names (should be bright white)
   - ✅ Stat numbers (should be bright white)
   - ✅ Section headings (should be white)
   - ✅ Descriptions (should be white/70 or white/60)
   - ✅ Labels and meta text (should be white/60)
   - ✅ All text readable on dark background

4. **Run contrast check**: All text should meet WCAG AA minimum 4.5:1

---

## What Changed?

### Before ❌
```tsx
<h2 className="text-gray-900">Username</h2>          // Invisible on dark bg
<p className="text-gray-600">Description</p>         // Barely visible
<div className="text-gray-700">Stats</div>           // Washed out
```

### After ✅
```tsx
<h2 className="text-white">Username</h2>             // Crisp and clear
<p className="text-white/60">Description</p>         // Properly visible
<div className="text-white/70">Stats</div>           // Sharp and professional
```

---

## Design System Enforcement

This fix aligns with Linkary's **Infrastructure-Grade Contrast Standards**:

✅ **Primary Text** (names, headings, bold): `text-white`  
✅ **Secondary Text** (descriptions, body): `text-white/70`  
✅ **Muted Text** (labels, meta): `text-white/60`  
✅ **Subtle Text** (timestamps, hints): `text-white/50`  

🎯 **Goal**: Professional, enterprise-grade UI that doesn't look like a Dribbble gradient experiment.

---

## Files Affected

- ✅ `BrandProfilePage.tsx` (~70 fixes)
- ✅ `UserProfilePage.tsx` (~50 fixes)
- ✅ `ProjectProfilePage.tsx` (~40 fixes)
- ✅ `CreatorProfilePage.tsx` (already fixed ✅)
- ✅ `SharedComponents.tsx` (StatCard, FlipCard already fixed ✅)

---

## Next Steps

After fixing contrast:

1. Apply same standards to remaining pages:
   - Dashboard
   - Settings
   - Search/Discovery
   - Profile Editor
   
2. Create reusable text components:
   ```tsx
   <PrimaryText>High contrast white</PrimaryText>
   <SecondaryText>Medium contrast white/70</SecondaryText>
   <MutedText>Lower contrast white/60</MutedText>
   ```

3. Document in design system guide
4. Add ESLint rule to prevent `text-gray-*` on dark backgrounds

---

## Support

Questions? Issues?
- Check browser console for errors
- Verify no typos in classNames
- Ensure dark background is `#0D0F1A` or `#141826`
- Test in different lighting conditions

**Remember**: This is infrastructure, not art. Clarity > Aesthetics.
