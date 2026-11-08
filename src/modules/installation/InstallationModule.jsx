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

// Helper pour extraire le nom du client avec toutes les variantes de champs possibles
const getClientName = (order, clients = []) => {
  if (!order) return 'Client Inconnu';
  const cl = clients.find(c => c.id === order.clientId);
  return cl?.nom || cl?.name || order.clientName || order.clientNom || 'Client Inconnu';
};

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

  // Liste des commandes avec chantiers : UNIQUEMENT LES COMMANDES EN COURS
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

  // Sélectionne par défaut la première commande ou celle en cours
  useEffect(() => {
    if (orders.length > 0) {
      if (!selectedOrderId || !orders.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(orders[0].id);
      }
    } else {
      setSelectedOrderId('');
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

  const currentClientName = useMemo(() => {
    return getClientName(currentOrder, data?.clients);
  }, [currentOrder, data?.clients]);

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
    <div className="installation-module" style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', color: '#1e293b' }}>
      
      {/* ─── HEADER DU MODULE ─────────────────────────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '1rem', 
        marginBottom: '1.5rem', 
        background: '#ffffff', 
        padding: '1.25rem 1.5rem', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}>
              <HardHat size={22} color="#fff" />
            </div>
            Suivi de Pose Chantier
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Gestion de l'avancement de pose par étage, repères (1A1, 1A2...) et interface mobile en temps réel
          </p>
        </div>

        {/* Sélecteur de commande / chantier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '320px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', letterSpacing: '0.5px' }}>
              CHANTIER / COMMANDE EN COURS
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#0f172a',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              {orders.length === 0 && <option value="">Aucune commande en cours</option>}
              {orders.map(o => {
                const clientNom = getClientName(o, data?.clients);
                return (
                  <option key={o.id} value={o.id}>
                    {o.number || o.id || 'CMD'} — {clientNom} {o.siteName ? `(${o.siteName})` : ''}
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
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
            padding: '1.25rem', 
            borderRadius: '12px', 
            border: '1px solid #bae6fd',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Smartphone size={15} /> Interface Mobile Poseur
                </span>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', fontWeight: 600 }}>
                  Temps Réel
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', lineHeight: '1.4' }}>
                Partagez ce lien avec l'équipe de pose sur le chantier. Chaque validation met à jour cet écran instantanément.
              </p>
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#0369a1' }}>
                Client : <span style={{ color: '#0f172a', fontWeight: 700 }}>{currentClientName}</span>
              </div>
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
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
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
                  background: '#ffffff',
                  color: '#0284c7',
                  border: '1px solid #bae6fd',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink size={15} /> Ouvrir
              </a>
            </div>
          </div>

          {/* CARTE AVANCEMENT GLOBAL DE LA POSE */}
          <div style={{ 
            background: '#ffffff', 
            padding: '1.25rem', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                  Avancement Global de Pose
                </span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: chantierData.stats.percentProgress === 100 ? '#10b981' : '#0284c7' }}>
                  {chantierData.stats.percentProgress}%
                </span>
              </div>

              {/* Barre de progression */}
              <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
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
              <div style={{ background: '#f8fafc', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{chantierData.stats.total}</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Total</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>{chantierData.stats.nonProduit}</div>
                <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>Non produit</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb' }}>{chantierData.stats.enStock}</div>
                <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 600 }}>En stock</div>
              </div>
              <div style={{ background: '#ecfdf5', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{chantierData.stats.livre}</div>
                <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600 }}>Livrés</div>
              </div>
              <div style={{ background: '#faf5ff', padding: '0.5rem 0.2rem', borderRadius: '6px', border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9333ea' }}>{chantierData.stats.pose}</div>
                <div style={{ fontSize: '0.65rem', color: '#a855f7', fontWeight: 600 }}>Finis 100%</div>
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
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: '0.85rem',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
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
            { id: 'non_produit', label: 'Non produit', count: chantierData.stats.nonProduit, color: '#ef4444' },
            { id: 'pose', label: 'Pose terminée', count: chantierData.stats.pose, color: '#9333ea' }
          ].map(f => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  background: active ? '#0284c7' : '#ffffff',
                  color: active ? '#fff' : '#64748b',
                  border: active ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s'
                }}
              >
                <span>{f.label}</span>
                <span style={{ 
                  background: active ? 'rgba(255,255,255,0.25)' : '#f1f5f9', 
                  color: active ? '#ffffff' : '#64748b',
                  padding: '0.1rem 0.4rem', 
                  borderRadius: '10px', 
                  fontSize: '0.7rem',
                  fontWeight: 700 
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
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            Tout déplier
          </button>
          <button
            onClick={() => toggleAllFloors(false)}
            style={{
              padding: '0.4rem 0.7rem',
              borderRadius: '6px',
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            Tout replier
          </button>
        </div>
      </div>

      {/* ─── LISTE DES ÉTAGES ET REPERES (ACCORDÉONS) ────────────────────────── */}
      {chantierData.floors.length === 0 ? (
        <div style={{ background: '#ffffff', padding: '3rem', borderRadius: '12px', textAlign: 'center', border: '1.5px dashed #cbd5e1' }}>
          <Building size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Aucune ouverture trouvée pour ce chantier</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
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
                  background: '#ffffff', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0', 
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                }}
              >
                {/* EN-TÊTE ÉTAGE (PLIABLE / DÉPLIABLE) */}
                <div 
                  onClick={() => toggleFloor(floor.id)}
                  style={{
                    padding: '1rem 1.25rem',
                    background: isExpanded ? '#f8fafc' : '#ffffff',
                    borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ color: '#0284c7', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <ChevronRight size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building size={18} color="#0284c7" />
                        {floor.displayName}
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          {floor.items.length} ouverture{floor.items.length > 1 ? 's' : ''}
                        </span>
                      </h3>
                    </div>
                  </div>

                  {/* Résumé de l'étage */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#059669', background: '#ecfdf5', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #a7f3d0', fontWeight: 600 }}>
                        {floor.stats.delivered} livré{floor.stats.delivered > 1 ? 's' : ''}
                      </span>
                      <span style={{ color: '#9333ea', background: '#faf5ff', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #e9d5ff', fontWeight: 600 }}>
                        {floor.stats.pose} posé{floor.stats.pose > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div style={{ width: '100px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${floor.stats.percent}%`, height: '100%', background: floor.stats.percent === 100 ? '#10b981' : '#0284c7' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', minWidth: '32px', textAlign: 'right' }}>
                        {floor.stats.percent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* CORPS DE L'ÉTAGE : LISTE DES ARTICLES */}
                {isExpanded && (
                  <div style={{ padding: '0.75rem 1.25rem 1.25rem 1.25rem' }}>
                    {!hasItems ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
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
                                background: isDelivered ? '#f8fafc' : '#ffffff',
                                border: isDelivered ? (item.isFullyInstalled ? '1.5px solid #86efac' : '1px solid #cbd5e1') : '1px dashed #cbd5e1',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                display: 'grid',
                                gridTemplateColumns: '110px minmax(200px, 1.2fr) 130px minmax(400px, 3fr) 110px',
                                alignItems: 'center',
                                gap: '1rem',
                                boxShadow: isDelivered ? '0 1px 3px rgba(0,0,0,0.03)' : 'none'
                              }}
                            >
                              {/* 1. REPÈRE (ex: 1A1, 1A2...) */}
                              <div>
                                <span style={{
                                  display: 'inline-block',
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  color: '#fff',
                                  background: isDelivered ? '#0284c7' : '#94a3b8',
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '6px',
                                  letterSpacing: '0.5px'
                                }}>
                                  {item.repere}
                                </span>
                              </div>

                              {/* 2. DÉSIGNATION & DIMENSIONS */}
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.label}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                                  <span>{item.dimensions}</span>
                                  {item.isSliding && (
                                    <span style={{ color: '#0284c7', background: '#e0f2fe', padding: '0.05rem 0.35rem', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 600 }}>
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
                                      color: '#059669', 
                                      background: '#ecfdf5', 
                                      padding: '0.25rem 0.55rem', 
                                      borderRadius: '6px', 
                                      border: '1px solid #a7f3d0' 
                                    }}>
                                      <CheckCircle2 size={13} /> Livré Chantier
                                    </span>
                                    <button
                                      onClick={() => toggleArticleDelivery(setData, currentOrder.id, item.id, true)}
                                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.65rem', cursor: 'pointer', textAlign: 'left', padding: 0, textDecoration: 'underline' }}
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
                                      color: '#2563eb', 
                                      background: '#eff6ff', 
                                      padding: '0.25rem 0.55rem', 
                                      borderRadius: '6px', 
                                      border: '1px solid #bfdbfe' 
                                    }}>
                                      <Package size={13} /> En stock
                                    </span>
                                    <button
                                      onClick={() => toggleArticleDelivery(setData, currentOrder.id, item.id, false)}
                                      style={{ 
                                        background: '#ecfdf5', 
                                        border: '1px solid #a7f3d0', 
                                        color: '#059669', 
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
                                      color: '#dc2626', 
                                      background: '#fef2f2', 
                                      padding: '0.25rem 0.55rem', 
                                      borderRadius: '6px', 
                                      border: '1px solid #fecaca' 
                                    }}>
                                      <Clock size={13} /> Non produit
                                    </span>
                                    <button
                                      onClick={() => toggleArticleDelivery(setData, currentOrder.id, item.id, false)}
                                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.65rem', cursor: 'pointer', textAlign: 'left', padding: 0, textDecoration: 'underline' }}
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
                                            background: isDone ? '#10b981' : '#ffffff',
                                            color: isDone ? '#ffffff' : '#475569',
                                            border: isDone ? '1px solid #059669' : '1px solid #cbd5e1',
                                            fontSize: '0.74rem',
                                            fontWeight: isDone ? 700 : 600,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            transition: 'all 0.15s',
                                            boxShadow: isDone ? '0 1px 3px rgba(16, 185, 129, 0.2)' : '0 1px 2px rgba(0,0,0,0.03)'
                                          }}
                                        >
                                          {isDone ? <Check size={12} strokeWidth={3} /> : <Circle size={12} color="#94a3b8" />}
                                          <span>{stepTitle}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <AlertCircle size={14} color="#f59e0b" />
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
                                        background: item.isFullyInstalled ? '#fef2f2' : '#ecfdf5',
                                        color: item.isFullyInstalled ? '#dc2626' : '#059669',
                                        border: item.isFullyInstalled ? '1px solid #fecaca' : '1px solid #a7f3d0',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {item.isFullyInstalled ? 'Décocher tout' : 'Tout valider'}
                                    </button>
                                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 600 }}>
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
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
              Scanner pour ouvrir sur Mobile
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: '#64748b' }}>
              Pointez l'appareil photo d'un smartphone sur ce QR Code pour accéder immédiatement à l'interface de pose du chantier :
              <br />
              <strong style={{ color: '#0284c7', fontSize: '0.95rem' }}>{currentOrder.number || currentOrder.id} — {currentClientName}</strong>
            </p>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', display: 'inline-block', boxShadow: 'inset 0 0 0 1px #e2e8f0', marginBottom: '1.5rem' }}>
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
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
                }}
              >
                {copiedLink ? 'Lien copié !' : 'Copier le lien direct'}
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
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
