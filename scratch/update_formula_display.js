import fs from 'fs';
import path from 'path';

const fePath = path.resolve('src/engine/formula-engine.js');

let feContent = fs.readFileSync(fePath, 'utf8');

const targetLine = "resolvedFormula: `${this.resolveFormula(formulaToUse, evalScope)} x [${this.resolveFormula(item.cuttingFormula || (key === 'glissiereId' ? 'H' : 'L'), evalScope)}]`,";
const replacementLine = "resolvedFormula: `${this.resolveFormula(formulaToUse, evalScope)} x [${this.resolveFormula(cuttingFormulaToUse || (key === 'glissiereId' ? 'H' : 'L'), evalScope)}]`,";

if (feContent.includes(targetLine)) {
  feContent = feContent.replace(targetLine, replacementLine);
  fs.writeFileSync(fePath, feContent, 'utf8');
  console.log('formula-engine.js resolvedFormula updated successfully!');
} else {
  // Let's also check if there is a slightly different format (e.g. single quotes or spaces)
  const targetLineAlt = 'resolvedFormula: `${this.resolveFormula(formulaToUse, evalScope)} x [${this.resolveFormula(item.cuttingFormula || (key === \'glissiereId\' ? \'H\' : \'L\'), evalScope)}]`,';
  if (feContent.includes(targetLineAlt)) {
    feContent = feContent.replace(targetLineAlt, replacementLine);
    fs.writeFileSync(fePath, feContent, 'utf8');
    console.log('formula-engine.js resolvedFormula (alt) updated successfully!');
  } else {
    console.log('Target string not found in formula-engine.js');
  }
}
