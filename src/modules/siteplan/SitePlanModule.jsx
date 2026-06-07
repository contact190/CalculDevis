import React, { useState } from 'react';
import { Plus, Trash2, ClipboardList, CheckCircle, FolderOpen, ArrowRight, Building, HelpCircle, Layout, Copy, Info, X } from 'lucide-react';
import { getTechnicalDrawingDataURL } from '../../utils/drawingUtils';

/**
 * Sync tree site plan structure back to flat siteMeasurements inside order items
 */
function syncSitePlanToMeasurements(sitePlan, orderItems) {
  const flat = [];
  (sitePlan?.floors || []).forEach(floor => {
    (floor.apartments || []).forEach(apt => {
      (apt.voids || []).forEach(v => {
        if (!v.itemId) return;

        // Build shutterList from the void shutter configuration
        const shutterList = [];
        if (v.shutter && v.shutter.qty > 0) {
          shutterList.push({
            id: v.shutter.id || `shutter-${v.id}`,
            qty: v.shutter.qty,
            customLV: v.shutter.customLV !== undefined ? v.shutter.customLV : (v.L || 0),
            overrides: v.shutter.overrides || {}
          });
        }

        const autoName = `${floor.name}${apt.name}${apt.voids.indexOf(v) + 1}`;

        flat.push({
          id: v.id,
          itemId: v.itemId,
          L: v.L !== undefined ? v.L : 0,
          H: v.H !== undefined ? v.H : 0,
          wallDepth: v.wallDepth !== undefined ? v.wallDepth : 0,
          handleHeight: v.handleHeight !== undefined ? v.handleHeight : undefined,
          qty: 1,
          instanceFloors: [floor.name],
          instanceNames: [autoName],
          shutterList: shutterList,
          partOverrides: v.partOverrides || {}
        });
      });
    });
  });

  // Now, merge back into orderItems.
  // Group flat items by itemId, then map to each order item.
  return orderItems.map(item => {
    const matched = flat.filter(f => f.itemId === item.id);
    return {
      ...item,
      siteMeasurements: matched
    };
  });
}

export default function SitePlanModule({ data, setData }) {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [infoPopupItem, setInfoPopupItem] = useState(null);

  const clients = data?.clients || [];
  
  // Active client object
  const selectedClient = selectedClientId
    ? clients.find(c => c.id === selectedClientId)
    : null;

  const clientPlans = selectedClient?.sitePlans || [];
  const activeSitePlan = selectedPlanId ? clientPlans.find(p => p.id === selectedPlanId) : null;

  // Filter quotes by the selected client
  const clientQuotes = selectedClientId 
    ? (data?.quotes || []).filter(o => o.clientId === selectedClientId)
    : [];

  const selectedQuote = selectedQuoteId 
    ? clientQuotes.find(o => o.id === selectedQuoteId)
    : null;

  // DB update helper for client site plan & syncing
  const handleUpdateSitePlan = (updatedPlan) => {
    setData(prev => {
      // 1. Update the client's sitePlans array
      const updatedClients = (prev.clients || []).map(c => {
        if (c.id !== selectedClientId) return c;
        const plans = c.sitePlans || [];
        const planExists = plans.some(p => p.id === updatedPlan.id);
        const newPlans = planExists 
          ? plans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
          : [...plans, updatedPlan];
        return { ...c, sitePlans: newPlans };
      });

      // 2. Sync this plan to ALL quotes that are assigned to it
      let updatedQuotes = prev.quotes || [];
      const quotesToSync = updatedQuotes.filter(o => o.sitePlanId === updatedPlan.id);
      
      quotesToSync.forEach(quoteToSync => {
        const syncedItems = syncSitePlanToMeasurements(updatedPlan, quoteToSync.items);
        updatedQuotes = updatedQuotes.map(o => 
          o.id === quoteToSync.id ? { ...o, items: syncedItems } : o
        );
      });

      return {
        ...prev,
        clients: updatedClients,
        quotes: updatedQuotes
      };
    });
  };

  const createNewPlan = () => {
    if (!selectedClientId) return;
    const name = window.prompt("Nom du nouveau plan de chantier :", `Plan ${clientPlans.length + 1}`);
    if (!name) return;
    
    const newPlan = {
      id: `plan-${Date.now()}`,
      name: name,
      floors: []
    };
    handleUpdateSitePlan(newPlan);
    setSelectedPlanId(newPlan.id);
  };

  const deletePlan = (planId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce plan ?")) return;
    setData(prev => {
      const updatedClients = (prev.clients || []).map(c => {
        if (c.id !== selectedClientId) return c;
        return { ...c, sitePlans: (c.sitePlans || []).filter(p => p.id !== planId) };
      });
      return { ...prev, clients: updatedClients };
    });
    if (selectedPlanId === planId) setSelectedPlanId('');
  };

  const renamePlan = () => {
    if (!activeSitePlan) return;
    const name = window.prompt("Nouveau nom du plan :", activeSitePlan.name);
    if (!name) return;
    handleUpdateSitePlan({ ...activeSitePlan, name });
  };

  const assignQuoteToPlan = () => {
    if (!selectedQuoteId || !activeSitePlan) return;
    setData(prev => {
      let updatedQuotes = (prev.quotes || []).map(q => 
        q.id === selectedQuoteId ? { ...q, sitePlanId: activeSitePlan.id } : q
      );
      
      const quoteToSync = updatedQuotes.find(q => q.id === selectedQuoteId);
      const syncedItems = syncSitePlanToMeasurements(activeSitePlan, quoteToSync.items);
      updatedQuotes = updatedQuotes.map(q => 
        q.id === selectedQuoteId ? { ...q, items: syncedItems } : q
      );

      return { ...prev, quotes: updatedQuotes };
    });
    alert("Devis rattaché à ce plan !");
  };

  // Helper to initialize sitePlan
  const initializeSitePlan = () => {
    if (!selectedClientId) return;
    const updatedPlan = { floors: [] };
    handleUpdateSitePlan(updatedPlan);
  };

  // State mutation actions
  const addFloor = () => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const floors = [...(currentPlan.floors || [])];
    const newFloor = {
      id: `floor-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `${floors.length + 1}`,
      apartments: []
    };
    const updatedPlan = { ...currentPlan, floors: [...floors, newFloor] };
    handleUpdateSitePlan(updatedPlan);
  };

  const deleteFloor = (floorId) => {
    if (!activeSitePlan) return;
    if (!window.confirm("Voulez-vous supprimer cet étage et tous ses appartements / vides ?")) return;
    const currentPlan = activeSitePlan;
    const floors = (currentPlan.floors || []).filter(f => f.id !== floorId);
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const updateFloorName = (floorId, name) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const floors = (currentPlan.floors || []).map(f => 
      f.id === floorId ? { ...f, name } : f
    );
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const addApartment = (floorId) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      const apts = f.apartments || [];
      const newAptName = String.fromCharCode(65 + apts.length);
      const newApt = {
        id: `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: newAptName,
        voids: []
      };
      return { ...f, apartments: [...apts, newApt] };
    });
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const duplicateFloor = (floorId) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const floorToDuplicate = currentPlan.floors.find(f => f.id === floorId);
    if (!floorToDuplicate) return;

    const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    
    const clonedFloor = JSON.parse(JSON.stringify(floorToDuplicate));
    clonedFloor.id = generateId('floor');
    clonedFloor.name = `${clonedFloor.name} (Copie)`;
    
    clonedFloor.apartments = (clonedFloor.apartments || []).map(apt => ({
      ...apt,
      id: generateId('apt'),
      voids: (apt.voids || []).map(v => {
        const newV = { ...v, id: generateId('void') };
        if (newV.shutter) {
           newV.shutter.id = `shutter-${newV.id}`;
        }
        return newV;
      })
    }));

    const floors = [...currentPlan.floors];
    const floorIndex = floors.findIndex(f => f.id === floorId);
    floors.splice(floorIndex + 1, 0, clonedFloor);

    handleUpdateSitePlan({ ...currentPlan, floors });
  };

  const duplicateApartment = (floorId, aptId) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    
    const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      const aptToDuplicate = (f.apartments || []).find(a => a.id === aptId);
      if (!aptToDuplicate) return f;

      const clonedApt = JSON.parse(JSON.stringify(aptToDuplicate));
      clonedApt.id = generateId('apt');
      clonedApt.name = `${clonedApt.name} (Copie)`;
      
      clonedApt.voids = (clonedApt.voids || []).map(v => {
        const newV = { ...v, id: generateId('void') };
        if (newV.shutter) {
           newV.shutter.id = `shutter-${newV.id}`;
        }
        return newV;
      });

      const newApts = [...(f.apartments || [])];
      const aptIndex = newApts.findIndex(a => a.id === aptId);
      newApts.splice(aptIndex + 1, 0, clonedApt);

      return { ...f, apartments: newApts };
    });

    handleUpdateSitePlan({ ...currentPlan, floors });
  };

  const deleteApartment = (floorId, aptId) => {
    if (!activeSitePlan) return;
    if (!window.confirm("Voulez-vous supprimer cet appartement et tous ses vides ?")) return;
    const currentPlan = activeSitePlan;
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        apartments: (f.apartments || []).filter(a => a.id !== aptId)
      };
    });
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const updateApartmentName = (floorId, aptId, name) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        apartments: (f.apartments || []).map(a => a.id === aptId ? { ...a, name } : a)
      };
    });
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const addVoid = (floorId, aptId) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const defaultItem = selectedQuote?.items?.[0];
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        apartments: (f.apartments || []).map(a => {
          if (a.id !== aptId) return a;
          const voids = a.voids || [];
          const newV = {
            id: `void-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: ``,
            itemId: '',
            L: defaultItem?.config?.L || undefined,
            H: defaultItem?.config?.H || undefined,
            wallDepth: undefined,
            handleHeight: undefined,
            shutter: null
          };
          return { ...a, voids: [...voids, newV] };
        })
      };
    });
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const deleteVoid = (floorId, aptId, voidId) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        apartments: (f.apartments || []).map(a => {
          if (a.id !== aptId) return a;
          return {
            ...a,
            voids: (a.voids || []).filter(v => v.id !== voidId)
          };
        })
      };
    });
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const updateVoidProperty = (floorId, aptId, voidId, propertyPath, value) => {
    if (!activeSitePlan) return;
    const currentPlan = activeSitePlan;
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        apartments: (f.apartments || []).map(a => {
          if (a.id !== aptId) return a;
          return {
            ...a,
            voids: (a.voids || []).map(v => {
              if (v.id !== voidId) return v;

              let updatedVoid = { ...v };
              if (propertyPath === 'name') {
                updatedVoid.name = value;
              } else if (propertyPath === 'itemId') {
                updatedVoid.itemId = value;
                const matchedItem = selectedQuote?.items?.find(i => i.id === value);
                if (matchedItem) {
                  updatedVoid.L = matchedItem.config?.L;
                  updatedVoid.H = matchedItem.config?.H;
                }
              }

              return updatedVoid;
            })
          };
        })
      };
    });
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Premium Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Building size={28} color="#10b981" /> Plan de Chantier
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Structurez vos projets par Étage 🏢 ➜ Appartement 🚪 ➜ Vide 📐 puis assignez les menuiseries du devis.
          </p>
        </div>
      </header>

      {/* Selectors Panel */}
      <div className="glass shadow-sm" style={{ padding: '1.5rem', background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Client Selection */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>1. Sélectionnez le Client</label>
            <select
              className="input"
              value={selectedClientId}
              onChange={e => {
                setSelectedClientId(e.target.value);
                setSelectedPlanId('');
                setSelectedQuoteId('');
              }}
              style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
            >
              <option value="">-- Choisissez un client --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.nom} {c.prenom ? `(${c.prenom})` : ''} - {c.telephone || c.ville}</option>
              ))}
            </select>
          </div>

          {/* Plan Selection */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>2. Choisissez le Plan</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                className="input"
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(e.target.value)}
                disabled={!selectedClientId}
                style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
              >
                <option value="">-- Sélectionnez un plan --</option>
                {clientPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button 
                onClick={createNewPlan} 
                disabled={!selectedClientId}
                className="btn btn-primary" 
                style={{ padding: '0.6rem', display: 'flex', alignItems: 'center' }}
                title="Créer un nouveau plan"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Quote Selection & Assignment (only if plan is active) */}
        {activeSitePlan && (
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>3. Associer un Devis à ce Plan</label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select
                className="input"
                value={selectedQuoteId}
                onChange={e => setSelectedQuoteId(e.target.value)}
                style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
              >
                <option value="">-- Sélectionnez un devis pour l'associer --</option>
                {clientQuotes.map(o => (
                  <option key={o.id} value={o.id}>
                    Devis {o.number || o.id} - {o.items?.length || 0} produits {o.sitePlanId === activeSitePlan.id ? '(Déjà rattaché)' : ''}
                  </option>
                ))}
              </select>
              <button 
                onClick={assignQuoteToPlan}
                disabled={!selectedQuoteId}
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1rem', background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd', fontWeight: 700 }}
              >
                Associer au plan actif
              </button>
            </div>
            
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
              <strong>Devis associés :</strong> {
                clientQuotes.filter(q => q.sitePlanId === activeSitePlan.id).map(q => q.number || q.id).join(', ') || 'Aucun'
              }
            </div>
          </div>
        )}
      </div>

      {/* Main Structural Editor Block */}
      {!selectedClientId && (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #cbd5e1' }}>
          <Building size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>En attente de sélection</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
            Veuillez sélectionner un client dans le sélecteur ci-dessus pour afficher et structurer son plan de chantier.
          </p>
        </div>
      )}

      {selectedClientId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* If sitePlan is not initialized */}
          {!activeSitePlan ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #10b981' }}>
              <Layout size={44} color="#10b981" style={{ marginBottom: '1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>Créer un Plan pour ce client</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                Vous devez sélectionner ou créer un nouveau plan de chantier pour pouvoir ajouter des étages et des pièces.
              </p>
              <button onClick={createNewPlan} className="btn btn-primary" style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 auto' }}>
                <Plus size={16} /> Créer un Plan de Chantier
              </button>
            </div>
          ) : (
            
            /* Structural tree editor */
            <div className="glass shadow-sm" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>🧱 Plan actif : {activeSitePlan.name}</h3>
                  <button onClick={renamePlan} className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#64748b' }}>Renommer</button>
                  <button onClick={() => deletePlan(activeSitePlan.id)} className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}>Supprimer</button>
                </div>
                <button onClick={addFloor} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#10b981' }}>
                  <Plus size={16} /> Ajouter un Étage
                </button>
              </div>

              {/* Tree Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(activeSitePlan.floors || []).map(floor => (
                  <div key={floor.id} style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem', background: '#f8fafc' }}>
                    
                    {/* Floor Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🏢 Étage</span>
                      <input
                        type="number"
                        className="input"
                        value={floor.name}
                        onChange={e => updateFloorName(floor.id, e.target.value)}
                        style={{ fontWeight: 700, fontSize: '1.05rem', padding: '0.3rem 0.6rem', width: '80px' }}
                      />
                      <button onClick={() => addApartment(floor.id)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'white' }}>
                        <Plus size={14} /> Ajouter un Appartement
                      </button>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => duplicateFloor(floor.id)} style={{ color: '#6366f1', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Dupliquer l'étage">
                          <Copy size={18} />
                        </button>
                        <button onClick={() => deleteFloor(floor.id)} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Supprimer l'étage">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Apartments List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1.5rem' }}>
                      {(floor.apartments || []).map(apt => (
                        <div key={apt.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '1rem' }}>🚪 Appartement</span>
                            <input
                              type="text"
                              className="input"
                              value={apt.name}
                              onChange={e => updateApartmentName(floor.id, apt.id, e.target.value)}
                              style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0.25rem 0.5rem', width: '120px' }}
                            />
                            <button onClick={() => addVoid(floor.id, apt.id)} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f8fafc' }}>
                              <Plus size={12} /> Ajouter un Vide
                            </button>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                              <button onClick={() => duplicateApartment(floor.id, apt.id)} style={{ color: '#6366f1', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Dupliquer l'appartement">
                                <Copy size={16} />
                              </button>
                              <button onClick={() => deleteApartment(floor.id, apt.id)} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Supprimer l'appartement">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Voids List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                            {(apt.voids || []).map((v, vIndex) => {
                              const autoName = `${floor.name}${apt.name}${vIndex + 1}`;
                              return (
                              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Vide :</span>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, padding: '0.2rem 0.4rem', width: '60px', color: '#334155', background: '#e2e8f0', borderRadius: '4px', textAlign: 'center' }}>
                                  {autoName}
                                </div>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginLeft: '0.5rem' }}>Assigné à la Menuiserie :</span>
                                {selectedQuote ? (() => {
                                  const selItem = selectedQuote.items?.find(i => i.id === v.itemId);
                                  return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <select
                                      className="input"
                                      value={v.itemId}
                                      onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'itemId', e.target.value)}
                                      style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', width: '350px' }}
                                    >
                                      <option value="">Sélectionnez un produit...</option>
                                      {selectedQuote.items?.map(item => {
                                        const itemComp = (data.compositions || []).find(c => c.id === item.config?.compositionId);
                                        const itemRange = itemComp ? (data.ranges || []).find(r => r.id === itemComp.rangeId) : null;
                                        const gammeName = itemRange?.name || itemComp?.rangeId || '—';
                                        return (
                                        <option key={item.id} value={item.id}>
                                          [{item.label || '?'}] {itemComp?.name || item.categoryId || item.type || 'Prod'} - {item.config?.L || '?'}x{item.config?.H || '?'} - Gamme: {gammeName}
                                        </option>
                                        );
                                      })}
                                    </select>
                                    <button 
                                      onClick={() => { if (selItem) setInfoPopupItem(selItem); }}
                                      disabled={!selItem}
                                      style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        cursor: selItem ? 'pointer' : 'not-allowed', 
                                        color: selItem ? '#3b82f6' : '#cbd5e1',
                                        background: selItem ? '#eff6ff' : 'transparent',
                                        padding: '0.35rem',
                                        borderRadius: '50%',
                                        border: selItem ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                        transition: 'all 0.2s'
                                      }}
                                      title={selItem ? "Voir les détails du produit" : "Sélectionnez un produit pour voir les détails"}
                                    >
                                      <Info size={18} />
                                    </button>
                                  </div>
                                )})() : (
                                  <span style={{ fontSize: '0.8rem', color: '#b45309', fontStyle: 'italic', background: '#fffbeb', border: '1px solid #fef3c7', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                    ⚠️ Sélectionnez un Devis ci-dessus pour assigner ce vide.
                                  </span>
                                )}

                                <button onClick={() => deleteVoid(floor.id, apt.id, v.id)} style={{ marginLeft: 'auto', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Supprimer le vide">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                            })}
                            {(apt.voids || []).length === 0 && (
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.25rem 0' }}>Aucun vide créé dans cet appartement.</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(floor.apartments || []).length === 0 && (
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '1.5rem' }}>Aucun appartement dans cet étage.</div>
                      )}
                    </div>
                  </div>
                ))}

                {(activeSitePlan.floors || []).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: '1rem', border: '2px dashed #cbd5e1' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🏢</span>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Aucune structure de chantier définie</h4>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                      Commencez par structurer votre chantier en ajoutant des étages et des appartements pour y distribuer les ouvertures.
                    </p>
                    <button onClick={addFloor} className="btn btn-primary" style={{ background: '#10b981' }}>
                      Créer le premier Étage
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Info Popup Modal */}
      {infoPopupItem && (() => {
        const popupComp = (data.compositions || []).find(c => c.id === infoPopupItem.config?.compositionId);
        const popupRange = popupComp ? (data.ranges || []).find(r => r.id === popupComp.rangeId) : null;
        let gammeDisplay = popupRange?.name || '—';

        if (infoPopupItem.config?.compoundType && infoPopupItem.config.compoundType !== 'none' && infoPopupItem.config.compoundConfig?.parts) {
           const parts = infoPopupItem.config.compoundConfig.parts;
           const ouvrantCompId = parts.find(p => p.type === 'opening')?.compositionId;
           const fixeCompId = parts.find(p => p.type === 'fixe')?.compositionId;
           
           const ouvrantComp = (data.compositions || []).find(c => c.id === ouvrantCompId);
           const fixeComp = (data.compositions || []).find(c => c.id === fixeCompId);
           
           const ouvrantRange = ouvrantComp ? (data.ranges || []).find(r => r.id === ouvrantComp.rangeId)?.name : '';
           const fixeRange = fixeComp ? (data.ranges || []).find(r => r.id === fixeComp.rangeId)?.name : '';
           
           if (ouvrantRange && fixeRange && ouvrantRange !== fixeRange) {
              gammeDisplay = `${ouvrantRange} (Ouvrant) + ${fixeRange} (Fixe)`;
           } else if (ouvrantRange || fixeRange) {
              gammeDisplay = ouvrantRange || fixeRange;
           }
        }

        const popupColor = (data.colors || []).find(c => c.id === infoPopupItem.config?.colorId);
        const techDrawing = getTechnicalDrawingDataURL(infoPopupItem.config, data);
        return (
          <div 
            onClick={() => setInfoPopupItem(null)}
            style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, animation: 'fadeIn 0.2s ease'
            }}
          >
            <div 
              onClick={e => e.stopPropagation()}
              style={{
                background: 'white', borderRadius: '1.25rem', padding: '2rem',
                width: '560px', maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)', position: 'relative',
                animation: 'slideUp 0.25s ease'
              }}
            >
              {/* Close button */}
              <button 
                onClick={() => setInfoPopupItem(null)}
                style={{ 
                  position: 'absolute', top: '1rem', right: '1rem',
                  background: '#f1f5f9', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.target.style.background = '#e2e8f0'; e.target.style.color = '#1e293b'; }}
                onMouseLeave={e => { e.target.style.background = '#f1f5f9'; e.target.style.color = '#64748b'; }}
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={20} color="#3b82f6" /> Détails du Produit
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Informations de la menuiserie assignée à ce vide
                </p>
              </div>

              {/* Technical Drawing */}
              {techDrawing && (
                <div style={{ 
                  background: '#f8fafc', borderRadius: '0.75rem', padding: '1rem',
                  border: '1px solid #e2e8f0', marginBottom: '1.25rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <img 
                    src={techDrawing} 
                    alt="Dessin technique" 
                    style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} 
                  />
                </div>
              )}

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: '#f0fdf4', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Référence</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#166534' }}>{infoPopupItem.label || '—'}</div>
                </div>
                <div style={{ background: '#eff6ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Composition</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e40af' }}>{popupComp?.name || infoPopupItem.categoryId || '—'}</div>
                </div>
                <div style={{ background: '#faf5ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Gamme</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#6b21a8' }}>{gammeDisplay}</div>
                </div>
                <div style={{ background: '#fff7ed', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Dimensions</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#9a3412' }}>{infoPopupItem.config?.L || '?'} × {infoPopupItem.config?.H || '?'} mm</div>
                </div>
                <div style={{ background: '#f0f9ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #bae6fd', gridColumn: popupColor ? 'auto' : '1 / -1' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Couleur</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#075985' }}>{popupColor?.name || infoPopupItem.config?.colorId || '—'}</div>
                </div>
                {infoPopupItem.config?.openingType && (
                  <div style={{ background: '#fefce8', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #fef08a' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Type d'ouverture</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#854d0e' }}>{infoPopupItem.config.openingType}</div>
                  </div>
                )}
                {infoPopupItem.config?.hasShutter && (
                  <div style={{ background: '#fdf4ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #f5d0fe', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#86198f', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Détails du Volet</div>
                    <div style={{ fontSize: '0.85rem', color: '#701a75' }}>
                      {(() => {
                        const sCfg = infoPopupItem.config?.shutterConfig || {};
                        const caisson = (data.accessories || []).find(a => a.id === sCfg.caissonId)?.name || sCfg.caissonId;
                        const lame = (data.accessories || []).find(a => a.id === sCfg.lameId)?.name || sCfg.lameId;
                        const moteur = (data.accessories || []).find(a => a.id === sCfg.kitId)?.name || sCfg.kitId;
                        return `Caisson: ${caisson || '-'} | Lame: ${lame || '-'} | Motorisation: ${moteur || '-'}`;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity info */}
              <div style={{ marginTop: '1rem', padding: '0.6rem 0.75rem', background: '#f1f5f9', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span>Quantité devis : <strong>{infoPopupItem.qty || 1}</strong></span>
                <span>ID : <strong style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{infoPopupItem.id}</strong></span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
