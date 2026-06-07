import fs from 'fs';

const path = './backup_devis_2026-06-03 (6).json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

console.log("=== DETAILS ON QUOTES ===");
const quotes = data.quotes || [];
const quotesWithSize = quotes.map((q, idx) => ({
  idx,
  id: q.id,
  size: JSON.stringify(q).length
}));
quotesWithSize.sort((a, b) => b.size - a.size);

console.log("Top 5 largest quotes:");
for (let i = 0; i < Math.min(5, quotesWithSize.length); i++) {
  const qInfo = quotesWithSize[i];
  const q = quotes[qInfo.idx];
  console.log(`- Devis ${q.id}: ${(qInfo.size / 1024).toFixed(1)} KB`);
  if (q.items) {
    console.log(`  Items count: ${q.items.length}`);
    for (let itemIdx = 0; itemIdx < q.items.length; itemIdx++) {
      const item = q.items[itemIdx];
      const itemSize = JSON.stringify(item).length;
      console.log(`    * Item #${itemIdx} (${item.label}): ${(itemSize / 1024).toFixed(1)} KB`);
      if (item.config) {
        const configSize = JSON.stringify(item.config).length;
        console.log(`      - config: ${(configSize / 1024).toFixed(1)} KB`);
        // let's list keys of config with sizes
        for (const k of Object.keys(item.config)) {
          const kSize = JSON.stringify(item.config[k]).length;
          if (kSize > 5 * 1024) {
            console.log(`        - config.${k}: ${(kSize / 1024).toFixed(1)} KB (LARGE!)`);
          }
        }
      }
      if (item.priceData) {
        const pdSize = JSON.stringify(item.priceData).length;
        console.log(`      - priceData: ${(pdSize / 1024).toFixed(1)} KB`);
      }
    }
  }
}

console.log("\n=== DETAILS ON ORDERS ===");
const orders = data.orders || [];
const ordersWithSize = orders.map((o, idx) => ({
  idx,
  id: o.id,
  size: JSON.stringify(o).length
}));
ordersWithSize.sort((a, b) => b.size - a.size);

console.log("Top 5 largest orders:");
for (let i = 0; i < Math.min(5, ordersWithSize.length); i++) {
  const oInfo = ordersWithSize[i];
  const o = orders[oInfo.idx];
  console.log(`- Order ${o.id}: ${(oInfo.size / 1024).toFixed(1)} KB`);
  if (o.items) {
    console.log(`  Items count: ${o.items.length}`);
    for (let itemIdx = 0; itemIdx < o.items.length; itemIdx++) {
      const item = o.items[itemIdx];
      const itemSize = JSON.stringify(item).length;
      console.log(`    * Item #${itemIdx} (${item.label}): ${(itemSize / 1024).toFixed(1)} KB`);
    }
  }
  if (o.unitInstallationPhotos) {
    console.log(`  Photos count: ${Object.keys(o.unitInstallationPhotos).length}`);
    for (const key of Object.keys(o.unitInstallationPhotos)) {
      const pSize = JSON.stringify(o.unitInstallationPhotos[key]).length;
      console.log(`    * Photo ${key}: ${(pSize / 1024).toFixed(1)} KB`);
    }
  }
}
