import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CheckSquare, 
  Layers, 
  Package, 
  QrCode, 
  Printer, 
  FileText, 
  Copy, 
  ExternalLink, 
  Play, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Building, 
  ShoppingBag, 
  RefreshCw, 
  Sliders, 
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Lock,
  Archive,
  X,
  Smartphone,
  Eye,
  BarChart2,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import WorkshopAnalysisTab from './WorkshopAnalysisTab';

// Helper to classify joinery type according to strict workshop rules
export const classifyOpeningFamily = (item, database) => {
  const comp = database?.compositions?.find(c => c.id === item?.config?.compositionId);
  const openingType = (comp?.openingType || '').toLowerCase();
  const compoundType = (item?.config?.compoundType || '').toLowerCase();
  const label = (item?.label || '').toLowerCase();
  const name = (comp?.name || '').toLowerCase();

  // 1. Structure combinée Fixe + Coulissant => COULISSANT
  if (compoundType === 'fix_coulissant') {
    return 'coulissant';
  }

  // 2. Structure combinée Fixe + Ouvrant => OUVRANT
  if (compoundType === 'fix_ouvrant') {
    return 'ouvrant';
  }

  // 3. Coulissant seul
  if (openingType.includes('coulissant') || label.includes('coulissant') || name.includes('coulissant')) {
    return 'coulissant';
  }

  // 4. Fixe seul
  if (openingType.includes('fixe') || label.includes('fixe') || name.includes('fixe')) {
    return 'fixe';
  }

  // 5. Ouvrant seul (par défaut pour battant, oscillo, porte-fenêtre)
  return 'ouvrant';
};

// Helper to estimate sliding panel count (vantaux)
export const getSlidingPanelsCount = (item, database) => {
  const comp = database?.compositions?.find(c => c.id === item?.config?.compositionId);
  const text = `${comp?.name || ''} ${item?.label || ''}`.toLowerCase();
  if (text.includes('4 vantaux') || text.includes('4v')) return 4;
  if (text.includes('3 vantaux') || text.includes('3v')) return 3;
  if (text.includes('1 vantail') || text.includes('1v') || text.includes('galandage 1')) return 1;
  return 2; // Par défaut 2 vantaux pour coulissant standard
};

// Helper to calculate typology statistics for sub-lot products
export const getSubLotTypologyStats = (items) => {
  let coulissantSeul = 0;
  let ouvrantSeul = 0;
  let assemble = 0;
  let avecVolet = 0;

  (items || []).forEach(it => {
    const item = it.item || it;
    const compoundType = (item?.config?.compoundType || '').toLowerCase();
    const isCompound = compoundType === 'fix_coulissant' || compoundType === 'fix_ouvrant';

    if (isCompound) {
      assemble++;
    } else if (it.family === 'coulissant') {
      coulissantSeul++;
    } else if (it.family === 'ouvrant' || it.family === 'fixe') {
      ouvrantSeul++;
    }

    const hasShutter = !!(item?.config?.hasShutter || (it.shutter && it.shutter.qty > 0));
    if (hasShutter) {
      avecVolet++;
    }
  });

  return { coulissantSeul, ouvrantSeul, assemble, avecVolet };
};

export default function TrackingModule({ data, setData, quoteSettings }) {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [groupSize, setGroupSize] = useState(3);
  const [showCompletedBatchesModal, setShowCompletedBatchesModal] = useState(false);
  const [selectedCompletedBatchDetails, setSelectedCompletedBatchDetails] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('tracking'); // 'tracking' | 'analysis'

  // Helper to check if a batch is completed
  const isBatchCompleted = useCallback((batch) => {
    if (!batch) return false;
    if (batch.status === 'Terminé') return true;
    if (batch.subLots && batch.subLots.length > 0) {
      return batch.subLots.every(s => s.status === 'Terminé');
    }
    return false;
  }, []);

  // Filter 1: Commandes actives pour la gestion et le suivi de fabrication
  const activeOrders = useMemo(() => {
    return (data?.orders || []).filter(o => {
      // Exclure uniquement les commandes complètement archivées ou déjà livrées au client
      if (o.status === 'Archivé' || o.status === 'Livré') return false;
      return (o.items && o.items.length > 0) || (o.batches && o.batches.length > 0);
    });
  }, [data?.orders]);

  // Set default selected order if none or if current becomes invalid
  useEffect(() => {
    if (activeOrders.length > 0) {
      if (!selectedOrderId || !activeOrders.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(activeOrders[0].id);
      }
    } else {
      setSelectedOrderId('');
    }
  }, [activeOrders, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    return (data?.orders || []).find(o => o.id === selectedOrderId) || null;
  }, [data?.orders, selectedOrderId]);

  const client = useMemo(() => {
    if (!selectedOrder) return null;
    return (data?.clients || []).find(c => c.id === selectedOrder.clientId) || null;
  }, [data?.clients, selectedOrder]);

  const clientPlans = client?.sitePlans || [];
  const activeSitePlan = useMemo(() => {
    if (!selectedOrder) return null;
    return clientPlans.find(p => p.id === selectedOrder.sitePlanId || p.quoteId === selectedOrder.quoteId) || null;
  }, [clientPlans, selectedOrder]);

  // Tous les lots de fabrication de la commande sélectionnée
  const orderBatches = useMemo(() => {
    return selectedOrder?.batches || [];
  }, [selectedOrder]);

  // Lots non finis (pour filtres ou indicateurs)
  const activeBatches = useMemo(() => {
    return orderBatches.filter(b => !isBatchCompleted(b));
  }, [orderBatches, isBatchCompleted]);

  // LOTS TERMINÉS DE CETTE COMMANDE (pour le popup)
  const completedBatchesForOrder = useMemo(() => {
    return orderBatches.filter(b => isBatchCompleted(b));
  }, [orderBatches, isBatchCompleted]);

  // LOTS TERMINÉS GLOBAUX (toutes commandes)
  const allCompletedBatches = useMemo(() => {
    const list = [];
    (data?.orders || []).forEach(o => {
      const cl = (data?.clients || []).find(c => c.id === o.clientId);
      (o.batches || []).forEach(b => {
        if (isBatchCompleted(b)) {
          list.push({ order: o, batch: b, client: cl });
        }
      });
    });
    return list;
  }, [data?.orders, data?.clients, isBatchCompleted]);

  // Set default batch from orderBatches (maintenir le lot sélectionné même quand il passe à Terminé !)
  useEffect(() => {
    if (orderBatches.length > 0) {
      if (selectedBatchId && orderBatches.some(b => b.id === selectedBatchId)) {
        return; // Le lot sélectionné est toujours valide dans cette commande, ne pas le désélectionner !
      }
      // Sinon sélectionner le premier lot non fini, ou le premier lot
      const firstActive = orderBatches.find(b => !isBatchCompleted(b));
      setSelectedBatchId(firstActive ? firstActive.id : orderBatches[0].id);
    } else {
      setSelectedBatchId('');
    }
  }, [orderBatches, selectedBatchId, isBatchCompleted]);

  const selectedBatch = useMemo(() => {
    if (!selectedOrder) return null;
    return (selectedOrder.batches || []).find(b => b.id === selectedBatchId) || null;
  }, [selectedOrder, selectedBatchId]);

  // Current sub-lots
  const currentSubLots = useMemo(() => {
    if (selectedBatch && selectedBatch.subLots) {
      return selectedBatch.subLots;
    }
    if (selectedOrder && selectedOrder.subLots) {
      return selectedOrder.subLots;
    }
    return [];
  }, [selectedBatch, selectedOrder]);

  // Is sub-lot division approved & frozen?
  const isSubLotsFrozen = useMemo(() => {
    if (selectedBatch) {
      return !!selectedBatch.subLotsApproved;
    }
    if (selectedOrder) {
      return !!selectedOrder.subLotsApproved;
    }
    return false;
  }, [selectedBatch, selectedOrder]);

  // Total articles in batch (number of items or measurements)
  const getBatchArticleCount = useCallback((b) => {
    if (!b) return 0;
    if (Array.isArray(b.items) && b.items.length > 0) {
      return b.items.reduce((sum, it) => {
        if (it.measurements && it.measurements.length > 0) {
          return sum + it.measurements.length;
        }
        return sum + (it.qty || it.quantity || 1);
      }, 0);
    }
    if (Array.isArray(b.subLots) && b.subLots.length > 0) {
      return b.subLots.reduce((sum, sl) => sum + (sl.items?.length || 0), 0);
    }
    return 0;
  }, []);

  // Déstockage barres & matières pour le lot ou la commande sélectionnée
  const isDestocked = useMemo(() => {
    if (selectedBatch) {
      return !!selectedBatch.destocked;
    }
    if (selectedOrder) {
      return !!selectedOrder.destocked;
    }
    return false;
  }, [selectedBatch, selectedOrder]);

  // Handler to toggle destocked status
  const handleToggleDestock = () => {
    if (!selectedOrder) return;
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            const newStatus = !b.destocked;
            return {
              ...b,
              destocked: newStatus,
              destockedAt: newStatus ? new Date().toISOString() : null
            };
          });
        }

        let newOrderDestocked = o.destocked;
        if (!selectedBatch) {
          newOrderDestocked = !o.destocked;
        }

        return {
          ...o,
          destocked: newOrderDestocked,
          destockedAt: newOrderDestocked ? new Date().toISOString() : null,
          batches: newBatches,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });
  };

  // Helper to collect all openings from either the selected batch or the site plan
  const collectBatchOpenings = useCallback(() => {
    if (!selectedOrder) return [];

    const openings = [];

    if (activeSitePlan) {
      (activeSitePlan.floors || []).forEach(f => {
        (f.apartments || []).forEach(a => {
          (a.voids || []).forEach((v, vIndex) => {
            const item = selectedOrder.items.find(i => i.id === v.itemId);
            if (!item) return;

            if (selectedBatch) {
              const batchItem = (selectedBatch.items || []).find(bi => bi.id === v.itemId);
              const isIncludedInBatch = batchItem && (batchItem.measurements || []).some(m => m.id === v.id || m.label?.includes(v.name));
              if (!isIncludedInBatch && v.productionLaunched !== true) {
                return;
              }
            }

            const repere = v.name?.trim() || `${f.name}${a.name}${vIndex + 1}`;
            const family = classifyOpeningFamily(item, data);
            const realL = v.L !== undefined && v.L !== '' ? parseFloat(v.L) : item.config.L;
            const realH = v.H !== undefined && v.H !== '' ? parseFloat(v.H) : item.config.H;

            openings.push({
              voidId: v.id,
              itemId: item.id,
              repere: repere,
              label: item.label,
              item: item,
              family: family,
              L: realL,
              H: realH,
              floorName: f.name,
              aptName: a.name,
              shutter: v.shutter
            });
          });
        });
      });
    }

    if (openings.length === 0 && selectedBatch) {
      (selectedBatch.items || []).forEach(bi => {
        const item = selectedOrder.items.find(i => i.id === bi.id) || bi;
        const family = classifyOpeningFamily(item, data);
        (bi.measurements || []).forEach((m, mIdx) => {
          openings.push({
            voidId: m.id || `M-${mIdx}`,
            itemId: item.id,
            repere: m.label || `Ouverture ${mIdx + 1}`,
            label: item.label,
            item: item,
            family: family,
            L: m.L || item.config?.L || 1200,
            H: m.H || item.config?.H || 1200,
            floorName: m.floorName || '',
            aptName: m.aptName || '',
            shutter: null
          });
        });
      });
    }

    return openings;
  }, [selectedOrder, selectedBatch, activeSitePlan, data]);

  // Update a sub-lot field
  const handleUpdateSubLot = (subLotId, field, value) => {
    if (!selectedOrder) return;
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            const updated = (b.subLots || []).map(s => s.id === subLotId ? { ...s, [field]: value } : s);
            return { ...b, subLots: updated };
          });
        }

        let newOrderSubLots = o.subLots || [];
        if (!selectedBatch && o.subLots) {
          newOrderSubLots = newOrderSubLots.map(s => s.id === subLotId ? { ...s, [field]: value } : s);
        }

        return {
          ...o,
          batches: newBatches,
          subLots: newOrderSubLots,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });
  };

  // Lancer la fabrication d'un sous-lot (Statut : En cours)
  const handleStartSubLot = (subLotId) => {
    if (!selectedOrder) return;
    if (!isSubLotsFrozen) {
      alert("⚠️ Approbation requise :\n\nLe découpage de ce lot doit d'abord être approuvé et figé avant de pouvoir lancer la fabrication.\n\nVeuillez cliquer sur le bouton vert « Approuver & Figer la Découpe ».");
      return;
    }
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            const updated = (b.subLots || []).map(s => {
              if (s.id !== subLotId) return s;
              return {
                ...s,
                status: 'En cours',
                startedAt: s.startedAt || new Date().toISOString()
              };
            });
            return { ...b, subLots: updated };
          });
        }

        let newOrderSubLots = o.subLots || [];
        if (!selectedBatch && o.subLots) {
          newOrderSubLots = newOrderSubLots.map(s => {
            if (s.id !== subLotId) return s;
            return {
              ...s,
              status: 'En cours',
              startedAt: s.startedAt || new Date().toISOString()
            };
          });
        }

        return {
          ...o,
          batches: newBatches,
          subLots: newOrderSubLots,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });
  };

  // Marquer un sous-lot comme terminé
  const handleFinishSubLot = (subLotId) => {
    if (!selectedOrder) return;
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            const updated = (b.subLots || []).map(s => {
              if (s.id !== subLotId) return s;
              const allChecked = {};
              (s.cadres || []).forEach(c => { allChecked[c.id] = true; });
              (s.panneaux || []).forEach(p => { allChecked[p.id] = true; });
              (s.ouvertures || []).forEach(ouv => { allChecked[ouv.id] = true; });
              return {
                ...s,
                status: 'Terminé',
                checklist: { ...(s.checklist || {}), ...allChecked },
                completedAt: s.completedAt || new Date().toISOString()
              };
            });
            const allSubLotsDone = updated.length > 0 && updated.every(s => s.status === 'Terminé');
            return { 
              ...b, 
              subLots: updated,
              subLotsApproved: true,
              status: allSubLotsDone ? 'Terminé' : (b.status === 'Non commencé' ? 'En cours' : b.status)
            };
          });
        }

        let newOrderSubLots = o.subLots || [];
        if (!selectedBatch && o.subLots) {
          newOrderSubLots = newOrderSubLots.map(s => {
            if (s.id !== subLotId) return s;
            const allChecked = {};
            (s.cadres || []).forEach(c => { allChecked[c.id] = true; });
            (s.panneaux || []).forEach(p => { allChecked[p.id] = true; });
            (s.ouvertures || []).forEach(ouv => { allChecked[ouv.id] = true; });
            return {
              ...s,
              status: 'Terminé',
              checklist: { ...(s.checklist || {}), ...allChecked },
              completedAt: s.completedAt || new Date().toISOString()
            };
          });
        }

        return {
          ...o,
          batches: newBatches,
          subLots: newOrderSubLots,
          subLotsApproved: true,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });
  };

  // Réinitialiser un sous-lot (Statut : En attente)
  const handleResetSubLot = (subLotId) => {
    if (!selectedOrder) return;
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            const updated = (b.subLots || []).map(s => {
              if (s.id !== subLotId) return s;
              return {
                ...s,
                status: 'En attente',
                startedAt: null,
                completedAt: null
              };
            });
            return { ...b, subLots: updated };
          });
        }

        let newOrderSubLots = o.subLots || [];
        if (!selectedBatch && o.subLots) {
          newOrderSubLots = newOrderSubLots.map(s => {
            if (s.id !== subLotId) return s;
            return {
              ...s,
              status: 'En attente',
              startedAt: null,
              completedAt: null
            };
          });
        }

        return {
          ...o,
          batches: newBatches,
          subLots: newOrderSubLots,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });
  };

  // Lancer tous les sous-lots du lot/de la commande
  const handleStartAllSubLots = () => {
    if (!selectedOrder) return;
    if (!isSubLotsFrozen) {
      alert("⚠️ Approbation requise :\n\nLe découpage de ce lot doit d'abord être approuvé et figé avant de pouvoir lancer la fabrication.\n\nVeuillez cliquer sur le bouton vert « Approuver & Figer la Découpe ».");
      return;
    }
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            const updated = (b.subLots || []).map(s => {
              if (s.status === 'Terminé') return s;
              return {
                ...s,
                status: 'En cours',
                startedAt: s.startedAt || new Date().toISOString()
              };
            });
            return { ...b, subLots: updated };
          });
        }

        let newOrderSubLots = o.subLots || [];
        if (!selectedBatch && o.subLots) {
          newOrderSubLots = newOrderSubLots.map(s => {
            if (s.status === 'Terminé') return s;
            return {
              ...s,
              status: 'En cours',
              startedAt: s.startedAt || new Date().toISOString()
            };
          });
        }

        return {
          ...o,
          batches: newBatches,
          subLots: newOrderSubLots,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });
  };

  // Automatic sub-lot division
  const handleAutoDivideSubLots = () => {
    if (isSubLotsFrozen) {
      alert("Ce découpage est validé et figé. Il ne peut plus être modifié.");
      return;
    }
    if (!selectedOrder) return;

    // Règle bloquante : Déstockage des barres obligatoire avant de créer les sous-lots
    if (!isDestocked) {
      alert("⛔ Action impossible :\n\nLe déstockage des barres et profilés pour ce lot n'a pas encore été validé.\n\nVeuillez d'abord cliquer sur « Déstockage fait (barres etc.) » avant de pouvoir découper les sous-lots.");
      return;
    }

    const allOpenings = collectBatchOpenings();

    if (allOpenings.length === 0) {
      alert("Aucune ouverture trouvée pour ce lot ou cette commande. Veuillez d'abord valider les cotes et lancer le lot de fabrication.");
      return;
    }

    const size = Math.max(1, parseInt(groupSize) || 3);

    // Group openings by family according to user rules:
    const groups = {
      coulissant: allOpenings.filter(o => o.family === 'coulissant'),
      ouvrant: allOpenings.filter(o => o.family === 'ouvrant'),
      fixe: allOpenings.filter(o => o.family === 'fixe')
    };

    const newSubLots = [];
    let subLotCounter = 1;

    const chunkArray = (arr, chunkSize) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += chunkSize) {
        chunks.push(arr.slice(i, i + chunkSize));
      }
      return chunks;
    };

    // Coulissant
    const coulissantChunks = chunkArray(groups.coulissant, size);
    coulissantChunks.forEach(chunk => {
      const cadres = [];
      const panneaux = [];

      chunk.forEach(op => {
        const panelCount = getSlidingPanelsCount(op.item, data);
        cadres.push({
          id: `cadre_${op.voidId}`,
          repere: op.repere,
          label: `Cadre Dormant ${op.label}`,
          dim: `${op.L} x ${op.H} mm`,
          location: `${op.floorName} - ${op.aptName}`
        });

        for (let p = 1; p <= panelCount; p++) {
          panneaux.push({
            id: `panneau_${op.voidId}_${p}`,
            repere: op.repere,
            label: `${op.label}`,
            panelName: panelCount === 2 ? (p === 1 ? 'Vantail Gauche (V1)' : 'Vantail Droit (V2)') : `Vantail ${p}`,
            dim: `${Math.round(op.L / panelCount)} x ${op.H} mm approx.`
          });
        }
      });

      newSubLots.push({
        id: `SL-${Date.now()}-${subLotCounter}`,
        code: `SL-${String(subLotCounter).padStart(2, '0')}`,
        name: `Sous-Lot SL-${String(subLotCounter).padStart(2, '0')} (Coulissant - ${chunk.length} ouv.)`,
        family: 'coulissant',
        items: chunk,
        cadres: cadres,
        panneaux: panneaux,
        ouvertures: [],
        remarks: '',
        status: 'En attente',
        checklist: {},
        startedAt: null,
        completedAt: null
      });
      subLotCounter++;
    });

    // Ouvrant
    const ouvrantChunks = chunkArray(groups.ouvrant, size);
    ouvrantChunks.forEach(chunk => {
      const ouvertures = chunk.map(op => ({
        id: `ouv_${op.voidId}`,
        repere: op.repere,
        label: op.label,
        dim: `${op.L} x ${op.H} mm`,
        location: `${op.floorName} - ${op.aptName}`
      }));

      newSubLots.push({
        id: `SL-${Date.now()}-${subLotCounter}`,
        code: `SL-${String(subLotCounter).padStart(2, '0')}`,
        name: `Sous-Lot SL-${String(subLotCounter).padStart(2, '0')} (Ouvrant - ${chunk.length} ouv.)`,
        family: 'ouvrant',
        items: chunk,
        cadres: [],
        panneaux: [],
        ouvertures: ouvertures,
        remarks: '',
        status: 'En attente',
        checklist: {},
        startedAt: null,
        completedAt: null
      });
      subLotCounter++;
    });

    // Fixe
    const fixeChunks = chunkArray(groups.fixe, size);
    fixeChunks.forEach(chunk => {
      const ouvertures = chunk.map(op => ({
        id: `fixe_${op.voidId}`,
        repere: op.repere,
        label: op.label,
        dim: `${op.L} x ${op.H} mm`,
        location: `${op.floorName} - ${op.aptName}`
      }));

      newSubLots.push({
        id: `SL-${Date.now()}-${subLotCounter}`,
        code: `SL-${String(subLotCounter).padStart(2, '0')}`,
        name: `Sous-Lot SL-${String(subLotCounter).padStart(2, '0')} (Fixe - ${chunk.length} ouv.)`,
        family: 'fixe',
        items: chunk,
        cadres: [],
        panneaux: [],
        ouvertures: ouvertures,
        remarks: '',
        status: 'En attente',
        checklist: {},
        startedAt: null,
        completedAt: null
      });
      subLotCounter++;
    });

    // Persist new sub-lots in DB (not yet frozen)
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            return { ...b, subLots: newSubLots, subLotsApproved: false };
          });
        }

        return {
          ...o,
          batches: newBatches,
          subLots: !selectedBatch ? newSubLots : o.subLots,
          subLotsApproved: !selectedBatch ? false : o.subLotsApproved,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });
  };

  // Approve and freeze sub-lot division
  const handleApproveAndFreezeSubLots = () => {
    if (!selectedOrder || currentSubLots.length === 0) return;

    const confirmMsg = `🔒 CONFIRMATION DU FIGEAGE DE LA DÉCOUPE :\n\n` +
      `Voulez-vous approuver et figer définitivement le découpage de ce lot en ${currentSubLots.length} sous-lot(s) ?\n\n` +
      `⚠️ ATTENTION : Une fois approuvé, ce découpage sera DÉFINITIVEMENT FIGÉ et verrouillé en fabrication.\n` +
      `Il ne pourra plus être redécoupé ni modifié.\n\n` +
      `Confirmez-vous ?`;

    if (!window.confirm(confirmMsg)) return;

    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== selectedOrder.id) return o;
        
        let newBatches = o.batches || [];
        if (selectedBatch) {
          newBatches = newBatches.map(b => {
            if (b.id !== selectedBatch.id) return b;
            return { ...b, subLotsApproved: true };
          });
        }

        return {
          ...o,
          batches: newBatches,
          subLotsApproved: !selectedBatch ? true : o.subLotsApproved,
          _lastModified: new Date().toISOString()
        };
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });

    alert("✅ Découpage approuvé et figé avec succès ! Les fiches de sous-lots peuvent être imprimées et lancées.");
  };

  // Helper to generate URLs for the 3 QR codes
  const getSubLotUrls = (subLot) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const batchParam = selectedBatch ? `&batchId=${selectedBatch.id}` : '';
    
    // 1. Lancement
    const startUrl = `${origin}${pathname}?mode=tracking&action=start&orderId=${selectedOrder?.id}${batchParam}&sublotId=${subLot.id}`;
    // 2. Fin & Validation
    const finishUrl = `${origin}${pathname}?mode=tracking&action=finish&orderId=${selectedOrder?.id}${batchParam}&sublotId=${subLot.id}`;
    // 3. Accès interface mobile globale
    const portalUrl = `${origin}${pathname}?mode=tracking&orderId=${selectedOrder?.id}${batchParam}&sublotId=${subLot.id}`;

    return { startUrl, finishUrl, portalUrl };
  };

  // Export PDF "Fiche de Sous-Lot" A4 with 3 QR codes & typology stats
  const generateSubLotPDF = (subLot) => {
    if (!selectedOrder || !subLot) return;

    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header Branding
    if (quoteSettings?.logoBase64) {
      try {
        const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
        const maxW = 45;
        const maxH = 18;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
      } catch (e) {}
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59);
    doc.text('FICHE DE FABRICATION — SOUS-LOT', 68, y + 6);

    doc.setFontSize(10.5);
    doc.setTextColor(59, 130, 246);
    doc.text(subLot.name, 68, y + 13);

    y += 24;

    // Header Info Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, pw - 30, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`COMMANDE : ${selectedOrder.id}`, 20, y + 6);
    doc.text(`CLIENT : ${client?.nom || 'Client'}`, 20, y + 12);
    doc.text(`LOT ATELIER : ${selectedBatch?.name || 'Lot Principal'}`, 20, y + 17);

    doc.text(`FAMILLE : ${subLot.family.toUpperCase()}`, 115, y + 6);
    doc.text(`NOMBRE TOTAL : ${subLot.items?.length || 0} ouverture(s)`, 115, y + 12);
    doc.text(`DATE ÉDITION : ${new Date().toLocaleDateString('fr-FR')}`, 115, y + 17);

    y += 26;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, pw - 30, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    doc.text('REPÈRE & COTES RÉELLES', 18, y + 5);
    doc.text('LIBELLÉ DU PRODUIT', 85, y + 5);
    doc.text('VOLET', 145, y + 5);
    doc.text('LOCALISATION', 170, y + 5);

    y += 7.5;

    // Table Rows (Repères format: 1a1 : 1250 x 380 mm)
    doc.setFont('helvetica', 'normal');
    (subLot.items || []).forEach((item, idx) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(3, 105, 161);
      
      // User format: "1a1 : 1250 x 380 mm"
      const repereText = `${(item.repere || `Ouv.${idx + 1}`).toLowerCase()} : ${item.L} x ${item.H} mm`;
      doc.text(repereText, 18, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(doc.splitTextToSize(item.label, 55), 85, y + 5);

      const hasShutter = !!(item.item?.config?.hasShutter || (item.shutter && item.shutter.qty > 0));
      doc.setFont('helvetica', hasShutter ? 'bold' : 'normal');
      doc.setTextColor(hasShutter ? 180 : 100, hasShutter ? 83 : 116, hasShutter ? 9 : 139);
      doc.text(hasShutter ? 'Avec Volet' : 'Sans', 145, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${item.floorName || ''} ${item.aptName ? `- ${item.aptName}` : ''}`, 170, y + 5);

      y += 7.5;
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y, pw - 15, y);
    });

    y += 6;

    // Typology Stats Summary Box (en bas)
    const stats = getSubLotTypologyStats(subLot.items);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(15, y, pw - 30, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("RÉCAPITULATIF SOUS-LOT :", 20, y + 6);

    doc.setFont('helvetica', 'normal');
    let statText = `• Coulissant seul : ${stats.coulissantSeul}   |   • Ouvrant seul : ${stats.ouvrantSeul}`;
    if (stats.assemble > 0) {
      statText += `   |   • Assemblé (composé) : ${stats.assemble}`;
    }
    if (stats.avecVolet > 0) {
      statText += `   |   • Avec Volet : ${stats.avecVolet}`;
    }
    doc.text(statText, 20, y + 11);

    y += 18;

    // Remarks Section (si existantes)
    if (subLot.remarks && subLot.remarks.trim()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(180, 83, 9);
      doc.text("REMARQUES & INSTRUCTIONS D'ATELIER :", 15, y);
      y += 3.5;
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      const splitRemarks = doc.splitTextToSize(subLot.remarks, pw - 40);
      const boxH = Math.max(12, splitRemarks.length * 4.5 + 4);
      doc.roundedRect(15, y, pw - 30, boxH, 2, 2, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      doc.text(splitRemarks, 20, y + 5);
      y += boxH + 6;
    } else {
      y += 2;
    }

    // THE 3 QR CODES SECTION
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text("QR CODES DE SUIVI ATELIER (À SCANNER SUR SMARTPHONE OU TABLETTE) :", 15, y);
    y += 5;

    const qrBoxW = (pw - 40) / 3;
    const qrBoxH = 50;

    // Helper to get Canvas Data URL
    const getQRImg = (id) => {
      const el = document.getElementById(id);
      if (el && el.toDataURL) {
        return el.toDataURL('image/png');
      }
      return null;
    };

    const startImg = getQRImg(`qr-start-${subLot.id}`);
    const finishImg = getQRImg(`qr-finish-${subLot.id}`);
    const portalImg = getQRImg(`qr-portal-${subLot.id}`);

    // QR 1: LANCEMENT
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(15, y, qrBoxW, qrBoxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(29, 78, 216);
    doc.text("1. LANCEMENT", 15 + qrBoxW / 2, y + 6, { align: 'center' });
    if (startImg) {
      doc.addImage(startImg, 'PNG', 15 + (qrBoxW - 28) / 2, y + 8, 28, 28);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Démarre la fabrication", 15 + qrBoxW / 2, y + 42, { align: 'center' });

    // QR 2: FIN & VALIDATION
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(15 + qrBoxW + 5, y, qrBoxW, qrBoxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text("2. FIN & VALIDATION", 15 + qrBoxW + 5 + qrBoxW / 2, y + 6, { align: 'center' });
    if (finishImg) {
      doc.addImage(finishImg, 'PNG', 15 + qrBoxW + 5 + (qrBoxW - 28) / 2, y + 8, 28, 28);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Pointeuse Cadres/Panneaux", 15 + qrBoxW + 5 + qrBoxW / 2, y + 42, { align: 'center' });

    // QR 3: PORTAIL MOBILE
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(15 + (qrBoxW + 5) * 2, y, qrBoxW, qrBoxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text("3. PORTAIL MOBILE", 15 + (qrBoxW + 5) * 2 + qrBoxW / 2, y + 6, { align: 'center' });
    if (portalImg) {
      doc.addImage(portalImg, 'PNG', 15 + (qrBoxW + 5) * 2 + (qrBoxW - 28) / 2, y + 8, 28, 28);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Vue mobile globale", 15 + (qrBoxW + 5) * 2 + qrBoxW / 2, y + 42, { align: 'center' });

    y += qrBoxH + 8;

    // Signatures
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text("Visa Chef d'Atelier :", 15, y);
    doc.text("Visa Contrôle & Approbation Fin :", pw - 85, y);

    doc.save(`Fiche_SousLot_${subLot.code || subLot.id}_${selectedOrder.id}.pdf`);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Hidden Offscreen QR Canvases for jsPDF rendering */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0 }}>
        {currentSubLots.map(sl => {
          const { startUrl, finishUrl, portalUrl } = getSubLotUrls(sl);
          return (
            <div key={sl.id}>
              <QRCodeCanvas id={`qr-start-${sl.id}`} value={startUrl} size={150} level="M" />
              <QRCodeCanvas id={`qr-finish-${sl.id}`} value={finishUrl} size={150} level="M" />
              <QRCodeCanvas id={`qr-portal-${sl.id}`} value={portalUrl} size={150} level="M" />
            </div>
          );
        })}
      </div>

      {/* Module Title & Top Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckSquare size={28} color="#3b82f6" />
            Gestion & Suivi de Fabrication (Sous-Lots & QR Codes)
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
            Commandes et lots en cours uniquement. Découpage verrouillé et validé, fiches A4 avec 3 QR Codes.
          </p>
        </div>

        {/* Button to open Completed Batches Modal */}
        <button
          onClick={() => setShowCompletedBatchesModal(true)}
          className="btn btn-secondary"
          style={{ 
            fontSize: '0.85rem', 
            padding: '0.6rem 1rem', 
            background: '#ecfdf5', 
            color: '#065f46', 
            borderColor: '#a7f3d0', 
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer'
          }}
        >
          <Archive size={17} />
          📜 Voir les Lots Terminés ({completedBatchesForOrder.length})
        </button>
      </div>

      {/* Sub-Tabs: Suivi Fabrication vs Analyse */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.6rem' }}>
        <button
          onClick={() => setActiveSubTab('tracking')}
          style={{
            border: 'none',
            background: activeSubTab === 'tracking' ? '#0284c7' : '#f1f5f9',
            color: activeSubTab === 'tracking' ? 'white' : '#64748b',
            fontWeight: 800,
            fontSize: '0.9rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: activeSubTab === 'tracking' ? '0 4px 10px rgba(2, 132, 199, 0.25)' : 'none'
          }}
        >
          <Layers size={18} /> 1. Suivi & Sous-Lots
        </button>

        <button
          onClick={() => setActiveSubTab('analysis')}
          style={{
            border: 'none',
            background: activeSubTab === 'analysis' ? '#0284c7' : '#f1f5f9',
            color: activeSubTab === 'analysis' ? 'white' : '#64748b',
            fontWeight: 800,
            fontSize: '0.9rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: activeSubTab === 'analysis' ? '0 4px 10px rgba(2, 132, 199, 0.25)' : 'none'
          }}
        >
          <BarChart2 size={18} /> 2. Analyse & Performance
        </button>
      </div>

      {activeSubTab === 'analysis' ? (
        <WorkshopAnalysisTab data={data} quoteSettings={quoteSettings} />
      ) : (
        <>
          {/* Selectors Bar */}
          <div className="glass shadow-sm" style={{ padding: '1.25rem', borderRadius: '1rem', background: 'white', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', alignItems: 'flex-end' }}>
              
              {/* 1. Order Selector */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  1. Commande en cours
                </label>
                <select
                  className="input"
                  value={selectedOrderId}
                  onChange={e => {
                    setSelectedOrderId(e.target.value);
                    setSelectedBatchId('');
                  }}
                  style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
                >
                  <option value="">{activeOrders.length === 0 ? '-- Aucune commande active --' : '-- Sélectionnez une commande --'}</option>
                  {activeOrders.map(o => {
                    const c = (data?.clients || []).find(cl => cl.id === o.clientId);
                    const isAllDone = (o.batches && o.batches.length > 0 && o.batches.every(b => isBatchCompleted(b))) || o.status === 'Terminé';
                    return (
                      <option key={o.id} value={o.id}>
                        {isAllDone ? '✅ [Terminé] ' : ''}Commande {o.id} — {c?.nom || 'Client'} ({o.batches?.length || 0} lot(s)) {isAllDone ? '✓ 100%' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 2. Batch Selector (Avec Nombre d'Articles) */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  2. Lot de Fabrication
                </label>
                <select
                  className="input"
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  disabled={!selectedOrderId || orderBatches.length === 0}
                  style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
                >
                  <option value="">
                    {orderBatches.length === 0 
                      ? '-- Aucun lot de fabrication créé --' 
                      : '-- Sélectionnez un lot de fabrication --'}
                  </option>
                  {orderBatches.map(b => {
                    const count = getBatchArticleCount(b);
                    const isDone = isBatchCompleted(b);
                    return (
                      <option key={b.id} value={b.id}>
                        {isDone ? '✅ [Terminé] ' : ''}{b.name || b.id} — {count} article{count > 1 ? 's' : ''} ({b.subLots?.length || 0} SL) {isDone ? '✓ 100%' : b.subLotsApproved ? '🔒 Figé' : ''} {b.destocked ? '📦 Déstocké' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Déstockage Barres & Matières (BLOCAGE OBLIGATOIRE) */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  3. Déstockage Barres (Matières)
                </label>
                <button
                  onClick={handleToggleDestock}
                  disabled={!selectedOrderId || !selectedBatchId || isSubLotsFrozen}
                  className="btn"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.83rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s ease',
                    background: isDestocked ? '#dcfce7' : '#fef3c7',
                    border: isDestocked ? '1.5px solid #86efac' : '1.5px solid #f59e0b',
                    color: isDestocked ? '#166534' : '#b45309',
                    cursor: (!selectedOrderId || !selectedBatchId || isSubLotsFrozen) ? 'not-allowed' : 'pointer',
                    boxShadow: isDestocked ? '0 2px 6px rgba(22, 101, 52, 0.12)' : '0 2px 6px rgba(180, 83, 9, 0.12)'
                  }}
                  title={isDestocked ? "Déstockage validé. Cliquez pour annuler." : "Cliquer pour valider que les barres ont été déstockées"}
                >
                  {isDestocked ? (
                    <>
                      <CheckCircle size={16} color="#16a34a" /> Déstockage Fait (Barres etc.)
                    </>
                  ) : (
                    <>
                      <Package size={16} color="#b45309" /> Valider Déstockage (Barres)
                    </>
                  )}
                </button>
              </div>

              {/* 4. Sizing & Auto-divide (Bloqué si déstockage non fait) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    4. Découpage
                  </label>
                  {!isDestocked && !isSubLotsFrozen && (
                    <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700 }}>
                      ⚠️ Déstockage requis
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '0 0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginRight: '0.4rem' }}>Par</span>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={groupSize}
                      onChange={e => setGroupSize(e.target.value)}
                      disabled={isSubLotsFrozen || !isDestocked}
                      style={{ width: '40px', border: 'none', background: 'transparent', fontWeight: 800, fontSize: '0.9rem', textAlign: 'center' }}
                    />
                  </div>

                  {!isSubLotsFrozen ? (
                    <button
                      onClick={handleAutoDivideSubLots}
                      disabled={!selectedOrderId || !isDestocked}
                      className="btn btn-primary"
                      style={{ 
                        flex: 1, 
                        background: isDestocked ? '#3b82f6' : '#94a3b8', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.4rem', 
                        fontWeight: 700, 
                        fontSize: '0.82rem',
                        cursor: isDestocked ? 'pointer' : 'not-allowed'
                      }}
                      title={!isDestocked ? "Veuillez d'abord valider le déstockage des barres" : "Découper en sous-lots"}
                    >
                      <Sliders size={15} /> Découper
                    </button>
                  ) : (
                    <div style={{ flex: 1, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#166534', fontWeight: 800, fontSize: '0.82rem' }}>
                      <Lock size={14} /> Découpe Figée
                    </div>
                  )}
                </div>
              </div>

            </div>

        {/* Freezing / Approval Banner if sub-lots exist */}
        {currentSubLots.length > 0 && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.85rem 1.25rem', 
            borderRadius: '0.65rem', 
            border: isSubLotsFrozen ? '1.5px solid #86efac' : '1.5px solid #fde68a', 
            background: isSubLotsFrozen ? '#f0fdf4' : '#fffbeb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                {isBatchCompleted(selectedBatch) ? <CheckCircle size={16} color="#16a34a" /> : isSubLotsFrozen ? <Lock size={16} color="#16a34a" /> : <Sliders size={16} color="#d97706" />}
                <strong style={{ fontSize: '0.9rem', color: (isBatchCompleted(selectedBatch) || isSubLotsFrozen) ? '#166534' : '#92400e' }}>
                  {isBatchCompleted(selectedBatch) 
                    ? '🎉 Lot 100% Terminé & Validé Atelier (Visible dans l\'onglet Stock Fini)' 
                    : isSubLotsFrozen 
                    ? 'Découpage Approuvé et Figé (Règle stricte respectée)' 
                    : 'Découpage Provisoire — En attente d\'approbation'}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: (isBatchCompleted(selectedBatch) || isSubLotsFrozen) ? '#15803d' : '#b45309' }}>
                {isBatchCompleted(selectedBatch)
                  ? 'Tous les sous-lots de ce lot ont été fabriqués et contrôlés. Les éléments sont disponibles dans l\'onglet « Stock Fini ».'
                  : isSubLotsFrozen 
                  ? 'La découpe de ce lot est définitivement verrouillée en production. Les sous-lots peuvent être imprimés et fabriqués.'
                  : 'Vérifiez la répartition ci-dessous, puis cliquez sur « Approuver & Figer » pour verrouiller définitivement la découpe.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {isSubLotsFrozen && currentSubLots.some(s => s.status === 'En attente') && (
                <button
                  onClick={handleStartAllSubLots}
                  className="btn btn-primary"
                  style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', padding: '0.55rem 1.1rem', boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)' }}
                  title="Lancer la fabrication de tous les sous-lots en attente"
                >
                  <Play size={15} /> Lancer tous les sous-lots
                </button>
              )}

              {!isSubLotsFrozen && (
                <button
                  onClick={handleApproveAndFreezeSubLots}
                  className="btn btn-primary"
                  style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', padding: '0.55rem 1.2rem', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)' }}
                >
                  <Lock size={15} /> Approuver & Figer la Découpe
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!selectedOrderId ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #cbd5e1' }}>
          <ShoppingBag size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Sélectionnez une Commande en cours</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
            Choisissez une commande active ci-dessus pour gérer ses lots de fabrication et générer les sous-lots.
          </p>
        </div>
      ) : currentSubLots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #3b82f6' }}>
          <Layers size={48} color="#3b82f6" style={{ marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Aucun Sous-Lot pour ce lot</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            Cliquez sur le bouton <strong>« Découper »</strong> ci-dessus pour diviser automatiquement vos ouvertures par groupe de {groupSize} (coulissant seul, ouvrant seul, fixe seul).
          </p>
          <button 
            onClick={handleAutoDivideSubLots}
            className="btn btn-primary"
            style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
          >
            <Sliders size={18} /> Découper maintenant
          </button>
        </div>
      ) : (
        /* Sub-Lots View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Sub-Lots List */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {currentSubLots.map((subLot, sIdx) => {
              const { startUrl, finishUrl, portalUrl } = getSubLotUrls(subLot);
              const isSliding = subLot.family === 'coulissant';

              // Count completion
              const checklist = subLot.checklist || {};
              const totalItems = isSliding 
                ? (subLot.cadres || []).length + (subLot.panneaux || []).length
                : (subLot.ouvertures || []).length;
              
              const checkedItems = isSliding
                ? (subLot.cadres || []).filter(c => !!checklist[c.id]).length + (subLot.panneaux || []).filter(p => !!checklist[p.id]).length
                : (subLot.ouvertures || []).filter(o => !!checklist[o.id]).length;
              
              const percent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
              const isDone = subLot.status === 'Terminé';

              // Typology stats for this sub-lot
              const stats = getSubLotTypologyStats(subLot.items);

              return (
                <div 
                  key={subLot.id} 
                  className="glass shadow-sm"
                  style={{ 
                    background: 'white', 
                    borderRadius: '1rem', 
                    border: isDone ? '2px solid #86efac' : subLot.status === 'En cours' ? '2px solid #93c5fd' : '1px solid #e2e8f0', 
                    overflow: 'hidden' 
                  }}
                >
                  {/* Card Header */}
                  <div style={{ 
                    padding: '1.25rem', 
                    background: isDone ? '#f0fdf4' : subLot.status === 'En cours' ? '#eff6ff' : '#f8fafc', 
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        background: isSliding ? '#0284c7' : subLot.family === 'fixe' ? '#d97706' : '#7c3aed', 
                        color: 'white', 
                        padding: '0.25rem 0.65rem', 
                        borderRadius: '6px' 
                      }}>
                        {isSliding ? 'COULISSANT' : subLot.family === 'fixe' ? 'FIXE SEUL' : 'OUVRANT'}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                        {subLot.name}
                      </h3>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 800, 
                        background: isDone ? '#dcfce7' : subLot.status === 'En cours' ? '#dbeafe' : '#f1f5f9', 
                        color: isDone ? '#166534' : subLot.status === 'En cours' ? '#1d4ed8' : '#64748b',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        border: '1px solid',
                        borderColor: isDone ? '#bbf7d0' : subLot.status === 'En cours' ? '#bfdbfe' : '#e2e8f0'
                      }}>
                        {subLot.status} ({percent}%)
                      </span>

                      {/* Alerte Dépassement > +50% */}
                      {(() => {
                        const benchmark = subLot.family === 'coulissant' ? 120 : subLot.family === 'ouvrant' ? 80 : 45;
                        let duration = 0;
                        if (subLot.startedAt && subLot.completedAt) {
                          duration = (new Date(subLot.completedAt).getTime() - new Date(subLot.startedAt).getTime()) / (1000 * 60);
                        } else if (subLot.startedAt && subLot.status === 'En cours') {
                          duration = (new Date().getTime() - new Date(subLot.startedAt).getTime()) / (1000 * 60);
                        }
                        if (duration > benchmark * 1.5) {
                          const overrunPct = Math.round(((duration - benchmark) / benchmark) * 100);
                          return (
                            <span 
                              style={{ 
                                fontSize: '0.72rem', 
                                fontWeight: 800, 
                                background: '#fef2f2', 
                                color: '#dc2626', 
                                padding: '0.2rem 0.55rem', 
                                borderRadius: '9999px',
                                border: '1px solid #fca5a5',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title={`Dépassement de temps de fabrication : ${Math.round(duration)} min constatées vs ${benchmark} min standard (+${overrunPct}%)`}
                            >
                              <AlertTriangle size={12} color="#dc2626" /> Dépassement (+{overrunPct}%)
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Header Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {subLot.status === 'En attente' && (
                        <button
                          onClick={() => handleStartSubLot(subLot.id)}
                          className="btn btn-primary"
                          style={{ 
                            fontSize: '0.8rem', 
                            padding: '0.45rem 0.85rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.4rem', 
                            background: isSubLotsFrozen ? '#0284c7' : '#94a3b8', 
                            color: 'white', 
                            fontWeight: 700,
                            cursor: isSubLotsFrozen ? 'pointer' : 'not-allowed'
                          }}
                          title={isSubLotsFrozen ? "Lancer la fabrication de ce sous-lot" : "Veuillez d'abord approuver et figer le découpage"}
                        >
                          <Play size={14} /> {isSubLotsFrozen ? 'Lancer la fabrication' : '🔒 Approbation requise'}
                        </button>
                      )}

                      {subLot.status === 'En cours' && (
                        <button
                          onClick={() => handleFinishSubLot(subLot.id)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: 'white', fontWeight: 700 }}
                          title="Marquer la fabrication de ce sous-lot comme terminée"
                        >
                          <CheckCircle size={14} /> Marquer Terminé
                        </button>
                      )}

                      {subLot.status === 'Terminé' && (
                        <button
                          onClick={() => handleResetSubLot(subLot.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '0.4rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'white', color: '#64748b' }}
                          title="Remettre ce sous-lot en attente"
                        >
                          <RefreshCw size={13} /> Relancer
                        </button>
                      )}

                      <button
                        onClick={() => generateSubLotPDF(subLot)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white' }}
                        title="Imprimer la Fiche A4 avec les 3 QR Codes"
                      >
                        <Printer size={15} /> Imprimer Fiche A4 (3 QR)
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 420px', gap: '1.5rem' }}>
                      
                      {/* Left: Products Detail Table in requested repere format (1a1 : 1250x380) */}
                      <div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#334155', margin: '0 0 0.75rem 0' }}>
                          📦 Liste des Produits en Repères ({subLot.items?.length || 0} ouvertures)
                        </h4>
                        
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Repère : Cotes Réelles</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Produit / Label</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Volet</th>
                                <th style={{ padding: '0.5rem 0.75rem' }}>Emplacement</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(subLot.items || []).map((it, iIdx) => {
                                const hasShutter = !!(it.item?.config?.hasShutter || (it.shutter && it.shutter.qty > 0));
                                return (
                                  <tr key={it.voidId || iIdx} style={{ borderBottom: iIdx < (subLot.items || []).length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 800 }}>
                                      <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                        {it.repere?.toLowerCase()} : {it.L} x {it.H} mm
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#1e293b' }}>
                                      {it.label}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                      {hasShutter ? (
                                        <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                                          Avec Volet
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Sans</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#64748b' }}>
                                      {it.floorName ? `${it.floorName} - ${it.aptName}` : '---'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Typology summary counters bar */}
                        <div style={{ marginTop: '0.85rem', padding: '0.65rem 0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                          <span>🚪 Coulissant seul : <strong>{stats.coulissantSeul}</strong></span>
                          <span>•</span>
                          <span>🪟 Ouvrant seul : <strong>{stats.ouvrantSeul}</strong></span>
                          {stats.assemble > 0 && (
                            <>
                              <span>•</span>
                              <span style={{ color: '#4f46e5' }}>🧩 Assemblé (composé) : <strong>{stats.assemble}</strong></span>
                            </>
                          )}
                          {stats.avecVolet > 0 && (
                            <>
                              <span>•</span>
                              <span style={{ color: '#b45309' }}>🛡️ Avec volet : <strong>{stats.avecVolet}</strong></span>
                            </>
                          )}
                        </div>

                        {/* Editable Remarks Box */}
                        <div style={{ marginTop: '1rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                            📝 Remarques & Instructions d'Atelier (En bas de la fiche A4) :
                          </label>
                          <textarea
                            className="input"
                            rows="2"
                            value={subLot.remarks || ''}
                            onChange={e => handleUpdateSubLot(subLot.id, 'remarks', e.target.value)}
                            placeholder="Remarques éventuelles pour ce sous-lot..."
                            style={{ width: '100%', fontSize: '0.82rem', padding: '0.5rem', resize: 'vertical' }}
                          />
                        </div>
                      </div>

                      {/* Right: The 3 QR Codes Cards */}
                      <div style={{ background: '#f8fafc', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <QrCode size={18} color="#3b82f6" />
                          Les 3 QR Codes du Sous-Lot
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                          
                          {/* QR 1: Lancement */}
                          <div style={{ background: 'white', padding: '0.6rem 0.4rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '0.3rem' }}>
                              🚀 LANCEMENT
                            </span>
                            <div style={{ padding: '0.3rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.3rem' }}>
                              <QRCodeSVG value={startUrl} size={75} level="M" />
                            </div>
                            <button
                              onClick={() => window.open(startUrl, '_blank')}
                              className="btn"
                              style={{ marginTop: '0.4rem', fontSize: '0.65rem', padding: '0.2rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', width: '100%' }}
                            >
                              Lancer
                            </button>
                          </div>

                          {/* QR 2: Fin & Contrôle */}
                          <div style={{ background: 'white', padding: '0.6rem 0.4rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#166534', marginBottom: '0.3rem' }}>
                              🏁 FIN & VALID.
                            </span>
                            <div style={{ padding: '0.3rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.3rem' }}>
                              <QRCodeSVG value={finishUrl} size={75} level="M" />
                            </div>
                            <button
                              onClick={() => window.open(finishUrl, '_blank')}
                              className="btn"
                              style={{ marginTop: '0.4rem', fontSize: '0.65rem', padding: '0.2rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', width: '100%' }}
                            >
                              Pointer
                            </button>
                          </div>

                          {/* QR 3: Portail Mobile */}
                          <div style={{ background: 'white', padding: '0.6rem 0.4rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#b45309', marginBottom: '0.3rem' }}>
                              📱 PORTAIL
                            </span>
                            <div style={{ padding: '0.3rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.3rem' }}>
                              <QRCodeSVG value={portalUrl} size={75} level="M" />
                            </div>
                            <button
                              onClick={() => window.open(portalUrl, '_blank')}
                              className="btn"
                              style={{ marginTop: '0.4rem', fontSize: '0.65rem', padding: '0.2rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', width: '100%' }}
                            >
                              Mobile
                            </button>
                          </div>

                        </div>

                        <button
                          onClick={() => generateSubLotPDF(subLot)}
                          className="btn btn-primary"
                          style={{ marginTop: 'auto', background: '#3b82f6', fontSize: '0.8rem', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 700 }}
                        >
                          <Printer size={15} /> Télécharger Fiche A4 (3 QR)
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
        </>
      )}

      {/* MODAL POPUP: LOTS TERMINÉS */}
      {showCompletedBatchesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Archive size={22} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
                  Historique des Lots de Fabrication Terminés
                </h3>
              </div>
              <button 
                onClick={() => setShowCompletedBatchesModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {allCompletedBatches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                  <Archive size={40} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Aucun lot n'a encore été marqué comme entièrement terminé.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {allCompletedBatches.map(({ order, batch, client: cl }, bIdx) => (
                    <div 
                      key={batch.id || bIdx}
                      style={{ 
                        border: '1px solid #a7f3d0', 
                        borderRadius: '0.75rem', 
                        padding: '1.25rem', 
                        background: '#f0fdf4' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#10b981', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              TERMINÉ
                            </span>
                            <strong style={{ fontSize: '1.05rem', color: '#065f46' }}>
                              {batch.name || batch.id}
                            </strong>
                            <span style={{ fontSize: '0.82rem', color: '#047857', fontWeight: 600 }}>
                              (Commande {order.id} — {cl?.nom || 'Client'})
                            </span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#059669', display: 'block', marginTop: '0.25rem' }}>
                            Lancé le : {new Date(batch.createdAt).toLocaleDateString('fr-FR')} {batch.completedAt ? `• Achevé le : ${new Date(batch.completedAt).toLocaleDateString('fr-FR')}` : ''}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 700 }}>
                          {batch.subLots?.length || 0} sous-lot(s) validés à 100%
                        </div>
                      </div>

                      {/* Sub-lots table in completed batch */}
                      <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #d1fae5', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ background: '#ecfdf5', color: '#065f46', textAlign: 'left', borderBottom: '1px solid #d1fae5' }}>
                              <th style={{ padding: '0.4rem 0.75rem' }}>Sous-Lot</th>
                              <th style={{ padding: '0.4rem 0.75rem' }}>Famille</th>
                              <th style={{ padding: '0.4rem 0.75rem' }}>Ouvertures</th>
                              <th style={{ padding: '0.4rem 0.75rem' }}>Statut</th>
                              <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(batch.subLots || []).map((sl, slIdx) => (
                              <tr key={sl.id || slIdx} style={{ borderBottom: slIdx < (batch.subLots || []).length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#1e293b' }}>{sl.name}</td>
                                <td style={{ padding: '0.5rem 0.75rem', textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 700, color: '#0284c7' }}>{sl.family}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  {(sl.items || []).map(i => i.repere).join(', ')}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                    Terminé
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                  <button
                                    onClick={() => generateSubLotPDF(sl)}
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', background: 'white' }}
                                  >
                                    <Printer size={13} /> Fiche A4
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCompletedBatchesModal(false)}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem', fontWeight: 700 }}
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
