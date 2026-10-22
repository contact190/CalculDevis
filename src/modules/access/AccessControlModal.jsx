import React, { useState, useMemo } from 'react';
import { 
  Users, Key, Shield, ShieldCheck, Plus, Trash2, Edit2, Check, X, 
  Eye, EyeOff, Search, Clock, Laptop, History, AlertCircle, FileText,
  Lock, RefreshCw
} from 'lucide-react';
import { AVAILABLE_TABS, MASTER_ADMIN, getAccounts } from '../../utils/accessControl';
import { getDeviceId } from '../../utils/patchEngine';

export default function AccessControlModal({ isOpen, onClose, database, setDatabase, currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('accounts'); // 'accounts' | 'logins' | 'audit'
  const [editingAccount, setEditingAccount] = useState(null); // null or account object
  const [isCreating, setIsCreating] = useState(false);
  const [showCodes, setShowCodes] = useState({});
  const [searchLog, setSearchLog] = useState('');
  const [searchAudit, setSearchAudit] = useState('');

  // Formulaire d'édition / création
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formRole, setFormRole] = useState('user'); // 'admin' | 'user'
  const [formAllowedTabs, setFormAllowedTabs] = useState([]);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');

  const accounts = useMemo(() => {
    return getAccounts(database);
  }, [database]);

  const accessLogs = useMemo(() => {
    const logs = Array.isArray(database?.accessLogs) ? database.accessLogs : [];
    if (!searchLog.trim()) return logs;
    const q = searchLog.toLowerCase();
    return logs.filter(l => 
      (l.userName && l.userName.toLowerCase().includes(q)) ||
      (l.deviceId && l.deviceId.toLowerCase().includes(q)) ||
      (l.type && l.type.toLowerCase().includes(q))
    );
  }, [database?.accessLogs, searchLog]);

  // Analyse des modifications récentes à partir des devis, commandes, clients
  const auditEntries = useMemo(() => {
    const list = [];
    if (!database) return list;

    // 1. Devis
    if (Array.isArray(database.quotes)) {
      database.quotes.forEach(q => {
        if (q._lastModified || q._modifiedBy) {
          list.push({
            id: `quote-${q.id}`,
            module: 'Devis',
            docId: q.number || q.id,
            author: q._modifiedBy || 'Inconnu',
            timestamp: q._lastModified || q.createdAt,
            details: `Devis pour client : ${q.clientName || q.clientId || 'Standard'}`
          });
        }
      });
    }

    // 2. Commandes
    if (Array.isArray(database.orders)) {
      database.orders.forEach(o => {
        if (o._lastModified || o._modifiedBy) {
          list.push({
            id: `order-${o.id}`,
            module: 'Commandes',
            docId: o.orderNumber || o.id,
            author: o._modifiedBy || 'Inconnu',
            timestamp: o._lastModified || o.createdAt,
            details: `Statut : ${o.status || 'En cours'}`
          });
        }
      });
    }

    // 3. Clients
    if (Array.isArray(database.clients)) {
      database.clients.forEach(c => {
        if (c._lastModified || c._modifiedBy) {
          list.push({
            id: `client-${c.id}`,
            module: 'Clients',
            docId: c.name || c.id,
            author: c._modifiedBy || 'Inconnu',
            timestamp: c._lastModified || c.createdAt,
            details: `Téléphone : ${c.phone || '-'}`
          });
        }
      });
    }

    // Trier du plus récent au plus ancien
    list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    if (!searchAudit.trim()) return list.slice(0, 300);
    const q = searchAudit.toLowerCase();
    return list.filter(item => 
      item.author.toLowerCase().includes(q) ||
      item.docId.toLowerCase().includes(q) ||
      item.module.toLowerCase().includes(q)
    ).slice(0, 300);
  }, [database, searchAudit]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingAccount(null);
    setFormName('');
    setFormCode('');
    setFormRole('user');
    // Par défaut, donner accès aux devis et commercial
    setFormAllowedTabs(['commercial', 'quotes']);
    setFormActive(true);
    setFormError('');
    setIsCreating(true);
  };

  const handleStartEdit = (acc) => {
    setEditingAccount(acc);
    setFormName(acc.name || '');
    setFormCode(acc.code || '');
    setFormRole(acc.role || 'user');
    setFormAllowedTabs(Array.isArray(acc.allowedTabs) ? acc.allowedTabs : []);
    setFormActive(acc.active !== false);
    setFormError('');
    setIsCreating(true);
  };

  const handleToggleTab = (tabId) => {
    if (formAllowedTabs.includes(tabId)) {
      setFormAllowedTabs(formAllowedTabs.filter(id => id !== tabId));
    } else {
      setFormAllowedTabs([...formAllowedTabs, tabId]);
    }
  };

  const handleSelectAllTabs = () => {
    setFormAllowedTabs(AVAILABLE_TABS.map(t => t.id));
  };

  const handleDeselectAllTabs = () => {
    setFormAllowedTabs([]);
  };

  const handleSaveAccount = (e) => {
    if (e) e.preventDefault();
    if (!formName.trim()) {
      setFormError('Le nom du compte est obligatoire');
      return;
    }
    const cleanCode = formCode.trim();
    if (!cleanCode || cleanCode.length < 3) {
      setFormError('Le code d\'accès doit comporter au moins 3 caractères');
      return;
    }

    // Vérifier l'unicité du code d'accès
    const existing = accounts.find(a => 
      a.code === cleanCode && 
      (!editingAccount || a.id !== editingAccount.id)
    );
    if (existing) {
      setFormError(`Ce code d'accès est déjà utilisé par le compte "${existing.name}"`);
      return;
    }

    const updatedAccount = {
      id: editingAccount ? editingAccount.id : `ACC-${Date.now()}`,
      name: formName.trim(),
      code: cleanCode,
      role: formRole,
      allowedTabs: formRole === 'admin' ? ['all'] : formAllowedTabs,
      active: formActive,
      createdAt: editingAccount ? editingAccount.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDatabase(prev => {
      const currentAccounts = Array.isArray(prev?.userAccounts) ? [...prev.userAccounts] : [];
      let nextAccounts;
      if (editingAccount) {
        nextAccounts = currentAccounts.map(a => a.id === editingAccount.id ? updatedAccount : a);
        // Si le compte maître était édité
        if (editingAccount.id === MASTER_ADMIN.id) {
          const idx = nextAccounts.findIndex(a => a.id === MASTER_ADMIN.id);
          if (idx !== -1) nextAccounts[idx] = updatedAccount;
        }
      } else {
        nextAccounts = [...currentAccounts, updatedAccount];
      }
      return {
        ...prev,
        userAccounts: nextAccounts
      };
    });

    setIsCreating(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (account) => {
    if (account.id === MASTER_ADMIN.id) {
      alert("Le compte Administrateur Principal ne peut pas être supprimé.");
      return;
    }
    if (window.confirm(`Confirmer la suppression du compte "${account.name}" ?`)) {
      setDatabase(prev => {
        const currentAccounts = Array.isArray(prev?.userAccounts) ? prev.userAccounts : [];
        return {
          ...prev,
          userAccounts: currentAccounts.filter(a => a.id !== account.id)
        };
      });
    }
  };

  const toggleShowCode = (id) => {
    setShowCodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString()} à ${d.toLocaleTimeString()}`;
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(10, 15, 30, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      color: '#f8fafc',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        background: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '1rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        
        {/* En-tête Modal */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', background: '#3b82f6', borderRadius: '10px', display: 'grid', placeItems: 'center' }}>
              <ShieldCheck size={22} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Gestion des Accès & Traçabilité</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Gérez les codes d'accès, les onglets autorisés et suivez les connexions & modifications
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Barre d'onglets de navigation interne */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.3)',
          padding: '0 1.5rem',
        }}>
          <button
            onClick={() => setActiveSubTab('accounts')}
            style={{
              padding: '0.9rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === 'accounts' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeSubTab === 'accounts' ? '#60a5fa' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Key size={16} />
            <span>Comptes & Codes d'accès ({accounts.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('logins')}
            style={{
              padding: '0.9rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === 'logins' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeSubTab === 'logins' ? '#60a5fa' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <History size={16} />
            <span>Suivi des Connexions ({accessLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('audit')}
            style={{
              padding: '0.9rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === 'audit' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeSubTab === 'audit' ? '#60a5fa' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <FileText size={16} />
            <span>Journal des Modifications ({auditEntries.length})</span>
          </button>
        </div>

        {/* Corps principal défilant */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* ──────────── ONGLET 1 : COMPTES & CODES ──────────── */}
          {activeSubTab === 'accounts' && (
            <div>
              {/* Entête avec bouton d'ajout */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                  Chaque compte dispose d'un code unique. Choisissez précisément quels onglets lui seront accessibles.
                </p>
                {!isCreating && (
                  <button
                    onClick={handleStartCreate}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '0.6rem 1rem',
                      borderRadius: '0.5rem',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Plus size={16} />
                    <span>Nouveau Compte</span>
                  </button>
                )}
              </div>

              {/* Formulaire de création / édition */}
              {isCreating && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#93c5fd' }}>
                      {editingAccount ? `Modifier le compte : ${editingAccount.name}` : 'Créer un nouveau profil d\'accès'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveAccount}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                          Nom du compte / Rôle *
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={formName}
                          onChange={e => setFormName(e.target.value)}
                          placeholder="Ex: Commercial Oran, Atelier Débit..."
                          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '0.5rem 0.75rem', borderRadius: '0.4rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                          Code d'accès (PIN) *
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={formCode}
                          onChange={e => setFormCode(e.target.value.replace(/\s+/g, ''))}
                          placeholder="Ex: 1234, 456789..."
                          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', fontFamily: 'monospace', fontWeight: 700 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                          Type de privilège
                        </label>
                        <select
                          value={formRole}
                          onChange={e => setFormRole(e.target.value)}
                          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white', padding: '0.5rem 0.75rem', borderRadius: '0.4rem' }}
                        >
                          <option value="user">Utilisateur Restreint (Selon onglets)</option>
                          <option value="admin">Administrateur (Accès Total)</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                        <input
                          type="checkbox"
                          id="formActive"
                          checked={formActive}
                          onChange={e => setFormActive(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' }}
                        />
                        <label htmlFor="formActive" style={{ fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                          Compte Actif
                        </label>
                      </div>
                    </div>

                    {/* Sélection des onglets */}
                    {formRole !== 'admin' && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd' }}>
                            Onglets autorisés pour ce profil :
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={handleSelectAllTabs}
                              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Tout cocher
                            </button>
                            <button
                              type="button"
                              onClick={handleDeselectAllTabs}
                              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Tout décocher
                            </button>
                          </div>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                          gap: '0.5rem',
                          background: 'rgba(15, 23, 42, 0.5)',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}>
                          {AVAILABLE_TABS.map(tab => {
                            const isChecked = formAllowedTabs.includes(tab.id);
                            return (
                              <label
                                key={tab.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.4rem 0.6rem',
                                  borderRadius: '0.35rem',
                                  background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                  border: isChecked ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleTab(tab.id)}
                                  style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                                />
                                <div>
                                  <div style={{ fontSize: '0.78rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? '#93c5fd' : '#cbd5e1' }}>
                                    {tab.label}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {formError && (
                      <div style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertCircle size={14} />
                        <span>{formError}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#cbd5e1', padding: '0.5rem 1rem', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                      >
                        {editingAccount ? 'Enregistrer les modifications' : 'Créer le compte'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tableau des comptes existants */}
              <div style={{ overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.6rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Nom du compte</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Rôle</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Code d'accès</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Onglets autorisés</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Statut</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(acc => {
                      const isMaster = acc.id === MASTER_ADMIN.id;
                      const isRevealed = !!showCodes[acc.id];
                      return (
                        <tr key={acc.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: isMaster ? 'rgba(59, 130, 246, 0.04)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{acc.name}</span>
                              {isMaster && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  Principal
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: acc.role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: acc.role === 'admin' ? '#c084fc' : '#93c5fd',
                              fontWeight: 600
                            }}>
                              {acc.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{isRevealed ? acc.code : '••••••'}</span>
                              <button
                                type="button"
                                onClick={() => toggleShowCode(acc.id)}
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                                title={isRevealed ? 'Masquer' : 'Afficher'}
                              >
                                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {acc.role === 'admin' || (acc.allowedTabs && acc.allowedTabs.includes('all')) ? (
                              <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.75rem' }}>
                                Accès Total (Tous les onglets)
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '320px' }}>
                                {acc.allowedTabs && acc.allowedTabs.length > 0 ? (
                                  acc.allowedTabs.map(tId => {
                                    const tabObj = AVAILABLE_TABS.find(t => t.id === tId);
                                    return (
                                      <span key={tId} style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {tabObj ? tabObj.label : tId}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>Aucun onglet</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.72rem',
                              color: acc.active !== false ? '#10b981' : '#64748b',
                              fontWeight: 600
                            }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: acc.active !== false ? '#10b981' : '#64748b' }}></span>
                              {acc.active !== false ? 'Actif' : 'Désactivé'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleStartEdit(acc)}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#93c5fd', padding: '0.35rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                                title="Modifier"
                              >
                                <Edit2 size={14} />
                              </button>
                              {!isMaster && (
                                <button
                                  onClick={() => handleDeleteAccount(acc)}
                                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#fca5a5', padding: '0.35rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Supprimer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ──────────── ONGLET 2 : SUIVI DES CONNEXIONS ──────────── */}
          {activeSubTab === 'logins' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                  Historique chronologique des ouvertures de session sur l'ensemble des postes de travail.
                </p>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={searchLog}
                    onChange={e => setSearchLog(e.target.value)}
                    placeholder="Filtrer par utilisateur..."
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #334155',
                      borderRadius: '0.4rem',
                      padding: '0.4rem 0.6rem 0.4rem 2rem',
                      color: 'white',
                      fontSize: '0.75rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {accessLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <History size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>Aucun historique de connexion enregistré pour l'instant.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.6rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Date & Heure</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Utilisateur / Profil</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Privilège</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Événement</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Poste / Machine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessLogs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Clock size={13} color="#60a5fa" />
                              <span>{formatDate(log.timestamp)}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'white' }}>
                            {log.userName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: log.role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: log.role === 'admin' ? '#c084fc' : '#93c5fd',
                            }}>
                              {log.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: log.type === 'login' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: log.type === 'login' ? '#6ee7b7' : '#fca5a5',
                              fontWeight: 600
                            }}>
                              {log.type === 'login' ? 'Connexion réussie' : 'Déconnexion'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Laptop size={13} />
                              <span>{log.deviceId || '-'}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ──────────── ONGLET 3 : JOURNAL DES MODIFICATIONS ──────────── */}
          {activeSubTab === 'audit' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                  Suivi détaillé des devis, commandes et fiches clients modifiés avec l'auteur identifié.
                </p>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={searchAudit}
                    onChange={e => setSearchAudit(e.target.value)}
                    placeholder="Filtrer (ex: devis, nom)..."
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #334155',
                      borderRadius: '0.4rem',
                      padding: '0.4rem 0.6rem 0.4rem 2rem',
                      color: 'white',
                      fontSize: '0.75rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {auditEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <FileText size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>Aucune modification enregistrée pour l'instant.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.6rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Date & Heure</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Module</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Élément / Référence</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Auteur de la modification</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Détails</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEntries.map(entry => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Clock size={13} color="#60a5fa" />
                              <span>{formatDate(entry.timestamp)}</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#93c5fd',
                              fontWeight: 600
                            }}>
                              {entry.module}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'white' }}>
                            {entry.docId}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#6ee7b7', fontWeight: 600 }}>
                            {entry.author}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                            {entry.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Pied de la modale */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.75rem' }}>
            <Lock size={14} color="#3b82f6" />
            <span>Synchronisation automatique des comptes & accès via le Cloud Supabase</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#3b82f6',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.4rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
