import fs from 'fs';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));
const comp = (mainDb.compositions || []).find(c => c.id === 'COMP-1776261514870');

if (comp) {
  console.log("Found composition:", JSON.stringify(comp, null, 2));
} else {
  console.log("Composition COMP-1776261514870 NOT found!");
}
