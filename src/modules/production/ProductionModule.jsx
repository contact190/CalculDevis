import React, { useState, useMemo } from 'react';
import { Package, Scissors, Ruler, Download, CheckCircle, Barcode, ShoppingCart, Layers, Edit2, Link2, Link2Off, Plus, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FormulaEngine } from '../../engine/formula-engine';
import { DEFAULT_DATA } from '../../data/default-data';
import jsPDF from 'jspdf';

const ProductionModule = ({ currentConfig, currentQuote, database, setData }) => {
  const engine = useMemo(() => new FormulaEngine(database), [database]);
  const [activeTab, setActiveTab] = useState('debit');
  const [barLengths, setBarLengths] = useState({});
  const [jumelageGroups, setJumelageGroups] = useState([]);
  const [jumelageMode, setJumelageMode] = useState(false);
  const [jumelageSelection, setJumelageSelection] = useState(new Set());
  // 'total' = consolidated, or an item ID for a single product
  const [productFilter, setProductFilter] = useState('total');
  // Kitting / Logistics
  const [kitConfig, setKitConfig] = useState({ trolleys: 2, slotsPerTrolley: 10 });
  const [selectedLabelItem, setSelectedLabelItem] = useState(null);

  // Prise de mesures states
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedGlobalQuoteId, setSelectedGlobalQuoteId] = useState(currentQuote?.id || '');

  const activeQuote = useMemo(() => {
    const allSources = [...(database?.quotes || []), ...(database?.orders || [])];
    return allSources.find(q => q.id === selectedGlobalQuoteId) || currentQuote;
  }, [database?.quotes, database?.orders, selectedGlobalQuoteId, currentQuote]);

  const quoteItems = activeQuote?.items || [];

  // Determine which config(s) to aggregate
  const activeConfigs = useMemo(() => {
    if (quoteItems.length === 0) {
      // Fallback: single currentConfig
      return currentConfig ? [{ config: currentConfig, qty: 1, label: 'Produit courant' }] : [];
    }
    if (productFilter === 'total') return quoteItems.map(i => ({ config: i.config, qty: i.qty || 1, label: i.label }));
    const found = quoteItems.find(i => i.id === productFilter);
    return found ? [{ config: found.config, qty: found.qty || 1, label: found.label }] : [];
  }, [quoteItems, productFilter, currentConfig]);

  const bomResult = useMemo(() => {
    const cfg = activeConfigs[0]?.config || currentConfig;
    if (!cfg) return { bom: null, error: null };
    try { 
      const b = engine.calculateBOM(cfg); 
      return { bom: b, error: null };
    } catch (e) { 
      console.error(e); 
      return { bom: null, error: e.message || 'Erreur inattendue' }; 
    }
  }, [activeConfigs, engine, currentConfig]);
  
  const bom = bomResult.bom;

  // Derived arrays for Purchasing List
  const purchasingProfiles = useMemo(() => {
    const map = {};
    activeConfigs.forEach(({ config: cfg, qty: cfgQty }) => {
      const colorInfo = database.colors?.find(c => c.id === cfg.colorId);
      const colorName = colorInfo?.name || cfg.colorId || 'Standard';
      try {
        const b = engine.calculateBOM(cfg);
        // Standard profiles
        b.profiles.forEach(p => {
          const mapKey = `${p.id}|${colorName}`;
          const displayName = p.name ? `${p.name} ${p.label ? `[${p.label}]` : ''}` : (p.label || '');
          const measure = p.length * p.qty * cfgQty;
          const newPieces = Array(p.qty * cfgQty).fill(p.length);
          if (!map[mapKey]) {
            map[mapKey] = { ...p, originalNames: new Set([displayName]), totalMeasure: measure, pieces: newPieces, colorName };
          } else {
            map[mapKey].totalMeasure += measure;
            map[mapKey].pieces.push(...newPieces);
            map[mapKey].originalNames.add(displayName);
          }
        });
        // Shutter profiles (ML base)
        (b.shutters || []).forEach(s => {
          if (s.priceUnit === 'ML') {
            const mapKey = `${s.id}|${colorName}`;
            const measure = (s.qty || 0) * cfgQty * 1000; // Convert to mm for consistency
            const newPieces = Array(cfgQty).fill((s.qty || 0) * 1000);
            if (!map[mapKey]) {
              map[mapKey] = { ...s, originalNames: new Set([s.name]), totalMeasure: measure, pieces: newPieces, colorName };
            } else {
              map[mapKey].totalMeasure += measure;
              map[mapKey].pieces.push(...newPieces);
              map[mapKey].originalNames.add(s.name);
            }
          }
        });
      } catch {}
    });
    return Object.values(map).map(item => ({
      ...item,
      // For jumelage later we will use original base ref for id, but unique id is key
      baseId: item.id,
      id: `${item.id}|${item.colorName}`,
      combinedName: Array.from(item.originalNames).filter(Boolean).join(' / ')
    }));
  }, [activeConfigs, engine, database.colors]);

  const purchasingAccessories = useMemo(() => {
    const map = {};
    activeConfigs.forEach(({ config: cfg, qty: cfgQty }) => {
      const colorInfo = database.colors?.find(c => c.id === cfg.colorId);
      const colorName = colorInfo?.name || cfg.colorId || 'Standard';
      try {
        const b = engine.calculateBOM(cfg);
        const items = [...(b.accessories || [])];
        if (b.gasket) items.push(b.gasket);
        // Add non-profile shutter items
        (b.shutters || []).forEach(s => {
          if (s.priceUnit !== 'ML') items.push(s);
        });

        items.forEach(a => {
          const mapKey = `${a.id}|${colorName}`;
          const displayName = a.name ? `${a.name} ${a.label ? `[${a.label}]` : ''}` : (a.label || '');
          if (!map[mapKey]) {
            map[mapKey] = { ...a, originalNames: new Set([displayName]), totalMeasure: (a.totalMeasure || 0) * cfgQty, totalQty: (a.qty || 0) * cfgQty, colorName };
          } else {
            map[mapKey].totalMeasure += (a.totalMeasure || 0) * cfgQty;
            map[mapKey].totalQty += (a.qty || 0) * cfgQty;
            map[mapKey].originalNames.add(displayName);
          }
        });
      } catch {}
    });
    return Object.values(map).map(item => ({
      ...item,
      baseId: item.id,
      id: `${item.id}|${item.colorName}`,
      combinedName: Array.from(item.originalNames).filter(Boolean).join(' / ')
    }));
  }, [activeConfigs, engine, database.colors]);

  const purchasingGlass = useMemo(() => {
    const map = {};
    activeConfigs.forEach(({ config: cfg, qty: cfgQty }) => {
      const colorInfo = database.colors?.find(c => c.id === cfg.colorId);
      const colorName = colorInfo?.name || cfg.colorId || 'Standard';
      try {
        const b = engine.calculateBOM(cfg);
        (b.glassDetails || []).forEach(g => {
          const w = Math.round(g.width || 0);
          const h = Math.round(g.height || 0);
          const mapKey = `${g.id}|${colorName}-${w}-${h}`;
          if (!map[mapKey]) {
            map[mapKey] = { ...g, width: w, height: h, count: (g.qty || 1) * cfgQty, colorName };
          } else {
            map[mapKey].count += (g.qty || 1) * cfgQty;
          }
        });
      } catch {}
    });
    return Object.values(map).map(item => ({...item, baseId: item.id}));
  }, [activeConfigs, engine, database.colors]);


  const handleBarLengthChange = (id, val) => {
    setBarLengths(prev => ({ ...prev, [id]: parseFloat(val) || 6400 }));
  };

  const handleJumelageToggle = (id) => {
    setJumelageSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirmJumelage = () => {
    if (jumelageSelection.size < 2) return;
    const ids = Array.from(jumelageSelection);
    // Remove these ids from any existing groups first
    const cleanedGroups = jumelageGroups
      .map(g => g.filter(id => !ids.includes(id)))
      .filter(g => g.length > 1);
    setJumelageGroups([...cleanedGroups, ids]);
    setJumelageSelection(new Set());
    setJumelageMode(false);
  };

  const handleDissolveGroup = (groupIndex) => {
    setJumelageGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };

  // Build the final display rows applying jumelage
  const displayProfiles = useMemo(() => {
    const handledIds = new Set(jumelageGroups.flat());
    const rows = [];

    // Add merged group rows first
    jumelageGroups.forEach((groupIds, gi) => {
      const members = purchasingProfiles.filter(p => groupIds.includes(p.id));
      if (members.length === 0) return;
      const totalMeasure = members.reduce((s, p) => s + p.totalMeasure, 0);
      const combinedId = members.map(p => p.id).join(' + ');
      const combinedName = members.map(p => p.combinedName || p.name).join(' + ');
      const firstBar = barLengths[members[0].id] || 6400;
      const allPieces = members.flatMap(m => m.pieces || []);
      rows.push({
        _isGroup: true,
        _groupIndex: gi,
        id: combinedId,
        combinedName,
        totalMeasure,
        pieces: allPieces,
        unitPrice: members[0].unitPrice,
        _barKey: members[0].id // use first member's ID for bar length setting
      });
    });

    // Add individual rows not in any group
    purchasingProfiles.forEach(p => {
      if (!handledIds.has(p.id)) rows.push(p);
    });

    return rows;
  }, [purchasingProfiles, jumelageGroups, barLengths]);

  const generatePDF = () => {
    const doc = jsPDF();
    doc.setFontSize(20);
    doc.text('ORDRE DE FABRICATION (OF)', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    const composition = database.compositions.find(c => c.id === currentConfig.compositionId);
    doc.text(`Modèle: ${composition?.name} (${currentConfig.compositionId}) | Dimensions: ${currentConfig.L} x ${currentConfig.H} mm`, 20, 30);
    
    let y = 45;
    doc.setFontSize(12);
    doc.text('LISTE DE DÉBIT PROFILÉS', 20, y);
    y += 10;
    
    doc.setFontSize(10);
    bom.profiles.forEach((p, i) => {
      doc.text(`${p.label}: ${Math.round(p.length)} mm | Coupe: ${p.cutAngle}° | Qté: ${p.qty} | ${p.name}`, 20, y);
      y += 7;
    });

    y += 10;
    doc.text('VITRAGES', 20, y);
    y += 7;
    doc.text(`${bom.glass.name}: ${currentConfig.L} x ${currentConfig.H} mm (Poids: ${bom.glass.weight.toFixed(1)} kg)`, 20, y);

    if (bom.shutters && bom.shutters.length > 0) {
      y += 15;
      doc.setFontSize(12);
      doc.text('COMPOSANTS DU VOLET', 20, y);
      y += 10;
      doc.setFontSize(10);
      bom.shutters.forEach(s => {
        doc.text(`${s.name}: ${s.qty?.toFixed(2)} ${s.priceUnit} | Formule: ${s.formula}`, 20, y);
        y += 7;
        if (y > 270) { doc.addPage(); y = 20; }
      });
    }

    doc.save(`OF_${currentConfig.compositionId}_${Date.now()}.pdf`);
  };

  const generatePurchasePDF = () => {
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Liste d'Achat : ${productFilter === 'total' ? 'Tous les produits (Consolidé)' : (quoteItems.find(i => i.id === productFilter)?.label || 'Produit')}`, 15, y);
    y += 15;

    // Profilés
    doc.setFontSize(13);
    doc.setTextColor(139, 92, 246); // purple-500
    doc.text('Profilés Aluminium', 15, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Référence', 15, y);
    doc.text('Finition', 55, y);
    doc.text('Désignation', 95, y);
    doc.text('L.Barre', 160, y);
    doc.text('Qté', 185, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    displayProfiles.forEach(p => {
       const barKey = p._barKey || p.baseId || p.id;
       const bLength = barLengths[barKey] || 6400;
       const ml = p.totalMeasure;
       // Bin Packing Algorithm (1D Nesting / Next Fit Decreasing)
       const pieces = p.pieces ? [...p.pieces].sort((a,b) => b - a) : [];
       let bars = 0;
       
       if (pieces.length > 0) {
         let currentBars = []; // store remaining lengths
         for (let i = 0; i < pieces.length; i++) {
           const piece = pieces[i];
           // Find best fit (Best Fit Decreasing)
           let bestIdx = -1;
           let minLeft = Infinity;
           for (let j = 0; j < currentBars.length; j++) {
             if (currentBars[j] >= piece && currentBars[j] - piece < minLeft) {
               bestIdx = j;
               minLeft = currentBars[j] - piece;
             }
           }
           if (bestIdx !== -1) {
             currentBars[bestIdx] -= piece;
           } else {
             currentBars.push(bLength - piece);
             bars++;
           }
         }
       } else {
         bars = Math.ceil(ml / bLength);
       }

       const ref = p._isGroup ? p.id.split(' + ').map(x => x.split('|')[0]).join(' + ') : p.baseId || p.id.split('|')[0];
       
       doc.text(String(ref).substring(0, 18), 15, y);
       doc.text(String(p._isGroup ? 'Varié' : p.colorName || 'Std').substring(0, 15), 55, y);
       doc.text(String(p.combinedName).substring(0, 30), 95, y);
       doc.text(`${bLength}mm`, 160, y);
       doc.setFont('helvetica', 'bold');
       doc.text(`${bars}`, 185, y);
       doc.setFont('helvetica', 'normal');
       y += 6;
       if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 10;
    if (y > 250) { doc.addPage(); y = 20; }

    // Accessoires
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11); // amber-500
    doc.text('Accessoires & Joints', 15, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(9);
    doc.text('Référence', 15, y);
    doc.text('Finition', 55, y);
    doc.text('Désignation', 95, y);
    doc.text('Long/ML', 160, y);
    doc.text('Qté', 185, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    purchasingAccessories.forEach(a => {
       const isMl = ['M', 'ML', 'JOINT'].includes((a.unit || '').toUpperCase());
       const ref = a.baseId || a.id.split('|')[0];
       
       doc.text(String(ref).substring(0, 18), 15, y);
       doc.text(String(a.colorName || 'Std').substring(0, 15), 55, y);
       doc.text(String(a.combinedName || 'Accessoire').substring(0, 30), 95, y);
       doc.text(isMl ? `${(a.totalMeasure / 1000).toFixed(2)}m` : '-', 160, y);
       doc.setFont('helvetica', 'bold');
       doc.text(!isMl ? `${a.totalQty}` : '-', 185, y);
       doc.setFont('helvetica', 'normal');
       y += 6;
       if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 10;
    if (y > 250) { doc.addPage(); y = 20; }

    // Vitrage
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 182, 212); // cyan-500
    doc.text('Vitrages', 15, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(9);
    doc.text('Référence', 15, y);
    doc.text('Finition', 55, y);
    doc.text('Désignation', 95, y);
    doc.text('Dimensions', 150, y);
    doc.text('Qté', 185, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    purchasingGlass.forEach(g => {
       const ref = g.baseId || g.id;
       doc.text(String(ref).substring(0, 18), 15, y);
       doc.text(String(g.colorName || 'Std').substring(0, 15), 55, y);
       doc.text(String(g.name || '').substring(0, 25), 95, y);
       doc.text(`${g.width} x ${g.height}`, 150, y);
       doc.setFont('helvetica', 'bold');
       doc.text(`${g.count}`, 185, y);
       doc.setFont('helvetica', 'normal');
       y += 6;
       if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.save(`Achat_${productFilter === 'total' ? 'Tous' : productFilter}.pdf`);
  };

  if (!currentConfig) return <div>Aucune configuration active. Sélectionnez ou configurez un devis dans la page Projet.</div>;
  if (activeTab === 'debit' && !bom) return (
     <div style={{ padding: '2rem', color: '#ef4444' }}>
       Impossible de générer le débit. Vérifiez les formules mathématiques dans l'Administration.
       <br/><br/>
       <strong>Détails techniques :</strong> {bomResult.error}
     </div>
  );

  return (
    <div className="animate-fade-in">
      <header className="flex-header">
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Module Production</h1>
          <p style={{ color: '#64748b' }}>Explosion de la recette, liste de débit et liste d'achat pour l'atelier.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={selectedGlobalQuoteId} 
            onChange={e => { setSelectedGlobalQuoteId(e.target.value); setProductFilter('total'); }}
            className="input"
            style={{ fontWeight: 600, maxWidth: '250px' }}
          >
            <option value="">Sélectionner un devis enregistré...</option>
            {currentQuote?.id && <option value={currentQuote.id}>Devis Actif (Non enregistré)</option>}
            {(database.quotes || []).map(q => {
              const client = database.clients?.find(c => c.id === q.clientId);
              return <option key={q.id} value={q.id}>{q.number} {client ? `- ${client.nom}` : ''}</option>;
            })}
          </select>
          <button onClick={generatePDF} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} />
            PDF Débit
          </button>
        </div>
      </header>

      <div className="tabs-container">
        {[
          { id: 'debit', label: 'Liste de Débit', icon: Scissors },
          { id: 'achat', label: 'Liste d\'Achat', icon: ShoppingCart },
          { id: 'logistique', label: 'Logistique Atelier', icon: Layers },
          { id: 'measure', label: 'Prise de Mesures', icon: Ruler },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Product Filter and PDF Export - Moved outside to apply to both pages */}
      {quoteItems.length > 0 && activeTab !== 'measure' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>📋 Produit à afficher :</span>
            <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="input" style={{ width: 'auto', fontWeight: 600 }}>
              <option value="total">🔢 Tous les produits (Achat uniquement)</option>
              {quoteItems.map(item => (
                <option key={item.id} value={item.id}>{item.label} — {item.config?.L}×{item.config?.H}mm (Qté: {item.qty})</option>
              ))}
            </select>
          </div>
          {activeTab === 'achat' && (
            <button onClick={generatePurchasePDF} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #cbd5e1' }}>
              <Download size={16} /> Exporter PDF Achat
            </button>
          )}
        </div>
      )}

      {activeTab === 'debit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Left: Cutting List */}
          <div className="glass shadow-md">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <Scissors size={20} color="#2563eb" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Liste de Débit Profilés {productFilter !== 'total' && `- ${(quoteItems.find(i=>i.id===productFilter)?.label)}`}</h2>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Repère</th>
                    <th>Désignation</th>
                    <th>Qté</th>
                    <th>Longueur</th>
                    <th>Angles</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.profiles.map((p, i) => (
                    <tr key={i}>
                      <td data-label="Repère" style={{ fontWeight: 600 }}>{p.label}</td>
                      <td data-label="Nom" style={{ fontSize: '0.875rem', color: '#64748b' }}>{p.name}</td>
                      <td data-label="Qté">{p.qty}</td>
                      <td data-label="Lg" style={{ color: '#2563eb', fontWeight: 700 }}>{Math.round(p.length)} mm</td>
                      <td data-label="Coupes">
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{p.cutAngle || 45}°</span>
                          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{p.cutAngle || 45}°</span>
                        </div>
                      </td>
                      <td data-label="QRCode">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <QRCodeSVG value={`OF-${currentConfig.compositionId}-P${i}-${p.length}mm`} size={24} level="L" />
                          <button className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Code-Barre Détail">
                            <Barcode size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Glass & Logistics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass shadow-md" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                <Package size={20} color="#3b82f6" />
                <h3 style={{ fontWeight: 600 }}>Vitrage (Aperçu global)</h3>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>{bom.glass.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem' }}>
                  <span>Dimensions du cadre :</span>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>{currentConfig.L} x {currentConfig.H} mm</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                  <span>Poids total estimé :</span>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>{bom.glass.weight.toFixed(1)} kg</span>
                </div>
              </div>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                <CheckCircle size={20} color="#10b981" />
                <h3 style={{ fontWeight: 600 }}>Statut Fabrication</h3>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                <p>Prêt pour lancement en production.</p>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: '#10b981', border: 'none' }}>
                  Lancer l'OF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'achat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Table: Achats Profilés */}
          <div className="glass shadow-md" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <Layers size={20} color="#8b5cf6" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, flex: 1 }}>Liste d'Achat : Profilés Aluminium</h2>
              {!jumelageMode ? (

                <button
                  onClick={() => { setJumelageMode(true); setJumelageSelection(new Set()); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: '1.5px solid #8b5cf6', background: 'transparent', color: '#8b5cf6', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  <Link2 size={15} /> Jumeler des profilés
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleConfirmJumelage}
                    disabled={jumelageSelection.size < 2}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: 'none', background: jumelageSelection.size >= 2 ? '#8b5cf6' : '#e2e8f0', color: jumelageSelection.size >= 2 ? 'white' : '#94a3b8', cursor: jumelageSelection.size >= 2 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.8rem' }}
                  >
                    <Plus size={15} /> Confirmer le jumelage ({jumelageSelection.size} sélectionnés)
                  </button>
                  <button
                    onClick={() => { setJumelageMode(false); setJumelageSelection(new Set()); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: '1.5px solid #94a3b8', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
            {jumelageMode && (
              <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7c3aed' }}>
                ℹ️ Cochez les profilés à jumeler ensemble, puis cliquez sur "Confirmer le jumelage".
              </div>
            )}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    {jumelageMode && <th style={{ width: '30px' }}></th>}
                    <th>Référence</th>
                    <th>Finition</th>
                    <th>Désignation</th>
                    <th>Longueur Barre (mm)</th>
                    <th>Quantité (Barres)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayProfiles.map((p, i) => {
                    const barKey = p._barKey || p.baseId || p.id;
                    const bLength = barLengths[barKey] || 6400;
                    const ml = p.totalMeasure;
                    // Bin Packing Algorithm (1D Nesting / Next Fit Decreasing)
                    const pieces = p.pieces ? [...p.pieces].sort((a,b) => b - a) : [];
                    let bars = 0;
                    
                    if (pieces.length > 0) {
                      let currentBars = [];
                      for (let i = 0; i < pieces.length; i++) {
                        const piece = pieces[i];
                        let bestIdx = -1;
                        let minLeft = Infinity;
                        for (let j = 0; j < currentBars.length; j++) {
                          if (currentBars[j] >= piece && currentBars[j] - piece < minLeft) {
                            bestIdx = j;
                            minLeft = currentBars[j] - piece;
                          }
                        }
                        if (bestIdx !== -1) {
                          currentBars[bestIdx] -= piece;
                        } else {
                          currentBars.push(bLength - piece);
                          bars++;
                        }
                      }
                    } else {
                      bars = Math.ceil(ml / bLength);
                    }
  
                    const isSelected = jumelageSelection.has(p.id);
                    const rowBg = p._isGroup ? '#faf5ff' : isSelected ? '#ede9fe' : 'transparent';
                    return (
                      <tr key={`pa-${i}`} style={{ background: rowBg }}>
                        {jumelageMode && !p._isGroup && (
                          <td data-label="Sélec.">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleJumelageToggle(p.id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                        )}
                        {jumelageMode && p._isGroup && <td data-label="-"></td>}
                        <td data-label="Réf." style={{ color: '#64748b', fontSize: '0.75rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p._isGroup ? p.id.split(' + ').map(x => x.split('|')[0]).join(' + ') : p.baseId || p.id.split('|')[0]}
                        </td>
                        <td data-label="Finition" style={{ fontSize: '0.85rem' }}>{p._isGroup ? 'Multicolore / Varié' : p.colorName || 'Standard'}</td>
                        <td data-label="Nom" style={{ fontWeight: 600 }}>
                          {p._isGroup && <span style={{ fontSize: '0.7rem', background: '#8b5cf6', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '999px', marginRight: '0.4rem' }}>Jumelé</span>}
                          {p.combinedName}
                          <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '0.2rem' }}>Total: {(ml / 1000).toFixed(2)} ML</div>
                        </td>
                        <td data-label="Lg. Barre">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input 
                              type="number" 
                              className="input" 
                              value={bLength}
                              onChange={(e) => handleBarLengthChange(barKey, e.target.value)}
                              style={{ width: '80px', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                            />
                            <Edit2 size={12} color="#94a3b8" />
                          </div>
                        </td>
                        <td data-label="Barres" style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '1.1rem' }}>{bars}</td>
                        <td data-label="Action">
                          {p._isGroup && (
                            <button
                              onClick={() => handleDissolveGroup(p._groupIndex)}
                              title="Annuler ce jumelage"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.2rem' }}
                            >
                              <Link2Off size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
  
                  {displayProfiles.length === 0 && <tr><td colSpan="7">Aucun profilé trouvé.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Achats Accessoires & Joints */}
          <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <Package size={20} color="#f59e0b" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Liste d'Achat : Accessoires & Joints</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Finition</th>
                    <th>Désignation</th>
                    <th>Longueur / M.L</th>
                    <th>Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasingAccessories.map((a, i) => {
                    const isMl = ['M', 'ML', 'JOINT'].includes((a.unit || '').toUpperCase());
                    return (
                      <tr key={`aa-${i}`}>
                        <td data-label="Réf." style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{a.baseId || a.id.split('|')[0]}</td>
                        <td data-label="Finition" style={{ fontSize: '0.85rem' }}>{a.colorName || 'Standard'}</td>
                        <td data-label="Nom" style={{ fontWeight: 600 }}>{a.combinedName || 'Accessoire'}</td>
                        <td data-label="Lg/ML">{isMl ? `${(a.totalMeasure / 1000).toFixed(2)} m` : '—'}</td>
                        <td data-label="Qté" style={{ color: '#f59e0b', fontWeight: 700 }}>
                          {!isMl ? a.totalQty : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {purchasingAccessories.length === 0 && <tr><td colSpan="5">Aucun accessoire trouvé.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Détails Vitrage */}
          <div className="glass shadow-md" style={{ borderLeft: '4px solid #06b6d4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <Layers size={20} color="#06b6d4" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Liste d'Achat : Vitrages Détaillés</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Finition</th>
                    <th>Désignation</th>
                    <th>Dimensions (L x H)</th>
                    <th>Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasingGlass.map((g, i) => (
                    <tr key={`ag-${i}`}>
                      <td data-label="Réf." style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{g.baseId || g.id}</td>
                      <td data-label="Finition" style={{ fontSize: '0.85rem' }}>{g.colorName || 'Standard'}</td>
                      <td data-label="Nom" style={{ fontWeight: 600 }}>{g.name}</td>
                      <td data-label="Dim." style={{ fontWeight: 500 }}>{g.width} x {g.height} mm</td>
                      <td data-label="Qté" style={{ color: '#06b6d4', fontWeight: 700 }}>{g.count}u</td>
                    </tr>
                  ))}
                  {purchasingGlass.length === 0 && <tr><td colSpan="5">Aucun vitrage détaillé trouvé.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ================================================================ */}
      {/* LOGISTIQUE ATELIER - Kitting & Sorting                           */}
      {/* ================================================================ */}
      {activeTab === 'logistique' && (() => {
        const totalSlots = kitConfig.trolleys * kitConfig.slotsPerTrolley;
        
        const globalCuts = []; 
        let itemsWithConfig = 0;
        let bomsCalculated = 0;
        let totalPiecesInBoms = 0;
        const requestedCompoIds = new Set();
        const missingCompoIds = new Set();

        quoteItems.forEach((item, winIdx) => {
          if (!item.config) return;
          const cId = item.config.compositionId;
          if (cId) {
             requestedCompoIds.add(cId);
             if (!database.compositions?.find(c => c.id === cId)) missingCompoIds.add(cId);
          }

          itemsWithConfig++;
          try {
            const b = engine.calculateBOM(item.config);
            if (b) bomsCalculated++;
            const qty = item.qty || 1;
            
            if (b.profiles && Array.isArray(b.profiles)) {
              b.profiles.forEach(p => {
                // Ensure qty is treated correctly: p.qty is pieces per window
                const piecesPerUnit = p.qty || 0;
                totalPiecesInBoms += (piecesPerUnit * qty);
                for (let q = 0; q < piecesPerUnit * qty; q++) {
                  globalCuts.push({
                    profileId: p.id,
                    profileName: p.name,
                    label: p.label,
                    length: Math.round(p.length),
                    windowIdx,
                    windowLabel: item.label || `Fenêtre #${winIdx + 1}`,
                    windowItemId: item.id,
                  });
                }
              });
            }
            // Shutter components
            if (b.shutters && Array.isArray(b.shutters)) {
              b.shutters.forEach(s => {
                if (s.priceUnit === 'ML' && s.qty > 0) {
                  const lenMm = Math.round((s.qty || 0) * 1000);
                  totalPiecesInBoms += qty;
                  for (let q = 0; q < qty; q++) {
                    globalCuts.push({
                      profileId: s.id,
                      profileName: s.name,
                      label: s.name,
                      length: lenMm,
                      windowIdx,
                      windowLabel: item.label || `Fenêtre #${winIdx + 1}`,
                      windowItemId: item.id,
                      isShutter: true,
                    });
                  }
                }
              });
            }
          } catch (err) {
            console.error("BOM Calculation error in Logistics:", err);
          }
        });

        // Group by profileId for per-bar optimization
        const profileGroups = {};
        globalCuts.forEach(cut => {
          if (!profileGroups[cut.profileId]) profileGroups[cut.profileId] = { profileName: cut.profileName, cuts: [] };
          profileGroups[cut.profileId].cuts.push(cut);
        });

        // Best-Fit Decreasing per profile group
        const barsResult = {};
        Object.entries(profileGroups).forEach(([profId, { profileName, cuts }]) => {
          const barLen = barLengths[profId] || 6400;
          const sorted = [...cuts].sort((a, b) => b.length - a.length);
          const bars = []; 
          const allLengths = cuts.map(c => c.length);
          const minPieceInOrder = Math.min(...allLengths, 300);

          sorted.forEach(cut => {
            let bestBarIdx = -1;
            let minLeft = Infinity;
            bars.forEach((bar, idx) => {
              if (bar.remaining >= cut.length && bar.remaining - cut.length < minLeft) {
                bestBarIdx = idx;
                minLeft = bar.remaining - cut.length;
              }
            });

            if (bestBarIdx !== -1) {
              bars[bestBarIdx].pieces.push({ ...cut, barId: bars[bestBarIdx].id });
              bars[bestBarIdx].used += cut.length;
              bars[bestBarIdx].remaining -= cut.length;
            } else {
              const newBar = { id: `${profId}-BAR${bars.length + 1}`, used: cut.length, remaining: barLen - cut.length, pieces: [] };
              newBar.pieces.push({ ...cut, barId: newBar.id });
              bars.push(newBar);
            }
          });

          bars.forEach(bar => {
            bar.isTrash = bar.remaining < minPieceInOrder;
            bar.waste = bar.remaining;
          });
          barsResult[profId] = { profileName, bars, barLen };
        });

        // Assign each BAR to a chariot slot
        const allBarsFlat = [];
        Object.entries(barsResult).forEach(([profId, { profileName, bars, barLen }]) => {
          bars.forEach(bar => allBarsFlat.push({ ...bar, profileName, barLen, profId }));
        });
        allBarsFlat.forEach((bar, idx) => {
          const absSlot = idx % Math.max(totalSlots, 1);
          bar.trolley = Math.floor(absSlot / kitConfig.slotsPerTrolley) + 1;
          bar.slot = (absSlot % kitConfig.slotsPerTrolley) + 1;
          bar.address = `CH${bar.trolley}-C${String(bar.slot).padStart(2, '0')}`;
        });
        const barAddressMap = {};
        allBarsFlat.forEach(b => { barAddressMap[b.id] = b.address; });
        const totalBars = allBarsFlat.length;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Devis selector */}
            <div className="glass shadow-md" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap' }}>📋 Devis source :</span>
                <select
                  value={selectedGlobalQuoteId}
                  onChange={e => setSelectedGlobalQuoteId(e.target.value)}
                  className="input"
                  style={{ fontWeight: 600, flex: 1, minWidth: '220px' }}
                >
                  <option value="">— Sélectionner un document —</option>
                  {currentQuote?.id && <option value={currentQuote.id}>⭐ Devis Actif (Écran Commercial)</option>}
                  
                  <optgroup label="🛒 COMMANDES (Payé/Confirmé)">
                    {(database.orders || []).map(o => {
                      const client = database.clients?.find(c => c.id === o.clientId);
                      return <option key={o.id} value={o.id}>📦 {o.number || o.id}{client ? ` — ${client.nom}` : ''}</option>;
                    })}
                  </optgroup>

                  <optgroup label="📋 DEVIS ( Brouillon / Attente )">
                    {(database.quotes || []).map(q => {
                      const client = database.clients?.find(c => c.id === q.clientId);
                      return <option key={q.id} value={q.id}>📄 {q.number}{client ? ` — ${client.nom}` : ''}</option>;
                    })}
                  </optgroup>
                </select>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {quoteItems.length} items
                  </span>
                  <span style={{ fontSize: '0.8rem', background: itemsWithConfig > 0 ? '#d1fae5' : '#fee2e2', color: itemsWithConfig > 0 ? '#065f46' : '#991b1b', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {itemsWithConfig} avec config
                  </span>
                  <span style={{ fontSize: '0.8rem', background: bomsCalculated > 0 ? '#d1fae5' : '#fee2e2', color: bomsCalculated > 0 ? '#065f46' : '#991b1b', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {bomsCalculated} BOMs ok
                  </span>
                  <span style={{ fontSize: '0.8rem', background: globalCuts.length > 0 ? '#d1fae5' : '#fef3c7', color: globalCuts.length > 0 ? '#065f46' : '#92400e', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {globalCuts.length} coupes générées
                  </span>
                  <span style={{ fontSize: '0.8rem', background: '#ede9fe', color: '#5b21b6', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {totalBars} barres
                  </span>
                </div>
              </div>
              {missingCompoIds.size > 0 && (
                <div style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, background: '#fee2e2', padding: '0.4rem 0.8rem', borderRadius: '4px' }}>
                   ⚠️ Erreur technique : Composition(s) manquante(s) dans la base actuelle : {[...missingCompoIds].join(', ')}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', gap: '1rem', padding: '0 0.5rem' }}>
               <span>Debug: totalPiecesInBoms={totalPiecesInBoms}</span>
               <span>globalQuoteId={selectedGlobalQuoteId}</span>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <Package size={20} color="#f59e0b" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, flex: 1 }}>Configuration Chariots (Kitting)</h2>
              </div>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Nombre de chariots
                  <input type="number" min={1} max={20} className="input" style={{ marginLeft: '0.5rem', width: '70px' }}
                    value={kitConfig.trolleys} onChange={e => setKitConfig(p => ({ ...p, trolleys: parseInt(e.target.value) || 1 }))} />
                </label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Cases par chariot
                  <input type="number" min={1} max={50} className="input" style={{ marginLeft: '0.5rem', width: '70px' }}
                    value={kitConfig.slotsPerTrolley} onChange={e => setKitConfig(p => ({ ...p, slotsPerTrolley: parseInt(e.target.value) || 1 }))} />
                </label>
              </div>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <Layers size={20} color="#8b5cf6" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Plan des Chariots — {totalBars} barres</h2>
              </div>
              {totalBars === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aucune barre à afficher.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                  {Array.from({ length: kitConfig.trolleys }, (_, ti) => {
                    const trolleyBars = allBarsFlat.filter(b => b.trolley === ti + 1);
                    return (
                      <div key={ti} style={{ flex: '0 0 auto', width: '330px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: 'white', fontWeight: 700, fontSize: '0.9rem', padding: '0.6rem 1rem', borderRadius: '0.5rem 0.5rem 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>🛒 Chariot {ti + 1}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.85 }}>{trolleyBars.length}/{kitConfig.slotsPerTrolley} barres</span>
                        </div>
                        <div style={{ border: '2px solid #7c3aed', borderTop: 'none', borderRadius: '0 0 0.5rem 0.5rem', overflow: 'hidden' }}>
                          {Array.from({ length: kitConfig.slotsPerTrolley }, (_, si) => {
                            const bar = allBarsFlat.find(b => b.trolley === ti + 1 && b.slot === si + 1);
                            return (
                              <div key={si} style={{ padding: '0.45rem 0.75rem', borderBottom: '1px solid #ede9fe', background: bar ? '#faf5ff' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: '46px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '0.1rem 0.4rem', borderRadius: '4px', minWidth: '36px', textAlign: 'center', flexShrink: 0 }}>
                                  C{String(si + 1).padStart(2, '0')}
                                </span>
                                {bar ? (
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.775rem', color: '#1e293b' }}>{bar.profileName}</div>
                                    <div style={{ display: 'flex', height: '8px', borderRadius: '3px', overflow: 'hidden', background: '#e2e8f0', margin: '3px 0' }}>
                                      {bar.pieces.map((piece, pi) => (
                                        <div key={pi} style={{ flex: `0 0 ${(piece.length / bar.barLen) * 100}%`, background: `hsl(${(piece.windowIdx * 47) % 360},65%,55%)`, borderRight: '1px solid white' }} />
                                      ))}
                                      {bar.waste > 0 && <div style={{ flex: `0 0 ${(bar.waste / bar.barLen) * 100}%`, background: bar.isTrash ? '#fca5a5' : '#86efac' }} />}
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                      {[...new Set(bar.pieces.map(p => p.windowLabel))].map((wl, i) => (
                                        <span key={i} style={{ background: '#f1f5f9', padding: '0 0.3rem', borderRadius: '3px' }}>{wl}</span>
                                      ))}
                                      <span style={{ marginLeft: 'auto' }}>{bar.used}mm</span>
                                    </div>
                                  </div>
                                ) : <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>— Vide —</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <Scissors size={20} color="#10b981" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Détail des Barres</h2>
              </div>
              {Object.entries(barsResult).map(([profId, { profileName, bars, barLen }]) => (
                <div key={profId} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>{profileName} ({bars.length} barres)</div>
                  {bars.map((bar, bi) => (
                    <div key={bi} style={{ fontSize: '0.75rem', padding: '0.3rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '1rem' }}>
                      <span style={{ fontWeight: 700 }}>{bar.address}</span>
                      <span>{bar.id}</span>
                      <span>{bar.used}mm utilisé</span>
                      <span style={{ color: bar.isTrash ? '#ef4444' : '#10b981' }}>{bar.waste}mm {bar.isTrash ? 'Déchet' : 'Chute'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}



    </div>
  );
};

export default ProductionModule;
