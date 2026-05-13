import { create, all } from 'mathjs';
const math = create(all);

function evaluate(formula, scope) {
    try {
        const clean = formula.toString().replace(/(\d),(\d)/g, '$1.$2').replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
        return math.evaluate(clean, { ...scope, 'if': (c, a, b) => c ? a : b });
    } catch (e) {
        return 0;
    }
}

const config = {
    shutterConfig: {
        isDoubleShutter: true
    }
};

const addon = {
    name: "Embout",
    formula: "2",
    doubleFormula: "4"
};

const isDouble = config.shutterConfig?.isDoubleShutter || false;
const formulaToUse = (isDouble && addon.doubleFormula) ? addon.doubleFormula : (addon.formula || '1');
const evalScope = { L: 1000, H: 1000 };

const addonQty = evaluate(formulaToUse, evalScope);

console.log("isDouble:", isDouble);
console.log("formulaToUse:", formulaToUse);
console.log("addonQty:", addonQty);
