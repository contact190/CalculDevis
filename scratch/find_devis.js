import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));
const devis = data.find(d => d.number === 'DEV-000102' || d.id === 'DEV-000102');

if (devis) {
  console.log("Found devis:", devis.number, devis.name);
  console.log(JSON.stringify(devis, null, 2));
} else {
  console.log("Devis DEV-000102 not found! All numbers:", data.map(d => d.number));
}
