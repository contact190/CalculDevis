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
  AlertCircle
} from 'lucide-react';
import { classifyOpeningFamily, getSlidingPanelsCount } from '../tracking/TrackingModule';

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

export default function FinishedGoodsModule({ data, setData, quoteSettings }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [activeItemFilter, setActiveItemFilter] = useState('all'); // 'all', 'cadres', 'panneaux'
  const [lotFilter, setLotFilter] = useState('all');

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

  // Helper to check if a batch is completed in Gestion & Suivi
  const isBatchCompleted = useCallback((batch) => {
    if (!batch) return false;
    if (batch.status === 'Terminé') return true;
    if (batch.subLots && batch.subLots.length > 0) {
      return batch.subLots.every(s => s.status === 'Terminé');
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
        cadres.push({
          id: c.id,
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
          glassStatus
        });
      });

      // Panneaux (coulissant)
      (sl.panneaux || []).forEach(p => {
        const isDone = sl.status === 'Terminé' || !!checklist[p.id] || !!order.finishedGoodsStock?.[p.id];
        const glassStatus = order.glassStatuses?.[p.id] || 'non_commande';
        panneaux.push({
          id: p.id,
          repere: p.repere || '—',
          label: `${p.label || 'Vantail'} (${p.panelName || 'Panneau'})`,
          dim: p.dim || '—',
          type: 'panneau',
          family: sl.family,
          isSliding,
          subLotId: sl.id,
          lotLabel,
          inStock: isDone,
          glassStatus
        });
      });

      // Ouvertures (ouvrant/fixe)
      (sl.ouvertures || []).forEach(o => {
        const isDone = sl.status === 'Terminé' || !!checklist[o.id] || !!order.finishedGoodsStock?.[o.id];
        const glassStatus = order.glassStatuses?.[o.id] || 'non_commande';
        cadres.push({
          id: o.id,
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
          glassStatus
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
          }
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
          }
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
          glassStatuses: updated
        };
      });
      return { ...prev, orders };
    });
  };

  // Commandes actives ayant des produits finis (sous-lots terminés)
  const activeLaunchedOrders = useMemo(() => {
    return (data?.orders || []).filter(o => {
      // 1. Exclure uniquement les commandes archivées ou déjà livrées au client
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

  // Filtered orders list (only display matching search on active launched orders)
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

  // Global KPIs across active launched orders
  const globalStats = useMemo(() => {
    let totalCadres = 0;
    let cadresInStock = 0;
    let totalPanneaux = 0;
    let panneauxInStock = 0;
    let panneauxRemplis = 0;
    let totalGlassLivres = 0;

    activeLaunchedOrders.forEach(o => {
      const { cadres, panneaux } = getOrderElements(o);
      totalCadres += cadres.length;
      cadresInStock += cadres.filter(c => c.inStock).length;
      totalPanneaux += panneaux.length;
      panneauxInStock += panneaux.filter(p => p.inStock).length;
      panneauxRemplis += panneaux.filter(p => p.isSliding && p.glassStatus === 'rempli').length;
      totalGlassLivres += [...cadres, ...panneaux].filter(i => i.glassStatus === 'livre').length;
    });

    return {
      totalCadres,
      cadresInStock,
      totalPanneaux,
      panneauxInStock,
      panneauxRemplis,
      totalGlassLivres
    };
  }, [activeLaunchedOrders, getOrderElements]);

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
                Produits Finis
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Stock cadres & panneaux (Gestion & Suivi), lots associés et rotation des vitrages
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              placeholder="Rechercher par N° de commande..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input"
              style={{
                width: '100%',
                paddingLeft: '2.25rem',
                fontSize: '0.875rem',
                borderRadius: '0.5rem',
                border: '1.5px solid #cbd5e1',
                background: 'white'
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── KPI STATS SUMMARY ──────────────────────────────────────────────── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.75rem' 
      }}>
        {/* Total Commandes */}
        <div style={{ background: 'white', padding: '1.1rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>COMMANDES</span>
            <Box size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
            {filteredOrders.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>En suivi d'atelier</span>
        </div>

        {/* Stock Cadres */}
        <div style={{ background: 'white', padding: '1.1rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>STOCK CADRES</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
              {globalStats.totalCadres > 0 ? Math.round((globalStats.cadresInStock / globalStats.totalCadres) * 100) : 0}%
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7' }}>
            {globalStats.cadresInStock} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>/ {globalStats.totalCadres}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cadres dormants prêts</span>
        </div>

        {/* Stock Panneaux */}
        <div style={{ background: 'white', padding: '1.1rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>STOCK PANNEAUX</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7c3aed', background: '#ede9fe', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
              {globalStats.totalPanneaux > 0 ? Math.round((globalStats.panneauxInStock / globalStats.totalPanneaux) * 100) : 0}%
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed' }}>
            {globalStats.panneauxInStock} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>/ {globalStats.totalPanneaux}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Vantaux coulissants & ouvrants</span>
        </div>

        {/* Panneaux Remplis (Coulissant) */}
        <div style={{ background: 'white', padding: '1.1rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>PANNEAUX REMPLIS</span>
            <Sparkles size={18} color="#6d28d9" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6d28d9' }}>
            {globalStats.panneauxRemplis}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Vitrés en atelier (Coulissant)</span>
        </div>

        {/* Vitrages Livrés */}
        <div style={{ background: 'white', padding: '1.1rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>VITRAGES LIVRÉS</span>
            <Truck size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>
            {globalStats.totalGlassLivres}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Partis sur chantier</span>
        </div>
      </div>

      {/* ─── ORDERS LIST (AFFICHE SEULEMENT N° DE COMMANDE) ─────────────────── */}
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
              Aucune production en cours
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
              {searchTerm 
                ? 'Aucune commande ne correspond à votre recherche.' 
                : 'Seules les commandes dont la production a été lancée et non terminée dans "Gestion & Suivi" s\'affichent ici.'}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isExpanded = !!expandedOrders[order.id];
            const { cadres, panneaux, all, lots } = getOrderElements(order);
            const client = (data?.clients || []).find(c => c.id === order.clientId);
            const clientName = client?.nom || client?.name || client?.company || 'Client non spécifié';

            const cadresDone = cadres.filter(c => c.inStock).length;
            const panneauxDone = panneaux.filter(p => p.inStock).length;
            const slidingPanneaux = panneaux.filter(p => p.isSliding);
            const slidingRemplis = slidingPanneaux.filter(p => p.glassStatus === 'rempli').length;

            return (
              <div 
                key={order.id} 
                style={{ 
                  background: 'white', 
                  borderRadius: '1rem', 
                  border: isExpanded ? '2px solid #10b981' : '1px solid #e2e8f0', 
                  boxShadow: isExpanded ? '0 8px 24px rgba(16, 185, 129, 0.12)' : '0 2px 4px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* ── COMMANDE CARD HEADER (N° DE COMMANDE + NOM DU CLIENT A CÔTE) ── */}
                <div 
                  onClick={() => toggleOrder(order.id)}
                  style={{ 
                    padding: '1.25rem 1.5rem', 
                    background: isExpanded ? '#f0fdf4' : 'white', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0.65rem',
                      background: isExpanded ? '#10b981' : '#f1f5f9',
                      color: isExpanded ? 'white' : '#475569',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: '1rem',
                      transition: 'all 0.2s ease'
                    }}>
                      📦
                    </div>

                    {/* N° DE COMMANDE + NOM DU CLIENT A CÔTE */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '1.25rem', 
                          fontWeight: 800, 
                          color: '#0f172a',
                          letterSpacing: '-0.01em'
                        }}>
                          {order.id}
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
                          {all.length} pièces
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Cliquez pour {isExpanded ? 'fermer' : 'ouvrir le stock et les vitrages'}
                      </span>
                    </div>
                  </div>

                  {/* Synthèse rapide à droite */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                          {cadresDone} / {cadres.length}
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
                          {panneauxDone} / {panneaux.length}
                        </span>
                      </div>
                    </div>

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
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: cadresDone === cadres.length && cadres.length > 0 ? '#16a34a' : '#0284c7' }}>
                            {cadresDone} / {cadres.length} prêts
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${cadres.length > 0 ? (cadresDone / cadres.length) * 100 : 0}%`, 
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
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: panneauxDone === panneaux.length && panneaux.length > 0 ? '#16a34a' : '#7c3aed' }}>
                            {panneauxDone} / {panneaux.length} prêts
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${panneaux.length > 0 ? (panneauxDone / panneaux.length) * 100 : 0}%`, 
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
                          Tout ({all.length})
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
                          🚪 Cadres ({cadres.length})
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
                          🪟 Panneaux ({panneaux.length})
                        </button>
                      </div>

                      {/* Actions Rapides Vitrage en Masse */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Action vitrage :</span>
                        <button
                          onClick={() => bulkUpdateGlassStatus(order.id, (activeItemFilter === 'cadres' ? cadres : activeItemFilter === 'panneaux' ? panneaux : all).map(i => i.id), 'commande')}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          Tout Commandé
                        </button>
                        <button
                          onClick={() => bulkUpdateGlassStatus(order.id, (activeItemFilter === 'cadres' ? cadres : activeItemFilter === 'panneaux' ? panneaux : all).map(i => i.id), 'arrive')}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        >
                          Tout Arrivé
                        </button>
                        {panneaux.some(p => p.isSliding) && (
                          <button
                            onClick={() => bulkUpdateGlassStatus(order.id, panneaux.filter(p => p.isSliding).map(p => p.id), 'rempli')}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }}
                          >
                            Panneaux Remplis (Vitrés)
                          </button>
                        )}
                        <button
                          onClick={() => bulkUpdateGlassStatus(order.id, (activeItemFilter === 'cadres' ? cadres : activeItemFilter === 'panneaux' ? panneaux : all).map(i => i.id), 'livre')}
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
                              ? cadres 
                              : activeItemFilter === 'panneaux' 
                                ? panneaux 
                                : all;

                            if (itemsToDisplay.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                    Aucun élément dans cette catégorie
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

                                  {/* Stock Atelier (Prêt / En fabrication) */}
                                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
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
                                      title="Cliquer pour basculer le stock de cette pièce"
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

    </div>
  );
}
