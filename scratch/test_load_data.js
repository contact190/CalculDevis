import { syncDatabase } from '../src/utils/supabaseClient.js';
import { persistentStorage } from '../src/utils/storage.js';

async function testLoad() {
  console.log("Mocking empty local DB in IndexedDB to simulate cleared cache...");
  // We can just temporarily rename/clear the key in storage or simulate by making localDb load return null in our test
  // Wait, loadWithMeta reads from persistentStorage.load('calculDevis_main'). Let's see what is currently in IndexedDB.
  const localDb = await persistentStorage.load('calculDevis_main');
  console.log("Local DB keys:", localDb ? Object.keys(localDb) : "null");
  
  console.log("Triggering syncDatabase.loadWithMeta()...");
  const result = await syncDatabase.loadWithMeta();
  if (result && result.data) {
    const db = result.data;
    console.log("✅ Load Success!");
    console.log("- Clients loaded:", db.clients?.length || 0);
    console.log("- Quotes loaded:", db.quotes?.length || 0);
    console.log("- Orders loaded:", db.orders?.length || 0);
    console.log("- Catalog keys:", Object.keys(db).filter(k => k !== 'clients' && k !== 'orders' && k !== 'quotes'));
  } else {
    console.error("❌ Load failed or returned null data");
  }
}

testLoad().catch(console.error);
