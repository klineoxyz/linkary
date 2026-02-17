#!/usr/bin/env node

/**
 * Linkary Contrast Fix Script
 * 
 * This script automatically fixes all text contrast issues across profile pages
 * by replacing washed-out gray text with proper white/high-contrast colors
 * for dark Linkary backgrounds.
 * 
 * Part of the Infrastructure-Grade Design System refactor.
 */

const fs = require('fs');
const path = require('path');

// Files to process
const FILES_TO_FIX = [
  './src/app/components/BrandProfilePage.tsx',
  './src/app/components/UserProfilePage.tsx',
  './src/app/components/ProjectProfilePage.tsx',
];

// Contrast fix rules - ordered by specificity (most specific first)
const CONTRAST_FIXES = [
  // Primary text (headings, names, bold text)
  { find: /text-gray-900/g, replace: 'text-white', category: 'Primary Text' },
  
  // Secondary text (body, descriptions)
  { find: /text-gray-700/g, replace: 'text-white/70', category: 'Secondary Text' },
  { find: /text-gray-600/g, replace: 'text-white/60', category: 'Secondary Text' },
  
  // Muted text (labels, meta info)
  { find: /text-gray-500/g, replace: 'text-white/50', category: 'Muted Text' },
  { find: /text-gray-400/g, replace: 'text-white/60', category: 'Muted Text' },
  
  // Neutral colors
  { find: /text-neutral-300/g, replace: 'text-white/85', category: 'Neutral Text' },
  { find: /text-neutral-400/g, replace: 'text-white/60', category: 'Neutral Text' },
  { find: /text-neutral-500/g, replace: 'text-white/50', category: 'Neutral Text' },
  { find: /text-neutral-600/g, replace: 'text-white/60', category: 'Neutral Text' },
  
  // Zinc colors (sometimes used for subtle text)
  { find: /text-zinc-700/g, replace: 'text-white/70', category: 'Subtle Text' },
  { find: /text-zinc-600/g, replace: 'text-white/60', category: 'Subtle Text' },
  { find: /text-zinc-500/g, replace: 'text-white/50', category: 'Subtle Text' },
  
  // Border hover states that need fixing
  { find: /hover:text-gray-900/g, replace: 'hover:text-white', category: 'Hover States' },
  { find: /hover:text-gray-700/g, replace: 'hover:text-white', category: 'Hover States' },
  
  // Group hover states
  { find: /group-hover:text-gray-900/g, replace: 'group-hover:text-white', category: 'Group Hover' },
  { find: /group-hover:text-gray-700/g, replace: 'group-hover:text-white', category: 'Group Hover' },
];

// Statistics tracking
const stats = {
  filesProcessed: 0,
  totalReplacements: 0,
  replacementsByCategory: {},
  replacementsByFile: {},
};

/**
 * Process a single file and apply all contrast fixes
 */
function processFile(filePath) {
  console.log(`\n📄 Processing: ${filePath}`);
  
  try {
    // Read file
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    let fileReplacements = 0;
    const categoryCount = {};
    
    // Apply all fixes
    CONTRAST_FIXES.forEach(({ find, replace, category }) => {
      const matches = content.match(find);
      if (matches) {
        const count = matches.length;
        content = content.replace(find, replace);
        
        fileReplacements += count;
        categoryCount[category] = (categoryCount[category] || 0) + count;
        stats.replacementsByCategory[category] = (stats.replacementsByCategory[category] || 0) + count;
        
        console.log(`   ✓ ${category}: ${count} replacement${count > 1 ? 's' : ''}`);
      }
    });
    
    // Write back if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesProcessed++;
      stats.totalReplacements += fileReplacements;
      stats.replacementsByFile[filePath] = fileReplacements;
      console.log(`   ✅ Saved ${fileReplacements} total changes`);
    } else {
      console.log(`   ℹ️  No changes needed`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 CONTRAST FIX SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Files processed: ${stats.filesProcessed}`);
  console.log(`📝 Total replacements: ${stats.totalReplacements}`);
  
  console.log('\n📋 Replacements by category:');
  Object.entries(stats.replacementsByCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   • ${category}: ${count}`);
    });
  
  console.log('\n📁 Replacements by file:');
  Object.entries(stats.replacementsByFile)
    .sort((a, b) => b[1] - a[1])
    .forEach(([file, count]) => {
      const fileName = path.basename(file);
      console.log(`   • ${fileName}: ${count}`);
    });
  
  console.log('\n' + '='.repeat(60));
  console.log('🎨 Design System Status: Infrastructure-Grade Contrast ✅');
  console.log('='.repeat(60));
  console.log('\n💡 Next steps:');
  console.log('   1. Hard refresh your browser (Ctrl+Shift+R / Cmd+Shift+R)');
  console.log('   2. Clear browser cache if needed');
  console.log('   3. Verify all text is now high-contrast and readable');
  console.log('   4. Check for any remaining low-contrast elements\n');
}

/**
 * Main execution
 */
function main() {
  console.log('🔥 LINKARY CONTRAST FIX SCRIPT');
  console.log('================================\n');
  console.log('Enforcing infrastructure-grade contrast standards...\n');
  
  // Check if files exist
  const missingFiles = FILES_TO_FIX.filter(file => !fs.existsSync(file));
  if (missingFiles.length > 0) {
    console.error('❌ Missing files:');
    missingFiles.forEach(file => console.error(`   • ${file}`));
    process.exit(1);
  }
  
  // Process all files
  FILES_TO_FIX.forEach(processFile);
  
  // Print summary
  printSummary();
}

// Run the script
main();
