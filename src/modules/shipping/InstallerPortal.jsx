import React, { useState, useMemo } from 'react';
import { Truck, Wrench, CheckCircle, ArrowLeft, QrCode, Camera, Package, UserCheck, ShieldCheck, ClipboardList, MessageSquare, Send, X, RefreshCw, AlertTriangle } from 'lucide-react';
import QRScanner from './QRScanner';
import { uploadInstallerPhoto } from '../../utils/supabaseClient';

const InstallerPortal = ({ data, setData, orderId, refetchData, isOnline, isSyncing }) => {
  const [view, setView] = useState('menu'); // 'menu', 'delivery', 'manutention', 'installation'
  const [selectedUnits, setSelectedUnits] = useState(new Set());
  const [scannedId, setScannedId] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState('alu'); // 'alu' or 'vitrage' for delivery/manut
  const [currentInstaller, setCurrentInstaller] = useState(sessionStorage.getItem('installer_name') || '');
  const [noteText, setNoteText] = useState('');
  const [noteImage, setNoteImage] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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
            const dual = order.unitStatusesDual?.[unitId] || { alu: 'En production', vitrage: 'En production' };
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

  const handleUpdateStatusDual = (unitIds, component, newStatus, actionType = 'finish', issueType = null) => {
    const nowIso = new Date().toISOString();
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === orderId);
      if (oIdx === -1) return prev;
      const o = { ...orders[oIdx] };
      const dualStatuses = { ...(o.unitStatusesDual || {}) };
      const timeline = { ...(o.unitTimeline || {}) };
      
      const event = {
        date: nowIso,
        user: currentInstaller || 'EXTERNE',
        component: component,
        status: newStatus,
        action: actionType,
        issue: issueType
      };

      unitIds.forEach(id => { 
        const current = dualStatuses[id] || { alu: 'En production', vitrage: 'En production' };
        
        // Only update the main status if it's a 'finish' action
        if (actionType === 'finish') {
          if (component === 'both') {
            current.alu = newStatus;
            current.vitrage = newStatus;
          } else {
            current[component] = newStatus;
          }
        }
        
        dualStatuses[id] = { ...current };
        
        if (!timeline[id]) timeline[id] = [];
        timeline[id].push(event);
      });
      
      o.unitStatusesDual = dualStatuses;
      o.unitTimeline = timeline;
      o._lastModified = nowIso;
      orders[oIdx] = o;
      return { ...prev, orders };
    });
  };

  const compressImage = (dataUrl, maxWidth = 800, quality = 0.65) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  };

  const handleSendFieldNote = async () => {
    if (!noteText.trim() && !noteImage) return;

    let imageUrl = noteImage;
    if (noteImage && noteImage.startsWith('data:image/')) {
      setIsUploadingPhoto(true);
      try {
        imageUrl = await uploadInstallerPhoto(noteImage, orderId);
      } catch (e) {
        console.warn("Could not upload note photo to Cloud Storage:", e);
      } finally {
        setIsUploadingPhoto(false);
      }
    }

    const nowIso = new Date().toISOString();
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === orderId);
      if (oIdx === -1) return prev;
      const o = { ...orders[oIdx] };
      const notes = [...(o.fieldNotes || [])];
      notes.push({
        id: `note-${Date.now()}`,
        date: nowIso,
        author: currentInstaller || 'Externe',
        text: noteText.trim(),
        image: imageUrl || null
      });
      o.fieldNotes = notes;
      o._lastModified = nowIso;
      orders[oIdx] = o;
      return { ...prev, orders };
    });
    setNoteText('');
    setNoteImage(null);
  };

  const handleSavePhoto = async (unitId, photoData) => {
    let photoUrl = photoData;
    if (photoData && photoData.startsWith('data:image/')) {
      setIsUploadingPhoto(true);
      try {
        photoUrl = await uploadInstallerPhoto(photoData, orderId);
      } catch (e) {
        console.warn("Could not upload installation photo to Cloud Storage:", e);
      } finally {
        setIsUploadingPhoto(false);
      }
    }

    const nowIso = new Date().toISOString();
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === orderId);
      if (oIdx === -1) return prev;
      const o = { ...orders[oIdx] };
      const photos = { ...(o.unitInstallationPhotos || {}) };
      photos[unitId] = photoUrl;
      o.unitInstallationPhotos = photos;
      o._lastModified = nowIso;
      orders[oIdx] = o;
      return { ...prev, orders };
    });
  };

  const installationPhotos = order?.unitInstallationPhotos || {};

  const unitsToDeliver = units.filter(u => activeTab === 'alu' ? (u.statusAlu === 'Produit' || u.statusAlu === 'En production') : (u.statusVitrage === 'Produit' || u.statusVitrage === 'En production'));
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
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800, background: isOnline ? '#dcfce7' : '#fee2e2', color: isOnline ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#22c55e' : '#ef4444' }} />
            {isOnline ? 'CONNECTÉ' : 'MODE HORS-LIGNE'}
          </div>
          {(isSyncing || isUploadingPhoto) ? (
            <div style={{ padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800, background: '#eff6ff', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <RefreshCw size={10} className="animate-spin" /> {isUploadingPhoto ? 'ENVOI PHOTO CLOUD...' : 'SYNCHRONISATION...'}
            </div>
          ) : (
            <div style={{ padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800, background: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle size={10} /> ÉTATS SYNCHRONISÉS
            </div>
          )}
        </div>
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

        <button 
          onClick={() => setView('journal')}
          className="glass" 
          style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1.5px solid #f59e0b', background: '#fffbeb', borderRadius: '1rem' }}
        >
          <MessageSquare size={24} style={{ color: '#f59e0b' }} />
          <div style={{ textAlign: 'left', flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#92400e' }}>4. JOURNAL CHANTIER</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#f59e0b' }}>Signaler problèmes & photos</p>
          </div>
          {(order.fieldNotes || []).length > 0 && (
            <span style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
              {(order.fieldNotes || []).length}
            </span>
          )}
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
            <div key={unit.id} style={{ padding: '1rem', background: 'white', borderRadius: '1rem', border: '2px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>{unit.name}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{unit.label}</p>
                </div>
                <button onClick={() => { handleUpdateStatusDual([unit.id], activeTab, 'Livré'); setScannedId(''); }} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>RÉCEPTIONNER</button>
              </div>
              <button 
                onClick={() => {
                  const reason = prompt("Type de problème à la réception (Casse, Manquant, Autre) :");
                  if (reason) handleUpdateStatusDual([unit.id], activeTab, 'PROBLÈME LIVRAISON', 'issue', reason);
                }}
                className="btn" 
                style={{ width: '100%', fontSize: '0.7rem', color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2', padding: '0.4rem' }}
              >
                <AlertTriangle size={12} /> SIGNALER PROBLÈME
              </button>
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
            <div key={unit.id} style={{ padding: '1rem', background: 'white', borderRadius: '1rem', border: '2px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>{unit.name}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>ÉTAGE: {unit.floor || 'N/A'}</p>
                </div>
                <button onClick={() => { handleUpdateStatusDual([unit.id], activeTab, 'Manutention'); setScannedId(''); }} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#10b981' }}>À L'ÉTAGE</button>
              </div>
              <button 
                onClick={() => {
                  const reason = prompt("Problème durant la manutention (Casse, Rayure, Difficulté accès) :");
                  if (reason) handleUpdateStatusDual([unit.id], activeTab, 'PROBLÈME MANUTENTION', 'issue', reason);
                }}
                className="btn" 
                style={{ width: '100%', fontSize: '0.7rem', color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2', padding: '0.4rem' }}
              >
                <AlertTriangle size={12} /> SIGNALER PROBLÈME
              </button>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              <div className="glass" style={{ padding: '0.75rem', background: '#f8fafc' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>POSE ALU</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {unit.statusAlu === 'Posé' || unit.statusAlu === 'Fini' ? (
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>✓ POSÉ</span>
                  ) : (
                    <button 
                      onClick={() => handleUpdateStatusDual([unit.id], 'alu', 'Posé', 'finish')}
                      className="btn btn-primary" style={{ background: '#8b5cf6', fontSize: '0.8rem', padding: '0.5rem' }}
                    >
                      VALIDER POSE
                    </button>
                  )}
                </div>
              </div>
              
              <div className="glass" style={{ padding: '0.75rem', background: '#f8fafc' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>VITRAGE / FINITION</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {unit.statusVitrage === 'Fini' ? (
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>✓ FINI</span>
                  ) : (
                    <button 
                      onClick={() => handleUpdateStatusDual([unit.id], 'vitrage', 'Fini', 'finish')}
                      className="btn btn-primary" style={{ background: '#10b981', fontSize: '0.8rem', padding: '0.5rem' }}
                      disabled={unit.statusAlu !== 'Posé' && unit.statusAlu !== 'Fini'}
                    >
                      VALIDER FINITION
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <label className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', background: installationPhotos[unit.id] ? '#d1fae5' : 'white', fontSize: '0.75rem', padding: '0.5rem' }}>
                <Camera size={14} /> {installationPhotos[unit.id] ? 'Photo OK' : 'Photo Pose'}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={async e => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        const compressed = await compressImage(ev.target.result, 800, 0.65);
                        handleSavePhoto(unit.id, compressed);
                      };
                      reader.readAsDataURL(file);
                    }
                  }} />
              </label>
              <button 
                onClick={() => {
                  const reason = prompt("Type de problème (Casse, Rayure, Erreur Mesure, Autre) :");
                  if (reason) handleUpdateStatusDual([unit.id], 'both', 'SIGNALÉ', 'issue', reason);
                }}
                className="btn" 
                style={{ flex: 1, fontSize: '0.75rem', color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2' }}
              >
                <AlertTriangle size={14} /> SIGNALER PROBLÈME
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderJournal = () => (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'white', borderBottom: '2px solid #fef3c7', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => setView('menu')} className="btn" style={{ padding: '0.5rem' }}><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Journal de Chantier</h2>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Commande: {order.id}</p>
        </div>
        <div style={{ background: '#fef3c7', borderRadius: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>
          {(order.fieldNotes || []).length} message(s)
        </div>
      </header>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
        {(order.fieldNotes || []).length === 0 ? (
          <div style={{ textAlign: 'center', opacity: 0.4, marginTop: '5rem' }}>
            <MessageSquare size={56} style={{ margin: '0 auto 1rem', display: 'block' }} />
            <p style={{ fontWeight: 600 }}>Aucun message</p>
            <p style={{ fontSize: '0.85rem' }}>Envoyez le premier rapport de chantier</p>
          </div>
        ) : (
          [...(order.fieldNotes || [])].reverse().map(note => (
            <div key={note.id} style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>{note.author}</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(note.date).toLocaleString('fr-FR')}</span>
              </div>
              {note.text && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: '1.5' }}>{note.text}</p>}
              {note.image && (
                <img src={note.image} alt="Photo chantier" style={{ width: '100%', borderRadius: '0.75rem', maxHeight: '250px', objectFit: 'cover' }} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: '1rem', background: 'white', borderTop: '2px solid #e2e8f0' }}>
        {noteImage && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.75rem' }}>
            <img src={noteImage} alt="preview" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '0.5rem' }} />
            <button onClick={() => setNoteImage(null)} style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <X size={12} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <textarea
            className="input"
            placeholder="Signaler un problème, une remarque..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            style={{ flex: 1, resize: 'none', minHeight: '48px', maxHeight: '120px', padding: '0.75rem' }}
            rows={2}
          />
          <label className="btn btn-secondary" style={{ padding: '0.75rem', cursor: 'pointer', flexShrink: 0, height: '48px', display: 'grid', placeItems: 'center' }}>
            <Camera size={20} />
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={async e => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = async ev => {
                  const compressed = await compressImage(ev.target.result, 800, 0.65);
                  setNoteImage(compressed);
                };
                reader.readAsDataURL(file);
              }
            }} />
          </label>
          <button
            onClick={handleSendFieldNote}
            disabled={!noteText.trim() && !noteImage}
            className="btn btn-primary"
            style={{ padding: '0.75rem', flexShrink: 0, height: '48px', background: '#f59e0b', display: 'grid', placeItems: 'center' }}
          >
            <Send size={20} />
          </button>
        </div>
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
        {view === 'journal' && renderJournal()}
      </div>
    </div>
  );
};

export default InstallerPortal;
