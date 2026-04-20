import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ChevronRight, 
  Box, 
  Maximize2, 
  Layers, 
  Maximize, 
  Rotate3D as Rotate3d, 
  Image as ImageIcon,
  ChevronDown,
  Search,
  AlertCircle
} from 'lucide-react';
import Profile3DViewer from '../../components/shared/Profile3DViewer';

const TechnicalViewerModule = ({ data = {} }) => {
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedCompId, setSelectedCompId] = useState(null); // For single component view
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'
  const [activeWorkspace, setActiveWorkspace] = useState('project'); // 'project' or 'catalog'

  // Get all unique quotes
  const quotes = data.quotes || [];
  const compositions = data.compositions || [];
  const ranges = data.ranges || [];
  
  // Find selected objects
  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);
  const selectedItem = selectedQuote?.items?.find(item => item.id === selectedItemId);
  const composition = (data.compositions || []).find(c => c.id === (selectedItem?.compId || selectedItem?.compositionId));
  const range = (data.ranges || []).find(r => r.id === (composition?.rangeId || selectedItem?.rangeId));

  // Single component logic
  const singleComponent = [...(data.profiles || []), ...(data.accessories || [])].find(x => x.id === selectedCompId);

  return (
    <div className="sidebar-layout">
      {/* Sidebar: Selection */}
      <div className="glass" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '0.5rem' }}>
            <button 
              onClick={() => setActiveWorkspace('project')}
              style={{ flex: 1, padding: '0.4rem', borderRadius: '0.4rem', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: activeWorkspace === 'project' ? 'white' : 'transparent', color: activeWorkspace === 'project' ? '#3b82f6' : '#64748b' }}
            >Projets</button>
            <button 
              onClick={() => setActiveWorkspace('catalog')}
              style={{ flex: 1, padding: '0.4rem', borderRadius: '0.4rem', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: activeWorkspace === 'catalog' ? 'white' : 'transparent', color: activeWorkspace === 'catalog' ? '#3b82f6' : '#64748b' }}
            >Bibliothèque</button>
          </div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {activeWorkspace === 'project' ? <FileText size={18} style={{ color: '#3b82f6' }} /> : <Layers size={18} style={{ color: '#3b82f6' }} />}
            {activeWorkspace === 'project' ? 'Sél. par Devis' : 'Sél. par Profilé'}
          </h3>
        </div>
        
        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
          {activeWorkspace === 'project' ? (
            <>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', display: 'block' }}>Choisir un Devis</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {quotes.map(q => (
                  <button key={q.id} onClick={() => { setSelectedQuoteId(q.id); setSelectedItemId(null); }} style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid', borderColor: selectedQuoteId === q.id ? '#3b82f6' : '#e2e8f0', background: selectedQuoteId === q.id ? '#eff6ff' : 'white', color: selectedQuoteId === q.id ? '#1e40af' : '#1e293b', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>{q.clientName}</span></div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>#{q.id}</div>
                  </button>
                ))}
              </div>
              {selectedQuote && (
                <>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', display: 'block' }}>Compositions du Devis</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedQuote.items.map(item => (
                      <button key={item.id} onClick={() => setSelectedItemId(item.id)} style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid', borderColor: selectedItemId === item.id ? '#3b82f6' : '#e2e8f0', background: selectedItemId === item.id ? '#eff6ff' : 'white', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{item.compName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.width} x {item.height} mm</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input className="input" placeholder="Filtrer profilé..." style={{ paddingLeft: '2.2rem', fontSize: '0.8rem' }} />
               </div>
               {data.profiles.map(p => (
                 <button key={p.id} onClick={() => setSelectedCompId(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: selectedCompId === p.id ? '#eff6ff' : 'white', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ width: '32px', height: '32px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      {p.image && <img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                       <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                       <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{p.id}</div>
                    </div>
                 </button>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Viewer area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header with Mode Switching */}
        <div className="glass flex-mobile-stack" style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button 
              onClick={() => setViewMode('2d')}
              style={{
                background: 'none', border: 'none', paddingBottom: '0.5rem',
                borderBottom: viewMode === '2d' ? '2px solid #3b82f6' : 'none',
                color: viewMode === '2d' ? '#3b82f6' : '#64748b',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              <ImageIcon size={18} /> Coupe Technique (2D)
            </button>
            <button 
              onClick={() => setViewMode('3d')}
              style={{
                background: 'none', border: 'none', paddingBottom: '0.5rem',
                borderBottom: viewMode === '3d' ? '2px solid #3b82f6' : 'none',
                color: viewMode === '3d' ? '#3b82f6' : '#64748b',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              <Rotate3d size={18} /> Modèle 3D Interactif
            </button>
          </div>

          {selectedItem && (
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', background: '#f8fafc', padding: '0.4rem 1rem', borderRadius: '2rem', border: '1px solid #e2e8f0' }}>
              {selectedItem.compName} | {selectedItem.width}x{selectedItem.height}
            </div>
          )}
        </div>

        {/* The Actual Display */}
        <div className="glass" style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: 0, background: '#0f172a' }}>
          {(!selectedItem && activeWorkspace === 'project') && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Box size={60} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>Sélectionnez un produit de devis pour voir les détails techniques</p>
            </div>
          )}
          {(!selectedCompId && activeWorkspace === 'catalog') && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Layers size={60} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>Sélectionnez un profilé dans la bibliothèque pour voir sa 3D</p>
            </div>
          )}

          {(selectedItem || selectedCompId) && (
            <>
              {viewMode === '2d' ? (
                <div style={{ height: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
                  {activeWorkspace === 'catalog' && singleComponent ? (
                    <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
                          <h4 style={{ color: '#f8fafc', margin: 0 }}>Coupe Technique : {singleComponent.name}</h4>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '1rem' }}>ID: {singleComponent.id}</span>
                       </div>
                       <div style={{ width: '100%', background: 'white', borderRadius: '1rem', padding: '2rem', display: 'flex', justifyContent: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                         {singleComponent.technicalDrawing ? (
                           <img 
                              src={singleComponent.technicalDrawing} 
                              style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain' }} 
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                           />
                         ) : null}
                         <div style={{ display: singleComponent.technicalDrawing ? 'none' : 'block', textAlign: 'center', padding: '3rem' }}>
                            <AlertCircle size={40} color="#ef4444" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p style={{ color: '#1e293b', fontWeight: 600 }}>Fichier non lisible ou manquant</p>
                            <p style={{ color: '#64748b', fontSize: '0.8rem', maxWidth: '300px' }}>
                              Veuillez exporter votre coupe AutoCAD en format <b>SVG</b> ou <b>PNG</b> avant de l'importer dans l'administration.
                            </p>
                         </div>
                       </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ 
                        width: '100%', maxWidth: '800px', minHeight: '300px', 
                        border: '2px dashed rgba(255,255,255,0.1)', 
                        borderRadius: '1rem', display: 'flex', 
                        flexDirection: 'column', alignItems: 'center', 
                        justifyContent: 'center', color: '#64748b',
                        background: 'rgba(0,0,0,0.2)', position: 'relative'
                      }}>
                        <Layers size={48} style={{ marginBottom: '1rem' }} />
                        <h4 style={{ color: '#f8fafc', margin: '0 0 0.5rem 0' }}>Coupe Technique {range?.name}</h4>
                        
                        {composition?.technicalDrawing ? (
                          <div style={{ width: '100%', height: '100%', padding: '1rem', background: 'white', borderRadius: '0.5rem' }}>
                            <img src={composition.technicalDrawing} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Coupe complète" />
                          </div>
                        ) : (
                          <p style={{ maxWidth: '400px', textAlign: 'center', fontSize: '0.9rem' }}>
                            Détection auto : Cliquez ci-dessous pour voir les détails des profilés.
                          </p>
                        )}
                      </div>
                      
                      <div style={{ width: '100%', maxWidth: '800px', marginTop: '1.5rem' }}>
                        <h5 style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 600 }}>Composants Détectés Automatiquement</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
                          {(composition?.elements || []).map((el, ei) => {
                            const p = data.profiles?.find(x => x.id === el.id);
                            const a = data.accessories?.find(x => x.id === el.id);
                            const it = p || a;
                            return (
                              <div key={ei} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                <div style={{ height: '80px', background: 'white', borderRadius: '0.4rem', marginBottom: '0.5rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {it?.technicalDrawing ? <img src={it.technicalDrawing} style={{ maxWidth: '90%', maxHeight: '90%' }} /> : <ImageIcon size={20} style={{ opacity: 0.1 }} />}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#f8fafc', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it?.name || el.id}</div>
                                <div style={{ fontSize: '0.6rem', color: '#3b82f6' }}>{it?.technicalDrawing ? 'DÉTECTÉ ✓' : 'SANS DESSIN'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)' }}>
                   {activeWorkspace === 'catalog' && singleComponent ? (
                     <div style={{ width: '100%', height: '100%', padding: '2rem' }}>
                        <Profile3DViewer 
                          svgData={singleComponent.technicalDrawing} 
                          title={singleComponent.name} 
                        />
                     </div>
                   ) : (
                     <div style={{ textAlign: 'center', perspective: '1500px' }}>
                      <div style={{ 
                        width: '320px', height: '420px', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        borderRadius: '0.5rem', margin: '0 auto 2.5rem',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transform: 'rotateY(-25deg) rotateX(15deg)',
                        transformStyle: 'preserve-3d',
                        border: '2px solid #3b82f6',
                        position: 'relative'
                      }}>
                        {/* Inner 3D Window Frame Effect */}
                        <div style={{ width: '85%', height: '85%', border: '8px solid rgba(59, 130, 246, 0.4)', position: 'relative', transform: 'translateZ(20px)' }}>
                           <div style={{ position: 'absolute', top: 0, left: '50%', width: '4px', height: '100%', background: 'rgba(59, 130, 246, 0.2)', transform: 'translateX(-50%)' }} />
                           <div style={{ position: 'absolute', inset: 0, background: 'rgba(186, 230, 253, 0.2)', backdropFilter: 'blur(2px)' }} />
                        </div>
                        {/* 3D Shadows */}
                        <div style={{ position: 'absolute', width: '100%', height: '100%', background: '#3b82f6', opacity: 0.1, transform: 'translateZ(-40px) blur(20px)' }}></div>
                      </div>
                      <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Simulation 3D Interactive</h3>
                      <p style={{ color: '#64748b', marginTop: '0.6rem', maxWidth: '400px', marginInline: 'auto' }}>
                         Modèle <b>{composition?.name || 'Standard'}</b> généré en temps réel ({selectedItem?.width}×{selectedItem?.height}mm)
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                         {['ORBITAL', 'RAYONS-X', 'ÉCLATÉ'].map(m => (
                           <button key={m} style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '0.4rem', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>{m}</button>
                         ))}
                      </div>
                     </div>
                   )}
                </div>
              )}

              {/* Technical Overlay */}
              <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', right: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '1rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                   <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.3rem' }}>Gamme Technique</div>
                   <div style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>{range?.name || 'Inconnue'}</div>
                   <div style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>SPÉCIFICATION ALU EXTRUDÉ</div>
                </div>
                
                <div style={{ pointerEvents: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <Maximize2 size={16} />
                  </button>
                  <button className="btn" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1.5rem', fontWeight: 600 }}>
                    Exporter PDF Technique
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TechnicalViewerModule;
