import fs from 'fs';
import { FormulaEngine } from '../src/engine/formula-engine.js';

const db = JSON.parse(fs.readFileSync('./local-server/database.json', 'utf8'));
const engine = new FormulaEngine(db);

// Let's find a composition used for multi-chassis
// Usually, it's one of the compositions in the database
const comp = db.compositions[0];

const config = {
  compoundType: 'fix_coulissant',
  rangeId: 'H31 2Ouv SV', // Let's use some range
  compositionId: comp.id,
  L: 1200,
  H: 1260, // overall height
  hasShutter: true,
  shutterConfig: {
    caissonId: db.shutterComponents?.caissons?.[0]?.id || 'CAI-155',
    kitId: 'KIT-MOTE'
  },
  compoundConfig: {
    orientation: 'horizontal', // side-by-side
    parts: [
      { id: 'part1', type: 'opening', compositionId: comp.id },
      { id: 'part2', type: 'opening', compositionId: comp.id }
    ]
  },
  optionalSides: { top: true, bottom: true, left: true, right: true }
};

console.log("Running calculateBOM with config:", JSON.stringify(config, null, 2));
const bom = engine.calculateBOM(config);

console.log("\nProfiles calculated:");
bom.profiles.forEach(p => {
  console.log(`- ${p.label} (${p.source}): formula=${p.formula}, resolved=${p.resolvedFormula}, length=${p.length}, qty=${p.qty}`);
});
