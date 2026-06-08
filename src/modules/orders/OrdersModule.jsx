import React, { useState, useMemo } from 'react';
import { ShoppingBag, FileText, Ruler, Plus, Trash2, CheckCircle, Package, Scissors, Download, ExternalLink, ChevronRight, ChevronDown, ListOrdered, ShoppingCart, Layers, ArrowLeft, ClipboardList, Settings, Copy, QrCode } from 'lucide-react';
import { FormulaEngine } from '../../engine/formula-engine';
import { QuoteSettingsPanel } from '../commercial/CommercialModule';
import jsPDF from 'jspdf';
import { getTechnicalDrawingDataURL } from '../../utils/drawingUtils';

const ItemPreview = ({ config, database }) => {
  const [dataUrl, setDataUrl] = React.useState(null);
  
  React.useEffect(() => {
    if (config && database) {
      const url = getTechnicalDrawingDataURL(config, database);
      setDataUrl(url);
    }
  }, [config, database]);

  if (!dataUrl) return <div style={{ width: '100%', height: '100%', background: '#f1f5f9' }} />;

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      background: 'white', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px'
    }}>
      <img 
        src={dataUrl} 
        alt="Aperçu" 
        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
      />
    </div>
  );
};const syncSitePlanToMeasurements = (sitePlan, items) => {
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

const OrdersModule = ({ data, setData, quoteSettings, setQuoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [activeOrderTab, setActiveOrderTab] = useState('measurements'); // 'measurements', 'batches', 'purchasing', 'glass'
  const [measurementSubTab, setMeasurementSubTab] = useState('cotes'); // 'cotes' | 'structure'
  const [selectedBatchId, setSelectedBatchId] = useState('current'); // 'current' or batch index
  const [showSettings, setShowSettings] = useState(false);
  const [listView, setListView] = useState('active'); // 'active' | 'history'
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [namingMeasure, setNamingMeasure] = useState(null); // { itemIdx, mId, qty, names: [], floors: [] }
  const [shutterMeasure, setShutterMeasure] = useState(null); // { itemIdx, mId, shutters: [] }
  const [showSituationModal, setShowSituationModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [situationRemarks, setSituationRemarks] = useState({}); // { itemId: string }
  const [situationSelection, setSituationSelection] = useState(new Set()); // Set of item IDs to include
  
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

  const activeSitePlan = useMemo(() => {
    if (!selectedOrder) return { floors: [] };
    const client = data?.clients?.find(c => c.id === selectedOrder.clientId);
    if (!client) return { floors: [] };
    const plans = client.sitePlans || [];
    if (selectedOrder.sitePlanId) {
      return plans.find(p => p.id === selectedOrder.sitePlanId) || { floors: [] };
    }
    for (const plan of plans) {
       for (const floor of (plan.floors || [])) {
          for (const apt of (floor.apartments || [])) {
             for (const voidItem of (apt.voids || [])) {
                if (selectedOrder.items?.some(i => i.id === voidItem.itemId)) {
                   return plan;
                }
             }
          }
       }
    }
    return plans.length > 0 ? plans[0] : { floors: [] };
  }, [data?.clients, selectedOrder]);

  const handleUpdateOrder = (updatedOrder) => {
    setData(prev => ({
      ...prev,
      orders: prev.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o)
    }));
  };

  const updateClientPlanInDB = (updatedPlan) => {
    setData(prev => {
      if (!selectedOrder) return prev;
      const selectedClient = prev.clients?.find(c => c.id === selectedOrder.clientId);
      if (!selectedClient) return prev;
      
      const updatedClients = (prev.clients || []).map(c => {
        if (c.id !== selectedClient.id) return c;
        const plans = c.sitePlans || [];
        const planExists = plans.some(p => p.id === updatedPlan.id);
        const newPlans = planExists 
          ? plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
          : [...plans, updatedPlan];
        return { ...c, sitePlans: newPlans };
      });
      return { ...prev, clients: updatedClients };
    });
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
    
    const qtyStr = window.prompt(`Combien de fenêtres pour cette cote ? (Saisir 2 pour créer 2 lignes nommables séparément)`, "1");
    const qtyCount = Math.max(1, parseInt(qtyStr) || 1);
    
    const newMeasures = [];
    for(let i=0; i<qtyCount; i++) {
      newMeasures.push({
        id: `MEAS-${Date.now()}-${i}-${Math.floor(Math.random()*1000)}`,
        L: item.config.L,
        H: item.config.H,
        wallDepth: '',
        qty: 1,
        label: qtyCount > 1 ? `${item.label} ${i+1}` : ''
      });
    }
    
    const updatedItems = [...selectedOrder.items];
    updatedItems[orderItemIndex] = {
      ...item,
      siteMeasurements: [...(item.siteMeasurements || []), ...newMeasures]
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
        m.id === measureId ? { ...m, [field]: (['instanceNames', 'shutterList', 'label', 'partOverrides'].includes(field) ? value : (parseFloat(value) || 0)) } : m
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

  const addFloor = () => {
    if (!selectedOrder) return;
    const currentPlan = activeSitePlan;
    const updatedPlan = {
      ...currentPlan,
      floors: [
        ...(currentPlan.floors || []),
        { id: `FLOOR-${Date.now()}`, name: `Étage ${(currentPlan.floors || []).length + 1}`, apartments: [] }
      ]
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const deleteFloor = (floorId) => {
    if (!selectedOrder) return;
    const currentPlan = activeSitePlan;
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).filter(f => f.id !== floorId)
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const updateFloorName = (floorId, name) => {
    if (!selectedOrder) return;
    const currentPlan = activeSitePlan;
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).map(f => f.id === floorId ? { ...f, name } : f)
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const addApartment = (floorId) => {
    if (!selectedOrder) return;
    const currentPlan = activeSitePlan;
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).map(f => {
        if (f.id !== floorId) return f;
        return {
          ...f,
          apartments: [
            ...(f.apartments || []),
            { id: `APT-${Date.now()}`, name: `Appt ${(f.apartments || []).length + 1}`, voids: [] }
          ]
        };
      })
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const deleteApartment = (floorId, aptId) => {
    if (!selectedOrder) return;
    const currentPlan = activeSitePlan;
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).map(f => {
        if (f.id !== floorId) return f;
        return {
          ...f,
          apartments: (f.apartments || []).filter(a => a.id !== aptId)
        };
      })
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const updateApartmentName = (floorId, aptId, name) => {
    if (!selectedOrder) return;
    const currentPlan = activeSitePlan;
    const updatedPlan = {
      ...currentPlan,
      floors: (currentPlan.floors || []).map(f => {
        if (f.id !== floorId) return f;
        return {
          ...f,
          apartments: (f.apartments || []).map(a => a.id === aptId ? { ...a, name } : a)
        };
      })
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const addVoid = (floorId, aptId) => {
    if (!selectedOrder) return;
    const currentPlan = activeSitePlan;
    const defaultItem = selectedOrder.items[0];
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
              voids: [
                ...(a.voids || []),
                {
                  id: `VOID-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                  name: `Vide ${(a.voids || []).length + 1}`,
                  itemId: defaultItem?.id || '',
                  L: defaultItem?.config?.L || 1200,
                  H: defaultItem?.config?.H || 1200,
                  wallDepth: '',
                  handleHeight: '',
                  shutter: defaultItem?.config?.hasShutter ? {
                    qty: 1,
                    customLV: defaultItem?.config?.L || 1200,
                    overrides: {}
                  } : null
                }
              ]
            };
          })
        };
      })
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const deleteVoid = (floorId, aptId, voidId) => {
    if (!selectedOrder) return;
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
              voids: (a.voids || []).filter(v => v.id !== voidId)
            };
          })
        };
      })
    };
    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const updateVoidProperty = (floorId, aptId, voidId, property, value) => {
    if (!selectedOrder) return;
    const selectedClient = data.clients?.find(c => c.id === selectedOrder.clientId);
    if (!selectedClient) return;

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
                  const item = selectedOrder.items.find(i => i.id === value);
                  return {
                    ...v,
                    itemId: value,
                    L: item?.config?.L || v.L,
                    H: item?.config?.H || v.H,
                    shutter: item?.config?.hasShutter ? {
                      qty: 1,
                      customLV: item?.config?.L || v.L,
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
                        customLV: parseFloat(value) || 0
                      }
                    };
                  }
                  if (property.startsWith('shutter.overrides.')) {
                    const overrideField = property.split('.')[2];
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

    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);
  };

  const applyVoidToAllSameInApartment = (floorId, aptId, sourceVoid) => {
    if (!selectedOrder) return;
    const selectedClient = data.clients?.find(c => c.id === selectedOrder.clientId);
    if (!selectedClient) return;

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
                if (v.itemId === sourceVoid.itemId) {
                  return {
                    ...v,
                    L: sourceVoid.L,
                    H: sourceVoid.H,
                    wallDepth: sourceVoid.wallDepth,
                    handleHeight: sourceVoid.handleHeight,
                    shutter: JSON.parse(JSON.stringify(sourceVoid.shutter || { qty: 1, overrides: {} }))
                  };
                }
                return v;
              })
            };
          })
        };
      })
    };

    const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
    updateClientPlanInDB(updatedPlan);

    alert(`Configuration appliquée à toutes les ouvertures identiques de cet appartement !`);
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
          
          (bom.shutters || []).forEach(s => {
            const unit = (s.priceUnit || '').toUpperCase();
            if (unit === 'ML' || unit === 'M') {
              // Add to profiles if measured in ML
              const key = `${s.id}-${item.config.colorId}`;
              const existing = allProfiles.find(x => x.key === key);
              if (existing) {
                existing.totalMeasure += (s.totalMeasure || 0) * m.qty;
              } else {
                allProfiles.push({ 
                  ...s, 
                  key, 
                  colorId: item.config.colorId,
                  totalMeasure: (s.totalMeasure || 0) * m.qty 
                });
              }
            } else {
              // Add to accessories otherwise
              accs.push(s);
            }
          });

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
        const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
        const maxW = 35;
        const maxH = 20;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
      } catch (e) {
        try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 35, 20); } catch(e2) {}
      }
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

    // ----- HEADER SECTION -----
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
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('DEMANDE DE PRIX / PROFORMA', pw - 15, y + 15, { align: 'right' });
    
    y += 35;
    
    const boxY = y;
    const boxWidth = (pw - 35) / 2;
    
    // Company Box
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.roundedRect(15, boxY, boxWidth, 42, 2, 2);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(quoteSettings?.companyName || 'Mon Entreprise', 18, boxY + 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cy = boxY + 11;
    if (quoteSettings?.companyAddress) {
      const addressLines = doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6);
      doc.text(addressLines, 18, cy);
      cy += addressLines.length * 4;
    }
    const phone = quoteSettings?.companyPhone || '';
    const email = quoteSettings?.companyEmail || '';
    if (phone || email) {
      doc.text(`${phone} ${email ? ' - ' + email : ''}`, 18, cy);
      cy += 5;
    }
    doc.setTextColor(80, 80, 80);
    if (quoteSettings?.companyRC) { doc.text(`RC N°: ${quoteSettings.companyRC}`, 18, cy); cy += 4; }
    if (quoteSettings?.companyIMP) { doc.text(`AI N°: ${quoteSettings.companyIMP}`, 18, cy); cy += 4; }
    if (quoteSettings?.companyMF) { doc.text(`NIF N°: ${quoteSettings.companyMF}`, 18, cy); cy += 4; }
    doc.setTextColor(0, 0, 0);

    // Supplier Box
    const rightBoxXHeader = 15 + boxWidth + 5;
    doc.roundedRect(rightBoxXHeader, boxY, boxWidth, 42, 2, 2);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Destinataire / Fournisseur :', rightBoxXHeader + 3, boxY + 6);
    doc.setFontSize(10);
    doc.text('_________________________', rightBoxXHeader + 3, boxY + 11);
    
    y = boxY + 48;

    const client = data?.clients?.find(c => c.id === selectedOrder.clientId);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Chantier : ${selectedOrder.id}`, 15, y);
    doc.text(`Client Final : ${client?.nom || '—'}`, 15, y + 6);
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 15, y + 12);
    y += 20;

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

  const generateSituationPDF = () => {
    if (!selectedOrder) return;
    const client = data?.clients?.find(c => c.id === selectedOrder.clientId);
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header Branding
    if (quoteSettings?.logoBase64) {
      try {
        const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
        const maxW = 35;
        const maxH = 20;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
      } catch (e) {
        try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 35, 20); } catch (e2) {}
      }
    }
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(quoteSettings?.companyName || 'MA SOCIETE', 55, y + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(quoteSettings?.companyAddress || '', 55, y + 10);
    doc.text(`${quoteSettings?.companyPhone || ''} ${quoteSettings?.companyEmail ? ' | ' + quoteSettings.companyEmail : ''}`, 55, y + 15);
    y += 25;

    // Title
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('ÉTAT DE SITUATION DE COMMANDE', pw / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0); y += 12;

    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Commande N°: ${selectedOrder.id}`, 15, y);
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, pw - 15, y, { align: 'right' });
    y += 6;
    doc.text(`Client Final : ${client?.nom || 'Non spécifié'}`, 15, y);
    y += 10;

    // --- SECTION 1: PRODUCTION LANCÉE ---
    doc.setFont('helvetica', 'bold'); doc.setFillColor(240, 246, 255); doc.rect(15, y, pw - 30, 8, 'F');
    doc.text('1. ÉLÉMENTS EN COURS DE FABRICATION / LANCÉS', 20, y + 5.5);
    y += 12;

    doc.setFontSize(8); doc.text('Produit', 15, y);
    doc.text('Dim. Devis', 70, y);
    doc.text('Dim. Réelles', 100, y);
    doc.text('Écart (+/-)', 135, y);
    doc.text('Qté', 185, y, { align: 'right' });
    y += 2; doc.line(15, y, pw - 15, y); y += 5;

    doc.setFont('helvetica', 'normal');
    let hasLaunched = false;
    selectedOrder.items.forEach(item => {
      if (!situationSelection.has(item.id)) return;
      
      const batchesWithItem = (selectedOrder.batches || []).filter(b => b.items?.some(bi => bi.id === item.id));
      batchesWithItem.forEach(batch => {
        const batchItem = batch.items.find(bi => bi.id === item.id);
        (batchItem.measurements || []).forEach(m => {
          if (m.qty <= 0) return;
          hasLaunched = true;
          doc.text(item.label, 15, y);
          doc.text(`${item.config.L}x${item.config.H}`, 70, y);
          doc.setFont('helvetica', 'bold');
          doc.text(`${m.L}x${m.H}${m.wallDepth ? ' (P:'+m.wallDepth+')' : ''}`, 100, y);
          
          const diffL = m.L - item.config.L;
          const diffH = m.H - item.config.H;
          doc.setTextColor(diffL === 0 && diffH === 0 ? 100 : (diffL > 0 || diffH > 0 ? 16 : 220), 0, 0);
          doc.text(`${diffL > 0 ? '+' : ''}${diffL} / ${diffH > 0 ? '+' : ''}${diffH}`, 135, y);
          doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
          doc.text(String(m.qty), 185, y, { align: 'right' });
          y += 6;
          if (y > 270) { doc.addPage(); y = 15; }
        });
      });
    });
    if (!hasLaunched) { doc.text('Aucun élément lancé pour cette sélection.', 15, y); y += 6; }

    y += 10;
    // --- SECTION 2: RESTE À PRODUIRE ---
    doc.setFont('helvetica', 'bold'); doc.setFillColor(255, 247, 237); doc.rect(15, y, pw - 30, 8, 'F');
    doc.text('2. ÉLÉMENTS RESTANTS (EN ATTENTE DE LANCEMENT)', 20, y + 5.5);
    y += 12;

    doc.setFontSize(8); doc.text('Produit', 15, y);
    doc.text('Dim. Devis', 70, y);
    doc.text('Reste (Qté)', 110, y);
    doc.text('Motif / Observation', 140, y);
    y += 2; doc.line(15, y, pw - 15, y); y += 5;

    doc.setFont('helvetica', 'normal');
    selectedOrder.items.forEach(item => {
      if (!situationSelection.has(item.id)) return;
      const stats = (selectedOrder.batches || []).reduce((sum, b) => {
        const bi = b.items?.find(x => x.id === item.id);
        return sum + (bi?.measurements || []).reduce((s, m) => s + m.qty, 0);
      }, 0);
      const remaining = (item.qty || 1) - stats;
      if (remaining > 0) {
        doc.text(item.label, 15, y);
        doc.text(`${item.config.L}x${item.config.H}`, 70, y);
        doc.setFont('helvetica', 'bold'); doc.text(String(remaining), 110, y); doc.setFont('helvetica', 'normal');
        
        const remark = situationRemarks[item.id] || "En attente de validation technique / cotes.";
        const splitRemark = doc.splitTextToSize(remark, 55);
        doc.text(splitRemark, 140, y);
        y += Math.max(6, splitRemark.length * 4);
        if (y > 270) { doc.addPage(); y = 15; }
      }
    });

    y += 20;
    doc.setFontSize(10);
    doc.text('Ce document est un état de situation provisoire de la production.', 15, y);
    y += 30;
    doc.setFont('helvetica', 'bold'); doc.text('Visa Client', 15, y); doc.text('Visa Atelier', pw - 60, y);

    doc.save(`Etat_Commande_${selectedOrder.id}.pdf`);
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
             <button 
               onClick={() => setShowQRModal(true)}
               className="btn btn-secondary" 
               style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}
             >
               <QrCode size={16} /> QR Code Technicien
             </button>
             <button 
               onClick={() => {
                 setSituationSelection(new Set(selectedOrder.items.map(i => i.id)));
                 setShowSituationModal(true);
               }}
               className="btn btn-secondary" 
               style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white' }}
             >
               <FileText size={16} color="#3b82f6" /> État de Situation
             </button>
             <span style={{ padding: '0.4rem 0.8rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
               Statut: {selectedOrder.status}
             </span>
          </div>
        </header>

        {showQRModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', width: '420px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '1.2rem' }}>📱 Prise de Mesures Mobile</h3>
                <button onClick={() => setShowQRModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: '#64748b' }}>✕</button>
              </div>

              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'inline-block', marginBottom: '1.5rem' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?mode=technician&orderId=${selectedOrder.id}`)}`} 
                  alt="QR Code Prise de Mesures" 
                  style={{ width: '200px', height: '200px', display: 'block' }}
                />
              </div>

              <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                Scannez ce QR Code avec un smartphone ou une tablette sur le chantier pour ouvrir le plan et saisir les dimensions réelles en temps réel.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?mode=technician&orderId=${selectedOrder.id}`;
                    navigator.clipboard.writeText(url);
                    alert("Lien copié dans le presse-papiers !");
                  }}
                  style={{ flex: 1, padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer', background: 'white', color: '#64748b', fontWeight: 600 }}
                >
                  🔗 Copier le lien
                </button>
                <button 
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?mode=technician&orderId=${selectedOrder.id}`;
                    window.open(url, '_blank');
                  }}
                  style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', background: '#0f766e', color: 'white', fontWeight: 700 }}
                >
                  🌐 Ouvrir la page
                </button>
              </div>
            </div>
          </div>
        )}

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

        {activeOrderTab === 'measurements' && (() => {
          const hasPlan = activeSitePlan.floors && activeSitePlan.floors.length > 0 && activeSitePlan.floors.some(f => f.apartments?.some(a => a.voids?.length > 0));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!hasPlan ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #cbd5e1' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>📐</span>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>En attente du Plan de Chantier</h4>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                    Pour pouvoir saisir vos cotes réelles, veuillez d'abord créer la structure du chantier (Étages ➜ Appartements ➜ Vides) dans l'onglet **"Plan de Chantier"** accessible dans la barre de navigation sur la gauche.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* QR Code and Mobile Portal Info Card */}
                  <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem', background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ padding: '0.5rem', background: 'white', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', flexShrink: 0 }}>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?mode=technician&orderId=${selectedOrder.id}`)}`} 
                        alt="QR Code Prise de Mesures" 
                        style={{ width: '100px', height: '100px', display: 'block' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, color: '#065f46', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>📱 Portail Prise de Mesures Mobile</h4>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', color: '#047857', lineHeight: 1.4 }}>
                        Le technicien peut scanner ce QR Code sur le chantier pour ouvrir le plan directement sur son smartphone ou tablette et saisir les dimensions réelles.
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?mode=technician&orderId=${selectedOrder.id}`;
                            navigator.clipboard.writeText(url);
                            alert("Lien copié dans le presse-papiers !");
                          }}
                          className="btn" 
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', background: 'white', border: '1px solid #a7f3d0', color: '#047857', fontWeight: 700, cursor: 'pointer' }}
                        >
                          🔗 Copier le lien
                        </button>
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?mode=technician&orderId=${selectedOrder.id}`;
                            window.open(url, '_blank');
                          }}
                          className="btn" 
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', background: '#047857', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                        >
                          🌐 Ouvrir la page
                        </button>
                      </div>
                    </div>
                  </div>

                  {(activeSitePlan.floors || []).map(floor => {
                  const floorHasVoids = floor.apartments?.some(a => a.voids?.length > 0);
                  if (!floorHasVoids) return null;

                  return (
                    <div key={floor.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Floor Separator */}
                      <div style={{ padding: '0.5rem 1rem', background: '#e2e8f0', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>🏢</span>
                        <strong style={{ fontSize: '0.95rem', color: '#1e293b', textTransform: 'uppercase' }}>{floor.name}</strong>
                      </div>

                      {/* Apartments */}
                      {(floor.apartments || []).map(apt => {
                        if (!apt.voids || apt.voids.length === 0) return null;

                        return (
                          <div key={apt.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.9rem' }}>🚪</span>
                              <strong style={{ fontSize: '0.9rem', color: '#475569' }}>{apt.name}</strong>
                            </div>

                            {/* Voids Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                              {(apt.voids || []).map(v => {
                                const item = selectedOrder.items.find(i => i.id === v.itemId);
                                if (!item) return null;

                                
                                const actualShutter = v.shutter !== undefined ? v.shutter : (item.config.hasShutter ? { qty: 1, customLV: '', overrides: {} } : null);
                                const isShutterActive = actualShutter !== null;
const previewConfig = {
                                  ...item.config,
                                  L: v.L !== undefined && v.L !== '' ? parseFloat(v.L) : item.config.L,
                                  H: v.H !== undefined && v.H !== '' ? parseFloat(v.H) : item.config.H,
                                  openingDirection: v.openingDirection || item.config.openingDirection || 'gauche',
                                  hasShutter: v.shutter !== undefined ? !!v.shutter : item.config.hasShutter,
                                  shutterConfig: v.shutter ? {
                                    ...(item.config.shutterConfig || {}),
                                    ...(v.shutter.overrides || {})
                                  } : (v.shutter === null ? null : item.config.shutterConfig)
                                };

                                return (
                                  <div key={v.id} style={{ display: 'flex', background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                                    {/* Visual Preview */}
                                    <div style={{ width: '220px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', flexShrink: 0 }}>
                                      <ItemPreview config={previewConfig} database={data} />
                                    </div>

                                    {/* Form Panel */}
                                    <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                      {/* Header Row */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                                        <div>
                                          <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 700, marginRight: '0.5rem' }}>{v.name}</span>
                                          <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{item.label}</strong>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cotes Devis: {item.config.L} x {item.config.H} mm</span>
                                      </div>

                                      {/* Real Dimensions Grid */}
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <div>
                                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Largeur Réelle (L) mm</label>
                                          <input
                                            type="number"
                                            className="input"
                                            value={v.L !== undefined ? v.L : ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'L', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                                            placeholder={item.config.L}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Hauteur Réelle (H) mm</label>
                                          <input
                                            type="number"
                                            className="input"
                                            value={v.H !== undefined ? v.H : ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'H', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                                            placeholder={item.config.H}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Prof. Mur (mm)</label>
                                          <input
                                            type="number"
                                            className="input"
                                            value={v.wallDepth !== undefined ? v.wallDepth : ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'wallDepth', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                                            placeholder="ex: 120"
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Ht. Poignée (mm)</label>
                                          <input
                                            type="number"
                                            className="input"
                                            value={v.handleHeight !== undefined ? v.handleHeight : ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'handleHeight', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                                            placeholder="Auto"
                                          />
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Sens Ouv.</label>
                                          <select
                                            className="input"
                                            value={v.openingDirection || item.config.openingDirection || ''}
                                            onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'openingDirection', e.target.value)}
                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
                                          >
                                            <option value="">Auto ({item.config.openingDirection || 'gauche'})</option>
                                            <option value="gauche">Gauche</option>
                                            <option value="droit">Droit</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Inline Shutter Configuration */}
                                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>🌀 Configuration du Volet</span>
                                          <button
                                            onClick={() => {
                                              
                                              updateVoidProperty(floor.id, apt.id, v.id, 'shutter', isShutterActive ? null : { qty: 1, customLV: v.L || item.config.L, overrides: {} });
                                            }}
                                            style={{
                                              border: 'none',
                                              background: isShutterActive ? '#fef3c7' : '#e2e8f0',
                                              color: isShutterActive ? '#d97706' : '#475569',
                                              fontSize: '0.7rem',
                                              fontWeight: 700,
                                              padding: '0.2rem 0.6rem',
                                              borderRadius: '4px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {isShutterActive ? '❌ Retirer le volet' : '➕ Activer le volet'}
                                          </button>
                                        </div>

                                        {isShutterActive && (
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                            <div>
                                              <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Quantité</label>
                                              <input
                                                type="number"
                                                className="input"
                                                value={actualShutter.qty}
                                                onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.qty', e.target.value)}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Largeur (LV) mm</label>
                                              <input
                                                type="number"
                                                className="input"
                                                value={actualShutter.customLV || ''}
                                                placeholder="Auto"
                                                onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.customLV', e.target.value)}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
                                              />
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Manoeuvre</label>
                                              <select
                                                className="input"
                                                value={actualShutter.overrides?.controlPosition || ''}
                                                onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.controlPosition', e.target.value)}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto', fontWeight: 700 }}
                                              >
                                                <option value="">Auto</option>
                                                <option value="Gauche">Gauche</option>
                                                <option value="Droite">Droite</option>
                                              </select>
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Caisson</label>
                                              <select
                                                className="input"
                                                value={actualShutter.overrides?.caissonId || ''}
                                                onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.caissonId', e.target.value)}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
                                              >
                                                <option value="">Auto</option>
                                                {(data.shutterComponents?.caissons || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                              </select>
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Lame</label>
                                              <select
                                                className="input"
                                                value={actualShutter.overrides?.lameId || ''}
                                                onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.lameId', e.target.value)}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
                                              >
                                                <option value="">Auto</option>
                                                {(data.shutterComponents?.lames || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                              </select>
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Glissière</label>
                                              <select
                                                className="input"
                                                value={actualShutter.overrides?.glissiereId || ''}
                                                onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.glissiereId', e.target.value)}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
                                              >
                                                <option value="">Auto</option>
                                                {(data.shutterComponents?.glissieres || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                              </select>
                                            </div>
                                            <div>
                                              <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Axe</label>
                                              <select
                                                className="input"
                                                value={actualShutter.overrides?.axeId || ''}
                                                onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.axeId', e.target.value)}
                                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
                                              >
                                                <option value="">Auto</option>
                                                {(data.shutterComponents?.axes || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                              </select>
                                            </div>
                                             <div>
                                               <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Kit</label>
                                               <select
                                                 className="input"
                                                 value={actualShutter.overrides?.kitId || ''}
                                                 onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.kitId', e.target.value)}
                                                 style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
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
                                               (selectedKitId && selectedKitId.toLowerCase().includes('mote')) || 
                                               (selectedKit?.name && selectedKit.name.toLowerCase().includes('moteur'));
                                               if (!isMotor) return null;
                                               return (
                                                 <div>
                                                   <label style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Moteur</label>
                                                   <select
                                                     className="input"
                                                     value={actualShutter.overrides?.moteurId || ''}
                                                     onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'shutter.overrides.moteurId', e.target.value)}
                                                     style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', minHeight: 'auto' }}
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

                                      {/* Actions Footer */}
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                                        <button
                                          onClick={() => applyVoidToAllSameInApartment(floor.id, apt.id, v)}
                                          className="btn btn-secondary"
                                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', color: '#4f46e5', borderColor: '#c7d2fe', background: '#f5f3ff', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                        >
                                          <Copy size={14} /> Appliquer à tous les identiques
                                        </button>
                                      </div>
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

            {/* Launch Fabrication Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', padding: '1.25rem', background: '#f0f9ff', borderRadius: '1rem', border: '1px dashed #3b82f6' }}>
              <button
                onClick={handleLaunchProductionBatch}
                className="btn btn-primary"
                style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
              >
                <CheckCircle size={18} /> VALIDER ET LANCER LA FABRICATION (LOT EN COURS)
              </button>
            </div>
          </div>
          );
        })()}
        {activeOrderTab === 'batches' && (
          <div className="glass shadow-md">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Historique des Lots de Fabrication</h3>
              <button 
                onClick={() => {
                  if(!window.confirm('Voulez-vous réinitialiser les lancements de production de cette commande pour pouvoir retester ?')) return;
                  const currentPlan = activeSitePlan;
                  const updatedPlan = {
                    ...currentPlan,
                    floors: (currentPlan.floors || []).map(f => ({
                      ...f,
                      apartments: (f.apartments || []).map(a => ({
                        ...a,
                        voids: (a.voids || []).map(v => ({ ...v, productionLaunched: false }))
                      }))
                    }))
                  };
                  const updatedItems = syncSitePlanToMeasurements(updatedPlan, selectedOrder.items);
                  setData(prev => {
                    const updatedClients = (prev.clients || []).map(c => {
                      if (c.id !== selectedOrder.clientId) return c;
                      const plans = c.sitePlans || [];
                      const planExists = plans.some(p => p.id === updatedPlan.id);
                      const newPlans = planExists ? plans.map(p => p.id === updatedPlan.id ? updatedPlan : p) : [...plans, updatedPlan];
                      return { ...c, sitePlans: newPlans };
                    });
                    const updatedOrders = (prev.orders || []).map(o => o.id === selectedOrder.id ? { ...o, items: updatedItems, status: 'Mesuré', batches: [] } : o);
                    return { ...prev, clients: updatedClients, orders: updatedOrders };
                  });
                  alert('Réinitialisé ! Vous pouvez maintenant relancer la production dans le portail technicien.');
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
              >
                🔧 Reset Lancement (Test)
              </button>
            </div>
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
                           <td data-label="Code" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {p.isGroup ? '---' : (() => {
                                if (p.reference) return p.reference;
                                const allSC = [
                                  ...(data.shutterComponents?.glissieres || []),
                                  ...(data.shutterComponents?.lames || []),
                                  ...(data.shutterComponents?.lameFinales || []),
                                  ...(data.shutterComponents?.caissons || []),
                                  ...(data.shutterComponents?.axes || []),
                                  ...(data.shutterComponents?.kits || []),
                                  ...(data.shutterComponents?.moteurs || []),
                                  ...(data.shutterComponents?.extras || []),
                                ];
                                const dbSC = allSC.find(x => x.id === p.id);
                                if (dbSC?.reference) return dbSC.reference;
                                const prof = (data.profiles || []).find(x => x.id === p.id);
                                if (prof?.reference) return prof.reference;
                                return '---';
                              })()}
                            </td>
                           <td data-label="Nom" style={{ fontWeight: 600 }}>
                             {p.isGroup ? (
                               <div style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                 <Layers size={14} />
                                 {p.label}
                               </div>
                             ) : p.id && String(p.id).startsWith('VR-') ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <span style={{ fontWeight: 700, color: '#0f766e' }}>{p.name} {p.label ? `[${p.label}]` : ''}</span>
                                 <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid #cbd5e1', fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {(() => {
                                       const item = selectedOrder.items.find(i => p.source && p.source.includes(i.id)) || selectedOrder.items[0];
                                       const sc = item?.config?.shutterConfig || {};
                                       const selectedKitId = sc.kitId || '';
                                       const selectedKit = (data.shutterComponents?.kits || []).find(k => k.id === selectedKitId);
                                       const isMotor = selectedKit?.type === 'MOTEUR' || 
                                                       (selectedKitId && selectedKitId.toLowerCase().includes('mote')) || 
                                                       (selectedKit?.name && selectedKit.name.toLowerCase().includes('moteur'));
                                       return (
                                         <>
                                           {sc.lameId && <div><strong>Lames:</strong> {data.shutterComponents?.lames?.find(x => x.id === sc.lameId)?.name || sc.lameId}</div>}
                                           {sc.glissiereId && <div><strong>Coulisses:</strong> {data.shutterComponents?.glissieres?.find(x => x.id === sc.glissiereId)?.name || sc.glissiereId}</div>}
                                           {sc.caissonId && <div><strong>Caisson:</strong> {data.shutterComponents?.caissons?.find(x => x.id === sc.caissonId)?.name || sc.caissonId}</div>}
                                           {(sc.kitId || sc.axeId) && <div><strong>Axe / Kit:</strong> {selectedKit?.name || sc.kitId || sc.axeId}</div>}
                                           {isMotor && <div><strong>Moteur:</strong> {data.shutterComponents?.moteurs?.find(x => x.id === sc.moteurId)?.name || sc.moteurId || 'Automatique'}</div>}
                                         </>
                                       );
                                    })()}
                                 </div>
                               </div>
                             ) : (
                               <>{p.name} {p.label ? `[${p.label}]` : ''}</>
                             )}
                           </td>
                           <td data-label="Coul.">{data.colors?.find(c => c.id === p.colorId)?.name || p.colorId}</td>
                           <td data-label="ML" style={{ fontWeight: 700, color: p.isGroup ? '#7c3aed' : '#8b5cf6' }}>{(p.totalMeasure / 1000).toFixed(2)}</td>
                           <td data-label="Barres">{Math.ceil(p.totalMeasure / (p.barLength || 6000))}</td>
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
                   {siteResults.accessories.map(a => {
                     const unitLabel = a.unit || a.priceUnit || 'U';
                     const isMl = ['M', 'ML', 'JOINT'].includes(unitLabel.toUpperCase());
                     return (
                       <tr key={a.key}>
                         <td style={{ fontWeight: 600 }}>{a.name}</td>
                         <td style={{ fontSize: '0.8rem' }}>{unitLabel}</td>
                         <td style={{ fontWeight: 700, color: '#d97706' }}>
                           {isMl 
                              ? `${(a.totalMeasure / 1000).toFixed(2)} m` 
                              : (Number.isInteger(a.totalQty) ? a.totalQty : a.totalQty.toFixed(2))}
                         </td>
                       </tr>
                     );
                   })}
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
        {/* NAMING POPUP */}
        {namingMeasure && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <div className="glass shadow-2xl" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', width: '400px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Noms des Fenêtres ({namingMeasure.qty})</h3>
              <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {namingMeasure.names.map((name, i) => (
                  <div key={i} className="glass" style={{ padding: '1rem', background: '#f8fafc' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Fenêtre {i + 1} / {namingMeasure.qty}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="label" style={{ fontSize: '0.75rem' }}>Nom / Emplacement</label>
                        <input 
                          className="input" 
                          value={name} 
                          onChange={e => {
                            const newNames = [...namingMeasure.names];
                            newNames[i] = e.target.value;
                            setNamingMeasure({ ...namingMeasure, names: newNames });
                          }} 
                          placeholder="Ex: Cuisine..."
                        />
                      </div>
                      <div className="form-group">
                        <label className="label" style={{ fontSize: '0.75rem' }}>Étage</label>
                        <input 
                          className="input" 
                          value={namingMeasure.floors[i] || ''} 
                          onChange={e => {
                            const newFloors = [...namingMeasure.floors];
                            newFloors[i] = e.target.value;
                            setNamingMeasure({ ...namingMeasure, floors: newFloors });
                          }} 
                          placeholder="Ex: RDC, 1er..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                <button onClick={() => setNamingMeasure(null)} className="btn btn-secondary" style={{ flex: 1 }}>Annuler</button>
                <button 
                  onClick={() => {
                    const updatedItems = [...selectedOrder.items];
                    const itemIdx = namingMeasure.itemIdx;
                    const mId = namingMeasure.mId;
                    updatedItems[itemIdx] = {
                      ...updatedItems[itemIdx],
                      siteMeasurements: updatedItems[itemIdx].siteMeasurements.map(m => 
                        m.id === mId ? { ...m, instanceNames: namingMeasure.names, instanceFloors: namingMeasure.floors } : m
                      )
                    };
                    handleUpdateOrder({ ...selectedOrder, items: updatedItems });
                    setNamingMeasure(null);
                  }} 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SHUTTER LIST POPUP */}
        {shutterMeasure && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <div className="glass shadow-2xl" style={{ background: 'white', padding: '2rem', borderRadius: '1.5rem', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Configuration des Volets</h3>
                <button 
                  onClick={() => {
                    const newShutter = { id: Date.now(), qty: 1, customLV: 0, overrides: {} };
                    setShutterMeasure({ ...shutterMeasure, shutters: [...shutterMeasure.shutters, newShutter] });
                  }} 
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Plus size={18} /> Ajouter une cote volet
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {shutterMeasure.shutters.map((sh, sIdx) => (
                  <div key={sh.id} style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
                      <div className="form-group">
                        <label className="label">Quantité</label>
                        <input 
                          type="number" className="input" value={sh.qty} 
                          onChange={e => {
                            const newList = [...shutterMeasure.shutters];
                            newList[sIdx].qty = parseInt(e.target.value) || 1;
                            setShutterMeasure({ ...shutterMeasure, shutters: newList });
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Largeur (LV) mm</label>
                        <input 
                          type="number" className="input" value={sh.customLV} 
                          placeholder="Auto"
                          onChange={e => {
                            const newList = [...shutterMeasure.shutters];
                            newList[sIdx].customLV = parseFloat(e.target.value) || 0;
                            setShutterMeasure({ ...shutterMeasure, shutters: newList });
                          }}
                        />
                      </div>
                      {['controlPosition', 'caissonId', 'lameId', 'glissiereId', 'axeId', 'kitId'].map(field => (
                        <div key={field} className="form-group">
                          <label className="label" style={{ fontSize: '0.7rem' }}>
                            {field === 'controlPosition' ? 'Position Manoeuvre' : field.replace('Id', '')}
                          </label>
                          {field === 'controlPosition' ? (
                            <select 
                              className="input" style={{ fontSize: '0.8rem', fontWeight: 700 }}
                              value={sh.overrides?.[field] || ''}
                              onChange={e => {
                                const newList = [...shutterMeasure.shutters];
                                newList[sIdx].overrides = { ...newList[sIdx].overrides, [field]: e.target.value || undefined };
                                setShutterMeasure({ ...shutterMeasure, shutters: newList });
                              }}
                            >
                              <option value="">Auto</option>
                              <option value="Gauche">Gauche</option>
                              <option value="Droite">Droite</option>
                            </select>
                          ) : (
                            <select 
                              className="input" style={{ fontSize: '0.8rem' }}
                              value={sh.overrides?.[field] || ''}
                              onChange={e => {
                                const newList = [...shutterMeasure.shutters];
                                newList[sIdx].overrides = { ...newList[sIdx].overrides, [field]: e.target.value || undefined };
                                setShutterMeasure({ ...shutterMeasure, shutters: newList });
                              }}
                            >
                              <option value="">Auto</option>
                              {(data.shutterComponents?.[field.replace('Id', 's')] || []).map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end', marginBottom: '4px' }}>
                        <button 
                          onClick={() => {
                            const duplicateShutter = { ...sh, id: Date.now() + Math.random() };
                            const newList = [...shutterMeasure.shutters];
                            newList.splice(sIdx + 1, 0, duplicateShutter);
                            setShutterMeasure({ ...shutterMeasure, shutters: newList });
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '0.4rem 0.6rem', color: '#10b981', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                          title="Dupliquer ce volet"
                        >
                          <Copy size={14} style={{ marginRight: '4px' }} /> Dupliquer
                        </button>
                        <button 
                          onClick={() => {
                            if (!window.confirm("Appliquer cette configuration de volet à TOUTES les fenêtres de cette commande ?")) return;
                            const currentShutterCfg = { ...sh };
                            const updatedItems = selectedOrder.items.map(item => ({
                              ...item,
                              siteMeasurements: (item.siteMeasurements || []).map(m => ({
                                ...m,
                                shutterList: [{ ...currentShutterCfg, id: Date.now() + Math.random(), qty: m.qty }]
                              }))
                            }));
                            handleUpdateOrder({ ...selectedOrder, items: updatedItems });
                            setShutterMeasure(null);
                            alert("Configuration appliquée à toute la commande.");
                          }}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '0.4rem 0.6rem', color: '#7c3aed', borderColor: '#ddd6fe', background: '#f5f3ff' }}
                          title="Copier ces réglages sur toutes les fenêtres"
                        >
                          <Copy size={14} style={{ marginRight: '4px' }} /> Appliquer à tous
                        </button>
                        <button 
                          onClick={() => setShutterMeasure({ ...shutterMeasure, shutters: shutterMeasure.shutters.filter((_, i) => i !== sIdx) })}
                          style={{ color: '#ef4444', border: 'none', background: 'transparent', padding: '0.4rem', cursor: 'pointer' }}
                          title="Supprimer ce volet"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShutterMeasure(null)} className="btn btn-secondary">Annuler</button>
                <button 
                  onClick={() => {
                    updateSiteMeasurement(shutterMeasure.itemIdx, shutterMeasure.mId, 'shutterList', shutterMeasure.shutters);
                    setShutterMeasure(null);
                  }} 
                  className="btn btn-primary"
                  style={{ minWidth: '150px' }}
                >
                  Valider pour cette fenêtre
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SITUATION MODAL */}
        {showSituationModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <div className="glass shadow-2xl" style={{ background: 'white', padding: '2.5rem', borderRadius: '1.5rem', width: '850px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Générer l'État de Situation</h3>
                  <p style={{ color: '#64748b', margin: 0 }}>Sélectionnez les éléments à inclure et ajoutez vos remarques pour le client.</p>
                </div>
                <button onClick={() => setShowSituationModal(false)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="table-responsive" style={{ marginBottom: '2rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Inclure</th>
                      <th>Produit</th>
                      <th>Devis</th>
                      <th>Lancé</th>
                      <th>Reste</th>
                      <th>Remarque (si reste)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map(item => {
                      const launched = (selectedOrder.batches || []).reduce((sum, b) => {
                        const bi = b.items?.find(x => x.id === item.id);
                        return sum + (bi?.measurements || []).reduce((s, m) => s + m.qty, 0);
                      }, 0);
                      const remaining = (item.qty || 1) - launched;
                      
                      return (
                        <tr key={item.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={situationSelection.has(item.id)}
                              onChange={() => {
                                const next = new Set(situationSelection);
                                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                setSituationSelection(next);
                              }}
                              style={{ width: '20px', height: '20px' }}
                            />
                          </td>
                          <td style={{ fontWeight: 700 }}>{item.label}</td>
                          <td style={{ textAlign: 'center' }}>{item.qty || 1}</td>
                          <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{launched}</td>
                          <td style={{ textAlign: 'center', color: remaining > 0 ? '#f59e0b' : '#94a3b8', fontWeight: 700 }}>{remaining}</td>
                          <td>
                            {remaining > 0 && (
                              <input 
                                className="input" 
                                placeholder="Pourquoi pas encore lancé ?" 
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                                value={situationRemarks[item.id] || ''}
                                onChange={e => setSituationRemarks({ ...situationRemarks, [item.id]: e.target.value })}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowSituationModal(false)} className="btn btn-secondary">Annuler</button>
                <button 
                  onClick={() => {
                    generateSituationPDF();
                    setShowSituationModal(false);
                  }} 
                  className="btn btn-primary"
                  style={{ minWidth: '200px', background: '#3b82f6' }}
                  disabled={situationSelection.size === 0}
                >
                  Générer le Document PDF
                </button>
              </div>
            </div>
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

      </div>
  );
};

export default OrdersModule;
