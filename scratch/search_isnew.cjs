const fs = require('fs');
const content = fs.readFileSync('c:/Users/USER/Desktop/CalculDevis/src/modules/admin/AdminDashboard.jsx', 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('_isNew')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
