const fs = require('fs');
const path = require('path');

function processFile(filePath, isTechnician) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Insert actualShutter definition near previewConfig
  const previewConfigIndex = content.indexOf('const previewConfig = {');
  if (previewConfigIndex !== -1) {
    const insertStr = `
                                const actualShutter = v.shutter !== undefined ? v.shutter : (item.config.hasShutter ? { qty: 1, customLV: '', overrides: {} } : null);
                                const isShutterActive = actualShutter !== null;\n`;
    content = content.slice(0, previewConfigIndex) + insertStr + content.slice(previewConfigIndex);
  }

  // Find the block for shutter configuration
  const startMarker = isTechnician 
    ? '{/* Shutter Toggle Section */}' 
    : '{/* Inline Shutter Configuration */}';
  
  const blockStart = content.indexOf(startMarker);
  if (blockStart === -1) {
    console.error(`Marker not found in ${filePath}`);
    return;
  }

  // End of block
  const actionsFooterIndex = content.indexOf('{/* Actions Footer */}', blockStart);
  let blockEnd = actionsFooterIndex !== -1 ? actionsFooterIndex : content.length;
  if (isTechnician) {
      const formButtonsIndex = content.indexOf('{/* Action Buttons */}', blockStart);
      if (formButtonsIndex !== -1) blockEnd = formButtonsIndex;
      else {
         const mNote = content.indexOf('{/* Measurements Note */}', blockStart);
         if(mNote !== -1) blockEnd = mNote;
      }
  }

  let sectionContent = content.substring(blockStart, blockEnd);

  // Replace v.shutter with actualShutter
  sectionContent = sectionContent
    .replace(/const hasShutter = !!v\.shutter;/g, '')
    .replace(/hasShutter \? null/g, 'isShutterActive ? null')
    .replace(/background: v\.shutter \?/g, 'background: isShutterActive ?')
    .replace(/color: v\.shutter \?/g, 'color: isShutterActive ?')
    .replace(/\{v\.shutter \?/g, '{isShutterActive ?')
    .replace(/\{v\.shutter && \(/g, '{isShutterActive && (')
    .replace(/v\.shutter\./g, 'actualShutter.');

  content = content.substring(0, blockStart) + sectionContent + content.substring(blockEnd);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${filePath}`);
}

processFile(path.join(__dirname, '../src/modules/orders/OrdersModule.jsx'), false);
processFile(path.join(__dirname, '../src/modules/orders/TechnicianPortal.jsx'), true);
