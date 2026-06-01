import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, Package, Settings, ChevronRight, LayoutDashboard, Users, RefreshCw, ShoppingBag, Truck, CheckCircle, Building } from 'lucide-react';
import CommercialModule from './modules/commercial/CommercialModule';
import ProductionModule from './modules/production/ProductionModule';
import AdminDashboard from './modules/admin/AdminDashboard';
import ClientsModule from './modules/clients/ClientsModule';
import OrdersModule from './modules/orders/OrdersModule';
import ShippingModule from './modules/shipping/ShippingModule';
import InstallerPortal from './modules/shipping/InstallerPortal';
import TechnicianPortal from './modules/orders/TechnicianPortal';
import SitePlanModule from './modules/siteplan/SitePlanModule';
import { DEFAULT_DATA } from './data/default-data';
import { syncDatabase } from './utils/supabaseClient';
import { persistentStorage } from './utils/storage';

const LOCAL_KEY = 'calculDevis_main';
const BACKUP_KEY = 'calculDevis_backup';

const DEFAULT_QUOTE_SETTINGS = {
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyRC: '',
  companyIMP: '',
  companyMF: '',
  companyBank: '',
  logoBase64: null,
  footerText: "Devis valable sous réserve d'acceptation dans le délai indiqué.",
  validityDays: 30,
  tvaRate: 19,
  quotePrefix: 'DEV-',
  quoteCounter: 1,
};

const makeNewQuote = (settings) => ({
  id: `QUOTE-${Date.now()}`,
  number: `${settings.quotePrefix}${String(settings.quoteCounter).padStart(3, '0')}`,
  clientId: null,
  createdAt: new Date().toISOString(),
  items: [],
  sitePlanId: null,
});

function App() {
  const [activeTab, setActiveTab] = useState('commercial');
  const [database, setDatabase] = useState(null); // null = loading
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'ok' | 'offline'
  const [lastCloudSync, setLastCloudSync] = useState(null);
  const saveTimerRef = useRef(null);
  const cloudSyncTimerRef = useRef(null);
  const isFirstLoad = useRef(true);

  const [quoteSettings, setQuoteSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('quoteSettings');
      return saved ? { ...DEFAULT_QUOTE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_QUOTE_SETTINGS;
    } catch { return DEFAULT_QUOTE_SETTINGS; }
  });

  const [currentQuote, setCurrentQuote] = useState(() => makeNewQuote(DEFAULT_QUOTE_SETTINGS));

  const [currentConfig, setCurrentConfig] = useState({
    L: 1200,
    H: 2150,
    compositionId: 'COUL-H36',
    colorId: 'RAL9016',
    glassId: 'V4-16-4',
    optionalSides: { top: false, bottom: false, left: false, right: false },
    selectedOptions: [],
    hasShutter: false,
    shutterConfig: { caissonId: 'CAI-140', lameId: 'LAM-39E', lameFinaleId: 'LF-ST', glissiereId: 'GLI-INVDC', axeId: 'AXE-40', kitId: 'KIT-SANG', enableBaguette: false },
    margin: 2.2
  });

  const generateUniqueId = (prefix = 'ID') => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const repairDatabase = useCallback((db) => {
    if (!db) return DEFAULT_DATA;
    const repaired = { ...db };
    Object.keys(DEFAULT_DATA).forEach(key => {
      if (repaired[key] === undefined || repaired[key] === null) {
        repaired[key] = DEFAULT_DATA[key];
      }
      if (Array.isArray(repaired[key])) {
        const seen = new Set();
        repaired[key] = repaired[key].filter(item => {
          if (!item) return false;
          const id = item.id || JSON.stringify(item);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      }
      const userDataKeys = ['clients', 'quotes', 'orders'];
      if (Array.isArray(repaired[key]) && repaired[key].length === 0 && !userDataKeys.includes(key)) {
        if (DEFAULT_DATA[key] && DEFAULT_DATA[key].length > 0) {
          repaired[key] = DEFAULT_DATA[key];
        }
      }
    });
    if (repaired.clients) {
      repaired.clients = repaired.clients.map(c => {
        let updated = { ...c };
        if (updated.sitePlan && !updated.sitePlans) {
          updated.sitePlans = [{ ...updated.sitePlan, id: 'plan-default', name: 'Plan Principal' }];
          delete updated.sitePlan;
        } else if (!updated.sitePlans) {
          updated.sitePlans = [];
        }
        return updated;
      });
    }
    if (repaired.quotes) {
      repaired.quotes = repaired.quotes.map(q => {
        let updated = { ...q };
        if (q.products && !q.items) updated.items = q.products;
        return updated;
      });
    }
    if (!repaired.orders) repaired.orders = [];
    if (!repaired.quotes) repaired.quotes = [];
    return repaired;
  }, []);

  // ─── STEP 1: Load from IndexedDB on mount ───────────────────────────────
  useEffect(() => {
    const loadLocal = async () => {
      setIsLoading(true);
      try {
        const localData = await persistentStorage.load(LOCAL_KEY);
        if (localData) {
          console.log('✅ Données locales chargées depuis IndexedDB');
          setDatabase(repairDatabase(localData));
        } else {
          // Migrate from old localStorage if present
          try {
            const oldMain = localStorage.getItem('calculDevisDB');
            const oldQuotes = localStorage.getItem('calculDevisQuotes');
            if (oldMain) {
              const parsed = JSON.parse(oldMain);
              if (oldQuotes) parsed.quotes = JSON.parse(oldQuotes);
              console.log('🔄 Migration depuis localStorage vers IndexedDB');
              const repaired = repairDatabase(parsed);
              setDatabase(repaired);
              await persistentStorage.save(LOCAL_KEY, repaired);
            } else {
              setDatabase(DEFAULT_DATA);
            }
          } catch(e) {
            setDatabase(DEFAULT_DATA);
          }
        }
      } catch (e) {
        console.error('Erreur chargement local:', e);
        setDatabase(DEFAULT_DATA);
      } finally {
        setIsLoading(false);
      }
    };
    loadLocal();
  }, [repairDatabase]);

  // ─── STEP 2: Save to IndexedDB on every change (instant) ─────────────────
  useEffect(() => {
    if (!database || isLoading) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }

    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await persistentStorage.save(LOCAL_KEY, database);
        await persistentStorage.save(BACKUP_KEY, { ...database, _backupTime: new Date().toISOString() });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.error('IndexedDB save error:', e);
        setSaveStatus('error');
      }
    }, 300);

    // Cloud sync (5s debounce, best-effort)
    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = setTimeout(async () => {
      if (!navigator.onLine) { setCloudSyncStatus('offline'); return; }
      setCloudSyncStatus('syncing');
      try {
        const { quotes, ...mainDb } = database;
        await syncDatabase.save({ mainDb, quotes });
        setCloudSyncStatus('ok');
        setLastCloudSync(new Date());
      } catch (e) {
        console.warn('Cloud sync failed (non-critical):', e.message);
        setCloudSyncStatus('offline');
      }
    }, 5000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    };
  }, [database, isLoading]);

  // ─── Network listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => { setIsOnline(false); setCloudSyncStatus('offline'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  // ─── Fix current config if catalog changes ────────────────────────────────
  useEffect(() => {
    if (!database || !database.compositions || database.compositions.length === 0) return;
    const compExists = database.compositions.some(c => c.id === currentConfig.compositionId);
    const glassExists = database.glass.some(g => g.id === currentConfig.glassId);
    const colorExists = database.colors.some(c => c.id === currentConfig.colorId);
    if (!compExists || !glassExists || !colorExists) {
      setCurrentConfig(prev => ({
        ...prev,
        compositionId: compExists ? prev.compositionId : database.compositions[0].id,
        glassId: glassExists ? prev.glassId : database.glass[0].id,
        colorId: colorExists ? prev.colorId : database.colors[0].id
      }));
    }
  }, [database]);

  // ─── Emergency restore ────────────────────────────────────────────────────
  const handleEmergencyRestore = async () => {
    const backup = await persistentStorage.load(BACKUP_KEY);
    if (backup && window.confirm(`Restaurer la sauvegarde du ${backup._backupTime ? new Date(backup._backupTime).toLocaleString() : '?'} ?`)) {
      setDatabase(repairDatabase(backup));
      alert('Données restaurées !');
    } else if (!backup) {
      alert('Aucune sauvegarde de sécurité trouvée.');
    }
  };

  // ─── Force cloud sync ─────────────────────────────────────────────────────
  const handleForceCloudSync = async () => {
    if (!database) return;
    setCloudSyncStatus('syncing');
    try {
      const { quotes, ...mainDb } = database;
      await syncDatabase.save({ mainDb, quotes });
      setCloudSyncStatus('ok');
      setLastCloudSync(new Date());
      alert('Synchronisation Cloud réussie !');
    } catch (e) {
      setCloudSyncStatus('offline');
      alert('Échec Cloud. Données sauvegardées en local.');
    }
  };

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (isLoading || !database) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: '#0f172a', color: 'white' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontSize: '1rem', color: '#94a3b8' }}>Chargement de vos données locales...</p>
      </div>
    );
  }

  const menuItems = [
    { id: 'commercial', label: 'Commercial', icon: LayoutDashboard },
    { id: 'siteplan', label: 'Plan de Chantier', icon: Building },
    { id: 'orders', label: 'Commandes', icon: ShoppingBag },
    { id: 'production', label: 'Atelier / Production', icon: Package },
    { id: 'shipping', label: 'Expédition & Colisage', icon: Truck },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'admin', label: 'Administration', icon: Settings },
  ];

  const urlParams = new URLSearchParams(window.location.search);
  const isInstallerMode = urlParams.get('mode') === 'installer';
  const installerOrderId = urlParams.get('orderId');
  const isTechnicianMode = urlParams.get('mode') === 'technician';
  const technicianOrderId = urlParams.get('orderId');

  if (isInstallerMode && installerOrderId) {
    return (
      <InstallerPortal 
        data={database} 
        setData={setDatabase} 
        orderId={installerOrderId}
        isOnline={isOnline}
        isSyncing={cloudSyncStatus === 'syncing'}
      />
    );
  }

  if (isTechnicianMode && technicianOrderId) {
    return (
      <TechnicianPortal 
        data={database} 
        setData={setDatabase} 
        orderId={technicianOrderId}
        isOnline={isOnline}
        isSyncing={cloudSyncStatus === 'syncing'}
      />
    );
  }

  const cloudColor = cloudSyncStatus === 'ok' ? '#10b981' : cloudSyncStatus === 'syncing' ? '#f59e0b' : '#94a3b8';

  return (
    <div className="app-container">
      {/* Save Status Bar (top of screen) */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        height: '3px',
        background: saveStatus === 'saved' ? '#10b981' : saveStatus === 'saving' ? '#3b82f6' : saveStatus === 'error' ? '#ef4444' : 'transparent',
        transition: 'background 0.5s',
      }} />

      {/* Sidebar */}
      <aside className="sidebar shadow-2xl">
        <div className="sidebar-logo" style={{ padding: '0 0.5rem', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', background: '#3b82f6', borderRadius: '8px', display: 'grid', placeItems: 'center' }}>
              <Home size={18} color="white" />
            </div>
            CalculDevis <span style={{ color: '#3b82f6' }}>PRO</span>
          </h1>
        </div>

        <nav className="sidebar-nav" style={{ flex: 1 }}>
          <ul className="sidebar-nav" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button 
                    onClick={() => setActiveTab(item.id)}
                    className={`nav-button ${isActive ? 'active' : ''}`}
                    title={item.label}
                  >
                    <Icon size={20} />
                    <span className="nav-label">{item.label}</span>
                    {isActive && <ChevronRight size={16} className="nav-arrow" style={{ marginLeft: 'auto' }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          
          {/* Local Save Indicator */}
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.4rem', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {saveStatus === 'saving' 
              ? <RefreshCw size={13} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              : <CheckCircle size={13} color={saveStatus === 'error' ? '#ef4444' : '#10b981'} style={{ flexShrink: 0 }} />
            }
            <span style={{ fontSize: '0.68rem', color: saveStatus === 'saving' ? '#93c5fd' : saveStatus === 'error' ? '#fca5a5' : '#6ee7b7' }}>
              {saveStatus === 'saving' ? 'Sauvegarde...' : saveStatus === 'error' ? '⚠️ Erreur de sauvegarde' : '💾 Sauvegardé localement'}
            </span>
          </div>

          {/* Cloud Sync Status */}
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.4rem', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.68rem', color: cloudColor, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cloudSyncStatus === 'ok' ? '☁️ Cloud synchronisé' : cloudSyncStatus === 'syncing' ? '☁️ Sync en cours...' : isOnline ? '☁️ En attente sync' : '📴 Hors-ligne'}
              </p>
              {lastCloudSync && <p style={{ margin: 0, fontSize: '0.58rem', color: '#64748b' }}>{lastCloudSync.toLocaleTimeString()}</p>}
            </div>
            <button onClick={handleForceCloudSync} title="Forcer la synchro" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
              <RefreshCw size={12} color="#64748b" />
            </button>
          </div>

          {/* Emergency Restore */}
          <button
            onClick={handleEmergencyRestore}
            style={{ width: '100%', padding: '0.4rem', fontSize: '0.68rem', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 600 }}
          >
            🆘 Récupérer Sauvegarde
          </button>

          {/* Export / Import */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(database, null, 2));
                const dl = document.createElement('a');
                dl.setAttribute("href", dataStr);
                dl.setAttribute("download", `backup_devis_${new Date().toISOString().slice(0,10)}.json`);
                dl.click();
              }}
              className="btn"
              style={{ flex: 1, fontSize: '0.65rem', padding: '0.4rem', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', background: 'transparent' }}
              title="Exporter une sauvegarde locale"
            >
              💾 Export
            </button>
            <label
              className="btn"
              style={{ flex: 1, fontSize: '0.65rem', padding: '0.4rem', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer', textAlign: 'center' }}
              title="Restaurer un fichier JSON"
            >
              📂 Import
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  try {
                    const imported = JSON.parse(evt.target.result);
                    if (window.confirm("Restaurer cette sauvegarde ? Cela écrasera les données actuelles.")) {
                      setDatabase(repairDatabase(imported));
                    }
                  } catch(err) { alert("Fichier invalide"); }
                };
                reader.readAsText(file);
              }} />
            </label>
          </div>
        </div>

        <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
            <div style={{ width: '40px', height: '40px', background: '#334155', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>JD</span>
            </div>
            <div className="nav-label">
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>Jean Dupont</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Administrateur</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'commercial' && (
          <CommercialModule 
            config={currentConfig} 
            setConfig={setCurrentConfig} 
            database={database}
            setDatabase={setDatabase}
            currentQuote={currentQuote}
            setCurrentQuote={setCurrentQuote}
            quoteSettings={quoteSettings}
            setQuoteSettings={(newSettings) => {
              setQuoteSettings(prev => {
                const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
                try {
                  localStorage.setItem('quoteSettings', JSON.stringify(next));
                } catch (e) {
                  console.error('LocalStorage quota exceeded:', e);
                  alert("Erreur de sauvegarde : l'image du logo est trop volumineuse (limite 5 Mo).");
                }
                return next;
              });
            }}
            onNewQuote={() => setCurrentQuote(makeNewQuote(quoteSettings))}
          />
        )}
        {activeTab === 'production' && (
          <ProductionModule 
            currentConfig={currentConfig} 
            currentQuote={currentQuote}
            database={database}
            setData={setDatabase}
          />
        )}
        {activeTab === 'clients' && (
          <ClientsModule 
            data={database}
            setData={setDatabase}
            onOpenQuote={(quote) => {
              setCurrentQuote(quote);
              setActiveTab('commercial');
            }}
          />
        )}
        {activeTab === 'siteplan' && (
          <SitePlanModule 
            data={database}
            setData={setDatabase}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersModule 
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
            setQuoteSettings={(newSettings) => {
              setQuoteSettings(prev => {
                const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
                try {
                  localStorage.setItem('quoteSettings', JSON.stringify(next));
                } catch (e) {
                  console.error('LocalStorage quota exceeded:', e);
                  alert("Erreur de sauvegarde : l'image du logo est trop volumineuse (limite 5 Mo).");
                }
                return next;
              });
            }}
          />
        )}
        {activeTab === 'shipping' && (
          <ShippingModule 
            data={database}
            setData={setDatabase}
            refetchData={() => {}}
          />
        )}
        {activeTab === 'admin' && (
          <AdminDashboard 
            data={database}
            setData={setDatabase}
          />
        )}
      </main>
    </div>
  );
}

export default App;
