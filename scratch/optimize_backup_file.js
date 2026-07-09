import fs from 'fs';

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
      if (o.unitInstallationPhotos) {
        o.unitInstallationPhotos = {};
      }
    }
  }

  return count;
}

async function run() {
  const inputFile = 'backup_devis_2026-07-06 (5).json';
  const outputFile = 'backup_devis_optimized.json';

  console.log(`Loading database from: ${inputFile}...`);
  const raw = fs.readFileSync(inputFile, 'utf8');
  const db = JSON.parse(raw);

  const initialSizeMB = (raw.length / 1024 / 1024).toFixed(2);
  console.log(`Initial size: ${initialSizeMB} MB`);

  console.log('Optimizing BOM structures and stripping thumbnails...');
  const optimizedCount = cleanAndOptimizeDatabase(db);
  console.log(`Optimized ${optimizedCount} items.`);

  const optimizedStr = JSON.stringify(db);
  const optimizedSizeMB = (optimizedStr.length / 1024 / 1024).toFixed(2);
  
  fs.writeFileSync(outputFile, optimizedStr, 'utf8');
  console.log(`✅ Success! Optimized database saved to ${outputFile}`);
  console.log(`New size: ${optimizedSizeMB} MB`);
}

run().catch(console.error);
