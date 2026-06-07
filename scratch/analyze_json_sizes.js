import fs from 'fs';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));
const quotesDb = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));

function analyzeObject(obj, label) {
  console.log(`=== ANALYSE DE ${label} ===`);
  const keys = Object.keys(obj);
  for (const key of keys) {
    const size = JSON.stringify(obj[key]).length;
    console.log(`- Clé: ${key}, Taille: ${(size / 1024).toFixed(1)} KB`);
    
    if (Array.isArray(obj[key])) {
      console.log(`  Nombre d'éléments: ${obj[key].length}`);
      if (obj[key].length > 0) {
        // Analyser le premier élément
        const firstEl = obj[key][0];
        const elKeys = Object.keys(firstEl);
        console.log(`  Structure de l'élément [0]:`);
        for (const elKey of elKeys) {
          const elSize = JSON.stringify(firstEl[elKey]).length;
          if (elSize > 5000) {
            console.log(`    * ${elKey}: ${(elSize / 1024).toFixed(1)} KB (TRÈS GRAND)`);
          } else {
            console.log(`    * ${elKey}: ${(elSize / 1024).toFixed(1)} KB`);
          }
        }
      }
    }
  }
}

analyzeObject(mainDb, 'main-db');
console.log('');
// quotesDb est un tableau
console.log(`=== ANALYSE DE quotes-db ===`);
console.log(`Nombre total de devis: ${quotesDb.length}`);
let totalQuotesSize = JSON.stringify(quotesDb).length;
console.log(`Taille totale de quotes-db: ${(totalQuotesSize / 1024 / 1024).toFixed(2)} MB`);

// Trouver les plus gros devis
const quotesWithSize = quotesDb.map((q, idx) => ({
  idx,
  id: q.id,
  size: JSON.stringify(q).length
}));
quotesWithSize.sort((a, b) => b.size - a.size);

console.log('Les 5 plus gros devis :');
for (let i = 0; i < Math.min(5, quotesWithSize.length); i++) {
  const q = quotesWithSize[i];
  console.log(`- Devis #${q.idx} (${q.id}): ${(q.size / 1024).toFixed(1)} KB`);
  // Analyser ce devis
  const devisObj = quotesDb[q.idx];
  if (devisObj.items) {
    console.log(`  Nombre d'items: ${devisObj.items.length}`);
    for (let itemIdx = 0; itemIdx < devisObj.items.length; itemIdx++) {
      const item = devisObj.items[itemIdx];
      console.log(`    Item #${itemIdx} (${item.label}): ${(JSON.stringify(item).length / 1024).toFixed(1)} KB`);
      // Analyser config de cet item
      if (item.config) {
        for (const configKey of Object.keys(item.config)) {
          const cfgValSize = JSON.stringify(item.config[configKey]).length;
          if (cfgValSize > 1024) {
            console.log(`      - config.${configKey}: ${(cfgValSize / 1024).toFixed(1)} KB`);
          }
        }
      }
    }
  }
}
