import React, { useState } from 'react';
import { Home, Package, Settings, FileText, ChevronRight, Menu, LogOut, LayoutDashboard, Users, RefreshCw } from 'lucide-react';
import CommercialModule from './modules/commercial/CommercialModule';
import ProductionModule from './modules/production/ProductionModule';
import AdminDashboard from './modules/admin/AdminDashboard';
import ClientsModule from './modules/clients/ClientsModule';
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
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
    
    // Non-destructive merge: only fill missing TOP-LEVEL categories
    const repaired = { ...db };
    Object.keys(DEFAULT_DATA).forEach(key => {
      // Deduplicate arrays if they exist
      if (Array.isArray(repaired[key])) {
        const unique = [];
        const seen = new Set();
        repaired[key].forEach(item => {
          if (!item) return;
          const id = item.id || JSON.stringify(item);
          if (!seen.has(id)) {
            unique.push(item);
            seen.add(id);
          }
        });
        repaired[key] = unique;
      }

      if (repaired[key] === undefined || (Array.isArray(repaired[key]) && repaired[key].length === 0 && DEFAULT_DATA[key].length > 0 && key !== 'profiles' && key !== 'glassProfileCompatibility')) {
        repaired[key] = DEFAULT_DATA[key];
      }
    });

    // Specific field repairs for existing items
    if (repaired.compositions) {
      repaired.compositions = repaired.compositions.map(c => ({
        ...c,
        categoryId: c.categoryId || (repaired.categories?.[0]?.id || 'CAT-F'),
        openingType: c.openingType || 'Fixe'
      }));
    }
    if (repaired.accessories) {
      repaired.accessories = repaired.accessories.map(a => {
        const item = { ...a };
        if (item.rangeId && !item.rangeIds) {
          item.rangeIds = [item.rangeId];
        }
        if (!item.rangeIds) item.rangeIds = [repaired.ranges?.[0]?.id || 'H36'];
        return item;
      });
    }
    if (repaired.options) {
      repaired.options = repaired.options.map(o => {
        const item = { ...o };
        if (item.rangeId && !item.rangeIds) {
          item.rangeIds = [item.rangeId];
        }
        if (!item.rangeIds) item.rangeIds = [repaired.ranges?.[0]?.id || 'H36'];
        return item;
      });
    }

    if (repaired.glassProfileCompatibility) {
      repaired.glassProfileCompatibility = repaired.glassProfileCompatibility.map(gc => {
        const item = { ...gc };
        if (item.profileId && !item.profileHId) {
          item.profileHId = item.profileId;
          item.profileVId = item.profileId;
        }
        if (item.formula && !item.formulaH) {
          item.formulaH = item.formula;
          item.formulaV = item.formula;
        }
        // Ensure defaults if missing
        if (!item.formulaH) item.formulaH = 'L-80';
        if (!item.formulaV) item.formulaV = 'H-80';
        if (item.qtyH === undefined) item.qtyH = 2;
        if (item.qtyV === undefined) item.qtyV = 2;
        return item;
      });
    }

    // Repair Shutter Components (Caissons)
    if (repaired.shutterComponents) {
      const defaultC = DEFAULT_DATA.shutterComponents.caissons || [];
      let currentC = repaired.shutterComponents.caissons || [];
      defaultC.forEach(dc => {
        const existingIdx = currentC.findIndex(cc => cc.id === dc.id);
        if (existingIdx === -1) {
          currentC.push(dc);
        } else {
          // Sync height if missing
          currentC[existingIdx] = { 
            ...currentC[existingIdx], 
            height: dc.height || currentC[existingIdx].height 
          };
        }
      });
      repaired.shutterComponents.caissons = currentC;
    }

    // Repair Shutter Components (glissieres Mono/Pala)
    if (repaired.shutterComponents) {
      const defaultG = DEFAULT_DATA.shutterComponents.glissieres || [];
      let currentG = repaired.shutterComponents.glissieres || [];
      
      // Migration: Remove old range-specific glissieres
      currentG = currentG.filter(cg => !cg.rangeId);

      defaultG.forEach(dg => {
        const existingIdx = currentG.findIndex(cg => cg.id === dg.id);
        if (existingIdx === -1) {
          currentG.push(dg);
        } else {
          currentG[existingIdx] = { 
            ...currentG[existingIdx], 
            ...dg,
            opt1Label: dg.opt1Label, 
            opt1Values: dg.opt1Values,
            opt2Label: dg.opt2Label,
            opt2Values: dg.opt2Values,
            barLength: dg.barLength
          };
        }
      });
      repaired.shutterComponents.glissieres = currentG;

      // MISSION CRITICAL: Migrate existing product glissiereIds in all quotes
      if (repaired.quotes) {
        repaired.quotes.forEach(q => {
          (q.products || []).forEach(p => {
            if (p.config?.shutterConfig?.glissiereId) {
              const oldId = p.config.shutterConfig.glissiereId;
              if (oldId.includes('-H36') || oldId.includes('-H48')) {
                // Map "GLI-INVDC-H36" -> "GLI-INVDC"
                const newId = oldId.replace('-H36', '').replace('-H48', '');
                p.config.shutterConfig.glissiereId = newId;
              }
            }
          });
        });
      }
    }

    return repaired;
  };

  // 1. Initial Cloud Sync (on Mount)
  React.useEffect(() => {
    const initDB = async () => {
      setIsSyncing(true);
      const cloudData = await syncDatabase.load();
      if (cloudData) {
        setDatabase(repairDatabase(cloudData));
        setLastSyncTime(new Date());
      } else {
        // Fallback to local if cloud is empty/fails
        const saved = localStorage.getItem('calculDevisDB');
        if (saved) {
           try { 
             setDatabase(repairDatabase(JSON.parse(saved))); 
           } catch(e) { 
             setDatabase(DEFAULT_DATA); 
           }
        }
      }
      setIsSyncing(false);
    };
    initDB();
  }, []);

  // 2. Continuous Cloud Sync (on DB change)
  React.useEffect(() => {
    if (database === DEFAULT_DATA) return; // Wait for initial load
    
    localStorage.setItem('calculDevisDB', JSON.stringify(database));
    
    // Auto-save to Cloud (debounced-ish via useEffect)
    const timeout = setTimeout(async () => {
      setIsSyncing(true);
      const ok = await syncDatabase.save(database);
      if (ok) setLastSyncTime(new Date());
      setIsSyncing(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [database]);

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
    { id: 'production', label: 'Atelier / Production', icon: Package },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'admin', label: 'Administration', icon: Settings },
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar shadow-2xl">
        <div style={{ padding: '0 0.5rem', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', background: '#3b82f6', borderRadius: '8px', display: 'grid', placeItems: 'center' }}>
              <Home size={18} color="white" />
            </div>
            CalculDevis <span style={{ color: '#3b82f6' }}>PRO</span>
          </h1>
        </div>

        <nav style={{ flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button 
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.875rem 1.25rem',
                      borderRadius: '0.75rem',
                      border: 'none',
                      background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      color: isActive ? '#3b82f6' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <Icon size={20} />
                    {item.label}
                    {isActive && <ChevronRight size={16} style={{ marginLeft: 'auto' }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', paddingBottom: '1rem' }}>
           <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.03)' }}>
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} style={{ color: isSyncing ? '#3b82f6' : '#94a3b8' }} />
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: isSyncing ? '#3b82f6' : '#94a3b8' }}>
                  {isSyncing ? 'Synchronisation...' : 'Cloud Sync OK'}
                </p>
                {lastSyncTime && (
                  <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b' }}>
                    Dernier : {lastSyncTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
           </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
            <div style={{ width: '40px', height: '40px', background: '#334155', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>JD</span>
            </div>
            <div>
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
