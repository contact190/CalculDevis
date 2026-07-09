const fs = require('fs');
const path = 'c:/Users/USER/Desktop/CalculDevis/src/modules/admin/AdminDashboard.jsx';

let content = fs.readFileSync(path, 'utf8');

// Replace updateShutterItem(key, i, ... -> updateShutterItem(key, item.id, i, ...
content = content.replace(/updateShutterItem\(\s*key\s*,\s*i\s*,/g, 'updateShutterItem(key, item.id, i,');

// Replace deleteShutterItem(key, i) -> deleteShutterItem(key, item.id, i)
content = content.replace(/deleteShutterItem\(\s*key\s*,\s*i\s*\)/g, 'deleteShutterItem(key, item.id, i)');

// Replace duplicateShutterItem(key, i) -> duplicateShutterItem(key, item.id, i)
content = content.replace(/duplicateShutterItem\(\s*key\s*,\s*i\s*\)/g, 'duplicateShutterItem(key, item.id, i)');

fs.writeFileSync(path, content, 'utf8');
console.log('Replacement complete!');
