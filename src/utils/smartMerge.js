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
          // Resolution: most recently modified wins
          const existingTime = existing._lastModified ? new Date(existing._lastModified).getTime() : 0;
          const incomingTime = item._lastModified ? new Date(item._lastModified).getTime() : 0;
          
          if (incomingTime >= existingTime) {
            // B's version is newer or same age — use B
            map.set(item.id, item);
          }
          // Otherwise keep A's version (it's newer)
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
    } else {
      // For non-array values (configs, primitives), keep B's version
      // (server/remote is typically more recent)
      merged[key] = dbB[key];
    }
  });

  return merged;
};
