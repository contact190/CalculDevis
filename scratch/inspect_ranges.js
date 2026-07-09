import fs from 'fs';

const db = JSON.parse(fs.readFileSync('./local-server/database.json', 'utf8'));
console.log("Ranges:", db.ranges.map(r => ({ id: r.id, name: r.name, epaisseur: r.epaisseur })));
