import fs from 'fs';

const db = JSON.parse(fs.readFileSync('./local-server/database.json', 'utf8'));
console.log("All traverses:", db.traverses.map(t => ({ id: t.id, name: t.name, role: t.role, thickness: t.thickness, profileId: t.profileId })));
const p = db.profiles.find(px => px.id === '2BF5254525');
console.log("Profile 2BF5254525:", p);
