const fs = require('fs');
const backupPath = 'c:/Users/USER/Desktop/CalculDevis/backup_devis_2026-06-29 (6).json';

const fileContent = fs.readFileSync(backupPath, 'utf8');
const data = JSON.parse(fileContent);

console.log('Backup root keys:', Object.keys(data));
if (data.shutterComponents) {
  console.log('shutterComponents keys:', Object.keys(data.shutterComponents));
}
