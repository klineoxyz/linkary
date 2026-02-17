#!/usr/bin/env node

const fs = require('fs');

console.log('🔥 APPLYING CONTRAST FIXES\n');

const files = [
  './src/app/components/BrandProfilePage.tsx',
  './src/app/components/UserProfilePage.tsx',
  './src/app/components/ProjectProfilePage.tsx'
];

const fixes = [
  { from: /text-gray-900/g, to: 'text-white', name: 'text-gray-900' },
  { from: /text-gray-700/g, to: 'text-white/70', name: 'text-gray-700' },
  { from: /text-gray-600/g, to: 'text-white/60', name: 'text-gray-600' },
  { from: /text-gray-500/g, to: 'text-white/50', name: 'text-gray-500' },
  { from: /text-gray-400/g, to: 'text-white/60', name: 'text-gray-400' },
  { from: /text-neutral-300/g, to: 'text-white/85', name: 'text-neutral-300' },
  { from: /text-neutral-400/g, to: 'text-white/60', name: 'text-neutral-400' },
  { from: /text-neutral-500/g, to: 'text-white/50', name: 'text-neutral-500' },
  { from: /text-zinc-700/g, to: 'text-white/70', name: 'text-zinc-700' },
  { from: /hover:text-gray-900/g, to: 'hover:text-white', name: 'hover:text-gray-900' },
  { from: /hover:text-gray-700/g, to: 'hover:text-white', name: 'hover:text-gray-700' },
  { from: /group-hover:text-gray-900/g, to: 'group-hover:text-white', name: 'group-hover:text-gray-900' },
  { from: /group-hover:text-gray-700/g, to: 'group-hover:text-white', name: 'group-hover:text-gray-700' },
];

let totalChanges = 0;

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`❌ Not found: ${file}`);
    return;
  }

  console.log(`\n📄 Processing: ${file}`);
  
  let content = fs.readFileSync(file, 'utf8');
  let fileChanges = 0;

  fixes.forEach(fix => {
    const matches = content.match(fix.from);
    if (matches) {
      content = content.replace(fix.from, fix.to);
      const count = matches.length;
      fileChanges += count;
      console.log(`   ✓ ${fix.name}: ${count} replacements`);
    }
  });

  fs.writeFileSync(file, content);
  totalChanges += fileChanges;
  console.log(`   ✅ Total: ${fileChanges} changes`);
});

console.log(`\n${'='.repeat(50)}`);
console.log(`✅ COMPLETE: ${totalChanges} total contrast fixes applied`);
console.log(`${'='.repeat(50)}\n`);
