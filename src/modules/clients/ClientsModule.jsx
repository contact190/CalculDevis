import React, { useState } from 'react';
import { Users, Plus, Edit2, Trash2 } from 'lucide-react';

const ClientsModule = ({ data, setData }) => {
  const [editingClient, setEditingClient] = useState(null);

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

  const handleDeleteClient = (id) => {
    if (window.confirm('Supprimer ce client ?')) {
      setData(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== id) }));
      return true;
    }
    return false;
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
        </div>
      ) : null}

      <div className="glass shadow-md">
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
            {(data.clients || []).map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600, color: '#64748b' }}>{c.id}</td>
                <td style={{ fontWeight: 600 }}>{c.nom}</td>
                <td>{c.telephone || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>{c.nif || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn" onClick={() => setEditingClient(c)} style={{ padding: '0.4rem' }}>
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
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
