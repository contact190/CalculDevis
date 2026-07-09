import { DEFAULT_DATA } from '../src/data/default-data.js';

const TRACKABLE_COLLECTIONS = [
  'clients', 'quotes', 'orders', 'compositions', 'glass', 'colors',
  'options', 'accessories', 'profiles', 'joints', 'reinforcements', 'hardwareSets',
  'ranges', 'categories', 'traverses', 'glassProfileCompatibility', 'gasketCompatibility',
  'shutterComponents.caissons', 'shutterComponents.lames',
  'shutterComponents.lamesFinales', 'shutterComponents.glissieres',
  'shutterComponents.axes', 'shutterComponents.kits'
];

console.log("Analyzing arrays in DEFAULT_DATA to find any untracked collections...");

// Check top-level arrays
for (const key of Object.keys(DEFAULT_DATA)) {
  const value = DEFAULT_DATA[key];
  if (Array.isArray(value)) {
    const isTracked = TRACKABLE_COLLECTIONS.includes(key);
    console.log(`- ${key}: Array length=${value.length}, Tracked=${isTracked ? "✅ Yes" : "❌ No"}`);
    
    // Check if items have IDs
    if (value.length > 0) {
      const missingId = value.some(item => item && typeof item === 'object' && !item.id);
      if (missingId) {
        console.log(`  ⚠️ Warning: Some items in '${key}' are missing 'id'!`);
      }
    }
  }
}

// Check shutterComponents sub-arrays
if (DEFAULT_DATA.shutterComponents) {
  console.log("\nAnalyzing shutterComponents sub-arrays:");
  for (const subKey of Object.keys(DEFAULT_DATA.shutterComponents)) {
    const value = DEFAULT_DATA.shutterComponents[subKey];
    if (Array.isArray(value)) {
      const fullKey = `shutterComponents.${subKey}`;
      const isTracked = TRACKABLE_COLLECTIONS.includes(fullKey);
      console.log(`- ${fullKey}: Array length=${value.length}, Tracked=${isTracked ? "✅ Yes" : "❌ No"}`);
      
      if (value.length > 0) {
        const missingId = value.some(item => item && typeof item === 'object' && !item.id);
        if (missingId) {
          console.log(`  ⚠️ Warning: Some items in '${fullKey}' are missing 'id'!`);
        }
      }
    }
  }
}
