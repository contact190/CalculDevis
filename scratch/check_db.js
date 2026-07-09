import fs from 'fs';

try {
  const data = JSON.parse(fs.readFileSync('local-server/database.json', 'utf8'));
  console.log("Total orders:", data.orders?.length || 0);
  if (data.orders) {
    data.orders.forEach(o => {
      console.log(`Order ID: ${o.id}, Status: ${o.status}, Batches: ${o.batches?.length || 0}`);
      if (o.batches) {
        o.batches.forEach(b => {
          console.log(`  Batch ID: ${b.id}, Name: ${b.name}, CreatedAt: ${b.createdAt}, Items count: ${b.items?.length || 0}`);
        });
      }
    });
  }
} catch (e) {
  console.error("Error reading database:", e);
}
