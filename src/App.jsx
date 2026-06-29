import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, Package, Settings, ChevronRight, LayoutDashboard, Users, RefreshCw, ShoppingBag, Truck, CheckCircle, Building, Wifi, WifiOff, TrendingUp, Store } from 'lucide-react';
import CommercialModule from './modules/commercial/CommercialModule';
import ShopModule from './modules/shop/ShopModule';
import ProductionModule from './modules/production/ProductionModule';
import AdminDashboard from './modules/admin/AdminDashboard';
import ClientsModule from './modules/clients/ClientsModule';
import OrdersModule from './modules/orders/OrdersModule';
import ShippingModule from './modules/shipping/ShippingModule';
import InstallerPortal from './modules/shipping/InstallerPortal';
import TechnicianPortal from './modules/orders/TechnicianPortal';
import SitePlanModule from './modules/siteplan/SitePlanModule';
import FinanceModule from './modules/finance/FinanceModule';
import { DEFAULT_DATA } from './data/default-data';
import { syncDatabase } from './utils/supabaseClient';
import { persistentStorage } from './utils/storage';
import { localSync } from './utils/localSync';
import { smartMerge } from './utils/smartMerge';
import { applyOps, generateOps, getDeviceId } from './utils/patchEngine';

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

const makeNewQuote = (settings, db) => {
  let counter = settings.quoteCounter || 1;
  if (db && db.quotes) {
    const prefix = settings.quotePrefix || 'DEV-';
    for (const q of db.quotes) {
      if (q.number && q.number.startsWith(prefix)) {
        const numPart = q.number.substring(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed >= counter) {
          counter = parsed + 1;
        }
      }
    }
  }
  return {
    id: `QUOTE-${Date.now()}`,
    number: `${settings.quotePrefix}${String(counter).padStart(3, '0')}`,
    clientId: null,
    createdAt: new Date().toISOString(),
    items: [],
    sitePlanId: null,
  };
};

function App() {
  const [activeTab, setActiveTab] = useState('commercial');
  const [database, setDatabase] = useState(null); // null = loading
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Chargement de vos données locales...');
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'ok' | 'offline'
  const [lastCloudSync, setLastCloudSync] = useState(null);
  const [connectedClients, setConnectedClients] = useState(0);
  const saveTimerRef = useRef(null);
  const cloudSyncIntervalRef = useRef(null);
  const lastSyncedDataRef = useRef(null);
  const lastLocalModifiedRef = useRef(null); // ISO timestamp of last local modification
  const lastCloudTimestampRef = useRef(null); // ISO timestamp of last known cloud version
  const isFirstLoad = useRef(true);
  const databaseRef = useRef(null); // Always-current ref for interval access
  const isApplyingRemoteOps = useRef(false); // Flag to prevent sync loops
  const previousDbRef = useRef(null); // Previous db state for diffing

  const [quoteSettings, setQuoteSettings] = useState(DEFAULT_QUOTE_SETTINGS);

  const [currentQuote, setCurrentQuote] = useState(() => makeNewQuote(DEFAULT_QUOTE_SETTINGS));
  const [selectedShopQuote, setSelectedShopQuote] = useState(null);

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
    if (!repaired.contracts) repaired.contracts = [];
    if (!repaired.financialTrackers) repaired.financialTrackers = [];
    return repaired;
  }, []);

  // ─── Initialize empty quote with latest number ──────────────────────
  useEffect(() => {
    if (database && currentQuote && currentQuote.items.length === 0 && !currentQuote.clientId) {
      const newQuote = makeNewQuote(quoteSettings, database);
      if (newQuote.number !== currentQuote.number) {
        setCurrentQuote(prev => ({ ...prev, number: newQuote.number }));
      }
    }
  }, [database, quoteSettings.quotePrefix]);

  // ─── STEP 1: Load local + Network comparison on mount ──────────────────────
  useEffect(() => {
    const loadAndSync = async () => {
      setIsLoading(true);
      try {
        setLoadingMessage('Chargement des paramètres...');
        const settingsData = await persistentStorage.load('quoteSettings');
        if (settingsData) {
          setQuoteSettings({ ...DEFAULT_QUOTE_SETTINGS, ...settingsData });
        } else {
          try {
            const savedSettings = localStorage.getItem('quoteSettings');
            if (savedSettings) {
              const parsedSettings = JSON.parse(savedSettings);
              setQuoteSettings({ ...DEFAULT_QUOTE_SETTINGS, ...parsedSettings });
              await persistentStorage.save('quoteSettings', parsedSettings);
            }
          } catch(e) {}
        }

        setLoadingMessage('Chargement des données locales...');
        let localData = await persistentStorage.load(LOCAL_KEY);
        const localTimestamp = await persistentStorage.load('calculDevis_lastModified');

        if (!localData) {
          try {
            const oldMain = localStorage.getItem('calculDevisDB');
            const oldQuotes = localStorage.getItem('calculDevisQuotes');
            if (oldMain) {
              const parsed = JSON.parse(oldMain);
              if (oldQuotes) parsed.quotes = JSON.parse(oldQuotes);
              localData = parsed;
              await persistentStorage.save(LOCAL_KEY, localData);
            }
          } catch(e) {}
        }

        const hasLocalUserData = localData && (
          (localData.clients && localData.clients.length > 0) ||
          (localData.quotes && localData.quotes.length > 0) ||
          (localData.orders && localData.orders.length > 0)
        );

        // Try local server first
        setLoadingMessage('Recherche du Serveur Local...');
        let serverData = null;
        try {
          serverData = await localSync.fetchData();
        } catch(e) {
          console.warn("Local server not found, falling back to offline mode");
        }

        if (serverData) {
          console.log('🔗 Serveur local trouvé !');
          if (hasLocalUserData) {
            console.log('🔄 Fusion Intelligente (Smart Merge) des données locales avec le serveur...');
            const merged = smartMerge(localData, serverData);
            const repaired = repairDatabase(merged);
            setDatabase(repaired);
            await persistentStorage.save(LOCAL_KEY, repaired);
            lastLocalModifiedRef.current = new Date().toISOString();
            setCloudSyncStatus('ok');
          } else {
            console.log('📥 Chargement depuis le Serveur Local...');
            const repaired = repairDatabase(serverData);
            setDatabase(repaired);
            await persistentStorage.save(LOCAL_KEY, repaired);
            lastLocalModifiedRef.current = new Date().toISOString();
            setCloudSyncStatus('ok');
          }
        } else {
          // Fallback to purely local
          console.log('📴 Mode Offline / Serveur Local injoignable');
          const repaired = repairDatabase(localData || DEFAULT_DATA);
          setDatabase(repaired);
          lastLocalModifiedRef.current = localTimestamp || null;
          setCloudSyncStatus('offline');
        }
      } catch (e) {
        console.error('Erreur chargement:', e);
        setDatabase(DEFAULT_DATA);
      } finally {
        setIsLoading(false);
      }
    };
    loadAndSync();
  }, [repairDatabase]);

  const updateQuoteSettings = useCallback((newSettings) => {
    setQuoteSettings(prev => {
      const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
      persistentStorage.save('quoteSettings', next).catch(e => console.error(e));
      return next;
    });
  }, []);

  // ─── Keep databaseRef in sync ───────────────────────────────────────────
  useEffect(() => {
    databaseRef.current = database;
  }, [database]);

  // ─── STEP 2: Save to IndexedDB + Push Delta Ops on every change ─────
  useEffect(() => {
    if (!database || isLoading) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; previousDbRef.current = database; return; }

    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        
        let stampedDb = database;
        // ─── Stamp local changes in database before saving ───
        if (!isApplyingRemoteOps.current && previousDbRef.current) {
          const ops = generateOps(previousDbRef.current, database);
          if (ops.length > 0) {
            const applyResult = applyOps(database, ops);
            if (applyResult && applyResult.appliedCount > 0) {
              stampedDb = applyResult.db;
              setDatabase(stampedDb);
            }
          }
        }

        await persistentStorage.save(LOCAL_KEY, stampedDb);
        await persistentStorage.save(BACKUP_KEY, { ...stampedDb, _backupTime: now });
        await persistentStorage.save('calculDevis_lastModified', now);
        lastLocalModifiedRef.current = now;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);

        // ─── Push delta ops to server (only if this is a LOCAL change) ─────
        if (!isApplyingRemoteOps.current && previousDbRef.current) {
          const result = await localSync.pushOps(stampedDb, previousDbRef.current);
          if (result && result.success) {
            if (result.applied > 0) {
              setCloudSyncStatus('ok');
              setLastCloudSync(new Date());
              console.log(`🔗 ${result.applied} ops synchronisées en temps réel`);
            }
          } else if (result && result.queued) {
            setCloudSyncStatus('offline');
          }
        }
        previousDbRef.current = stampedDb;
      } catch (e) {
        console.error('IndexedDB save error:', e);
        setSaveStatus('error');
      }
    }, 150); // Reduced debounce from 300ms to 150ms for faster sync

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [database, isLoading]);

  // ─── STEP 3: Connect to Local Server WebSocket (Real-time Delta Sync) ───────
  useEffect(() => {
    if (isLoading) return;

    // Connect with delta-aware callbacks
    localSync.connect({
      // ─── Receive individual operations from other clients ─────
      onOpsReceived: (ops) => {
        if (!databaseRef.current || !Array.isArray(ops) || ops.length === 0) return;
        
        console.log(`📥 Application de ${ops.length} ops distantes en temps réel...`);
        isApplyingRemoteOps.current = true;
        
        const { db: newDb, appliedCount } = applyOps(databaseRef.current, ops);
        if (appliedCount > 0) {
          const repaired = repairDatabase(newDb);
          setDatabase(repaired);
          // Update the snapshot so we don't re-send these ops back
          localSync.updateSnapshot(repaired);
          previousDbRef.current = repaired;
          setCloudSyncStatus('ok');
          setLastCloudSync(new Date());
        }
        
        // Reset flag after React batches the state update
        setTimeout(() => { isApplyingRemoteOps.current = false; }, 50);
      },

      // ─── Full refresh needed (backup restored, etc.) ─────
      onFullRefresh: async () => {
        console.log('🔄 Refresh complet depuis le serveur...');
        setCloudSyncStatus('syncing');
        const serverData = await localSync.fetchData();
        if (serverData && databaseRef.current) {
          isApplyingRemoteOps.current = true;
          const merged = smartMerge(databaseRef.current, serverData);
          const repaired = repairDatabase(merged);
          setDatabase(repaired);
          localSync.updateSnapshot(repaired);
          previousDbRef.current = repaired;
          setCloudSyncStatus('ok');
          setLastCloudSync(new Date());
          setTimeout(() => { isApplyingRemoteOps.current = false; }, 50);
        }
      },

      // ─── Connection status updates ─────
      onConnectionChange: (connected) => {
        setCloudSyncStatus(connected ? 'ok' : 'offline');
        if (connected) {
          // On reconnect, fetch status to see how many clients
          localSync.getStatus().then(status => {
            if (status) setConnectedClients(status.connectedClients || 0);
          });
        }
      },

      // ─── Sync acknowledgement ─────
      onSyncAck: (ack) => {
        if (ack.applied > 0) {
          setConnectedClients(prev => prev); // Force update
        }
      }
    });

    // Periodic Supabase cloud backup (every 2 minutes)
    cloudSyncIntervalRef.current = setInterval(async () => {
      const db = databaseRef.current;
      if (!db) return;
      try {
        await syncDatabase.save({ mainDb: db, quotes: db.quotes || [] });
        console.log('☁️ Backup Supabase effectué');
      } catch (e) {
        // Silent fail for cloud backup — not critical
      }
    }, 120000); // 2 minutes

    return () => {
      localSync.disconnect();
      if (cloudSyncIntervalRef.current) clearInterval(cloudSyncIntervalRef.current);
    };
  }, [isLoading, repairDatabase]);

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

  // ─── Force local sync (full push) ─────────────────────────────────────────
  const handleForceCloudSync = async () => {
    if (!database) return;
    setCloudSyncStatus('syncing');
    try {
      const result = await localSync.pushDataFull(database);
      if (result) {
        setCloudSyncStatus('ok');
        setLastCloudSync(new Date());
        previousDbRef.current = database;
        alert('✅ Synchronisation complète réussie !');
      } else {
        throw new Error('Échec du serveur');
      }
    } catch (e) {
      setCloudSyncStatus('offline');
      alert('❌ Échec Réseau. Données sauvegardées en local.');
    }
  };

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (isLoading || !database) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem', background: '#0f172a', color: 'white' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontSize: '1rem', color: '#94a3b8' }}>{loadingMessage}</p>
      </div>
    );
  }

  const menuItems = [
    { id: 'commercial', label: 'Commercial', icon: LayoutDashboard },
    { id: 'shop', label: 'Shop', icon: Store },
    { id: 'siteplan', label: 'Plan de Chantier', icon: Building },
    { id: 'orders', label: 'Commandes', icon: ShoppingBag },
    { id: 'production', label: 'Atelier / Production', icon: Package },
    { id: 'shipping', label: 'Expédition & Colisage', icon: Truck },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'finance', label: 'Finance', icon: TrendingUp },
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

          {/* Real-time Sync Status */}
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.4rem', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cloudSyncStatus === 'ok' ? '#10b981' : cloudSyncStatus === 'syncing' ? '#f59e0b' : '#ef4444', flexShrink: 0, boxShadow: cloudSyncStatus === 'ok' ? '0 0 6px #10b981' : 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.68rem', color: cloudColor, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cloudSyncStatus === 'ok' ? '⚡ Temps Réel' : cloudSyncStatus === 'syncing' ? '🔄 Synchronisation...' : '📴 Hors-ligne'}
              </p>
              <p style={{ margin: 0, fontSize: '0.55rem', color: '#64748b' }}>
                {lastCloudSync ? `Dernière sync: ${lastCloudSync.toLocaleTimeString()}` : ''}
                {localSync.getPendingCount() > 0 ? ` • ${localSync.getPendingCount()} ops en attente` : ''}
              </p>
            </div>
            <button onClick={handleForceCloudSync} title="Forcer sync complète" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
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
            setQuoteSettings={updateQuoteSettings}
            onNewQuote={() => setCurrentQuote(makeNewQuote(quoteSettings, database))}
          />
        )}
        {activeTab === 'shop' && (
          <ShopModule 
            database={database}
            setDatabase={setDatabase}
            quoteSettings={quoteSettings}
            setQuoteSettings={updateQuoteSettings}
            selectedQuote={selectedShopQuote}
            onClearSelectedQuote={() => setSelectedShopQuote(null)}
          />
        )}
        {activeTab === 'production' && (
          <ProductionModule 
            currentConfig={currentConfig} 
            currentQuote={currentQuote}
            database={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
          />
        )}
        {activeTab === 'clients' && (
          <ClientsModule 
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
            onOpenQuote={(quote) => {
              if (quote.type === 'shop') {
                setSelectedShopQuote(quote);
                setActiveTab('shop');
              } else {
                setCurrentQuote(quote);
                setActiveTab('commercial');
              }
            }}
          />
        )}
        {activeTab === 'siteplan' && (
          <SitePlanModule 
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersModule 
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
            setQuoteSettings={updateQuoteSettings}
          />
        )}
        {activeTab === 'shipping' && (
          <ShippingModule 
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
            refetchData={() => {}}
          />
        )}
        {activeTab === 'admin' && (
          <AdminDashboard 
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
          />
        )}
        {activeTab === 'finance' && (
          <FinanceModule
            data={database}
            setData={setDatabase}
            quoteSettings={quoteSettings}
          />
        )}
      </main>
    </div>
  );
}

export default App;
