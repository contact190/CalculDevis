/**
 * SmartMerge — Timestamp-based Conflict Resolution
 * 
 * Merges two databases using per-item _lastModified timestamps.
 * The most recently modified version of each item wins.
 * This prevents the "last sync wins" problem that caused data loss.
 */

export const smartMerge = (dbA, dbB) => {
  if (!dbA && !dbB) return null;
  if (!dbA) return dbB;
  if (!dbB) return dbA;

  const merged = { ...dbA };

  // Helper to merge arrays of objects with 'id', using _lastModified for conflict resolution
  const mergeArrays = (arrA, arrB) => {
    const map = new Map();

    // Start with all items from A
    if (Array.isArray(arrA)) {
      arrA.forEach(item => {
        if (item && item.id) map.set(item.id, item);
      });
    }

    // Merge in items from B, using timestamp to resolve conflicts
    if (Array.isArray(arrB)) {
      arrB.forEach(item => {
        if (!item || !item.id) return;
        
        const existing = map.get(item.id);
        
        if (!existing) {
          // New item from B — add it
          map.set(item.id, item);
        } else {
          // Conflict: same ID exists in both A and B
          const existingTime = existing._lastModified ? new Date(existing._lastModified).getTime() : 0;
          const incomingTime = item._lastModified ? new Date(item._lastModified).getTime() : 0;
          
          // Deep merge the two items instead of overwriting the whole object
          const mergedItem = { ...existing };
          
          Object.keys(item).forEach(key => {
            if (key === '_lastModified' || key === '_modifiedBy') return;
            
            const valA = existing[key];
            const valB = item[key];
            
            if (valA === undefined) {
              mergedItem[key] = valB;
            } else if (valB === undefined) {
              // Keep valA
            } else if (Array.isArray(valA) && Array.isArray(valB)) {
              // On ne fusionne pas les tableaux imbriqués (ex: elements de composition) élément par élément car
              // l'id n'y est pas une clé primaire unique (c'est une clé étrangère). On prend le tableau de l'objet le plus récent.
              mergedItem[key] = incomingTime >= existingTime ? valB : valA;
            } else if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
              mergedItem[key] = { ...valA, ...valB };
            } else {
              mergedItem[key] = incomingTime >= existingTime ? valB : valA;
            }
          });
          
          mergedItem._lastModified = incomingTime >= existingTime ? item._lastModified : existing._lastModified;
          mergedItem._modifiedBy = incomingTime >= existingTime ? item._modifiedBy : existing._modifiedBy;
          
          map.set(item.id, mergedItem);
        }
      });
    }

    return Array.from(map.values());
  };

  Object.keys(dbB).forEach(key => {
    if (key.startsWith('_')) return; // Skip internal metadata keys
    
    if (Array.isArray(dbB[key]) && Array.isArray(dbA[key])) {
      merged[key] = mergeArrays(dbA[key], dbB[key]);
    } else if (Array.isArray(dbB[key]) && !dbA[key]) {
      // B has an array that A doesn't have at all
      merged[key] = dbB[key];
    } else if (typeof dbB[key] === 'object' && dbB[key] !== null && !Array.isArray(dbB[key]) && 
               typeof dbA[key] === 'object' && dbA[key] !== null && !Array.isArray(dbA[key])) {
      // Both are objects (e.g., shutterComponents). Merge their inner keys.
      merged[key] = { ...dbA[key] };
      Object.keys(dbB[key]).forEach(subKey => {
         if (Array.isArray(dbB[key][subKey]) && Array.isArray(dbA[key][subKey])) {
            merged[key][subKey] = mergeArrays(dbA[key][subKey], dbB[key][subKey]);
         } else if (Array.isArray(dbB[key][subKey]) && !dbA[key][subKey]) {
            merged[key][subKey] = dbB[key][subKey];
         } else {
            // Primitive or config overrides inside the object
            merged[key][subKey] = dbB[key][subKey];
         }
      });
    } else {
      // For non-array values (configs, primitives), keep B's version
      // (server/remote is typically more recent)
      merged[key] = dbB[key];
    }
  });

  return merged;
};
