import { FormulaEngine } from './src/engine/formula-engine.js';
import { DEFAULT_DATA } from './src/data/default-data.js';

const engine = new FormulaEngine(DEFAULT_DATA);

const config = {
  compositionId: 'COUL-H36',
  compoundType: 'none',
  grid: undefined,
  rows: 1, cols: 1
};

// We will simulate the items from the screenshot
// Cadre H (Droite), Cadre L (Bas), Traverse Horiz.

const db = {
  profiles: [
    { id: 'P1', name: 'Cadre H', type: 'profile' },
    { id: 'P2', name: 'Cadre L', type: 'profile' }
  ],
  accessories: [
    { id: 'A1', name: 'Traverse Horiz.' }
  ],
  compositions: [
    {
      id: 'TEST',
      name: 'Test',
      elements: [
        { type: 'profile', id: 'P1', label: 'Cadre H (Droite)', formula: 'H' },
        { type: 'profile', id: 'P1', label: 'Cadre H (Gauche)', formula: 'H' },
        { type: 'profile', id: 'P2', label: 'Cadre L (Bas)', formula: 'L' },
        { type: 'profile', id: 'P2', label: 'Cadre L (Haut)', formula: 'L' },
        { type: 'accessory', id: 'A1', label: 'Traverse Horiz.', formula: 'L' }
      ]
    }
  ]
};

engine.db = db;

const res = engine.calculateBOM({ compositionId: 'TEST', compoundType: 'none', L: 1000, H: 2000 });

console.log("Profiles in BOM:", res.profiles.map(p => p.label));
