const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

async function test() {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  // Generate 2MB of quotes
  const largeQuotes = [];
  for(let i=0; i<100; i++) {
    largeQuotes.push({ id: `Q-${i}`, data: "A".repeat(20000) }); // 20KB per quote = 2MB total
  }

  const body = JSON.stringify({ id: 'quotes-db', data: largeQuotes, updated_at: new Date().toISOString() });
  console.log("Payload size:", body.length);
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
    method: 'POST',
    headers,
    body
  });
  
  if (!res.ok) {
    console.error("Failed:", res.status, await res.text());
  } else {
    console.log("Success");
  }
}

test().catch(console.error);
