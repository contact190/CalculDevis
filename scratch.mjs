import { FormulaEngine } from "./src/engine/formula-engine.js";
import { DEFAULT_DATA } from "./src/data/default-data.js";

const eng = new FormulaEngine(DEFAULT_DATA);
const pack = [];
eng.processShutterComponent({
  id: "C", 
  name: "Caisson", 
  formula: "L-1", 
  price: 3200, 
  priceUnit: "Barre", 
  barLength: "6400"
}, {
  L: 1200, H: 2000, HC: 150
}, pack, 'caissonId', { shutterConfig: {} });

console.log(pack);
