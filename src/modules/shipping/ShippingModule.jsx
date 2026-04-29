import React, { useState, useMemo } from 'react';
import { Truck, Package, QrCode, CheckCircle, AlertTriangle, XCircle, Download, Search, Plus, Trash2, ArrowLeft, ClipboardCheck, UserCheck, ShieldCheck, Layers, Wrench, FileText } from 'lucide-react';
import jsPDF from 'jspdf';

const ShippingModule = ({ data, setData }) => {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState(new Set()); // Multiple batches selection
  const [activeView, setActiveView] = useState('list'); // 'list' | 'details' | 'scanner'
  const [scanningMode, setScanningMode] = useState(null); // 'loading' | 'unloading' | 'installing'
  
  const shippableOrders = useMemo(() => {
    return (data.orders || []).filter(order => order.batches && order.batches.length > 0);
  }, [data.orders]);

  const selectedOrder = useMemo(() => {
    return (data.orders || []).find(o => o.id === selectedOrderId);
  }, [data.orders, selectedOrderId]);

  const allUnits = useMemo(() => {
    if (!selectedOrder) return [];
    const units = [];
    (selectedOrder.batches || []).forEach(batch => {
      if (selectedBatchIds.size > 0 && !selectedBatchIds.has(batch.id)) return;
      (batch.items || []).forEach(item => {
        (item.measurements || []).forEach(m => {
          for (let i = 0; i < m.qty; i++) {
            const unitId = `${selectedOrder.id}-${batch.id}-${item.id}-${m.id}-${i}`;
            const name = m.instanceNames?.[i] || `${item.label} #${i + 1}`;
            const status = selectedOrder.unitStatuses?.[unitId] || 'Produit';
            units.push({
              id: unitId,
              orderId: selectedOrder.id,
              batchId: batch.id,
              itemId: item.id,
              mId: m.id,
              index: i,
              name: name,
              label: item.label,
              dimensions: `${m.L} x ${m.H}`,
              status: status,
              shutter: m.shutterList?.[i] ? 'Oui' : 'Non'
            });
          }
        });
      });
    });
    return units;
  }, [selectedOrder, selectedBatchIds]);

  const handleUpdateUnitStatus = (unitId, newStatus) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const statuses = { ...(order.unitStatuses || {}) };
      statuses[unitId] = newStatus;
      order.unitStatuses = statuses;
      orders[oIdx] = order;
      return { ...prev, orders };
    });
  };

  const handleScanUnit = (id) => {
    const unit = allUnits.find(u => u.id === id);
    if (!unit) {
      alert("ERREUR : Code inconnu ou lot non sélectionné !");
      return 'error';
    }
    if (scanningMode === 'loading') {
      if (unit.status === 'Chargé') { alert("ATTENTION : Déjà chargé !"); return 'warning'; }
      handleUpdateUnitStatus(id, 'Chargé');
      return 'success';
    }
    if (scanningMode === 'unloading') {
      handleUpdateUnitStatus(id, 'Livré');
      return 'success';
    }
    if (scanningMode === 'installing') {
      handleUpdateUnitStatus(id, 'Posé');
      return 'success';
    }
  };

  const generatePackingLabels = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [100, 150] });
    allUnits.forEach((unit, idx) => {
      if (idx > 0) doc.addPage([100, 150], 'landscape');
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 150, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('ETIQUETTE DE COLISAGE', 75, 10, { align: 'center' });
      doc.setTextColor(0, 0, 0); doc.setFontSize(12);
      doc.text(`Client: ${selectedOrder.clientName || '---'}`, 10, 25);
      doc.text(`Commande: ${selectedOrder.id}`, 10, 32);
      doc.text(`Lot: ${unit.batchId}`, 10, 39);
      doc.setLineWidth(0.5); doc.line(10, 45, 140, 45);
      doc.setFontSize(18); doc.text(unit.name, 75, 58, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Produit: ${unit.label}`, 10, 75);
      doc.text(`Dimensions: ${unit.dimensions} mm`, 10, 82);
      doc.text(`Volet: ${unit.shutter}`, 10, 89);
      doc.setDrawColor(200, 200, 200); doc.rect(110, 55, 30, 30);
      doc.setFontSize(8); doc.text('SCAN QR', 125, 80, { align: 'center' });
      doc.text(unit.id, 125, 88, { align: 'center' });
      doc.setFontSize(9); doc.setTextColor(100, 100, 100);
      doc.text('Logiciel CalculDevis PRO - Traçabilité Totale', 75, 95, { align: 'center' });
    });
    doc.save(`Etiquettes_Trace_${selectedOrder.id}.pdf`);
  };

  const generateInstallationSheet = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pw, 40, 'F');
    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('FICHE DE POSE', pw / 2, 20, { align: 'center' });
    doc.setFontSize(10); doc.text('DOCUMENT DE TRAVAIL TERRAIN', pw / 2, 28, { align: 'center' });
    
    doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`Client : ${selectedOrder.clientName}`, 15, 50);
    doc.text(`Commande N° : ${selectedOrder.id}`, 15, 57);
    doc.text(`Date Impression : ${new Date().toLocaleDateString()}`, pw - 15, 50, { align: 'right' });
    
    doc.line(15, 65, pw - 15, 65);
    
    let y = 75;
    // Table Header
    doc.setFont('helvetica', 'bold');
    doc.text('A poser', 15, y);
    doc.text('Repère / Emplacement', 35, y);
    doc.text('Dimensions', 110, y);
    doc.text('Observations / Remarques', 150, y);
    
    y += 4; doc.line(15, y, pw - 15, y); y += 8;
    
    doc.setFont('helvetica', 'normal');
    allUnits.forEach(u => {
      // Checkbox
      doc.rect(18, y - 4, 5, 5); 
      
      doc.text(u.name, 35, y);
      doc.text(u.dimensions, 110, y);
      doc.setDrawColor(200); doc.line(150, y, pw - 15, y); doc.setDrawColor(0);
      
      y += 10;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('Validation Chef d\'Équipe', 15, y);
    doc.text('Visa Client', pw - 40, y);
    
    doc.save(`Fiche_Pose_${selectedOrder.id}.pdf`);
  };

  const generateDeliveryNote = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('BON DE LIVRAISON', pw / 2, 20, { align: 'center' });
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, 35);
    doc.text(`Commande N°: ${selectedOrder.id}`, 15, 42);
    doc.text(`Client: ${selectedOrder.clientName || '---'}`, 15, 49);
    doc.line(15, 55, pw - 15, 55);
    let y = 65;
    doc.setFont('helvetica', 'bold');
    doc.text('Qté', 15, y); doc.text('Désignation Produit', 30, y); doc.text('Repère', 120, y); doc.text('Statut', 180, y);
    y += 5; doc.line(15, y, pw - 15, y); y += 8;
    doc.setFont('helvetica', 'normal');
    allUnits.forEach(u => {
      doc.text('1', 15, y); doc.text(u.label.substring(0, 35), 30, y); doc.text(u.name, 120, y);
      doc.text(u.status === 'Livré' || u.status === 'Posé' ? 'REÇU' : '---', 180, y);
      y += 8; if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 20; doc.setFont('helvetica', 'bold');
    doc.text('Date et Signature Client (Précédée de "Bon pour réception")', 15, y);
    doc.rect(15, y + 5, 180, 40);
    doc.save(`BL_${selectedOrder.id}.pdf`);
  };

  if (selectedOrderId && activeView !== 'list') {
    const stats = {
      total: allUnits.length,
      produit: allUnits.filter(u => u.status === 'Produit').length,
      chargé: allUnits.filter(u => u.status === 'Chargé').length,
      livré: allUnits.filter(u => u.status === 'Livré').length,
      posé: allUnits.filter(u => u.status === 'Posé').length
    };

    const toggleBatchSelection = (id) => {
      setSelectedBatchIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    return (
      <div className="animate-fade-in">
        <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => { setSelectedOrderId(null); setSelectedBatchIds(new Set()); setActiveView('list'); }} className="btn" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Suivi Logistique : {selectedOrder.id}</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Chargement, Livraison et Pose</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
             <button onClick={generatePackingLabels} className="btn btn-secondary" disabled={allUnits.length === 0}><QrCode size={16} /> Étiquettes</button>
             <button onClick={generateInstallationSheet} className="btn btn-secondary" disabled={allUnits.length === 0}><FileText size={16} /> Fiche de Pose</button>
             <button onClick={generateDeliveryNote} className="btn btn-primary" disabled={allUnits.length === 0}><Download size={16} /> Bon de Livraison (BL)</button>
          </div>
        </header>

        <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', background: '#f8fafc' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}><Layers size={14} /> SÉLECTION DES LOTS :</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(selectedOrder.batches || []).map(batch => {
              const isActive = selectedBatchIds.has(batch.id);
              return (
                <button key={batch.id} onClick={() => toggleBatchSelection(batch.id)} className="btn" style={{ background: isActive ? '#3b82f6' : 'white', color: isActive ? 'white' : '#64748b', borderColor: isActive ? '#3b82f6' : '#e2e8f0', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isActive ? <CheckCircle size={14} /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #cbd5e1' }} />} Lot : {batch.id}
                </button>
              );
            })}
          </div>
        </div>

        {allUnits.length === 0 ? (
          <div className="glass" style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
            <Layers size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
            <p>Sélectionnez un lot pour commencer le suivi.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: 'Total', val: stats.total, color: '#1e293b', icon: Package },
                { label: 'Prêts', val: stats.produit, color: '#f59e0b', icon: ClipboardCheck },
                { label: 'Chargés', val: stats.chargé, color: '#3b82f6', icon: Truck },
                { label: 'Livrés', val: stats.livré, color: '#10b981', icon: UserCheck },
                { label: 'Posés', val: stats.posé, color: '#8b5cf6', icon: Wrench },
              ].map((s, i) => (
                <div key={i} className="glass" style={{ padding: '1rem', borderBottom: `4px solid ${s.color}` }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>

            <div className="glass shadow-md" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontWeight: 700 }}>Contrôle par Scanner</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button onClick={() => { setScanningMode('loading'); setActiveView('scanner'); }} className="btn btn-secondary" style={{ background: scanningMode === 'loading' ? '#3b82f6' : 'white', color: scanningMode === 'loading' ? 'white' : 'inherit' }}><Truck size={14} /> Chargement</button>
                   <button onClick={() => { setScanningMode('unloading'); setActiveView('scanner'); }} className="btn btn-secondary" style={{ background: scanningMode === 'unloading' ? '#10b981' : 'white', color: scanningMode === 'unloading' ? 'white' : 'inherit' }}><UserCheck size={14} /> Livraison</button>
                   <button onClick={() => { setScanningMode('installing'); setActiveView('scanner'); }} className="btn btn-secondary" style={{ background: scanningMode === 'installing' ? '#8b5cf6' : 'white', color: scanningMode === 'installing' ? 'white' : 'inherit' }}><Wrench size={14} /> Pose</button>
                </div>
              </div>
              <table className="data-table">
                <thead><tr><th>Unité</th><th>Repère</th><th>Produit</th><th>Statut Actuel</th><th>Actions</th></tr></thead>
                <tbody>
                  {allUnits.map(unit => (
                    <tr key={unit.id}>
                      <td style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{unit.id.split('-').pop()}</td>
                      <td style={{ fontWeight: 700 }}>{unit.name}</td>
                      <td>{unit.label}</td>
                      <td><span style={{ padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, 
                        background: unit.status === 'Posé' ? '#ede9fe' : (unit.status === 'Livré' ? '#d1fae5' : (unit.status === 'Chargé' ? '#dbeafe' : '#fef3c7')),
                        color: unit.status === 'Posé' ? '#5b21b6' : (unit.status === 'Livré' ? '#065f46' : (unit.status === 'Chargé' ? '#1e40af' : '#92400e')) }}>{unit.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => handleUpdateUnitStatus(unit.id, 'Chargé')} className="btn btn-secondary" style={{ padding: '0.2rem' }} title="Charger"><Truck size={14} /></button>
                          <button onClick={() => handleUpdateUnitStatus(unit.id, 'Livré')} className="btn btn-secondary" style={{ padding: '0.2rem' }} title="Livrer"><UserCheck size={14} /></button>
                          <button onClick={() => handleUpdateUnitStatus(unit.id, 'Posé')} className="btn btn-secondary" style={{ padding: '0.2rem' }} title="Poser"><Wrench size={14} /></button>
                          <button onClick={() => handleUpdateUnitStatus(unit.id, 'Produit')} className="btn btn-secondary" style={{ padding: '0.2rem' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeView === 'scanner' && (
           <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
             <div className="glass" style={{ background: 'white', padding: '3rem', borderRadius: '2rem', textAlign: 'center', maxWidth: '500px', width: '90%' }}>
                <div style={{ width: '80px', height: '80px', background: scanningMode === 'loading' ? '#3b82f6' : (scanningMode === 'unloading' ? '#10b981' : '#8b5cf6'), color: 'white', borderRadius: '20px', display: 'grid', placeItems: 'center', margin: '0 auto 1.5rem' }}><QrCode size={40} /></div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Scanner : {scanningMode === 'loading' ? 'Chargement' : (scanningMode === 'unloading' ? 'Livraison' : 'Pose On-Site')}</h2>
                <input autoFocus placeholder="Scanner le code..." className="input" style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 700, padding: '1rem' }} onKeyDown={(e) => { if (e.key === 'Enter') { handleScanUnit(e.target.value); e.target.value = ''; } }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
                  <button onClick={() => setActiveView('details')} className="btn btn-secondary">Terminer</button>
                  <button onClick={() => { const pending = allUnits.find(u => scanningMode === 'loading' ? u.status === 'Produit' : (scanningMode === 'unloading' ? u.status === 'Chargé' : u.status === 'Livré')); if (pending) handleScanUnit(pending.id); }} className="btn btn-primary">Simuler Scan</button>
                </div>
             </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Suivi Expédition & Pose</h1>
        <p style={{ color: '#64748b' }}>Traçabilité totale de l'atelier jusqu'à la fixation finale.</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {shippableOrders.map(order => {
          const stats = (order.batches || []).reduce((acc, b) => {
            (b.items || []).forEach(i => acc.total += (i.measurements || []).reduce((s, m) => s + m.qty, 0));
            return acc;
          }, { total: 0 });
          const loaded = Object.values(order.unitStatuses || {}).filter(s => s === 'Chargé' || s === 'Livré' || s === 'Posé').length;
          const progress = stats.total > 0 ? (loaded / stats.total) * 100 : 0;
          return (
            <div key={order.id} className="glass shadow-md card-hover" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => { setSelectedOrderId(order.id); setActiveView('details'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', background: '#eff6ff', color: '#3b82f6', borderRadius: '12px', display: 'grid', placeItems: 'center' }}><Truck size={24} /></div>
                <span style={{ padding: '0.3rem 0.75rem', background: progress === 100 ? '#d1fae5' : '#fef3c7', color: progress === 100 ? '#065f46' : '#92400e', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{progress === 100 ? 'PRÊT' : 'EN COURS'}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{order.id} - {order.clientName}</h3>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginTop: '1rem' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10b981' : '#3b82f6', transition: 'width 0.4s ease' }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShippingModule;
