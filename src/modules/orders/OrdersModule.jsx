import React, { useState, useMemo } from 'react';
import { ShoppingBag, FileText, Ruler, Plus, Trash2, CheckCircle, Package, Scissors, Download, ExternalLink, ChevronRight, ChevronDown, ListOrdered, ShoppingCart, Layers, ArrowLeft, ClipboardList, Settings, Copy } from 'lucide-react';
import { FormulaEngine } from '../../engine/formula-engine';
import { QuoteSettingsPanel } from '../commercial/CommercialModule';
import jsPDF from 'jspdf';

const OrdersModule = ({ data, setData, quoteSettings, setQuoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [activeOrderTab, setActiveOrderTab] = useState('measurements'); // 'measurements', 'batches', 'purchasing', 'glass'
  const [selectedBatchId, setSelectedBatchId] = useState('current'); // 'current' or batch index
  const [showSettings, setShowSettings] = useState(false);
  const [listView, setListView] = useState('active'); // 'active' | 'history'
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [editingShutterOverrides, setEditingShutterOverrides] = useState(null); // { itemIdx, mId, overrides: {} }
  
  // Jumelage (Couplage) states
  const [jumelageGroups, setJumelageGroups] = useState([]);
  const [jumelageMode, setJumelageMode] = useState(false);
  const [jumelageSelection, setJumelageSelection] = useState(new Set());

  const handleJumelageToggle = (key) => {
    setJumelageSelection(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleConfirmJumelage = () => {
    if (jumelageSelection.size < 2) return;
    const selectedKeys = Array.from(jumelageSelection);
    
    // Remove selected keys from any existing groups
    const cleanedGroups = jumelageGroups
      .map(g => g.filter(k => !selectedKeys.includes(k)))
      .filter(g => g.length > 1);
      
    setJumelageGroups([...cleanedGroups, selectedKeys]);
    setJumelageSelection(new Set());
    setJumelageMode(false);
  };

  const handleDissolveGroup = (groupIndex) => {
    setJumelageGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };
  
  const engine = useMemo(() => new FormulaEngine(data || {}), [data]);
  
  const getOrderStats = (order) => {
    const items = order.items || [];
    const totalQty = items.reduce((s, i) => s + (i.qty || 1), 0);
    const producedQty = (order.batches || []).reduce((sum, b) => {
      return sum + (b.items || []).reduce((isum, bi) => {
        return isum + (bi.measurements || []).reduce((msum, m) => msum + m.qty, 0);
      }, 0);
    }, 0);
    return { totalQty, producedQty, remaining: totalQty - producedQty };
  };

  const orders = useMemo(() => {
    const all = data?.orders || [];
    return all.filter(o => {
      const { remaining } = getOrderStats(o);
      const isHistory = remaining <= 0 && (o.batches?.length > 0 || o.status === 'Terminé / Historique');
      return listView === 'history' ? isHistory : !isHistory;
    });
  }, [data?.orders, listView]);

  const selectedOrder = (data?.orders || []).find(o => o.id === selectedOrderId);

  const handleUpdateOrder = (updatedOrder) => {
    setData(prev => ({
      ...prev,
      orders: prev.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o)
    }));
  };

  const handleDeleteOrder = () => {
    if (!orderToDelete) return;
    if (confirmText !== orderToDelete.id) return;

    setData(prev => ({
      ...prev,
      orders: (prev.orders || []).filter(o => o.id !== orderToDelete.id)
    }));
    setOrderToDelete(null);
    setConfirmText('');
    alert("Commande supprimée.");
  };

  const addSiteMeasurement = (orderItemIndex) => {
    if (!selectedOrder) return;
    const item = selectedOrder.items[orderItemIndex];
    
    // Default to quote dimensions
    const newMeasure = {
      id: `MEAS-${Date.now()}`,
      L: item.config.L,
      H: item.config.H,
      qty: 1
    };
    
    const updatedItems = [...selectedOrder.items];
    updatedItems[orderItemIndex] = {
      ...item,
      siteMeasurements: [...(item.siteMeasurements || []), newMeasure]
    };
    
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
  };

  const removeSiteMeasurement = (orderItemIndex, measureId) => {
    const updatedItems = [...selectedOrder.items];
    updatedItems[orderItemIndex] = {
      ...updatedItems[orderItemIndex],
      siteMeasurements: updatedItems[orderItemIndex].siteMeasurements.filter(m => m.id !== measureId)
    };
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
  };

  const updateSiteMeasurement = (orderItemIndex, measureId, field, value) => {
    if (!selectedOrder) return;
    const updatedItems = [...selectedOrder.items];
    updatedItems[orderItemIndex] = {
      ...updatedItems[orderItemIndex],
      siteMeasurements: updatedItems[orderItemIndex].siteMeasurements.map(m => 
        m.id === measureId ? { ...m, [field]: (['partOverrides', 'shutterOverrides', 'label'].includes(field) ? value : (parseFloat(value) || 0)) } : m
      )
    };
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
  };

  const duplicateSiteMeasurement = (orderItemIndex, measureId) => {
    if (!selectedOrder) return;
    const updatedItems = [...selectedOrder.items];
    const sourceMeasure = updatedItems[orderItemIndex].siteMeasurements.find(m => m.id === measureId);
    if (!sourceMeasure) return;

    const newMeasure = {
      ...sourceMeasure,
      id: `MEAS-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      label: `${sourceMeasure.label || ''} (copie)`.trim(),
      qty: 1 // Force qty 1 for the new row
    };

    updatedItems[orderItemIndex] = {
      ...updatedItems[orderItemIndex],
      siteMeasurements: [...updatedItems[orderItemIndex].siteMeasurements, newMeasure]
    };
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
  };

  const handleLaunchProductionBatch = () => {
    const totalCurrentQty = selectedOrder.items.reduce((sum, item) => 
      sum + (item.siteMeasurements || []).reduce((s, m) => s + m.qty, 0), 0
    );

    if (totalCurrentQty === 0) {
      alert("Veuillez saisir au moins une cote réelle avant de lancer la fabrication.");
      return;
    }

    if (!window.confirm(`Voulez-vous valider la fabrication pour ce lot de ${totalCurrentQty} unités ?`)) return;

    const newBatch = {
      id: `BATCH-${(selectedOrder.batches?.length || 0) + 1}`,
      name: `Lot N°${(selectedOrder.batches?.length || 0) + 1}`,
      createdAt: new Date().toISOString(),
      items: selectedOrder.items.map(i => ({
        id: i.id,
        label: i.label,
        config: i.config,
        measurements: [...(i.siteMeasurements || [])]
      }))
    };

    const updatedOrder = {
      ...selectedOrder,
      batches: [...(selectedOrder.batches || []), newBatch],
      // Reset draft measurements
      items: selectedOrder.items.map(i => ({ ...i, siteMeasurements: [] })),
      status: (selectedOrder.batches?.length || 0) === 0 ? 'En Fabrication' : selectedOrder.status
    };

    // Check if fully produced
    const stats = getOrderStats(updatedOrder);
    if (stats.remaining <= 0) {
      updatedOrder.status = 'Terminé / Historique';
    }

    handleUpdateOrder(updatedOrder);
    setSelectedBatchId(newBatch.id);
    setActiveOrderTab('purchasing');
    alert(`Lot de fabrication validé !`);
  };

  // --- Calculations ---
  
  // Aggregate all BOMs from site measurements
  const siteResults = useMemo(() => {
    if (!selectedOrder) return { profiles: [], accessories: [], glass: [] };

    const allProfiles = [];
    const allAccessories = [];
    const allGlass = [];

    let itemsToProcess = [];
    if (selectedBatchId === 'current') {
      itemsToProcess = selectedOrder.items.map(i => ({
        ...i,
        measurements: i.siteMeasurements || []
      }));
    } else {
      const batch = selectedOrder.batches?.find(b => b.id === selectedBatchId);
      if (batch) itemsToProcess = batch.items || [];
    }

    itemsToProcess.forEach(item => {
      (item.measurements || []).forEach(m => {
        if (m.qty <= 0) return;
        
        const config = { ...item.config, L: m.L, H: m.H, partOverrides: m.partOverrides, shutterOverrides: m.shutterOverrides };
        try {
          const bom = engine.calculateBOM(config);
          
          bom.profiles.forEach(p => {
             const key = `${p.id}-${item.config.colorId}`;
             const existing = allProfiles.find(x => x.key === key);
             if (existing) {
               existing.totalMeasure += p.length * p.qty * m.qty;
             } else {
               allProfiles.push({ 
                 ...p, 
                 key, 
                 colorId: item.config.colorId,
                 totalMeasure: p.length * p.qty * m.qty 
               });
             }
          });

          const accs = [...(bom.accessories || [])];
          if (bom.gasket) accs.push(bom.gasket);
          (bom.shutters || []).forEach(s => { if (s.priceUnit !== 'ML') accs.push(s); });

          accs.forEach(a => {
            const key = `${a.id}-${item.config.colorId}`;
            const existing = allAccessories.find(x => x.key === key);
            if (existing) {
              existing.totalQty += a.qty * m.qty;
              existing.totalMeasure += (a.totalMeasure || 0) * m.qty;
            } else {
              allAccessories.push({ 
                ...a, 
                key, 
                colorId: item.config.colorId,
                totalQty: a.qty * m.qty,
                totalMeasure: (a.totalMeasure || 0) * m.qty
              });
            }
          });

          const glassPanels = bom.glassDetails || (bom.glass ? [bom.glass] : []);
          glassPanels.forEach(g => {
            const key = `${g.id}-${Math.round(g.width)}-${Math.round(g.height)}`;
            const existing = allGlass.find(x => x.key === key);
            if (existing) {
              existing.count += (g.qty || 1) * m.qty;
            } else {
              allGlass.push({
                ...g,
                key,
                itemId: item.id,
                itemLabel: item.label,
                count: (g.qty || 1) * m.qty
              });
            }
          });

        } catch (e) { console.error("Calc error", e); }
      });
    });

    return { profiles: allProfiles, accessories: allAccessories, glass: allGlass };
  }, [selectedOrder, selectedBatchId, engine]);

  const displayProfiles = useMemo(() => {
    const raw = siteResults.profiles;
    const handledKeys = new Set(jumelageGroups.flat());
    const rows = [];

    // Merged groups
    jumelageGroups.forEach((groupKeys, idx) => {
      const members = raw.filter(p => groupKeys.includes(p.key));
      if (members.length > 0) {
        rows.push({
          key: `GROUP-${idx}`,
          isGroup: true,
          label: `COUPLE: ${members.map(p => p.label || p.name).join(' + ')}`,
          name: members.map(p => p.name).join(' + '),
          totalMeasure: members.reduce((s, p) => s + p.totalMeasure, 0),
          colorId: members[0].colorId,
          groupKeys
        });
      }
    });

    // Individual
    raw.forEach(p => {
      if (!handledKeys.has(p.key)) rows.push(p);
    });

    return rows;
  }, [siteResults.profiles, jumelageGroups]);

  const generateGlassOrderPDF = () => {
    if (!selectedOrder) return;
    const client = data?.clients?.find(c => c.id === selectedOrder.clientId);
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header Branding
    if (quoteSettings?.logoBase64) {
      try {
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 35, 20);
      } catch (e) { console.error("Logo error", e); }
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(quoteSettings?.companyName || 'MA SOCIETE', 55, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(quoteSettings?.companyAddress || '', 55, y + 10);
    doc.text(`${quoteSettings?.companyPhone || ''} ${quoteSettings?.companyEmail ? ' | ' + quoteSettings.companyEmail : ''}`, 55, y + 15);
    
    y += 25;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('BON DE COMMANDE VITRAGE', pw / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 12;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Commande N°: ${selectedOrder.id}`, 15, y);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, pw - 15, y, { align: 'right' });
    y += 6;
    doc.text(`Client Final: ${client?.nom || 'Non spécifié'}`, 15, y);
    y += 10;

    // Table Header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, pw - 30, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Désignation / Type de Verre', 20, y + 5.5);
    doc.text('Largeur', 110, y + 5.5);
    doc.text('Hauteur', 140, y + 5.5);
    doc.text('Qté', 175, y + 5.5);
    y += 8;

    // Table Body
    doc.setFont('helvetica', 'normal');
    siteResults.glass.forEach((g, i) => {
      doc.line(15, y + 7, pw - 15, y + 7);
      doc.text(String(g.name), 20, y + 5);
      doc.text(`${Math.round(g.width)} mm`, 110, y + 5);
      doc.text(`${Math.round(g.height)} mm`, 140, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${g.count}`, 175, y + 5);
      doc.setFont('helvetica', 'normal');
      y += 7;
      if (y > 270) { doc.addPage(); y = 15; }
    });

    y += 15;
    doc.text('Observations :', 15, y);
    doc.rect(15, y + 2, pw - 30, 20);
    
    y += 30;
    doc.text('Cachet et Signature', pw - 60, y);

    doc.save(`BC_Vitrage_${selectedOrder.id}.pdf`);
  };

  const generateProformaPDF = () => {
    if (!selectedOrder) return;
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header Branding
    if (quoteSettings?.logoBase64) {
      try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 35, 20); } catch (e) {}
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(quoteSettings?.companyName || 'MA SOCIETE', 55, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(quoteSettings?.companyAddress || '', 55, y + 10);
    doc.text(`${quoteSettings?.companyPhone || ''} ${quoteSettings?.companyEmail ? ' | ' + quoteSettings.companyEmail : ''}`, 55, y + 15);
    y += 25;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('DEMANDE DE PRIX / PROFORMA', pw / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 12;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Proforma liée à la commande : ${selectedOrder.id}`, 15, y);
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, pw - 15, y, { align: 'right' });
    y += 15;

    // Section: Profiles
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 246, 255);
    doc.rect(15, y, pw - 30, 8, 'F');
    doc.text('1. PROFILÉS ALUMINIUM', 20, y + 5.5);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Désignation / Couleur', 15, y);
    doc.text('Quantité (ML)', 130, y, { align: 'right' });
    doc.text('Est. Barres', 175, y, { align: 'right' });
    y += 2;
    doc.line(15, y, pw - 15, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    displayProfiles.forEach(p => {
      const color = data.colors?.find(c => c.id === p.colorId)?.name || p.colorId;
      doc.text(`${p.isGroup ? p.label : (p.name + (p.label ? ` [${p.label}]` : ''))} (${color})`, 15, y);
      doc.text((p.totalMeasure / 1000).toFixed(2), 130, y, { align: 'right' });
      doc.text(String(Math.ceil(p.totalMeasure / 6000)), 175, y, { align: 'right' });
      y += 6;
      if (y > 270) { doc.addPage(); y = 15; }
    });

    y += 10;

    // Section: Accessories
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 246, 255);
    doc.rect(15, y, pw - 30, 8, 'F');
    doc.text('2. ACCESSOIRES & JOINTS', 20, y + 5.5);
    y += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Désignation', 15, y);
    doc.text('Unité', 130, y, { align: 'right' });
    doc.text('Quantité', 175, y, { align: 'right' });
    y += 2;
    doc.line(15, y, pw - 15, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    siteResults.accessories.forEach(a => {
      doc.text(String(a.name), 15, y);
      doc.text(String(a.unit), 130, y, { align: 'right' });
      const qtyStr = ['M', 'ML', 'JOINT'].includes((a.unit || '').toUpperCase()) 
        ? `${(a.totalMeasure / 1000).toFixed(2)} m` 
        : String(a.totalQty);
      doc.text(qtyStr, 175, y, { align: 'right' });
      y += 6;
      if (y > 270) { doc.addPage(); y = 15; }
    });

    y += 20;
    doc.setFontSize(10);
    doc.text('Merci de nous faire parvenir votre meilleure offre de prix pour ces articles.', 15, y);
    
    y += 40;
    doc.setFont('helvetica', 'bold');
    doc.text('Signature et Cachet', pw - 60, y);

    doc.save(`Proforma_${selectedOrder.id}.pdf`);
  };

  if (selectedOrderId && selectedOrder) {
    const client = data?.clients?.find(c => c.id === selectedOrder.clientId);
    
    return (
      <div className="animate-fade-in">
        <header className="flex-header">
          <button onClick={() => setSelectedOrderId(null)} className="btn" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Commande {selectedOrder.id}</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Basé sur le devis {selectedOrder.quoteNumber} | Client: {client?.nom || 'Inconnu'}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
             <span style={{ padding: '0.4rem 0.8rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
               Statut: {selectedOrder.status}
             </span>
          </div>
        </header>

        {/* Tabs */}
        <div className="tabs-container flex-wrap">
          {[
            { id: 'measurements', label: 'Prise de Mesures', icon: Ruler },
            { id: 'batches', label: 'Lots Validés', icon: ClipboardList },
            { id: 'purchasing', label: 'Liste d\'Achat', icon: ShoppingCart },
            { id: 'glass', label: 'Vitrage / Commande', icon: Layers },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveOrderTab(tab.id)}
              className={`tab-button ${activeOrderTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>

        {activeOrderTab === 'measurements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {selectedOrder.items.map((item, idx) => {
              const alreadyBatchQty = (selectedOrder.batches || []).reduce((sum, b) => {
                const bItem = b.items?.find(bi => bi.id === item.id);
                return sum + (bItem?.measurements || []).reduce((s, m) => s + m.qty, 0);
              }, 0);
              const currentDraftQty = (item.siteMeasurements || []).reduce((sum, m) => sum + m.qty, 0);
              const remaining = (item.qty || 1) - alreadyBatchQty - currentDraftQty;
              
              return (
                <div key={item.id} className="glass shadow-sm" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{item.label}</h3>
                      <p style={{ margin: '0.2rem 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Devis: <strong>{item.qty || 1} u</strong> | Produit: <strong>{alreadyBatchQty} u</strong> | <span style={{ color: '#3b82f6' }}>En cours: <strong>{currentDraftQty} u</strong></span>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Reste à produire:</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: remaining > 0 ? '#3b82f6' : (remaining < 0 ? '#ef4444' : '#10b981') }}>
                        {remaining}
                      </span>
                    </div>
                  </div>

                  {/* Measurements Table */}
                  <table className="data-table" style={{ background: '#f8fafc', marginBottom: '1rem' }}>
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th style={{ width: '150px' }}>Nom / Emplacement</th>
                        <th>Largeur (mm)</th>
                        <th>Hauteur (mm)</th>
                        <th>Quantité</th>
                        <th style={{ width: '80px' }}>Volet</th>
                        <th style={{ width: '50px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.siteMeasurements || []).map((m, mIdx) => (
                        <React.Fragment key={m.id}>
                          <tr>
                            <td>{mIdx + 1}</td>
                            <td><input type="text" className="input" placeholder="Ex: Salon" value={m.label || ''} onChange={e => updateSiteMeasurement(idx, m.id, 'label', e.target.value)} style={{ minWidth: '120px' }} /></td>
                            <td><input type="number" className="input" value={m.L} onChange={e => updateSiteMeasurement(idx, m.id, 'L', e.target.value)} style={{ minWidth: '100px' }} /></td>
                            <td><input type="number" className="input" value={m.H} onChange={e => updateSiteMeasurement(idx, m.id, 'H', e.target.value)} style={{ minWidth: '100px' }} /></td>
                            <td><input type="number" className="input" value={m.qty} onChange={e => updateSiteMeasurement(idx, m.id, 'qty', e.target.value)} style={{ minWidth: '80px' }} /></td>
                            <td style={{ textAlign: 'center' }}>
                              {item.config.hasShutter && (
                                <button 
                                  onClick={() => setEditingShutterOverrides({ itemIdx: idx, mId: m.id, overrides: m.shutterOverrides || {} })}
                                  style={{ 
                                    border: '1px solid #e2e8f0', 
                                    background: (m.shutterOverrides && Object.keys(m.shutterOverrides).length > 0) ? '#fef3c7' : '#fff', 
                                    padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', 
                                    color: (m.shutterOverrides && Object.keys(m.shutterOverrides).length > 0) ? '#d97706' : '#64748b',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                  title="Réglages Volet"
                                >
                                  <Settings size={20} />
                                </button>
                              )}
                            </td>
                             <td>
                               <div style={{ display: 'flex', gap: '0.3rem' }}>
                                 <button onClick={() => duplicateSiteMeasurement(idx, m.id)} style={{ color: '#6366f1', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Dupliquer la ligne"><Copy size={16} /></button>
                                 <button onClick={() => removeSiteMeasurement(idx, m.id)} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Supprimer"><Trash2 size={16} /></button>
                               </div>
                             </td>
                          </tr>
                          {item.config.compoundType && item.config.compoundType !== 'none' && (
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              <td colSpan="5" style={{ padding: '0.5rem 1rem' }}>
                                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cotes des parties :</span>
                                  {(item.config.compoundConfig?.parts || []).map((p) => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ fontSize: '0.8rem', color: '#1e293b' }}>{p.type === 'opening' ? 'Ouvrant' : 'Fixe'} :</span>
                                      <input 
                                        type="number" 
                                        className="input" 
                                        style={{ width: '90px', padding: '0.2rem 0.5rem', fontSize: '0.8rem', border: '1px solid #cbd5e1' }} 
                                        placeholder={item.config.compoundConfig.orientation === 'horizontal' ? p.width : p.height}
                                        value={m.partOverrides?.[p.id]?.[item.config.compoundConfig.orientation === 'horizontal' ? 'width' : 'height'] || ''} 
                                        onChange={e => {
                                          const val = parseFloat(e.target.value) || 0;
                                          const field = item.config.compoundConfig.orientation === 'horizontal' ? 'width' : 'height';
                                          const currentOverrides = m.partOverrides || {};
                                          const partData = currentOverrides[p.id] || {};
                                          updateSiteMeasurement(idx, m.id, 'partOverrides', { ...currentOverrides, [p.id]: { ...partData, [field]: val } });
                                        }}
                                      />
                                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>mm</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {(!item.siteMeasurements || item.siteMeasurements.length === 0) && (
                        <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Aucune cote réelle ajoutée.</td></tr>
                      )}
                    </tbody>
                  </table>

                  <button 
                    onClick={() => addSiteMeasurement(idx)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                    disabled={remaining <= 0}
                  >
                    <Plus size={14} /> Ajouter une cote réelle
                  </button>
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '0.75rem', border: '1px dashed #3b82f6' }}>
               <button 
                onClick={handleLaunchProductionBatch}
                className="btn btn-primary"
                style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
               >
                 <CheckCircle size={18} /> VALIDER ET LANCER LA FABRICATION (LOT EN COURS)
               </button>
            </div>
          </div>
        )}

        {activeOrderTab === 'batches' && (
          <div className="glass shadow-md">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Historique des Lots de Fabrication</h3>
            <div className="table-responsive">
               <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code Lot</th>
                      <th>Date de Lancement</th>
                      <th>Produits inclus</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.batches || []).map(batch => (
                      <tr key={batch.id}>
                        <td data-label="Lot" style={{ fontWeight: 700 }}>{batch.id}</td>
                        <td data-label="Date">{new Date(batch.createdAt).toLocaleString('fr-FR')}</td>
                        <td data-label="Produits">
                           {batch.items?.map(i => {
                             const q = (i.measurements || []).reduce((s, m) => s+m.qty, 0);
                             if (q === 0) return null;
                             return <div key={i.id} style={{ fontSize: '0.8rem' }}>• {i.label} : <strong>{q} u</strong></div>
                           })}
                        </td>
                         <td data-label="Actions">
                           <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                             <button onClick={() => { setSelectedBatchId(batch.id); setActiveOrderTab('purchasing'); }} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                               Liste Achat
                             </button>
                             <button onClick={() => { setSelectedBatchId(batch.id); setActiveOrderTab('glass'); }} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                               Liste Vitrage
                             </button>
                           </div>
                         </td>
                      </tr>
                    ))}
                    {(selectedOrder.batches || []).length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Aucun lot validé pour le moment.</td></tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {(activeOrderTab === 'purchasing' || activeOrderTab === 'glass') && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
             <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>🎯 Affichage des besoins pour :</span>
             <select 
               className="input" 
               value={selectedBatchId} 
               onChange={(e) => setSelectedBatchId(e.target.value)}
               style={{ width: 'auto', fontWeight: 700 }}
             >
               <option value="current">Lot en cours (Brouillon)</option>
               {(selectedOrder.batches || []).map(b => (
                 <option key={b.id} value={b.id}>{b.name} ({new Date(b.createdAt).toLocaleDateString()})</option>
               ))}
             </select>
          </div>
        )}

        {activeOrderTab === 'purchasing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass shadow-md" style={{ borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>Liste d'Achat : Profilés</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={generateProformaPDF} style={{ fontSize: '0.8rem', background: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Download size={14} /> Demande Proforma
                    </button>
                    {jumelageMode ? (
                      <>
                        <button className="btn btn-secondary" onClick={() => { setJumelageMode(false); setJumelageSelection(new Set()); }} style={{ fontSize: '0.8rem' }}>Annuler</button>
                        <button className="btn btn-primary" onClick={handleConfirmJumelage} disabled={jumelageSelection.size < 2} style={{ fontSize: '0.8rem', background: '#10b981' }}>Confirmer le Couplage ({jumelageSelection.size})</button>
                      </>
                    ) : (
                      <button className="btn btn-secondary" onClick={() => setJumelageMode(true)} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Layers size={14} /> Mode Couplage (Consolider)
                      </button>
                    )}
                  </div>
                </div>
               <div className="table-responsive">
                  <table className="data-table">
                     <thead>
                       <tr>
                         {jumelageMode && <th style={{ width: '40px' }}>Select</th>}
                         <th>Code</th>
                         <th>Désignation</th>
                         <th>Couleur</th>
                         <th>Total (ML)</th>
                         <th>Est. Barres (6m)</th>
                         {jumelageGroups.length > 0 && <th style={{ width: '50px' }}>Action</th>}
                       </tr>
                     </thead>
                     <tbody>
                       {displayProfiles.map(p => (
                         <tr key={p.key} style={{ background: p.isGroup ? '#f5f3ff' : 'transparent' }}>
                           {jumelageMode && (
                             <td data-label="Sél." style={{ textAlign: 'center' }}>
                               {!p.isGroup && (
                                 <input 
                                   type="checkbox" 
                                   checked={jumelageSelection.has(p.key)} 
                                   onChange={() => handleJumelageToggle(p.key)} 
                                   style={{ width: '18px', height: '18px' }}
                                 />
                               )}
                             </td>
                           )}
                           <td data-label="Code" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.id || '---'}</td>
                           <td data-label="Nom" style={{ fontWeight: 600 }}>
                             {p.isGroup ? (
                               <div style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                 <Layers size={14} />
                                 {p.label}
                               </div>
                             ) : (
                               <>{p.name} {p.label ? `[${p.label}]` : ''}</>
                             )}
                           </td>
                           <td data-label="Coul.">{data.colors?.find(c => c.id === p.colorId)?.name || p.colorId}</td>
                           <td data-label="ML" style={{ fontWeight: 700, color: p.isGroup ? '#7c3aed' : '#8b5cf6' }}>{(p.totalMeasure / 1000).toFixed(2)}</td>
                           <td data-label="Barres">{Math.ceil(p.totalMeasure / 6000)}</td>
                           {jumelageGroups.length > 0 && (
                             <td data-label="Actions">
                               {p.isGroup && (
                                 <button onClick={() => handleDissolveGroup(p.key.split('-')[1])} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }} title="Dissoudre le groupe">
                                   <Trash2 size={16} />
                                 </button>
                               )}
                             </td>
                           )}
                         </tr>
                       ))}
                     </tbody>
                  </table>
                </div>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b' }}>
               <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Accessoires & Joints</h3>
               <table className="data-table">
                 <thead>
                   <tr>
                     <th>Désignation</th>
                     <th>Unité</th>
                     <th>Quantité Totale</th>
                   </tr>
                 </thead>
                 <tbody>
                   {siteResults.accessories.map(a => (
                     <tr key={a.key}>
                       <td style={{ fontWeight: 600 }}>{a.name}</td>
                       <td style={{ fontSize: '0.8rem' }}>{a.unit}</td>
                       <td style={{ fontWeight: 700, color: '#d97706' }}>
                         {['M', 'ML', 'JOINT'].includes((a.unit || '').toUpperCase()) 
                            ? `${(a.totalMeasure / 1000).toFixed(2)} m` 
                            : a.totalQty}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {activeOrderTab === 'glass' && (
           <div className="glass shadow-md" style={{ borderLeft: '4px solid #06b6d4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>Bon de Commande Vitrage</h3>
                <button className="btn btn-primary" onClick={generateGlassOrderPDF} style={{ background: '#06b6d4', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={16} /> Exporter Bon de Commande
                </button>
              </div>
              <table className="data-table">
                 <thead>
                   <tr>
                     <th>Type de Vitrage</th>
                     <th>Dimensions (L x H) mm</th>
                     <th>Quantité</th>
                     <th>Provenance (Produit)</th>
                   </tr>
                 </thead>
                 <tbody>
                   {siteResults.glass.map((g, i) => (
                     <tr key={i}>
                       <td style={{ fontWeight: 700 }}>{g.name}</td>
                       <td style={{ fontFamily: 'monospace' }}>{g.width} x {g.height}</td>
                       <td style={{ fontWeight: 800, color: '#0891b2' }}>{g.count} u</td>
                       <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{g.itemLabel}</td>
                     </tr>
                   ))}
                 </tbody>
              </table>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {showSettings && (
        <QuoteSettingsPanel 
          settings={quoteSettings} 
          onSave={setQuoteSettings} 
          onClose={() => setShowSettings(false)} 
          title="Paramètres Bon de Commande"
        />
      )}
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Gestion des Commandes</h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>Transformez vos devis en ordres de fabrication et gérez vos approvisionnements.</p>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem' }}
        >
          <Settings size={16} /> Entête / Logo
        </button>
      </header>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setListView('active')}
          style={{ 
            padding: '0.6rem 1.2rem', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: listView === 'active' ? '2px solid #2563eb' : '2px solid transparent',
            color: listView === 'active' ? '#2563eb' : '#64748b', fontWeight: 600, fontSize: '0.95rem'
          }}
        >
          <ClipboardList size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Commandes Actives
        </button>
        <button 
          onClick={() => setListView('history')}
          style={{ 
            padding: '0.6rem 1.2rem', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: listView === 'history' ? '2px solid #2563eb' : '2px solid transparent',
            color: listView === 'history' ? '#2563eb' : '#64748b', fontWeight: 600, fontSize: '0.95rem'
          }}
        >
          <Package size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Historique
        </button>
      </div>
      <div className="glass shadow-md">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID Commande</th>
              <th>N° Devis</th>
              <th>Client</th>
              <th>Date Création</th>
              <th>Produits</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <ClipboardList size={32} opacity={0.3} />
                    <span>Aucune commande {listView === 'history' ? 'dans l\'historique' : 'active'}.</span>
                  </div>
                </td>
              </tr>
            )}
            {orders.map(order => {
              const client = data?.clients?.find(c => c.id === order.clientId);
              return (
                <tr key={order.id}>
                  <td style={{ fontWeight: 700 }}>{order.id}</td>
                  <td>{order.quoteNumber}</td>
                  <td style={{ fontWeight: 600 }}>{client?.nom || 'Inconnu'}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <strong>{order.items?.length || 0}</strong> réf. 
                    <span style={{ color: '#64748b', marginLeft: '0.5rem' }}>
                      ({order.items?.reduce((s, i) => s + (i.qty || 1), 0)} u)
                    </span>
                  </td>
                  <td>
                    <span style={{ padding: '0.2rem 0.6rem', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        onClick={() => setSelectedOrderId(order.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        Détails / Cotes
                      </button>
                      <button 
                        onClick={() => setOrderToDelete(order)}
                        style={{ padding: '0.4rem', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '4px', background: '#fef2f2', cursor: 'pointer' }}
                        title="Supprimer la commande"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(data.orders || []).length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  Aucune commande en cours. Allez dans "Clients" pour transformer un devis en commande.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {orderToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass shadow-2xl" style={{ background: 'white', padding: '2.5rem', borderRadius: '1.25rem', width: '450px', border: '1px solid #fee2e2' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Trash2 size={30} color="#ef4444" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Supprimer la commande ?</h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                Cette action est irréversible. Toutes les données de fabrication et d'historique seront perdues.
              </p>
            </div>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                Veuillez saisir l'ID de la commande pour confirmer :
              </p>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', textAlign: 'center', margin: '0.5rem 0' }}>
                {orderToDelete.id}
              </div>
              <input 
                autoFocus
                className="input"
                placeholder="Recopiez l'ID ici..."
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                style={{ textAlign: 'center', borderColor: confirmText === orderToDelete.id ? '#10b981' : '#e2e8f0' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => { setOrderToDelete(null); setConfirmText(''); }}
                style={{ flex: 1, padding: '0.8rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: 'white', fontWeight: 600, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button 
                onClick={handleDeleteOrder}
                disabled={confirmText !== orderToDelete.id}
                style={{ 
                  flex: 1, padding: '0.8rem', borderRadius: '0.75rem', border: 'none', 
                  background: confirmText === orderToDelete.id ? '#ef4444' : '#94a3b8', 
                  color: 'white', fontWeight: 700, cursor: confirmText === orderToDelete.id ? 'pointer' : 'not-allowed' 
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHUTTER OVERRIDE MODAL */}
      {editingShutterOverrides && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="glass shadow-2xl" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', width: '500px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Réglages Volet (Cote Réelle)</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="label">Largeur Volet (LV) Manuelle</label>
                <input 
                  type="number" 
                  className="input" 
                  placeholder="Auto"
                  value={editingShutterOverrides.overrides.customLV || ''} 
                  onChange={e => setEditingShutterOverrides(prev => ({ ...prev, overrides: { ...prev.overrides, customLV: parseFloat(e.target.value) || undefined } }))}
                />
              </div>

              <div className="form-group">
                <label className="label">Hauteur Caisson (HC)</label>
                <input 
                  type="number" 
                  className="input" 
                  placeholder="Auto"
                  value={editingShutterOverrides.overrides.customHC || ''} 
                  onChange={e => setEditingShutterOverrides(prev => ({ ...prev, overrides: { ...prev.overrides, customHC: parseFloat(e.target.value) || undefined } }))}
                />
              </div>

              <div className="form-group">
                <label className="label">Modèle Caisson</label>
                <select 
                  className="input"
                  value={editingShutterOverrides.overrides.caissonId || ''}
                  onChange={e => setEditingShutterOverrides(prev => ({ ...prev, overrides: { ...prev.overrides, caissonId: e.target.value || undefined } }))}
                >
                  <option value="">(Config Devis)</option>
                  {(data.shutterComponents?.caissons || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Type de Lame</label>
                <select 
                  className="input"
                  value={editingShutterOverrides.overrides.lameId || ''}
                  onChange={e => setEditingShutterOverrides(prev => ({ ...prev, overrides: { ...prev.overrides, lameId: e.target.value || undefined } }))}
                >
                  <option value="">(Config Devis)</option>
                  {(data.shutterComponents?.lames || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Modèle Glissière</label>
                <select 
                  className="input"
                  value={editingShutterOverrides.overrides.glissiereId || ''}
                  onChange={e => setEditingShutterOverrides(prev => ({ ...prev, overrides: { ...prev.overrides, glissiereId: e.target.value || undefined } }))}
                >
                  <option value="">(Config Devis)</option>
                  {(data.shutterComponents?.glissieres || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Type d'Axe</label>
                <select 
                  className="input"
                  value={editingShutterOverrides.overrides.axeId || ''}
                  onChange={e => setEditingShutterOverrides(prev => ({ ...prev, overrides: { ...prev.overrides, axeId: e.target.value || undefined } }))}
                >
                  <option value="">(Config Devis)</option>
                  {(data.shutterComponents?.axes || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Kit Manoeuvre</label>
                <select 
                  className="input"
                  value={editingShutterOverrides.overrides.kitId || ''}
                  onChange={e => setEditingShutterOverrides(prev => ({ ...prev, overrides: { ...prev.overrides, kitId: e.target.value || undefined } }))}
                >
                  <option value="">(Config Devis)</option>
                  {(data.shutterComponents?.kits || []).map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setEditingShutterOverrides(null)} 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
              >
                Annuler
              </button>
              <button 
                onClick={() => {
                  updateSiteMeasurement(editingShutterOverrides.itemIdx, editingShutterOverrides.mId, 'shutterOverrides', editingShutterOverrides.overrides);
                  setEditingShutterOverrides(null);
                }} 
                className="btn btn-primary" 
                style={{ flex: 1 }}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersModule;
