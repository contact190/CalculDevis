const fs = require('fs');

const dbPath = 'c:/Users/USER/Desktop/CalculDevis/backup_devis_2026-07-08 (3).json'; // Base database (latest clients/quotes)
const backupPath = 'c:/Users/USER/Desktop/CalculDevis/backup_devis_2026-06-29 (6).json'; // Source database (good admin/catalog data)
const outDbPath = 'c:/Users/USER/Desktop/CalculDevis/local-server/database.json';
const outMergedPath = 'c:/Users/USER/Desktop/CalculDevis/backup_merged_catalog.json';

async function run() {
  try {
    // 1. Load base database (latest client/quotes)
    console.log('Loading base database (with latest clients/quotes):', dbPath);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Base database file not found at ${dbPath}`);
    }
    const currentDbContent = fs.readFileSync(dbPath, 'utf8');
    const currentDb = JSON.parse(currentDbContent);

    // 2. Load backup database (with good catalog data)
    console.log('Loading source database (with good catalog data):', backupPath);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Source database file not found at ${backupPath}`);
    }
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    const backupDb = JSON.parse(backupContent);

    // 3. Keys to overwrite from backup (catalog keys)
    const catalogKeys = [
      'glass',
      'colors',
      'ranges',
      'margins',
      'options',
      'profiles',
      'traverses',
      'categories',
      'accessories',
      'compositions',
      'storageZones',
      'shutterComponents',
      'gasketCompatibility',
      'glassProfileCompatibility',
      'shopProducts'
    ];

    const now = new Date().toISOString();
    const mergedDb = { ...currentDb };

    console.log('Merging catalog tables and updating timestamps...');
    for (const key of catalogKeys) {
      if (backupDb[key] !== undefined) {
        if (Array.isArray(backupDb[key])) {
          // Process array items
          mergedDb[key] = backupDb[key]
            .filter(item => item && !item._deleted) // Skip deleted items
            .map(item => {
              const cleanItem = { ...item };
              delete cleanItem._isNew;
              cleanItem._lastModified = now;
              return cleanItem;
            });
          console.log(`- Overwrote array: ${key} (${mergedDb[key].length} items)`);
        } else if (typeof backupDb[key] === 'object' && backupDb[key] !== null) {
          // Handle nested objects like shutterComponents
          mergedDb[key] = {};
          for (const subKey of Object.keys(backupDb[key])) {
            const subArr = backupDb[key][subKey];
            if (Array.isArray(subArr)) {
              mergedDb[key][subKey] = subArr
                .filter(item => item && !item._deleted)
                .map(item => {
                  const cleanItem = { ...item };
                  delete cleanItem._isNew;
                  cleanItem._lastModified = now;
                  return cleanItem;
                });
              console.log(`  - Overwrote shutterComponents.${subKey} (${mergedDb[key][subKey].length} items)`);
            } else {
              mergedDb[key][subKey] = backupDb[key][subKey];
            }
          }
        } else {
          mergedDb[key] = backupDb[key];
          console.log(`- Overwrote key: ${key}`);
        }
      }
    }

    // 4. Save merged database directly to target locations
    console.log('Saving merged database back to target paths...');
    const outputContent = JSON.stringify(mergedDb, null, 2);
    
    // Save to local-server
    fs.writeFileSync(outDbPath, outputContent, 'utf8');
    console.log(`💾 Saved to local-server database: ${outDbPath}`);

    // Save to backup_merged_catalog
    fs.writeFileSync(outMergedPath, outputContent, 'utf8');
    console.log(`💾 Saved to root backup: ${outMergedPath}`);

    console.log('🎉 Catalog migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

run();
