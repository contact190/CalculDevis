import fs from 'fs';

const data = JSON.parse(fs.readFileSync('C:/Users/USER/Desktop/CalculDevis/scratch/quotes-db.json', 'utf8'));
const quote = data.find(q => q.number === 'DEV-00072');

if (!quote) {
  console.log("Quote not found");
} else {
  console.log(`Quote: ${quote.number}`);
  quote.items.forEach((item, idx) => {
    console.log(`\nItem ${idx + 1}: ${item.label || item.id}`);
    console.log(`  Qty: ${item.qty}`);
    console.log(`  Config L x H: ${item.config.L} x ${item.config.H}`);
    console.log(`  Compound Type: ${item.config.compoundType}`);
    if (item.config.compoundConfig) {
      console.log(`  Compound Config: orientation=${item.config.compoundConfig.orientation}`);
      item.config.compoundConfig.parts.forEach(part => {
        console.log(`    Part: type=${part.type}, width=${part.width}, height=${part.height}, compositionId=${part.compositionId}`);
      });
    }
    console.log(`  Profiles count: ${item.priceData?.bom?.profiles?.length || 0}`);
    item.priceData?.bom?.profiles?.forEach(prof => {
      if (prof.label.includes('Cadre L') || prof.label.includes('Cadre H')) {
        console.log(`    Profile: label="${prof.label}", name="${prof.name}", qty=${prof.qty}, length=${prof.length}, formula="${prof.formula}", calculation="${prof.calculation}", resolvedFormula="${prof.resolvedFormula}"`);
      }
    });
  });
}
