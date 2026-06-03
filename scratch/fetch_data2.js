const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

async function test() {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const resQuotes = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.quotes-db`, { headers });
  const quotes = await resQuotes.json();
  if (quotes.length > 0) {
    const data = quotes[0].data;
    console.log("Quotes array:", Array.isArray(data));
    console.log("First quote keys:", data.length > 0 ? Object.keys(data[0]) : "No quotes");
    if (data.length > 0) console.log("First quote ID:", data[0].id, "clientId:", data[0].clientId);
  }
}

test().catch(console.error);
