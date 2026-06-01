import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));
const compositions = data.compositions || [];

const comp1 = compositions.find(c => c.id === 'COMP-1776880833976');
const comp2 = compositions.find(c => c.id === 'COMP-1777994335634');

console.log("COMP-1776880833976:");
if (comp1) {
  console.log("  name:", comp1.name);
  console.log("  rangeId:", comp1.rangeId);
} else {
  console.log("  Not found!");
}

console.log("\nCOMP-1777994335634:");
if (comp2) {
  console.log("  name:", comp2.name);
  console.log("  rangeId:", comp2.rangeId);
} else {
  console.log("  Not found!");
}
