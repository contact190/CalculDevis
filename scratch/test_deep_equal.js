const TRACKABLE_COLLECTIONS = [
  'clients', 'quotes', 'orders', 'compositions', 'glass', 'colors',
  'options', 'accessories', 'shutterCaissons', 'shutterLames',
  'shutterLamesFinales', 'shutterGlissieres', 'shutterAxes', 'shutterKits',
  'profiles', 'joints', 'reinforcements', 'hardwareSets'
];

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => deepEqual(val, b[i]));
    }
    
    const keysA = Object.keys(a).filter(k => k !== '_lastModified' && k !== '_modifiedBy');
    const keysB = Object.keys(b).filter(k => k !== '_lastModified' && k !== '_modifiedBy');
    
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  
  return false;
}

const oldDb = {
  ranges: [{ id: 'R1', minL: 500 }]
};

const newDb = {
  ranges: [{ id: 'R1', minL: 600 }]
};

let ops = [];
for (const key of Object.keys(newDb)) {
  if (TRACKABLE_COLLECTIONS.includes(key)) continue;
  if (key.startsWith('_')) continue;
  
  if (!deepEqual(oldDb[key], newDb[key])) {
    ops.push({
      op: 'replace_key',
      collection: key,
      data: newDb[key]
    });
  }
}

console.log('Ops generated:', JSON.stringify(ops, null, 2));
