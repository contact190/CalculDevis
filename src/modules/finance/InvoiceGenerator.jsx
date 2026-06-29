import React, { useState, useMemo } from 'react';
import { Receipt, Download, Filter, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';

const InvoiceGenerator = ({ data, setData, quoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [invoiceType, setInvoiceType] = useState('global'); // 'global' | 'partiel'
  const [selectedFloors, setSelectedFloors] = useState(new Set());
  const currentCounter = data.invoiceCounter || 1;
  const [invoiceNumber, setInvoiceNumber] = useState(`FAC-${String(currentCounter).padStart(2, '0')}`);
  const [isGenerating, setIsGenerating] = useState(false);

  const orders = data.orders || [];
  const clients = data.clients || [];
  const contracts = data.contracts || [];
  const trackers = data.financialTrackers || [];

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);
  const selectedClient = useMemo(() => {
    if (!selectedOrder) return null;
    return clients.find(c => c.id === selectedOrder.clientId);
  }, [selectedOrder, clients]);
  const selectedContract = useMemo(() => {
    if (!selectedOrder) return null;
    return contracts.find(c => c.orderId === selectedOrderId && c.status === 'Figé');
  }, [selectedOrder, contracts, selectedOrderId]);

  // Get all units (instances) with status
  const allUnitsWithStatus = useMemo(() => {
    if (!selectedOrder) return [];
    const units = [];
    (selectedOrder.batches || []).forEach(batch => {
      (batch.items || []).forEach(item => {
        const originalItem = selectedOrder.items?.find(i => i.id === item.id) || {};
        const itemPriceHT = originalItem.unitPriceHT || originalItem.priceData?.priceHT || 0;
        (item.measurements || []).forEach(m => {
          for (let i = 0; i < (m.qty || 1); i++) {
            const unitId = `${selectedOrder.id}-${batch.id}-${item.id}-${m.id}-${i}`;
            const dualStatus = selectedOrder.unitStatusesDual?.[unitId] || { alu: 'Produit', vitrage: 'Produit' };
            const isReceptionne = dualStatus.alu === 'Fini' || dualStatus.alu === 'Posé' || dualStatus.vitrage === 'Fini';
            const floor = m.instanceFloors?.[i] || 'N/A';
            units.push({
              id: unitId,
              name: m.instanceNames?.[i] || `${item.label} #${i + 1}`,
              floor,
              label: item.label,
              dimensions: `${m.L} x ${m.H}`,
              isReceptionne,
              unitPriceHT: itemPriceHT,
              batchId: batch.id,
            });
          }
        });
      });
    });
    return units;
  }, [selectedOrder]);

  const availableFloors = useMemo(() => {
    const floors = new Set(allUnitsWithStatus.map(u => u.floor));
    return [...floors].sort();
  }, [allUnitsWithStatus]);

  const filteredUnits = useMemo(() => {
    if (invoiceType === 'global') return allUnitsWithStatus.filter(u => u.isReceptionne);
    return allUnitsWithStatus.filter(u => u.isReceptionne && selectedFloors.has(u.floor));
  }, [allUnitsWithStatus, invoiceType, selectedFloors]);

  const toggleFloor = (floor) => {
    setSelectedFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor); else next.add(floor);
      return next;
    });
  };

  const totalHT = useMemo(() => filteredUnits.reduce((s, u) => s + (u.unitPriceHT || 0), 0), [filteredUnits]);
  const tvaRate = selectedContract?.tauxTVA || quoteSettings?.tvaRate || 19;
  const totalTVA = totalHT * tvaRate / 100;
  const totalTTC = totalHT + totalTVA;

  const generateInvoicePDF = async () => {
    if (!selectedOrder) { alert('Sélectionnez une commande.'); return; }
    if (filteredUnits.length === 0) { alert('Aucune unité réceptionnée sélectionnée.'); return; }

    setIsGenerating(true);
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // ── Header ──
    doc.setTextColor(0, 0, 0);
    let y = 15;

    // Left: Logo
    if (quoteSettings?.logoBase64) {
      try {
        const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
        const maxW = 60;
        const maxH = 25;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
      } catch (e) {
        try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 60, 25, '', 'FAST'); } catch(e2) {}
      }
    }

    // Top Right: Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', pw - 15, y + 15, { align: 'right' });
    
    // Gauche: Facture number and date
    y += 35;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Facture N° : ${invoiceNumber}`, 15, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 15, y + 5);
    
    y += 8;
    
    const boxY = y;
    const boxWidth = (pw - 35) / 2; // 15 margin L/R, 5 gap = 35

    doc.setFontSize(8);
    // Calculate required height for Left Box
    let cyLeft = boxY + 16;
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

    // Calculate required height for Right Box
    let cyRight = boxY + 16;
    if (selectedClient?.adresse) cyRight += doc.splitTextToSize(selectedClient.adresse, boxWidth - 6).length * 4;
    if (selectedClient?.telephone) cyRight += doc.splitTextToSize(`Tél : ${selectedClient.telephone}`, boxWidth - 6).length * 4;
    if (selectedClient?.email) cyRight += doc.splitTextToSize(`Email : ${selectedClient.email}`, boxWidth - 6).length * 4;
    if (selectedClient?.rc) cyRight += doc.splitTextToSize(`RC : ${selectedClient.rc}`, boxWidth - 6).length * 4;
    if (selectedClient?.nif) cyRight += doc.splitTextToSize(`NIF : ${selectedClient.nif}`, boxWidth - 6).length * 4;
    if (selectedClient?.nis) cyRight += doc.splitTextToSize(`NIS : ${selectedClient.nis}`, boxWidth - 6).length * 4;
    if (selectedClient?.ai) cyRight += doc.splitTextToSize(`AI : ${selectedClient.ai}`, boxWidth - 6).length * 4;

    // Dynamic box height with a minimum of 45, plus extra padding at the bottom (8mm)
    const boxHeight = Math.max(cyLeft - boxY + 8, cyRight - boxY + 8, 45);
    
    // Company box (Left - Fournisseur)
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.roundedRect(15, boxY, boxWidth, boxHeight, 2, 2);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Fournisseur :', 18, boxY + 6);

    doc.setFontSize(10);
    doc.text(quoteSettings?.companyName || 'Mon Entreprise', 18, boxY + 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cy = boxY + 16;
    if (quoteSettings?.companyAddress) {
      const lines = doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6);
      doc.text(lines, 18, cy); cy += lines.length * 4;
    }
    const phone = quoteSettings?.companyPhone || '';
    const email = quoteSettings?.companyEmail || '';
    if (phone || email) {
      const contactStr = `${phone} ${email ? ' - ' + email : ''}`;
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

    // Client box (Right - Destinataire)
    const rightBoxXHeader = 15 + boxWidth + 5;
    doc.roundedRect(rightBoxXHeader, boxY, boxWidth, boxHeight, 2, 2);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Destinataire :', rightBoxXHeader + 3, boxY + 6);
    doc.setFontSize(10);
    doc.text(selectedClient?.nom || 'Client', rightBoxXHeader + 3, boxY + 11);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cly = boxY + 16;
    if (selectedClient?.adresse) {
      const lines = doc.splitTextToSize(selectedClient.adresse, boxWidth - 6);
      doc.text(lines, rightBoxXHeader + 3, cly); cly += lines.length * 4;
    }
    if (selectedClient?.telephone) {
      const lines = doc.splitTextToSize(`Tél : ${selectedClient.telephone}`, boxWidth - 6);
      doc.text(lines, rightBoxXHeader + 3, cly); cly += lines.length * 4;
    }
    if (selectedClient?.email) {
      const lines = doc.splitTextToSize(`Email : ${selectedClient.email}`, boxWidth - 6);
      doc.text(lines, rightBoxXHeader + 3, cly); cly += lines.length * 4;
    }
    doc.setTextColor(80, 80, 80);
    if (selectedClient?.rc) {
      const lines = doc.splitTextToSize(`RC : ${selectedClient.rc}`, boxWidth - 6);
      doc.text(lines, rightBoxXHeader + 3, cly); cly += lines.length * 4;
    }
    if (selectedClient?.nif) {
      const lines = doc.splitTextToSize(`NIF : ${selectedClient.nif}`, boxWidth - 6);
      doc.text(lines, rightBoxXHeader + 3, cly); cly += lines.length * 4;
    }
    if (selectedClient?.nis) {
      const lines = doc.splitTextToSize(`NIS : ${selectedClient.nis}`, boxWidth - 6);
      doc.text(lines, rightBoxXHeader + 3, cly); cly += lines.length * 4;
    }
    if (selectedClient?.ai) {
      const lines = doc.splitTextToSize(`AI : ${selectedClient.ai}`, boxWidth - 6);
      doc.text(lines, rightBoxXHeader + 3, cly); cly += lines.length * 4;
    }
    doc.setTextColor(0, 0, 0);

    y = boxY + boxHeight + 12;
    
    // Table Header Borders
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(15, y - 6, pw - 30, 8); // Header border

    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    
    // Column x positions & widths (Total usable width: pw - 30 = 180)
    const colDesc = 15; const wDesc = 42;
    const colHaut = colDesc + wDesc; const wHaut = 19;
    const colLarg = colHaut + wHaut; const wLarg = 19;
    const colM2 = colLarg + wLarg; const wM2 = 14;
    const colQte = colM2 + wM2; const wQte = 15;
    const colPrix = colQte + wQte; const wPrix = 22;
    const colTax = colPrix + wPrix; const wTax = 16;
    const colMont = colTax + wTax; const wMont = 33;

    // Draw vertical lines for header
    doc.line(colHaut, y - 6, colHaut, y + 2);
    doc.line(colLarg, y - 6, colLarg, y + 2);
    doc.line(colM2, y - 6, colM2, y + 2);
    doc.line(colQte, y - 6, colQte, y + 2);
    doc.line(colPrix, y - 6, colPrix, y + 2);
    doc.line(colTax, y - 6, colTax, y + 2);
    doc.line(colMont, y - 6, colMont, y + 2);

    // Centered text helper
    const centerText = (txt, x, w, cy) => {
      doc.text(txt, x + w / 2, cy, { align: 'center' });
    };
    const rightText = (txt, x, w, cy) => {
      doc.text(txt, x + w - 2, cy, { align: 'right' });
    };
    const formatPrice = (val) => val.toLocaleString('fr-FR', { minimumFractionDigits: 2 }).replace(/[\s\u202F\u00A0]/g, ' ');

    centerText('DESCRIPTION', colDesc, wDesc, y - 1);
    centerText('HAUTEUR (MT)', colHaut, wHaut, y - 1);
    centerText('LARGEUR (MT)', colLarg, wLarg, y - 1);
    centerText('(MONT)2', colM2, wM2, y - 1);
    centerText('QUANTITE', colQte, wQte, y - 1);
    centerText('PRIX UNITAIRE', colPrix, wPrix, y - 1);
    centerText('TAXES', colTax, wTax, y - 1);
    centerText('MONTANT', colMont, wMont, y - 1);
    
    y += 2;

    doc.setFont('helvetica', 'normal');
    filteredUnits.forEach((unit, idx) => {
      if (y > ph - 60) { doc.addPage(); y = 25; }
      const rowH = 8;
      
      doc.rect(15, y, pw - 30, rowH); // Row border
      // Vertical lines for row
      doc.line(colHaut, y, colHaut, y + rowH);
      doc.line(colLarg, y, colLarg, y + rowH);
      doc.line(colM2, y, colM2, y + rowH);
      doc.line(colQte, y, colQte, y + rowH);
      doc.line(colPrix, y, colPrix, y + rowH);
      doc.line(colTax, y, colTax, y + rowH);
      doc.line(colMont, y, colMont, y + rowH);

      doc.setFontSize(7);
      const parts = unit.dimensions ? unit.dimensions.split('x').map(s => s.trim()) : ['0', '0'];
      const L = parts[0] || '0';
      const H = parts[1] || '0';

      let descText = `${unit.name} - ${unit.label}`;
      if (descText.length > 32) descText = descText.substring(0, 32) + '...';
      doc.text(descText, colDesc + 2, y + 5);
      centerText(H, colHaut, wHaut, y + 5);
      centerText(L, colLarg, wLarg, y + 5);
      centerText('1', colM2, wM2, y + 5);
      centerText('1', colQte, wQte, y + 5);
      rightText(formatPrice(unit.unitPriceHT), colPrix, wPrix, y + 5);
      centerText(`TVA ${tvaRate}%`, colTax, wTax, y + 5);
      rightText(`${formatPrice(unit.unitPriceHT)} DA`, colMont, wMont, y + 5);
      
      y += rowH;
    });

    // ── Totals ──
    y += 5;
    const totalsX = colPrix;
    const totalsW = pw - 15 - colPrix;
    const splitX = colMont;
    
    doc.setDrawColor(0, 0, 0);
    // HT Row
    doc.rect(totalsX, y, totalsW, 6);
    doc.line(splitX, y, splitX, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('Montant HT', totalsX + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatPrice(totalHT)} DA`, pw - 17, y + 4, { align: 'right' });
    y += 6;

    // TVA Row
    doc.rect(totalsX, y, totalsW, 6);
    doc.line(splitX, y, splitX, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`TVA ${tvaRate}%`, totalsX + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatPrice(totalTVA)} DA`, pw - 17, y + 4, { align: 'right' });
    y += 6;

    // TOTAL Row
    doc.setFillColor(100, 100, 100);
    doc.rect(totalsX, y, totalsW, 6, 'FD'); // Filled and stroke
    doc.line(splitX, y, splitX, y + 6);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', totalsX + 2, y + 4);
    doc.text(`${formatPrice(totalTTC)} DA`, pw - 17, y + 4, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
    y += 20;

    // ── Cachet (Bottom Left) ──
    if (quoteSettings?.cachetBase64) {
      if (y > ph - 40) { doc.addPage(); y = 25; }
      try { doc.addImage(quoteSettings.cachetBase64, 'PNG', 25, y, 35, 35); } catch (e) {}
    }

    doc.save(`${invoiceNumber}_${selectedOrder.id}.pdf`);
    
    setData(prev => {
      let newCounter = prev.invoiceCounter || 1;
      const numMatch = invoiceNumber.match(/FAC-(\d+)/);
      if (numMatch) {
         const num = parseInt(numMatch[1], 10);
         if (num >= newCounter) {
            newCounter = num + 1;
         }
      } else {
         newCounter += 1;
      }
      return { ...prev, invoiceCounter: newCounter };
    });
    
    setIsGenerating(false);
  };

  return (
    <div>
      <div className="glass" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Receipt size={18} /> Générateur de Factures
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="label">Commande à facturer</label>
            <select className="input" value={selectedOrderId} onChange={e => { setSelectedOrderId(e.target.value); setSelectedFloors(new Set()); }}>
              <option value="">— Sélectionner —</option>
              {orders.map(o => {
                const client = clients.find(c => c.id === o.clientId);
                return <option key={o.id} value={o.id}>{o.id} — {client?.nom || 'Client inconnu'}</option>;
              })}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Type de facture</label>
            <select className="input" value={invoiceType} onChange={e => { setInvoiceType(e.target.value); setSelectedFloors(new Set()); }}>
              <option value="global">Facture Globale (toutes unités réceptionnées)</option>
              <option value="partiel">Facture Partielle (par étage/appartement)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Numéro de facture</label>
            <input className="input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>
        </div>

        {/* Floor selector for partial */}
        {invoiceType === 'partiel' && selectedOrder && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              <Filter size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
              Sélectionner les étages / appartements
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {availableFloors.map(floor => {
                const isSelected = selectedFloors.has(floor);
                const floorUnits = allUnitsWithStatus.filter(u => u.floor === floor && u.isReceptionne);
                return (
                  <button key={floor} onClick={() => toggleFloor(floor)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: '0.5rem', border: isSelected ? '2px solid #0f4c75' : '1px solid #e2e8f0', background: isSelected ? '#eff6ff' : 'white', cursor: 'pointer', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f4c75' : '#64748b', fontSize: '0.85rem' }}>
                    {isSelected && <CheckCircle size={13} />}
                    Étage: {floor}
                    <span style={{ fontSize: '0.7rem', background: floorUnits.length > 0 ? '#dbeafe' : '#f1f5f9', color: floorUnits.length > 0 ? '#1d4ed8' : '#94a3b8', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                      {floorUnits.length} unité{floorUnits.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview table */}
        {selectedOrder && filteredUnits.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                Aperçu — {filteredUnits.length} unité(s) réceptionnée(s)
              </h3>
              <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>HT: {totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD | TVA: {totalTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD | </span>
                <strong style={{ color: '#0f4c75', fontSize: '1rem' }}>TTC: {totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong>
              </div>
            </div>
            <div className="table-responsive">
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Repère</th>
                    <th>Type</th>
                    <th>Étage</th>
                    <th>Dimensions</th>
                    <th>Prix U. HT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td>{u.label}</td>
                      <td>{u.floor}</td>
                      <td>{u.dimensions} mm</td>
                      <td style={{ fontWeight: 600 }}>{(u.unitPriceHT || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedOrder && filteredUnits.length === 0 && (
          <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', color: '#d97706', fontSize: '0.9rem', marginBottom: '1rem' }}>
            ⚠️ Aucune unité réceptionnée trouvée pour la sélection actuelle. Vérifiez les statuts dans l'onglet Expédition.
          </div>
        )}

        <button
          onClick={generateInvoicePDF}
          disabled={isGenerating || filteredUnits.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', background: filteredUnits.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #0f4c75, #1b6ca8)', color: 'white', border: 'none', borderRadius: '0.6rem', cursor: filteredUnits.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem' }}
        >
          <Download size={18} /> {isGenerating ? 'Génération...' : 'Générer la Facture PDF'}
        </button>
      </div>

      {/* Info about auto-billing */}
      <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #a7f3d0', fontSize: '0.85rem', color: '#065f46' }}>
        <strong>💡 Astuce :</strong> La facture partielle vous permet de facturer uniquement les unités réceptionnées et validées par étage ou appartement depuis l'onglet <strong>Expédition & Colisage</strong>. Le montant est calculé automatiquement selon les prix unitaires de la commande.
      </div>
    </div>
  );
};

export default InvoiceGenerator;
