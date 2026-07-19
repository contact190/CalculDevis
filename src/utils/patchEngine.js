/**
 * PatchEngine — Granular Delta Sync for CalculDevis PRO
 * 
 * Instead of sending the entire 20MB database on every change,
 * this engine detects what changed and produces tiny "operations"
 * that can be sent over WebSocket in real-time.
 * 
 * Operation format:
 * {
 *   op: "add" | "update" | "delete",
 *   collection: "clients" | "quotes" | "orders" | ...,
 *   id: "CLI-123",
 *   data: { ...item },          // full item for add/update, null for delete
 *   timestamp: "2026-06-04T...", // ISO string, used for conflict resolution
 *   deviceId: "device-abc123"    // unique per browser tab
 * }
 */

// Generate a unique device ID per browser session
const DEVICE_ID_KEY = 'calculDevis_deviceId';
let _deviceId = null;

export function getDeviceId() {
  if (_deviceId) return _deviceId;
  _deviceId = sessionStorage.getItem(DEVICE_ID_KEY);
  if (!_deviceId) {
    _deviceId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(DEVICE_ID_KEY, _deviceId);
  }
  return _deviceId;
}

/**
 * Collections that contain arrays of items with `id` field.
 * These are the ones we track for granular changes.
 * Everything else (primitives, config objects) is treated as "full replace".
 */
const TRACKABLE_COLLECTIONS = [
  'clients', 'quotes', 'orders', 'contracts', 'financialTrackers', 'invoiceRecords', 'compositions', 'glass', 'colors',
  'options', 'accessories', 'profiles', 'joints', 'reinforcements', 'hardwareSets',
  'ranges', 'categories', 'traverses', 'glassProfileCompatibility', 'gasketCompatibility', 'shopProducts',
  'shutterComponents.caissons', 'shutterComponents.lames',
  'shutterComponents.lamesFinales', 'shutterComponents.lameFinales', 'shutterComponents.glissieres',
  'shutterComponents.axes', 'shutterComponents.kits', 'shutterComponents.extras', 'shutterComponents.moteurs'
];

function getPath(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((acc, part) => {
    if (!acc[part]) acc[part] = {};
    return acc[part];
  }, obj);
  target[last] = value;
  return obj;
}

let clockSkew = 0;
export function setClockSkew(skew) {
  clockSkew = skew;
}

export function getSynchronizedDate() {
  return new Date(Date.now() + clockSkew);
}

/**
 * Stamp an item with _lastModified metadata
 */
export function stampItem(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    _lastModified: getSynchronizedDate().toISOString(),
    _modifiedBy: getDeviceId()
  };
}

/**
 * Deep comparison of two values (handles objects, arrays, primitives)
 * Returns true if they are deeply equal
 */
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

/**
 * Generate operations (deltas) between oldDb and newDb
 * Only generates ops for items that actually changed.
 * 
 * @param {Object} oldDb - Previous database state
 * @param {Object} newDb - New database state
 * @returns {Array} Array of operation objects
 */
export function generateOps(oldDb, newDb) {
  if (!oldDb || !newDb) return [];
  
  const ops = [];
  const now = getSynchronizedDate().toISOString();
  const deviceId = getDeviceId();
  
  for (const collection of TRACKABLE_COLLECTIONS) {
    const oldArr = getPath(oldDb, collection);
    const newArr = getPath(newDb, collection);
    
    // Skip if both are missing or not arrays
    if (!Array.isArray(oldArr) && !Array.isArray(newArr)) continue;
    
    // Fast path: if the array reference is identical, no items changed!
    // This avoids deeply comparing a 30MB+ array when it wasn't modified.
    if (oldArr === newArr) continue;
    
    const oldMap = new Map();
    const newMap = new Map();
    
    if (Array.isArray(oldArr)) {
      oldArr.forEach(item => {
        if (item && item.id) oldMap.set(item.id, item);
      });
    }
    
    if (Array.isArray(newArr)) {
      newArr.forEach(item => {
        if (item && item.id) newMap.set(item.id, item);
      });
    }
    
    // Detect additions and updates
    for (const [id, newItem] of newMap) {
      const oldItem = oldMap.get(id);
      
      if (!oldItem) {
        // New item added
        ops.push({
          op: 'add',
          collection,
          id,
          data: { ...newItem, _lastModified: now, _modifiedBy: deviceId },
          timestamp: now,
          deviceId
        });
      } else if (!deepEqual(oldItem, newItem)) {
        // Item was modified
        ops.push({
          op: 'update',
          collection,
          id,
          data: { ...newItem, _lastModified: now, _modifiedBy: deviceId },
          timestamp: now,
          deviceId
        });
      }
    }
    
    // Detect deletions
    for (const [id, oldObj] of oldMap) {
      if (!newMap.has(id)) {
        if (oldObj && oldObj._deleted) continue; // Already a tombstone

        ops.push({
          op: 'delete',
          collection,
          id,
          data: null,
          timestamp: now,
          deviceId
        });
      }
    }
  }
  
  // Handle non-trackable top-level keys (configs, settings, etc.)
  // These are sent as full-replace ops if they changed
  for (const key of Object.keys(newDb)) {
    if (TRACKABLE_COLLECTIONS.includes(key)) continue;
    if (key.startsWith('_')) continue; // Skip metadata keys
    
    if (!deepEqual(oldDb[key], newDb[key])) {
      ops.push({
        op: 'replace_key',
        collection: key,
        id: key,
        data: newDb[key],
        timestamp: now,
        deviceId
      });
    }
  }
  
  return ops;
}

/**
 * Apply a single operation to a database state.
 * Returns a NEW database object (immutable).
 * 
 * Conflict resolution: if the incoming op has an older timestamp
 * than the existing item's _lastModified, the op is SKIPPED.
 * 
 * @param {Object} db - Current database state
 * @param {Object} op - Operation to apply
 * @returns {{ db: Object, applied: boolean }} New db state + whether op was applied
 */
export function applyOp(db, op) {
  if (!db || !op) return { db, applied: false };
  
  const { op: opType, collection, id, data, timestamp } = op;
  
  // Reject operations created before the database import time
  if (db._importTime && timestamp) {
    const opTime = new Date(timestamp).getTime();
    const importTime = new Date(db._importTime).getTime();
    if (opTime < importTime) {
      return { db, applied: false };
    }
  }
  
  // Handle non-collection key replacements
  if (opType === 'replace_key') {
    // Conflict resolution for globals if _lastGlobalUpdate exists
    const existingTime = db._lastGlobalUpdate ? new Date(db._lastGlobalUpdate).getTime() : 0;
    const incomingTime = timestamp ? new Date(timestamp).getTime() : 0;
    
    if (existingTime > incomingTime) {
       return { db, applied: false };
    }

    if (op._inPlace) {
      db[collection] = data;
      db._lastGlobalUpdate = timestamp;
      return { db, applied: true };
    }
    return {
      db: { ...db, [collection]: data, _lastGlobalUpdate: timestamp },
      applied: true
    };
  }
  
  const arr = getPath(db, collection);
  if (!TRACKABLE_COLLECTIONS.includes(collection)) {
    return { db, applied: false };
  }
  
  const currentArr = Array.isArray(arr) ? [...arr] : [];
  
  switch (opType) {
    case 'add': {
      // Check if item already exists (idempotency)
      const existingIdx = currentArr.findIndex(item => item && item.id === id);
      if (existingIdx >= 0) {
        // Already exists — treat as update, check timestamp
        const existing = currentArr[existingIdx];
        if (existing._lastModified && timestamp < existing._lastModified) {
          // Incoming is older — skip (conflict resolution: most recent wins)
          return { db, applied: false };
        }
        currentArr[existingIdx] = data;
      } else {
        currentArr.push(data);
      }
      const newDb = op._inPlace ? db : cloneAlongPath(db, collection);
      setPath(newDb, collection, currentArr);
      return {
        db: newDb,
        applied: true
      };
    }
    
    case 'update': {
      const idx = currentArr.findIndex(item => item && item.id === id);
      if (idx < 0) {
        // Item doesn't exist locally — add it
        currentArr.push(data);
        const newDb = op._inPlace ? db : cloneAlongPath(db, collection);
        setPath(newDb, collection, currentArr);
        return {
          db: newDb,
          applied: true
        };
      }
      
      const existing = currentArr[idx];
      const existingTime = existing._lastModified ? new Date(existing._lastModified).getTime() : 0;
      const incomingTime = timestamp ? new Date(timestamp).getTime() : 0;

      // Deep merge the properties of the item to avoid overwriting nested fields (e.g. blDates)
      const mergedItem = { ...existing };
      Object.keys(data).forEach(key => {
        if (key === '_lastModified' || key === '_modifiedBy') return;
        const valA = existing[key];
        const valB = data[key];
        
        if (valA === undefined) {
          mergedItem[key] = valB;
        } else if (valB === undefined) {
          // Keep valA
        } else if (Array.isArray(valA) && Array.isArray(valB)) {
          // On ne fusionne pas les tableaux imbriqués (ex: elements de composition) élément par élément car
          // l'id n'y est pas une clé primaire unique. On prend le tableau de l'objet le plus récent.
          mergedItem[key] = incomingTime >= existingTime ? valB : valA;
        } else if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
          mergedItem[key] = { ...valA, ...valB };
        } else {
          mergedItem[key] = incomingTime >= existingTime ? valB : valA;
        }
      });
      
      mergedItem._lastModified = incomingTime >= existingTime ? (timestamp || getSynchronizedDate().toISOString()) : existing._lastModified;
      mergedItem._modifiedBy = incomingTime >= existingTime ? (op.deviceId || 'unknown') : existing._modifiedBy;
      
      currentArr[idx] = mergedItem;
      const newDb = op._inPlace ? db : cloneAlongPath(db, collection);
      setPath(newDb, collection, currentArr);
      return {
        db: newDb,
        applied: true
      };
    }
    
    case 'delete': {
      const deleteIdx = currentArr.findIndex(item => item && item.id === id);
      if (deleteIdx < 0) {
        return { db, applied: false }; // Already deleted or physically missing
      }
      
      const existingItem = currentArr[deleteIdx];
      // Only delete if the delete op is newer than the item
      if (existingItem._lastModified && timestamp < existingItem._lastModified) {
        return { db, applied: false };
      }
      
      // Soft Delete (Tombstone)
      currentArr[deleteIdx] = {
        ...existingItem,
        _deleted: true,
        _lastModified: timestamp
      };

      const newDb = op._inPlace ? db : cloneAlongPath(db, collection);
      setPath(newDb, collection, currentArr);
      return {
        db: newDb,
        applied: true
      };
    }
    
    default:
      return { db, applied: false };
  }
}

/**
 * Recursively clone an object along a given path to ensure immutability
 * without deep cloning the entire 50MB database.
 */
function cloneAlongPath(obj, path) {
  const parts = path.split('.');
  const newObj = { ...obj };
  let current = newObj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    current[part] = { ...(current[part] || {}) };
    current = current[part];
  }
  return newObj;
}

/**
 * Apply multiple operations to a database state.
 * Returns the final db state and count of applied ops.
 */
export function applyOps(db, ops) {
  if (!db || !Array.isArray(ops) || ops.length === 0) return { db, appliedCount: 0 };
  
  let current = { ...db }; // Shallow clone the top level
  let appliedCount = 0;
  
  for (const op of ops) {
    if (op.collection) {
      // Clone the nested path for this specific collection to preserve immutability safely
      current = cloneAlongPath(current, op.collection);
    }
    
    // Flag it as in-place so applyOp doesn't clone it again
    const opWithFlag = { ...op, _inPlace: true };
    const result = applyOp(current, opWithFlag);
    current = result.db;
    if (result.applied) appliedCount++;
  }
  
  return { db: current, appliedCount };
}

/**
 * Create a snapshot hash of a database for quick change detection.
 * Much faster than JSON.stringify comparison of 20MB.
 * Uses item count + last modified timestamps as a lightweight fingerprint.
 */
export function dbFingerprint(db) {
  if (!db) return '';
  
  const parts = [];
  for (const col of TRACKABLE_COLLECTIONS) {
    const arr = getPath(db, col);
    if (!Array.isArray(arr)) continue;
    
    let latestMod = '';
    for (const item of arr) {
      if (item && item._lastModified && item._lastModified > latestMod) {
        latestMod = item._lastModified;
      }
    }
    parts.push(`${col}:${arr.length}:${latestMod}`);
  }
  
  return parts.join('|');
}
