import fs from 'fs';

const db = JSON.parse(fs.readFileSync('./local-server/database.json', 'utf8'));
console.log("Database keys:", Object.keys(db));
console.log("Number of traverses:", db.traverses?.length);
console.log("Traverses sample:", db.traverses?.slice(0, 5));
console.log("Number of profiles:", db.profiles?.length);
const traverseProfiles = db.profiles?.filter(p => p.name?.toLowerCase().includes('traverse') || p.id?.toLowerCase().includes('trav'));
console.log("Traverse profiles count:", traverseProfiles?.length);
console.log("Traverse profiles sample:", traverseProfiles?.slice(0, 5).map(p => ({ id: p.id, name: p.name, thickness: p.thickness })));
