import React, { useState, useMemo } from 'react';
import { Truck, Wrench, CheckCircle, ArrowLeft, QrCode, Camera, Package, UserCheck, ShieldCheck, ClipboardList } from 'lucide-react';
import QRScanner from './QRScanner';

const InstallerPortal = ({ data, setData, orderId }) => {
  const [view, setView] = useState('menu'); // 'menu', 'delivery', 'manutention', 'installation'
  const [selectedUnits, setSelectedUnits] = useState(new Set());
  const [scannedId, setScannedId] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState('alu'); // 'alu' or 'vitrage' for delivery/manut
  const [currentInstaller, setCurrentInstaller] = useState(sessionStorage.getItem('installer_name') || '');

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
            const dual = order.unitStatusesDual?.[unitId] || { alu: 'Produit', vitrage: 'Produit' };
            list.push({
              id: unitId,
              name: m.instanceNames?.[i] || `${item.label} #${i + 1}`,
              label: item.label,
              dimensions: `${m.L} x ${m.H}`,
              statusAlu: dual.alu,
              statusVitrage: dual.vitrage,
              floor: m.instanceFloors?.[i] || '',
            });
          }
        });
      });
    });
    return list;
  }, [order]);

  const handleUpdateStatusDual = (unitIds, component, newStatus) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === orderId);
      if (oIdx === -1) return prev;
      const o = { ...orders[oIdx] };
      const dualStatuses = { ...(o.unitStatusesDual || {}) };
      const timeline = { ...(o.unitTimeline || {}) };
      
      const event = {
        date: new Date().toISOString(),
        user: currentInstaller || 'EXTERNE',
        component: component,
        status: newStatus
      };

      unitIds.forEach(id => { 
        const current = dualStatuses[id] || { alu: 'Produit', vitrage: 'Produit' };
        if (component === 'both') {
          current.alu = newStatus;
          current.vitrage = newStatus;
        } else {
          current[component] = newStatus;
        }
        dualStatuses[id] = { ...current };
        
        if (!timeline[id]) timeline[id] = [];
        timeline[id].push(event);
      });
      
      o.unitStatusesDual = dualStatuses;
      o.unitTimeline = timeline;
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

  const unitsToDeliver = units.filter(u => activeTab === 'alu' ? u.statusAlu === 'Produit' : u.statusVitrage === 'Produit');
  const unitsToManut = units.filter(u => activeTab === 'alu' ? u.statusAlu === 'Livré' : u.statusVitrage === 'Livré');
  const installableUnits = units.filter(u => u.statusAlu === 'Livré' || u.statusAlu === 'Manutention' || u.statusAlu === 'Posé');

  if (!order) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Commande Introuvable</h2>
        <p>Le lien est incorrect ou la commande n'existe plus.</p>
      </div>
    );
  }

  if (!currentInstaller && (order.installers || []).length > 0) {
    return (
      <div className="animate-fade-in" style={{ padding: '2rem', textAlign: 'center', background: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2rem' }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: '1.75rem', marginBottom: '0.5rem' }}>Qui êtes-vous ?</h1>
          <p style={{ color: '#64748b' }}>Sélectionnez votre nom pour commencer</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {order.installers.map(name => (
            <button key={name} onClick={() => { setCurrentInstaller(name); sessionStorage.setItem('installer_name', name); }} className="btn" style={{ padding: '1.25rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', fontWeight: 800, fontSize: '1.1rem' }}>
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const renderMenu = () => (
    <div className="animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Portail Poseur</h1>
        <p style={{ color: '#64748b', margin: '0.2rem 0' }}>Commande: <strong>{order.id}</strong></p>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Poseur: {currentInstaller || 'Externe'}</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        <button 
          onClick={() => { setView('delivery'); setActiveTab('alu'); }}
          className="glass" 
          style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1.5px solid #3b82f6', background: '#eff6ff', borderRadius: '1rem' }}
        >
          <Truck size={24} style={{ color: '#3b82f6' }} />
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>1. RÉCEPTION SITE</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#3b82f6' }}>Décharger le camion</p>
          </div>
        </button>

        <button 
          onClick={() => { setView('manutention'); setActiveTab('alu'); }}
          className="glass" 
          style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1.5px solid #10b981', background: '#ecfdf5', borderRadius: '1rem' }}
        >
          <Package size={24} style={{ color: '#10b981' }} />
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#065f46' }}>2. MANUTENTION</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#10b981' }}>Monter aux étages</p>
          </div>
        </button>

        <button 
          onClick={() => setView('installation')}
          className="glass" 
          style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1.5px solid #8b5cf6', background: '#f5f3ff', borderRadius: '1rem' }}
        >
          <Wrench size={24} style={{ color: '#8b5cf6' }} />
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#5b21b6' }}>3. POSE & FINITION</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#8b5cf6' }}>Installer et valider</p>
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
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Réception Site</h2>
      </header>

      <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setActiveTab('alu')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: activeTab === 'alu' ? 'white' : 'transparent', fontWeight: 700, fontSize: '0.9rem' }}>CHÂSSIS (ALU)</button>
        <button onClick={() => setActiveTab('vitrage')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: activeTab === 'vitrage' ? 'white' : 'transparent', fontWeight: 700, fontSize: '0.9rem' }}>VITRAGE</button>
      </div>

      <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', background: '#f8fafc', textAlign: 'center' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700 }}>SCANNER POUR LIVRAISON</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input" placeholder="ID Fenêtre..." style={{ textAlign: 'center', fontWeight: 700 }} value={scannedId} onChange={e => setScannedId(e.target.value)} />
          <button onClick={() => setShowScanner(true)} className="btn btn-secondary" style={{ padding: '0.5rem', background: '#3b82f6', color: 'white' }}><QrCode size={24} /></button>
        </div>
      </div>

      {showScanner && (
        <QRScanner onScan={(text) => { setScannedId(text); setShowScanner(false); }} onClose={() => setShowScanner(false)} />
      )}

      {unitsToDeliver.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
          <CheckCircle size={48} style={{ margin: '0 auto 1rem' }} />
          <p>Toutes les unités sont livrées ({activeTab.toUpperCase()})</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {unitsToDeliver.filter(u => !scannedId || u.id === scannedId).map(unit => (
            <div key={unit.id} style={{ padding: '1rem', background: 'white', borderRadius: '1rem', border: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>{unit.name}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{unit.label}</p>
              </div>
              <button onClick={() => { handleUpdateStatusDual([unit.id], activeTab, 'Livré'); setScannedId(''); }} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>RÉCEPTIONNER</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderManutention = () => (
    <div className="animate-fade-in" style={{ padding: '1rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setView('menu')} className="btn" style={{ padding: '0.5rem' }}><ArrowLeft size={20} /></button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Manutention</h2>
      </header>

      <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setActiveTab('alu')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: activeTab === 'alu' ? 'white' : 'transparent', fontWeight: 700, fontSize: '0.9rem' }}>CHÂSSIS (ALU)</button>
        <button onClick={() => setActiveTab('vitrage')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: activeTab === 'vitrage' ? 'white' : 'transparent', fontWeight: 700, fontSize: '0.9rem' }}>VITRAGE</button>
      </div>

      <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', background: '#f8fafc', textAlign: 'center' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700 }}>SCANNER POUR MANUTENTION</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input" placeholder="ID Fenêtre..." style={{ textAlign: 'center', fontWeight: 700 }} value={scannedId} onChange={e => setScannedId(e.target.value)} />
          <button onClick={() => setShowScanner(true)} className="btn btn-secondary" style={{ padding: '0.5rem', background: '#10b981', color: 'white' }}><QrCode size={24} /></button>
        </div>
      </div>

      {showScanner && (
        <QRScanner onScan={(text) => { setScannedId(text); setShowScanner(false); }} onClose={() => setShowScanner(false)} />
      )}

      {unitsToManut.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
          <Package size={48} style={{ margin: '0 auto 1rem' }} />
          <p>Toutes les unités sont à l'étage ({activeTab.toUpperCase()})</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {unitsToManut.filter(u => !scannedId || u.id === scannedId).map(unit => (
            <div key={unit.id} style={{ padding: '1rem', background: 'white', borderRadius: '1rem', border: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>{unit.name}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>ÉTAGE: {unit.floor || 'N/A'}</p>
              </div>
              <button onClick={() => { handleUpdateStatusDual([unit.id], activeTab, 'Manutention'); setScannedId(''); }} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#10b981' }}>À L'ÉTAGE</button>
            </div>
          ))}
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
          <input className="input" placeholder="ID Fenêtre..." style={{ textAlign: 'center', fontWeight: 700 }} value={scannedId} onChange={e => setScannedId(e.target.value)} />
          <button onClick={() => setShowScanner(true)} className="btn btn-secondary" style={{ padding: '0.5rem', background: '#8b5cf6', color: 'white' }}><QrCode size={24} /></button>
        </div>
      </div>

      {showScanner && (
        <QRScanner onScan={(text) => { setScannedId(text); setShowScanner(false); }} onClose={() => setShowScanner(false)} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {installableUnits.filter(u => !scannedId || u.id === scannedId).map(unit => (
          <div key={unit.id} className="glass shadow-sm" style={{ padding: '1.25rem', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
               <div>
                 <p style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem' }}>{unit.name}</p>
                 <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{unit.label} | {unit.dimensions} mm</p>
                 <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 700 }}>Étage: {unit.floor || 'N/A'}</p>
               </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <label className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', background: installationPhotos[unit.id] ? '#d1fae5' : 'white' }}>
                <Camera size={18} />
                <span style={{ fontSize: '0.85rem' }}>{installationPhotos[unit.id] ? 'Photo OK' : 'Photo Pose'}</span>
                <input 
                  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} 
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => handleSavePhoto(unit.id, ev.target.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <button 
                onClick={() => {
                  if (unit.statusAlu !== 'Posé' && unit.statusAlu !== 'Fini') {
                    handleUpdateStatusDual([unit.id], 'alu', 'Posé');
                    alert("Châssis Alu marqué comme POSÉ !");
                  } else {
                    handleUpdateStatusDual([unit.id], 'both', 'Fini');
                    alert("Fenêtre marquée comme FINIE !");
                  }
                  setScannedId('');
                }}
                className="btn btn-primary" 
                style={{ flex: 1, background: '#8b5cf6' }}
              >
                {unit.statusAlu === 'Posé' ? 'TERMINER (VITRAGE)' : 'VALIDER POSE ALU'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#f1f5f9', minHeight: '100vh' }}>
        {view === 'menu' && renderMenu()}
        {view === 'delivery' && renderDelivery()}
        {view === 'manutention' && renderManutention()}
        {view === 'installation' && renderInstallation()}
      </div>
    </div>
  );
};

export default InstallerPortal;
