import fs from 'fs';
import { FormulaEngine } from '../src/engine/formula-engine.js';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));
const quotesDb = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));

const engine = new FormulaEngine(mainDb);
const devis = quotesDb.find(d => d.number === 'DEV-000102');
const item2 = devis.items[1];

console.log("ITEM 2 config:", JSON.stringify(item2.config.compoundConfig, null, 2));

const result = engine.calculateBOM(item2.config);
console.log("\n================= GLASS FOR ITEM 2 =================");
result.glassDetails.forEach((g, idx) => {
  console.log(`Glass ${idx + 1}:`);
  console.log(`  Source: ${g.source}`);
  console.log(`  Name: ${g.name}`);
  console.log(`  Dimensions: ${g.width} x ${g.height} mm`);
  console.log(`  Label: ${g.label}`);
});
