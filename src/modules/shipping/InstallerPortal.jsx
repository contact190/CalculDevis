import React, { useState, useMemo } from 'react';
import { Truck, Wrench, CheckCircle, ArrowLeft, QrCode, Camera, Package, UserCheck, ShieldCheck } from 'lucide-react';
import QRScanner from './QRScanner';

const InstallerPortal = ({ data, setData, orderId }) => {
  const [view, setView] = useState('menu'); // 'menu', 'delivery', 'installation'
  const [selectedUnits, setSelectedUnits] = useState(new Set());
  const [scannedId, setScannedId] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const order = useMemo(() => {
    return (data.orders || []).find(o => o.id === orderId);
  }, [data.orders, orderId]);

  const units = useMemo(() => {
    if (!order) return [];
    const list = [];
    (order.batches || []).forEach(batch => {
      (batch.items || []).forEach(item => {
        (item.measurements || []).forEach(m => {
          for (let i = 0; i < m.qty; i++) {
            const unitId = `${order.id}-${batch.id}-${item.id}-${m.id}-${i}`;
            list.push({
              id: unitId,
              name: m.instanceNames?.[i] || `${item.label} #${i + 1}`,
              label: item.label,
              dimensions: `${m.L} x ${m.H}`,
              status: order.unitStatuses?.[unitId] || 'Produit',
              floor: m.instanceFloors?.[i] || '',
            });
          }
        });
      });
    });
    return list;
  }, [order]);

  const handleUpdateStatus = (unitIds, newStatus) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === orderId);
      if (oIdx === -1) return prev;
      const o = { ...orders[oIdx] };
      const statuses = { ...(o.unitStatuses || {}) };
      unitIds.forEach(id => { statuses[id] = newStatus; });
      o.unitStatuses = statuses;
      orders[oIdx] = o;
      return { ...prev, orders };
    });
  };

  const handleSavePhoto = (unitId, photoData) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === orderId);
      if (oIdx === -1) return prev;
      const o = { ...orders[oIdx] };
      const photos = { ...(o.unitInstallationPhotos || {}) };
      photos[unitId] = photoData;
      o.unitInstallationPhotos = photos;
      orders[oIdx] = o;
      return { ...prev, orders };
    });
  };

  const installationPhotos = order?.unitInstallationPhotos || {};

  const shippableUnits = units.filter(u => u.status === 'Chargé');
  const installableUnits = units.filter(u => u.status === 'Livré');

  if (!order) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Commande Introuvable</h2>
        <p>Le lien est incorrect ou la commande n'existe plus.</p>
      </div>
    );
  }

  const renderMenu = () => (
    <div className="animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Portail Poseur</h1>
        <p style={{ color: '#64748b', margin: '0.2rem 0' }}>Commande: <strong>{order.id}</strong></p>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Client: {order.clientName || 'Inconnu'}</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
        <button 
          onClick={() => setView('delivery')}
          className="glass" 
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '2px solid #3b82f6', background: '#eff6ff', borderRadius: '1.5rem' }}
        >
          <div style={{ width: '64px', height: '64px', background: '#3b82f6', color: 'white', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
            <Truck size={32} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e40af' }}>LIVRER</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#3b82f6' }}>{shippableUnits.length} unité(s) à décharger</p>
          </div>
        </button>

        <button 
          onClick={() => setView('installation')}
          className="glass" 
          style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '2px solid #8b5cf6', background: '#f5f3ff', borderRadius: '1.5rem' }}
        >
          <div style={{ width: '64px', height: '64px', background: '#8b5cf6', color: 'white', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
            <Wrench size={32} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#5b21b6' }}>POSER</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#8b5cf6' }}>{installableUnits.length} unité(s) livrées</p>
          </div>
        </button>
      </div>

      <div style={{ marginTop: 'auto', textAlign: 'center', padding: '1rem', opacity: 0.5 }}>
        <ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
        <span style={{ fontSize: '0.75rem' }}>Accès Sécurisé Poseur</span>
      </div>
    </div>
  );

  const renderDelivery = () => (
    <div className="animate-fade-in" style={{ padding: '1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setView('menu')} className="btn" style={{ padding: '0.5rem' }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Validation Livraison</h2>
      </header>

      {shippableUnits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
          <Package size={48} style={{ margin: '0 auto 1rem' }} />
          <p>Rien à livrer pour le moment.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{shippableUnits.length} Unité(s)</span>
            <button 
              onClick={() => {
                if (selectedUnits.size === shippableUnits.length) setSelectedUnits(new Set());
                else setSelectedUnits(new Set(shippableUnits.map(u => u.id)));
              }}
              style={{ color: '#3b82f6', background: 'none', border: 'none', fontWeight: 700, fontSize: '0.9rem' }}
            >
              {selectedUnits.size === shippableUnits.length ? 'Tout déballer' : 'Tout sélectionner'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {shippableUnits.map(unit => (
              <div 
                key={unit.id} 
                onClick={() => {
                  const next = new Set(selectedUnits);
                  if (next.has(unit.id)) next.delete(unit.id); else next.add(unit.id);
                  setSelectedUnits(next);
                }}
                style={{ 
                  padding: '1rem', background: 'white', borderRadius: '1rem', border: '2px solid',
                  borderColor: selectedUnits.has(unit.id) ? '#3b82f6' : '#e2e8f0',
                  display: 'flex', alignItems: 'center', gap: '1rem'
                }}
              >
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', border: '2px solid #3b82f6', background: selectedUnits.has(unit.id) ? '#3b82f6' : 'transparent', display: 'grid', placeItems: 'center' }}>
                  {selectedUnits.has(unit.id) && <CheckCircle size={16} color="white" />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{unit.name}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{unit.label} | Étage: {unit.floor || 'N/A'}</p>
                </div>
              </div>
            ))}
          </div>

          <button 
            disabled={selectedUnits.size === 0}
            onClick={() => {
              handleUpdateStatus(Array.from(selectedUnits), 'Livré');
              setSelectedUnits(new Set());
              setView('menu');
              alert("Livraison validée !");
            }}
            className="btn btn-primary" 
            style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem', background: '#10b981' }}
          >
            VALIDER LA LIVRAISON ({selectedUnits.size})
          </button>
        </div>
      )}
    </div>
  );

  const renderInstallation = () => (
    <div className="animate-fade-in" style={{ padding: '1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setView('menu')} className="btn" style={{ padding: '0.5rem' }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Installation (Pose)</h2>
      </header>

      <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', background: '#f8fafc', textAlign: 'center' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700 }}>SCANNER QR CODE BORDEREAU</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            className="input" 
            placeholder="ID Fenêtre..." 
            style={{ textAlign: 'center', fontWeight: 700 }}
            value={scannedId}
            onChange={e => setScannedId(e.target.value)}
          />
          <button 
            onClick={() => setShowScanner(true)}
            className="btn btn-secondary" 
            style={{ padding: '0.5rem', background: '#8b5cf6', color: 'white' }}
          >
            <QrCode size={24} />
          </button>
        </div>
      </div>

      {showScanner && (
        <QRScanner 
          onScan={(text) => {
            setScannedId(text);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {scannedId && !units.find(u => u.id === scannedId) && (
          <div className="glass" style={{ padding: '1.5rem', background: '#fee2e2', border: '1px solid #fecaca', textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>Code inconnu : {scannedId}</p>
            <button onClick={() => setScannedId('')} style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#ef4444', textDecoration: 'underline', background: 'none', border: 'none' }}>Effacer</button>
          </div>
        )}

        {scannedId && units.find(u => u.id === scannedId && u.status === 'Posé') && (
          <div className="glass" style={{ padding: '1.5rem', background: '#d1fae5', border: '1px solid #6ee7b7', textAlign: 'center' }}>
             <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
             <p style={{ margin: 0, fontWeight: 800, color: '#065f46' }}>FENÊTRE DÉJÀ POSÉE</p>
             <p style={{ margin: 0, fontSize: '0.85rem', color: '#059669' }}>{units.find(u => u.id === scannedId).name}</p>
             <button onClick={() => setScannedId('')} className="btn" style={{ marginTop: '1rem', background: 'white' }}>Scanner une autre</button>
          </div>
        )}

        {scannedId && units.find(u => u.id === scannedId && u.status !== 'Livré' && u.status !== 'Posé') && (
          <div className="glass" style={{ padding: '1.5rem', background: '#fffbeb', border: '1px solid #fde68a', textAlign: 'center' }}>
             <Package size={32} color="#d97706" style={{ margin: '0 auto 0.5rem' }} />
             <p style={{ margin: 0, fontWeight: 800, color: '#92400e' }}>ATTENTION : STATUT INCOHÉRENT</p>
             <p style={{ margin: 0, fontSize: '0.85rem', color: '#b45309' }}>Cette fenêtre n'est pas encore marquée comme "LIVRÉE".</p>
             <p style={{ margin: '0.2rem 0', fontSize: '0.8rem' }}>Statut actuel : <strong>{units.find(u => u.id === scannedId).status}</strong></p>
             <button onClick={() => setScannedId('')} className="btn" style={{ marginTop: '1rem', background: 'white' }}>OK</button>
          </div>
        )}

        {installableUnits.filter(u => !scannedId || u.id === scannedId).map(unit => (
          <div key={unit.id} className="glass shadow-sm" style={{ padding: '1.25rem', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
               <div>
                 <p style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem' }}>{unit.name}</p>
                 <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{unit.label} | {unit.dimensions} mm</p>
                 <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 700 }}>Étage: {unit.floor || 'Non spécifié'}</p>
               </div>
               <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>LIVRÉ</span>
               </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <label className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', background: installationPhotos[unit.id] ? '#d1fae5' : 'white' }}>
                <Camera size={18} />
                <span style={{ fontSize: '0.85rem' }}>{installationPhotos[unit.id] ? 'Photo OK' : 'Photo Pose'}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  style={{ display: 'none' }} 
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        handleSavePhoto(unit.id, ev.target.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <button 
                onClick={() => {
                  handleUpdateStatus([unit.id], 'Posé');
                  setScannedId(''); // Clear search after validation
                  alert(`${unit.name} marqué comme POSÉ !`);
                }}
                className="btn btn-primary" 
                style={{ flex: 1, background: '#8b5cf6' }}
              >
                VALIDER POSE
              </button>
            </div>
          </div>
        ))}
        {installableUnits.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
            <UserCheck size={48} style={{ margin: '0 auto 1rem' }} />
            <p>Aucune fenêtre livrée en attente de pose.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f1f5f9', minHeight: '100vh' }}>
        {view === 'menu' && renderMenu()}
        {view === 'delivery' && renderDelivery()}
        {view === 'installation' && renderInstallation()}
      </div>
    </div>
  );
};

export default InstallerPortal;
