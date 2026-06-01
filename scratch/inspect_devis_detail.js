import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));
const devis = data.find(d => d.number === 'DEV-000102' || d.id === 'DEV-000102');

if (devis) {
  devis.items.forEach((item, index) => {
    console.log(`\n================= ITEM ${index + 1} =================`);
    console.log("Config Keys:", Object.keys(item.config));
    console.log("rangeId:", item.config.rangeId);
    console.log("compositionId:", item.config.compositionId);
    console.log("compoundType:", item.config.compoundType);
    console.log("compoundConfig:", JSON.stringify(item.config.compoundConfig, null, 2));
  });
}
