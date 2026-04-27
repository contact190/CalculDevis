
import { FormulaEngine } from './src/engine/formula-engine.js';

const db = {
  compositions: [
    { id: 'COMP1', rangeId: 'H40', elements: [] },
    { id: 'COMP2', rangeId: 'H40', elements: [] }
  ],
  profiles: [
    { id: 'P-3.02', name: 'Parclose', weightPerM: 0.5, pricePerBar: 10, barLength: 6000 }
  ],
  glass: [
    { id: 'V4', thickness: 4, weightPerM2: 10, pricePerM2: 50, name: 'Glass 4mm' }
  ],
  glassProfileCompatibility: [
    { rangeId: 'H40', glassThickness: 4, profileHId: 'P-3.02', formulaH: 'L', profileVId: 'P-3.02', formulaV: 'H' }
  ],
  accessories: [],
  colors: [{ id: 'WHITE', factor: 1 }],
  ranges: [{ id: 'H40', minL: 0, maxL: 5000, minH: 0, maxH: 5000 }]
};

const engine = new FormulaEngine(db);

const config = {
  L: 2000,
  H: 1000,
  compositionId: 'COMP1',
  glassId: 'V4',
  colorId: 'WHITE',
  compoundType: 'fix_ouvrant',
  compoundConfig: {
    orientation: 'horizontal',
    parts: [
      { id: 'p1', type: 'opening', width: 1200, height: 1000, compositionId: 'COMP1', glassId: 'V4' },
      { id: 'p2', type: 'fixe', width: 800, height: 1000, compositionId: 'COMP2', glassId: 'V4' }
    ]
  }
};

const res = engine.calculateBOM(config);

console.log('Profiles Found:', res.profiles.length);
res.profiles.forEach(p => {
  console.log(`- ${p.label} | Source: ${p.source} | Length: ${p.length}`);
});

if (res.profiles.some(p => p.label === 'ParcloseH' && p.source.includes('Part 2'))) {
  console.log('SUCCESS: Fixe Parclose found with correct source!');
} else {
  console.log('FAILURE: Fixe Parclose missing or merged!');
}
