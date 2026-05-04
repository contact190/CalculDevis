const math = require('mathjs');

const scope = {
  caissonSize: 185,
  axeSize: 40,
  'if': (cond, a, b) => cond ? a : b
};

let formula = "if(caissonSize == 185 && axeSize == 40, 1, 0)";
let cleanFormula = formula.replace(/(\d),(\d)/g, '$1.$2').replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');

console.log("Formula:", cleanFormula);
try {
  let result = math.evaluate(cleanFormula, scope);
  console.log("Result:", result);
} catch (e) {
  console.log("Error:", e.message);
}
