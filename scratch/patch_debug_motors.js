import fs from 'fs';
import path from 'path';

const cmPath = path.resolve('src/modules/commercial/CommercialModule.jsx');
let cmContent = fs.readFileSync(cmPath, 'utf8');

const targetLog = `                    filteredItems = filteredItems.filter(moteur => {
                      const formula = moteur.compatibilityFormula;
                      if (!formula || formula.trim() === '') return true;
                      try {
                        const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                        const scope = { L, H, area, totalWeight, weightPerM2, liftingWeight, axeDiameter, lameWidth };
                        return engine.evaluate(formula, scope);
                      } catch (e) {`;

const replacementLog = `                    filteredItems = filteredItems.filter(moteur => {
                      const formula = moteur.compatibilityFormula;
                      console.log('[Motor Debug]', moteur.name, {
                        usage: moteur.usageVolet,
                        isDouble,
                        L, H, area, totalWeight, weightPerM2, liftingWeight, axeDiameter,
                        formula
                      });
                      if (!formula || formula.trim() === '') {
                        console.log('[Motor Debug]', moteur.name, 'No formula -> Compatible');
                        return true;
                      }
                      try {
                        const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                        const scope = { L, H, area, totalWeight, weightPerM2, liftingWeight, axeDiameter, lameWidth };
                        const res = engine.evaluate(formula, scope);
                        console.log('[Motor Debug]', moteur.name, 'Formula result ->', res);
                        return res;
                      } catch (e) {`;

// Normalize line endings to LF before replacing, to ensure it matches
const normalize = (str) => str.replace(/\r\n/g, '\n');

let normContent = normalize(cmContent);
const normTarget = normalize(targetLog);
const normReplacement = normalize(replacementLog);

if (normContent.includes(normTarget)) {
  normContent = normContent.replace(normTarget, normReplacement);
  fs.writeFileSync(cmPath, normContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log('CommercialModule.jsx patched with motor debug logs successfully!');
} else {
  console.log('Target string for motor debug log not found');
}
