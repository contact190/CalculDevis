import { supabase } from '../src/utils/supabaseClient.js';

async function listFiles() {
  console.log("Listing files in storage bucket 'app-state'...");
  const { data, error } = await supabase.storage.from('app-state').list();
  if (error) {
    console.error("❌ Error listing files:", error);
  } else {
    console.log("✅ Success! Files:");
    for (const f of data) {
      console.log(`- ${f.name} (size: ${(f.metadata?.size / 1024).toFixed(1)} KB, created: ${f.created_at})`);
    }
  }
}

listFiles().catch(console.error);
