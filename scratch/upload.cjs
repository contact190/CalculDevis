const fs = require('fs');

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function supabaseFetch(endpoint, options = {}, retries = 10) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase Error: ${response.status} - ${text}`);
      }
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = attempt * 2000;
      console.log(`Erreur rencontrée (${err.message}). Retentative ${attempt}/${retries} dans ${delay/1000}s...`);
      await sleep(delay);
    }
  }
}

async function uploadFile() {
  console.log("Lecture du fichier...");
  const rawData = fs.readFileSync('backup_devis_2026-06-30 (1).json', 'utf8');
  const fileData = JSON.parse(rawData);
  
  let mainDb = fileData.mainDb ? fileData.mainDb : fileData;
  let quotes = fileData.quotes ? fileData.quotes : (mainDb.quotes || []);
  
  if (mainDb.quotes) {
    delete mainDb.quotes;
  }
  
  // Date dans le futur pour forcer la priorité absolue sur le cache local
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  const now = futureDate.toISOString();
  
  console.log("Formatage JSON...");
  const fullJson = JSON.stringify({ mainDb, quotes });
  
  const MAX_CHUNK_LENGTH = 1000000; // 1MB chunks
  const totalChunks = Math.ceil(fullJson.length / MAX_CHUNK_LENGTH);
  
  console.log(`Taille totale: ${Math.round(fullJson.length / 1024 / 1024)} MB`);
  console.log(`Envoi complet de ${totalChunks} morceaux...`);

  for (let i = 0; i < totalChunks; i++) {
    console.log(`Upload chunk ${i + 1}/${totalChunks}...`);
    const chunkStr = fullJson.substring(i * MAX_CHUNK_LENGTH, (i + 1) * MAX_CHUNK_LENGTH);
    await supabaseFetch('app_state', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: `chunk-${i}`, data: { text: chunkStr }, updated_at: now })
    });
  }

  console.log("Enregistrement des meta données...");
  await supabaseFetch('app_state', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 'chunk-meta', data: { totalChunks }, updated_at: now })
  });
  
  console.log("✅ Terminé avec succès !");
}

uploadFile().catch(e => {
  console.error(e);
  process.exit(1);
});
