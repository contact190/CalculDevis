import fs from 'fs';

const mainDbPath = 'scratch/main-db.json';
const quotesDbPath = 'scratch/quotes-db.json';

function optimizeBOM(priceData) {
  if (!priceData || !priceData.bom) return;
  const bom = priceData.bom;

  // 1. Profils
  if (Array.isArray(bom.profiles)) {
    bom.profiles = bom.profiles.map(p => ({
      id: p.id,
      name: p.name,
      label: p.label,
      length: p.length,
      qty: p.qty,
      cost: p.cost,
      resolvedFormula: p.resolvedFormula
    }));
  }

  // 2. Accessoires
  if (Array.isArray(bom.accessories)) {
    bom.accessories = bom.accessories.map(a => ({
      id: a.id,
      name: a.name,
      label: a.label,
      qty: a.qty,
      cost: a.cost,
      unit: a.unit
    }));
  }

  // 3. Vitrages
  if (bom.glass) {
    const g = bom.glass;
    bom.glass = {
      id: g.id,
      name: g.name,
      qty: g.qty,
      width: g.width,
      height: g.height,
      area: g.area,
      cost: g.cost
    };
  }

  if (Array.isArray(bom.glassDetails)) {
    bom.glassDetails = bom.glassDetails.map(g => ({
      id: g.id,
      name: g.name,
      qty: g.qty,
      width: g.width,
      height: g.height,
      area: g.area,
      cost: g.cost
    }));
  }
  
  if (Array.isArray(bom.glasses)) {
    bom.glasses = bom.glasses.map(g => ({
      id: g.id,
      name: g.name,
      qty: g.qty,
      width: g.width,
      height: g.height,
      area: g.area,
      cost: g.cost
    }));
  }
}

function cleanAndOptimizeDatabase(db) {
  let count = 0;

  // Nettoyer dans les devis
  if (Array.isArray(db.quotes)) {
    for (const q of db.quotes) {
      if (Array.isArray(q.items)) {
        for (const item of q.items) {
          if (item.config && item.config.thumbnail) {
            item.config.thumbnail = '';
          }
          if (item.priceData) {
            optimizeBOM(item.priceData);
            count++;
          }
        }
      }
    }
  }

  // Nettoyer dans les commandes (orders)
  if (Array.isArray(db.orders)) {
    for (const o of db.orders) {
      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          if (item.config && item.config.thumbnail) {
            item.config.thumbnail = '';
          }
          if (item.priceData) {
            optimizeBOM(item.priceData);
            count++;
          }
        }
      }
      if (Array.isArray(o.batches)) {
        for (const b of o.batches) {
          if (Array.isArray(b.items)) {
            for (const item of b.items) {
              if (item.config && item.config.thumbnail) {
                item.config.thumbnail = '';
              }
              if (item.priceData) {
                optimizeBOM(item.priceData);
                count++;
              }
            }
          }
        }
      }
      // Vider les photos d'installation volumineuses pour la restauration
      if (o.unitInstallationPhotos) {
        o.unitInstallationPhotos = {};
      }
    }
  }

  return count;
}

function main() {
  console.log('Optimisation des structures BOM et miniatures...');

  // 1. main-db
  if (fs.existsSync(mainDbPath)) {
    const mainDb = JSON.parse(fs.readFileSync(mainDbPath, 'utf8'));
    const count = cleanAndOptimizeDatabase(mainDb);
    console.log(`- main-db : ${count} BOMs optimisés.`);
    const optPath = 'scratch/main-db-clean.json';
    fs.writeFileSync(optPath, JSON.stringify(mainDb));
    console.log(`  Taille initiale: ${(fs.statSync(mainDbPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Nouvelle taille optimisée: ${(fs.statSync(optPath).size / 1024 / 1024).toFixed(2)} MB`);
  }

  // 2. quotes-db
  if (fs.existsSync(quotesDbPath)) {
    const quotesDb = JSON.parse(fs.readFileSync(quotesDbPath, 'utf8'));
    let count = 0;
    for (const q of quotesDb) {
      if (Array.isArray(q.items)) {
        for (const item of q.items) {
          if (item.config && item.config.thumbnail) {
            item.config.thumbnail = '';
          }
          if (item.priceData) {
            optimizeBOM(item.priceData);
            count++;
          }
        }
      }
    }
    console.log(`- quotes-db : ${count} BOMs optimisés.`);
    const optPath = 'scratch/quotes-db-clean.json';
    fs.writeFileSync(optPath, JSON.stringify(quotesDb));
    console.log(`  Taille initiale: ${(fs.statSync(quotesDbPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Nouvelle taille optimisée: ${(fs.statSync(optPath).size / 1024 / 1024).toFixed(2)} MB`);
  }
}

main();
