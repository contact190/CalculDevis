import React, { useState } from 'react';
import { Home, Package, Settings, FileText, ChevronRight, Menu, LogOut, LayoutDashboard, Users, RefreshCw, ShoppingBag, ClipboardList, Rotate3D, Truck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CommercialModule from './modules/commercial/CommercialModule';
import ProductionModule from './modules/production/ProductionModule';
import AdminDashboard from './modules/admin/AdminDashboard';
import ClientsModule from './modules/clients/ClientsModule';
import OrdersModule from './modules/orders/OrdersModule';
import ShippingModule from './modules/shipping/ShippingModule';
import InstallerPortal from './modules/shipping/InstallerPortal';
import { DEFAULT_DATA } from './data/default-data';
import { syncDatabase } from './utils/supabaseClient';

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
  footerText: 'Devis valable sous réserve d\'acceptation dans le délai indiqué.',
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
});

function App() {
  const [activeTab, setActiveTab] = useState('commercial');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const queryClient = useQueryClient();
  
  const [database, setDatabase] = useState(DEFAULT_DATA);

  const [quoteSettings, setQuoteSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('quoteSettings');
      return saved ? { ...DEFAULT_QUOTE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_QUOTE_SETTINGS;
    } catch { return DEFAULT_QUOTE_SETTINGS; }
  });

  const [currentQuote, setCurrentQuote] = useState(() => makeNewQuote(DEFAULT_QUOTE_SETTINGS));

  // Shared state for the current configuration (session specific)
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

  const generateUniqueId = (prefix = 'ID') => {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  };

  const repairDatabase = (db) => {
    if (!db) return DEFAULT_DATA;
    const repaired = { ...db };
    
    // Ensure all mandatory keys exist
    Object.keys(DEFAULT_DATA).forEach(key => {
      if (repaired[key] === undefined || repaired[key] === null) {
        repaired[key] = DEFAULT_DATA[key];
      }
      
      // Structural repair: deduplicate arrays
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

      // Fill empty structural keys from DEFAULT_DATA, but NOT user data keys
      const userDataKeys = ['clients', 'quotes', 'orders'];
      if (Array.isArray(repaired[key]) && repaired[key].length === 0 && !userDataKeys.includes(key)) {
         if (DEFAULT_DATA[key] && DEFAULT_DATA[key].length > 0) {
            repaired[key] = DEFAULT_DATA[key];
         }
      }
    });

    // Handle legacy 'products' vs 'items' in quotes
    if (repaired.quotes) {
      repaired.quotes = repaired.quotes.map(q => {
        let updated = { ...q };
        if (q.products && !q.items) updated.items = q.products;
        return updated;
      });
    }

    if (!repaired.orders) repaired.orders = [];
    return repaired;
  };

  // 1. Initial Cloud Sync via React Query (Offline-first)
  const { data: cloudDb, isLoading: isInitialLoading } = useQuery({
    queryKey: ['database'],
    queryFn: async () => {
      const cloudData = await syncDatabase.load();
      if (cloudData) {
        return repairDatabase(cloudData);
      } else {
        const savedMain = localStorage.getItem('calculDevisDB');
        const savedQuotes = localStorage.getItem('calculDevisQuotes');
        if (savedMain) {
           try { 
             const parsedMain = JSON.parse(savedMain);
             if (savedQuotes) parsedMain.quotes = JSON.parse(savedQuotes);
             return repairDatabase(parsedMain); 
           } catch(e) {}
        }
      }
      return DEFAULT_DATA;
    },
    staleTime: 5 * 60 * 1000,
    networkMode: 'offlineFirst',
  });

  const refetchData = () => {
    queryClient.invalidateQueries({ queryKey: ['database'] });
  };

  React.useEffect(() => {
    if (cloudDb) {
      setDatabase(cloudDb);
      setLastSyncTime(new Date());
      setIsCloudLoaded(true);
      setSyncError(null);
    } else if (!isInitialLoading) {
      // If loading finished but no data came back from cloud
      setIsCloudLoaded(false);
    }
  }, [cloudDb, isInitialLoading]);

  // 2. Mutation to Continuous Cloud Sync
  const syncMutation = useMutation({
    mutationFn: async (db) => {
      const { quotes, ...mainDb } = db;
      localStorage.setItem('calculDevisDB', JSON.stringify(mainDb));
      localStorage.setItem('calculDevisQuotes', JSON.stringify(quotes || []));
      return await syncDatabase.save({ mainDb, quotes });
    },
    onSuccess: (ok) => {
      if (ok) setLastSyncTime(new Date());
    },
    networkMode: 'offlineFirst',
  });

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refetchData(); // Refresh data when connection returns
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    if (database === DEFAULT_DATA) return;
    
    // 1. ALWAYS SAVE TO LOCAL STORAGE (Immediate)
    try {
      const { quotes, ...mainDb } = database;
      localStorage.setItem('calculDevisDB', JSON.stringify(mainDb));
      localStorage.setItem('calculDevisQuotes', JSON.stringify(quotes || []));
    } catch (e) {
      console.error("Local storage save failed:", e);
    }

    // 2. SAVE TO CLOUD (Debounced)
    // IMPORTANT: If cloud failed to load, don't auto-save to CLOUD to prevent overwriting cloud with default/empty data
    if (!isCloudLoaded && !isInitialLoading) {
      console.warn("Cloud not loaded. Auto-sync to cloud disabled to avoid overwriting remote data.");
      return;
    }

    const timeout = setTimeout(() => {
      syncMutation.mutate(database);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [database, isCloudLoaded, isInitialLoading]);

  React.useEffect(() => {
    if (!database.compositions || database.compositions.length === 0) return;
    
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

  const menuItems = [
    { id: 'commercial', label: 'Commercial', icon: LayoutDashboard },
    { id: 'orders', label: 'Commandes', icon: ShoppingBag },
    { id: 'production', label: 'Atelier / Production', icon: Package },
    { id: 'shipping', label: 'Expédition & Colisage', icon: Truck },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'admin', label: 'Administration', icon: Settings },
  ];

  const urlParams = new URLSearchParams(window.location.search);
  const isInstallerMode = urlParams.get('mode') === 'installer';
  const installerOrderId = urlParams.get('orderId');

  if (isInstallerMode && installerOrderId) {
    return (
      <InstallerPortal 
        data={database} 
        setData={setDatabase} 
        orderId={installerOrderId} 
        refetchData={refetchData}
        isOnline={isOnline}
        isSyncing={syncMutation.isPending}
      />
    );
  }

  return (
    <div className="app-container">
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
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
           {/* Backup & Sync Status */}
           <div 
             onClick={refetchData}
             style={{ 
               padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', 
               background: isCloudLoaded ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
               cursor: 'pointer', border: `1px solid ${isCloudLoaded ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
               transition: 'all 0.2s'
             }}
           >
              <div style={{ position: 'relative' }}>
                <RefreshCw size={18} className={syncMutation.isPending || isInitialLoading ? "animate-spin" : ""} style={{ color: isCloudLoaded ? '#10b981' : '#ef4444' }} />
                <div style={{ position: 'absolute', top: -4, right: -4, width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', border: '2px solid #1e293b' }}></div>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: isCloudLoaded ? '#10b981' : '#ef4444' }}>
                  {isInitialLoading ? 'Init...' : (syncMutation.isPending ? 'Sync...' : (isCloudLoaded ? 'Cloud OK' : 'Mode Local'))}
                </p>
                <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8' }}>
                  {lastSyncTime ? `MàJ : ${lastSyncTime.toLocaleTimeString()}` : 'Non sync'}
                </p>
              </div>
           </div>
           
           {!isCloudLoaded && !isInitialLoading && (
             <button 
               onClick={() => setIsCloudLoaded(true)}
               style={{ 
                 width: '100%', padding: '0.5rem', fontSize: '0.7rem', background: '#f59e0b', color: 'white', 
                 border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
               }}
             >
               <RefreshCw size={14} /> Forcer Synchro Cloud
             </button>
           )}

           {/* Manual Export/Import Shortcut */}
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
                        setDatabase(imported);
                        setIsCloudLoaded(true);
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
            setQuoteSettings={(settings) => {
              setQuoteSettings(settings);
              localStorage.setItem('quoteSettings', JSON.stringify(settings));
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
        {activeTab === 'orders' && (
          <OrdersModule 
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
            setQuoteSettings={(settings) => {
              setQuoteSettings(settings);
              localStorage.setItem('quoteSettings', JSON.stringify(settings));
            }}
          />
        )}
        {activeTab === 'shipping' && (
          <ShippingModule 
            data={database}
            setData={setDatabase}
            refetchData={refetchData}
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
