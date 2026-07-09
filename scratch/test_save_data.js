import fs from 'fs';
import { syncDatabase } from '../src/utils/supabaseClient.js';

async function testSave() {
  console.log("Loading optimized backup...");
  const data = JSON.parse(fs.readFileSync('backup_devis_optimized.json', 'utf8'));
  
  // Reconstruct database
  let db = data;
  if (data.data && data.version) {
    db = data.data;
  }
  
  const mainDb = { ...db };
  const quotes = mainDb.quotes || [];
  delete mainDb.quotes;
  
  console.log(`Triggering syncDatabase.save with ${quotes.length} quotes, ${mainDb.clients?.length || 0} clients, ${mainDb.orders?.length || 0} orders...`);
  try {
    const timestamp = await syncDatabase.save({ mainDb, quotes });
    console.log("✅ Success! Timestamp:", timestamp);
  } catch (e) {
    console.error("❌ Save failed with error:", e);
  }
}

testSave().catch(console.error);
