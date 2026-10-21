import React, { useState, useMemo, useCallback } from 'react';
import { 
  PackageCheck, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Sparkles, 
  Filter, 
  RefreshCw,
  Box,
  Eye,
  Check,
  Building,
  AlertCircle,
  DollarSign,
  Calendar,
  RotateCcw,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { classifyOpeningFamily, getSlidingPanelsCount } from '../tracking/TrackingModule';
import { getQuoteTotals } from '../../utils/quoteUtils';

// Glass status options for sliding panels vs frames/other joineries
const GLASS_STATUSES_SLIDING = [
  { id: 'non_commande', label: 'Non commandé', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  { id: 'commande', label: 'Commandé', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'arrive', label: 'Arrivé', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  { id: 'rempli', label: 'Rempli (Vitré)', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', badge: 'Atelier' },
  { id: 'livre', label: 'Livré', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
];

const GLASS_STATUSES_STANDARD = [
  { id: 'non_commande', label: 'Non commandé', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  { id: 'commande', label: 'Commandé', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'arrive', label: 'Arrivé', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  { id: 'livre', label: 'Livré', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
];

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Helper to format money amounts
const formatMoney = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0';
  return Math.round(amount).toLocaleString('fr-FR');
};

// Helper to format date & time
const formatDateFr = (isoStr) => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} à ${hours}:${mins}`;
  } catch (e) {
    return isoStr;
  }
};

// ISO week number helper
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

const isThisWeek = (date) => {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && getWeekNumber(date) === getWeekNumber(now);
};

const isLastWeek = (date) => {
  const now = new Date();
  const lastWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date.getFullYear() === lastWeekDate.getFullYear() && getWeekNumber(date) === getWeekNumber(lastWeekDate);
};

const isThisMonth = (date) => {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const isLastMonth = (date) => {
  const now = new Date();
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  return date.getFullYear() === lastMonthYear && date.getMonth() === lastMonth;
};

// Helper to calculate total HT for an order
const getOrderTotalHT = (order, data, quoteSettings) => {
  if (!order) return 0;
  if (typeof order.totals?.ht === 'number' && order.totals.ht > 0) return order.totals.ht;
  if (typeof order.totalHT === 'number' && order.totalHT > 0) return order.totalHT;
  if (order.quoteId && data?.quotes) {
    const q = (data.quotes || []).find(quote => quote.id === order.quoteId);
    if (q) {
      const totals = getQuoteTotals(q, quoteSettings);
      if (totals.ht > 0) return totals.ht;
    }
  }
  let sum = 0;
  (order.items || []).forEach(it => {
    const qty = Number(it.qty) || 1;
    const price = it.unitPriceHT || it.priceData?.priceHT || it.price || 0;
    sum += price * qty;
  });
  return sum;
};

export default function FinishedGoodsModule({ data, setData, quoteSettings }) {
  // Navigation: 'stock' (En Stock Atelier) vs 'delivered' (Produits Livrés)
  const [activeMainTab, setActiveMainTab] = useState('stock'); 

  // Stock Atelier View States
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [activeItemFilter, setActiveItemFilter] = useState('all'); // 'all', 'cadres', 'panneaux'

  // Delivered Goods View Filters
  const [deliveredSearchTerm, setDeliveredSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all' | 'this_week' | 'last_week' | 'this_month' | 'last_month'
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' | '0'..'11'
  const [selectedWeek, setSelectedWeek] = useState('all'); // 'all' | '1'..'52'
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  // Delivery Confirmation Modal State
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryTarget, setDeliveryTarget] = useState(null);
  // deliveryTarget: { orderId, orderNumber, clientName, items: [...], deliveryDate, deliveryRef, syncGlass }

  // Toggle open/close of an order
  const toggleOrder = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Helper to check if a sub-lot is finished in workshop (Gestion & Suivi / Atelier)
  const isSubLotFinished = useCallback((sl) => {
    if (!sl) return false;

    // 1. Statut formellement Terminé ou date de fin renseignée
    if (sl.status === 'Terminé' || !!sl.completedAt) return true;

    // 2. Contrôle si checklist 100% complétée (avec fabrication commencée)
    const checklist = sl.checklist || {};
    const isSliding = sl.family === 'coulissant';
    const totalItems = isSliding
      ? (sl.cadres || []).length + (sl.panneaux || []).length
      : (sl.ouvertures || []).length;
    
    if (totalItems > 0) {
      const checkedCount = isSliding
        ? (sl.cadres || []).filter(c => checklist[c.id]).length + (sl.panneaux || []).filter(p => checklist[p.id]).length
        : (sl.ouvertures || []).filter(o => checklist[o.id]).length;
      if (checkedCount >= totalItems && (sl.status === 'En cours' || !!sl.startedAt)) return true;
    }

    return false;
  }, []);

  // Helper to extract all elements (cadres, panneaux, ouvertures) from an order (sous-lots terminés)
  const getOrderElements = useCallback((order) => {
    if (!order) return { cadres: [], panneaux: [], all: [], lots: [] };

    const cadres = [];
    const panneaux = [];
    const lotsMap = new Map();

    // 1. Ne retenir UNIQUEMENT que les sous-lots FINIS dans Gestion & Suivi / Atelier
    const allSubLots = [];
    (order.batches || []).forEach(b => {
      (b.subLots || []).forEach(sl => {
        if (isSubLotFinished(sl)) {
          allSubLots.push({ ...sl, batchName: b.name || `Lot ${b.id}` });
        }
      });
    });
    (order.subLots || []).forEach(sl => {
      if (isSubLotFinished(sl) && !allSubLots.some(s => s.id === sl.id)) {
        allSubLots.push({ ...sl, batchName: 'Sous-Lot Général' });
      }
    });

    if (allSubLots.length === 0) {
      return { cadres: [], panneaux: [], all: [], lots: [] };
    }

    allSubLots.forEach(sl => {
      const lotLabel = `${sl.batchName} — ${sl.code || sl.name || 'SL'}`;
      lotsMap.set(sl.id, lotLabel);

      const checklist = sl.checklist || {};
      const isSliding = sl.family === 'coulissant';

      // Cadres
      (sl.cadres || []).forEach(c => {
        const isDone = sl.status === 'Terminé' || !!checklist[c.id] || !!order.finishedGoodsStock?.[c.id];
        const glassStatus = order.glassStatuses?.[c.id] || 'non_commande';
        const deliveryInfo = order.finishedGoodsDelivery?.[c.id];
        const isDelivered = !!deliveryInfo?.delivered;

        cadres.push({
          id: c.id,
          orderId: order.id,
          clientId: order.clientId,
          repere: c.repere || '—',
          label: c.label || 'Cadre Dormant',
          dim: c.dim || '—',
          location: c.location || '',
          type: 'cadre',
          family: sl.family,
          isSliding,
          subLotId: sl.id,
          lotLabel,
          inStock: isDone,
          glassStatus,
          isDelivered,
          deliveredAt: deliveryInfo?.deliveredAt || null,
          deliveryRef: deliveryInfo?.deliveryRef || ''
        });
      });

      // Panneaux (coulissant)
      (sl.panneaux || []).forEach(p => {
        const isDone = sl.status === 'Terminé' || !!checklist[p.id] || !!order.finishedGoodsStock?.[p.id];
        const glassStatus = order.glassStatuses?.[p.id] || 'non_commande';
        const deliveryInfo = order.finishedGoodsDelivery?.[p.id];
        const isDelivered = !!deliveryInfo?.delivered;

        panneaux.push({
          id: p.id,
          orderId: order.id,
          clientId: order.clientId,
          repere: p.repere || '—',
          label: `${p.label || 'Vantail'} (${p.panelName || 'Panneau'})`,
          dim: p.dim || '—',
          type: 'panneau',
          family: sl.family,
          isSliding,
          subLotId: sl.id,
          lotLabel,
          inStock: isDone,
          glassStatus,
          isDelivered,
          deliveredAt: deliveryInfo?.deliveredAt || null,
          deliveryRef: deliveryInfo?.deliveryRef || ''
        });
      });

      // Ouvertures (ouvrant/fixe)
      (sl.ouvertures || []).forEach(o => {
        const isDone = sl.status === 'Terminé' || !!checklist[o.id] || !!order.finishedGoodsStock?.[o.id];
        const glassStatus = order.glassStatuses?.[o.id] || 'non_commande';
        const deliveryInfo = order.finishedGoodsDelivery?.[o.id];
        const isDelivered = !!deliveryInfo?.delivered;

        cadres.push({
          id: o.id,
          orderId: order.id,
          clientId: order.clientId,
          repere: o.repere || '—',
          label: o.label || (sl.family === 'fixe' ? 'Châssis Fixe' : 'Châssis Ouvrant'),
          dim: o.dim || '—',
          location: o.location || '',
          type: 'cadre',
          family: sl.family,
          isSliding: false,
          subLotId: sl.id,
          lotLabel,
          inStock: isDone,
          glassStatus,
          isDelivered,
          deliveredAt: deliveryInfo?.deliveredAt || null,
          deliveryRef: deliveryInfo?.deliveryRef || ''
        });
      });
    });

    const lots = Array.from(lotsMap.entries()).map(([id, label]) => ({ id, label }));
    const all = [...cadres, ...panneaux];

    return { cadres, panneaux, all, lots };
  }, [isSubLotFinished]);

  // Update glass status for a specific item
  const updateGlassStatus = (orderId, itemId, status) => {
    setData(prev => {
      const orders = (prev.orders || []).map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          glassStatuses: {
            ...(o.glassStatuses || {}),
            [itemId]: status
          },
          _lastModified: new Date().toISOString()
        };
      });
      return { ...prev, orders };
    });
  };

  // Update inStock boolean for a specific item
  const toggleStockStatus = (orderId, itemId, currentStatus) => {
    setData(prev => {
      const orders = (prev.orders || []).map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          finishedGoodsStock: {
            ...(o.finishedGoodsStock || {}),
            [itemId]: !currentStatus
          },
          _lastModified: new Date().toISOString()
        };
      });
      return { ...prev, orders };
    });
  };

  // Bulk update glass status for all filtered items of an order
  const bulkUpdateGlassStatus = (orderId, itemIds, newStatus) => {
    setData(prev => {
      const orders = (prev.orders || []).map(o => {
        if (o.id !== orderId) return o;
        const updated = { ...(o.glassStatuses || {}) };
        itemIds.forEach(id => {
          updated[id] = newStatus;
        });
        return {
          ...o,
          glassStatuses: updated,
          _lastModified: new Date().toISOString()
        };
      });
      return { ...prev, orders };
    });
  };

  // Commandes actives ayant des produits finis (sous-lots terminés)
  const activeLaunchedOrders = useMemo(() => {
    return (data?.orders || []).filter(o => {
      // 1. Exclure uniquement les commandes archivées ou déjà livrées complètement
      if (['Livré', 'Archivé'].includes(o.status)) {
        return false;
      }

      // 2. Doit impérativement contenir au moins un sous-lot fini (Produit Fini)
      const elements = getOrderElements(o);
      if (elements.all.length === 0) {
        return false;
      }

      return true;
    });
  }, [data?.orders, getOrderElements]);

  // Filtered orders list (matching search term on active orders)
  const filteredOrders = useMemo(() => {
    return activeLaunchedOrders.filter(o => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const orderId = (o.id || '').toLowerCase();
      const client = (data?.clients || []).find(c => c.id === o.clientId);
      const clientName = (client?.nom || client?.name || '').toLowerCase();
      return orderId.includes(term) || clientName.includes(term);
    });
  }, [activeLaunchedOrders, data?.clients, searchTerm]);

  // Global KPIs across all active orders (Stock, Delivered, Values)
  const globalStats = useMemo(() => {
    let totalCadres = 0;
    let cadresInStock = 0;
    let totalPanneaux = 0;
    let panneauxInStock = 0;
    let panneauxRemplis = 0;
    let totalGlassLivres = 0;
    let totalStockValue = 0;
    let totalDeliveredValue = 0;
    let totalDeliveredItems = 0;
    let totalInStockItems = 0;

    activeLaunchedOrders.forEach(o => {
      const { cadres, panneaux, all } = getOrderElements(o);
      const orderHT = getOrderTotalHT(o, data, quoteSettings);
      const totalItemsCount = all.length;

      // In stock items (not delivered)
      const stockCadres = cadres.filter(c => c.inStock && !c.isDelivered);
      const stockPanneaux = panneaux.filter(p => p.inStock && !p.isDelivered);
      const stockAll = all.filter(a => a.inStock && !a.isDelivered);
      const deliveredAll = all.filter(a => a.isDelivered);

      totalCadres += cadres.filter(c => !c.isDelivered).length;
      cadresInStock += stockCadres.length;
      totalPanneaux += panneaux.filter(p => !p.isDelivered).length;
      panneauxInStock += stockPanneaux.length;
      panneauxRemplis += stockPanneaux.filter(p => p.isSliding && p.glassStatus === 'rempli').length;
      totalGlassLivres += all.filter(i => i.glassStatus === 'livre').length;

      totalInStockItems += stockAll.length;
      totalDeliveredItems += deliveredAll.length;

      if (totalItemsCount > 0 && orderHT > 0) {
        totalStockValue += orderHT * (stockAll.length / totalItemsCount);
        totalDeliveredValue += orderHT * (deliveredAll.length / totalItemsCount);
      }
    });

    return {
      totalCadres,
      cadresInStock,
      totalPanneaux,
      panneauxInStock,
      panneauxRemplis,
      totalGlassLivres,
      totalStockValue,
      totalDeliveredValue,
      totalDeliveredItems,
      totalInStockItems
    };
  }, [activeLaunchedOrders, getOrderElements, data, quoteSettings]);

  // ─── DELIVERED GOODS LIST & FILTERS ──────────────────────────────────────────
  const allDeliveredItems = useMemo(() => {
    const list = [];
    (data?.orders || []).forEach(o => {
      const client = (data?.clients || []).find(c => c.id === o.clientId);
      const { all } = getOrderElements(o);
      const orderHT = getOrderTotalHT(o, data, quoteSettings);
      const unitValue = all.length > 0 && orderHT > 0 ? (orderHT / all.length) : 0;

      all.forEach(item => {
        if (item.isDelivered) {
          list.push({
            ...item,
            orderNumber: o.id,
            clientId: o.clientId,
            clientName: client?.nom || client?.name || 'Client',
            unitValue
          });
        }
      });
    });

    // Sort by deliveredAt desc
    return list.sort((a, b) => new Date(b.deliveredAt || 0) - new Date(a.deliveredAt || 0));
  }, [data?.orders, data?.clients, getOrderElements, quoteSettings]);

  // Filtered delivered items
  const filteredDeliveredItems = useMemo(() => {
    return allDeliveredItems.filter(item => {
      // 1. Text search
      if (deliveredSearchTerm) {
        const term = deliveredSearchTerm.toLowerCase();
        const match = 
          (item.orderNumber || '').toLowerCase().includes(term) ||
          (item.clientName || '').toLowerCase().includes(term) ||
          (item.repere || '').toLowerCase().includes(term) ||
          (item.label || '').toLowerCase().includes(term) ||
          (item.deliveryRef || '').toLowerCase().includes(term);
        if (!match) return false;
      }

      const itemDate = item.deliveredAt ? new Date(item.deliveredAt) : null;
      if (!itemDate || isNaN(itemDate.getTime())) return true;

      // 2. Period quick filter
      if (periodFilter === 'this_week') {
        if (!isThisWeek(itemDate)) return false;
      } else if (periodFilter === 'last_week') {
        if (!isLastWeek(itemDate)) return false;
      } else if (periodFilter === 'this_month') {
        if (!isThisMonth(itemDate)) return false;
      } else if (periodFilter === 'last_month') {
        if (!isLastMonth(itemDate)) return false;
      }

      // 3. Specific Month filter
      if (selectedMonth !== 'all') {
        if (itemDate.getMonth() !== parseInt(selectedMonth, 10)) return false;
      }

      // 4. Specific Week filter
      if (selectedWeek !== 'all') {
        if (getWeekNumber(itemDate) !== parseInt(selectedWeek, 10)) return false;
      }

      // 5. Specific Year filter
      if (selectedYear !== 'all') {
        if (itemDate.getFullYear() !== parseInt(selectedYear, 10)) return false;
      }

      return true;
    });
  }, [allDeliveredItems, deliveredSearchTerm, periodFilter, selectedMonth, selectedWeek, selectedYear]);

  // Delivered items total value on current filter
  const deliveredFilteredValue = useMemo(() => {
    return filteredDeliveredItems.reduce((sum, it) => sum + (it.unitValue || 0), 0);
  }, [filteredDeliveredItems]);

  // ─── DELIVERY MODAL HANDLERS ────────────────────────────────────────────────
  // Open delivery modal for a single item
  const openSingleDeliveryModal = (order, item) => {
    const client = (data?.clients || []).find(c => c.id === order.clientId);
    const todayStr = new Date().toISOString().split('T')[0];
    setDeliveryTarget({
      orderId: order.id,
      orderNumber: order.id,
      clientName: client?.nom || client?.name || 'Client',
      items: [item],
      deliveryDate: todayStr,
      deliveryRef: '',
      syncGlass: true
    });
    setDeliveryModalOpen(true);
  };

  // Open delivery modal for all in-stock items of an order
  const openBulkDeliveryModal = (order, itemsToDeliver) => {
    const client = (data?.clients || []).find(c => c.id === order.clientId);
    const todayStr = new Date().toISOString().split('T')[0];
    setDeliveryTarget({
      orderId: order.id,
      orderNumber: order.id,
      clientName: client?.nom || client?.name || 'Client',
      items: itemsToDeliver,
      deliveryDate: todayStr,
      deliveryRef: '',
      syncGlass: true
    });
    setDeliveryModalOpen(true);
  };

  // Confirm delivery execution
  const handleConfirmDelivery = () => {
    if (!deliveryTarget || !deliveryTarget.items || deliveryTarget.items.length === 0) return;
    const { orderId, items, deliveryDate, deliveryRef, syncGlass } = deliveryTarget;

    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== orderId) return o;

        const newDelivery = { ...(o.finishedGoodsDelivery || {}) };
        const newGlass = { ...(o.glassStatuses || {}) };

        const isoDeliveryDate = deliveryDate ? new Date(deliveryDate).toISOString() : new Date().toISOString();

        items.forEach(it => {
          newDelivery[it.id] = {
            delivered: true,
            deliveredAt: isoDeliveryDate,
            deliveryRef: deliveryRef || '',
            deliveredBy: 'Atelier'
          };
          if (syncGlass) {
            newGlass[it.id] = 'livre';
          }
        });

        return {
          ...o,
          finishedGoodsDelivery: newDelivery,
          glassStatuses: newGlass,
          _lastModified: new Date().toISOString()
        };
      });

      return { ...prev, orders: updatedOrders };
    });

    setDeliveryModalOpen(false);
    setDeliveryTarget(null);
  };

  // Revert / Cancel delivery of an item and bring it back to stock
  const handleRevertDelivery = (orderId, itemId, repere) => {
    if (!window.confirm(`Confirmez-vous l'annulation de la livraison pour l'élément "${repere || 'sélectionné'}" ?\n\nCet élément sera remis immédiatement en Stock Atelier.`)) {
      return;
    }
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== orderId) return o;

        const newDelivery = { ...(o.finishedGoodsDelivery || {}) };
        delete newDelivery[itemId];

        return {
          ...o,
          finishedGoodsDelivery: newDelivery,
          _lastModified: new Date().toISOString()
        };
      });

      return { ...prev, orders: updatedOrders };
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', color: '#1e293b' }}>
      
      {/* ─── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              padding: '0.55rem',
              borderRadius: '0.75rem',
              color: 'white',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}>
              <PackageCheck size={26} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Stock Atelier & Produits Finis
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Suivi du stock physique (cadres & panneaux), expéditions / livraisons et valorisation financière
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action / Currency indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ 
            fontSize: '0.8rem', 
            fontWeight: 700, 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            padding: '0.4rem 0.8rem', 
            borderRadius: '0.5rem', 
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Building size={14} color="#059669" />
            Devise : <strong>{quoteSettings?.currency || 'DZD'}</strong>
          </span>
        </div>
      </div>

      {/* ─── KPI STATS SUMMARY (AVEC VALEUR DU STOCK EN HAUT DE PAGE) ─────────── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.75rem' 
      }}>
        {/* 1. VALEUR DU STOCK ATELIER (DEMANDÉ EXPRESSÉMENT PAR L'UTILISATEUR) */}
        <div style={{ 
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', 
          color: 'white', 
          padding: '1.25rem', 
          borderRadius: '1rem', 
          boxShadow: '0 4px 15px rgba(4, 120, 87, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#a7f3d0' }}>
              VALEUR DU STOCK ATELIER
            </span>
            <DollarSign size={20} color="#a7f3d0" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
            {formatMoney(globalStats.totalStockValue)} <span style={{ fontSize: '1rem', fontWeight: 700, color: '#6ee7b7' }}>{quoteSettings?.currency || 'DZD'}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#d1fae5', marginTop: '0.2rem', fontWeight: 600 }}>
            💰 {globalStats.totalInStockItems} élément(s) actuellement en stock
          </div>
        </div>

        {/* 2. VALEUR LIVRÉE */}
        <div style={{ 
          background: 'white', 
          padding: '1.25rem', 
          borderRadius: '1rem', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              VALEUR TOTALE LIVRÉE
            </span>
            <Truck size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1d4ed8' }}>
            {formatMoney(globalStats.totalDeliveredValue)} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>{quoteSettings?.currency || 'DZD'}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            🚚 {globalStats.totalDeliveredItems} pièce(s) partie(s) sur chantier
          </span>
        </div>

        {/* 3. Stock Cadres */}
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>STOCK CADRES</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
              {globalStats.totalCadres > 0 ? Math.round((globalStats.cadresInStock / globalStats.totalCadres) * 100) : 0}%
            </span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0284c7' }}>
            {globalStats.cadresInStock} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>/ {globalStats.totalCadres}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cadres dormants en stock</span>
        </div>

        {/* 4. Stock Panneaux */}
        <div style={{ background: 'white', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>STOCK PANNEAUX</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7c3aed', background: '#ede9fe', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
              {globalStats.totalPanneaux > 0 ? Math.round((globalStats.panneauxInStock / globalStats.totalPanneaux) * 100) : 0}%
            </span>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#7c3aed' }}>
            {globalStats.panneauxInStock} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>/ {globalStats.totalPanneaux}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Vantaux coulissants & ouvrants</span>
        </div>
      </div>

      {/* ─── NAVIGATION SOUS-ONGLETS : EN STOCK ATELIER vs PRODUITS LIVRÉS ───── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '0.75rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Boutons Sous-Onglets */}
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={() => setActiveMainTab('stock')}
            style={{
              padding: '0.65rem 1.35rem',
              borderRadius: '0.65rem',
              border: 'none',
              background: activeMainTab === 'stock' ? '#0f172a' : '#f1f5f9',
              color: activeMainTab === 'stock' ? 'white' : '#475569',
              fontWeight: 800,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer',
              boxShadow: activeMainTab === 'stock' ? '0 4px 12px rgba(15, 23, 42, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Box size={18} />
            <span>En Stock Atelier</span>
            <span style={{
              fontSize: '0.72rem',
              background: activeMainTab === 'stock' ? '#10b981' : '#cbd5e1',
              color: 'white',
              padding: '0.1rem 0.55rem',
              borderRadius: '9999px',
              fontWeight: 900
            }}>
              {globalStats.totalInStockItems}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('delivered')}
            style={{
              padding: '0.65rem 1.35rem',
              borderRadius: '0.65rem',
              border: 'none',
              background: activeMainTab === 'delivered' ? '#16a34a' : '#f1f5f9',
              color: activeMainTab === 'delivered' ? 'white' : '#475569',
              fontWeight: 800,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              cursor: 'pointer',
              boxShadow: activeMainTab === 'delivered' ? '0 4px 12px rgba(22, 163, 74, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Truck size={18} />
            <span>Produits Livrés</span>
            <span style={{
              fontSize: '0.72rem',
              background: activeMainTab === 'delivered' ? 'white' : '#cbd5e1',
              color: activeMainTab === 'delivered' ? '#16a34a' : 'white',
              padding: '0.1rem 0.55rem',
              borderRadius: '9999px',
              fontWeight: 900
            }}>
              {globalStats.totalDeliveredItems}
            </span>
          </button>
        </div>

        {/* Search Input for Current Tab */}
        {activeMainTab === 'stock' ? (
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder="Rechercher par N° commande, client..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input"
              style={{
                width: '100%',
                paddingLeft: '2.25rem',
                fontSize: '0.85rem',
                borderRadius: '0.5rem',
                border: '1.5px solid #cbd5e1',
                background: 'white'
              }}
            />
          </div>
        ) : null}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ─── CONTENU DU SOUS-ONGLET 1 : EN STOCK ATELIER ───────────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ 
              background: 'white', 
              borderRadius: '1rem', 
              padding: '3rem 2rem', 
              textAlign: 'center', 
              border: '1px dashed #cbd5e1' 
            }}>
              <AlertCircle size={40} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', margin: '0 0 0.5rem 0' }}>
                Aucun produit fini en stock atelier
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
                {searchTerm 
                  ? "Aucune commande ne correspond à votre recherche."
                  : "Dès que des sous-lots sont lancés et terminés dans « Gestion & Suivi », leurs cadres et panneaux apparaîtront ici."}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const client = (data?.clients || []).find(c => c.id === order.clientId);
              const clientName = client?.nom || client?.name || 'Client Inconnu';
              const { cadres, panneaux, all, lots } = getOrderElements(order);

              // Éléments non encore livrés (actuellement présents dans l'atelier)
              const activeCadres = cadres.filter(c => !c.isDelivered);
              const activePanneaux = panneaux.filter(p => !p.isDelivered);
              const activeAll = all.filter(a => !a.isDelivered);

              // Cadres & Panneaux prêts
              const cadresDone = activeCadres.filter(c => c.inStock).length;
              const panneauxDone = activePanneaux.filter(p => p.inStock).length;
              const slidingPanneaux = activePanneaux.filter(p => p.isSliding);
              const slidingRemplis = slidingPanneaux.filter(p => p.glassStatus === 'rempli').length;

              const isExpanded = !!expandedOrders[order.id];
              const orderHT = getOrderTotalHT(order, data, quoteSettings);
              const orderStockValue = all.length > 0 ? (orderHT * (activeAll.filter(a => a.inStock).length / all.length)) : 0;

              return (
                <div 
                  key={order.id}
                  style={{
                    background: 'white',
                    borderRadius: '1rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Order Accordion Header */}
                  <div 
                    onClick={() => toggleOrder(order.id)}
                    style={{
                      padding: '1.1rem 1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: isExpanded ? '#f8fafc' : 'white',
                      userSelect: 'none',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '0.65rem',
                        background: isExpanded ? '#059669' : '#f1f5f9',
                        color: isExpanded ? 'white' : '#0f172a',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}>
                        <Layers size={20} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: 800, 
                            color: '#0f172a',
                            letterSpacing: '-0.01em'
                          }}>
                            Commande {order.id}
                          </span>
                          <span style={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 700, 
                            color: '#1d4ed8', 
                            background: '#eff6ff', 
                            padding: '0.2rem 0.65rem', 
                            borderRadius: '0.45rem',
                            border: '1px solid #bfdbfe',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}>
                            <span>👤</span> {clientName}
                          </span>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 700, 
                            background: '#f1f5f9', 
                            color: '#475569', 
                            padding: '0.2rem 0.6rem', 
                            borderRadius: '9999px',
                            border: '1px solid #e2e8f0'
                          }}>
                            {activeAll.length} pièce(s) en atelier
                          </span>
                          {orderStockValue > 0 && (
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: '#ecfdf5',
                              color: '#047857',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              border: '1px solid #a7f3d0'
                            }}>
                              Valeur : {formatMoney(orderStockValue)} {quoteSettings?.currency || 'DZD'}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Cliquez pour {isExpanded ? 'fermer' : 'ouvrir le stock et les vitrages'}
                        </span>
                      </div>
                    </div>

                    {/* Synthèse rapide à droite */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.65rem' }}>
                        {/* Badge Cadres */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          background: '#f8fafc', 
                          padding: '0.35rem 0.75rem', 
                          borderRadius: '0.5rem', 
                          border: '1px solid #e2e8f0' 
                        }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>STOCK CADRES</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7' }}>
                            {cadresDone} / {activeCadres.length}
                          </span>
                        </div>

                        {/* Badge Panneaux */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          background: '#f8fafc', 
                          padding: '0.35rem 0.75rem', 
                          borderRadius: '0.5rem', 
                          border: '1px solid #e2e8f0' 
                        }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>STOCK PANNEAUX</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#7c3aed' }}>
                            {panneauxDone} / {activePanneaux.length}
                          </span>
                        </div>
                      </div>

                      {/* Bouton Tout Livrer */}
                      {activeAll.filter(a => a.inStock).length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openBulkDeliveryModal(order, activeAll.filter(a => a.inStock));
                          }}
                          style={{
                            background: '#16a34a',
                            color: 'white',
                            border: 'none',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                          }}
                          title="Livrer toutes les pièces prêtes de cette commande"
                        >
                          <Truck size={14} /> Tout Livrer
                        </button>
                      )}

                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        background: isExpanded ? '#dcfce7' : '#f8fafc', 
                        color: isExpanded ? '#15803d' : '#64748b',
                        display: 'grid', 
                        placeItems: 'center' 
                      }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* ── DETAIL LORS DE L'OUVERTURE ──────────────────────────────── */}
                  {isExpanded && (
                    <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
                      
                      {/* A. Barres d'indicateurs de stock et lots associés */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                        gap: '1rem', 
                        marginBottom: '1.5rem' 
                      }}>
                        
                        {/* Carte Stock Cadres */}
                        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              🚪 Stock Cadres Dormants
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: cadresDone === activeCadres.length && activeCadres.length > 0 ? '#16a34a' : '#0284c7' }}>
                              {cadresDone} / {activeCadres.length} prêts
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${activeCadres.length > 0 ? (cadresDone / activeCadres.length) * 100 : 0}%`, 
                              height: '100%', 
                              background: '#0284c7', 
                              borderRadius: '9999px',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>

                        {/* Carte Stock Panneaux */}
                        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              🪟 Stock Panneaux (Vantaux)
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: panneauxDone === activePanneaux.length && activePanneaux.length > 0 ? '#16a34a' : '#7c3aed' }}>
                              {panneauxDone} / {activePanneaux.length} prêts
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${activePanneaux.length > 0 ? (panneauxDone / activePanneaux.length) * 100 : 0}%`, 
                              height: '100%', 
                              background: '#7c3aed', 
                              borderRadius: '9999px',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          {slidingPanneaux.length > 0 && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6d28d9', fontWeight: 600 }}>
                              ✨ {slidingRemplis} / {slidingPanneaux.length} vantaux coulissants vitrés en atelier (remplis)
                            </div>
                          )}
                        </div>

                        {/* Carte Lots Associés */}
                        <div style={{ background: 'white', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                            🏷️ Lots Associés ({lots.length})
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {lots.length > 0 ? (
                              lots.map(l => (
                                <span 
                                  key={l.id} 
                                  style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700, 
                                    background: '#eff6ff', 
                                    color: '#1d4ed8', 
                                    padding: '0.2rem 0.6rem', 
                                    borderRadius: '6px',
                                    border: '1px solid #bfdbfe'
                                  }}
                                >
                                  {l.label}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Aucun lot découpé</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* B. Barre d'outils et Filtres */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        flexWrap: 'wrap', 
                        gap: '0.75rem',
                        marginBottom: '1rem' 
                      }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => setActiveItemFilter('all')}
                            style={{
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '0.5rem',
                              border: '1px solid',
                              borderColor: activeItemFilter === 'all' ? '#10b981' : '#cbd5e1',
                              background: activeItemFilter === 'all' ? '#10b981' : 'white',
                              color: activeItemFilter === 'all' ? 'white' : '#475569',
                              cursor: 'pointer'
                            }}
                          >
                            Tout ({activeAll.length})
                          </button>
                          <button 
                            onClick={() => setActiveItemFilter('cadres')}
                            style={{
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '0.5rem',
                              border: '1px solid',
                              borderColor: activeItemFilter === 'cadres' ? '#0284c7' : '#cbd5e1',
                              background: activeItemFilter === 'cadres' ? '#0284c7' : 'white',
                              color: activeItemFilter === 'cadres' ? 'white' : '#475569',
                              cursor: 'pointer'
                            }}
                          >
                            🚪 Cadres ({activeCadres.length})
                          </button>
                          <button 
                            onClick={() => setActiveItemFilter('panneaux')}
                            style={{
                              padding: '0.4rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '0.5rem',
                              border: '1px solid',
                              borderColor: activeItemFilter === 'panneaux' ? '#7c3aed' : '#cbd5e1',
                              background: activeItemFilter === 'panneaux' ? '#7c3aed' : 'white',
                              color: activeItemFilter === 'panneaux' ? 'white' : '#475569',
                              cursor: 'pointer'
                            }}
                          >
                            🪟 Panneaux ({activePanneaux.length})
                          </button>
                        </div>

                        {/* Actions Rapides Vitrage en Masse */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Action vitrage :</span>
                          <button
                            onClick={() => bulkUpdateGlassStatus(order.id, (activeItemFilter === 'cadres' ? activeCadres : activeItemFilter === 'panneaux' ? activePanneaux : activeAll).map(i => i.id), 'commande')}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                          >
                            Tout Commandé
                          </button>
                          <button
                            onClick={() => bulkUpdateGlassStatus(order.id, (activeItemFilter === 'cadres' ? activeCadres : activeItemFilter === 'panneaux' ? activePanneaux : activeAll).map(i => i.id), 'arrive')}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                          >
                            Tout Arrivé
                          </button>
                          {activePanneaux.some(p => p.isSliding) && (
                            <button
                              onClick={() => bulkUpdateGlassStatus(order.id, activePanneaux.filter(p => p.isSliding).map(p => p.id), 'rempli')}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }}
                            >
                              Panneaux Remplis (Vitrés)
                            </button>
                          )}
                          <button
                            onClick={() => bulkUpdateGlassStatus(order.id, (activeItemFilter === 'cadres' ? activeCadres : activeItemFilter === 'panneaux' ? activePanneaux : activeAll).map(i => i.id), 'livre')}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                          >
                            Tout Livré
                          </button>
                        </div>
                      </div>

                      {/* C. Tableau Détail des Pièces : Cadre/Panneau, Lot Associé, Stock et Vitrage */}
                      <div style={{ 
                        background: 'white', 
                        borderRadius: '0.75rem', 
                        border: '1px solid #e2e8f0', 
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                              <th style={{ padding: '0.75rem 1rem', width: '60px' }}>Type</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Repère & Désignation</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Dimensions</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Lot Associé</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Stock Atelier</th>
                              <th style={{ padding: '0.75rem 1rem' }}>État Vitrage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const itemsToDisplay = activeItemFilter === 'cadres' 
                                ? activeCadres 
                                : activeItemFilter === 'panneaux' 
                                  ? activePanneaux 
                                  : activeAll;

                              if (itemsToDisplay.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                      Aucun élément en stock dans cette catégorie
                                    </td>
                                  </tr>
                                );
                              }

                              return itemsToDisplay.map((item, idx) => {
                                const isSlidingPanel = item.type === 'panneau' && item.isSliding;
                                const availableGlassStatuses = isSlidingPanel ? GLASS_STATUSES_SLIDING : GLASS_STATUSES_STANDARD;
                                const currentGlassObj = availableGlassStatuses.find(s => s.id === item.glassStatus) || availableGlassStatuses[0];

                                return (
                                  <tr 
                                    key={item.id || idx}
                                    style={{ 
                                      borderBottom: idx < itemsToDisplay.length - 1 ? '1px solid #f1f5f9' : 'none',
                                      background: idx % 2 === 0 ? 'white' : '#fcfdfd'
                                    }}
                                  >
                                    {/* Type */}
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <span style={{ 
                                        fontSize: '0.75rem', 
                                        fontWeight: 800, 
                                        background: item.type === 'cadre' ? '#e0f2fe' : '#ede9fe', 
                                        color: item.type === 'cadre' ? '#0369a1' : '#6d28d9',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '6px'
                                      }}>
                                        {item.type === 'cadre' ? 'CADRE' : 'PANNEAU'}
                                      </span>
                                    </td>

                                    {/* Repère & Désignation */}
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <strong style={{ color: '#0f172a' }}>{item.repere}</strong>
                                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>• {item.label}</span>
                                      </div>
                                      {item.location && (
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                          📍 {item.location}
                                        </div>
                                      )}
                                    </td>

                                    {/* Dimensions */}
                                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                                      {item.dim}
                                    </td>

                                    {/* Lot Associé */}
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <span style={{ 
                                        fontSize: '0.75rem', 
                                        fontWeight: 700, 
                                        background: '#f1f5f9', 
                                        color: '#475569', 
                                        padding: '0.2rem 0.55rem', 
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0'
                                      }}>
                                        {item.lotLabel}
                                      </span>
                                    </td>

                                    {/* Stock Atelier (Prêt par défaut + Option de changer à Livré avec Popup) */}
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                                        {/* Badge Prêt / Fabrication */}
                                        <button
                                          onClick={() => toggleStockStatus(order.id, item.id, item.inStock)}
                                          style={{
                                            border: 'none',
                                            background: item.inStock ? '#dcfce7' : '#fef3c7',
                                            color: item.inStock ? '#15803d' : '#b45309',
                                            padding: '0.25rem 0.65rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            cursor: 'pointer'
                                          }}
                                          title="Cliquer pour basculer Prêt en stock / En fabrication"
                                        >
                                          {item.inStock ? (
                                            <>
                                              <Check size={13} /> Prêt en Stock
                                            </>
                                          ) : (
                                            <>
                                              <Clock size={13} /> En fabrication
                                            </>
                                          )}
                                        </button>

                                        {/* Option : Changer à Livré (Ouvre le popup de confirmation) */}
                                        <button
                                          onClick={() => openSingleDeliveryModal(order, item)}
                                          style={{
                                            border: '1px solid #bfdbfe',
                                            background: '#eff6ff',
                                            color: '#1d4ed8',
                                            padding: '0.2rem 0.55rem',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                          }}
                                          title="Changer le statut à Livré (avec confirmation et date)"
                                        >
                                          <Truck size={12} /> Marquer Livré
                                        </button>
                                      </div>
                                    </td>

                                    {/* État Vitrage (Menu déroulant / Stepper) */}
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <select
                                          value={item.glassStatus}
                                          onChange={e => updateGlassStatus(order.id, item.id, e.target.value)}
                                          style={{
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '0.45rem',
                                            border: `1.5px solid ${currentGlassObj.border}`,
                                            background: currentGlassObj.bg,
                                            color: currentGlassObj.color,
                                            cursor: 'pointer'
                                          }}
                                        >
                                          {availableGlassStatuses.map(st => (
                                            <option key={st.id} value={st.id}>
                                              {st.label}
                                            </option>
                                          ))}
                                        </select>

                                        {isSlidingPanel && (
                                          <span style={{ fontSize: '0.7rem', color: '#6d28d9', fontWeight: 600 }}>
                                            (Coulissant)
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ─── CONTENU DU SOUS-ONGLET 2 : PRODUITS LIVRÉS (HISTORIQUE & FILTRES) ─── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === 'delivered' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* BARRE DE FILTRES TEMPORELS (MOIS & SEMAINE DEMANDÉS EXPRESSÉMENT) */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.25rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={18} color="#16a34a" />
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                  Filtres des Livraisons
                </strong>
              </div>

              {/* Raccourcis Périodes Rapides */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Toutes les dates' },
                  { id: 'this_week', label: 'Cette semaine' },
                  { id: 'last_week', label: 'Semaine dernière' },
                  { id: 'this_month', label: 'Ce mois-ci' },
                  { id: 'last_month', label: 'Mois dernier' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPeriodFilter(p.id);
                      if (p.id !== 'all') {
                        setSelectedMonth('all');
                        setSelectedWeek('all');
                      }
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid',
                      borderColor: periodFilter === p.id ? '#16a34a' : '#e2e8f0',
                      background: periodFilter === p.id ? '#f0fdf4' : 'white',
                      color: periodFilter === p.id ? '#15803d' : '#64748b',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteurs Détaillés : Mois, Semaine, Année et Recherche */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              
              {/* Filtre par Mois */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  📅 Filtrer par Mois :
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => {
                    setSelectedMonth(e.target.value);
                    setPeriodFilter('custom');
                  }}
                  className="input"
                  style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem' }}
                >
                  <option value="all">-- Tous les mois --</option>
                  {MONTHS_FR.map((m, idx) => (
                    <option key={idx} value={String(idx)}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Filtre par Semaine */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  🗓️ Filtrer par Semaine :
                </label>
                <select
                  value={selectedWeek}
                  onChange={e => {
                    setSelectedWeek(e.target.value);
                    setPeriodFilter('custom');
                  }}
                  className="input"
                  style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem' }}
                >
                  <option value="all">-- Toutes les semaines --</option>
                  {Array.from({ length: 52 }, (_, i) => i + 1).map(wk => (
                    <option key={wk} value={String(wk)}>Semaine {wk}</option>
                  ))}
                </select>
              </div>

              {/* Filtre par Année */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  🏛️ Année :
                </label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem' }}
                >
                  <option value="all">Toutes les années</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>

              {/* Recherche texte */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  🔍 Rechercher :
                </label>
                <input
                  type="text"
                  placeholder="N° commande, client, repère..."
                  value={deliveredSearchTerm}
                  onChange={e => setDeliveredSearchTerm(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }}
                />
              </div>

            </div>

            {/* Récapitulatif de la sélection filtrée */}
            <div style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              fontSize: '0.82rem',
              color: '#475569'
            }}>
              <div>
                Affichage de <strong>{filteredDeliveredItems.length}</strong> pièce(s) livrée(s)
              </div>
              <div style={{
                background: '#f0fdf4',
                color: '#166534',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontWeight: 800,
                border: '1px solid #bbf7d0'
              }}>
                Valeur Livrée Filtrée : <strong>{formatMoney(deliveredFilteredValue)} {quoteSettings?.currency || 'DZD'}</strong>
              </div>
            </div>
          </div>

          {/* TABLEAU DES PRODUITS LIVRÉS */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Date Livraison</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Commande & Client</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Repère & Désignation</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Dimensions</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Lot Associé</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Réf / BL</th>
                  <th style={{ padding: '0.85rem 1rem' }}>État Vitrage</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      <Truck size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem' }} />
                      <div style={{ fontWeight: 700, color: '#475569', fontSize: '0.95rem' }}>
                        Aucun produit livré sur cette période
                      </div>
                      <span style={{ fontSize: '0.8rem' }}>
                        Modifiez les filtres de période ou marquez des pièces comme livrées depuis l'onglet « En Stock Atelier ».
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredDeliveredItems.map((item, idx) => {
                    return (
                      <tr 
                        key={item.id || idx}
                        style={{ 
                          borderBottom: idx < filteredDeliveredItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                          background: idx % 2 === 0 ? 'white' : '#fcfdfd'
                        }}
                      >
                        {/* Date de Livraison */}
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#166534' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={14} color="#16a34a" />
                            <span>{formatDateFr(item.deliveredAt)}</span>
                          </div>
                        </td>

                        {/* Commande & Client */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ color: '#0f172a' }}>Commande {item.orderNumber}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            👤 {item.clientName}
                          </div>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 800, 
                            background: item.type === 'cadre' ? '#e0f2fe' : '#ede9fe', 
                            color: item.type === 'cadre' ? '#0369a1' : '#6d28d9',
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '6px'
                          }}>
                            {item.type === 'cadre' ? 'CADRE' : 'PANNEAU'}
                          </span>
                        </td>

                        {/* Repère & Désignation */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <strong style={{ color: '#0f172a' }}>{item.repere}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {item.label}
                          </div>
                        </td>

                        {/* Dimensions */}
                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {item.dim}
                        </td>

                        {/* Lot Associé */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 700, 
                            background: '#f1f5f9', 
                            color: '#475569', 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}>
                            {item.lotLabel}
                          </span>
                        </td>

                        {/* Réf / Bon de livraison */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                          {item.deliveryRef ? (
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                              {item.deliveryRef}
                            </span>
                          ) : '—'}
                        </td>

                        {/* État Vitrage */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            fontWeight: 800, 
                            background: '#f0fdf4', 
                            color: '#15803d', 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '9999px',
                            border: '1px solid #bbf7d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <Check size={12} /> {item.glassStatus === 'livre' ? 'Livré' : item.glassStatus}
                          </span>
                        </td>

                        {/* Action: Remettre en Stock Atelier */}
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRevertDelivery(item.orderId, item.id, item.repere)}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              color: '#475569',
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title="Annuler la livraison et remettre cet élément en stock atelier"
                          >
                            <RotateCcw size={13} /> Remettre en Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* ─── MODAL POPUP : CONFIRMATION DE LIVRAISON ───────────────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {deliveryModalOpen && deliveryTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#15803d'
                }}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    Confirmation de Livraison
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Sortie du stock atelier vers le chantier / client
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setDeliveryModalOpen(false); setDeliveryTarget(null); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Résumé de l'élément / commande */}
              <div style={{
                background: '#f1f5f9',
                borderRadius: '0.75rem',
                padding: '1rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>COMMANDE</span>
                  <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                    Commande {deliveryTarget.orderNumber} • {deliveryTarget.clientName}
                  </strong>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.35rem', fontWeight: 600 }}>
                  {deliveryTarget.items.length === 1 ? 'Élément à marquer livré :' : `${deliveryTarget.items.length} éléments à marquer livrés :`}
                </div>

                <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {deliveryTarget.items.map(it => (
                    <div key={it.id} style={{
                      background: 'white',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.8rem',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div>
                        <strong style={{ color: '#0f172a' }}>{it.repere}</strong>
                        <span style={{ color: '#64748b' }}> — {it.label}</span>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.75rem', color: '#475569' }}>
                        {it.dim}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date de livraison */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  📅 Date de Livraison :
                </label>
                <input
                  type="date"
                  className="input"
                  value={deliveryTarget.deliveryDate}
                  onChange={e => setDeliveryTarget(prev => ({ ...prev, deliveryDate: e.target.value }))}
                  style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
                />
              </div>

              {/* Référence / Bon de livraison */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  📝 Réf / N° Bon de Livraison ou Transporteur (Optionnel) :
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex : BL-2026-088 ou Nom du chauffeur"
                  value={deliveryTarget.deliveryRef}
                  onChange={e => setDeliveryTarget(prev => ({ ...prev, deliveryRef: e.target.value }))}
                  style={{ width: '100%', fontSize: '0.9rem', padding: '0.6rem' }}
                />
              </div>

              {/* Checkbox vitrage livré */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#15803d',
                background: '#f0fdf4',
                padding: '0.75rem 0.95rem',
                borderRadius: '0.6rem',
                border: '1px solid #bbf7d0',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={deliveryTarget.syncGlass}
                  onChange={e => setDeliveryTarget(prev => ({ ...prev, syncGlass: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <span>Passer également l'état des vitrages associés à « Livré »</span>
              </label>
            </div>

            {/* Footer Actions */}
            <div style={{
              padding: '1rem 1.5rem',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => { setDeliveryModalOpen(false); setDeliveryTarget(null); }}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', fontWeight: 700 }}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelivery}
                className="btn btn-primary"
                style={{
                  background: '#16a34a',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)'
                }}
              >
                <Check size={16} /> Confirmer la Livraison
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
