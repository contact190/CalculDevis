const { create, all } = require('mathjs');
const math = create(all);

function evaluate(formula, scope) {
    const evalScope = { 
        ...scope, 
        'if': (cond, a, b) => cond ? a : b 
    };
    return math.evaluate(formula, evalScope);
}

const vars1 = { L: 2000, nb_moteurs: 1 };
const vars2 = { L: 2000, nb_moteurs: 2 };

const formula = "if(nb_moteurs == 1, L - 65, (L / 2) - 35)";

console.log("Result 1 motor:", evaluate(formula, vars1));
console.log("Result 2 motors:", evaluate(formula, vars2));
