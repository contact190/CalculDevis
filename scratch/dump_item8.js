import fs from 'fs';

const quotesDb = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));
const devis = quotesDb.find(d => d.number === 'DEV-000102' || d.id === 'DEV-000102');

if (devis && devis.items[7]) {
  console.log(JSON.stringify(devis.items[7], null, 2));
} else {
  console.log("Item 8 not found!");
}
