import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));
const devis = data.find(d => d.number === 'DEV-000102' || d.id === 'DEV-000102');

if (devis) {
  console.log("Devis:", devis.number, devis.name);
  devis.items.forEach((item, index) => {
    console.log(`\n--- Item ${index + 1} ---`);
    console.log("Name:", item.name);
    console.log("Compound Type:", item.config.compoundType);
    console.log("Compound Config:", JSON.stringify(item.config.compoundConfig, null, 2));
    console.log("Global RangeId:", item.config.rangeId);
  });
} else {
  console.log("Not found!");
}
