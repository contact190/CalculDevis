const fs = require('fs');
const content = fs.readFileSync('c:/Users/USER/Desktop/CalculDevis/src/modules/commercial/CommercialModule.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 2159; i < 2215; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
