import { FormulaEngine } from './src/engine/formula-engine.js';

const db = {
  profiles: [{ id: 'CJ', name: 'Couvre Joint', thickness: 10 }],
  compositions: [{
    id: 'COMP1',
    elements: [
      { type: 'profile', id: 'CJ', label: 'cjh', formula: 'L+70', qty: 1 },
      { type: 'profile', id: 'CJ', label: 'cjv', formula: 'H+70', qty: 1 }
    ]
  }]
};

const engine = new FormulaEngine(db);
const config = { 
  compositionId: 'COMP1', 
  L: 1488, 
  H: 2258,
  optionalSides: { top: true, bottom: true, left: true, right: true }
};

const bom = engine.calculateBOM(config);
console.log('BOM Results:');
bom.profiles.forEach(p => {
  console.log(`${p.label}: formula=${p.formula}, calculation=${p.calculation}, length=${p.length}, qty=${p.qty}`);
});
