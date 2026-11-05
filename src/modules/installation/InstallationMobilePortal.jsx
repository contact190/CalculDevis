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

  // Liste des commandes actives
  const orders = useMemo(() => {
    return (data?.orders || []).filter(o => !o._deleted && o.status !== 'Annulée');
  }, [data?.orders]);

  // Si aucun orderId dans l'URL, sélectionner la première
  useEffect(() => {
    if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
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
      background: '#090d16',
      color: '#f8fafc',
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
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
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
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #334155',
        padding: '0.75rem 1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'grid', placeItems: 'center' }}>
              <HardHat size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {order ? (order.number || 'Chantier') : 'Suivi Chantier'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                {client?.name || order?.clientName || 'Client'}
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
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
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
              boxShadow: isOnline ? '0 0 8px #10b981' : 'none'
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
                background: '#090d16',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.number} — {(data?.clients || []).find(c => c.id === o.clientId)?.name || 'Client'}
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
          background: 'rgba(0,0,0,0.8)',
          zIndex: 2000,
          display: 'grid',
          placeItems: 'center',
          padding: '1rem'
        }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '320px', border: '1px solid #475569' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>Votre Prénom / Nom</h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#94a3b8' }}>
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
                background: '#0f172a',
                border: '1px solid #38bdf8',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={savePoseurName}
                style={{ flex: 1, padding: '0.65rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700 }}
              >
                Enregistrer
              </button>
              <button
                onClick={() => setIsEditingPoseur(false)}
                style={{ padding: '0.65rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px' }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BARRE DE PROGRESSION GLOBALE ────────────────────────────────────── */}
      <div style={{ padding: '0.85rem 1rem', background: '#131d2e', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.78rem' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Avancement Chantier</span>
          <span style={{ fontWeight: 800, color: chantierData.stats.percentProgress === 100 ? '#10b981' : '#38bdf8' }}>
            {chantierData.stats.percentProgress}% ({chantierData.stats.pose}/{chantierData.stats.livre} livrés finis)
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#090d16', borderRadius: '4px', overflow: 'hidden' }}>
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
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher repère (ex: 1A1, 1A2...)"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem 0.6rem 2.2rem',
              borderRadius: '8px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#fff',
              fontSize: '0.88rem'
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
              background: filterMode === 'livre' ? '#0284c7' : '#1e293b',
              color: filterMode === 'livre' ? '#fff' : '#94a3b8',
              border: filterMode === 'livre' ? '1px solid #0284c7' : '1px solid #334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
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
              background: filterMode === 'pose' ? '#a855f7' : '#1e293b',
              color: filterMode === 'pose' ? '#fff' : '#94a3b8',
              border: filterMode === 'pose' ? '1px solid #a855f7' : '1px solid #334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
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
              background: filterMode === 'all' ? '#475569' : '#1e293b',
              color: filterMode === 'all' ? '#fff' : '#94a3b8',
              border: filterMode === 'all' ? '1px solid #475569' : '1px solid #334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
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
                background: '#131d2e',
                borderRadius: '12px',
                border: '1px solid #1e293b',
                overflow: 'hidden'
              }}
            >
              {/* EN-TÊTE ÉTAGE ACCORDÉON */}
              <div
                onClick={() => toggleFloor(floor.id)}
                style={{
                  padding: '0.85rem 1rem',
                  background: isExpanded ? '#1a2638' : '#131d2e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: isExpanded ? '1px solid #1e293b' : 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ color: '#38bdf8', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <ChevronRight size={18} />
                  </div>
                  <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#fff' }}>
                    {floor.displayName}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#090d16', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                    {floor.filteredItems.length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: floor.stats.percent === 100 ? '#10b981' : '#38bdf8' }}>
                    {floor.stats.percent}%
                  </span>
                </div>
              </div>

              {/* CONTENU ÉTAGE */}
              {isExpanded && (
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!hasItems ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                      Aucune ouverture à afficher pour cet étage.
                    </div>
                  ) : (
                    floor.filteredItems.map(item => {
                      const isDelivered = item.status === 'livre';

                      return (
                        <div
                          key={item.id}
                          style={{
                            background: isDelivered ? '#090d16' : 'rgba(9, 13, 22, 0.4)',
                            borderRadius: '10px',
                            border: isDelivered 
                              ? (item.isFullyInstalled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #334155') 
                              : '1px dashed #334155',
                            padding: '0.85rem'
                          }}
                        >
                          {/* LIGNE 1 : REPÈRE + DÉTAILS + TOUT VALIDER */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '1.1rem',
                                fontWeight: 900,
                                color: '#fff',
                                background: isDelivered ? '#0284c7' : '#334155',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                letterSpacing: '0.5px'
                              }}>
                                {item.repere}
                              </span>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
                                  {item.label}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
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
                                    background: item.isFullyInstalled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                    color: item.isFullyInstalled ? '#fca5a5' : '#6ee7b7',
                                    border: item.isFullyInstalled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.35)',
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
                                  color: item.status === 'en_stock' ? '#60a5fa' : '#f87171',
                                  background: item.status === 'en_stock' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
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
                                      background: isDone ? '#10b981' : '#1e293b',
                                      color: isDone ? '#fff' : '#cbd5e1',
                                      border: isDone ? '1px solid #10b981' : '1px solid #334155',
                                      fontSize: '0.8rem',
                                      fontWeight: isDone ? 800 : 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <span style={{ lineHeight: 1.2 }}>{stepTitle}</span>
                                    {isDone ? (
                                      <CheckCircle2 size={16} color="#fff" />
                                    ) : (
                                      <Circle size={15} color="#64748b" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{
                              padding: '0.65rem',
                              background: 'rgba(239, 68, 68, 0.05)',
                              borderRadius: '6px',
                              border: '1px dashed rgba(239, 68, 68, 0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem'
                            }}>
                              <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
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

