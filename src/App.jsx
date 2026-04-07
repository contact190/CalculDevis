import React, { useState } from 'react';
import { Home, Package, Settings, FileText, ChevronRight, Menu, LogOut, LayoutDashboard, Users, RefreshCw } from 'lucide-react';
import CommercialModule from './modules/commercial/CommercialModule';
import ProductionModule from './modules/production/ProductionModule';
import AdminDashboard from './modules/admin/AdminDashboard';
import ClientsModule from './modules/clients/ClientsModule';
import { DEFAULT_DATA } from './data/default-data';
import { syncDatabase } from './utils/supabaseClient';

function App() {
  const [activeTab, setActiveTab] = useState('commercial');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
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
    shutterConfig: { caissonId: 'CAI-140', lameId: 'LAM-39E', glissiereId: 'GLI-INVDC', axeId: 'AXE-40', kitId: 'KIT-SANG' }
  });

  const [database, setDatabase] = useState(DEFAULT_DATA);

  const repairDatabase = (db) => {
    const repaired = { ...DEFAULT_DATA, ...db };
    // Ensure all compositions have a categoryId if missing
    if (repaired.compositions) {
      repaired.compositions = repaired.compositions.map(c => ({
        ...c,
        categoryId: c.categoryId || (repaired.categories?.[0]?.id || 'CAT-F'),
        openingType: c.openingType || 'Fixe'
      }));
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
          />
        )}
        {activeTab === 'production' && (
          <ProductionModule 
            currentConfig={currentConfig} 
            database={database}
          />
        )}
        {activeTab === 'clients' && (
          <ClientsModule 
            data={database}
            setData={setDatabase}
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
