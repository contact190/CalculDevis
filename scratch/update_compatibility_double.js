import fs from 'fs';
import path from 'path';

// Helper to normalize line endings
const normalize = (str) => str.replace(/\r\n/g, '\n');

// 1. Update CommercialModule.jsx
const cmPath = path.resolve('src/modules/commercial/CommercialModule.jsx');
let cmContent = normalize(fs.readFileSync(cmPath, 'utf8'));

const targetsCm = [
  {
    target: `                  // Apply compatibility formula for lames
                  if (key === 'lameId') {
                    const L = config.L || 0;
                    const H = config.H || 0;`,
    replacement: `                  // Apply compatibility formula for lames
                  if (key === 'lameId') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;`
  },
  {
    target: `                  // Apply compatibility formula for motors
                  if (key === 'moteurId') {
                    const L = config.L || 0;
                    const H = config.H || 0;`,
    replacement: `                  // Apply compatibility formula for motors
                  if (key === 'moteurId') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;`
  },
  {
    target: `                  // Apply compatibility formula for axes
                  if (key === 'axeId') {
                    const L = config.L || 0;
                    const H = config.H || 0;`,
    replacement: `                  // Apply compatibility formula for axes
                  if (key === 'axeId') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;`
  },
  {
    target: `                  // Apply compatibility formula for kits
                  if (key === 'kitId' || key === 'kits') {
                    const L = config.L || 0;
                    const H = config.H || 0;`,
    replacement: `                  // Apply compatibility formula for kits
                  if (key === 'kitId' || key === 'kits') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;`
  }
];

let updatedCmCount = 0;
for (const { target, replacement } of targetsCm) {
  const normTarget = normalize(target);
  const normReplacement = normalize(replacement);
  if (cmContent.includes(normTarget)) {
    cmContent = cmContent.replace(normTarget, normReplacement);
    updatedCmCount++;
  }
}

if (updatedCmCount > 0) {
  fs.writeFileSync(cmPath, cmContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`CommercialModule.jsx: ${updatedCmCount} compatibility blocks updated successfully!`);
} else {
  console.log('CommercialModule.jsx compatibility targets not found or already updated.');
}

// 2. Update formula-engine.js
const fePath = path.resolve('src/engine/formula-engine.js');
let feContent = normalize(fs.readFileSync(fePath, 'utf8'));

const targetFe = normalize(`    // 1. Compatibility Check (Standalone Logic V3.3)
    if (item.compatibilityFormula) {
      const isCompatible = this.evaluate(item.compatibilityFormula, evalScope, \`Compatibilité \${item.name}\`);
      if (!isCompatible) return;
    }

    // 1.5 Technical Alert Evaluation
    if (item.technicalAlert) {
      try {
        const alertMsg = this.evaluate(item.technicalAlert, evalScope, \`Alerte \${item.name}\`, errors);`);

const replacementFe = normalize(`    // For compatibility and alerts, if it is a double shutter, components (except caisson) should be evaluated against individual shutter dimensions (divided by 2)
    const compScope = { ...evalScope };
    if (isDouble && key !== 'caissonId') {
      compScope.L = evalScope.L / 2;
      compScope.area = evalScope.area / 2;
      if (compScope.totalWeight !== undefined && compScope.totalWeight !== null) {
        compScope.totalWeight = evalScope.totalWeight / 2;
      }
      if (compScope.liftingWeight !== undefined && compScope.liftingWeight !== null) {
        compScope.liftingWeight = evalScope.liftingWeight / 2;
      }
    }

    // 1. Compatibility Check (Standalone Logic V3.3)
    if (item.compatibilityFormula) {
      const isCompatible = this.evaluate(item.compatibilityFormula, compScope, \`Compatibilité \${item.name}\`);
      if (!isCompatible) return;
    }

    // 1.5 Technical Alert Evaluation
    if (item.technicalAlert) {
      try {
        const alertMsg = this.evaluate(item.technicalAlert, compScope, \`Alerte \${item.name}\`, errors);`);

if (feContent.includes(targetFe)) {
  feContent = feContent.replace(targetFe, replacementFe);
  fs.writeFileSync(fePath, feContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log('formula-engine.js compatibility scope updated successfully!');
} else {
  console.log('Target string not found in formula-engine.js or already updated');
}
