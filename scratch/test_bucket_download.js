import { supabase } from '../src/utils/supabaseClient.js';

async function test() {
  console.log("Downloading meta.json from storage...");
  const { data, error } = await supabase.storage.from('app-state').download('meta.json');
  if (error) {
    console.error("❌ Error downloading meta.json:", error);
  } else {
    const text = await data.text();
    console.log("✅ Success! meta.json content:", text);
  }
}

test().catch(console.error);
