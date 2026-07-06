import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const supabaseFetch = async (endpoint, options = {}) => {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
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
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Function Error: ${response.status}`);
  return response.json();
};

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
      const { data: metaData, error: metaErr } = await supabase.storage.from('app-state').download('meta.json');
      if (!metaErr && metaData) {
        const metaStr = await metaData.text();
        const meta = JSON.parse(metaStr);
        
        if (meta.totalChunks) {
          const promises = [];
          for (let i = 0; i < meta.totalChunks; i++) {
            promises.push(supabase.storage.from('app-state').download(`chunk-${i}.json`));
          }
          
          const results = await Promise.all(promises);
          let fullStr = '';
          
          for (let i = 0; i < meta.totalChunks; i++) {
            const { data, error } = results[i];
            if (error || !data) throw new Error(`Missing chunk ${i}`);
            fullStr += await data.text();
          }
          
          const parsed = JSON.parse(fullStr);
          if (parsed.mainDb) {
            parsed.mainDb.quotes = parsed.quotes || [];
            return { data: parsed.mainDb, updatedAt: meta.updated_at };
          }
        }
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
      // 1. Check Storage Bucket meta first
      const { data, error } = await supabase.storage.from('app-state').download('meta.json');
      if (data && !error) {
        const metaStr = await data.text();
        const meta = JSON.parse(metaStr);
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
   * Splits large payload into ~45MB chunks to easily fit the 50MB free tier limit.
   */
  async save({ mainDb, quotes }) {
    const now = new Date().toISOString();
    
    try {
      const fullJson = JSON.stringify({ mainDb, quotes });
      const MAX_CHUNK_LENGTH = 45 * 1024 * 1024; // 45MB per chunk
      const totalChunks = Math.ceil(fullJson.length / MAX_CHUNK_LENGTH);
      
      const requests = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkStr = fullJson.substring(i * MAX_CHUNK_LENGTH, (i + 1) * MAX_CHUNK_LENGTH);
        const blob = new Blob([chunkStr], { type: 'application/json' });
        requests.push(
          supabase.storage.from('app-state').upload(`chunk-${i}.json`, blob, { 
            upsert: true,
            contentType: 'application/json'
          })
        );
      }
      
      // Wait for all chunks to upload
      await Promise.all(requests);
      
      // Save metadata last so load doesn't trigger prematurely
      const metaObj = { totalChunks, updated_at: now };
      const metaBlob = new Blob([JSON.stringify(metaObj)], { type: 'application/json' });
      await supabase.storage.from('app-state').upload('meta.json', metaBlob, { 
        upsert: true,
        contentType: 'application/json'
      });
      
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
