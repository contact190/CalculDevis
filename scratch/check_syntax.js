import fs from 'fs';
const content = fs.readFileSync('src/modules/commercial/CommercialModule.jsx', 'utf8');
try {
    // Very basic check: count curly braces and parentheses
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    
    console.log(`Braces: {${openBraces}, }${closeBraces}}`);
    console.log(`Parens: (${openParens}, )${closeParens})`);
    
    if (openBraces !== closeBraces) console.error("Mismatched braces!");
    if (openParens !== closeParens) console.error("Mismatched parentheses!");
} catch (e) {
    console.error(e);
}
