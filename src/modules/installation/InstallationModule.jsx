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
  QrCode, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Smartphone, 
  Sparkles, 
  Clock, 
  User, 
  RotateCcw,
  AlertCircle,
  HelpCircle,
  HardHat
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  INSTALLATION_STEPS, 
  buildChantierStructure, 
  updateInstallationStep, 
  toggleAllInstallationSteps, 
  toggleArticleDelivery 
} from './installationUtils';

export default function InstallationModule({ data, setData, quoteSettings }) {
  // Sélection de la commande / chantier
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'livre' | 'en_stock' | 'non_produit' | 'pose'
  
  // États de pliage/dépliage des étages
  const [expandedFloors, setExpandedFloors] = useState({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showMobilePreviewModal, setShowMobilePreviewModal] = useState(false);

  // Liste des commandes avec chantiers
  const orders = useMemo(() => {
    return (data?.orders || []).filter(o => !o._deleted && o.status !== 'Annulée');
  }, [data?.orders]);

  // Sélectionne par défaut la première commande ou celle en cours
  useEffect(() => {
    if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  // Commande actuellement sélectionnée
  const currentOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Client de la commande
  const currentClient = useMemo(() => {
    if (!currentOrder) return null;
    return (data?.clients || []).find(c => c.id === currentOrder.clientId) || null;
  }, [data?.clients, currentOrder]);

  // Structure complète du chantier calculée dynamiquement
  const chantierData = useMemo(() => {
    if (!currentOrder) return { floors: [], stats: { total: 0, nonProduit: 0, enStock: 0, livre: 0, pose: 0, percentProgress: 0 } };
    return buildChantierStructure(currentOrder, data);
  }, [currentOrder, data]);

  // Par défaut, déplier tous les étages au chargement d'un nouveau chantier
  useEffect(() => {
    if (chantierData.floors.length > 0) {
      const initial = {};
      chantierData.floors.forEach(f => {
        initial[f.id] = true;
      });
      setExpandedFloors(initial);
    }
  }, [chantierData.floors]);

  // URL du portail mobile poseur
  const mobilePortalUrl = useMemo(() => {
    if (!currentOrder) return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?mode=installation&orderId=${currentOrder.id}`;
  }, [currentOrder]);

  // Copier le lien mobile
  const handleCopyMobileLink = () => {
    if (!mobilePortalUrl) return;
    navigator.clipboard.writeText(mobilePortalUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Basculer l'état déplié d'un étage
  const toggleFloor = (floorId) => {
    setExpandedFloors(prev => ({
      ...prev,
      [floorId]: !prev[floorId]
    }));
  };

  // Déplier / Replier tout
  const toggleAllFloors = (shouldExpand) => {
    const updated = {};
    chantierData.floors.forEach(f => {
      updated[f.id] = shouldExpand;
    });
    setExpandedFloors(updated);
  };

  // Filtrage des articles par recherche et statut
  const filteredFloors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return chantierData.floors.map(floor => {
      const filteredItems = floor.items.filter(item => {
        // Filtre texte (ref, label, dim)
        const matchText = !q || 
          item.repere.toLowerCase().includes(q) || 
          item.label.toLowerCase().includes(q) ||
          item.dimensions.toLowerCase().includes(q);

        if (!matchText) return false;

        // Filtre statut
        if (statusFilter === 'all') return true;
        if (statusFilter === 'pose') return item.isFullyInstalled;
        if (statusFilter === 'livre') return item.status === 'livre';
        if (statusFilter === 'en_stock') return item.status === 'en_stock';
        if (statusFilter === 'non_produit') return item.status === 'non_produit';
        return true;
      });

      return {
        ...floor,
        filteredItems
      };
    });
  }, [chantierData.floors, searchQuery, statusFilter]);

  return (
    <div className="installation-module" style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', color: '#f8fafc' }}>
      
      {/* ─── HEADER DU MODULE ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', background: '#1e293b', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #334155' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fff' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}>
              <HardHat size={22} color="#fff" />
            </div>
            Suivi de Pose Chantier
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Gestion de l'avancement de pose par étage, repères (1A1, 1A2...) et interface mobile en temps réel
          </p>
        </div>

        {/* Sélecteur de commande / chantier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '320px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
              CHANTIER / COMMANDE
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.9rem',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid #475569',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {orders.length === 0 && <option value="">Aucune commande active</option>}
              {orders.map(o => {
                const cl = (data?.clients || []).find(c => c.id === o.clientId);
                return (
                  <option key={o.id} value={o.id}>
                    {o.number || 'CMD'} — {cl?.name || o.clientName || 'Client'} {o.siteName ? `(${o.siteName})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* ─── BANDEAU INTERFACE MOBILE & STATS EN TEMPS RÉEL ───────────────────── */}
      {currentOrder && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          
          {/* CARTE LIEN MOBILE POSEUR */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.25), rgba(3, 105, 161, 0.15))', 
            padding: '1.25rem', 
            borderRadius: '12px', 
            border: '1px solid rgba(14, 165, 233, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Smartphone size={15} /> Interface Mobile Poseur
                </span>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  Temps Réel
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                Partagez ce lien avec l'équipe de pose sur le chantier. Chaque validation met à jour cet écran instantanément.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                onClick={handleCopyMobileLink}
                className="btn"
                style={{
                  flex: '1 1 auto',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '7px',
                  background: copiedLink ? '#10b981' : '#0284c7',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                {copiedLink ? 'Lien copié !' : 'Copier le lien mobile'}
              </button>

              <button
                onClick={() => setShowQrModal(true)}
                className="btn"
                style={{
                  padding: '0.55rem 0.8rem',
                  borderRadius: '7px',
                  background: '#0f172a',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer'
                }}
                title="Afficher le QR code pour smartphone"
              >
                <QrCode size={16} /> QR Code
              </button>

              <a
                href={mobilePortalUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '0.55rem 0.8rem',
                  borderRadius: '7px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none'
                }}
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink size={15} /> Ouvrir
              </a>
            </div>
          </div>

          {/* CARTE AVANCEMENT GLOBAL DE LA POSE */}
          <div style={{ 
            background: '#1e293b', 
            padding: '1.25rem', 
            borderRadius: '12px', 
            border: '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8' }}>
                  Avancement Global de Pose
                </span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: chantierData.stats.percentProgress === 100 ? '#10b981' : '#38bdf8' }}>
                  {chantierData.stats.percentProgress}%
                </span>
              </div>

              {/* Barre de progression */}
              <div style={{ width: '100%', height: '10px', background: '#0f172a', borderRadius: '5px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #334155' }}>
                <div style={{ 
                  width: `${chantierData.stats.percentProgress}%`, 
                  height: '100%', 
                  background: chantierData.stats.percentProgress === 100 
                    ? 'linear-gradient(90deg, #10b981, #059669)' 
                    : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: '5px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>

            {/* Statistiques clés (Chantier, Non produit, En stock, Livré, Posé) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem', textAlign: 'center' }}>
              <div style={{ background: '#0f172a', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{chantierData.stats.total}</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>Total</div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>{chantierData.stats.nonProduit}</div>
                <div style={{ fontSize: '0.65rem', color: '#fca5a5', fontWeight: 600 }}>Non produit</div>
              </div>
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa' }}>{chantierData.stats.enStock}</div>
                <div style={{ fontSize: '0.65rem', color: '#93c5fd', fontWeight: 600 }}>En stock</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>{chantierData.stats.livre}</div>
                <div style={{ fontSize: '0.65rem', color: '#6ee7b7', fontWeight: 600 }}>Livrés</div>
              </div>
              <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc' }}>{chantierData.stats.pose}</div>
                <div style={{ fontSize: '0.65rem', color: '#d8b4fe', fontWeight: 600 }}>Finis 100%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── FILTRES ET ACTIONS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
        
        {/* Recherche par repère (ex: 1A1, 1A2...) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '1 1 280px', maxWidth: '400px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par repère (ex: 1A1, 1A2...), dimension..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Boutons de filtres statut */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
          {[
            { id: 'all', label: 'Tous', count: chantierData.stats.total },
            { id: 'livre', label: 'Livrés (À poser)', count: chantierData.stats.livre, color: '#10b981' },
            { id: 'en_stock', label: 'En stock', count: chantierData.stats.enStock, color: '#3b82f6' },
            { id: 'non_produit', label: 'Non produit', count: chantierData.stats.nonProduit, color: '#f87171' },
            { id: 'pose', label: 'Pose terminée', count: chantierData.stats.pose, color: '#c084fc' }
          ].map(f => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  background: active ? '#0284c7' : '#1e293b',
                  color: active ? '#fff' : '#94a3b8',
                  border: active ? '1px solid #0284c7' : '1px solid #334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>{f.label}</span>
                <span style={{ 
                  background: active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)', 
                  padding: '0.1rem 0.4rem', 
                  borderRadius: '10px', 
                  fontSize: '0.7rem' 
                }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Boutons Déplier / Replier tout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => toggleAllFloors(true)}
            style={{
              padding: '0.4rem 0.7rem',
              borderRadius: '6px',
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Tout déplier
          </button>
          <button
            onClick={() => toggleAllFloors(false)}
            style={{
              padding: '0.4rem 0.7rem',
              borderRadius: '6px',
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Tout replier
          </button>
        </div>
      </div>

      {/* ─── LISTE DES ÉTAGES ET REPERES (ACCORDÉONS) ────────────────────────── */}
      {chantierData.floors.length === 0 ? (
        <div style={{ background: '#1e293b', padding: '3rem', borderRadius: '12px', textAlign: 'center', border: '1px dashed #475569' }}>
          <Building size={48} color="#64748b" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>Aucune ouverture trouvée pour ce chantier</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Vérifiez que la commande contient des articles ou un plan de chantier avec des repères.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredFloors.map(floor => {
            const isExpanded = !!expandedFloors[floor.id];
            const hasItems = floor.filteredItems.length > 0;

            return (
              <div 
                key={floor.id} 
                style={{ 
                  background: '#1e293b', 
                  borderRadius: '12px', 
                  border: '1px solid #334155', 
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
              >
                {/* EN-TÊTE ÉTAGE (PLIABLE / DÉPLIABLE) */}
                <div 
                  onClick={() => toggleFloor(floor.id)}
                  style={{
                    padding: '1rem 1.25rem',
                    background: isExpanded ? '#1e293b' : '#182234',
                    borderBottom: isExpanded ? '1px solid #334155' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ color: '#38bdf8', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <ChevronRight size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building size={18} color="#0284c7" />
                        {floor.displayName}
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', background: '#0f172a', padding: '0.15rem 0.5rem', borderRadius: '12px', border: '1px solid #334155' }}>
                          {floor.items.length} ouverture{floor.items.length > 1 ? 's' : ''}
                        </span>
                      </h3>
                    </div>
                  </div>

                  {/* Résumé de l'étage */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#6ee7b7', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        {floor.stats.delivered} livré{floor.stats.delivered > 1 ? 's' : ''}
                      </span>
                      <span style={{ color: '#c084fc', background: 'rgba(168, 85, 247, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                        {floor.stats.pose} posé{floor.stats.pose > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div style={{ width: '100px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ flex: 1, height: '6px', background: '#0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${floor.stats.percent}%`, height: '100%', background: floor.stats.percent === 100 ? '#10b981' : '#0284c7' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', minWidth: '32px', textAlign: 'right' }}>
                        {floor.stats.percent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* CORPS DE L'ÉTAGE : LISTE DES ARTICLES */}
                {isExpanded && (
                  <div style={{ padding: '0.75rem 1.25rem 1.25rem 1.25rem' }}>
                    {!hasItems ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                        Aucun article ne correspond aux filtres pour cet étage.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {floor.filteredItems.map(item => {
                          const isDelivered = item.status === 'livre';

                          return (
                            <div
                              key={item.id}
                              style={{
                                background: isDelivered ? '#0f172a' : 'rgba(15, 23, 42, 0.6)',
                                border: isDelivered ? (item.isFullyInstalled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #334155') : '1px dashed #334155',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                display: 'grid',
                                gridTemplateColumns: '110px minmax(200px, 1.2fr) 130px minmax(400px, 3fr) 110px',
                                alignItems: 'center',
                                gap: '1rem'
                              }}
                            >
                              {/* 1. REPÈRE (ex: 1A1, 1A2...) */}
                              <div>
                                <span style={{
                                  display: 'inline-block',
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  color: '#fff',
                                  background: isDelivered ? '#0284c7' : '#334155',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  letterSpacing: '0.5px'
                                }}>
                                  {item.repere}
                                </span>
                              </div>

                              {/* 2. DÉSIGNATION & DIMENSIONS */}
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.label}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                                  <span>{item.dimensions}</span>
                                  {item.isSliding && (
                                    <span style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.05rem 0.35rem', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 600 }}>
                                      Coulissant
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 3. STATUT PRINCIPAL (Non produit / En stock / Livré) */}
                              <div>
                                {item.status === 'livre' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '0.3rem', 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700, 
                                      color: '#34d399', 
                                      background: 'rgba(16, 185, 129, 0.12)', 
                                      padding: '0.25rem 0.55rem', 
                                      borderRadius: '6px',
                                      border: '1px solid rgba(16, 185, 129, 0.3)'
                                    }}>
                                      <CheckCircle2 size={13} /> Livré Chantier
                                    </span>
                                    <button
                                      onClick={() => toggleArticleDelivery(setData, currentOrder.id, item.id, true)}
                                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.65rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                      title="Remettre en stock atelier"
                                    >
                                      Annuler livraison
                                    </button>
                                  </div>
                                ) : item.status === 'en_stock' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '0.3rem', 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700, 
                                      color: '#60a5fa', 
                                      background: 'rgba(59, 130, 246, 0.12)', 
                                      padding: '0.25rem 0.55rem', 
                                      borderRadius: '6px',
                                      border: '1px solid rgba(59, 130, 246, 0.3)'
                                    }}>
                                      <Package size={13} /> En stock
                                    </span>
                                    <button
                                      onClick={() => toggleArticleDelivery(setData, currentOrder.id, item.id, false)}
                                      style={{ 
                                        background: 'rgba(16, 185, 129, 0.15)', 
                                        border: '1px solid rgba(16, 185, 129, 0.35)', 
                                        color: '#6ee7b7', 
                                        fontSize: '0.68rem', 
                                        fontWeight: 600,
                                        cursor: 'pointer', 
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '4px'
                                      }}
                                    >
                                      Marquer livré
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <span style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '0.3rem', 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700, 
                                      color: '#f87171', 
                                      background: 'rgba(239, 68, 68, 0.1)', 
                                      padding: '0.25rem 0.55rem', 
                                      borderRadius: '6px',
                                      border: '1px solid rgba(239, 68, 68, 0.25)'
                                    }}>
                                      <Clock size={13} /> Non produit
                                    </span>
                                    <button
                                      onClick={() => toggleArticleDelivery(setData, currentOrder.id, item.id, false)}
                                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.65rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                    >
                                      Forcer livraison
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* 4. LES 6 ÉTAPES DE POSE EN TEMPS RÉEL (Pour les articles livrés) */}
                              <div>
                                {isDelivered ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {INSTALLATION_STEPS.map(step => {
                                      const stepState = item.steps[step.id];
                                      const isDone = !!stepState?.done;
                                      
                                      // Remplissage vitrage pour coulissant
                                      const stepTitle = (item.isSliding && step.id === 'pose_vitrage')
                                        ? step.labelSliding
                                        : step.label;

                                      return (
                                        <button
                                          key={step.id}
                                          onClick={() => updateInstallationStep(setData, currentOrder.id, item.id, step.id, !isDone)}
                                          title={`${stepTitle} : ${isDone ? `Validé le ${new Date(stepState.at).toLocaleDateString()} (${stepState.by || 'Poseur'})` : 'Cliquer pour valider'}`}
                                          style={{
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '6px',
                                            background: isDone ? '#10b981' : '#1e293b',
                                            color: isDone ? '#fff' : '#94a3b8',
                                            border: isDone ? '1px solid #10b981' : '1px solid #334155',
                                            fontSize: '0.74rem',
                                            fontWeight: isDone ? 700 : 500,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            transition: 'all 0.15s'
                                          }}
                                        >
                                          {isDone ? <Check size={12} strokeWidth={3} /> : <Circle size={12} />}
                                          <span>{stepTitle}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <AlertCircle size={14} />
                                    En attente de livraison sur chantier pour démarrer le suivi de pose
                                  </div>
                                )}
                              </div>

                              {/* 5. ACTION TOUT VALIDER / PROGRESSION */}
                              <div style={{ textAlign: 'right' }}>
                                {isDelivered && (
                                  <div>
                                    <button
                                      onClick={() => toggleAllInstallationSteps(setData, currentOrder.id, item.id, !item.isFullyInstalled)}
                                      style={{
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '5px',
                                        background: item.isFullyInstalled ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.15)',
                                        color: item.isFullyInstalled ? '#fca5a5' : '#6ee7b7',
                                        border: item.isFullyInstalled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.35)',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {item.isFullyInstalled ? 'Décocher tout' : 'Tout valider'}
                                    </button>
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                      {item.completedStepsCount} / {item.totalStepsCount} étapes
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL QR CODE CHANTIER ─────────────────────────────────────────── */}
      {showQrModal && currentOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#fff' }}>
              Scanner pour ouvrir sur Mobile
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Pointez l'appareil photo d'un smartphone sur ce QR Code pour accéder immédiatement à l'interface de pose du chantier :
              <br />
              <strong style={{ color: '#38bdf8' }}>{currentOrder.number} — {currentClient?.name || 'Client'}</strong>
            </p>

            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginBottom: '1.5rem' }}>
              <QRCodeSVG value={mobilePortalUrl} size={220} level="M" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleCopyMobileLink}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '8px',
                  background: copiedLink ? '#10b981' : '#0284c7',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {copiedLink ? 'Lien copié !' : 'Copier le lien direct'}
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: '#334155',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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

