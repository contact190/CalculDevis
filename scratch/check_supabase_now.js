const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

async function test() {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const [mainRes, quotesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main-db`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.quotes-db`, { headers })
  ]);
  
  const main = await mainRes.json();
  const quotes = await quotesRes.json();

  console.log("main-db updatedAt:", main[0]?.updated_at);
  console.log("quotes-db updatedAt:", quotes[0]?.updated_at);
  
  const clients = main[0]?.data?.clients || [];
  const qList = quotes[0]?.data || [];
  
  console.log(`Clients count: ${clients.length}`);
  console.log(`Quotes count: ${qList.length}`);
}

test().catch(console.error);
