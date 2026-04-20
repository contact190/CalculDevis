import React, { useState } from 'react';
import { Users, Plus, Edit2, Trash2, FileText, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

const ClientsModule = ({ data, setData, onOpenQuote }) => {
  const [editingClient, setEditingClient] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);

  const handleAddClient = () => {
    const newClient = {
      id: `CLI-${Date.now().toString().slice(-4)}`,
      nom: 'Nouveau Client',
      adresse: '',
      telephone: '',
      email: '',
      nif: '',
      nis: '',
      ai: '',
      rc: ''
    };
    setData(prev => ({ ...prev, clients: [...(prev.clients || []), newClient] }));
    setEditingClient(newClient);
  };

  const handleUpdateClient = (updated) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === updated.id ? updated : c)
    }));
  };

  const handleConvertToOrder = (quote) => {
    if (!window.confirm(`Voulez-vous transformer le devis ${quote.number} en commande active ?`)) return;
    
    const newOrder = {
      id: `ORD-${quote.number.split('-')[1] || Date.now().toString().slice(-4)}`,
      quoteId: quote.id,
      quoteNumber: quote.number,
      clientId: quote.clientId,
      createdAt: new Date().toISOString(),
      status: 'Métré à confirmer',
      items: ((quote.items || quote.products) || []).map(item => ({
        ...item,
        siteMeasurements: [] // This will store { L, H, qty } entered on site
      }))
    };

    setData(prev => {
      // Check if order already exists
      if (prev.orders?.some(o => o.quoteId === quote.id)) {
        alert("Une commande existe déjà pour ce devis.");
        return prev;
      }
      return {
        ...prev,
        orders: [...(prev.orders || []), newOrder]
      };
    });
    alert(`Commande créée avec succès ! Retrouvez-la dans l'onglet "Commandes".`);
  };

  const handleDeleteClient = (id) => {
    if (window.confirm('Supprimer ce client ?')) {
      setData(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== id) }));
      return true;
    }
    return false;
  };

  return (
    <div className="animate-fade-in">
      <header className="flex-header">
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Gestion des Clients</h1>
          <p style={{ color: '#64748b' }}>Répertoire de vos clients, entreprises et informations de facturation.</p>
        </div>
        <button className="btn btn-primary" onClick={handleAddClient} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Nouveau Client
        </button>
      </header>

      {editingClient ? (
        <div className="glass shadow-lg" style={{ marginBottom: '2rem', border: '2px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Édition du Client</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn" 
                style={{ color: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem' }} 
                onClick={() => {
                  if (handleDeleteClient(editingClient.id)) {
                    setEditingClient(null);
                  }
                }}
              >
                <Trash2 size={16} /> Supprimer
              </button>
              <button className="btn" onClick={() => setEditingClient(null)}>Fermer l'éditeur</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="label">Nom / Raison Sociale</label>
                <input className="input" value={editingClient.nom} onChange={e => { const u = {...editingClient, nom: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
              </div>
              <div className="form-group">
                <label className="label">Adresse</label>
                <textarea className="input" rows="2" value={editingClient.adresse} onChange={e => { const u = {...editingClient, adresse: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Téléphone</label>
                  <input className="input" value={editingClient.telephone} onChange={e => { const u = {...editingClient, telephone: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
                </div>
                <div className="form-group">
                  <label className="label">Email</label>
                  <input className="input" type="email" value={editingClient.email} onChange={e => { const u = {...editingClient, email: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', margin: '0 0 0.5rem 0' }}>Informations Fiscales & Légales</h3>
              <div className="form-group">
                <label className="label">NIF (Numéro d'Identification Fiscale)</label>
                <input className="input" value={editingClient.nif} onChange={e => { const u = {...editingClient, nif: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
              </div>
              <div className="form-group">
                <label className="label">NIS (Numéro d'Identification Statistique)</label>
                <input className="input" value={editingClient.nis} onChange={e => { const u = {...editingClient, nis: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Art. Imposition (AI)</label>
                  <input className="input" value={editingClient.ai} onChange={e => { const u = {...editingClient, ai: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
                </div>
                <div className="form-group">
                  <label className="label">Registre de Commerce (RC)</label>
                  <input className="input" value={editingClient.rc} onChange={e => { const u = {...editingClient, rc: e.target.value}; setEditingClient(u); handleUpdateClient(u); }} />
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '1rem' }}>Historique des Devis</h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>N° Devis</th>
                    <th>Date</th>
                    <th>Nombre de Produits</th>
                    <th>Montant HT</th>
                    <th>Montant TTC</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.quotes || []).filter(q => q.clientId === editingClient.id).map(q => (
                    <tr key={q.id}>
                      <td data-label="N°" style={{ fontWeight: 700, color: '#2563eb' }}>{q.number}</td>
                      <td data-label="Date">{new Date(q.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td data-label="Produits">{q.items?.length || 0}</td>
                      <td data-label="HT" style={{ fontWeight: 600 }}>{q.totals?.ht?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                      <td data-label="TTC" style={{ fontWeight: 700 }}>{q.totals?.ttc?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                      <td data-label="Actions" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => { if(onOpenQuote) onOpenQuote(q); }} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#2563eb', borderColor: '#2563eb' }}>
                            Ouvrir
                          </button>
                          <button onClick={() => handleConvertToOrder(q)} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#10b981' }} title="Transformer en Commande">
                            <CheckCircle size={14} /> Commande
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(data.quotes || []).filter(q => q.clientId === editingClient.id).length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>
                        Aucun devis enregistré pour ce client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID Client</th>
              <th>Nom / Raison Sociale</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th>NIF</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data.clients || []).map(c => {
              const clientQuotes = (data.quotes || []).filter(q => q.clientId === c.id);
              return (
              <React.Fragment key={c.id}>
                <tr>
                  <td data-label="ID" style={{ fontWeight: 600, color: '#64748b' }}>{c.id}</td>
                  <td data-label="Nom" style={{ fontWeight: 600 }}>{c.nom}</td>
                  <td data-label="Tél.">{c.telephone || '-'}</td>
                  <td data-label="Email">{c.email || '-'}</td>
                  <td data-label="NIF">{c.nif || '-'}</td>
                  <td data-label="Actions" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                      <button className="btn" onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)} title="Voir les devis" style={{ padding: '0.4rem', color: clientQuotes.length > 0 ? '#3b82f6' : '#94a3b8', background: expandedClient === c.id ? '#e0f2fe' : 'transparent' }}>
                        <FileText size={16} />
                        {clientQuotes.length > 0 && <span style={{ marginLeft: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>({clientQuotes.length})</span>}
                        {expandedClient === c.id ? <ChevronUp size={14} style={{ marginLeft: '4px' }}/> : <ChevronDown size={14} style={{ marginLeft: '4px' }}/>}
                      </button>
                      <button className="btn" onClick={() => setEditingClient(c)} title="Modifier via formulaire" style={{ padding: '0.4rem' }}>
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedClient === c.id && (
                  <tr>
                    <td colSpan="6" style={{ padding: 0, background: '#f8fafc' }}>
                      <div style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <FileText size={18} color="#3b82f6" />
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>Devis pour {c.nom}</h4>
                        </div>
                        {clientQuotes.length === 0 ? (
                           <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Aucun devis enregistré pour ce client.</p>
                        ) : (
                          <div className="table-responsive">
                            <table className="data-table" style={{ background: 'white' }}>
                              <thead>
                                <tr>
                                  <th>N° Devis</th>
                                  <th>Date</th>
                                  <th>Produits</th>
                                  <th>Montant HT</th>
                                  <th>Montant TTC</th>
                                  <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {clientQuotes.map(q => (
                                  <tr key={q.id}>
                                    <td data-label="N°" style={{ fontWeight: 700, color: '#3b82f6' }}>{q.number}</td>
                                    <td data-label="Date">{new Date(q.createdAt).toLocaleDateString('fr-FR')}</td>
                                    <td data-label="Prd.">{q.items?.length || 0}</td>
                                    <td data-label="HT" style={{ fontWeight: 600 }}>{q.totals?.ht?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                                    <td data-label="TTC" style={{ fontWeight: 700 }}>{q.totals?.ttc?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                        <button onClick={() => { if(onOpenQuote) onOpenQuote(q); }} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#2563eb', borderColor: '#2563eb' }}>
                                          Détails
                                        </button>
                                        <button onClick={() => handleConvertToOrder(q)} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#10b981' }}>
                                          Rendre Commande
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )})}
            {(!data.clients || data.clients.length === 0) && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  Aucun client enregistré. Cliquez sur "Nouveau Client" pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsModule;
