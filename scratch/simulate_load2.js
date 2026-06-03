const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

const DEFAULT_DATA = { clients: [], quotes: [], orders: [] };

function repairDatabase(db) {
    if (!db) return DEFAULT_DATA;
    const repaired = { ...db };
    Object.keys(DEFAULT_DATA).forEach(key => {
      if (repaired[key] === undefined || repaired[key] === null) {
        repaired[key] = DEFAULT_DATA[key];
      }
      if (Array.isArray(repaired[key])) {
        const seen = new Set();
        repaired[key] = repaired[key].filter(item => {
          if (!item) return false;
          const id = item.id || JSON.stringify(item);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      }
    });
    if (repaired.clients) {
      repaired.clients = repaired.clients.map(c => {
        let updated = { ...c };
        if (updated.sitePlan && !updated.sitePlans) {
          updated.sitePlans = [{ ...updated.sitePlan, id: 'plan-default', name: 'Plan Principal' }];
          delete updated.sitePlan;
        } else if (!updated.sitePlans) {
          updated.sitePlans = [];
        }
        return updated;
      });
    }
    if (repaired.quotes) {
      repaired.quotes = repaired.quotes.map(q => {
        let updated = { ...q };
        if (q.products && !q.items) updated.items = q.products;
        return updated;
      });
    }
    if (!repaired.orders) repaired.orders = [];
    if (!repaired.quotes) repaired.quotes = [];
    return repaired;
}

async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  const response = await fetch(url, { ...options, headers });
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function simulate() {
  const [mainRes, quotesRes] = await Promise.all([
    supabaseFetch('app_state?id=eq.main-db', { method: 'GET' }),
    supabaseFetch('app_state?id=eq.quotes-db', { method: 'GET' })
  ]);
  const mainRow = mainRes && mainRes.length > 0 ? mainRes[0] : null;
  const quotesRow = quotesRes && quotesRes.length > 0 ? quotesRes[0] : null;

  const mainData = mainRow ? mainRow.data : null;
  if (mainData && quotesRow) {
     mainData.quotes = quotesRow.data || [];
  }
  
  const cloudData = repairDatabase(mainData);
  console.log("cloudData has quotes?", !!cloudData.quotes);
  console.log("cloudData.quotes is array?", Array.isArray(cloudData.quotes));
  console.log("cloudData.quotes length:", cloudData.quotes ? cloudData.quotes.length : 0);
}

simulate().catch(console.error);
