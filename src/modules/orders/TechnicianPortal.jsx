import React, { useState, useMemo, useEffect, useRef } from 'react';
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
            customLV: (v.shutter.customLV !== undefined && v.shutter.customLV !== '' && v.shutter.customLV !== 0) ? v.shutter.customLV : (v.L || item.config.L),
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

const DebouncedInput = ({ value, onChange, placeholder, type = "number", className = "input", style }) => {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync local value with prop changes when not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value);
    }
  }, [value, isFocused]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(val);
    }, 800);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <input
      type={type}
      className={className}
      value={localValue !== undefined ? localValue : ''}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={style}
      placeholder={placeholder}
    />
  );
};

const TechnicianPortal = ({ data, setData, orderId, isOnline, isSyncing }) => {
  const [expandedFloors, setExpandedFloors] = useState({});
  const [showValidation, setShowValidation] = useState(false);
  const [voidToValidate, setVoidToValidate] = useState(null);
  const [selectedVoidsForLaunch, setSelectedVoidsForLaunch] = useState({});
  const [assignPopupState, setAssignPopupState] = useState(null);
  const [selectedVoidsForAssign, setSelectedVoidsForAssign] = useState({});

  const order = useMemo(() => {
    return (data.orders || []).find(o => o.id === orderId);
  }, [data.orders, orderId]);

  const selectedClient = useMemo(() => {
    if (!order) return null;
    return data.clients?.find(c => c.id === order.clientId);
  }, [data.clients, order]);

  const activeSitePlan = useMemo(() => {
    if (!selectedClient) return { floors: [] };
    const plans = selectedClient.sitePlans || [];
    if (order?.sitePlanId) {
      return plans.find(p => p.id === order.sitePlanId) || { floors: [] };
    }
    for (const plan of plans) {
       for (const floor of (plan.floors || [])) {
          for (const apt of (floor.apartments || [])) {
             for (const voidItem of (apt.voids || [])) {
                if (order?.items?.some(i => i.id === voidItem.itemId)) {
                   return plan;
                }
             }
          }
       }
    }
    return plans.length > 0 ? plans[0] : { floors: [] };
  }, [selectedClient, order]);
  const hasPlan = activeSitePlan.floors && activeSitePlan.floors.length > 0 && activeSitePlan.floors.some(f => f.apartments?.some(a => a.voids?.length > 0));

  const engine = useMemo(() => new FormulaEngine(data || {}), [data]);

  // Statistics: how many voids have custom L and H entered
  const stats = useMemo(() => {
    if (!activeSitePlan.floors) return { total: 0, filled: 0, validated: 0, launched: 0 };
    let total = 0, filled = 0, validated = 0, launched = 0;
    activeSitePlan.floors.forEach(f => {
      (f.apartments || []).forEach(a => {
        (a.voids || []).forEach(v => {
          total++;
          if (v.L !== undefined && v.L !== '' && v.H !== undefined && v.H !== '') filled++;
          if (v.measurementsValidated) validated++;
          if (v.productionLaunched) launched++;
        });
      });
    });
    return { total, filled, validated, launched };
  }, [activeSitePlan]);

  const updateVoidProperty = (floorId, aptId, voidId, property, value) => {
    if (!order || !selectedClient) return;

    const currentPlan = activeSitePlan;
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
                    shutter: item?.config?.hasShutter ? {
                      qty: 1,
                      customLV: '',
                      overrides: {}
                    } : null
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
                        customLV: value === '' ? '' : (parseFloat(value) || '')
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
      const updatedClients = (prev.clients || []).map(c => {
        if (c.id !== selectedClient.id) return c;
        const plans = c.sitePlans || [];
        const planExists = plans.some(p => p.id === updatedPlan.id);
        const newPlans = planExists 
          ? plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
          : [...plans, updatedPlan];
        return { ...c, sitePlans: newPlans };
      });
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

  const applyGlobalVoidAssignment = (sourceVoid) => {
    if (!order || !selectedClient || !assignPopupState) return;

    const currentPlan = activeSitePlan;
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).map(f => {
        return {
          ...f,
          apartments: (f.apartments || []).map(a => {
            return {
              ...a,
              voids: (a.voids || []).map(v => {
                if (selectedVoidsForAssign[v.id] && !v.productionLaunched) {
                  return {
                    ...v,
                    L: sourceVoid.L !== undefined ? sourceVoid.L : v.L,
                    H: sourceVoid.H !== undefined ? sourceVoid.H : v.H,
                    wallDepth: sourceVoid.wallDepth,
                    handleHeight: sourceVoid.handleHeight,
                    shutter: sourceVoid.shutter ? JSON.parse(JSON.stringify(sourceVoid.shutter)) : null,
                    measurementsValidated: true
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
      const updatedClients = (prev.clients || []).map(c => {
        if (c.id !== selectedClient.id) return c;
        const plans = c.sitePlans || [];
        const planExists = plans.some(p => p.id === updatedPlan.id);
        const newPlans = planExists 
          ? plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
          : [...plans, updatedPlan];
        return { ...c, sitePlans: newPlans };
      });
      const updatedOrders = (prev.orders || []).map(o => 
        o.id === order.id ? { ...o, items: updatedItems } : o
      );
      return {
        ...prev,
        clients: updatedClients,
        orders: updatedOrders
      };
    });

    alert("Cotes appliquées et validées pour les fenêtres sélectionnées !");
    setAssignPopupState(null);
    setSelectedVoidsForAssign({});
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

  React.useEffect(() => {
    if (showValidation) {
      const initialSelection = {};
      (activeSitePlan.floors || []).forEach(f => {
        (f.apartments || []).forEach(a => {
          (a.voids || []).forEach(v => {
            if (v.measurementsValidated && !v.productionLaunched) {
               // keep existing selection if previously unselected, else default to true
               initialSelection[v.id] = selectedVoidsForLaunch[v.id] !== undefined ? selectedVoidsForLaunch[v.id] : true;
            }
          });
        });
      });
      setSelectedVoidsForLaunch(initialSelection);
    }
  }, [showValidation, activeSitePlan]);

  React.useEffect(() => {
    if (assignPopupState) {
      const { sourceVoid } = assignPopupState;
      const initialSelection = {};
      initialSelection[sourceVoid.id] = true;
      setSelectedVoidsForAssign(initialSelection);
    }
  }, [assignPopupState]);

  const renderIndividualValidationPopup = () => {
    if (!voidToValidate) return null;
    const f = activeSitePlan.floors?.find(fl => fl.id === voidToValidate.floorId);
    const a = f?.apartments?.find(ap => ap.id === voidToValidate.aptId);
    const v = a?.voids?.find(vo => vo.id === voidToValidate.voidId);
    if (!v) return null;
    const item = order.items.find(i => i.id === v.itemId);
    if (!item) return null;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem' }}>Confirmer la validation</h2>
          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}><strong>{v.name}</strong> ({item.label})</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div><span style={{ color: '#94a3b8' }}>Devis:</span> {item.config.L} x {item.config.H}</div>
              <div><span style={{ color: '#0f766e' }}>Mesuré:</span> {v.L !== undefined ? v.L : item.config.L} x {v.H !== undefined ? v.H : item.config.H}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setVoidToValidate(null)} style={{ flex: 1, padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
            <button 
              onClick={() => {
                updateVoidProperty(f.id, a.id, v.id, 'measurementsValidated', true);
                setVoidToValidate(null);
              }}
              style={{ flex: 2, padding: '0.6rem', borderRadius: '0.5rem', border: 'none', background: '#0ea5e9', color: 'white', fontWeight: 700, cursor: 'pointer' }}
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderValidationPopup = () => {
    if (!showValidation) return null;

    const validatedVoids = [];
    (activeSitePlan.floors || []).forEach(f => {
      (f.apartments || []).forEach(a => {
        (a.voids || []).forEach(v => {
          if (v.measurementsValidated && !v.productionLaunched) {
            const item = order.items.find(i => i.id === v.itemId);
            validatedVoids.push({ floor: f, apt: a, void: v, item });
          }
        });
      });
    });

    const handleLaunch = () => {
      const selectedCount = Object.values(selectedVoidsForLaunch).filter(Boolean).length;
      if (selectedCount === 0) {
        alert("Veuillez sélectionner au moins une fenêtre à lancer.");
        return;
      }

      const currentPlan = activeSitePlan;
      const newBatchItemsMap = new Map();

      const updatedPlan = {
        ...currentPlan,
        floors: (currentPlan.floors || []).map(f => ({
          ...f,
          apartments: (f.apartments || []).map(a => ({
            ...a,
            voids: (a.voids || []).map(v => {
              if (selectedVoidsForLaunch[v.id]) {
                if (!newBatchItemsMap.has(v.itemId)) {
                  const item = order.items.find(i => i.id === v.itemId);
                  if (item) {
                    newBatchItemsMap.set(v.itemId, {
                      id: item.id,
                      label: item.label,
                      config: item.config,
                      measurements: []
                    });
                  }
                }
                const batchItem = newBatchItemsMap.get(v.itemId);
                if (batchItem) {
                  const shutterList = [];
                  if (v.shutter && v.shutter.qty > 0) {
                    shutterList.push({
                      id: v.shutter.id || `shutter-${v.id}`,
                      qty: v.shutter.qty,
                      customLV: (v.shutter.customLV !== undefined && v.shutter.customLV !== '' && v.shutter.customLV !== 0) ? v.shutter.customLV : (v.L !== undefined && v.L !== '' ? parseFloat(v.L) : batchItem.config.L),
                      overrides: v.shutter.overrides || {}
                    });
                  }
                  batchItem.measurements.push({
                    id: v.id,
                    L: v.L !== undefined && v.L !== '' ? parseFloat(v.L) : batchItem.config.L,
                    H: v.H !== undefined && v.H !== '' ? parseFloat(v.H) : batchItem.config.H,
                    wallDepth: v.wallDepth !== undefined && v.wallDepth !== '' ? parseFloat(v.wallDepth) : '',
                    handleHeight: v.handleHeight !== undefined && v.handleHeight !== '' ? parseFloat(v.handleHeight) : '',
                    // optionalSides: undefined = Auto (keep quote config), object = technician override
                    optionalSides: v.optionalSides !== undefined ? v.optionalSides : undefined,
                    qty: 1,
                    label: `${f.name} - ${a.name} - ${v.name}`,
                    shutterList: shutterList,
                    instanceNames: [v.name],
                    instanceFloors: [f.name]
                  });
                }
                return { ...v, productionLaunched: true };
              }
              return v;
            })
          }))
        }))
      };

      const updatedItems = syncSitePlanToMeasurements(updatedPlan, order.items);

      const newBatchIdNum = (order.batches?.length || 0) + 1;
      const newBatch = {
        id: `BATCH-${newBatchIdNum}`,
        name: `Lot N°${newBatchIdNum} (Terrain)`,
        createdAt: new Date().toISOString(),
        items: Array.from(newBatchItemsMap.values())
      };

      setData(prev => {
        const updatedClients = (prev.clients || []).map(c => {
          if (c.id !== selectedClient.id) return c;
          const plans = c.sitePlans || [];
          const planExists = plans.some(p => p.id === updatedPlan.id);
          const newPlans = planExists 
            ? plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
            : [...plans, updatedPlan];
          return { ...c, sitePlans: newPlans };
        });
        const updatedOrders = (prev.orders || []).map(o => 
          o.id === order.id ? { 
            ...o, 
            items: updatedItems, 
            status: 'PARTIEL_PRODUCTION',
            batches: [...(o.batches || []), newBatch]
          } : o
        );
        return { ...prev, clients: updatedClients, orders: updatedOrders };
      });
      setShowValidation(false);
      setSelectedVoidsForLaunch({});
      alert('Fenêtres lancées en production avec succès !');
    };

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={24} color="#0f766e" />
              Lancement en Production
            </h2>
            <button 
              onClick={() => setShowValidation(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', fontSize: '1.2rem', fontWeight: 'bold' }}
              title="Fermer"
            >
              ✕
            </button>
          </div>
          
          {validatedVoids.length === 0 ? (
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', textAlign: 'center', color: '#64748b', marginBottom: '1.5rem' }}>
              Aucune fenêtre validée en attente de lancement.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {Array.from(new Set(validatedVoids.map(v => v.floor.id))).map(floorId => {
                const floorVoids = validatedVoids.filter(v => v.floor.id === floorId);
                const floor = floorVoids[0].floor;
                const isFloorFullySelected = floorVoids.every(v => selectedVoidsForLaunch[v.void.id]);
                const isFloorPartiallySelected = !isFloorFullySelected && floorVoids.some(v => selectedVoidsForLaunch[v.void.id]);

                return (
                  <div key={floor.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                      <input 
                        type="checkbox"
                        checked={isFloorFullySelected}
                        ref={el => { if(el) el.indeterminate = isFloorPartiallySelected; }}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedVoidsForLaunch(prev => {
                            const next = { ...prev };
                            floorVoids.forEach(v => { next[v.void.id] = checked; });
                            return next;
                          });
                        }}
                        style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                      />
                      <strong style={{ fontSize: '0.95rem', color: '#1e293b', textTransform: 'uppercase' }}>{floor.name}</strong>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {Array.from(new Set(floorVoids.map(v => v.apt.id))).map(aptId => {
                        const aptVoids = floorVoids.filter(v => v.apt.id === aptId);
                        const apt = aptVoids[0].apt;
                        const isAptFullySelected = aptVoids.every(v => selectedVoidsForLaunch[v.void.id]);
                        const isAptPartiallySelected = !isAptFullySelected && aptVoids.some(v => selectedVoidsForLaunch[v.void.id]);

                        return (
                          <div key={apt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ background: '#f8fafc', padding: '0.5rem 1rem 0.5rem 2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                              <input 
                                type="checkbox"
                                checked={isAptFullySelected}
                                ref={el => { if(el) el.indeterminate = isAptPartiallySelected; }}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedVoidsForLaunch(prev => {
                                    const next = { ...prev };
                                    aptVoids.forEach(v => { next[v.void.id] = checked; });
                                    return next;
                                  });
                                }}
                                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{apt.name}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {aptVoids.map(({ void: v, item }) => (
                                <div key={v.id} style={{ padding: '0.5rem 1rem 0.5rem 4rem', display: 'flex', gap: '1rem', alignItems: 'center', background: 'white' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={!!selectedVoidsForLaunch[v.id]}
                                    onChange={(e) => setSelectedVoidsForLaunch(prev => ({ ...prev, [v.id]: e.target.checked }))}
                                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                                  />
                                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                                      {v.name}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                      Mesuré: <strong>{v.L !== undefined ? v.L : item.config.L} x {v.H !== undefined ? v.H : item.config.H}</strong>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={() => setShowValidation(false)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
            >
              Fermer
            </button>
            <button 
              onClick={handleLaunch}
              disabled={validatedVoids.length === 0}
              style={{ flex: 2, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: validatedVoids.length === 0 ? '#94a3b8' : '#0f766e', color: 'white', fontWeight: 700, cursor: validatedVoids.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <CheckCircle size={18} /> Lancer la sélection
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAssignPopup = () => {
    if (!assignPopupState) return null;
    const { sourceVoid } = assignPopupState;
    const item = order.items.find(i => i.id === sourceVoid.itemId);
    if (!item) return null;

    const voidsToAssign = [];
    (activeSitePlan.floors || []).forEach(f => {
      (f.apartments || []).forEach(a => {
        (a.voids || []).forEach(v => {
          if (v.itemId === sourceVoid.itemId && !v.productionLaunched) {
            voidsToAssign.push({ floor: f, apt: a, void: v });
          }
        });
      });
    });

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', maxWidth: '500px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={24} color="#0f766e" />
            Assigner les Cotes
          </h2>

          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>Assigner les dimensions de <strong>{sourceVoid.name}</strong> ({item.label})</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div><span style={{ color: '#94a3b8' }}>Devis:</span> {item.config.L} x {item.config.H}</div>
              <div><span style={{ color: '#0f766e' }}>Mesuré:</span> {sourceVoid.L !== undefined ? sourceVoid.L : item.config.L} x {sourceVoid.H !== undefined ? sourceVoid.H : item.config.H}</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {voidsToAssign.length === 0 ? (
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', textAlign: 'center', color: '#64748b' }}>
                Aucune autre fenêtre du même type.
              </div>
            ) : (
              voidsToAssign.map(({ floor, apt, void: v }, idx) => (
                <div key={idx} style={{ padding: '0.75rem', background: v.id === sourceVoid.id ? '#f0fdfa' : '#f8fafc', border: v.id === sourceVoid.id ? '1px solid #5eead4' : '1px solid #e2e8f0', borderRadius: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={!!selectedVoidsForAssign[v.id]}
                    onChange={(e) => setSelectedVoidsForAssign(prev => ({ ...prev, [v.id]: e.target.checked }))}
                    style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                      {floor.name} - {apt.name} - {v.name}
                      {v.id === sourceVoid.id && <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: '#14b8a6', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>Source</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      Actuel: {v.L !== undefined ? v.L : item.config.L} x {v.H !== undefined ? v.H : item.config.H}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={() => {
                setAssignPopupState(null);
                setSelectedVoidsForAssign({});
              }}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
            >
              Annuler
            </button>
            <button 
              onClick={() => applyGlobalVoidAssignment(sourceVoid)}
              disabled={Object.values(selectedVoidsForAssign).filter(Boolean).length === 0}
              style={{ flex: 2, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: Object.values(selectedVoidsForAssign).filter(Boolean).length === 0 ? '#94a3b8' : '#0ea5e9', color: 'white', fontWeight: 700, cursor: Object.values(selectedVoidsForAssign).filter(Boolean).length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <CheckCircle size={18} /> Appliquer & Valider
            </button>
          </div>
        </div>
      </div>
    );
  };

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
            <span style={{ color: '#0f766e' }}>{stats.filled} / {stats.total} saisies ({completionPercent}%)</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div style={{ width: `${completionPercent}%`, height: '100%', background: '#0f766e', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', fontWeight: 700 }}>
            <span style={{ color: '#0ea5e9' }}>✓ {stats.validated} validées</span>
            <span style={{ color: '#166534' }}>🚀 {stats.launched} lancées</span>
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

              const isExpanded = expandedFloors[floor.id] !== false;

              return (
                <div key={floor.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Floor Header */}
                  <div 
                    onClick={() => setExpandedFloors(prev => ({ ...prev, [floor.id]: prev[floor.id] === false ? true : false }))}
                    style={{ padding: '0.6rem 1rem', background: '#0f766e', color: 'white', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🏢</span>
                      <strong style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase' }}>{floor.name}</strong>
                    </div>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>

                  {/* Apartments */}
                  {isExpanded && (floor.apartments || []).map(apt => {
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

                            const actualShutter = v.shutter !== undefined ? v.shutter : (item.config.hasShutter ? { qty: 1, customLV: '', overrides: {} } : null);
                            const isShutterActive = actualShutter !== null;

                            return (
                              <div key={v.id} className="glass shadow-sm" style={{ 
                                background: 'white', 
                                borderRadius: '1rem', 
                                border: v.productionLaunched 
                                  ? '2px solid #22c55e' 
                                  : v.measurementsValidated 
                                    ? '2px solid #0ea5e9' 
                                    : '1px solid #e2e8f0', 
                                overflow: 'hidden', 
                                display: 'flex', 
                                flexDirection: 'column',
                                transition: 'border-color 0.3s ease'
                              }}>
                                
                                {/* Info Banner */}
                                <div style={{ 
                                  background: v.productionLaunched ? '#f0fdf4' : v.measurementsValidated ? '#eff6ff' : '#f8fafc', 
                                  padding: '0.75rem 1rem', 
                                  borderBottom: '1px solid #e2e8f0', 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center' 
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', background: '#0f766e', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 800 }}>{v.name}</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{item.label}</strong>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {v.productionLaunched && (
                                      <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>🚀 LANCÉE</span>
                                    )}
                                    {v.measurementsValidated && !v.productionLaunched && (
                                      <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>✓ VALIDÉE</span>
                                    )}
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Devis: {item.config.L} x {item.config.H} mm</span>
                                  </div>
                                </div>

                                {/* Preview and Inputs Content */}
                                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', opacity: v.productionLaunched ? 0.75 : 1, pointerEvents: v.productionLaunched ? 'none' : 'auto' }}>
                                  
                                  {/* Drawing Preview */}
                                  <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '0.5rem' }}>
                                    <ItemPreview config={{
                                      ...item.config,
                                      L: v.L !== undefined && v.L !== '' ? parseFloat(v.L) : item.config.L,
                                      H: v.H !== undefined && v.H !== '' ? parseFloat(v.H) : item.config.H,
                                      openingDirection: v.openingDirection || item.config.openingDirection || 'gauche',
                                      hasShutter: v.shutter !== undefined ? !!v.shutter : item.config.hasShutter,
                                      shutterConfig: v.shutter ? {
                                        ...(item.config.shutterConfig || {}),
                                        ...(v.shutter.overrides || {})
                                      } : (v.shutter === null ? null : item.config.shutterConfig)
                                    }} database={data} />
                                  </div>

                                  {/* Inputs Grid */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>LARGEUR RÉELLE (L) mm</label>
                                      <DebouncedInput
                                        type="number"
                                        className="input"
                                        value={v.L !== undefined ? v.L : ''}
                                        onChange={val => updateVoidProperty(floor.id, apt.id, v.id, 'L', val)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 800, textAlign: 'center' }}
                                        placeholder={item.config.L}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>HAUTEUR RÉELLE (H) mm</label>
                                      <DebouncedInput
                                        type="number"
                                        className="input"
                                        value={v.H !== undefined ? v.H : ''}
                                        onChange={val => updateVoidProperty(floor.id, apt.id, v.id, 'H', val)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 800, textAlign: 'center' }}
                                        placeholder={item.config.H}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>PROF. MUR mm</label>
                                      <DebouncedInput
                                        type="number"
                                        className="input"
                                        value={v.wallDepth !== undefined ? v.wallDepth : ''}
                                        onChange={val => updateVoidProperty(floor.id, apt.id, v.id, 'wallDepth', val)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 700, textAlign: 'center' }}
                                        placeholder="ex: 120"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>HT. POIGNÉE mm</label>
                                      <DebouncedInput
                                        type="number"
                                        className="input"
                                        value={v.handleHeight !== undefined ? v.handleHeight : ''}
                                        onChange={val => updateVoidProperty(floor.id, apt.id, v.id, 'handleHeight', val)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 700, textAlign: 'center' }}
                                        placeholder="Auto"
                                      />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>SENS D'OUVERTURE</label>
                                      <select
                                        className="input"
                                        value={v.openingDirection || item.config.openingDirection || ''}
                                        onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'openingDirection', e.target.value)}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem', border: '1.5px solid #cbd5e1', fontWeight: 800, textAlign: 'center' }}
                                      >
                                        <option value="">Auto ({item.config.openingDirection || 'gauche'})</option>
                                        <option value="gauche">Gauche</option>
                                        <option value="droit">Droit</option>
                                      </select>
                                    </div>

                                    {/* Couvre-joint (optionalSides) */}
                                    <div style={{ gridColumn: '1 / -1' }}>
                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>COUVRE-JOINT (côtés)</label>
                                      {(() => {
                                        // resolved optionalSides: void overrides, else item config, else all true
                                        const quoteSides = item.config.optionalSides || { top: true, bottom: true, left: true, right: true };
                                        const voidSides = v.optionalSides; // undefined = Auto
                                        const isAuto = voidSides === undefined || voidSides === null;
                                        const currentSides = isAuto ? quoteSides : voidSides;
                                        const sides = [
                                          { key: 'top', label: 'Haut' },
                                          { key: 'bottom', label: 'Bas' },
                                          { key: 'left', label: 'Gauche' },
                                          { key: 'right', label: 'Droite' },
                                        ];
                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {/* Auto toggle */}
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: isAuto ? '#0f766e' : '#64748b', cursor: 'pointer' }}>
                                              <input
                                                type="checkbox"
                                                checked={isAuto}
                                                onChange={e => {
                                                  if (e.target.checked) {
                                                    updateVoidProperty(floor.id, apt.id, v.id, 'optionalSides', undefined);
                                                  } else {
                                                    updateVoidProperty(floor.id, apt.id, v.id, 'optionalSides', { ...quoteSides });
                                                  }
                                                }}
                                                style={{ width: '1rem', height: '1rem' }}
                                              />
                                              Auto (comme le devis)
                                              {isAuto && <span style={{ fontSize: '0.65rem', background: '#ccfbf1', color: '#0f766e', padding: '0.1rem 0.4rem', borderRadius: '9999px' }}>ACTIF</span>}
                                            </label>
                                            {/* Per-side checkboxes — only when not Auto */}
                                            {!isAuto && (
                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', paddingLeft: '0.5rem' }}>
                                                {sides.map(({ key, label }) => (
                                                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                                    <input
                                                      type="checkbox"
                                                      checked={!!currentSides[key]}
                                                      onChange={e => {
                                                        updateVoidProperty(floor.id, apt.id, v.id, 'optionalSides', {
                                                          ...currentSides,
                                                          [key]: e.target.checked
                                                        });
                                                      }}
                                                      style={{ width: '0.9rem', height: '0.9rem' }}
                                                    />
                                                    {label}
                                                  </label>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Shutter Toggle Section */}
                                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>🌀 Volet Roulant</span>
                                      <button
                                        onClick={() => {
                                          
                                          updateVoidProperty(floor.id, apt.id, v.id, 'shutter', isShutterActive ? null : { qty: 1, customLV: v.L || item.config.L, overrides: {} });
                                        }}
                                        style={{
                                          border: 'none',
                                          background: isShutterActive ? '#fee2e2' : '#e2e8f0',
                                          color: isShutterActive ? '#ef4444' : '#475569',
                                          fontSize: '0.75rem',
                                          fontWeight: 800,
                                          padding: '0.3rem 0.7rem',
                                          borderRadius: '4px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {isShutterActive ? '✕ Désactiver' : '＋ Activer'}
                                      </button>
                                    </div>

                                    {isShutterActive && (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>QUANTITÉ VOLET</label>
                                          <DebouncedInput
                                            type="number"
                                            className="input"
                                            value={actualShutter.qty !== undefined ? actualShutter.qty : 1}
                                            onChange={val => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.qty', val)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', textAlign: 'center' }}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>LARGEUR LAME (LV) mm</label>
                                          <DebouncedInput
                                            type="number"
                                            className="input"
                                            value={actualShutter.customLV !== undefined ? actualShutter.customLV : ''}
                                            onChange={val => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.customLV', val)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', textAlign: 'center' }}
                                            placeholder={v.L || item.config.L}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>MANOEUVRE</label>
                                          <select
                                            className="input"
                                            value={actualShutter.overrides?.controlPosition || ''}
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
                                            value={actualShutter.overrides?.caissonId || ''}
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
                                            value={actualShutter.overrides?.lameId || ''}
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
                                            value={actualShutter.overrides?.glissiereId || ''}
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
                                            value={actualShutter.overrides?.axeId || ''}
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
                                             value={actualShutter.overrides?.kitId || ''}
                                             onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.kitId', e.target.value)}
                                             style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                           >
                                             <option value="">Auto</option>
                                             {(data.shutterComponents?.kits || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                           </select>
                                         </div>
                                         {(() => {
                                           const selectedKitId = actualShutter.overrides?.kitId !== undefined && actualShutter.overrides?.kitId !== '' 
                                             ? actualShutter.overrides?.kitId 
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
                                                 value={actualShutter.overrides?.moteurId || ''}
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

                                  {/* Assign Button */}
                                  <button 
                                    onClick={() => setAssignPopupState({ sourceVoid: v })}
                                    className="btn btn-secondary"
                                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.78rem', fontWeight: 800, background: '#f0fdfa', border: '1.5px dashed #5eead4', color: '#0f766e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}
                                  >
                                    <Save size={14} /> Assigner à d'autres fenêtres...
                                  </button>

                                  {/* Individual Validation Button */}
                                  {v.productionLaunched ? (
                                    <div style={{ width: '100%', padding: '0.6rem', fontSize: '0.78rem', fontWeight: 800, background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '0.5rem' }}>
                                      🚀 Lancée en Production
                                    </div>
                                  ) : !v.measurementsValidated ? (
                                    <button 
                                      onClick={() => setVoidToValidate({ floorId: floor.id, aptId: apt.id, voidId: v.id })}
                                      className="btn btn-primary"
                                      style={{ width: '100%', padding: '0.6rem', fontSize: '0.78rem', fontWeight: 800, background: '#0ea5e9', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '0.5rem' }}
                                    >
                                      <CheckCircle size={14} /> Valider cette fenêtre
                                    </button>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <div style={{ flex: 2, padding: '0.6rem', fontSize: '0.78rem', fontWeight: 800, background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '0.5rem' }}>
                                        <CheckCircle size={14} /> Fenêtre Validée
                                      </div>
                                      <button 
                                        onClick={() => {
                                          updateVoidProperty(floor.id, apt.id, v.id, 'measurementsValidated', false);
                                        }}
                                        style={{ flex: 1, padding: '0.6rem', fontSize: '0.72rem', fontWeight: 700, background: '#fef9c3', border: '1px solid #fde047', color: '#854d0e', cursor: 'pointer', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                      >
                                        ✏️ Modifier
                                      </button>
                                    </div>
                                  )}

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

        {/* Lancement de Production Button */}
        {hasPlan && (
          <button 
            onClick={() => setShowValidation(true)}
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 800, borderRadius: '0.75rem', marginTop: '1rem', background: '#0f766e', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.4)' }}
          >
            <CheckCircle size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Lancement en Production
          </button>
        )}

        {/* Footer info */}
        <div style={{ marginTop: '2rem', textAlign: 'center', padding: '1rem', opacity: 0.5 }}>
          <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          <span style={{ fontSize: '0.75rem' }}>Accès Sécurisé Technicien Prise de Mesures</span>
        </div>
        {renderValidationPopup()}
        {renderIndividualValidationPopup()}
        {renderAssignPopup()}
      </div>
    </div>
  );
};

export default TechnicianPortal;
