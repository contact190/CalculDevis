const fs = require('fs');

const fileContent = fs.readFileSync('src/data/default-data.js', 'utf8');
const dataStr = fileContent.replace('export const DEFAULT_DATA = ', '').replace(/;$/, '');
let data;
try {
  data = JSON.parse(dataStr);
} catch (e) {
  console.log("Error parsing JSON");
}

if (data && data.orders) {
  const order = data.orders[0];
  const item = order.items[0];
  console.log("Item keys:", Object.keys(item));
  console.log("unitPriceHT:", item.unitPriceHT);
  console.log("priceData:", item.priceData);
  console.log("price:", item.price);
  console.log("unitPrice:", item.unitPrice);
  console.log("cost:", item.cost);
}

if (data) { const order = data.orders[0]; const item = order.items[0]; console.log(item.measurements[0]); }
