import fs from 'fs';

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

async function fetchFromSupabase(endpoint) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  return response.json();
}

async function run() {
  console.log("Fetching database...");
  try {
    const main = await fetchFromSupabase('app_state?id=eq.main-db');
    const quotes = await fetchFromSupabase('app_state?id=eq.quotes-db');
    
    fs.writeFileSync('scratch/main-db.json', JSON.stringify(main[0]?.data, null, 2));
    fs.writeFileSync('scratch/quotes-db.json', JSON.stringify(quotes[0]?.data, null, 2));
    console.log("Successfully fetched database and written to scratch/main-db.json and scratch/quotes-db.json!");
  } catch (e) {
    console.error("Error fetching data:", e);
  }
}

run();
