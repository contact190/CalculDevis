import fs from 'fs';
import path from 'path';

const tpPath = path.resolve('src/modules/orders/TechnicianPortal.jsx');
const omPath = path.resolve('src/modules/orders/OrdersModule.jsx');
const cmPath = path.resolve('src/modules/commercial/CommercialModule.jsx');

// 1. Update TechnicianPortal.jsx
let tpContent = fs.readFileSync(tpPath, 'utf8');
const targetTp = `const isMotor = selectedKit?.type === 'MOTEUR';`;
const replacementTp = `const isMotor = selectedKit?.type === 'MOTEUR' || 
                                            selectedKitId.toLowerCase().includes('mote') || 
                                            selectedKit?.name?.toLowerCase().includes('moteur');`;

if (tpContent.includes(targetTp)) {
  tpContent = tpContent.replace(targetTp, replacementTp);
  fs.writeFileSync(tpPath, tpContent, 'utf8');
  console.log('TechnicianPortal.jsx updated successfully!');
} else {
  console.log('Target string not found in TechnicianPortal.jsx or already updated');
}

// 2. Update OrdersModule.jsx
let omContent = fs.readFileSync(omPath, 'utf8');
const targetOm = `const isMotor = selectedKit?.type === 'MOTEUR';`;
const replacementOm = `const isMotor = selectedKit?.type === 'MOTEUR' || 
                                               selectedKitId.toLowerCase().includes('mote') || 
                                               selectedKit?.name?.toLowerCase().includes('moteur');`;

if (omContent.includes(targetOm)) {
  omContent = omContent.replace(targetOm, replacementOm);
  fs.writeFileSync(omPath, omContent, 'utf8');
  console.log('OrdersModule.jsx updated successfully!');
} else {
  console.log('Target string not found in OrdersModule.jsx or already updated');
}

// 3. Update CommercialModule.jsx
let cmContent = fs.readFileSync(cmPath, 'utf8');
const targetCm = `if (!selectedKit || selectedKit.type !== 'MOTEUR') return null;`;
const replacementCm = `const isMotor = selectedKit?.type === 'MOTEUR' || 
                                            (selectedKitId || '').toLowerCase().includes('mote') || 
                                            selectedKit?.name?.toLowerCase().includes('moteur');
                    if (!selectedKit || !isMotor) return null;`;

if (cmContent.includes(targetCm)) {
  cmContent = cmContent.replace(targetCm, replacementCm);
  fs.writeFileSync(cmPath, cmContent, 'utf8');
  console.log('CommercialModule.jsx updated successfully!');
} else {
  console.log('Target string not found in CommercialModule.jsx or already updated');
}
