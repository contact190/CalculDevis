import React, { useState } from 'react';
import { Plus, Trash2, ClipboardList, CheckCircle, FolderOpen, ArrowRight, Building, HelpCircle, Layout } from 'lucide-react';

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

        flat.push({
          id: v.id,
          itemId: v.itemId,
          L: v.L !== undefined ? v.L : 0,
          H: v.H !== undefined ? v.H : 0,
          wallDepth: v.wallDepth !== undefined ? v.wallDepth : 0,
          handleHeight: v.handleHeight !== undefined ? v.handleHeight : undefined,
          qty: 1,
          instanceFloors: [floor.name],
          instanceNames: [v.name],
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
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const clients = data?.clients || [];
  
  // Filter orders by the selected client
  const clientOrders = selectedClientId 
    ? (data?.orders || []).filter(o => o.clientId === selectedClientId)
    : [];

  const selectedOrder = selectedOrderId 
    ? (data?.orders || []).find(o => o.id === selectedOrderId)
    : null;

  // Active client object
  const selectedClient = selectedClientId
    ? clients.find(c => c.id === selectedClientId)
    : null;

  // DB update helper for client site plan & syncing
  const handleUpdateSitePlan = (updatedPlan) => {
    setData(prev => {
      // 1. Update the client
      const updatedClients = (prev.clients || []).map(c => 
        c.id === selectedClientId ? { ...c, sitePlan: updatedPlan } : c
      );

      // 2. If an order is selected, also sync this plan to the order's items
      let updatedOrders = prev.orders || [];
      if (selectedOrderId) {
        const orderToSync = updatedOrders.find(o => o.id === selectedOrderId);
        if (orderToSync) {
          const syncedItems = syncSitePlanToMeasurements(updatedPlan, orderToSync.items);
          updatedOrders = updatedOrders.map(o => 
            o.id === selectedOrderId ? { ...o, items: syncedItems } : o
          );
        }
      }

      return {
        ...prev,
        clients: updatedClients,
        orders: updatedOrders
      };
    });
  };

  // Helper to initialize sitePlan
  const initializeSitePlan = () => {
    if (!selectedClientId) return;
    const updatedPlan = { floors: [] };
    handleUpdateSitePlan(updatedPlan);
  };

  // State mutation actions
  const addFloor = () => {
    if (!selectedClientId) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
    const floors = [...(currentPlan.floors || [])];
    const newFloor = {
      id: `floor-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `Étage ${floors.length + 1}`,
      apartments: []
    };
    const updatedPlan = { ...currentPlan, floors: [...floors, newFloor] };
    handleUpdateSitePlan(updatedPlan);
  };

  const deleteFloor = (floorId) => {
    if (!selectedClientId) return;
    if (!window.confirm("Voulez-vous supprimer cet étage et tous ses appartements / vides ?")) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
    const floors = (currentPlan.floors || []).filter(f => f.id !== floorId);
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const updateFloorName = (floorId, name) => {
    if (!selectedClientId) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
    const floors = (currentPlan.floors || []).map(f => 
      f.id === floorId ? { ...f, name } : f
    );
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const addApartment = (floorId) => {
    if (!selectedClientId) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      const apts = f.apartments || [];
      const newApt = {
        id: `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: `Appartement ${apts.length + 1}`,
        voids: []
      };
      return { ...f, apartments: [...apts, newApt] };
    });
    const updatedPlan = { ...currentPlan, floors };
    handleUpdateSitePlan(updatedPlan);
  };

  const deleteApartment = (floorId, aptId) => {
    if (!selectedClientId) return;
    if (!window.confirm("Voulez-vous supprimer cet appartement et tous ses vides ?")) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
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
    if (!selectedClientId) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
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
    if (!selectedClientId) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
    const defaultItem = selectedOrder?.items?.[0];
    const floors = (currentPlan.floors || []).map(f => {
      if (f.id !== floorId) return f;
      return {
        ...f,
        apartments: (f.apartments || []).map(a => {
          if (a.id !== aptId) return a;
          const voids = a.voids || [];
          const newV = {
            id: `void-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: `Vide ${voids.length + 1}`,
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
    if (!selectedClientId) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
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
    if (!selectedClientId) return;
    const currentPlan = selectedClient?.sitePlan || { floors: [] };
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
                const matchedItem = selectedOrder?.items?.find(i => i.id === value);
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
      <div className="glass shadow-sm" style={{ padding: '1.5rem', background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Client Selection */}
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>1. Sélectionnez le Client</label>
          <select
            className="input"
            value={selectedClientId}
            onChange={e => {
              setSelectedClientId(e.target.value);
              setSelectedOrderId('');
            }}
            style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
          >
            <option value="">-- Choisissez un client --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nom} {c.prenom ? `(${c.prenom})` : ''} - {c.telephone || c.ville}</option>
            ))}
          </select>
        </div>

        {/* Order/Quote Selection */}
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>2. Sélectionnez la Commande / Devis</label>
          <select
            className="input"
            value={selectedOrderId}
            onChange={e => setSelectedOrderId(e.target.value)}
            disabled={!selectedClientId}
            style={{ width: '100%', fontSize: '0.9rem', fontWeight: 600, padding: '0.6rem' }}
          >
            <option value="">-- Choisissez un projet --</option>
            {clientOrders.map(o => (
              <option key={o.id} value={o.id}>Commande {o.id} (Devis {o.quoteNumber}) - {o.items?.length || 0} produits</option>
            ))}
          </select>
        </div>
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
          {!selectedClient?.sitePlan ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #10b981' }}>
              <Layout size={44} color="#10b981" style={{ marginBottom: '1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 700 }}>Créer la structure pour ce chantier</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                Ce client n'a pas encore de structure de chantier définie. Vous pouvez l'initialiser immédiatement pour ajouter des étages et des pièces.
              </p>
              <button onClick={initializeSitePlan} className="btn btn-primary" style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 auto' }}>
                <Plus size={16} /> Initialiser le Plan de Chantier
              </button>
            </div>
          ) : (
            
            /* Structural tree editor */
            <div className="glass shadow-sm" style={{ padding: '1.5rem', borderLeft: '4px solid #10b981', background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>🧱 Structure active : {selectedClient?.nom} {selectedClient?.prenom ? selectedClient.prenom : ''}</h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                    Le plan de chantier est sauvegardé au niveau du client et est conservé même si des devis ou commandes sont supprimés.
                  </p>
                </div>
                <button onClick={addFloor} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#10b981' }}>
                  <Plus size={16} /> Ajouter un Étage
                </button>
              </div>

              {/* Tree Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(selectedClient.sitePlan?.floors || []).map(floor => (
                  <div key={floor.id} style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.25rem', background: '#f8fafc' }}>
                    
                    {/* Floor Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🏢</span>
                      <input
                        type="text"
                        className="input"
                        value={floor.name}
                        onChange={e => updateFloorName(floor.id, e.target.value)}
                        style={{ fontWeight: 700, fontSize: '1.05rem', padding: '0.3rem 0.6rem', width: '220px' }}
                      />
                      <button onClick={() => addApartment(floor.id)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'white' }}>
                        <Plus size={14} /> Ajouter un Appartement
                      </button>
                      <button onClick={() => deleteFloor(floor.id)} style={{ marginLeft: 'auto', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Supprimer l'étage">
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Apartments List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1.5rem' }}>
                      {(floor.apartments || []).map(apt => (
                        <div key={apt.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '1rem' }}>🚪</span>
                            <input
                              type="text"
                              className="input"
                              value={apt.name}
                              onChange={e => updateApartmentName(floor.id, apt.id, e.target.value)}
                              style={{ fontWeight: 600, fontSize: '0.95rem', padding: '0.25rem 0.5rem', width: '200px' }}
                            />
                            <button onClick={() => addVoid(floor.id, apt.id)} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f8fafc' }}>
                              <Plus size={12} /> Ajouter un Vide
                            </button>
                            <button onClick={() => deleteApartment(floor.id, apt.id)} style={{ marginLeft: 'auto', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Supprimer l'appartement">
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Voids List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                            {(apt.voids || []).map(v => (
                              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Nom du Vide :</span>
                                <input
                                  type="text"
                                  className="input"
                                  value={v.name}
                                  onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'name', e.target.value)}
                                  placeholder="Ex: Vide 1 ou Salon..."
                                  style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', width: '180px' }}
                                />
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginLeft: '0.5rem' }}>Assigné à la Menuiserie :</span>
                                {selectedOrder ? (
                                  <select
                                    className="input"
                                    value={v.itemId}
                                    onChange={e => updateVoidProperty(floor.id, apt.id, v.id, 'itemId', e.target.value)}
                                    style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', width: '280px' }}
                                  >
                                    <option value="">Sélectionnez un produit...</option>
                                    {selectedOrder.items.map(item => (
                                      <option key={item.id} value={item.id}>{item.label} ({item.config.L}x{item.config.H})</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: '0.8rem', color: '#b45309', fontStyle: 'italic', background: '#fffbeb', border: '1px solid #fef3c7', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                    ⚠️ Sélectionnez un Devis/Commande ci-dessus pour assigner ce vide.
                                  </span>
                                )}

                                <button onClick={() => deleteVoid(floor.id, apt.id, v.id)} style={{ marginLeft: 'auto', color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer' }} title="Supprimer le vide">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
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

                {(selectedClient.sitePlan?.floors || []).length === 0 && (
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
    </div>
  );
}
