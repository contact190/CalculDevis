import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Package, 
  Truck, 
  Wrench, 
  Layers, 
  Sliders, 
  Maximize2, 
  Search, 
  User, 
  Check, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  HardHat, 
  Home,
  CheckSquare,
  Sparkles
} from 'lucide-react';
import { 
  INSTALLATION_STEPS, 
  buildChantierStructure, 
  updateInstallationStep, 
  toggleAllInstallationSteps, 
  toggleArticleDelivery 
} from './installationUtils';

// Helper pour extraire le nom du client avec toutes les variantes de champs possibles
const getClientName = (order, clients = []) => {
  if (!order) return 'Client Inconnu';
  const cl = clients.find(c => c.id === order.clientId);
  return cl?.nom || cl?.name || order.clientName || order.clientNom || 'Client Inconnu';
};

export default function InstallationMobilePortal({ data, setData, orderId, isOnline, isSyncing }) {
  const urlParams = new URLSearchParams(window.location.search);
  const effectiveOrderId = orderId || urlParams.get('orderId');

  // État local du poseur (enregistré dans sessionStorage / localStorage)
  const [poseurName, setPoseurName] = useState(() => {
    return localStorage.getItem('calculDevis_poseurName') || 'Poseur';
  });
  const [isEditingPoseur, setIsEditingPoseur] = useState(false);
  const [tempPoseurName, setTempPoseurName] = useState(poseurName);

  // Filtre et recherche
  const [selectedOrderId, setSelectedOrderId] = useState(effectiveOrderId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('livre'); // 'livre' (par défaut pour poseur) | 'all' | 'pose'
  const [expandedFloors, setExpandedFloors] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  // Sauvegarder le nom du poseur
  const savePoseurName = () => {
    const trimmed = tempPoseurName.trim() || 'Poseur';
    setPoseurName(trimmed);
    localStorage.setItem('calculDevis_poseurName', trimmed);
    setIsEditingPoseur(false);
  };

  // Liste des commandes actives / en cours
  const orders = useMemo(() => {
    return (data?.orders || []).filter(o => {
      if (!o || o._deleted) return false;
      const status = (o.status || '').toLowerCase().trim();
      // Exclure les commandes annulées
      if (status === 'annulée' || status === 'annulee' || status === 'annulé' || status === 'annule') return false;
      // Exclure les commandes terminées / historiques / archivées
      if (status === 'terminé' || status === 'termine' || status.includes('historique') || status === 'archivé' || status === 'archive') return false;
      return true;
    });
  }, [data?.orders]);

  // Si aucun orderId dans l'URL ou si orderId n'est plus dans orders, sélectionner la première
  useEffect(() => {
    if (orders.length > 0) {
      if (!selectedOrderId || !orders.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(orders[0].id);
      }
    } else {
      setSelectedOrderId('');
    }
  }, [orders, selectedOrderId]);

  // Commande sélectionnée
  const order = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Client
  const client = useMemo(() => {
    if (!order) return null;
    return (data?.clients || []).find(c => c.id === order.clientId) || null;
  }, [data?.clients, order]);

  const clientName = useMemo(() => {
    return getClientName(order, data?.clients);
  }, [order, data?.clients]);

  // Structure du chantier
  const chantierData = useMemo(() => {
    if (!order) return { floors: [], stats: { total: 0, nonProduit: 0, enStock: 0, livre: 0, pose: 0, percentProgress: 0 } };
    return buildChantierStructure(order, data);
  }, [order, data]);

  // Déplier les étages par défaut
  useEffect(() => {
    if (chantierData.floors.length > 0) {
      const initial = {};
      chantierData.floors.forEach(f => {
        initial[f.id] = true;
      });
      setExpandedFloors(initial);
    }
  }, [chantierData.floors]);

  // Toast temporaire
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  // Toggle étage
  const toggleFloor = (floorId) => {
    setExpandedFloors(prev => ({
      ...prev,
      [floorId]: !prev[floorId]
    }));
  };

  // Action sur une étape
  const handleStepClick = (itemId, repere, stepId, stepLabel, currentDone) => {
    updateInstallationStep(setData, order.id, itemId, stepId, !currentDone, poseurName);
    showToast(`${repere} : ${stepLabel} ${!currentDone ? 'validé !' : 'annulé'}`);
  };

  // Action tout valider
  const handleToggleAll = (itemId, repere, targetDone) => {
    toggleAllInstallationSteps(setData, order.id, itemId, targetDone, poseurName);
    showToast(`${repere} : ${targetDone ? 'Toutes les étapes validées !' : 'Étapes remises à zéro'}`);
  };

  // Filtrage des articles pour l'affichage mobile
  const filteredFloors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return chantierData.floors.map(floor => {
      const filteredItems = floor.items.filter(item => {
        const matchText = !q || 
          item.repere.toLowerCase().includes(q) || 
          item.label.toLowerCase().includes(q) ||
          item.dimensions.toLowerCase().includes(q);

        if (!matchText) return false;

        if (filterMode === 'livre') return item.status === 'livre';
        if (filterMode === 'pose') return item.isFullyInstalled;
        return true;
      });

      return {
        ...floor,
        filteredItems
      };
    });
  }, [chantierData.floors, searchQuery, filterMode]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: '5rem',
      WebkitTapHighlightColor: 'transparent'
    }}>

      {/* ─── TOAST NOTIFICATION ──────────────────────────────────────────────── */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          background: '#10b981',
          color: '#fff',
          padding: '0.65rem 1.25rem',
          borderRadius: '25px',
          fontSize: '0.88rem',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'slideDown 0.25s ease'
        }}>
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      {/* ─── HEADER MOBILE STICKY ────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.75rem 1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)' }}>
              <HardHat size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                {order ? (order.number || order.id || 'Chantier') : 'Suivi Chantier'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                {clientName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Poseur Badge (Cliquable pour modifier) */}
            <button
              onClick={() => {
                setTempPoseurName(poseurName);
                setIsEditingPoseur(true);
              }}
              style={{
                background: '#e0f2fe',
                border: '1px solid #bae6fd',
                color: '#0284c7',
                borderRadius: '20px',
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
            >
              <User size={13} />
              <span>{poseurName}</span>
            </button>

            {/* Sync status */}
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isOnline ? '#10b981' : '#ef4444',
              boxShadow: isOnline ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'
            }} title={isOnline ? 'Connecté en direct' : 'Hors-ligne'} />
          </div>
        </div>

        {/* Sélecteur si plusieurs commandes */}
        {orders.length > 1 && !orderId && (
          <div style={{ marginTop: '0.5rem' }}>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.6rem',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none'
              }}
            >
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.number || o.id} — {getClientName(o, data?.clients)}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* ─── MODAL ÉDITION NOM DU POSEUR ─────────────────────────────────────── */}
      {isEditingPoseur && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          display: 'grid',
          placeItems: 'center',
          padding: '1rem'
        }}>
          <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '320px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: 700 }}>Votre Prénom / Nom</h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
              Ce nom apparaîtra sur l'historique de chaque étape validée.
            </p>
            <input
              type="text"
              value={tempPoseurName}
              onChange={(e) => setTempPoseurName(e.target.value)}
              placeholder="Ex: Karim, Yacine..."
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1.5px solid #0284c7',
                color: '#0f172a',
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: '1rem',
                outline: 'none'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={savePoseurName}
                style={{ flex: 1, padding: '0.65rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
              >
                Enregistrer
              </button>
              <button
                onClick={() => setIsEditingPoseur(false)}
                style={{ padding: '0.65rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BARRE DE PROGRESSION GLOBALE ────────────────────────────────────── */}
      <div style={{ padding: '0.85rem 1rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.78rem' }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Avancement Chantier</span>
          <span style={{ fontWeight: 800, color: chantierData.stats.percentProgress === 100 ? '#10b981' : '#0284c7' }}>
            {chantierData.stats.percentProgress}% ({chantierData.stats.pose}/{chantierData.stats.livre} livrés finis)
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{
            width: `${chantierData.stats.percentProgress}%`,
            height: '100%',
            background: chantierData.stats.percentProgress === 100 ? '#10b981' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* ─── FILTRES ET RECHERCHE RAPIDE ─────────────────────────────────────── */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        
        {/* Recherche */}
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher repère (ex: 1A1, 1A2...)"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem 0.6rem 2.2rem',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: '0.88rem',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          />
        </div>

        {/* Boutons filtres */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => setFilterMode('livre')}
            style={{
              flex: 1,
              padding: '0.5rem 0.2rem',
              borderRadius: '6px',
              background: filterMode === 'livre' ? '#0284c7' : '#ffffff',
              color: filterMode === 'livre' ? '#fff' : '#64748b',
              border: filterMode === 'livre' ? '1px solid #0284c7' : '1px solid #cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            À Poser ({chantierData.stats.livre})
          </button>
          <button
            onClick={() => setFilterMode('pose')}
            style={{
              flex: 1,
              padding: '0.5rem 0.2rem',
              borderRadius: '6px',
              background: filterMode === 'pose' ? '#9333ea' : '#ffffff',
              color: filterMode === 'pose' ? '#fff' : '#64748b',
              border: filterMode === 'pose' ? '1px solid #9333ea' : '1px solid #cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            Finis ({chantierData.stats.pose})
          </button>
          <button
            onClick={() => setFilterMode('all')}
            style={{
              flex: 1,
              padding: '0.5rem 0.2rem',
              borderRadius: '6px',
              background: filterMode === 'all' ? '#475569' : '#ffffff',
              color: filterMode === 'all' ? '#fff' : '#64748b',
              border: filterMode === 'all' ? '1px solid #475569' : '1px solid #cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            Tout ({chantierData.stats.total})
          </button>
        </div>
      </div>

      {/* ─── LISTE DES ÉTAGES & ARTICLES (MOBILE TOUCH OPTIMIZED) ─────────────── */}
      <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredFloors.map(floor => {
          const isExpanded = !!expandedFloors[floor.id];
          const hasItems = floor.filteredItems.length > 0;

          return (
            <div
              key={floor.id}
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              {/* EN-TÊTE ÉTAGE ACCORDÉON */}
              <div
                onClick={() => toggleFloor(floor.id)}
                style={{
                  padding: '0.85rem 1rem',
                  background: isExpanded ? '#f8fafc' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ color: '#0284c7', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <ChevronRight size={18} />
                  </div>
                  <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                    {floor.displayName}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#475569', background: '#f1f5f9', padding: '0.1rem 0.45rem', borderRadius: '10px', fontWeight: 600 }}>
                    {floor.filteredItems.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: floor.stats.percent === 100 ? '#10b981' : '#0284c7' }}>
                    {floor.stats.percent}%
                  </span>
                </div>
              </div>

              {/* CONTENU ÉTAGE */}
              {isExpanded && (
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!hasItems ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                      Aucune ouverture à afficher pour cet étage.
                    </div>
                  ) : (
                    floor.filteredItems.map(item => {
                      const isDelivered = item.status === 'livre';

                      return (
                        <div
                          key={item.id}
                          style={{
                            background: isDelivered ? '#f8fafc' : '#ffffff',
                            borderRadius: '10px',
                            border: isDelivered 
                              ? (item.isFullyInstalled ? '1.5px solid #86efac' : '1px solid #cbd5e1') 
                              : '1px dashed #cbd5e1',
                            padding: '0.85rem',
                            boxShadow: isDelivered ? '0 1px 3px rgba(0,0,0,0.02)' : 'none'
                          }}
                        >
                          {/* LIGNE 1 : REPÈRE + DÉTAILS + TOUT VALIDER */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '1.05rem',
                                fontWeight: 900,
                                color: '#fff',
                                background: isDelivered ? '#0284c7' : '#94a3b8',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                letterSpacing: '0.5px'
                              }}>
                                {item.repere}
                              </span>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                  {item.label}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {item.dimensions} {item.isSliding ? '• Coulissant' : ''}
                                </div>
                              </div>
                            </div>

                            {/* Statut ou Tout Valider */}
                            <div>
                              {isDelivered ? (
                                <button
                                  onClick={() => handleToggleAll(item.id, item.repere, !item.isFullyInstalled)}
                                  style={{
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '6px',
                                    background: item.isFullyInstalled ? '#fef2f2' : '#ecfdf5',
                                    color: item.isFullyInstalled ? '#dc2626' : '#059669',
                                    border: item.isFullyInstalled ? '1px solid #fecaca' : '1px solid #a7f3d0',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {item.isFullyInstalled ? 'Annuler' : 'Tout validé'}
                                </button>
                              ) : (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: item.status === 'en_stock' ? '#2563eb' : '#dc2626',
                                  background: item.status === 'en_stock' ? '#eff6ff' : '#fef2f2',
                                  border: item.status === 'en_stock' ? '1px solid #bfdbfe' : '1px solid #fecaca',
                                  padding: '0.2rem 0.45rem',
                                  borderRadius: '4px'
                                }}>
                                  {item.status === 'en_stock' ? 'En stock' : 'Non produit'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* LIGNE 2 : LES 6 TOUCHES D'ÉTAPES TACTILES */}
                          {isDelivered ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem' }}>
                              {INSTALLATION_STEPS.map(step => {
                                const stepState = item.steps[step.id];
                                const isDone = !!stepState?.done;

                                // Titre adapté pour coulissant
                                const stepTitle = (item.isSliding && step.id === 'pose_vitrage')
                                  ? step.labelSliding
                                  : step.label;

                                return (
                                  <button
                                    key={step.id}
                                    onClick={() => handleStepClick(item.id, item.repere, step.id, stepTitle, isDone)}
                                    style={{
                                      minHeight: '44px',
                                      padding: '0.5rem 0.6rem',
                                      borderRadius: '8px',
                                      background: isDone ? '#10b981' : '#ffffff',
                                      color: isDone ? '#fff' : '#334155',
                                      border: isDone ? '1px solid #059669' : '1px solid #cbd5e1',
                                      fontSize: '0.8rem',
                                      fontWeight: isDone ? 800 : 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      textAlign: 'left',
                                      boxShadow: isDone ? '0 1px 3px rgba(16, 185, 129, 0.2)' : '0 1px 2px rgba(0,0,0,0.02)'
                                    }}
                                  >
                                    <span style={{ lineHeight: 1.2 }}>{stepTitle}</span>
                                    {isDone ? (
                                      <CheckCircle2 size={16} color="#fff" />
                                    ) : (
                                      <Circle size={15} color="#94a3b8" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{
                              padding: '0.65rem',
                              background: '#fef2f2',
                              borderRadius: '6px',
                              border: '1px dashed #fecaca',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem'
                            }}>
                              <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>
                                Non encore livré sur le chantier
                              </span>
                              <button
                                onClick={() => {
                                  toggleArticleDelivery(setData, order.id, item.id, false, poseurName);
                                  showToast(`${item.repere} marqué comme livré sur chantier !`);
                                }}
                                style={{
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '5px',
                                  background: '#0284c7',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Reçu sur chantier
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
