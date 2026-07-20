import React, { useState, useMemo } from 'react';
import { FileText, Download, Eye, Search, ArrowUpDown, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const InvoiceList = ({ data, setData, quoteSettings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 15;

  const clients = data.clients || [];
  const orders = data.orders || [];
  const quotes = data.quotes || [];

  // Build a unified invoice list from two sources
  const allInvoices = useMemo(() => {
    const list = [];

    // Source 1: invoiceRecords from Finance module
    (data.invoiceRecords || []).forEach(rec => {
      const client = clients.find(c => c.id === rec.clientId);
      const order = orders.find(o => o.id === rec.orderId);
      list.push({
        id: rec.id,
        invoiceNumber: rec.invoiceNumber,
        clientName: client?.nom || rec.clientName || 'Client inconnu',
        clientId: rec.clientId,
        date: rec.date,
        montantHT: rec.montantHT || 0,
        montantTTC: rec.montantTTC || 0,
        tvaRate: rec.tvaRate || 19,
        source: 'commande',
        orderId: rec.orderId,
        orderRef: order?.id || rec.orderId,
        type: rec.type || 'Globale',
        unitsCount: rec.unitsCount || 0,
        manualProducts: rec.manualProducts || [],
      });
    });

    // Source 2: Shop quotes with invoiceNumber
    quotes.filter(q => q.invoiceNumber).forEach(q => {
      const alreadyExists = list.some(inv => inv.invoiceNumber === q.invoiceNumber && inv.source === 'boutique');
      if (alreadyExists) return;
      const client = clients.find(c => c.id === q.clientId);
      list.push({
        id: `shop-${q.id}`,
        invoiceNumber: q.invoiceNumber,
        clientName: client?.nom || 'Client inconnu',
        clientId: q.clientId,
        date: q.invoicedAt || q.createdAt,
        montantHT: q.totals?.ht || 0,
        montantTTC: q.totals?.ttc || 0,
        tvaRate: q.tvaRate !== undefined ? q.tvaRate : 19,
        source: 'boutique',
        quoteId: q.id,
        quoteNumber: q.number,
        type: 'Devis Boutique',
      });
    });

    return list;
  }, [data.invoiceRecords, quotes, clients, orders]);

  // Filter
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return allInvoices;
    const term = searchTerm.toLowerCase();
    return allInvoices.filter(inv =>
      inv.invoiceNumber?.toLowerCase().includes(term) ||
      inv.clientName?.toLowerCase().includes(term) ||
      inv.orderRef?.toLowerCase().includes(term) ||
      inv.quoteNumber?.toLowerCase().includes(term)
    );
  }, [allInvoices, searchTerm]);

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'numero':
          valA = a.invoiceNumber || '';
          valB = b.invoiceNumber || '';
          return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'client':
          valA = a.clientName || '';
          valB = b.clientName || '';
          return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'montant':
          valA = a.montantTTC || 0;
          valB = b.montantTTC || 0;
          return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'date':
        default:
          valA = a.date ? new Date(a.date).getTime() : 0;
          valB = b.date ? new Date(b.date).getTime() : 0;
          return sortDir === 'asc' ? valA - valB : valB - valA;
      }
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  const formatPrice = (val) => Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  const formatPricePDF = (val) => Number(val || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // ── Delete invoice and rollback counter ──
  const handleDeleteInvoice = (inv) => {
    if (!window.confirm(`Supprimer la facture N° ${inv.invoiceNumber} ?\nLe prochain numéro de facture sera ${inv.invoiceNumber}.`)) return;

    const deletedNum = parseInt(inv.invoiceNumber, 10);

    setData(prev => {
      const updates = {};

      // Remove from invoiceRecords if it's a command invoice
      if (inv.source === 'commande') {
        updates.invoiceRecords = (prev.invoiceRecords || []).filter(r => r.id !== inv.id);
      }

      // Remove invoiceNumber from the quote if it's a shop invoice
      if (inv.source === 'boutique' && inv.quoteId) {
        updates.quotes = (prev.quotes || []).map(q => {
          if (q.id === inv.quoteId) {
            const { invoiceNumber, invoicedAt, ...rest } = q;
            return rest;
          }
          return q;
        });
      }

      // Rollback counter: if the deleted number would be less than current counter,
      // set counter to the deleted number so next invoice takes its place
      const currentCounter = prev.invoiceCounter || 1;
      if (!isNaN(deletedNum) && deletedNum < currentCounter) {
        updates.invoiceCounter = deletedNum;
      }

      return { ...prev, ...updates };
    });
  };

  // ── View Devis details ──
  const handleViewDevis = (inv) => {
    const quote = quotes.find(q => q.id === inv.quoteId);
    if (!quote) { alert('Devis introuvable.'); return; }

    const client = clients.find(c => c.id === quote.clientId);
    const items = quote.items || [];
    const itemLines = items.map((item, i) =>
      `  ${i + 1}. ${item.nom} — Qté: ${item.qty} — ${Number(item.totalHT || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD`
    ).join('\n');

    alert(
      `Détail du Devis\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `N° Devis: ${quote.number}\n` +
      `Client: ${client?.nom || 'Inconnu'}\n` +
      `Date: ${quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('fr-FR') : '—'}\n` +
      `Statut: ${quote.status || 'Brouillon'}\n` +
      `N° Facture: ${quote.invoiceNumber || '—'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Articles (${items.length}):\n${itemLines || '  Aucun article'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total HT: ${formatPrice(quote.totals?.ht)} DZD\n` +
      `TVA: ${formatPrice(quote.totals?.tva)} DZD\n` +
      `Total TTC: ${formatPrice(quote.totals?.ttc)} DZD`
    );
  };

  // ── View commande details ──
  const handleViewDetail = (inv) => {
    const order = orders.find(o => o.id === inv.orderId);
    if (!order) { alert('Commande introuvable.'); return; }
    const client = clients.find(c => c.id === order.clientId);
    
    const manualLines = (inv.manualProducts || []).map((p, i) =>
      `  ${i + 1}. ${p.name} — Qté: ${p.qty} — ${Number(p.price * p.qty || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD`
    ).join('\n');

    alert(
      `Détails de la commande\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `N° Commande: ${order.id}\n` +
      `Client: ${client?.nom || 'Inconnu'}\n` +
      `N° Facture: ${inv.invoiceNumber}\n` +
      `Type: ${inv.type}\n` +
      `Unités facturées: ${inv.unitsCount}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Produits additionnels (${(inv.manualProducts || []).length}):\n${manualLines || '  Aucun'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Montant HT: ${formatPrice(inv.montantHT)} DZD\n` +
      `TVA: ${inv.tvaRate}%\n` +
      `Montant TTC: ${formatPrice(inv.montantTTC)} DZD\n` +
      `Date: ${inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '—'}`
    );
  };

  // ── Export individual invoice PDF ──
  const handleExportPDF = (inv) => {
    const client = clients.find(c => c.id === inv.clientId);
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Logo
    if (quoteSettings?.logoBase64) {
      try {
        const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
        const maxW = 60, maxH = 25;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
      } catch (e) {
        try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 60, 25, '', 'FAST'); } catch(e2) {}
      }
    }

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', pw - 15, y + 15, { align: 'right' });

    // Invoice number and date
    y += 35;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Facture N° : ${inv.invoiceNumber}`, 15, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date : ${inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, 15, y + 5);

    y += 8;
    const boxY = y;
    const boxWidth = (pw - 35) / 2;

    // ── Company box (Left) ──
    const companyNameLines = doc.splitTextToSize(quoteSettings?.companyName || 'Mon Entreprise', boxWidth - 6);
    const clientNameLines = doc.splitTextToSize(client?.nom || inv.clientName || 'Client', boxWidth - 6);

    doc.setFontSize(8);
    let cyLeft = boxY + 11 + (companyNameLines.length * 4) + 1;
    if (quoteSettings?.companyAddress) cyLeft += doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6).length * 4;
    if (quoteSettings?.companyPhone || quoteSettings?.companyEmail) {
      const contactStr = `${quoteSettings?.companyPhone || ''} ${quoteSettings?.companyEmail ? ' - ' + quoteSettings.companyEmail : ''}`;
      cyLeft += doc.splitTextToSize(contactStr, boxWidth - 6).length * 4;
    }
    if (quoteSettings?.companyRC) cyLeft += doc.splitTextToSize(`RC N°: ${quoteSettings.companyRC}`, boxWidth - 6).length * 4;
    if (quoteSettings?.companyIMP) cyLeft += doc.splitTextToSize(`AI N°: ${quoteSettings.companyIMP}`, boxWidth - 6).length * 4;
    if (quoteSettings?.companyMF) cyLeft += doc.splitTextToSize(`NIF/MF N°: ${quoteSettings.companyMF}`, boxWidth - 6).length * 4;
    if (quoteSettings?.companyRIB) cyLeft += doc.splitTextToSize(`RIB: ${quoteSettings.companyRIB}`, boxWidth - 6).length * 4;
    if (quoteSettings?.companyBank) cyLeft += doc.splitTextToSize(`Banque: ${quoteSettings.companyBank}`, boxWidth - 6).length * 4;

    let cyRight = boxY + 11 + (clientNameLines.length * 4) + 1;
    if (client?.adresse) cyRight += doc.splitTextToSize(client.adresse, boxWidth - 6).length * 4;
    if (client?.telephone) cyRight += 4;
    if (client?.email) cyRight += 5;
    if (client?.rc) cyRight += 4;
    if (client?.nif) cyRight += 4;
    if (client?.nis) cyRight += 4;
    if (client?.ai) cyRight += 4;

    const boxHeight = Math.max(cyLeft - boxY + 8, cyRight - boxY + 8, 45);

    // Draw company box
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.roundedRect(15, boxY, boxWidth, boxHeight, 2, 2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fournisseur :', 18, boxY + 6);
    doc.setFontSize(10);
    doc.text(companyNameLines, 18, boxY + 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cy = boxY + 11 + (companyNameLines.length * 4) + 1;
    if (quoteSettings?.companyAddress) {
      const lines = doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    const phone = quoteSettings?.companyPhone || '';
    const email = quoteSettings?.companyEmail || '';
    if (phone || email) {
      const contactStr = `${phone}${email ? ' - ' + email : ''}`;
      const lines = doc.splitTextToSize(contactStr, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    doc.setTextColor(80, 80, 80);
    if (quoteSettings?.companyRC) {
      const lines = doc.splitTextToSize(`RC N°: ${quoteSettings.companyRC}`, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    if (quoteSettings?.companyIMP) {
      const lines = doc.splitTextToSize(`AI N°: ${quoteSettings.companyIMP}`, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    if (quoteSettings?.companyMF) {
      const lines = doc.splitTextToSize(`NIF/MF N°: ${quoteSettings.companyMF}`, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    if (quoteSettings?.companyRIB) {
      const lines = doc.splitTextToSize(`RIB: ${quoteSettings.companyRIB}`, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    if (quoteSettings?.companyBank) {
      const lines = doc.splitTextToSize(`Banque: ${quoteSettings.companyBank}`, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    doc.setTextColor(0, 0, 0);

    // ── Client box (Right) ──
    const rightBoxX = 15 + boxWidth + 5;
    doc.roundedRect(rightBoxX, boxY, boxWidth, boxHeight, 2, 2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Destinataire :', rightBoxX + 3, boxY + 6);
    doc.setFontSize(10);
    doc.text(clientNameLines, rightBoxX + 3, boxY + 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cly = boxY + 11 + (clientNameLines.length * 4) + 1;
    if (client?.adresse) {
      const lines = doc.splitTextToSize(client.adresse, boxWidth - 6);
      doc.text(lines, rightBoxX + 3, cly); cly += lines.length * 4;
    }
    if (client?.telephone) { doc.text(`Tél : ${client.telephone}`, rightBoxX + 3, cly); cly += 4; }
    if (client?.email) { doc.text(`Email : ${client.email}`, rightBoxX + 3, cly); cly += 5; }
    doc.setTextColor(80, 80, 80);
    if (client?.rc) { doc.text(`RC : ${client.rc}`, rightBoxX + 3, cly); cly += 4; }
    if (client?.nif) { doc.text(`NIF : ${client.nif}`, rightBoxX + 3, cly); cly += 4; }
    if (client?.nis) { doc.text(`NIS : ${client.nis}`, rightBoxX + 3, cly); cly += 4; }
    if (client?.ai) { doc.text(`AI : ${client.ai}`, rightBoxX + 3, cly); cly += 4; }
    doc.setTextColor(0, 0, 0);

    y = boxY + boxHeight + 6;

    // ── For COMMANDE invoices: rebuild units table from order data ──
    if (inv.source === 'commande' && inv.orderId) {
      const order = orders.find(o => o.id === inv.orderId);
      if (order) {
        const contracts = data.contracts || [];
        const contract = contracts.find(c => c.orderId === inv.orderId && c.status === 'Figé');
        const tvaRate = contract?.tauxTVA || inv.tvaRate || 19;

        // Rebuild units
        const units = [];
        (order.batches || []).forEach(batch => {
          (batch.items || []).forEach(item => {
            const originalItem = order.items?.find(i => i.id === item.id) || {};
            const itemPriceHT = originalItem.unitPriceHT || originalItem.priceData?.priceHT || 0;
            (item.measurements || []).forEach(m => {
              for (let i = 0; i < (m.qty || 1); i++) {
                const unitId = `${order.id}-${batch.id}-${item.id}-${m.id}-${i}`;
                const dualStatus = order.unitStatusesDual?.[unitId] || { alu: 'Produit', vitrage: 'Produit' };
                const isReceptionne = dualStatus.alu === 'Fini' || dualStatus.alu === 'Posé' || dualStatus.vitrage === 'Fini';
                if (isReceptionne) {
                  units.push({
                    name: m.instanceNames?.[i] || `${item.label} #${i + 1}`,
                    label: item.label,
                    dimensions: `${m.L} x ${m.H}`,
                    unitPriceHT: itemPriceHT,
                  });
                }
              }
            });
          });
        });

        const tableColumn = ["Désignation", "Dimensions", "Quantité", "P.U. HT", "Total HT"];
        const tableRows = [
          ...units.map(u => [
            `${u.name}\n${u.label}`,
            u.dimensions ? `${u.dimensions} mm` : '-',
            "1 pces",
            `${formatPricePDF(u.unitPriceHT)} DZD`,
            `${formatPricePDF(u.unitPriceHT)} DZD`
          ]),
          ...(inv.manualProducts || []).map(p => [
            `${p.name}\n${p.designation}`,
            '-',
            `${p.qty} pces`,
            `${formatPricePDF(p.price)} DZD`,
            `${formatPricePDF(p.price * p.qty)} DZD`
          ])
        ];

        autoTable(doc, {
          startY: y,
          head: [tableColumn],
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
          columnStyles: { 0: { cellWidth: 70 }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } }
        });

        let finalY = (doc.lastAutoTable?.finalY || doc.previousAutoTable?.finalY || y + 20) + 10;
        if (finalY > 220) { doc.addPage(); finalY = 20; }

        const rightBoxX = 110;
        let boxHeightBottom = 22;

        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.5);
        doc.roundedRect(rightBoxX, finalY, pw - 15 - rightBoxX, boxHeightBottom, 3, 3);

        const totalHT = units.reduce((sum, u) => sum + u.unitPriceHT, 0) + (inv.manualProducts || []).reduce((sum, p) => sum + (p.price * p.qty), 0) || inv.montantHT;
        const totalTVA = totalHT * tvaRate / 100;
        const totalTTC = totalHT + totalTVA;

        let currentTotalY = finalY + 9;
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.text('MONTANT TOTAL HT', rightBoxX + 5, currentTotalY);
        doc.text(`${formatPricePDF(totalHT)} DZD`, pw - 20, currentTotalY, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`TVA ${tvaRate}% :`, rightBoxX + 5, currentTotalY + 7);
        doc.text(`${formatPricePDF(totalTVA)} DZD`, pw - 20, currentTotalY + 7, { align: 'right' });

        finalY += boxHeightBottom + 15;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('NET À PAYER TTC : ' + formatPricePDF(totalTTC) + ' DZD', pw - 15, finalY, { align: 'right' });
        y = finalY;
      }
    }

    // ── For BOUTIQUE invoices: rebuild from quote items ──
    if (inv.source === 'boutique' && inv.quoteId) {
      const quote = quotes.find(q => q.id === inv.quoteId);
      if (quote) {
        const items = quote.items || [];
        const tvaRate = quote.tvaRate !== undefined ? quote.tvaRate : (quoteSettings?.tvaRate ?? 19);

        const tableColumn = ["Désignation", "Dim. / Options", "Quantité (m²/ml)", "Pièces", "P.U. HT", "Total HT"];
        const tableRows = [];

        items.forEach(item => {
          const dims = (item.l || item.h) ? `${item.l} x ${item.h} mm` : '';
          let optStr = '';
          if (item.glassId) {
            const g = (data.glass || []).find(x => x.id === item.glassId);
            if (g) optStr += g.name + ' ';
          }
          if (item.colorId) {
            const c = (data.colors || []).find(x => x.id === item.colorId);
            if (c) optStr += c.name;
          }
          const descLine2 = [dims, optStr].filter(Boolean).join(' | ');

          let totalMeasurementQty = item.qty;
          let measureUnit = item.unit === 'unité' ? 'U' : item.unit;

          if (item.unit === 'm2') {
            totalMeasurementQty = (item.m2 !== undefined && item.m2 !== null) ? (item.m2 * item.qty) : (((item.h || 0) / 1000) * ((item.l || 0) / 1000) * item.qty);
          } else if (item.unit === 'm') {
            totalMeasurementQty = ((item.l || item.h || 0) / 1000) * item.qty;
          }

          const puHT = (totalMeasurementQty > 0) ? (item.totalHT / totalMeasurementQty) : item.totalHT;

          const rowData = [
            `${item.nom}\n${item.designation || ''}`,
            descLine2 || '-',
            item.unit === 'unité' ? '-' : `${totalMeasurementQty.toFixed(2)} ${measureUnit}`,
            `${item.qty} pces`,
            `${formatPricePDF(puHT)} DZD`,
            `${formatPricePDF(item.totalHT)} DZD`
          ];
          tableRows.push(rowData);
        });

        autoTable(doc, {
          startY: y,
          head: [tableColumn],
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
          columnStyles: { 0: { cellWidth: 50 }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } }
        });

        let finalY = (doc.lastAutoTable?.finalY || doc.previousAutoTable?.finalY || y + 20) + 10;
        if (finalY > 220) { doc.addPage(); finalY = 20; }

        const rightBoxX = 110;
        let boxHeightBottom = 22;
        if (quote.totals?.remise > 0) boxHeightBottom += 14;

        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.5);
        doc.roundedRect(rightBoxX, finalY, pw - 15 - rightBoxX, boxHeightBottom, 3, 3);

        const totalHT = quote.totals?.ht || inv.montantHT;
        const tva = quote.totals?.tva || (totalHT * tvaRate / 100);
        const totalTTC = quote.totals?.ttc || (totalHT + tva);

        let currentTotalY = finalY + 9;
        if (quote.totals?.remise > 0) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.text('MONTANT BRUT', rightBoxX + 5, currentTotalY);
          doc.text(`${formatPricePDF(quote.totals.htBrut || totalHT)} DZD`, pw - 20, currentTotalY, { align: 'right' });

          currentTotalY += 7;
          doc.text('REMISE', rightBoxX + 5, currentTotalY);
          doc.text(`- ${formatPricePDF(quote.totals.remise)} DZD`, pw - 20, currentTotalY, { align: 'right' });

          currentTotalY += 7;
        }

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.text('MONTANT TOTAL HT', rightBoxX + 5, currentTotalY);
        doc.text(`${formatPricePDF(totalHT)} DZD`, pw - 20, currentTotalY, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`TVA ${tvaRate}% :`, rightBoxX + 5, currentTotalY + 7);
        doc.text(`${formatPricePDF(tva)} DZD`, pw - 20, currentTotalY + 7, { align: 'right' });

        finalY += boxHeightBottom + 15;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('NET À PAYER TTC : ' + formatPricePDF(totalTTC) + ' DZD', pw - 15, finalY, { align: 'right' });
        y = finalY;
      }
    }

    // ── Cachet ──
    if (quoteSettings?.cachetBase64) {
      const ph = doc.internal.pageSize.getHeight();
      if (y > ph - 40) { doc.addPage(); y = 25; }
      try { doc.addImage(quoteSettings.cachetBase64, 'PNG', 25, y, 35, 35); } catch (e) {}
    }

    doc.save(`Facture_${inv.invoiceNumber}.pdf`);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (sorted.length === 0) { alert('Aucune facture à exporter.'); return; }
    const headers = ['N° Facture', 'Client', 'Date', 'Montant HT (DZD)', 'TVA (%)', 'Montant TTC (DZD)', 'Source', 'Type', 'Réf. Commande / Devis'];
    const rows = sorted.map(inv => [
      inv.invoiceNumber,
      `"${(inv.clientName || '').replace(/"/g, '""')}"`,
      inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '',
      (inv.montantHT || 0).toFixed(2),
      inv.tvaRate,
      (inv.montantTTC || 0).toFixed(2),
      inv.source === 'commande' ? 'Commande' : 'Boutique',
      inv.type,
      inv.orderRef || inv.quoteNumber || '',
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `liste_factures_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const totalHTSum = allInvoices.reduce((s, inv) => s + (inv.montantHT || 0), 0);
  const totalTTCSum = allInvoices.reduce((s, inv) => s + (inv.montantTTC || 0), 0);

  const SortIcon = ({ field }) => (
    <ArrowUpDown size={12} style={{ opacity: sortField === field ? 1 : 0.3, marginLeft: '0.25rem', verticalAlign: 'middle' }} />
  );

  const actionBtnStyle = (bg, color, border) => ({
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.3rem 0.6rem', background: bg,
    border: `1px solid ${border}`, borderRadius: '0.5rem',
    cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
    color, transition: 'all 0.2s', whiteSpace: 'nowrap',
  });

  return (
    <div>
      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)',
          borderRadius: '1rem', padding: '1.25rem', color: 'white',
        }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.35rem' }}>Total Factures</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{allInvoices.length}</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #059669, #10b981)',
          borderRadius: '1rem', padding: '1.25rem', color: 'white',
        }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.35rem' }}>Total HT</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{formatPrice(totalHTSum)} DZD</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
          borderRadius: '1rem', padding: '1.25rem', color: 'white',
        }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.35rem' }}>Total TTC</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{formatPrice(totalTTCSum)} DZD</div>
        </div>
      </div>

      {/* Search + Export bar */}
      <div className="glass" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} /> Liste des Factures
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Rechercher (n°, client...)"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="input"
                style={{ paddingLeft: '2.25rem', minWidth: '220px' }}
              />
            </div>
            <button
              onClick={handleExportCSV}
              disabled={sorted.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                background: sorted.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #059669, #10b981)',
                color: 'white', border: 'none', borderRadius: '0.6rem',
                cursor: sorted.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.85rem',
                transition: 'all 0.2s',
              }}
            >
              <Download size={15} /> Exporter CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('numero')}>
                  N° Facture <SortIcon field="numero" />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('client')}>
                  Client <SortIcon field="client" />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('date')}>
                  Date <SortIcon field="date" />
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('montant')}>
                  Montant TTC <SortIcon field="montant" />
                </th>
                <th>Source</th>
                <th style={{ textAlign: 'center', width: '260px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 700, color: '#0f4c75' }}>
                    {inv.invoiceNumber || '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {inv.clientName}
                  </td>
                  <td>
                    {inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ fontWeight: 700, color: '#059669' }}>
                    {formatPrice(inv.montantTTC)} DZD
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: inv.source === 'commande' ? '#dbeafe' : '#fdf4ff',
                      color: inv.source === 'commande' ? '#1d4ed8' : '#a855f7',
                    }}>
                      {inv.source === 'commande' ? 'Commande' : 'Boutique'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {/* Detail / Devis button */}
                      {inv.source === 'boutique' && inv.quoteId && (
                        <button
                          onClick={() => handleViewDevis(inv)}
                          title="Détail du devis"
                          style={actionBtnStyle('#f0f9ff', '#0284c7', '#bae6fd')}
                        >
                          <Eye size={13} /> Devis
                        </button>
                      )}
                      {inv.source === 'commande' && inv.orderId && (
                        <button
                          onClick={() => handleViewDetail(inv)}
                          title="Détail de la commande"
                          style={actionBtnStyle('#f0f9ff', '#0284c7', '#bae6fd')}
                        >
                          <Eye size={13} /> Détail
                        </button>
                      )}

                      {/* Export PDF button */}
                      <button
                        onClick={() => handleExportPDF(inv)}
                        title="Exporter la facture en PDF"
                        style={actionBtnStyle('#f0fdf4', '#059669', '#a7f3d0')}
                      >
                        <Download size={13} /> PDF
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteInvoice(inv)}
                        title="Supprimer la facture"
                        style={actionBtnStyle('#fef2f2', '#dc2626', '#fecaca')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    {searchTerm ? 'Aucune facture ne correspond à votre recherche.' : 'Aucune facture enregistrée. Générez une facture depuis l\'onglet Factures.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
            <span>{sorted.length} facture{sorted.length !== 1 ? 's' : ''} — Page {currentPage}/{totalPages}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  color: currentPage === 1 ? '#cbd5e1' : '#475569', fontSize: '0.82rem',
                }}
              >
                <ChevronLeft size={14} /> Préc.
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  color: currentPage === totalPages ? '#cbd5e1' : '#475569', fontSize: '0.82rem',
                }}
              >
                Suiv. <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceList;
