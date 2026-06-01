import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/quotes-db.json', 'utf8'));
const devis = data.find(d => d.number === 'DEV-000102' || d.id === 'DEV-000102');

if (devis) {
  const item5 = devis.items[4]; // 5th item is index 4
  console.log("Keys of priceData:", Object.keys(item5.priceData || {}));
  if (item5.priceData?.bom) {
    console.log("bom keys:", Object.keys(item5.priceData.bom));
    console.log("Profiles in bom:", item5.priceData.bom.profiles?.map(p => ({ id: p.id, name: p.name, source: p.source })));
  }
} else {
  console.log("Devis DEV-000102 not found!");
}
