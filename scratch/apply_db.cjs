const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db.json');
const targetPath = path.join(__dirname, '..', 'src', 'data', 'default-data.js');

try {
  const dbContent = fs.readFileSync(dbPath, 'utf8');
  // Validate JSON
  JSON.parse(dbContent);
  
  const finalContent = `export const DEFAULT_DATA = ${dbContent};`;
  
  fs.writeFileSync(targetPath, finalContent, 'utf8');
  console.log('Successfully updated default-data.js');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
