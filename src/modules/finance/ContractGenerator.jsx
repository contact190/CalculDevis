import React, { useState, useMemo } from 'react';
import { Plus, FileText, Eye, Lock, Trash2, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Clock, Edit3, X, Save } from 'lucide-react';
import { invokeFunction } from '../../utils/supabaseClient';
import jsPDF from 'jspdf';

const DEFAULT_CLAUSES = [
  { id: 'CLS-1', titre: 'Objet du Contrat', contenu: 'Le présent contrat a pour objet la fourniture et la pose de menuiseries aluminium, conformément aux devis acceptés et aux plans de chantier annexés.' },
  { id: 'CLS-2', titre: 'Délai de Réalisation', contenu: 'Les travaux seront réalisés dans un délai convenu entre les deux parties, sauf cas de force majeure dûment constaté.' },
  { id: 'CLS-3', titre: 'Conditions de Paiement', contenu: 'Le règlement s\'effectuera selon l\'échéancier défini dans le présent contrat. Tout retard de paiement entraînera des pénalités conformément à la législation en vigueur.' },
  { id: 'CLS-4', titre: 'Garantie', contenu: 'Les produits fournis bénéficient d\'une garantie d\'un (1) an à compter de la date de réception. Cette garantie couvre les défauts de fabrication et de pose.' },
  { id: 'CLS-5', titre: 'Litiges', contenu: 'En cas de litige, les parties s\'engagent à rechercher une solution amiable avant tout recours juridictionnel. Le tribunal compétent sera celui du lieu d\'exécution des travaux.' },
];

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmModal = ({ onConfirm, onCancel, contractInfo }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
  }}>
    <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ width: '48px', height: '48px', background: '#fef3c7', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <AlertCircle size={24} color="#d97706" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Confirmer la finalisation</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Cette action est irréversible.</p>
        </div>
      </div>
      <div style={{ background: '#f8fafc', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>
          Vous êtes sur le point de <strong>figer</strong> le contrat <strong>{contractInfo?.id}</strong> pour le client <strong>{contractInfo?.clientName}</strong>.<br /><br />
          Une fois figé, le contrat ne pourra plus être modifié et un suivi financier sera automatiquement créé.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>
          Annuler
        </button>
        <button onClick={onConfirm} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', cursor: 'pointer', fontWeight: 700 }}>
          ✅ Confirmer et Finaliser
        </button>
      </div>
    </div>
  </div>
);

// ─── Email Confirmation Modal ─────────────────────────────────────────────────
const EmailModal = ({ clientEmail, onSend, onCancel, isSending }) => {
  const [email, setEmail] = useState(clientEmail || '');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '48px', height: '48px', background: '#dbeafe', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <FileText size={24} color="#2563eb" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Envoi de confirmation par email</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Un email de confirmation sera envoyé au client.</p>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label className="label">Email du client</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@exemple.com" />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}>
            Annuler
          </button>
          <button onClick={() => onSend(email)} disabled={isSending} style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', cursor: 'pointer', fontWeight: 700, opacity: isSending ? 0.7 : 1 }}>
            {isSending ? '📤 Envoi...' : '📧 Envoyer et Figer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Clause Editor ────────────────────────────────────────────────────────────
const ClauseEditor = ({ clauses, setClauses, readOnly }) => {
  const [newTitle, setNewTitle] = useState('');
  const handleAdd = () => {
    if (!newTitle.trim()) return;
    setClauses(prev => [...prev, { id: `CLS-${Date.now()}`, titre: newTitle.trim(), contenu: '' }]);
    setNewTitle('');
  };
  const handleUpdate = (id, field, value) => {
    setClauses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const handleRemove = (id) => {
    setClauses(prev => prev.filter(c => c.id !== id));
  };
  const handleMove = (idx, dir) => {
    setClauses(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>📋 Clauses du Contrat</h3>
        {!readOnly && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Titre de la nouvelle clause..."
              style={{ padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '220px' }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', background: '#0f4c75', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
              <Plus size={14} /> Ajouter
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {clauses.map((clause, idx) => (
          <div key={clause.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ width: '24px', height: '24px', background: '#0f4c75', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: '2px' }}>
                <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>{idx + 1}</span>
              </div>
              {readOnly ? (
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{clause.titre}</strong>
              ) : (
                <input
                  value={clause.titre}
                  onChange={e => handleUpdate(clause.id, 'titre', e.target.value)}
                  style={{ flex: 1, fontWeight: 700, padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.9rem' }}
                />
              )}
              {!readOnly && (
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} style={{ padding: '0.2rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.3rem', cursor: 'pointer', color: '#64748b' }} title="Monter"><ChevronUp size={14} /></button>
                  <button onClick={() => handleMove(idx, 1)} disabled={idx === clauses.length - 1} style={{ padding: '0.2rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '0.3rem', cursor: 'pointer', color: '#64748b' }} title="Descendre"><ChevronDown size={14} /></button>
                  <button onClick={() => handleRemove(clause.id)} style={{ padding: '0.2rem', background: 'none', border: '1px solid #fca5a5', borderRadius: '0.3rem', cursor: 'pointer', color: '#ef4444' }} title="Supprimer"><X size={14} /></button>
                </div>
              )}
            </div>
            {readOnly ? (
              <p style={{ margin: '0 0 0 2rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>{clause.contenu}</p>
            ) : (
              <textarea
                value={clause.contenu}
                onChange={e => handleUpdate(clause.id, 'contenu', e.target.value)}
                rows={3}
                style={{ width: '100%', marginLeft: '2rem', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', color: '#374151', lineHeight: 1.6 }}
              />
            )}
          </div>
        ))}
        {clauses.length === 0 && (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem 0', fontSize: '0.9rem' }}>Aucune clause. Ajoutez-en une ci-dessus.</p>
        )}
      </div>
    </div>
  );
};

// ─── Contract Generator Main Component ───────────────────────────────────────
const ContractGenerator = ({ data, setData, quoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [editingContract, setEditingContract] = useState(null);
  const [clauses, setClauses] = useState([...DEFAULT_CLAUSES]);
  const [montantHT, setMontantHT] = useState(0);
  const [tauxTVA, setTauxTVA] = useState(19);
  const [delaiJours, setDelaiJours] = useState(30);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [viewingContract, setViewingContract] = useState(null);

  const contracts = data.contracts || [];
  const orders = data.orders || [];
  const clients = data.clients || [];

  const montantTTC = useMemo(() => montantHT * (1 + tauxTVA / 100), [montantHT, tauxTVA]);
  const montantTVA = useMemo(() => montantHT * tauxTVA / 100, [montantHT, tauxTVA]);

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);
  const selectedClient = useMemo(() => {
    if (!selectedOrder) return null;
    return clients.find(c => c.id === selectedOrder.clientId) || null;
  }, [selectedOrder, clients]);

  const handleStartNewContract = (targetOrderId) => {
    const idToUse = targetOrderId || selectedOrderId;
    if (!idToUse) { alert('Veuillez sélectionner une commande.'); return; }
    const existingContract = contracts.find(c => c.orderId === idToUse && c.status !== 'Annulé');
    if (existingContract) {
      alert(`Un contrat existe déjà pour cette commande (${existingContract.id}).`);
      return;
    }
    const order = orders.find(o => o.id === idToUse);
    const newContractId = `CTR-${Date.now().toString().slice(-6)}`;
    const draft = {
      id: newContractId,
      orderId: idToUse,
      clientId: order?.clientId || '',
      status: 'Brouillon',
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      companyInfo: {
        name: quoteSettings?.companyName || '',
        address: quoteSettings?.companyAddress || '',
        phone: quoteSettings?.companyPhone || '',
        email: quoteSettings?.companyEmail || '',
        rc: quoteSettings?.companyRC || '',
        nif: quoteSettings?.companyMF || '',
      },
      clientInfo: {
        nom: selectedClient?.nom || '',
        adresse: selectedClient?.adresse || '',
        telephone: selectedClient?.telephone || '',
        email: selectedClient?.email || '',
        nif: selectedClient?.nif || '',
        nis: selectedClient?.nis || '',
        rc: selectedClient?.rc || '',
      },
      montantHT: order?.totals?.ht || 0,
      montantTVA: (order?.totals?.ht || 0) * (tauxTVA / 100),
      montantTTC: order?.totals?.ttc || 0,
      tauxTVA: tauxTVA,
      delaiPaiementJours: delaiJours,
      clauses: [...DEFAULT_CLAUSES],
      confirmationEmailSent: false,
    };
    setMontantHT(draft.montantHT);
    setTauxTVA(draft.tauxTVA);
    setDelaiJours(draft.delaiPaiementJours);
    setClauses([...DEFAULT_CLAUSES]);
    setEditingContract(draft);
    setShowPreview(false);
  };

  const handleSaveDraft = () => {
    if (!editingContract) return;
    const updated = {
      ...editingContract,
      montantHT,
      montantTVA,
      montantTTC,
      tauxTVA,
      delaiPaiementJours: delaiJours,
      clauses,
    };
    setData(prev => {
      const existing = (prev.contracts || []).find(c => c.id === updated.id);
      const contracts = existing
        ? (prev.contracts || []).map(c => c.id === updated.id ? updated : c)
        : [...(prev.contracts || []), updated];
      return { ...prev, contracts };
    });
    setEditingContract(updated);
    alert('Brouillon sauvegardé !');
  };

  const handleFinalizeContract = () => {
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    setShowEmailModal(true);
  };

  const handleSendEmailAndFinalize = async (emailAddr) => {
    if (!emailAddr || !emailAddr.includes('@')) { alert('Email invalide.'); return; }
    setIsSending(true);
    const finalContract = {
      ...editingContract,
      montantHT,
      montantTVA,
      montantTTC,
      tauxTVA,
      delaiPaiementJours: delaiJours,
      clauses,
      status: 'Figé',
      acceptedAt: new Date().toISOString(),
      confirmationEmailSent: true,
      confirmationEmailAddr: emailAddr,
    };

    // Generate tracker
    const trackerId = `FIN-${Date.now().toString().slice(-6)}`;
    const newTracker = {
      id: trackerId,
      orderId: finalContract.orderId,
      contractId: finalContract.id,
      clientId: finalContract.clientId,
      montantContrat: finalContract.montantTTC,
      avance: { montant: 0, date: null, fichier: null, lienDrive: '' },
      versements: [],
      createdAt: new Date().toISOString(),
    };

    setData(prev => {
      const existing = (prev.contracts || []).find(c => c.id === finalContract.id);
      const contracts = existing
        ? (prev.contracts || []).map(c => c.id === finalContract.id ? finalContract : c)
        : [...(prev.contracts || []), finalContract];
      const trackers = [...(prev.financialTrackers || []).filter(t => t.contractId !== finalContract.id), newTracker];
      return { ...prev, contracts, financialTrackers: trackers };
    });

    // Try to send email
    try {
      await invokeFunction('send-contract-confirmation', {
        recipient: emailAddr,
        clientName: finalContract.clientInfo?.nom || '',
        companyName: finalContract.companyInfo?.name || '',
        contractId: finalContract.id,
        orderId: finalContract.orderId,
        montantTTC: finalContract.montantTTC,
      });
    } catch (e) {
      console.warn('Email envoi échoué (non critique):', e);
    }

    setIsSending(false);
    setShowEmailModal(false);
    setEditingContract(null);
    alert(`✅ Contrat ${finalContract.id} figé ! Suivi financier ${trackerId} créé automatiquement.`);
  };

  const handleDeleteContract = (id) => {
    if (!window.confirm('Supprimer ce contrat ?')) return;
    setData(prev => ({ ...prev, contracts: (prev.contracts || []).filter(c => c.id !== id) }));
  };

  const statusColor = { 'Brouillon': '#f59e0b', 'Figé': '#10b981', 'Annulé': '#ef4444' };
  const statusBg = { 'Brouillon': '#fef3c7', 'Figé': '#dcfce7', 'Annulé': '#fee2e2' };

  const handleEditDraft = (contract) => {
    setEditingContract(contract);
    setMontantHT(contract.montantHT || 0);
    setTauxTVA(contract.tauxTVA || 19);
    setDelaiJours(contract.delaiPaiementJours || 30);
    setClauses(contract.clauses || [...DEFAULT_CLAUSES]);
    setShowPreview(false);
  };

  return (
    <div>
      {showConfirmModal && (
        <ConfirmModal
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirmModal(false)}
          contractInfo={{ id: editingContract?.id, clientName: selectedClient?.nom || editingContract?.clientInfo?.nom }}
        />
      )}
      {showEmailModal && (
        <EmailModal
          clientEmail={selectedClient?.email || editingContract?.clientInfo?.email || ''}
          onSend={handleSendEmailAndFinalize}
          onCancel={() => setShowEmailModal(false)}
          isSending={isSending}
        />
      )}
      {viewingContract && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Contrat {viewingContract.id}</h2>
              <button onClick={() => setViewingContract(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Société</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{viewingContract.companyInfo?.name}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Client</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{viewingContract.clientInfo?.nom}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Montant HT</p>
                <p style={{ margin: '0.25rem 0 0' }}>{(viewingContract.montantHT || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Montant TTC</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 700, color: '#0f4c75' }}>{(viewingContract.montantTTC || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Délai de paiement</p>
                <p style={{ margin: '0.25rem 0 0' }}>{viewingContract.delaiPaiementJours} jours</p>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>Figé le</p>
                <p style={{ margin: '0.25rem 0 0' }}>{viewingContract.acceptedAt ? new Date(viewingContract.acceptedAt).toLocaleDateString('fr-FR') : '—'}</p>
              </div>
            </div>
            <ClauseEditor clauses={viewingContract.clauses || []} setClauses={() => {}} readOnly={true} />
          </div>
        </div>
      )}

      {/* New contract creation bar */}
      {!editingContract && (
        <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>📝 Créer un nouveau contrat</h3>
          
          <div className="form-group" style={{ marginBottom: '1.25rem', maxWidth: '400px' }}>
            <label className="label">1. Sélectionner un Client</label>
            <select
              value={selectedClientId}
              onChange={e => { setSelectedClientId(e.target.value); setSelectedOrderId(''); }}
              style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
            >
              <option value="">— Choisir un client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          {selectedClientId && (
            <div>
              <label className="label" style={{ marginBottom: '0.75rem', display: 'block' }}>2. Devis / Commandes du client</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {orders.filter(o => o.clientId === selectedClientId).map(o => {
                  const hasContract = (data.contracts || []).some(ct => ct.orderId === o.id && ct.status !== 'Annulé');
                  
                  // Déterminer le plan de chantier
                  let sitePlanName = 'Aucun plan rattaché';
                  const client = clients.find(c => c.id === selectedClientId);
                  if (client && client.sitePlans) {
                    if (o.sitePlanId) {
                      const plan = client.sitePlans.find(p => p.id === o.sitePlanId);
                      if (plan) sitePlanName = plan.name || 'Plan sans nom';
                    } else {
                      // Recherche si une mesure de la commande est dans un plan
                      for (const plan of client.sitePlans) {
                        for (const floor of (plan.floors || [])) {
                          for (const apt of (floor.apartments || [])) {
                            for (const voidItem of (apt.voids || [])) {
                              if (o.items?.some(i => i.id === voidItem.itemId)) {
                                sitePlanName = plan.name || 'Plan sans nom';
                                break;
                              }
                            }
                          }
                        }
                      }
                    }
                  }

                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                          <strong style={{ color: '#0f4c75', fontSize: '1.05rem' }}>Commande {o.id}</strong>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: '#e2e8f0', borderRadius: '999px', color: '#475569', fontWeight: 600 }}>
                            {o.status || 'Nouveau'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          📍 Plan de chantier : <strong>{sitePlanName}</strong>
                        </p>
                      </div>
                      <div>
                        {hasContract ? (
                          <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700, padding: '0.5rem 1rem', background: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #a7f3d0' }}>
                            ✓ Contrat existant
                          </span>
                        ) : (
                          <button
                            onClick={() => { setSelectedOrderId(o.id); setTimeout(() => handleStartNewContract(o.id), 0); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                          >
                            <Plus size={16} /> Créer Contrat
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {orders.filter(o => o.clientId === selectedClientId).length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Ce client n'a aucune commande / devis.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {editingContract && (
        <div className="glass" style={{ marginBottom: '1.5rem', border: '2px solid #1b6ca8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>✏️ Contrat {editingContract.id}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Commande {editingContract.orderId} — {editingContract.clientInfo?.nom || 'Client'}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => setShowPreview(!showPreview)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
                <Eye size={15} /> {showPreview ? 'Masquer' : 'Aperçu'}
              </button>
              <button onClick={handleSaveDraft}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#0369a1' }}>
                <Save size={15} /> Sauvegarder
              </button>
              <button onClick={handleFinalizeContract}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', background: 'linear-gradient(135deg, #059669, #047857)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: 'white' }}>
                <Lock size={15} /> Finaliser
              </button>
              <button onClick={() => setEditingContract(null)}
                style={{ padding: '0.5rem 0.9rem', background: 'none', border: '1px solid #fca5a5', borderRadius: '0.5rem', cursor: 'pointer', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>
                Fermer
              </button>
            </div>
          </div>

          {showPreview ? (
            /* ── Preview mode ── */
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '2rem', fontFamily: 'Georgia, serif' }}>
              <div style={{ textAlign: 'center', borderBottom: '3px double #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>CONTRAT DE FOURNITURE ET POSE</h1>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0' }}>Réf. {editingContract.id} — {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', borderLeft: '3px solid #1b6ca8' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b' }}>Le Prestataire</h4>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.companyInfo.name}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.companyInfo.address}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.companyInfo.phone} | {editingContract.companyInfo.email}</p>
                  {editingContract.companyInfo.rc && <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>RC: {editingContract.companyInfo.rc}</p>}
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', borderLeft: '3px solid #059669' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b' }}>Le Client</h4>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.clientInfo.nom}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.clientInfo.adresse}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{editingContract.clientInfo.telephone} | {editingContract.clientInfo.email}</p>
                  {editingContract.clientInfo.nif && <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>NIF: {editingContract.clientInfo.nif}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: '#eff6ff', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Montant HT</span><br /><strong>{montantHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></div>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b' }}>TVA ({tauxTVA}%)</span><br /><strong>{montantTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></div>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Montant TTC</span><br /><strong style={{ fontSize: '1.1rem', color: '#0f4c75' }}>{montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></div>
                <div style={{ flex: 1 }}><span style={{ fontSize: '0.8rem', color: '#64748b' }}>Délai paiement</span><br /><strong>{delaiJours} jours</strong></div>
              </div>
              <ClauseEditor clauses={clauses} setClauses={() => {}} readOnly={true} />
            </div>
          ) : (
            /* ── Edit mode ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Parties info display */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#eff6ff', borderRadius: '0.75rem', padding: '1rem', borderLeft: '3px solid #1b6ca8' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Société (depuis Commercial)</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.companyInfo.name || '—'}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.companyInfo.address}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.companyInfo.phone} | {editingContract.companyInfo.email}</p>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: '0.75rem', padding: '1rem', borderLeft: '3px solid #059669' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Client (depuis fiche client)</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{editingContract.clientInfo.nom || '—'}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.clientInfo.adresse}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>{editingContract.clientInfo.telephone} | {editingContract.clientInfo.email}</p>
                </div>
              </div>
              {/* Montants */}
              <div style={{ background: '#fafafa', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>💰 Montants du Contrat</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="label">Montant HT (DZD)</label>
                    <input className="input" type="number" value={montantHT} onChange={e => setMontantHT(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Taux TVA (%)</label>
                    <input className="input" type="number" value={tauxTVA} onChange={e => setTauxTVA(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label className="label">TVA (DZD)</label>
                    <input className="input" value={montantTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} readOnly style={{ background: '#f1f5f9', color: '#64748b' }} />
                  </div>
                  <div className="form-group">
                    <label className="label" style={{ color: '#0f4c75', fontWeight: 700 }}>Montant TTC (DZD)</label>
                    <input className="input" value={montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} readOnly style={{ background: '#eff6ff', fontWeight: 700, color: '#0f4c75' }} />
                  </div>
                  <div className="form-group">
                    <label className="label">Délai de paiement (jours)</label>
                    <input className="input" type="number" value={delaiJours} onChange={e => setDelaiJours(parseInt(e.target.value) || 30)} />
                  </div>
                </div>
              </div>
              {/* Clauses editor */}
              <ClauseEditor clauses={clauses} setClauses={setClauses} readOnly={false} />
            </div>
          )}
        </div>
      )}

      {/* Contracts list */}
      <div className="glass">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>📄 Contrats enregistrés</h2>
        {contracts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aucun contrat. Créez-en un ci-dessus.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Contrat</th>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Montant TTC</th>
                  <th>Délai</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map(ct => {
                  const client = clients.find(c => c.id === ct.clientId);
                  return (
                    <tr key={ct.id}>
                      <td style={{ fontWeight: 700, color: '#0f4c75' }}>{ct.id}</td>
                      <td>{ct.orderId}</td>
                      <td>{ct.clientInfo?.nom || client?.nom || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{(ct.montantTTC || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                      <td>{ct.delaiPaiementJours || '—'} j</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: statusBg[ct.status] || '#f1f5f9', color: statusColor[ct.status] || '#64748b' }}>
                          {ct.status === 'Figé' ? '🔒 ' : ct.status === 'Brouillon' ? '✏️ ' : ''}{ct.status}
                        </span>
                      </td>
                      <td>{new Date(ct.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button onClick={() => setViewingContract(ct)} style={{ padding: '0.3rem 0.6rem', background: '#e0f2fe', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#0369a1', fontSize: '0.8rem', fontWeight: 600 }}>
                            <Eye size={13} style={{ verticalAlign: 'middle' }} /> Voir
                          </button>
                          {ct.status === 'Brouillon' && (
                            <button onClick={() => handleEditDraft(ct)} style={{ padding: '0.3rem 0.6rem', background: '#fef3c7', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#d97706', fontSize: '0.8rem', fontWeight: 600 }}>
                              <Edit3 size={13} style={{ verticalAlign: 'middle' }} /> Éditer
                            </button>
                          )}
                          <button onClick={() => handleDeleteContract(ct.id)} style={{ padding: '0.3rem 0.6rem', background: '#fee2e2', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractGenerator;
