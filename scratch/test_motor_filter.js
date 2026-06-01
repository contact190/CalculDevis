import fs from 'fs';
import path from 'path';

// 1. Load DEFAULT_DATA
const dbPath = path.resolve('src/data/default-data.js');
const dbContent = fs.readFileSync(dbPath, 'utf8');
const jsonStr = dbContent.replace('export const DEFAULT_DATA = ', '');
const database = JSON.parse(jsonStr.trim().replace(/;$/, ''));

// 2. Mock MathJS-based formula engine
class MockEngine {
  evaluate(formula, scope) {
    if (!formula || formula.trim() === '') return true;
    // Simple replacement of scope variables
    let f = formula;
    for (const [k, v] of Object.entries(scope)) {
      const regex = new RegExp(`\\b${k}\\b`, 'g');
      f = f.replace(regex, v);
    }
    // Clean up mathjs syntax or evaluate
    f = f.replace(/&&/g, ' && ').replace(/\|\|/g, ' || ');
    try {
      return eval(f);
    } catch(e) {
      // If simple eval fails, return true to avoid hiding
      return true;
    }
  }
}

const engine = new MockEngine();

// Let's test the motor Nice 10 N compatibility
// Since we don't have Nice 10 N in DEFAULT_DATA (it only has NICE 30N), let's add Nice 10 N with its compatibility formula
const motors = [
  ...database.shutterComponents.moteurs,
  {
    id: "MOT-NICE-10N",
    name: "Nice 10 N",
    compatibilityFormula: "axeDiameter == 40 && L <= 1800 && liftingWeight <= 9",
    usageVolet: undefined // Default
  }
];

const testConfig = (L_val, isDoubleShutter) => {
  const config = {
    L: L_val,
    H: 1500,
    shutterConfig: {
      isDoubleShutter,
      lameId: "LAME-43-THERM", // hypothetical or standard
      axeId: "AXE-40"
    }
  };

  const key = 'moteurId';
  const isDouble = config.shutterConfig?.isDoubleShutter || false;
  
  // 1. Filter by usageVolet
  let filteredItems = motors.filter(item => {
    const usage = item.usageVolet || (key === 'moteurId' ? 'BOTH' : 'NORMAL');
    if (isDouble) return usage === 'DOUBLE' || usage === 'BOTH';
    return usage === 'NORMAL' || usage === 'BOTH';
  });

  console.log(`\n--- Test config: L=${L_val}, isDouble=${isDoubleShutter} ---`);
  console.log(`Filtered items count by usageVolet: ${filteredItems.length}`);
  
  // 2. Compatibility Formula
  const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
  const H = config.H || 0;
  const weightPerM2 = 3.5;
  const area = (L * H) / 1000000;
  const totalWeight = area * weightPerM2;
  const axeDiameter = 40;
  const liftingWeight = totalWeight / 2;

  filteredItems = filteredItems.filter(moteur => {
    const formula = moteur.compatibilityFormula;
    if (!formula || formula.trim() === '') return true;
    const lameWidth = 43;
    const scope = { L, H, area, totalWeight, weightPerM2, liftingWeight, axeDiameter, lameWidth };
    const isCompatible = engine.evaluate(formula, scope);
    console.log(`Motor: ${moteur.name}, Formula: "${formula}", Scope:`, JSON.stringify(scope), `-> Compatible: ${isCompatible}`);
    return isCompatible;
  });

  console.log(`Compatible motors: ${filteredItems.map(m => m.name).join(', ')}`);
};

// Case A: L = 2400 (Double vs Normal)
testConfig(2400, false);
testConfig(2400, true);

// Case B: L = 1200 (Normal)
testConfig(1200, false);
