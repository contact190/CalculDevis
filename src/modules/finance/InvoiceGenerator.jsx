import React, { useState, useMemo, useEffect } from 'react';
import { Receipt, Download, Filter, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const InvoiceGenerator = ({ data, setData, quoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [invoiceType, setInvoiceType] = useState('global'); // 'global' | 'partiel'
  const [selectedFloors, setSelectedFloors] = useState(new Set());
  const currentCounter = data.invoiceCounter || 1;
  const [invoiceNumber, setInvoiceNumber] = useState(String(currentCounter).padStart(2, '0'));
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setInvoiceNumber(String(currentCounter).padStart(2, '0'));
  }, [currentCounter]);

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
    
    // Split names
    const companyNameLines = doc.splitTextToSize(quoteSettings?.companyName || 'Mon Entreprise', boxWidth - 6);
    const clientNameLines = doc.splitTextToSize(selectedClient?.nom || 'Client', boxWidth - 6);

    // Calculate required height for Left Box
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

    // Calculate required height for Right Box
    let cyRight = boxY + 11 + (clientNameLines.length * 4) + 1;
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
    doc.text(clientNameLines, rightBoxXHeader + 3, boxY + 11);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cly = boxY + 11 + (clientNameLines.length * 4) + 1;
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
    y = boxY + boxHeight + 6;

    const formatPricePDF = (val) => val.toLocaleString('fr-FR', { minimumFractionDigits: 2 }).replace(/[\s\u202F\u00A0]/g, ' ');

    // Use autoTable matching the Shop invoices style
    const tableColumn = ["Désignation", "Dimensions", "Quantité", "P.U. HT", "Total HT"];
    const tableRows = filteredUnits.map(u => [
      `${u.name}\n${u.label}`,
      u.dimensions ? `${u.dimensions} mm` : '-',
      "1 pces",
      `${formatPricePDF(u.unitPriceHT)} DZD`,
      `${formatPricePDF(u.unitPriceHT)} DZD`
    ]);

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

    // Cachet
    if (quoteSettings?.cachetBase64) {
      if (finalY > ph - 40) { doc.addPage(); finalY = 20; }
      try { doc.addImage(quoteSettings.cachetBase64, 'PNG', 25, finalY, 35, 35); } catch (e) {}
    }

    doc.save(`Facture_${invoiceNumber}_${selectedOrder.id}.pdf`);
    
    setData(prev => {
      let newCounter = prev.invoiceCounter || 1;
      const num = parseInt(invoiceNumber, 10);
      if (!isNaN(num)) {
         if (num >= newCounter) {
            newCounter = num + 1;
         }
      } else {
         newCounter += 1;
      }

      // Save invoice record for the invoice list
      const newRecord = {
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        invoiceNumber,
        clientId: selectedClient?.id,
        clientName: selectedClient?.nom || 'Client inconnu',
        orderId: selectedOrder.id,
        date: new Date().toISOString(),
        montantHT: totalHT,
        montantTTC: totalTTC,
        tvaRate,
        type: invoiceType === 'global' ? 'Globale' : 'Partielle',
        unitsCount: filteredUnits.length,
      };
      const existingRecords = prev.invoiceRecords || [];

      return { ...prev, invoiceCounter: newCounter, invoiceRecords: [...existingRecords, newRecord] };
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

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={generateInvoicePDF}
            disabled={isGenerating || filteredUnits.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', background: filteredUnits.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #0f4c75, #1b6ca8)', color: 'white', border: 'none', borderRadius: '0.6rem', cursor: filteredUnits.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.95rem' }}
          >
            <Download size={18} /> {isGenerating ? 'Génération...' : 'Générer la Facture PDF'}
          </button>
          <button
            onClick={() => {
              if (window.confirm("Réinitialiser le compteur de facture à 01 ?")) {
                setData(prev => ({ ...prev, invoiceCounter: 1 }));
              }
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}
            title="Réinitialiser l'ordre des factures à 01"
          >
            Réinitialiser l'ordre
          </button>
        </div>
      </div>

      {/* Info about auto-billing */}
      <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.75rem', border: '1px solid #a7f3d0', fontSize: '0.85rem', color: '#065f46' }}>
        <strong>💡 Astuce :</strong> La facture partielle vous permet de facturer uniquement les unités réceptionnées et validées par étage ou appartement depuis l'onglet <strong>Expédition & Colisage</strong>. Le montant est calculé automatiquement selon les prix unitaires de la commande.
      </div>
    </div>
  );
};

export default InvoiceGenerator;
