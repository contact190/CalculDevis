/**
 * Shared PDF helpers for document headers and French formatting.
 */

export const formatAmountFR = (val, decimals = 2) => {
  const formatted = Number(val || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return formatted.replace(/\s/g, ' ');
};

const UNITS = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF'];
const TEENS = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
const TENS = ['', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT'];

const convertBelow100 = (n) => {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 70) {
    const unit = n % 10;
    const ten = Math.floor(n / 10);
    if (unit === 0) return TENS[ten];
    if (unit === 1 && ten !== 8) return `${TENS[ten]} ET UN`;
    return `${TENS[ten]}-${convertBelow100(unit)}`;
  }
  if (n < 80) {
    const unit = n - 60;
    if (unit === 11) return 'SOIXANTE ET ONZE';
    return `SOIXANTE-${convertBelow100(unit)}`;
  }
  if (n < 100) {
    const unit = n % 20;
    if (n === 80) return 'QUATRE-VINGTS';
    if (unit === 0) return 'QUATRE-VINGT';
    if (unit === 1) return 'QUATRE-VINGT-UN';
    return `QUATRE-VINGT-${convertBelow100(unit)}`;
  }
  return '';
};

const convertBelow1000 = (n) => {
  if (n < 100) return convertBelow100(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredStr = hundreds === 1 ? 'CENT' : `${UNITS[hundreds]} CENT${rest === 0 && hundreds > 1 ? 'S' : ''}`;
  return rest ? `${hundredStr} ${convertBelow100(rest)}` : hundredStr;
};

const convertInteger = (n) => {
  if (n === 0) return 'ZERO';
  if (n < 1000) return convertBelow1000(n);
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const thousandStr = thousands === 1 ? 'MILLE' : `${convertBelow1000(thousands)} MILLE`;
    return rest ? `${thousandStr} ${convertBelow1000(rest)}` : thousandStr;
  }
  const millions = Math.floor(n / 1000000);
  const rest = n % 1000000;
  const millionStr = millions === 1 ? 'UN MILLION' : `${convertInteger(millions)} MILLIONS`;
  return rest ? `${millionStr} ${convertInteger(rest)}` : millionStr;
};

export const amountToWordsFR = (amount) => {
  const value = Math.round(Number(amount || 0));
  return `${convertInteger(value)} DINARS`;
};

export const drawDocumentHeader = (doc, quoteSettings, client, options = {}) => {
  const pw = doc.internal.pageSize.getWidth();
  const { title = '', docLabel = '', docValue = '', docDate = new Date().toLocaleDateString('fr-FR'), showClientBox = true } = options;

  doc.setTextColor(0, 0, 0);
  let y = 15;

  let logoH = 20;
  if (quoteSettings?.logoBase64) {
    try {
      const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
      const maxW = 60;
      const maxH = 25;
      const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
      logoH = imgProps.height * ratio;
      doc.addImage(quoteSettings.logoBase64, 'PNG', 15, 15, imgProps.width * ratio, logoH, '', 'FAST');
    } catch (e) {
      try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, 15, 60, 25, '', 'FAST'); logoH = 25; } catch (e2) {}
    }
  }

  if (title) {
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const maxTitleWidth = pw - 90; // leave room for logo on the left
    const splitTitle = doc.splitTextToSize(title, maxTitleWidth);
    doc.text(splitTitle, pw - 15, 15 + 12, { align: 'right' });
  }

  // Determine box placement
  const boxY = showClientBox ? (15 + Math.max(logoH, title ? 22 : 0) + 6) : 15;
  const boxWidth = showClientBox ? (pw - 35) / 2 : pw - 95; // 115mm width if single box
  const boxX = showClientBox ? 15 : 80; // place beside logo if single box

  // Draw docLabel & docValue if present
  let labelH = 0;
  if (docLabel && docValue) {
    labelH = 10;
  }

  if (docLabel && docValue) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    // If showClientBox is true, draw above the boxes. If false, draw on the left under the logo.
    const labelY = showClientBox ? boxY - 10 : 15 + logoH + 6;
    doc.text(`${docLabel} : ${docValue}`, 15, labelY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date : ${docDate}`, 15, labelY + 5);
  }

  const companyNameLines = doc.splitTextToSize(quoteSettings?.companyName || 'Mon Entreprise', boxWidth - 6);
  const phone = quoteSettings?.companyPhone || '';
  const email = quoteSettings?.companyEmail || '';

  // Calculate actual height of the left column (Fournisseur) text
  let cyLeft = boxY + (showClientBox && labelH ? labelH : 0) + 11 + (companyNameLines.length * 4) + 1;
  if (quoteSettings?.companyAddress) cyLeft += doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6).length * 3.5;
  if (phone || email) cyLeft += doc.splitTextToSize(`${phone}${email ? ' - ' + email : ''}`, boxWidth - 6).length * 3.5;
  if (quoteSettings?.companyRC) cyLeft += 3.5;
  if (quoteSettings?.companyIMP) cyLeft += 3.5;
  if (quoteSettings?.companyMF) cyLeft += 3.5;
  if (quoteSettings?.companyRIB) cyLeft += doc.splitTextToSize(`RIB: ${quoteSettings.companyRIB}`, boxWidth - 6).length * 3.5;
  if (quoteSettings?.companyBank) cyLeft += doc.splitTextToSize(`Banque: ${quoteSettings.companyBank}`, boxWidth - 6).length * 3.5;

  let cyRight = boxY + (showClientBox && labelH ? labelH : 0) + 16;
  let clientNameLines = [];
  if (showClientBox) {
    clientNameLines = doc.splitTextToSize(client?.nom || 'Client', boxWidth - 6);
    cyRight = boxY + labelH + 11 + (clientNameLines.length * 4) + 1;
    if (client?.adresse) cyRight += doc.splitTextToSize(client.adresse, boxWidth - 6).length * 3.5;
    if (client?.telephone) cyRight += 3.5;
    if (client?.email) cyRight += 3.5;
    if (client?.rc) cyRight += 3.5;
    if (client?.nif) cyRight += 3.5;
    if (client?.nis) cyRight += 3.5;
    if (client?.ai) cyRight += 3.5;
  }

  // Calculate exact box height with a small 2.5mm bottom padding
  const minHeight = showClientBox ? 42 : 20;
  const startOffset = boxY + (showClientBox && labelH ? labelH : 0);
  const boxHeight = Math.max(cyLeft - startOffset + 2.5, showClientBox ? cyRight - (boxY + labelH) + 2.5 : 0, minHeight);

  // Draw the Fournisseur Box
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, startOffset, boxWidth, boxHeight, 2, 2);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Fournisseur :', boxX + 3, startOffset + 6);
  doc.setFontSize(10);
  doc.text(companyNameLines, boxX + 3, startOffset + 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  let cy = startOffset + 11 + (companyNameLines.length * 4) + 1;
  if (quoteSettings?.companyAddress) {
    const lines = doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6);
    doc.text(lines, boxX + 3, cy);
    cy += lines.length * 3.5;
  }
  if (phone || email) {
    const lines = doc.splitTextToSize(`${phone}${email ? ' - ' + email : ''}`, boxWidth - 6);
    doc.text(lines, boxX + 3, cy);
    cy += lines.length * 3.5;
  }
  doc.setTextColor(80, 80, 80);
  if (quoteSettings?.companyRC) { doc.text(`RC N°: ${quoteSettings.companyRC}`, boxX + 3, cy); cy += 3.5; }
  if (quoteSettings?.companyIMP) { doc.text(`AI N°: ${quoteSettings.companyIMP}`, boxX + 3, cy); cy += 3.5; }
  if (quoteSettings?.companyMF) { doc.text(`NIF/MF N°: ${quoteSettings.companyMF}`, boxX + 3, cy); cy += 3.5; }
  if (quoteSettings?.companyRIB) {
    const lines = doc.splitTextToSize(`RIB: ${quoteSettings.companyRIB}`, boxWidth - 6);
    doc.text(lines, boxX + 3, cy);
    cy += lines.length * 3.5;
  }
  if (quoteSettings?.companyBank) {
    const lines = doc.splitTextToSize(`Banque: ${quoteSettings.companyBank}`, boxWidth - 6);
    doc.text(lines, boxX + 3, cy);
    cy += lines.length * 3.5;
  }
  doc.setTextColor(0, 0, 0);

  if (showClientBox) {
    const rightBoxX = 15 + boxWidth + 5;
    doc.roundedRect(rightBoxX, boxY + labelH, boxWidth, boxHeight, 2, 2);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Destinataire :', rightBoxX + 3, boxY + labelH + 6);
    doc.setFontSize(10);
    doc.text(clientNameLines, rightBoxX + 3, boxY + labelH + 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cly = boxY + labelH + 11 + (clientNameLines.length * 4) + 1;
    if (client?.adresse) {
      const lines = doc.splitTextToSize(client.adresse, boxWidth - 6);
      doc.text(lines, rightBoxX + 3, cly);
      cly += lines.length * 3.5;
    }
    if (client?.telephone) { doc.text(`Tél : ${client.telephone}`, rightBoxX + 3, cly); cly += 3.5; }
    if (client?.email) { doc.text(`Email : ${client.email}`, rightBoxX + 3, cly); cly += 3.5; }
    doc.setTextColor(80, 80, 80);
    if (client?.rc) { doc.text(`RC : ${client.rc}`, rightBoxX + 3, cly); cly += 3.5; }
    if (client?.nif) { doc.text(`NIF : ${client.nif}`, rightBoxX + 3, cly); cly += 3.5; }
    if (client?.nis) { doc.text(`NIS : ${client.nis}`, rightBoxX + 3, cly); cly += 3.5; }
    if (client?.ai) { doc.text(`AI : ${client.ai}`, rightBoxX + 3, cly); cly += 3.5; }
    doc.setTextColor(0, 0, 0);
  }

  const finalY = Math.max(15 + logoH + (showClientBox ? 0 : (docLabel && docValue ? 16 : 0)), boxY + (showClientBox && labelH ? labelH : 0) + boxHeight) + 8;
  return finalY;
};

export const getCityFromAddress = (address, fallback = 'Oran') => {
  if (!address) return fallback;
  const match = address.match(/\b(Oran|Alger|Constantine|Annaba|Blida|Batna|Sétif|Tlemcen|Béjaïa)\b/i);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : fallback;
};

export const countItemQtyOnFloors = (order, itemId, floors, onlyFinished = false) => {
  if (!order || !floors?.length) return 0;
  const floorSet = new Set(floors);
  let count = 0;

  (order.batches || []).forEach(batch => {
    (batch.items || []).forEach(item => {
      if (item.id !== itemId) return;
      (item.measurements || []).forEach(m => {
        for (let i = 0; i < (m.qty || 1); i++) {
          const floor = m.instanceFloors?.[i] || 'N/A';
          if (!floorSet.has(floor)) continue;
          if (onlyFinished) {
            const unitId = `${order.id}-${batch.id}-${item.id}-${m.id}-${i}`;
            const ds = order.unitStatusesDual?.[unitId] || {};
            if (ds.alu !== 'Fini' && ds.alu !== 'Posé') continue;
          }
          count += 1;
        }
      });
    });
  });

  return count;
};

export const getItemContractQty = (order, itemId) => {
  if (!order) return 0;
  let total = 0;
  (order.batches || []).forEach(batch => {
    (batch.items || []).forEach(item => {
      if (item.id !== itemId) return;
      (item.measurements || []).forEach(m => {
        total += m.qty || 1;
      });
    });
  });
  return total;
};

export const buildAttachementRows = (order, versement, prevVersements) => {
  if (!order) return [];

  const prevFloors = [...new Set(prevVersements.flatMap(v => v.etages || []))];
  const currentFloors = versement.etages || [];
  const seen = new Set();
  const rows = [];
  let index = 1;

  (order.batches || []).forEach(batch => {
    (batch.items || []).forEach(item => {
      if (seen.has(item.id)) return;
      seen.add(item.id);

      const qteContrat = getItemContractQty(order, item.id);
      const qtePrece = countItemQtyOnFloors(order, item.id, prevFloors, true);
      const qteMois = countItemQtyOnFloors(order, item.id, currentFloors, true);
      const qteCumul = qtePrece + qteMois;

      if (qteContrat === 0 && qteMois === 0 && qtePrece === 0) return;

      const originalItem = order.items?.find(i => i.id === item.id) || item;
      const dims = (item.measurements || [])[0];
      const dimStr = dims ? ` de dimensions (${dims.L || '?'}*${dims.H || '?'})` : '';
      rows.push({
        num: `1-${String(index).padStart(2, '0')}`,
        designation: `Fourniture et pose de ${originalItem.label || item.label} en aluminium${dimStr}, y compris toutes sujétions de mise en œuvre et de bonne exécution suivant les règles de l'art.`,
        unit: 'U',
        qteContrat,
        qtePrece,
        qteMois,
        qteCumul,
        observations: '',
      });
      index += 1;
    });
  });

  return rows;
};

export const getSituationNumber = (versements, versement) => {
  const pvVersements = versements.filter(v => v.pvId);
  const idx = pvVersements.findIndex(v => v.id === versement.id);
  return String(Math.max(idx + 1, 1)).padStart(2, '0');
};

export const resolveClientRecord = (tracker, order, contract, clients = [], quotes = []) => {
  const list = clients || [];
  const ids = [
    tracker?.clientId,
    order?.clientId,
    contract?.clientId,
    order?.quoteId ? quotes.find(q => q.id === order.quoteId)?.clientId : null,
  ].filter(Boolean);

  for (const id of ids) {
    const found = list.find(c => c.id === id);
    if (found) return found;
  }

  if (order?.clientName) {
    const byName = list.find(c => (c.nom || '').trim().toLowerCase() === order.clientName.trim().toLowerCase());
    if (byName) return byName;
  }

  if (contract?.clientInfo?.nom) {
    const byContractName = list.find(c => (c.nom || '').trim().toLowerCase() === contract.clientInfo.nom.trim().toLowerCase());
    if (byContractName) return byContractName;
  }

  return null;
};

export const drawSituationClientBlock = (doc, client, startY, pw, extras = {}) => {
  const { projet, lot, montantContrat } = extras;
  let y = startY;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  if (!client) {
    doc.text('Entreprise : — (client introuvable, vérifiez l\'onglet Clients)', 15, y);
    y += 5;
  } else {
    doc.text(`Entreprise : ${client.nom || '—'}`, 15, y);
    y += 5;
    if (client.adresse) {
      const addrLines = doc.splitTextToSize(`Siège social : ${client.adresse}`, pw - 30);
      doc.text(addrLines, 15, y);
      y += addrLines.length * 4;
    }
    if (client.telephone) {
      doc.text(`Tél : ${client.telephone}`, 15, y);
      y += 4;
    }
    if (client.email) {
      doc.text(`Email : ${client.email}`, 15, y);
      y += 4;
    }
    if (client.rc) { doc.text(`RC : ${client.rc}`, 15, y); y += 4; }
    if (client.nif) { doc.text(`NIF : ${client.nif}`, 15, y); y += 4; }
    if (client.nis) { doc.text(`NIS : ${client.nis}`, 15, y); y += 4; }
    if (client.ai) { doc.text(`Article d'Imposition : ${client.ai}`, 15, y); y += 4; }
  }

  if (projet) {
    doc.text(`Projet : ${projet}`, 15, y);
    y += 5;
  }
  if (lot) {
    doc.text(`Lot : ${lot}`, 15, y);
    y += 5;
  }
  if (montantContrat !== undefined && montantContrat !== null) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Montant du contrat en TTC : ${formatAmountFR(montantContrat, 0)} DZD`, 15, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }

  return y + 5;
};

export const drawSituationTable = (doc, startY, pw, rows) => {
  const tableX = 15;
  const tableW = pw - 30;
  const descWidth = 118;
  const splitX = tableX + descWidth;
  const amountColCenter = splitX + (tableW - descWidth) / 2;
  const amountX = splitX + (tableW - descWidth) - 4;
  const labelMaxW = descWidth - 6;
  const headerH = 8;

  doc.setFontSize(7.5);
  const rowHeights = rows.map(row => {
    const lines = doc.splitTextToSize(row.label, labelMaxW - (row.indent || 0));
    return Math.max(lines.length * 4.2, 6.5);
  });
  const totalH = headerH + rowHeights.reduce((sum, h) => sum + h, 0);
  const tableTop = startY;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(tableX, tableTop, tableW, totalH);
  doc.line(splitX, tableTop, splitX, tableTop + totalH);
  doc.line(tableX, tableTop + headerH, tableX + tableW, tableTop + headerH);

  let dividerY = tableTop + headerH;
  rows.forEach((row, i) => {
    dividerY += rowHeights[i];
    if (row.isSectionEnd) {
      doc.line(tableX, dividerY, tableX + tableW, dividerY);
    }
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Montant en Dinars', amountColCenter, tableTop + 5.5, { align: 'center' });

  let y = tableTop + headerH;
  rows.forEach((row, i) => {
    doc.setFont('helvetica', row.bold || row.sectionTitle ? 'bold' : 'normal');
    doc.setFontSize(row.sectionTitle ? 8 : 7.5);
    const lines = doc.splitTextToSize(row.label, labelMaxW - (row.indent || 0));
    doc.text(lines, tableX + 2 + (row.indent || 0), y + 4);
    if (row.amount !== null && row.amount !== undefined) {
      doc.text(formatAmountFR(row.amount), amountX, y + 4, { align: 'right' });
    }
    y += rowHeights[i];
  });

  return tableTop + totalH;
};
