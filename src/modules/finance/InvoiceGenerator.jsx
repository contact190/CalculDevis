import React, { useState, useMemo } from 'react';
import { Receipt, Download, Filter, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';

const InvoiceGenerator = ({ data, setData, quoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [invoiceType, setInvoiceType] = useState('global'); // 'global' | 'partiel'
  const [selectedFloors, setSelectedFloors] = useState(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState(`FAC-${Date.now().toString().slice(-6)}`);
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
    doc.setFillColor(15, 76, 117);
    doc.rect(0, 0, pw, 55, 'F');
    doc.setTextColor(255, 255, 255);

    // Logo / Company
    if (quoteSettings?.logoBase64) {
      try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, 8, 30, 20); } catch (e) {}
    }
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', pw - 15, 18, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(invoiceNumber, pw - 15, 25, { align: 'right' });
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, pw - 15, 31, { align: 'right' });
    doc.text(invoiceType === 'partiel' ? `Facture Partielle — Étages : ${[...selectedFloors].join(', ')}` : 'Facture Globale', pw - 15, 37, { align: 'right' });

    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(quoteSettings?.companyName || 'Votre Entreprise', 15, 22);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(quoteSettings?.companyAddress || '', 15, 28);
    doc.text([quoteSettings?.companyPhone, quoteSettings?.companyEmail].filter(Boolean).join(' | '), 15, 33);
    if (quoteSettings?.companyRC) doc.text(`RC: ${quoteSettings.companyRC}`, 15, 38);

    // ── Client Info ──
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Facturé à :', 15, 68);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(selectedClient?.nom || 'Client', 15, 74);
    doc.text(selectedClient?.adresse || '', 15, 79);
    doc.text([selectedClient?.telephone, selectedClient?.email].filter(Boolean).join(' | '), 15, 84);
    if (selectedClient?.nif) doc.text(`NIF: ${selectedClient.nif}`, 15, 89);

    // Command ref
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`Commande : ${selectedOrder.id}`, pw - 15, 68, { align: 'right' });
    if (selectedContract) doc.text(`Contrat : ${selectedContract.id}`, pw - 15, 74, { align: 'right' });

    // ── Table ──
    let y = 100;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y - 6, pw - 30, 10, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('REPÈRE', 18, y);
    doc.text('DESCRIPTION', 50, y);
    doc.text('ÉTAGE', 110, y);
    doc.text('DIMENSIONS', 130, y);
    doc.text('PRIX U. HT', 170, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    filteredUnits.forEach((unit, idx) => {
      if (y > ph - 50) { doc.addPage(); y = 25; }
      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(15, y - 4, pw - 30, 8, 'F');
      }
      doc.setFontSize(8);
      doc.text(unit.name, 18, y);
      doc.text(unit.label, 50, y);
      doc.text(unit.floor, 110, y);
      doc.text(unit.dimensions + ' mm', 130, y);
      doc.text(unit.unitPriceHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 }), pw - 15, y, { align: 'right' });
      y += 8;
    });

    // ── Totals ──
    y += 5;
    doc.setDrawColor(226, 232, 240); doc.line(15, y, pw - 15, y); y += 8;
    const drawTotal = (label, val, bold = false, color = [30, 41, 59]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 10 : 9);
      doc.setTextColor(...color);
      doc.text(label, pw - 80, y);
      doc.text(val.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DZD', pw - 15, y, { align: 'right' });
      y += 7;
    };
    drawTotal('Total HT :', totalHT);
    drawTotal(`TVA (${tvaRate}%) :`, totalTVA);
    doc.setFillColor(15, 76, 117);
    doc.rect(pw - 90, y - 5, 75, 10, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TTC :', pw - 80, y + 1);
    doc.text(totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DZD', pw - 15, y + 1, { align: 'right' });
    y += 20;

    // ── Footer ──
    if (y < ph - 40) {
      doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.setFont('helvetica', 'italic');
      doc.text(quoteSettings?.footerText || 'Merci de votre confiance.', pw / 2, ph - 15, { align: 'center' });
    }

    doc.save(`${invoiceNumber}_${selectedOrder.id}.pdf`);
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
