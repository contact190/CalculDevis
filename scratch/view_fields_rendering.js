import fs from 'fs';
import path from 'path';

const cmPath = path.resolve('src/modules/commercial/CommercialModule.jsx');
const lines = fs.readFileSync(cmPath, 'utf8').split('\n');

for (let i = 1170; i < 1240; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
