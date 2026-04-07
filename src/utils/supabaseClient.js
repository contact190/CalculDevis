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

export const syncDatabase = {
  async load() {
    try {
      const data = await supabaseFetch('app_state?id=eq.main-db', { method: 'GET' });
      return data && data.length > 0 ? data[0].data : null;
    } catch (e) {
      console.error("Failed to load from Supabase:", e);
      return null;
    }
  },
  async save(dbData) {
    try {
      await supabaseFetch('app_state', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ id: 'main-db', data: dbData, updated_at: new Date().toISOString() })
      });
      return true;
    } catch (e) {
      console.error("Failed to save to Supabase:", e);
      return false;
    }
  }
};
