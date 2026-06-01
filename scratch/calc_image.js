import fs from 'fs';
import { FormulaEngine } from '../src/engine/formula-engine.js';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));

const engine = new FormulaEngine(mainDb);

const coulissantComp = mainDb.compositions.find(c => c.name.toLowerCase().includes('h36 dv'));
const fixeComp = mainDb.compositions.find(c => c.name.toLowerCase().includes('h52 fix'));

const config = {
  L: 2440,
  H: 2100,
  glassId: "5/12/5",
  compoundType: "fix_coulissant",
  optionalSides: { top: true, bottom: true, left: true, right: true },
  compoundConfig: {
    orientation: "vertical",
    unionId: "AUTO",
    traverseId: "AUTO",
    parts: [
      {
        type: "opening",
        width: 2440,
        height: 1900,
        compositionId: coulissantComp ? coulissantComp.id : undefined
      },
      {
        type: "group",
        width: 2440,
        height: 200,
        subParts: [
          {
            type: "fixe",
            width: 1220,
            height: 200,
            compositionId: fixeComp ? fixeComp.id : undefined,
            glassId: "4/6/33"
          },
          {
            type: "fixe",
            width: 1220,
            height: 200,
            compositionId: fixeComp ? fixeComp.id : undefined,
            glassId: "4/6/33"
          }
        ]
      }
    ]
  }
};

const result = engine.calculateBOM(config);

console.log("=== COMPOSITIONS FOUND ===");
console.log("Coulissant:", coulissantComp ? coulissantComp.name : "Not found");
console.log("Fixe:", fixeComp ? fixeComp.name : "Not found");

console.log("\n=== VITRAGES ===");
result.glassDetails.forEach(g => {
  console.log(`[${g.source || 'N/A'}] ${g.name}: ${Math.round(g.width)} x ${Math.round(g.height)} mm | formula: ${g.calculation}`);
});
