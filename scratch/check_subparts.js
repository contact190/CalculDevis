import fs from 'fs';

const mainDb = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));

const ids = ['COMP-1776880833976', 'COMP-1777994335634', 'COMP-1776868736323'];

ids.forEach(id => {
  const comp = (mainDb.compositions || []).find(c => c.id === id);
  if (comp) {
    console.log(`ID: ${id}`);
    console.log(`Name: ${comp.name}`);
    console.log(`RangeId: ${comp.rangeId}`);
    console.log(`---`);
  } else {
    console.log(`ID: ${id} NOT found!`);
  }
});
