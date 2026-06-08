const fs = require('fs');
const path = require('path');

function processFile(filePath, isTechnician) {
  let content = fs.readFileSync(filePath, 'utf8');

  const startMarker = isTechnician 
    ? '{/* Shutter Toggle Section */}' 
    : '{/* Inline Shutter Configuration */}';
  
  const blockStart = content.indexOf(startMarker);
  if (blockStart === -1) {
    console.error(`Marker not found in ${filePath}`);
    return;
  }

  // Find the end of the block (the closing div for this section)
  // For OrdersModule: `</div>\n\n                                      {/* Actions Footer */}`
  // For TechnicianPortal: `</div>\n\n                                  {/* Measurements Note */}` or similar.
  const actionsFooterIndex = content.indexOf('{/* Actions Footer */}', blockStart);
  let blockEnd = actionsFooterIndex !== -1 ? actionsFooterIndex : content.length;
  
  if (isTechnician) {
      const formButtonsIndex = content.indexOf('{/* Action Buttons */}', blockStart);
      if (formButtonsIndex !== -1) blockEnd = formButtonsIndex;
  }

  // We actually just want to replace inside the shutter section.
  const sectionContent = content.substring(blockStart, blockEnd);

  let newSectionContent = sectionContent
    // Wrap the inner part of the div in an IIFE
    .replace(
      /(<div style=\{\{ background: '[^']+', padding: '[^']+', borderRadius: '[^']+', border: '[^']+'(?:, marginBottom: '[^']+')? \}\}>\s*)<div style=\{\{ display: 'flex', justifyContent: 'space-between'/,
      `$1{(() => {\nconst actualShutter = v.shutter !== undefined ? v.shutter : (item.config.hasShutter ? { qty: 1, customLV: '', overrides: {} } : null);\nconst isShutterActive = actualShutter !== null;\nreturn (\n<>\n<div style={{ display: 'flex', justifyContent: 'space-between'`
    )
    // Replace the button onClick logic
    .replace(
      /const hasShutter = !!v\.shutter;\s*updateVoidProperty\(floor\.id, apt\.id, v\.id, 'shutter', hasShutter \? null : \{ qty: 1, customLV: v\.L \|\| item\.config\.L, overrides: \{\} \}\);/,
      `updateVoidProperty(floor.id, apt.id, v.id, 'shutter', isShutterActive ? null : { qty: 1, customLV: v.L || item.config.L, overrides: {} });`
    )
    // Replace v.shutter ? ... : ... with isShutterActive ? ... : ...
    .replace(/v\.shutter \? ([^:]+) : ([^,]+),/g, 'isShutterActive ? $1 : $2,')
    .replace(/\{v\.shutter \? '❌ Retirer le volet' : '➕ Activer le volet'\}/g, "{isShutterActive ? '❌ Retirer le volet' : '➕ Activer le volet'}")
    // Replace {v.shutter && ( with {isShutterActive && (
    .replace(/\{v\.shutter && \(/g, '{isShutterActive && (')
    // Replace v.shutter. with actualShutter.
    .replace(/v\.shutter\./g, 'actualShutter.')
    // Close the IIFE at the end of the section
    .replace(
      /(\s*)(<\/div>\s*)$/,
      `$1  </>\n$1);\n$1})()\n$1$2`
    );

  content = content.substring(0, blockStart) + newSectionContent + content.substring(blockEnd);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${filePath}`);
}

processFile(path.join(__dirname, '../src/modules/orders/OrdersModule.jsx'), false);
processFile(path.join(__dirname, '../src/modules/orders/TechnicianPortal.jsx'), true);
