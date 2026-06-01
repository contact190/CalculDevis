import fs from 'fs';
import { FormulaEngine } from '../src/engine/formula-engine.js';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));
const quotesDb = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));

const engine = new FormulaEngine(mainDb);
const devis = quotesDb.find(d => d.number === 'DEV-000102' || d.id === 'DEV-000102');

if (!devis) {
  console.log("DEV-000102 not found!");
  process.exit(1);
}

devis.items.forEach((item, index) => {
  const result = engine.calculateBOM(item.config);
  
  const jonctions = result.profiles.filter(p => p.source === 'Jonction');
  
  if (jonctions.length > 0) {
    console.log(`\n================= ITEM ${index + 1} =================`);
    console.log(`Chassis Name: ${item.name || 'Unnamed'}`);
    console.log(`compoundType: ${item.config.compoundType}`);
    
    jonctions.forEach(t => {
      console.log(`  -> Junction found:`);
      console.log(`     ID: ${t.id}`);
      console.log(`     Name: ${t.name}`);
      console.log(`     Label: ${t.label}`);
      console.log(`     Length: ${t.length} mm`);
      console.log(`     Qty: ${t.qty}`);
    });
  }
});
