import fs from 'fs';

const mainDbPath = 'scratch/main-db.json';
const quotesDbPath = 'scratch/quotes-db.json';

function cleanObject(obj) {
  let cleanedCount = 0;
  
  function recurse(current) {
    if (!current || typeof current !== 'object') return;
    
    if (Array.isArray(current)) {
      for (const item of current) {
        recurse(item);
      }
    } else {
      for (const key of Object.keys(current)) {
        if (key === 'thumbnail' && typeof current[key] === 'string' && current[key].startsWith('data:image')) {
          current[key] = ''; // On vide la miniature
          cleanedCount++;
        } else {
          recurse(current[key]);
        }
      }
    }
  }

  recurse(obj);
  return cleanedCount;
}

function main() {
  console.log('Nettoyage des sauvegardes...');

  // 1. main-db
  if (fs.existsSync(mainDbPath)) {
    const mainDb = JSON.parse(fs.readFileSync(mainDbPath, 'utf8'));
    const count = cleanObject(mainDb);
    console.log(`- main-db : ${count} miniatures nettoyées.`);
    const cleanPath = 'scratch/main-db-clean.json';
    fs.writeFileSync(cleanPath, JSON.stringify(mainDb));
    console.log(`  Taille initiale: ${(fs.statSync(mainDbPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Nouvelle taille: ${(fs.statSync(cleanPath).size / 1024 / 1024).toFixed(2)} MB`);
  }

  // 2. quotes-db
  if (fs.existsSync(quotesDbPath)) {
    const quotesDb = JSON.parse(fs.readFileSync(quotesDbPath, 'utf8'));
    const count = cleanObject(quotesDb);
    console.log(`- quotes-db : ${count} miniatures nettoyées.`);
    const cleanPath = 'scratch/quotes-db-clean.json';
    fs.writeFileSync(cleanPath, JSON.stringify(quotesDb));
    console.log(`  Taille initiale: ${(fs.statSync(quotesDbPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Nouvelle taille: ${(fs.statSync(cleanPath).size / 1024 / 1024).toFixed(2)} MB`);
  }
}

main();
