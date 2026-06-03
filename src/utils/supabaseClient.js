const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

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
    try {
      const [mainRes, quotesRes] = await Promise.all([
         supabaseFetch('app_state?id=eq.main-db', { method: 'GET' }),
         supabaseFetch('app_state?id=eq.quotes-db', { method: 'GET' })
      ]);
      const mainData = mainRes && mainRes.length > 0 ? mainRes[0].data : null;
      if (mainData && quotesRes && quotesRes.length > 0) {
         mainData.quotes = quotesRes[0].data || [];
      }
      return mainData;
    } catch (e) {
      console.error("Failed to load from Supabase:", e);
      return null;
    }
  },

  /**
   * Load data + its updated_at timestamp from Cloud
   * Returns { data, updatedAt } or { data: null, updatedAt: null }
   */
  async loadWithMeta() {
    try {
      const [mainRes, quotesRes] = await Promise.all([
        supabaseFetch('app_state?id=eq.main-db&select=data,updated_at', { method: 'GET' }),
        supabaseFetch('app_state?id=eq.quotes-db&select=data,updated_at', { method: 'GET' })
      ]);
      const mainRow = mainRes && mainRes.length > 0 ? mainRes[0] : null;
      if (!mainRow || !mainRow.data) return { data: null, updatedAt: null };
      
      const mainData = mainRow.data;
      if (quotesRes && quotesRes.length > 0) {
        mainData.quotes = quotesRes[0].data || [];
      }
      return { data: mainData, updatedAt: mainRow.updated_at || null };
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
      const res = await supabaseFetch('app_state?id=eq.main-db&select=updated_at', { method: 'GET' });
      return res && res.length > 0 ? res[0].updated_at : null;
    } catch (e) {
      console.error("Failed to get cloud timestamp:", e);
      return null;
    }
  },

  /**
   * Save data to Cloud with a shared timestamp
   */
  async save({ mainDb, quotes }) {
    const now = new Date().toISOString();
    try {
      await Promise.all([
        supabaseFetch('app_state', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ id: 'main-db', data: mainDb, updated_at: now })
        }),
        supabaseFetch('app_state', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ id: 'quotes-db', data: quotes || [], updated_at: now })
        })
      ]);
      return now; // Return the timestamp used
    } catch (e) {
      console.error("Failed to save to Supabase:", e);
      throw e;
    }
  }
};
