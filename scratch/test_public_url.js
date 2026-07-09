import { supabase } from '../src/utils/supabaseClient.js';

async function test() {
  const bucket = supabase.storage.from('app-state');
  const { data: metaUrlData } = bucket.getPublicUrl('meta.json');
  console.log("Public URL:", metaUrlData.publicUrl);
  
  try {
    const res = await fetch(metaUrlData.publicUrl);
    if (res.ok) {
      const text = await res.text();
      console.log("✅ Success! Public read works without headers. Content:", text);
    } else {
      console.error(`❌ Failed to read public URL: status ${res.status} - ${await res.text()}`);
    }
  } catch (e) {
    console.error("❌ Network error fetching public URL:", e.message);
  }
}

test();
