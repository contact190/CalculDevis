import fs from 'fs';

try {
  const path6 = 'C:\\Users\\USER\\Downloads\\backup_devis_2026-07-06 (6).json';
  if (fs.existsSync(path6)) {
    console.log(`✅ File (6) exists. Size: ${fs.statSync(path6).size} bytes`);
  } else {
    console.log(`❌ File (6) does not exist at ${path6}`);
  }
} catch (e) {
  console.error("Error checking file (6):", e.message);
}

try {
  const path5 = 'C:\\Users\\USER\\Downloads\\backup_devis_2026-07-06 (5).json';
  if (fs.existsSync(path5)) {
    console.log(`✅ File (5) exists in Downloads. Size: ${fs.statSync(path5).size} bytes`);
  } else {
    console.log(`❌ File (5) does not exist in Downloads.`);
  }
} catch (e) {
  console.error("Error checking file (5):", e.message);
}
