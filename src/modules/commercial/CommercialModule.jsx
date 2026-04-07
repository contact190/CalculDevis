import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Shovel, Package, Settings, FileText, ChevronRight, Info, LayoutGrid } from 'lucide-react';
import { FormulaEngine } from '../../engine/formula-engine';
import { DEFAULT_DATA } from '../../data/default-data';
import JoineryCanvas from '../../components/shared/JoineryCanvas';
import LayoutComposer, { defaultLayout, rescaleTree } from '../../components/shared/LayoutComposer';

const CommercialModule = ({ config, setConfig, database }) => {
  const engine = useMemo(() => new FormulaEngine(database), [database]);

  const [priceData, setPriceData] = useState(null);
  const [validation, setValidation] = useState({ valid: true });

  useEffect(() => {
    const v = engine.validate(config);
    
    // Additional check for colors availability
    if (v.valid) {
      const comp = database.compositions.find(c => c.id === config.compositionId);
      const unavailableColor = comp?.elements?.some(item => {
        if (item.type === 'profile') {
          const profile = database.profiles.find(p => p.id === item.id);
          return profile && !profile.colors?.includes(config.colorId);
        }
        return false;
      });
      
      if (unavailableColor) {
        setValidation({ valid: false, message: `Certains profilés ne sont pas disponibles en ${config.colorId}.` });
        setPriceData(null);
        return;
      }
    }

    setValidation(v);
    
    if (v.valid) {
      const data = engine.calculatePrice(config);
      setPriceData(data);
    } else {
      setPriceData(null);
    }
  }, [config]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newVal = name === 'L' || name === 'H' ? parseInt(value) || 0 : value;
    
    setConfig(prev => {
      const next = { ...prev, [name]: newVal };
      if ((name === 'L' || name === 'H') && prev.useCustomLayout && prev.customLayout) {
        next.customLayout = rescaleTree(
          prev.customLayout, 
          name === 'L' ? newVal : prev.L,
          name === 'H' ? newVal : prev.H
        );
      }
      return next;
    });
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Configurateur de Devis</h1>
        <p style={{ color: '#64748b' }}>Saisissez les dimensions et options techniques pour chiffrage immédiat.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
        {/* Left Col: Configurator Table */}
        <div className="glass shadow-lg" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calculator size={20} color="#2563eb" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Détails de l'ouvrage</h2>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <label className="label">Client Assigné</label>
            <select name="clientId" value={config.clientId || ''} onChange={handleChange} className="input">
              <option value="">-- Aucun client spécifique --</option>
              {(database.clients || []).map(c => (
                <option key={c.id} value={c.id}>{c.nom} ({c.id})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Dimensions */}
            <div>
              <div className="form-group">
                <label className="label">Longeur (L) en mm</label>
                <input 
                  type="number" 
                  name="L" 
                  value={config.L} 
                  onChange={handleChange} 
                  className="input"
                  style={{ borderColor: !validation.valid && validation.message.includes('Largeur') ? '#ef4444' : '' }}
                />
              </div>
              <div className="form-group">
                <label className="label">Hauteur (H) en mm</label>
                <input 
                  type="number" 
                  name="H" 
                  value={config.H} 
                  onChange={handleChange} 
                  className="input"
                  style={{ borderColor: !validation.valid && validation.message.includes('Hauteur') ? '#ef4444' : '' }}
                />
              </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '0.5rem' }}>
              <button
                onClick={() => setConfig(prev => ({ ...prev, useCustomLayout: false }))}
                style={{
                  flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: 'none',
                  background: !config.useCustomLayout ? 'white' : 'transparent',
                  fontWeight: !config.useCustomLayout ? 700 : 400,
                  color: !config.useCustomLayout ? '#1d4ed8' : '#64748b',
                  boxShadow: !config.useCustomLayout ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer', fontSize: '0.82rem'
                }}
              >
                Modèle Simple
              </button>
              <button
                onClick={() => setConfig(prev => ({ ...prev, useCustomLayout: true, customLayout: prev.customLayout || defaultLayout() }))}
                style={{
                  flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: 'none',
                  background: config.useCustomLayout ? 'white' : 'transparent',
                  fontWeight: config.useCustomLayout ? 700 : 400,
                  color: config.useCustomLayout ? '#7c3aed' : '#64748b',
                  boxShadow: config.useCustomLayout ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer', fontSize: '0.82rem'
                }}
              >
                🖼️ Composition Personnalisée
              </button>
            </div>

            {/* Custom Composer */}
            {config.useCustomLayout && (
              <LayoutComposer
                layout={config.customLayout || defaultLayout()}
                onChange={newLayout => setConfig(prev => ({ ...prev, customLayout: newLayout }))}
                database={database}
                globalConfig={config}
              />
            )}

            {/* Technical Options (Simple Mode only) */}
            <div style={{ display: config.useCustomLayout ? 'none' : 'block' }}>
              {(() => {
                if (!database.compositions || database.compositions.length === 0) {
                  return <div style={{ padding: '1rem', color: '#ef4444' }}>Aucun modèle disponible dans la base.</div>;
                }

                const currentComp = database.compositions.find(c => c.id === config.compositionId) || database.compositions[0];
                const activeCat = currentComp?.categoryId || (database.categories?.[0]?.id || '');
                const activeOpen = currentComp?.openingType || 'Fixe';
                
                const compsInCat = database.compositions.filter(c => c.categoryId === activeCat);
                const availableOpenings = [...new Set(compsInCat.map(c => c.openingType))];

                return (
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="label" style={{ color: '#3b82f6' }}>1. Catégorie</label>
                      <select 
                        className="input" 
                        value={activeCat} 
                        onChange={(e) => {
                          const validComps = database.compositions.filter(c => c.categoryId === e.target.value);
                          if (validComps.length > 0) setConfig(prev => ({ ...prev, compositionId: validComps[0].id }));
                        }}
                      >
                        {database.categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="label" style={{ color: '#3b82f6' }}>2. Type d'Ouverture</label>
                      <select 
                        className="input" 
                        value={activeOpen} 
                        onChange={(e) => {
                          const validComps = database.compositions.filter(c => c.categoryId === activeCat && c.openingType === e.target.value);
                          if (validComps.length > 0) setConfig(prev => ({ ...prev, compositionId: validComps[0].id }));
                        }}
                      >
                        {availableOpenings.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="label" style={{ color: '#3b82f6' }}>3. Modèle d'ouvrage</label>
                      <select name="compositionId" value={config.compositionId} onChange={handleChange} className="input">
                        {database.compositions
                          .filter(c => c.categoryId === activeCat && c.openingType === activeOpen)
                          .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                        }
                      </select>
                    </div>

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label className="label" style={{ color: '#3b82f6' }}>4. Sens d'ouverture</label>
                      <select 
                        className="input" 
                        name="openingDirection" 
                        value={config.openingDirection || 'gauche'} 
                        onChange={handleChange}
                      >
                        <option value="gauche">Ouvrant Gauche</option>
                        <option value="droit">Ouvrant Droit</option>
                      </select>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="label">Finition / Couleur</label>
                <select name="colorId" value={config.colorId} onChange={handleChange} className="input">
                  {database.colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Vitrage</label>
                <select name="glassId" value={config.glassId} onChange={handleChange} className="input">
                  {database.glass.map(g => <option key={g.id} value={g.id}>{g.name} {g.composition ? `(${g.composition})` : ''}</option>)}
                </select>
              </div>
            </div>
          </div>

          {(() => {
            const currentComp = database.compositions.find(c => c.id === config.compositionId);
            const hasCouvreJoint = currentComp?.elements?.some(e => /couvre[- ]?joint|cj[vh]?/i.test(e.label || ''));
            if (!hasCouvreJoint) return null;

            return (
              <div className="form-group" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <label className="label" style={{ marginBottom: '0.75rem' }}>Couvres-Joints Optionnels</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {['Haut', 'Bas', 'Gauche', 'Droite'].map(side => {
                    const sideKey = side === 'Haut' ? 'top' : side === 'Bas' ? 'bottom' : side === 'Gauche' ? 'left' : 'right';
                    return (
                      <label key={side} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
                        <input 
                          type="checkbox" 
                          checked={config.optionalSides?.[sideKey] || false}
                          onChange={(e) => {
                            setConfig(prev => ({
                              ...prev,
                              optionalSides: { ...(prev.optionalSides || {}), [sideKey]: e.target.checked }
                            }));
                          }}
                          style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                        />
                        {side}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {(() => {
            const currentComp = database.compositions.find(c => c.id === config.compositionId);
            const availableOptions = database.options?.filter(o => o.rangeId === currentComp?.rangeId) || [];
            
            if (availableOptions.length === 0) return null;

            return (
              <div className="form-group" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <label className="label" style={{ marginBottom: '0.75rem' }}>Options & Variantes</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flexDirection: 'column' }}>
                  {availableOptions.map(opt => (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>
                      <input 
                        type="checkbox" 
                        checked={config.selectedOptions?.includes(opt.id) || false}
                        onChange={(e) => {
                          setConfig(prev => ({
                            ...prev,
                            selectedOptions: e.target.checked 
                              ? [...(prev.selectedOptions || []), opt.id]
                              : (prev.selectedOptions || []).filter(id => id !== opt.id)
                          }));
                        }}
                        style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                      />
                      <span>{opt.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ==== VOLET ROULANT ==== */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
              <input
                type="checkbox"
                checked={config.hasShutter || false}
                onChange={e => setConfig(prev => ({ ...prev, hasShutter: e.target.checked }))}
                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
              />
              Ajouter un Volet Roulant
            </label>

            {config.hasShutter && (() => {
              const sc = database.shutterComponents;
              if (!sc) return null;
              const shutterDropdowns = [
                { key: 'caissonId',   label: 'Caisson',        items: sc.caissons },
                { key: 'lameId',      label: 'Lame',           items: sc.lames },
                { key: 'glissiereId', label: 'Glissière',      items: sc.glissieres },
                { key: 'axeId',       label: 'Axe',            items: sc.axes },
                { key: 'kitId',       label: 'Kit Manœuvre',   items: sc.kits }
              ];
              return (
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {shutterDropdowns.map(({ key, label, items }) => (
                    <div key={key} className="form-group">
                      <label className="label" style={{ fontSize: '0.8rem' }}>{label}</label>
                      <select
                        className="input"
                        value={config.shutterConfig?.[key] || ''}
                        onChange={e => setConfig(prev => ({ ...prev, shutterConfig: { ...(prev.shutterConfig || {}), [key]: e.target.value } }))}
                      >
                        {(items || []).map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {!validation.valid && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '0.5rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={16} />
              <span style={{ fontSize: '0.875rem' }}>{validation.message}</span>
            </div>
          )}

          <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '1rem' }}>RÉSUMÉ DÉTAILLÉ DU CALCUL</h3>
            <table className="data-table" style={{ fontSize: '0.7rem' }}>
              <thead>
                <tr>
                  <th>Composant</th>
                  <th>Formule</th>
                  <th>Calcul</th>
                  <th>Nbre</th>
                  <th>Mesure Totale</th>
                  <th>Prix Unit.</th>
                  <th style={{ textAlign: 'right' }}>Prix Total</th>
                </tr>
              </thead>
              <tbody>
                {priceData && priceData.bom.profiles.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.label}</td>
                    <td style={{ color: '#64748b', fontSize: '0.65rem' }}>{p.formula}</td>
                    <td style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{p.resolvedFormula}</td>
                    <td>{p.qty}u</td>
                    <td>{Math.round(p.totalMeasure)} mm</td>
                    <td>{p.unitPrice?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.cost.toFixed(2)} DZD</td>
                  </tr>
                ))}
                {priceData && priceData.bom.accessories.map((acc, i) => (
                  <tr key={`acc-${i}`}>
                    <td style={{ fontWeight: 600 }}>{acc.label}</td>
                    <td style={{ color: '#64748b', fontSize: '0.65rem' }}>{acc.formula}</td>
                    <td style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{acc.resolvedFormula}</td>
                    <td>{acc.multiplier}u</td>
                    <td>{acc.totalMeasure.toFixed(2)} {acc.unit === 'Ml' || acc.unit === 'Joint' ? 'mm' : 'u'}</td>
                    <td>{acc.unitPrice?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{acc.cost.toFixed(2)} DZD</td>
                  </tr>
                ))}
                {priceData && priceData.bom.gasket && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>Joint de vitrage</td>
                    <td style={{ color: '#64748b', fontSize: '0.65rem' }}>{priceData.bom.gasket.formula}</td>
                    <td style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{priceData.bom.gasket.resolvedFormula}</td>
                    <td>1u</td>
                    <td>{priceData.bom.gasket.totalMeasure.toFixed(2)} mm</td>
                    <td>{priceData.bom.gasket.unitPrice?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{priceData.bom.gasket.cost.toFixed(2)} DZD</td>
                  </tr>
                )}
                {priceData && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>Vitrage</td>
                    <td>-</td>
                    <td>-</td>
                    <td>{priceData.bom.glass.qty}u</td>
                    <td>{priceData.bom.glass.area.toFixed(2)} m²</td>
                    <td>{priceData.bom.glass.pricePerM2?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{priceData.bom.glass.cost.toFixed(2)} DZD</td>
                  </tr>
                )}
                {priceData && priceData.bom.shutters && priceData.bom.shutters.length > 0 && (<>
                  <tr>
                    <td colSpan="7" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em', paddingTop: '0.5rem' }}>
                      📦 PACK VOLET ROULANT
                    </td>
                  </tr>
                  {priceData.bom.shutters.map((s, i) => (
                    <tr key={`shutter-${i}`} style={{ background: '#f8faff' }}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td>{s.formula}</td>
                      <td>-</td>
                      <td>1u</td>
                      <td>{typeof s.qty === 'number' ? s.qty.toFixed(2) : s.qty} {s.priceUnit}</td>
                      <td>{s.price?.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{(s.cost || 0).toFixed(2)} DZD</td>
                    </tr>
                  ))}
                </>)}
                
                {/* --- SOUS-TOTAUX --- */}
                <tr style={{ borderTop: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.65rem' }}>
                   <td colSpan="6" style={{ textAlign: 'right' }}>Total Profilés (Alu + Couleur) :</td>
                   <td style={{ textAlign: 'right' }}>{priceData?.subtotals?.profiles.toFixed(2)} DZD</td>
                </tr>
                <tr style={{ color: '#64748b', fontSize: '0.65rem' }}>
                   <td colSpan="6" style={{ textAlign: 'right' }}>Total Accessoires :</td>
                   <td style={{ textAlign: 'right' }}>{priceData?.subtotals?.accessories.toFixed(2)} DZD</td>
                </tr>
                <tr style={{ color: '#64748b', fontSize: '0.65rem' }}>
                   <td colSpan="6" style={{ textAlign: 'right' }}>Total Joints :</td>
                   <td style={{ textAlign: 'right' }}>{priceData?.subtotals?.gasket.toFixed(2)} DZD</td>
                </tr>
                <tr style={{ color: '#64748b', fontSize: '0.65rem' }}>
                   <td colSpan="6" style={{ textAlign: 'right' }}>Total Vitrage :</td>
                   <td style={{ textAlign: 'right' }}>{priceData?.subtotals?.glass.toFixed(2)} DZD</td>
                </tr>
                {priceData?.subtotals?.shutter > 0 && (
                  <tr style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    <td colSpan="6" style={{ textAlign: 'right' }}>Total Volet Roulant :</td>
                    <td style={{ textAlign: 'right' }}>{priceData.subtotals.shutter.toFixed(2)} DZD</td>
                  </tr>
                )}

                <tr style={{ background: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}>
                  <td colSpan="6" style={{ textAlign: 'right' }}>COÛT TOTAL DE REVIENT (MATÉRIAUX)</td>
                  <td style={{ textAlign: 'right', color: '#1e293b' }}>{priceData ? priceData.cost.toFixed(2) : '0.00'} DZD</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Drawing & Price Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <JoineryCanvas config={config} width={350} height={350} database={database} />

          <div className="price-card shadow-lg">
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Coefficient de Marge</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input 
                  type="number" 
                  step="0.1" 
                  min="1" 
                  value={config.margin} 
                  onChange={e => setConfig(prev => ({ ...prev, margin: parseFloat(e.target.value) || 1 }))}
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '0.4rem', padding: '0.4rem 0.6rem', width: '80px', fontSize: '1.1rem', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>x Coût Matériaux</span>
              </div>
            </div>

            <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>TOTAL DEVIS (HT)</span>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>
              {priceData ? `${priceData.priceHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD` : '---'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1rem' }}>
              <div style={{ opacity: 0.9 }}>TVA (20%)</div>
              <div style={{ fontWeight: 600 }}>{priceData ? `${(priceData.priceHT * 0.2).toFixed(2)} DZD` : '---'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <div style={{ fontWeight: 600 }}>PRIX TTC</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {priceData ? `${priceData.priceTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD` : '---'}
              </div>
            </div>
          </div>

          <button className="btn btn-primary shadow-md" style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <FileText size={18} />
            Générer le Devis PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommercialModule;
