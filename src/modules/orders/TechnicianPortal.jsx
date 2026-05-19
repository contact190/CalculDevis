import React, { useState, useMemo } from 'react';
import { Ruler, CheckCircle, ArrowLeft, QrCode, ClipboardList, RefreshCw, ShieldCheck, Save, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { FormulaEngine } from '../../engine/formula-engine';
import { getTechnicalDrawingDataURL } from '../../utils/drawingUtils';

const ItemPreview = ({ config, database }) => {
  const [dataUrl, setDataUrl] = React.useState(null);
  
  React.useEffect(() => {
    if (config && database) {
      const url = getTechnicalDrawingDataURL(config, database);
      setDataUrl(url);
    }
  }, [config, database]);

  if (!dataUrl) return <div style={{ width: '100%', height: '100%', minHeight: '120px', background: '#f1f5f9', borderRadius: '0.5rem' }} />;

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      background: 'white', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px',
      borderRadius: '0.5rem'
    }}>
      <img 
        src={dataUrl} 
        alt="Aperçu" 
        style={{ width: '100%', maxHeight: '160px', objectFit: 'contain' }} 
      />
    </div>
  );
};

const syncSitePlanToMeasurements = (sitePlan, items) => {
  const newItems = items.map(item => ({
    ...item,
    siteMeasurements: []
  }));

  if (!sitePlan || !sitePlan.floors) return newItems;

  sitePlan.floors.forEach(floor => {
    (floor.apartments || []).forEach(appt => {
      (appt.voids || []).forEach(v => {
        if (!v.itemId) return;
        const itemIdx = newItems.findIndex(i => i.id === v.itemId);
        if (itemIdx === -1) return;

        const item = newItems[itemIdx];
        const label = `${floor.name} - ${appt.name} - ${v.name}`;
        
        const shutterList = [];
        if (v.shutter && v.shutter.qty > 0) {
          shutterList.push({
            id: v.shutter.id || `shutter-${v.id}`,
            qty: v.shutter.qty,
            customLV: v.shutter.customLV !== undefined ? v.shutter.customLV : (v.L || item.config.L),
            overrides: v.shutter.overrides || {}
          });
        }

        const newMeasure = {
          id: v.id,
          L: v.L !== undefined && v.L !== '' ? parseFloat(v.L) : item.config.L,
          H: v.H !== undefined && v.H !== '' ? parseFloat(v.H) : item.config.H,
          wallDepth: v.wallDepth !== undefined && v.wallDepth !== '' ? parseFloat(v.wallDepth) : '',
          handleHeight: v.handleHeight !== undefined && v.handleHeight !== '' ? parseFloat(v.handleHeight) : '',
          qty: 1,
          label: label,
          shutterList: shutterList,
          instanceNames: [v.name],
          instanceFloors: [floor.name]
        };

        newItems[itemIdx].siteMeasurements.push(newMeasure);
      });
    });
  });

  return newItems;
};

const TechnicianPortal = ({ data, setData, orderId, isOnline, isSyncing }) => {
  const order = useMemo(() => {
    return (data.orders || []).find(o => o.id === orderId);
  }, [data.orders, orderId]);

  const selectedClient = useMemo(() => {
    if (!order) return null;
    return data.clients?.find(c => c.id === order.clientId);
  }, [data.clients, order]);

  const activeSitePlan = selectedClient?.sitePlan || { floors: [] };
  const hasPlan = activeSitePlan.floors && activeSitePlan.floors.length > 0 && activeSitePlan.floors.some(f => f.apartments?.some(a => a.voids?.length > 0));

  const engine = useMemo(() => new FormulaEngine(data || {}), [data]);

  // Statistics: how many voids have custom L and H entered
  const stats = useMemo(() => {
    if (!activeSitePlan.floors) return { total: 0, filled: 0 };
    let total = 0;
    let filled = 0;
    activeSitePlan.floors.forEach(f => {
      (f.apartments || []).forEach(a => {
        (a.voids || []).forEach(v => {
          total++;
          if (v.L !== undefined && v.L !== '' && v.H !== undefined && v.H !== '') {
            filled++;
          }
        });
      });
    });
    return { total, filled };
  }, [activeSitePlan]);

  const updateVoidProperty = (floorId, aptId, voidId, property, value) => {
    if (!order || !selectedClient) return;

    const currentPlan = selectedClient.sitePlan || { floors: [] };
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).map(f => {
        if (f.id !== floorId) return f;
        return {
          ...f,
          apartments: (f.apartments || []).map(a => {
            if (a.id !== aptId) return a;
            return {
              ...a,
              voids: (a.voids || []).map(v => {
                if (v.id !== voidId) return v;

                if (property === 'itemId') {
                  const item = order.items.find(i => i.id === value);
                  return {
                    ...v,
                    itemId: value,
                    L: item?.config?.L || v.L,
                    H: item?.config?.H || v.H,
                    shutter: {
                      qty: 1,
                      customLV: item?.config?.L || v.L,
                      overrides: {}
                    }
                  };
                }

                if (property.startsWith('shutter.')) {
                  const shutterField = property.split('.')[1];
                  const currentShutter = v.shutter || { qty: 1, overrides: {} };
                  
                  if (shutterField === 'qty') {
                    return {
                      ...v,
                      shutter: {
                        ...currentShutter,
                        qty: parseInt(value) || 1
                      }
                    };
                  }
                  if (shutterField === 'customLV') {
                    return {
                      ...v,
                      shutter: {
                        ...currentShutter,
                        customLV: parseFloat(value) || 0
                      }
                    };
                  }
                  if (property.startsWith('shutter.overrides.')) {
                    const overrideField = property.split('.')[2]; // e.g. 'controlPosition', 'caissonId', etc.
                    return {
                      ...v,
                      shutter: {
                        ...currentShutter,
                        overrides: {
                          ...currentShutter.overrides,
                          [overrideField]: value || undefined
                        }
                      }
                    };
                  }
                }

                return { ...v, [property]: value };
              })
            };
          })
        };
      })
    };

    const updatedItems = syncSitePlanToMeasurements(updatedPlan, order.items);

    setData(prev => {
      const updatedClients = (prev.clients || []).map(c => 
        c.id === selectedClient.id ? { ...c, sitePlan: updatedPlan } : c
      );
      const updatedOrders = (prev.orders || []).map(o => 
        o.id === order.id ? { ...o, items: updatedItems } : o
      );
      return {
        ...prev,
        clients: updatedClients,
        orders: updatedOrders
      };
    });
  };

  const applyVoidToAllSameInApartment = (floorId, aptId, sourceVoid) => {
    if (!order || !selectedClient) return;

    const currentPlan = selectedClient.sitePlan || { floors: [] };
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).map(f => {
        if (f.id !== floorId) return f;
        return {
          ...f,
          apartments: (f.apartments || []).map(a => {
            if (a.id !== aptId) return a;
            return {
              ...a,
              voids: (a.voids || []).map(v => {
                if (v.itemId === sourceVoid.itemId && v.id !== sourceVoid.id) {
                  return {
                    ...v,
                    L: sourceVoid.L,
                    H: sourceVoid.H,
                    wallDepth: sourceVoid.wallDepth,
                    handleHeight: sourceVoid.handleHeight,
                    shutter: sourceVoid.shutter ? JSON.parse(JSON.stringify(sourceVoid.shutter)) : null
                  };
                }
                return v;
              })
            };
          })
        };
      })
    };

    const updatedItems = syncSitePlanToMeasurements(updatedPlan, order.items);

    setData(prev => {
      const updatedClients = (prev.clients || []).map(c => 
        c.id === selectedClient.id ? { ...c, sitePlan: updatedPlan } : c
      );
      const updatedOrders = (prev.orders || []).map(o => 
        o.id === order.id ? { ...o, items: updatedItems } : o
      );
      return {
        ...prev,
        clients: updatedClients,
        orders: updatedOrders
      };
    });

    alert("Cotes appliquées à toutes les fenêtres identiques de cet appartement !");
  };

  if (!order) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h2 style={{ color: '#ef4444' }}>Commande Introuvable</h2>
        <p>Le lien est incorrect ou la commande n'existe plus.</p>
      </div>
    );
  }

  const completionPercent = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Header */}
        <header className="glass shadow-sm" style={{ padding: '1.25rem', borderRadius: '1rem', background: 'white', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800, background: isOnline ? '#dcfce7' : '#fee2e2', color: isOnline ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#22c55e' : '#ef4444' }} />
              {isOnline ? 'CONNECTÉ' : 'MODE HORS-LIGNE'}
            </div>
            {isSyncing && (
              <div style={{ padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800, background: '#eff6ff', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <RefreshCw size={10} className="animate-spin" /> SAUVEGARDE CLOUD...
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <Ruler size={32} style={{ color: '#0f766e', margin: '0 auto 0.5rem' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: '#0f766e' }}>Portail Prise de Mesures</h1>
            <p style={{ color: '#64748b', margin: '0.2rem 0', fontSize: '0.9rem' }}>Commande: <strong>{order.id}</strong></p>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Client: {selectedClient?.nom || 'Inconnu'}</p>
          </div>
        </header>

        {/* Progress Bar Card */}
        <div className="glass" style={{ padding: '1rem', borderRadius: '1rem', background: 'white', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <span>Progression du Chantier</span>
            <span style={{ color: '#0f766e' }}>{stats.filled} / {stats.total} fenêtres ({completionPercent}%)</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${completionPercent}%`, height: '100%', background: '#0f766e', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* site plan structure */}
        {!hasPlan ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'white', borderRadius: '1rem', border: '2px dashed #cbd5e1' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>📐</span>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>Aucun Plan de Chantier</h4>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '350px', margin: '0 auto' }}>
              Veuillez d'abord créer la structure du chantier (Étages ➜ Appartements ➜ Vides) dans l'application principale.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {(activeSitePlan.floors || []).map(floor => {
              const floorHasVoids = floor.apartments?.some(a => a.voids?.length > 0);
              if (!floorHasVoids) return null;

              return (
                <div key={floor.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Floor Header */}
                  <div style={{ padding: '0.6rem 1rem', background: '#0f766e', color: 'white', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '1.1rem' }}>🏢</span>
                    <strong style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase' }}>{floor.name}</strong>
                  </div>

                  {/* Apartments */}
                  {(floor.apartments || []).map(apt => {
                    if (!apt.voids || apt.voids.length === 0) return null;

                    return (
                      <div key={apt.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.3rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1rem' }}>🚪</span>
                          <strong style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 700 }}>{apt.name}</strong>
                        </div>

                        {/* Voids */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {(apt.voids || []).map(v => {
                            const item = order.items.find(i => i.id === v.itemId);
                            if (!item) return null;

                            return (
                              <div key={v.id} className="glass shadow-sm" style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                
                                {/* Info Banner */}
                                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', background: '#0f766e', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 800 }}>{v.name}</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{item.label}</strong>
                                  </div>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Devis: {item.config.L} x {item.config.H} mm</span>
                                </div>

                                {/* Preview and Inputs Content */}
                                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  
                                  {/* Drawing Preview */}
                                  <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '0.5rem' }}>
                                    <ItemPreview config={item.config} database={data} />
                                  </div>

                                  {/* Inputs Grid */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>LARGEUR RÉELLE (L) mm</label>
                                      <input
                                        type="number"
                                        className="input"
                                        value={v.L !== undefined ? v.L : ''}
                                        onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'L', e.target.value)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 800, textAlign: 'center' }}
                                        placeholder={item.config.L}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>HAUTEUR RÉELLE (H) mm</label>
                                      <input
                                        type="number"
                                        className="input"
                                        value={v.H !== undefined ? v.H : ''}
                                        onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'H', e.target.value)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 800, textAlign: 'center' }}
                                        placeholder={item.config.H}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>PROF. MUR mm</label>
                                      <input
                                        type="number"
                                        className="input"
                                        value={v.wallDepth !== undefined ? v.wallDepth : ''}
                                        onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'wallDepth', e.target.value)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 700, textAlign: 'center' }}
                                        placeholder="ex: 120"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>HT. POIGNÉE mm</label>
                                      <input
                                        type="number"
                                        className="input"
                                        value={v.handleHeight !== undefined ? v.handleHeight : ''}
                                        onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'handleHeight', e.target.value)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 700, textAlign: 'center' }}
                                        placeholder="Auto"
                                      />
                                    </div>
                                  </div>

                                  {/* Shutter Toggle Section */}
                                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>🌀 Volet Roulant</span>
                                      <button
                                        onClick={() => {
                                          const hasShutter = !!v.shutter;
                                          updateVoidProperty(floor.id, apt.id, v.id, 'shutter', hasShutter ? null : { qty: 1, customLV: v.L || item.config.L, overrides: {} });
                                        }}
                                        style={{
                                          border: 'none',
                                          background: v.shutter ? '#fee2e2' : '#e2e8f0',
                                          color: v.shutter ? '#ef4444' : '#475569',
                                          fontSize: '0.75rem',
                                          fontWeight: 800,
                                          padding: '0.3rem 0.7rem',
                                          borderRadius: '4px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {v.shutter ? '✕ Désactiver' : '＋ Activer'}
                                      </button>
                                    </div>

                                    {v.shutter && (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>QUANTITÉ VOLET</label>
                                          <input
                                            type="number"
                                            className="input"
                                            value={v.shutter.qty !== undefined ? v.shutter.qty : 1}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.qty', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', textAlign: 'center' }}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>LARGEUR LAME (LV) mm</label>
                                          <input
                                            type="number"
                                            className="input"
                                            value={v.shutter.customLV !== undefined ? v.shutter.customLV : ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.customLV', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', textAlign: 'center' }}
                                            placeholder={v.L || item.config.L}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>MANOEUVRE</label>
                                          <select
                                            className="input"
                                            value={v.shutter.overrides?.controlPosition || ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.controlPosition', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', fontWeight: 700 }}
                                          >
                                            <option value="">Auto</option>
                                            <option value="Gauche">Gauche</option>
                                            <option value="Droite">Droite</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>CAISSON</label>
                                          <select
                                            className="input"
                                            value={v.shutter.overrides?.caissonId || ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.caissonId', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                          >
                                            <option value="">Auto</option>
                                            {(data.shutterComponents?.caissons || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>LAME</label>
                                          <select
                                            className="input"
                                            value={v.shutter.overrides?.lameId || ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.lameId', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                          >
                                            <option value="">Auto</option>
                                            {(data.shutterComponents?.lames || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>GLISSIÈRE</label>
                                          <select
                                            className="input"
                                            value={v.shutter.overrides?.glissiereId || ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.glissiereId', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                          >
                                            <option value="">Auto</option>
                                            {(data.shutterComponents?.glissieres || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>AXE</label>
                                          <select
                                            className="input"
                                            value={v.shutter.overrides?.axeId || ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.axeId', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                          >
                                            <option value="">Auto</option>
                                            {(data.shutterComponents?.axes || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                          </select>
                                         </div>
                                         <div>
                                           <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>KIT</label>
                                           <select
                                             className="input"
                                             value={v.shutter.overrides?.kitId || ''}
                                             onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.kitId', e.target.value)}
                                             style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                           >
                                             <option value="">Auto</option>
                                             {(data.shutterComponents?.kits || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                           </select>
                                         </div>
                                         {(() => {
                                           const selectedKitId = v.shutter.overrides?.kitId !== undefined && v.shutter.overrides?.kitId !== '' 
                                             ? v.shutter.overrides?.kitId 
                                             : (item.config?.shutterConfig?.kitId || '');
                                           const selectedKit = (data.shutterComponents?.kits || []).find(k => k.id === selectedKitId);
                                           const isMotor = selectedKit?.type === 'MOTEUR' || 
                                            selectedKitId.toLowerCase().includes('mote') || 
                                            selectedKit?.name?.toLowerCase().includes('moteur');
                                           if (!isMotor) return null;
                                           return (
                                             <div>
                                               <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>MOTEUR</label>
                                               <select
                                                 className="input"
                                                 value={v.shutter.overrides?.moteurId || ''}
                                                 onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.moteurId', e.target.value)}
                                                 style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                               >
                                                 <option value="">Auto</option>
                                                 {(data.shutterComponents?.moteurs || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                               </select>
                                             </div>
                                           );
                                         })()}
                                       </div>
                                    )}
                                  </div>

                                  {/* Copy Button */}
                                  <button 
                                    onClick={() => applyVoidToAllSameInApartment(floor.id, apt.id, v)}
                                    className="btn btn-secondary"
                                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.78rem', fontWeight: 800, background: '#f0fdfa', border: '1.5px dashed #5eead4', color: '#0f766e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                  >
                                    <Save size={14} /> Appliquer à tous les vides identiques de l'appartement
                                  </button>

                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer info */}
        <div style={{ marginTop: '2rem', textAlign: 'center', padding: '1rem', opacity: 0.5 }}>
          <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          <span style={{ fontSize: '0.75rem' }}>Accès Sécurisé Technicien Prise de Mesures</span>
        </div>
      </div>
    </div>
  );
};

export default TechnicianPortal;
