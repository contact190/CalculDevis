import fs from 'fs';

const path = './backup_devis_2026-06-03 (6).json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

console.log("Searching for items with large profiles or priceData...");
for (const q of data.quotes || []) {
  for (const item of q.items || []) {
    const pd = item.priceData;
    if (pd) {
      const pdSize = JSON.stringify(pd).length;
      if (pdSize > 10 * 1024) {
        console.log(`Quote ${q.id}, Item ${item.label}: priceData size = ${(pdSize/1024).toFixed(1)} KB`);
        if (pd.bom) {
          console.log(`  - bom size = ${(JSON.stringify(pd.bom).length/1024).toFixed(1)} KB`);
          if (pd.bom.profiles) {
            const profilesSize = JSON.stringify(pd.bom.profiles).length;
            console.log(`    - profiles size = ${(profilesSize/1024).toFixed(1)} KB, length = ${pd.bom.profiles.length}`);
            if (profilesSize > 10 * 1024) {
              // Let's inspect the first profile
              const p = pd.bom.profiles[0];
              console.log(`      * profile[0] keys: ${Object.keys(p)}`);
              console.log(`      * profile[0] size: ${JSON.stringify(p).length} bytes`);
              // Let's print out the profile if there's any huge field
              for (const k of Object.keys(p)) {
                const kSize = JSON.stringify(p[k]).length;
                if (kSize > 500) {
                  console.log(`        - ${k} size: ${kSize} bytes`);
                }
              }
            }
          }
        }
      }
    }
  }
}
