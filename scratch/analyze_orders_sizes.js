import fs from 'fs';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db-clean.json', 'utf8'));

if (Array.isArray(mainDb.orders)) {
  console.log(`Nombre total de commandes: ${mainDb.orders.length}`);
  const ordersWithSize = mainDb.orders.map((o, idx) => ({
    idx,
    id: o.id,
    size: JSON.stringify(o).length
  }));
  ordersWithSize.sort((a, b) => b.size - a.size);
  
  console.log('Tailles des commandes :');
  for (const o of ordersWithSize) {
    console.log(`- Commande #${o.idx} (${o.id}): ${(o.size / 1024).toFixed(1)} KB`);
    if (o.size > 100 * 1024) {
      // Analyser en détail cette commande
      const orderObj = mainDb.orders[o.idx];
      for (const key of Object.keys(orderObj)) {
        const keySize = JSON.stringify(orderObj[key]).length;
        console.log(`  * ${key}: ${(keySize / 1024).toFixed(1)} KB`);
        if (key === 'items' && Array.isArray(orderObj.items)) {
          for (let itemIdx = 0; itemIdx < orderObj.items.length; itemIdx++) {
            const item = orderObj.items[itemIdx];
            console.log(`    - Item #${itemIdx} (${item.label}): ${(JSON.stringify(item).length / 1024).toFixed(1)} KB`);
            if (item.config) {
              for (const configKey of Object.keys(item.config)) {
                const cfgValSize = JSON.stringify(item.config[configKey]).length;
                if (cfgValSize > 50 * 1024) {
                  console.log(`      - config.${configKey}: ${(cfgValSize / 1024).toFixed(1)} KB (TRÈS GRAND)`);
                  // Regarder le type ou le contenu
                  if (typeof item.config[configKey] === 'string') {
                    console.log(`        Début du contenu: ${item.config[configKey].substring(0, 50)}...`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
