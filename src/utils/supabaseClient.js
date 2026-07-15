import { createClient } from '@supabase/supabase-js';
import { persistentStorage } from './storage.js';
import { getDeviceId } from './patchEngine.js';

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const fetchWithTimeout = async (resource, options = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const supabaseFetch = async (endpoint, options = {}) => {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetchWithTimeout(url, { ...options, headers }, 8000);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Error: ${response.status} - ${text}`);
  }
  
  if (response.status === 204) return null;
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    return null;
  }
};

export const invokeFunction = async (name, payload) => {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, 10000);
  if (!response.ok) throw new Error(`Function Error: ${response.status}`);
  return response.json();
};

// Fast hash function to check segments updates
function getHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

const PARTITIONS = {
  clients: 5,
  orders: 10,
  quotes: 30
};

function getBucketIndex(id, numBuckets) {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31) + id.charCodeAt(i);
  }
  return Math.abs(hash % numBuckets);
}

function getClientMaxTime(db) {
  let maxTime = 0;
  if (!db) return maxTime;
  
  for (const key of Object.keys(db)) {
    const arr = db[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && item._lastModified) {
          const t = new Date(item._lastModified).getTime();
          if (t > maxTime) maxTime = t;
        }
      }
    } else if (key === 'shutterComponents' && arr && typeof arr === 'object') {
      for (const subKey of Object.keys(arr)) {
        const subArr = arr[subKey];
        if (Array.isArray(subArr)) {
          for (const item of subArr) {
            if (item && item._lastModified) {
              const t = new Date(item._lastModified).getTime();
              if (t > maxTime) maxTime = t;
            }
          }
        }
      }
    }
  }
  return maxTime;
}

export const syncDatabase = {
  /**
   * Load full data from Cloud (returns null if nothing exists)
   */
  async load() {
    const res = await this.loadWithMeta();
    return res.data;
  },

  /**
   * Load data + its updated_at timestamp from Cloud
   * Returns { data, updatedAt } or { data: null, updatedAt: null }
   */
  async loadWithMeta() {
    try {
      // 1. Try to load from Storage Bucket first
      const t = Date.now();
      const bucket = supabase.storage.from('app-state');
      const { data: metaUrlData } = bucket.getPublicUrl('meta.json');
      
      const storageMetaRes = await fetchWithTimeout(`${metaUrlData.publicUrl}?t=${t}`, {}, 15000); // 15s for meta
      
      if (storageMetaRes.ok) {
        const meta = await storageMetaRes.json();
        const cloudHashes = meta.hashes || {};
        const cloudTime = new Date(meta.updated_at).getTime();
        
        // Load the local database to compare hashes and download only changed segments
        let localDb = null;
        try {
          localDb = await persistentStorage.load('calculDevis_main');
        } catch (e) {
          console.warn("Could not load local database for delta comparison:", e);
        }
        
        const localSegments = {
          clients: localDb?.clients || [],
          orders: localDb?.orders || [],
          quotes: localDb?.quotes || [],
          catalog: {}
        };
        
        if (localDb) {
          for (const key of Object.keys(localDb)) {
            if (key !== 'clients' && key !== 'orders' && key !== 'quotes') {
              localSegments.catalog[key] = localDb[key];
            }
          }
        }
        
        const localCatalogHash = getHash(JSON.stringify(localSegments.catalog));
        const db = localDb ? { ...localDb } : { clients: [], orders: [], quotes: [] };
        
        const downloadPromises = [];
        const downloadKeys = []; // Array of { collection, bucketIdx } or 'catalog'
        
        // ─── A. Process large collections bucket-by-bucket ───
        for (const key of ['clients', 'orders', 'quotes']) {
          const numBuckets = PARTITIONS[key];
          const cloudBucketHashes = cloudHashes[key] || [];
          
          // Reconstruct local buckets
          const localBuckets = Array.from({ length: numBuckets }, () => []);
          localSegments[key].forEach(item => {
            if (item && item.id) {
              const bucketIdx = getBucketIndex(item.id, numBuckets);
              localBuckets[bucketIdx].push(item);
            }
          });
          
          // Identify which buckets to download
          for (let bucketIdx = 0; bucketIdx < numBuckets; bucketIdx++) {
            const localBucketStr = JSON.stringify(localBuckets[bucketIdx]);
            const localBucketHash = getHash(localBucketStr);
            const cloudBucketHash = cloudBucketHashes[bucketIdx];
            
            if (localBucketHash !== cloudBucketHash) {
              downloadKeys.push({ collection: key, bucketIdx });
              const { data: urlData } = bucket.getPublicUrl(`${key}/bucket-${bucketIdx}.json`);
              downloadPromises.push(
                fetchWithTimeout(`${urlData.publicUrl}?t=${t}`, {}, 60000).then(res => {
                  if (res.status === 404) return []; // If file doesn't exist yet on cloud, it's empty
                  if (!res.ok) throw new Error(`Failed to download ${key}/bucket-${bucketIdx}.json`);
                  return res.json();
                })
              );
            }
          }
        }
        
        // ─── B. Process catalog segment ───
        if (localCatalogHash !== cloudHashes.catalog) {
          downloadKeys.push('catalog');
          const { data: urlData } = bucket.getPublicUrl('catalog.json');
          downloadPromises.push(
            fetchWithTimeout(`${urlData.publicUrl}?t=${t}`, {}, 60000).then(res => {
              if (!res.ok) throw new Error(`Failed to download catalog.json`);
              return res.json();
            })
          );
        }
        
        // ─── C. Await downloads and apply updates ───
        if (downloadPromises.length > 0) {
          console.log(`Downloading ${downloadPromises.length} modified bucket partitions...`);
          const downloadedData = await Promise.all(downloadPromises);
          
          for (let i = 0; i < downloadKeys.length; i++) {
            const keyInfo = downloadKeys[i];
            const val = downloadedData[i] || [];
            
            if (keyInfo === 'catalog') {
              // Merge catalog collections item-by-item using timestamps to avoid overwriting recent local edits
              for (const subKey of Object.keys(val)) {
                if (Array.isArray(val[subKey])) {
                  const localArr = db[subKey] || [];
                  const localItemsToKeep = localArr.filter(item => {
                    if (!item || !item.id) return false;
                    const localTime = item._lastModified ? new Date(item._lastModified).getTime() : 0;
                    return localTime > cloudTime;
                  });
                  const keepIds = new Set(localItemsToKeep.map(item => item.id));
                  const cloudItems = (val[subKey] || []).filter(item => !keepIds.has(item.id));
                  db[subKey] = [...localItemsToKeep, ...cloudItems];
                } else {
                  db[subKey] = val[subKey];
                }
              }
            } else {
              const { collection, bucketIdx } = keyInfo;
              
              // Filter out local items belonging to this bucket, EXCEPT new offline modifications
              db[collection] = (db[collection] || []).filter(item => {
                if (!item || !item.id) return false;
                if (getBucketIndex(item.id, PARTITIONS[collection]) !== bucketIdx) return true; // keep other buckets
                
                // Keep local offline item if modified after the cloud snapshot
                const localTime = item._lastModified ? new Date(item._lastModified).getTime() : 0;
                return localTime > cloudTime;
              });
              
              // Push the downloaded partition items
              db[collection].push(...val);
            }
          }
        }
        
        return { data: db, updatedAt: meta.updated_at };
      }

      // 2. Fallback to old chunked data in PostgreSQL
      console.log("Storage bucket non trouvé ou vide, fallback vers la table Postgres...");
      const metaRes = await supabaseFetch('app_state?id=eq.chunk-meta&select=data,updated_at', { method: 'GET' });
      const metaRow = metaRes && metaRes.length > 0 ? metaRes[0] : null;
      
      if (metaRow && metaRow.data && metaRow.data.totalChunks) {
        const totalChunks = metaRow.data.totalChunks;
        const promises = [];
        for (let i = 0; i < totalChunks; i++) {
          promises.push(supabaseFetch(`app_state?id=eq.chunk-${i}&select=data`, { method: 'GET' }));
        }
        const results = await Promise.all(promises);
        let fullStr = '';
        for (let i = 0; i < totalChunks; i++) {
          const res = results[i];
          if (res && res.length > 0 && res[0].data && res[0].data.text) {
            fullStr += res[0].data.text;
          }
        }
        try {
          const parsed = JSON.parse(fullStr);
          if (parsed.mainDb) {
            parsed.mainDb.quotes = parsed.quotes || [];
            return { data: parsed.mainDb, updatedAt: metaRow.updated_at };
          }
        } catch(e) {
          console.error("Failed to parse chunked JSON", e);
        }
      }

      // 3. Fallback to old non-chunked method
      const [mainRes, quotesRes] = await Promise.all([
        supabaseFetch('app_state?id=eq.main-db&select=data,updated_at', { method: 'GET' }),
        supabaseFetch('app_state?id=eq.quotes-db&select=data,updated_at', { method: 'GET' })
      ]);
      const mainRowOld = mainRes && mainRes.length > 0 ? mainRes[0] : null;
      if (!mainRowOld || !mainRowOld.data) return { data: null, updatedAt: null };
      
      const mainData = mainRowOld.data;
      if (quotesRes && quotesRes.length > 0) {
        mainData.quotes = quotesRes[0].data || [];
      }
      return { data: mainData, updatedAt: mainRowOld.updated_at || null };
    } catch (e) {
      console.error("Failed to loadWithMeta from Supabase:", e);
      return { data: null, updatedAt: null };
    }
  },

  /**
   * Fetch only the Cloud updated_at timestamp (lightweight, no data transfer)
   * Returns ISO string or null
   */
  async getCloudTimestamp() {
    try {
      // 1. Check Storage Bucket meta first via public URL
      const t = Date.now();
      const { data: metaUrlData } = supabase.storage.from('app-state').getPublicUrl('meta.json');
      const response = await fetchWithTimeout(`${metaUrlData.publicUrl}?t=${t}`, {}, 15000); // 15s for meta
      if (response.ok) {
        const meta = await response.json();
        if (meta.updated_at) return meta.updated_at;
      }

      // 2. Check Postgres chunk-meta
      const metaRes = await supabaseFetch('app_state?id=eq.chunk-meta&select=updated_at', { method: 'GET' });
      if (metaRes && metaRes.length > 0) return metaRes[0].updated_at;

      // 3. Check old Postgres main-db
      const res = await supabaseFetch('app_state?id=eq.main-db&select=updated_at', { method: 'GET' });
      return res && res.length > 0 ? res[0].updated_at : null;
    } catch (e) {
      console.error("Failed to get cloud timestamp:", e);
      return null;
    }
  },

  /**
   * Save data to Cloud Storage Bucket with a shared timestamp.
   * Compares hashes of individual partitions and only uploads modified ones.
   */
  async save({ mainDb, quotes }) {
    const now = new Date().toISOString();
    
    try {
      const db = { ...mainDb };
      if (quotes) db.quotes = quotes;
      
      // Get current cloud meta first
      const t = Date.now();
      const bucket = supabase.storage.from('app-state');
      const { data: metaUrlData } = bucket.getPublicUrl('meta.json');
      let cloudMeta = null;
      try {
        const metaRes = await fetchWithTimeout(`${metaUrlData.publicUrl}?t=${t}`, {}, 15000);
        if (metaRes.ok) {
          cloudMeta = await metaRes.json();
          if (cloudMeta && cloudMeta.updated_at) {
            const cloudTime = new Date(cloudMeta.updated_at).getTime();
            const clientMaxTime = getClientMaxTime(db);
            // 5s clock skew safety buffer
            if (cloudTime > clientMaxTime + 5000) {
              console.warn(`⚠️ Aborting cloud snapshot save: Cloud snapshot is newer than client database (${new Date(cloudTime).toISOString()} > ${new Date(clientMaxTime).toISOString()}).`);
              return cloudMeta.updated_at;
            }
          }
        }
      } catch (e) {
        console.warn("Could not fetch current cloud meta.json for comparison, writing all partitions.");
      }
      
      const cloudHashes = cloudMeta?.hashes || {};
      const localHashes = {
        clients: [],
        orders: [],
        quotes: [],
        catalog: ''
      };
      
      // ─── A. Partition large collections into buckets ───
      for (const key of ['clients', 'orders', 'quotes']) {
        const numBuckets = PARTITIONS[key];
        const cloudBucketHashes = cloudHashes[key] || [];
        
        const localItems = db[key] || [];
        const activeItems = localItems.filter(item => item && !item._deleted); // Exclude soft-deleted items
        
        // Group active items by stable bucket index
        const buckets = Array.from({ length: numBuckets }, () => []);
        activeItems.forEach(item => {
          if (item && item.id) {
            const bucketIdx = getBucketIndex(item.id, numBuckets);
            buckets[bucketIdx].push(item);
          }
        });
        
        // Calculate hash and upload if modified
        for (let bucketIdx = 0; bucketIdx < numBuckets; bucketIdx++) {
          const bucketStr = JSON.stringify(buckets[bucketIdx]);
          const bucketHash = getHash(bucketStr);
          localHashes[key].push(bucketHash);
          
          const cloudBucketHash = cloudBucketHashes[bucketIdx];
          if (bucketHash !== cloudBucketHash) {
            console.log(`Uploading modified partition: ${key}/bucket-${bucketIdx}.json`);
            const blob = new Blob([bucketStr], { type: 'application/json' });
            const { error } = await bucket.upload(`${key}/bucket-${bucketIdx}.json`, blob, { 
              upsert: true,
              contentType: 'application/json'
            });
            if (error) throw error;
          }
        }
      }
      
      // ─── B. Upload/Sync catalog ───
      const catalogObj = {};
      for (const key of Object.keys(db)) {
        if (key !== 'clients' && key !== 'orders' && key !== 'quotes') {
          catalogObj[key] = db[key];
        }
      }
      const catalogStr = JSON.stringify(catalogObj);
      const catalogHash = getHash(catalogStr);
      localHashes.catalog = catalogHash;
      
      if (catalogHash !== cloudHashes.catalog) {
        console.log(`Uploading modified catalog.json`);
        const blob = new Blob([catalogStr], { type: 'application/json' });
        const { error } = await bucket.upload('catalog.json', blob, { 
          upsert: true,
          contentType: 'application/json'
        });
        if (error) throw error;
      }
      
      // ─── D. Update meta.json ───
      const metaObj = { 
        updated_at: now, 
        hashes: localHashes 
      };
      const metaBlob = new Blob([JSON.stringify(metaObj)], { type: 'application/json' });
      const { error: metaErr } = await bucket.upload('meta.json', metaBlob, { 
        upsert: true,
        contentType: 'application/json'
      });
      if (metaErr) throw metaErr;
      
      // Notify other devices in real-time about this full refresh
      try {
        await cloudSync.pushOps([{
          op: 'replace_key',
          collection: '_meta',
          id: 'force_refresh',
          data: now,
          timestamp: now,
          deviceId: getDeviceId()
        }]);
      } catch (err) {
        console.warn("Failed to push force_refresh notification:", err);
      }
      
      return now; // Return the timestamp used
    } catch (e) {
      console.error("Failed to save to Supabase Storage:", e);
      throw e;
    }
  }
};

export const cloudSync = {
  /**
   * Push a batch of operations to the Supabase operations_log table
   */
  async pushOps(ops) {
    if (!ops || ops.length === 0) return { success: true, applied: 0 };
    
    try {
      const rows = ops.map(op => ({
        op: op.op,
        collection: op.collection,
        doc_id: op.id,
        data: op.data,
        timestamp: op.timestamp,
        device_id: op.deviceId
      }));
      
      const { error } = await supabase.from('operations_log').insert(rows);
      if (error) throw error;
      return { success: true, applied: ops.length };
    } catch (e) {
      console.error("Failed to push ops to cloud:", e);
      return { success: false, queued: true };
    }
  },

  /**
   * Subscribe to real-time operations from other devices
   */
  subscribe(onOpsReceived, currentDeviceId) {
    const channel = supabase.channel('cloud-ops')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'operations_log' },
        (payload) => {
          const row = payload.new;
          // Ignore our own operations
          if (row.device_id === currentDeviceId) return;
          
          const op = {
            op: row.op,
            collection: row.collection,
            id: row.doc_id,
            data: row.data,
            timestamp: row.timestamp,
            deviceId: row.device_id
          };
          onOpsReceived([op]);
        }
      )
      .subscribe((status) => {
        console.log("Supabase Realtime Status:", status);
      });
      
    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Fetch missed operations since a given timestamp
   * Uses a fast 2-second timeout so the app doesn't hang on startup
   */
  async fetchOpsSince(timestampIso, currentDeviceId) {
    if (!timestampIso) return [];
    
    // Add a 2000ms timeout since this query can hang on large tables without index
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const { data, error } = await supabase
        .from('operations_log')
        .select('*')
        .gt('timestamp', timestampIso)
        .order('timestamp', { ascending: true })
        .abortSignal(controller.signal);
        
      clearTimeout(timeoutId);
      if (error) throw error;
      
      return data.map(row => ({
        op: row.op,
        collection: row.collection,
        id: row.doc_id,
        data: row.data,
        timestamp: row.timestamp,
        deviceId: row.device_id
      }));
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        console.warn("fetchOpsSince timed out after 2000ms (skipping to prevent hang)");
      } else {
        console.error("Failed to fetch ops since timestamp:", e);
      }
      return [];
    }
  }
};
