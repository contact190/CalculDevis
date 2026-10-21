import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle, 
  Circle, 
  QrCode, 
  Layers, 
  ArrowLeft, 
  Building2, 
  Clock, 
  Calendar, 
  User, 
  AlertCircle, 
  ShieldCheck, 
  Play, 
  FileText,
  CheckSquare
} from 'lucide-react';

export default function SubLotMobilePortal({ data, setData, isOnline, isSyncing }) {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');
  const batchId = urlParams.get('batchId');
  const sublotId = urlParams.get('sublotId');
  const initialAction = urlParams.get('action') || 'finish'; // 'start' | 'finish'

  const [activeAction, setActiveAction] = useState(initialAction);
  const [successToast, setSuccessToast] = useState(null);

  // Find order
  const order = useMemo(() => {
    return (data?.orders || []).find(o => o.id === orderId);
  }, [data?.orders, orderId]);

  // Find client
  const client = useMemo(() => {
    if (!order) return null;
    return (data?.clients || []).find(c => c.id === order.clientId);
  }, [data?.clients, order]);

  // Find batch (with fallback to search by sublotId across all batches)
  const batch = useMemo(() => {
    if (!order) return null;
    if (batchId) {
      const found = (order.batches || []).find(b => b.id === batchId);
      if (found) return found;
    }
    if (sublotId) {
      return (order.batches || []).find(b => (b.subLots || []).some(s => s.id === sublotId)) || null;
    }
    return null;
  }, [order, batchId, sublotId]);

  // Find sub-lot from batch or order
  const subLot = useMemo(() => {
    if (batch && batch.subLots) {
      const found = (batch.subLots || []).find(s => s.id === sublotId);
      if (found) return found;
    }
    if (order && order.batches) {
      for (const b of order.batches) {
        const found = (b.subLots || []).find(s => s.id === sublotId);
        if (found) return found;
      }
    }
    if (order && order.subLots) {
      return (order.subLots || []).find(s => s.id === sublotId);
    }
    return null;
  }, [batch, order, sublotId]);

  // Helper to persist sub-lot changes
  const updateSubLotInDB = (updatedSubLot) => {
    if (!order) return;
    setData(prev => {
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== order.id) return o;
        
        let batchFound = false;
        let newBatches = (o.batches || []).map(b => {
          const hasThisSubLot = (b.id === batch?.id) || (b.subLots || []).some(s => s.id === updatedSubLot.id);
          if (!hasThisSubLot) return b;
          batchFound = true;
          const updatedSubLots = (b.subLots || []).map(s => s.id === updatedSubLot.id ? updatedSubLot : s);
          const allSubLotsDone = updatedSubLots.length > 0 && updatedSubLots.every(s => s.status === 'Terminé');
          return { 
            ...b, 
            subLots: updatedSubLots,
            subLotsApproved: true,
            status: allSubLotsDone ? 'Terminé' : (b.status === 'Non commencé' ? 'En cours' : b.status)
          };
        });

        let newOrderSubLots = (o.subLots || []).map(s => s.id === updatedSubLot.id ? updatedSubLot : s);

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

  // Toggle item in checklist
  const toggleChecklistItem = (key) => {
    if (!subLot) return;

    // Règle stricte d'atelier : Impossible de cocher avant d'avoir lancé la production
    if (subLot.status === 'En attente' || !subLot.startedAt) {
      alert("⛔ Action bloquée :\n\nVous ne pouvez pas commencer à cocher les cadres et les panneaux avant d'avoir lancé la production de ce sous-lot.\n\nVeuillez d'abord cliquer sur « Démarrer la fabrication ».");
      setActiveAction('start');
      return;
    }

    const currentChecklist = subLot.checklist || {};
    const updatedChecklist = {
      ...currentChecklist,
      [key]: !currentChecklist[key]
    };

    const updatedSubLot = {
      ...subLot,
      checklist: updatedChecklist,
      status: subLot.status === 'En attente' ? 'En cours' : subLot.status
    };

    updateSubLotInDB(updatedSubLot);
  };

  // Launch / Start sub-lot
  const handleStartSubLot = () => {
    if (!subLot) return;
    const updatedSubLot = {
      ...subLot,
      status: 'En cours',
      startedAt: subLot.startedAt || new Date().toISOString()
    };
    updateSubLotInDB(updatedSubLot);
    setSuccessToast("🚀 Fabrication lancée avec succès !");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Approve that it is completely finished
  const handleApproveFinished = () => {
    if (!subLot) return;

    if (subLot.status === 'En attente' || !subLot.startedAt) {
      alert("⛔ Action bloquée :\n\nVous devez d'abord lancer la production avant de valider la fin du sous-lot.");
      setActiveAction('start');
      return;
    }

    if (!window.confirm(`Confirmez-vous la fin de fabrication pour le sous-lot "${subLot.name}" ?\n\nTous les contrôles et fabrications seront validés comme terminés.`)) {
      return;
    }

    // Mark all checklist items as checked
    const allChecked = {};
    (subLot.cadres || []).forEach(c => { allChecked[c.id] = true; });
    (subLot.panneaux || []).forEach(p => { allChecked[p.id] = true; });
    (subLot.ouvertures || []).forEach(o => { allChecked[o.id] = true; });

    const updatedSubLot = {
      ...subLot,
      checklist: { ...(subLot.checklist || {}), ...allChecked },
      status: 'Terminé',
      startedAt: subLot.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      completedBy: 'Opérateur Atelier'
    };

    updateSubLotInDB(updatedSubLot);
    setSuccessToast("🎉 Sous-Lot validé et terminé avec succès !");
    setTimeout(() => setSuccessToast(null), 4000);
  };

  if (!order || !subLot) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Inter, sans-serif', maxWidth: '500px', margin: '0 auto', color: '#1e293b' }}>
        <div style={{ width: '64px', height: '64px', background: '#fee2e2', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}>
          <AlertCircle size={32} color="#dc2626" />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b', margin: '0 0 0.5rem' }}>Sous-Lot Introuvable</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Le lien scanné est incomplet ou ce sous-lot n'existe plus dans le système.<br/>
          (Commande : <strong>{orderId || 'Inconnue'}</strong> | Sous-Lot : <strong>{sublotId || 'Inconnu'}</strong>)
        </p>
      </div>
    );
  }

  const isSliding = subLot.family === 'coulissant';
  const checklist = subLot.checklist || {};

  // Calculate progress stats
  const totalCadres = (subLot.cadres || []).length;
  const checkedCadres = (subLot.cadres || []).filter(c => !!checklist[c.id]).length;

  const totalPanneaux = (subLot.panneaux || []).length;
  const checkedPanneaux = (subLot.panneaux || []).filter(p => !!checklist[p.id]).length;

  const totalOuvertures = (subLot.ouvertures || []).length;
  const checkedOuvertures = (subLot.ouvertures || []).filter(o => !!checklist[o.id]).length;

  let overallPercent = 0;
  if (isSliding) {
    const totalItems = totalCadres + totalPanneaux;
    const checkedItems = checkedCadres + checkedPanneaux;
    overallPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  } else {
    overallPercent = totalOuvertures > 0 ? Math.round((checkedOuvertures / totalOuvertures) * 100) : 0;
  }

  const isCompleted = subLot.status === 'Terminé';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif', paddingBottom: '5rem' }}>
      {/* Top Banner */}
      <div style={{ background: '#0f172a', color: 'white', padding: '1rem', borderBottom: '1px solid #1e293b' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '32px', height: '32px', background: '#3b82f6', borderRadius: '8px', display: 'grid', placeItems: 'center' }}>
              <CheckSquare size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
                Atelier — Suivi de Fabrication
              </h1>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Commande {order.id} {batch ? `• ${batch.name}` : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#10b981' : '#f59e0b' }} />
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{isOnline ? 'Connecté' : 'Hors-ligne'}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
        {/* Toast Alert */}
        {successToast && (
          <div style={{ background: '#10b981', color: 'white', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
            <CheckCircle size={20} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Sub-lot Header Card */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ 
                fontSize: '0.72rem', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                background: isSliding ? '#e0f2fe' : subLot.family === 'fixe' ? '#fef3c7' : '#f3e8ff', 
                color: isSliding ? '#0369a1' : subLot.family === 'fixe' ? '#92400e' : '#6b21a8', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '9999px',
                display: 'inline-block',
                marginBottom: '0.35rem'
              }}>
                {subLot.family === 'coulissant' ? 'Coulissant (Cadres & Panneaux)' : subLot.family === 'fixe' ? 'Fixe seul' : 'Ouvrant / Battant'}
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                {subLot.name}
              </h2>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 800, 
                padding: '0.25rem 0.65rem', 
                borderRadius: '6px',
                background: isCompleted ? '#dcfce7' : subLot.status === 'En cours' ? '#dbeafe' : '#f1f5f9',
                color: isCompleted ? '#15803d' : subLot.status === 'En cours' ? '#1d4ed8' : '#64748b',
                display: 'inline-block'
              }}>
                {subLot.status}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
            <div>Client : <strong style={{ color: '#1e293b' }}>{client?.nom || 'Client'}</strong></div>
            <div>Total : <strong style={{ color: '#1e293b' }}>{subLot.items?.length || 0} ouverture(s)</strong></div>
            {subLot.startedAt && (
              <div>Lancé le : <strong style={{ color: '#1e293b' }}>{new Date(subLot.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
            )}
            {subLot.completedAt && (
              <div>Terminé le : <strong style={{ color: '#166534' }}>{new Date(subLot.completedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
            )}
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              <span>Avancement fabrication</span>
              <span>{overallPercent}%</span>
            </div>
            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${overallPercent}%`, 
                background: overallPercent === 100 ? '#10b981' : '#3b82f6', 
                transition: 'width 0.3s ease' 
              }} />
            </div>
          </div>

          {/* Remarks Banner if present */}
          {subLot.remarks && (
            <div style={{ marginTop: '0.85rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.65rem 0.85rem', fontSize: '0.82rem', color: '#92400e' }}>
              <strong>📝 Consigne Atelier :</strong> {subLot.remarks}
            </div>
          )}
        </div>

        {/* Action Toggle (Lancement vs Fin) */}
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '0.6rem', padding: '0.25rem', marginBottom: '1.25rem' }}>
          <button 
            onClick={() => setActiveAction('start')}
            style={{ 
              flex: 1, 
              padding: '0.5rem', 
              borderRadius: '0.45rem', 
              border: 'none', 
              fontWeight: 700, 
              fontSize: '0.82rem',
              cursor: 'pointer',
              background: activeAction === 'start' ? 'white' : 'transparent',
              color: activeAction === 'start' ? '#1e293b' : '#64748b',
              boxShadow: activeAction === 'start' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            🚀 Lancement ({subLot.status === 'En attente' ? 'À démarrer' : 'Démarré'})
          </button>
          <button 
            onClick={() => setActiveAction('finish')}
            style={{ 
              flex: 1, 
              padding: '0.5rem', 
              borderRadius: '0.45rem', 
              border: 'none', 
              fontWeight: 700, 
              fontSize: '0.82rem',
              cursor: 'pointer',
              background: activeAction === 'finish' ? 'white' : 'transparent',
              color: activeAction === 'finish' ? '#1e293b' : '#64748b',
              boxShadow: activeAction === 'finish' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            🏁 Fin & Contrôle ({overallPercent}%)
          </button>
        </div>

        {/* START VIEW */}
        {activeAction === 'start' && (
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.75rem' }}>
              Démarrage du Sous-Lot
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem' }}>
              Badgez ou confirmez le lancement pour signaler à l'équipe que les profilés de ce sous-lot sont pris en charge sur la ligne de fabrication.
            </p>

            {subLot.status === 'En attente' ? (
              <button
                onClick={handleStartSubLot}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: '#3b82f6',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                <Play size={20} /> DÉMARRER LA FABRICATION
              </button>
            ) : (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <CheckCircle size={32} color="#16a34a" style={{ margin: '0 auto 0.5rem' }} />
                <h4 style={{ margin: '0 0 0.25rem', color: '#166534', fontWeight: 800 }}>Fabrication en cours</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d' }}>
                  Ce sous-lot a été lancé{subLot.startedAt ? ` le ${new Date(subLot.startedAt).toLocaleString('fr-FR')}` : ''}.<br/>
                  Passez à l'onglet <strong>« Fin & Contrôle »</strong> pour cocher les éléments terminés.
                </p>
              </div>
            )}
          </div>
        )}

        {/* FINISH VIEW */}
        {activeAction === 'finish' && (
          <div>
            {/* Warning banner if not started */}
            {subLot.status === 'En attente' && (
              <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                  <AlertCircle size={22} color="#dc2626" />
                  <span>Production non lancée : Pointage verrouillé</span>
                </div>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.4 }}>
                  Vous ne pouvez pas commencer à cocher la liste des cadres et des panneaux tant que la fabrication de ce sous-lot n'a pas été officiellement démarrée.
                </p>
                <button
                  onClick={handleStartSubLot}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: '#dc2626',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  <Play size={18} /> Démarrer la Fabrication du Sous-Lot
                </button>
              </div>
            )}

            {/* If SLIDING: Separate Cadres vs Panneaux */}
            {isSliding ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 1. SECTION CADRES (DORMANTS) */}
                <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                  <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🔲</span>
                      <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>1. Liste des Cadres (Dormants)</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
                      {checkedCadres} / {totalCadres} finis
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(subLot.cadres || []).map((cadre, idx) => {
                      const isChecked = !!checklist[cadre.id];
                      const isNotStarted = subLot.status === 'En attente';
                      return (
                        <div 
                          key={cadre.id || idx}
                          onClick={() => toggleChecklistItem(cadre.id)}
                          style={{ 
                            padding: '0.85rem 1rem', 
                            borderBottom: idx < (subLot.cadres || []).length - 1 ? '1px solid #f1f5f9' : 'none',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.85rem',
                            cursor: isNotStarted ? 'not-allowed' : 'pointer',
                            opacity: isNotStarted ? 0.6 : 1,
                            background: isNotStarted ? '#f8fafc' : (isChecked ? '#f0fdf4' : 'white'),
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '6px', 
                            border: isChecked ? '2px solid #16a34a' : '2px solid #cbd5e1',
                            background: isChecked ? '#16a34a' : 'white',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0
                          }}>
                            {isChecked && <CheckCircle size={16} color="white" />}
                          </div>
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#0f766e', color: 'white', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                {cadre.repere}
                              </span>
                              <strong style={{ fontSize: '0.875rem', color: isChecked ? '#166534' : '#1e293b' }}>
                                {cadre.label}
                              </strong>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Cotes Réelles : <strong>{cadre.dim}</strong> {cadre.location ? `• ${cadre.location}` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. SECTION PANNEAUX (VANTAUX) */}
                <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                  <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🚪</span>
                      <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>2. Liste des Panneaux (Vantaux)</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
                      {checkedPanneaux} / {totalPanneaux} finis
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(subLot.panneaux || []).map((panneau, idx) => {
                      const isChecked = !!checklist[panneau.id];
                      const isNotStarted = subLot.status === 'En attente';
                      return (
                        <div 
                          key={panneau.id || idx}
                          onClick={() => toggleChecklistItem(panneau.id)}
                          style={{ 
                            padding: '0.85rem 1rem', 
                            borderBottom: idx < (subLot.panneaux || []).length - 1 ? '1px solid #f1f5f9' : 'none',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.85rem',
                            cursor: isNotStarted ? 'not-allowed' : 'pointer',
                            opacity: isNotStarted ? 0.6 : 1,
                            background: isNotStarted ? '#f8fafc' : (isChecked ? '#f0fdf4' : 'white'),
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '6px', 
                            border: isChecked ? '2px solid #16a34a' : '2px solid #cbd5e1',
                            background: isChecked ? '#16a34a' : 'white',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0
                          }}>
                            {isChecked && <CheckCircle size={16} color="white" />}
                          </div>
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#0369a1', color: 'white', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                {panneau.repere}
                              </span>
                              <strong style={{ fontSize: '0.875rem', color: isChecked ? '#166534' : '#1e293b' }}>
                                {panneau.label}
                              </strong>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Élément : {panneau.panelName || 'Vantail vitré et équipé'} {panneau.dim ? `• ${panneau.dim}` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              /* If OUVRANT or FIXE: Checklist by opening */
              <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>🪟</span>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                      Contrôle & Validation des Ouvertures ({subLot.family === 'fixe' ? 'Fixes' : 'Ouvrants'})
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
                    {checkedOuvertures} / {totalOuvertures} validées
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(subLot.ouvertures || []).map((ouv, idx) => {
                    const isChecked = !!checklist[ouv.id];
                    const isNotStarted = subLot.status === 'En attente';
                    return (
                      <div 
                        key={ouv.id || idx}
                        onClick={() => toggleChecklistItem(ouv.id)}
                        style={{ 
                          padding: '1rem', 
                          borderBottom: idx < (subLot.ouvertures || []).length - 1 ? '1px solid #f1f5f9' : 'none',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.85rem',
                          cursor: isNotStarted ? 'not-allowed' : 'pointer',
                          opacity: isNotStarted ? 0.6 : 1,
                          background: isNotStarted ? '#f8fafc' : (isChecked ? '#f0fdf4' : 'white'),
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{ 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '6px', 
                          border: isChecked ? '2px solid #16a34a' : '2px solid #cbd5e1',
                          background: isChecked ? '#16a34a' : 'white',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}>
                          {isChecked && <CheckCircle size={18} color="white" />}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#0f766e', color: 'white', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                              {ouv.repere}
                            </span>
                            <strong style={{ fontSize: '0.9rem', color: isChecked ? '#166534' : '#1e293b' }}>
                              {ouv.label}
                            </strong>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Dimensions : <strong>{ouv.dim}</strong> {ouv.location ? `• ${ouv.location}` : ''}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: isChecked ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                            {isChecked ? '✅ Assemblage, vitrage et contrôle terminés' : '⏳ En attente de contrôle final'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Final Action Button: Approuver que c'est fini */}
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={handleApproveFinished}
                disabled={isCompleted || subLot.status === 'En attente'}
                style={{
                  width: '100%',
                  padding: '1.1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: isCompleted ? '#10b981' : subLot.status === 'En attente' ? '#94a3b8' : overallPercent === 100 ? '#059669' : '#0f766e',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  cursor: (isCompleted || subLot.status === 'En attente') ? 'not-allowed' : 'pointer',
                  boxShadow: subLot.status === 'En attente' ? 'none' : '0 4px 15px rgba(5, 150, 105, 0.3)',
                  letterSpacing: '0.3px'
                }}
              >
                <CheckCircle size={22} />
                {isCompleted 
                  ? 'SOUS-LOT DÉJÀ APPROUVÉ & TERMINÉ' 
                  : subLot.status === 'En attente' 
                  ? 'LANCER LA FABRICATION D\'ABORD' 
                  : "APPROUVER QUE C'EST FINI"}
              </button>
              {subLot.status === 'En attente' ? (
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginTop: '0.5rem' }}>
                  🔒 Coche et validation bloquées tant que le sous-lot n'est pas lancé en fabrication.
                </p>
              ) : !isCompleted && overallPercent < 100 ? (
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                  💡 Vous pouvez aussi approuver directement une fois tous les éléments contrôlés sur la ligne.
                </p>
              ) : null}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
