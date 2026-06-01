import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/main-db.json', 'utf8'));
const traverses = data.traverses || [];
const profiles = data.profiles || [];

console.log("=== Traverses in main-db.json ===");
traverses.forEach(t => {
  console.log(`- ID: ${t.id}, name: ${t.name}, role: ${t.role}, type: ${t.type}, profileId: ${t.profileId}`);
  console.log(`  rangeIds:`, t.rangeIds);
  const p = profiles.find(pr => pr.id === t.profileId);
  if (p) {
    console.log(`  Matching Profile: ID=${p.id}, name=${p.name}, reference=${p.reference}`);
  } else {
    console.log(`  No matching profile found for profileId: ${t.profileId}`);
  }
});
