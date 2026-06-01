import fs from 'fs';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));

console.log(JSON.stringify(mainDb.traverses, null, 2));
