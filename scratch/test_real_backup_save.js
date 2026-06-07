import fs from 'fs';

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

async function testSave() {
  const path = './backup_devis_2026-06-03 (6).json';
  const rawData = JSON.parse(fs.readFileSync(path, 'utf8'));

  const { quotes, ...mainDb } = rawData;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  const now = new Date().toISOString();

  console.log("Saving main-db, size:", JSON.stringify(mainDb).length);
  try {
    const resMain = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'main-db', data: mainDb, updated_at: now })
    });
    if (!resMain.ok) {
      console.error("main-db save failed:", resMain.status, await resMain.text());
    } else {
      console.log("main-db save success!");
    }
  } catch (e) {
    console.error("main-db fetch error:", e);
  }

  console.log("Saving quotes-db, size:", JSON.stringify(quotes).length);
  try {
    const resQuotes = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: 'quotes-db', data: quotes || [], updated_at: now })
    });
    if (!resQuotes.ok) {
      console.error("quotes-db save failed:", resQuotes.status, await resQuotes.text());
    } else {
      console.log("quotes-db save success!");
    }
  } catch (e) {
    console.error("quotes-db fetch error:", e);
  }
}

testSave().catch(console.error);
