import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ttgtlitdbgioujgflaal.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0Z3RsaXRkYmdpb3VqZ2ZsYWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODU5NTgsImV4cCI6MjA5MTA2MTk1OH0.Ig6MuvUXOjE_F1q3phMiGYau0UJLzl9vwOwX5hLIRiw';

const mainDbPath = 'scratch/main-db-clean.json';
const quotesDbPath = 'scratch/quotes-db-clean.json';

async function restore() {
  console.log('Lecture des fichiers de sauvegarde nettoyés...');
  
  if (!fs.existsSync(mainDbPath)) {
    console.error(`Fichier manquant: ${mainDbPath}`);
    return;
  }
  if (!fs.existsSync(quotesDbPath)) {
    console.error(`Fichier manquant: ${quotesDbPath}`);
    return;
  }

  const mainDbData = JSON.parse(fs.readFileSync(mainDbPath, 'utf8'));
  const quotesDbData = JSON.parse(fs.readFileSync(quotesDbPath, 'utf8'));

  console.log(`Données chargées :`);
  console.log(`- Clients dans main-db : ${mainDbData.clients ? mainDbData.clients.length : 0}`);
  console.log(`- Devis dans quotes-db : ${quotesDbData.length}`);

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const now = new Date().toISOString();

  // 1. Sauvegarde de main-db via PATCH
  console.log("Envoi de 'main-db' à Supabase via PATCH (UPDATE)...");
  const mainPayload = {
    data: mainDbData,
    updated_at: now
  };
  
  let res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main-db`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(mainPayload)
  });

  if (!res.ok) {
    throw new Error(`Erreur lors du PATCH de main-db: ${res.status} - ${await res.text()}`);
  }
  console.log("✅ 'main-db' mis à jour avec succès.");

  // 2. Sauvegarde de quotes-db via PATCH
  console.log("Envoi de 'quotes-db' à Supabase via PATCH (UPDATE)...");
  const quotesPayload = {
    data: quotesDbData,
    updated_at: now
  };

  res = await fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.quotes-db`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(quotesPayload)
  });

  if (!res.ok) {
    throw new Error(`Erreur lors du PATCH de quotes-db: ${res.status} - ${await res.text()}`);
  }
  console.log("✅ 'quotes-db' mis à jour avec succès.");
  console.log("Restauration complète effectuée !");
}

restore().catch(console.error);
