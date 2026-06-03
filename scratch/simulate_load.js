const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`Supabase Error: ${response.status}`);
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
  
  console.log("mainData has quotes?", !!mainData.quotes);
  console.log("mainData.quotes is array?", Array.isArray(mainData.quotes));
  console.log("mainData.quotes length:", mainData.quotes ? mainData.quotes.length : 0);
}

simulate().catch(console.error);
