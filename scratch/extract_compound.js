import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));
const devis = data.find(d => d.number === 'DEV-000102');

if (devis) {
  devis.items.forEach((item, idx) => {
    const config = item.config;
    if (config && config.compoundConfig && config.compoundConfig.parts) {
      const parts = config.compoundConfig.parts;
      const hasSubParts = parts.some(p => p.subParts && p.subParts.length > 0);
      if (hasSubParts) {
        console.log(`\n=== Found item with subParts: Item ${idx + 1} ===`);
        console.log("compoundConfig:", JSON.stringify(config.compoundConfig, null, 2));
      }
    }
  });
} else {
  console.log("Devis not found!");
}
