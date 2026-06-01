import fs from 'fs';
import { FormulaEngine } from '../src/engine/formula-engine.js';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));
const quotesDb = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));

const engine = new FormulaEngine(mainDb);
const devis = quotesDb.find(d => d.number === 'DEV-000102');

console.log('=== DEV-000102 items ===');
devis.items.forEach((item, i) => {
  const cc = item.config?.compoundConfig;
  console.log(`\nItem ${i+1}: compoundType=${item.config?.compoundType} | orientation=${cc?.orientation}`);
  if (cc?.parts) {
    cc.parts.forEach((p, j) => {
      console.log(`  Part ${j+1}: type=${p.type} | w=${p.width} | h=${p.height} | subParts=${p.subParts?.length || 0}`);
      if (p.subParts) {
        p.subParts.forEach((sp, k) => {
          console.log(`    SubPart ${k+1}: type=${sp.type} | w=${sp.width} | h=${sp.height}`);
        });
      }
    });
  }
});

console.log('\n=== GLASS CALCULATIONS ===');
devis.items.forEach((item, i) => {
  try {
    const result = engine.calculateBOM(item.config);
    const glasses = result.glassDetails || [];
    if (glasses.length > 0) {
      console.log(`\n--- Item ${i+1} ---`);
      glasses.forEach(g => {
        console.log(`  [${g.source}] ${g.name}: ${Math.round(g.width)} x ${Math.round(g.height)} mm | calc: ${g.calculation}`);
      });
    }
  } catch(e) {
    console.log(`Item ${i+1}: ERROR - ${e.message}`);
  }
});
