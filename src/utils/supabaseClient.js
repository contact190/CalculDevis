import { createClient } from '@supabase/supabase-js';
import { persistentStorage } from './storage.js';

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
        
        const localHashes = {
          clients: getHash(JSON.stringify(localSegments.clients)),
          orders: getHash(JSON.stringify(localSegments.orders)),
          quotes: getHash(JSON.stringify(localSegments.quotes)),
          catalog: getHash(JSON.stringify(localSegments.catalog))
        };
        
        const db = localDb ? { ...localDb } : {};
        const downloadPromises = [];
        const keysToDownload = [];
        
        for (const key of ['clients', 'orders', 'quotes', 'catalog']) {
          if (!localDb || localHashes[key] !== cloudHashes[key]) {
            keysToDownload.push(key);
            const { data: urlData } = bucket.getPublicUrl(`${key}.json`);
            downloadPromises.push(
              fetchWithTimeout(`${urlData.publicUrl}?t=${t}`, {}, 60000).then(res => { // 60s timeout for segments
                if (!res.ok) throw new Error(`Failed to download segment ${key}`);
                return res.json();
              })
            );
          } else {
            console.log(`Segment ${key} is up to date locally, skipping download.`);
          }
        }
        
        if (keysToDownload.length > 0) {
          console.log(`Downloading ${keysToDownload.length} modified segments:`, keysToDownload);
          const downloadedData = await Promise.all(downloadPromises);
          
          for (let i = 0; i < keysToDownload.length; i++) {
            const key = keysToDownload[i];
            const val = downloadedData[i];
            if (key === 'catalog') {
              Object.assign(db, val);
            } else {
              db[key] = val;
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
   * Compares hashes with cloud and only uploads segments that actually changed.
   */
  async save({ mainDb, quotes }) {
    const now = new Date().toISOString();
    
    try {
      const db = { ...mainDb };
      if (quotes) db.quotes = quotes;
      
      const segments = {
        clients: JSON.stringify(db.clients || []),
        orders: JSON.stringify(db.orders || []),
        quotes: JSON.stringify(db.quotes || []),
        catalog: ''
      };
      
      const catalogObj = {};
      for (const key of Object.keys(db)) {
        if (key !== 'clients' && key !== 'orders' && key !== 'quotes') {
          catalogObj[key] = db[key];
        }
      }
      segments.catalog = JSON.stringify(catalogObj);
      
      const localHashes = {
        clients: getHash(segments.clients),
        orders: getHash(segments.orders),
        quotes: getHash(segments.quotes),
        catalog: getHash(segments.catalog)
      };
      
      // Get current cloud hashes first
      const t = Date.now();
      const bucket = supabase.storage.from('app-state');
      const { data: metaUrlData } = bucket.getPublicUrl('meta.json');
      let cloudMeta = null;
      try {
        const metaRes = await fetchWithTimeout(`${metaUrlData.publicUrl}?t=${t}`, {}, 5000);
        if (metaRes.ok) {
          cloudMeta = await metaRes.json();
        }
      } catch (e) {
        console.warn("Could not fetch current cloud meta.json for comparison, writing all segments.");
      }
      
      const cloudHashes = cloudMeta?.hashes || {};
      
      for (const key of ['clients', 'orders', 'quotes', 'catalog']) {
        if (localHashes[key] !== cloudHashes[key]) {
          console.log(`Uploading modified segment to storage: ${key}.json`);
          const blob = new Blob([segments[key]], { type: 'application/json' });
          const { error } = await bucket.upload(`${key}.json`, blob, { 
            upsert: true,
            contentType: 'application/json'
          });
          if (error) throw error;
        } else {
          console.log(`Segment ${key}.json is identical to cloud, skipping upload.`);
        }
      }
      
      // Update meta.json with the new hashes and timestamp
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
   */
  async fetchOpsSince(timestampIso, currentDeviceId) {
    if (!timestampIso) return [];
    try {
      const { data, error } = await supabase
        .from('operations_log')
        .select('*')
        .gt('timestamp', timestampIso)
        .neq('device_id', currentDeviceId)
        .order('timestamp', { ascending: true });
        
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
      console.error("Failed to fetch ops since timestamp:", e);
      return [];
    }
  }
};
