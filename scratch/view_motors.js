import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('src/data/default-data.js');
const dbContent = fs.readFileSync(dbPath, 'utf8');

// Match motors in default-data.js
const match = dbContent.match(/moteurs:\s*\[([\s\S]*?)\]/);
if (match) {
  console.log(match[0].substring(0, 1000));
} else {
  console.log('moteurs array not found in default-data.js');
}
