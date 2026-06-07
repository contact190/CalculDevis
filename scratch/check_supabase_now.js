// Using native fetch

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

const supabaseFetch = async (endpoint) => {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
  const res = await fetch(url, { headers });
  return res.json();
};

async function main() {
  const rows = await supabaseFetch('app_state');
  console.log('Nombre de lignes:', rows.length);
  for (const row of rows) {
    console.log(`- ID: ${row.id}, updated_at: ${row.updated_at}`);
    if (row.id === 'quotes-db') {
      console.log(`  Nombre d'éléments dans quotes-db:`, Array.isArray(row.data) ? row.data.length : typeof row.data);
      if (Array.isArray(row.data) && row.data.length > 0) {
        console.log(`  Premier devis:`, JSON.stringify(row.data[0]).substring(0, 100));
      }
    } else if (row.id === 'main-db') {
      console.log(`  Nombre de clients dans main-db:`, row.data?.clients?.length);
      console.log(`  Présence de quotes dans main-db:`, 'quotes' in row.data);
    }
  }
}

main().catch(console.error);
