import fs from 'fs';
import path from 'path';

const cmPath = path.resolve('src/modules/commercial/CommercialModule.jsx');
const lines = fs.readFileSync(cmPath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Largeur') || line.includes('largeur')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
