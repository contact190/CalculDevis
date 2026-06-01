import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('src/data/default-data.js');
const dbContent = fs.readFileSync(dbPath, 'utf8');

// The file is too big to parse with simple regex easily, but let's try importing it.
// We can strip 'export const DEFAULT_DATA = ' and write it as JSON to a temp file, then load it.
const jsonStr = dbContent.replace('export const DEFAULT_DATA = ', '');
try {
  const data = JSON.parse(jsonStr.trim().replace(/;$/, ''));
  console.log('Successfully parsed DEFAULT_DATA!');
  console.log('Shutter Components Keys:', Object.keys(data.shutterComponents || {}));
  console.log('Motors List:', JSON.stringify(data.shutterComponents?.moteurs || [], null, 2));
} catch (e) {
  console.log('JSON parse failed:', e.message);
}
