const fs = require('fs');
const path = 'c:\\Users\\USER\\Desktop\\CalculDevis\\src\\modules\\commercial\\CommercialModule.jsx';

let content = fs.readFileSync(path, 'utf-8');

// Fix isBoldLabel to include 'Options supplémentaires :'
const oldBold = "const isBoldLabel = line === 'Volet Roulant :' || line === 'Volet Roulant (Double) :';";
const newBold = "const isBoldLabel = line === 'Volet Roulant :' || line === 'Volet Roulant (Double) :' || line === 'Options suppl\\u00e9mentaires :';";

// Fix isVoletSubItem to include '  •'
const oldSub = "line.startsWith('  Kit') || line.startsWith('  Option');";
const newSub = "line.startsWith('  Kit') || line.startsWith('  Option') || line.startsWith('  \\u2022');";

if (content.includes(oldBold)) {
  content = content.replace(oldBold, newBold);
  console.log('✅ Fixed isBoldLabel');
} else {
  console.log('❌ Could not find isBoldLabel pattern');
  // Try to find what's actually there
  const idx = content.indexOf("isBoldLabel");
  if (idx !== -1) {
    console.log('Found isBoldLabel at index', idx);
    console.log('Context:', JSON.stringify(content.substring(idx, idx + 200)));
  }
}

if (content.includes(oldSub)) {
  content = content.replace(oldSub, newSub);
  console.log('✅ Fixed isVoletSubItem');
} else {
  console.log('❌ Could not find isVoletSubItem pattern');
  const idx = content.indexOf("isVoletSubItem");
  if (idx !== -1) {
    console.log('Found isVoletSubItem at index', idx);
    console.log('Context:', JSON.stringify(content.substring(idx, idx + 300)));
  }
}

fs.writeFileSync(path, content, 'utf-8');
console.log('Done.');
