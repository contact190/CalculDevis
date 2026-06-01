import fs from 'fs';
import path from 'path';

const cmPath = path.resolve('src/modules/commercial/CommercialModule.jsx');
const fePath = path.resolve('src/engine/formula-engine.js');

// 1. Update CommercialModule.jsx
let cmContent = fs.readFileSync(cmPath, 'utf8');
const targetLineCm = "const usage = item.usageVolet || (key === 'moteurId' ? 'BOTH' : 'NORMAL');";
const replacementLineCm = "const usage = item.usageVolet || (key === 'moteurId' ? 'BOTH' : 'NORMAL');"; // Already updated

console.log('CommercialModule.jsx already updated or checked.');

// 2. Update formula-engine.js
let feContent = fs.readFileSync(fePath, 'utf8');
const targetLineFe = "const usage = item.usageVolet || 'NORMAL';";
const replacementLineFe = "const usage = item.usageVolet || (key === 'moteurId' ? 'BOTH' : 'NORMAL');";

if (feContent.includes(targetLineFe)) {
  feContent = feContent.replace(targetLineFe, replacementLineFe);
  fs.writeFileSync(fePath, feContent, 'utf8');
  console.log('formula-engine.js usageVolet updated successfully!');
} else {
  console.log('Target string not found in formula-engine.js or already updated');
}
