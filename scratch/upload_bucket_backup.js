import fs from 'fs';
import { supabase } from '../src/utils/supabaseClient.js';

async function run() {
  try {
    console.log("Reading backup file...");
    const raw = fs.readFileSync('backup_devis_optimized.json', 'utf8');
    const parsed = JSON.parse(raw);
    
    let mainDb = parsed.mainDb ? parsed.mainDb : parsed;
    let quotes = parsed.quotes ? parsed.quotes : (mainDb.quotes || []);
    
    if (mainDb.quotes) {
      delete mainDb.quotes;
    }
    
    console.log(`Backup loaded:`);
    console.log(`- Main DB keys: ${Object.keys(mainDb).join(', ')}`);
    console.log(`- Quotes count: ${quotes.length}`);
    
    // Create payload
    const fullJson = JSON.stringify({ mainDb, quotes });
    const MAX_CHUNK_LENGTH = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(fullJson.length / MAX_CHUNK_LENGTH);
    
    console.log(`Total payload size: ${Math.round(fullJson.length / 1024 / 1024)} MB`);
    console.log(`Uploading to bucket 'app-state' in ${totalChunks} chunks...`);
    
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkStr = fullJson.substring(i * MAX_CHUNK_LENGTH, (i + 1) * MAX_CHUNK_LENGTH);
      const buffer = Buffer.from(chunkStr, 'utf8');
      
      let uploadSuccess = false;
      let attempts = 5;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        console.log(`Uploading chunk ${i + 1} of ${totalChunks} (Attempt ${attempt}/${attempts})...`);
        try {
          const { data, error } = await supabase.storage.from('app-state').upload(`chunk-${i}.json`, buffer, { 
            upsert: true,
            contentType: 'application/json'
          });
          
          if (error) throw error;
          console.log(`✅ Chunk ${i + 1} uploaded.`);
          uploadSuccess = true;
          break;
        } catch (err) {
          console.error(`⚠️ Chunk ${i + 1} failed: ${err.message || JSON.stringify(err)}`);
          if (attempt < attempts) {
            const delay = attempt * 2000;
            console.log(`Retrying chunk ${i + 1} in ${delay / 1000}s...`);
            await sleep(delay);
          } else {
            throw new Error(`Failed uploading chunk ${i} after ${attempts} attempts`);
          }
        }
      }
    }
    
    // Future date to force absolute priority on client load
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2); // 2 days in the future
    const now = futureDate.toISOString();
    
    console.log(`Uploading meta.json with timestamp: ${now}...`);
    const metaObj = { totalChunks, updated_at: now };
    const metaBuffer = Buffer.from(JSON.stringify(metaObj), 'utf8');
    
    const { error: metaErr } = await supabase.storage.from('app-state').upload('meta.json', metaBuffer, { 
      upsert: true,
      contentType: 'application/json'
    });
    
    if (metaErr) {
      throw new Error(`Failed uploading meta.json: ${JSON.stringify(metaErr)}`);
    }
    
    console.log(`🎉 Success! Upload completed. Timestamp used: ${now}`);
  } catch (e) {
    console.error("❌ Restore script failed:", e);
  }
}

run();
