import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('src/data/default-data.js');
const dbContent = fs.readFileSync(dbPath, 'utf8');

const jsonStr = dbContent.replace('export const DEFAULT_DATA = ', '');
try {
  const data = JSON.parse(jsonStr.trim().replace(/;$/, ''));
  console.log('Kits List:', JSON.stringify(data.shutterComponents?.kits || [], null, 2));
} catch (e) {
  console.log('JSON parse failed:', e.message);
}
