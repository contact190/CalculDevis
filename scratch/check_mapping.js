const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

async function test() {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const resMain = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main-db`, { headers });
  const main = await resMain.json();
  const clients = main[0].data.clients || [];

  const resQuotes = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.quotes-db`, { headers });
  const quotesRes = await resQuotes.json();
  const quotes = quotesRes[0].data || [];

  console.log(`Total clients: ${clients.length}`);
  console.log(`Total quotes: ${quotes.length}`);
  
  const quotesWithValidClient = quotes.filter(q => clients.some(c => c.id === q.clientId));
  console.log(`Quotes mapped to existing clients: ${quotesWithValidClient.length}`);

  // List quotes and their clientIds
  console.log(quotes.map(q => ({ qId: q.id, cId: q.clientId })).slice(0, 5));
}

test().catch(console.error);
