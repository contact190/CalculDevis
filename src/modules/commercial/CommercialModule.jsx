import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calculator, Package, Settings, FileText, Info, LayoutGrid, Plus, Edit2, Trash2, Copy, ArrowLeft, Save, ChevronDown, ChevronUp, Building2, Phone, Mail, MapPin, Calendar, Clock } from 'lucide-react';
import { FormulaEngine } from '../../engine/formula-engine';
import JoineryCanvas from '../../components/shared/JoineryCanvas';
import LayoutComposer, { defaultLayout, rescaleTree } from '../../components/shared/LayoutComposer';
import jsPDF from 'jspdf';

const EMPTY_CONFIG = {
  L: 1200, H: 2150,
  compositionId: '', colorId: '', glassId: '',
  optionalSides: { top: false, bottom: false, left: false, right: false },
  selectedOptions: [],
  hasShutter: false,
  shutterConfig: { caissonId: '', lameId: '', glissiereId: 'AUTO', axeId: '', kitId: '' },
  margin: 2.2,
  useCustomLayout: false,
  customLayout: null,
};

// ─── SUB-COMPONENT: Product Configurator (View B) ──────────────────────────
const ProductConfigurator = ({ config, setConfig, database, onSave, onCancel, label, setLabel, qty, setQty }) => {
  const engine = useMemo(() => new FormulaEngine(database), [database]);
  const [validation, setValidation] = useState({ valid: true });
  const [priceData, setPriceData] = useState(null);

  useEffect(() => {
    if (!config.compositionId && database.compositions?.length > 0) {
      setConfig(prev => ({
        ...prev,
        compositionId: database.compositions[0].id,
        colorId: database.colors[0]?.id || '',
        glassId: database.glass[0]?.id || '',
      }));
    }
  }, []);

  useEffect(() => {
    const v = engine.validate(config);
    setValidation(v);
    if (v.valid) {
      try { setPriceData(engine.calculatePrice(config)); }
      catch(e) { setPriceData(null); }
    } else {
      setPriceData(null);
    }
  }, [config]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newVal = (name === 'L' || name === 'H') ? (parseInt(value) || 0) : value;
    setConfig(prev => {
      const next = { ...prev, [name]: newVal };
      if ((name === 'L' || name === 'H') && prev.useCustomLayout && prev.customLayout) {
        next.customLayout = rescaleTree(prev.customLayout, name === 'L' ? newVal : prev.L, name === 'H' ? newVal : prev.H);
      }
      return next;
    });
  };

  const currentComp = database.compositions?.find(c => c.id === config.compositionId);
  const activeCat = currentComp?.categoryId || database.categories?.[0]?.id || '';
  const activeOpen = currentComp?.openingType || 'Fixe';
  const compsInCat = database.compositions?.filter(c => c.categoryId === activeCat) || [];
  const availableOpenings = [...new Set(compsInCat.map(c => c.openingType))];

  const hasCouvreJoint = currentComp?.elements?.some(e => {
    let itemName = '';
    if (e.type === 'profile') { const p = database.profiles.find(x => x.id === e.id); if (p) itemName = p.name || ''; }
    else if (e.type === 'accessory') { const a = database.accessories.find(x => x.id === e.id); if (a) itemName = a.name || ''; }
    return /couvres?[- ]?joints?|cj[vh]?/i.test(((e.label || '') + ' ' + itemName).toLowerCase());
  });

  const availableOptions = database.options?.filter(o => (o.rangeIds || []).includes(currentComp?.rangeId)) || [];

  return (
    <div className="animate-fade-in">
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
        <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div style={{ flex: 1 }}>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Désignation du produit (ex: Fenêtre salon)"
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>Quantité:</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
            style={{ width: '65px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 700 }} />
        </div>
        <button onClick={onSave} disabled={!priceData} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: priceData ? '#10b981' : '#94a3b8', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: priceData ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
          <Save size={16} /> Ajouter au devis
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
        {/* Left: Config */}
        <div className="glass shadow-lg" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calculator size={20} color="#2563eb" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Détails de l'ouvrage</h2>
          </div>

          {/* Client */}
          <div className="form-group" style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <label className="label">Client Assigné</label>
            <select name="clientId" value={config.clientId || ''} onChange={handleChange} className="input">
              <option value="">-- Aucun client spécifique --</option>
              {(database.clients || []).map(c => <option key={c.id} value={c.id}>{c.nom} ({c.id})</option>)}
            </select>
          </div>

          {/* Dimensions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <div className="form-group">
                <label className="label">Longeur (L) en mm</label>
                <input type="number" name="L" value={config.L} onChange={handleChange} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Hauteur (H) en mm</label>
                <input type="number" name="H" value={config.H} onChange={handleChange} className="input" />
              </div>
            </div>

            {/* Mode Toggle */}
            <div>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '0.5rem' }}>
                <button onClick={() => setConfig(prev => ({ ...prev, useCustomLayout: false }))}
                  style={{ flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: 'none', background: !config.useCustomLayout ? 'white' : 'transparent', fontWeight: !config.useCustomLayout ? 700 : 400, color: !config.useCustomLayout ? '#1d4ed8' : '#64748b', cursor: 'pointer', fontSize: '0.82rem' }}>
                  Modèle Simple
                </button>
                <button onClick={() => setConfig(prev => ({ ...prev, useCustomLayout: true, customLayout: prev.customLayout || defaultLayout() }))}
                  style={{ flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: 'none', background: config.useCustomLayout ? 'white' : 'transparent', fontWeight: config.useCustomLayout ? 700 : 400, color: config.useCustomLayout ? '#7c3aed' : '#64748b', cursor: 'pointer', fontSize: '0.82rem' }}>
                  🖼️ Composition Personnalisée
                </button>
              </div>
            </div>
          </div>

          {config.useCustomLayout && (
            <LayoutComposer layout={config.customLayout || defaultLayout()} onChange={newLayout => setConfig(prev => ({ ...prev, customLayout: newLayout }))} database={database} globalConfig={config} />
          )}

          <div style={{ display: config.useCustomLayout ? 'none' : 'block' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="label" style={{ color: '#3b82f6' }}>1. Catégorie</label>
                <select className="input" value={activeCat} onChange={(e) => {
                  const validComps = database.compositions.filter(c => c.categoryId === e.target.value);
                  if (validComps.length > 0) setConfig(prev => ({ ...prev, compositionId: validComps[0].id }));
                }}>
                  {database.categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="label" style={{ color: '#3b82f6' }}>2. Type d'Ouverture</label>
                <select className="input" value={activeOpen} onChange={(e) => {
                  const validComps = database.compositions.filter(c => c.categoryId === activeCat && c.openingType === e.target.value);
                  if (validComps.length > 0) setConfig(prev => ({ ...prev, compositionId: validComps[0].id }));
                }}>
                  {availableOpenings.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label" style={{ color: '#3b82f6' }}>3. Modèle d'ouvrage</label>
                <select name="compositionId" value={config.compositionId} onChange={handleChange} className="input">
                  {database.compositions.filter(c => c.categoryId === activeCat && c.openingType === activeOpen).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="label" style={{ color: '#3b82f6' }}>4. Sens d'ouverture</label>
                <select className="input" name="openingDirection" value={config.openingDirection || 'gauche'} onChange={handleChange}>
                  <option value="gauche">Ouvrant Gauche</option>
                  <option value="droit">Ouvrant Droit</option>
                </select>
              </div>
            </div>
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

          {hasCouvreJoint && (
            <div className="form-group" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <label className="label" style={{ marginBottom: '0.75rem' }}>Couvres-Joints Optionnels</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {['Haut', 'Bas', 'Gauche', 'Droite'].map(side => {
                  const sideKey = side === 'Haut' ? 'top' : side === 'Bas' ? 'bottom' : side === 'Gauche' ? 'left' : 'right';
                  return (
                    <label key={side} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input type="checkbox" checked={config.optionalSides?.[sideKey] || false}
                        onChange={e => setConfig(prev => ({ ...prev, optionalSides: { ...(prev.optionalSides || {}), [sideKey]: e.target.checked } }))}
                        style={{ width: '1.2rem', height: '1.2rem' }} />
                      {side}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {availableOptions.length > 0 && (
            <div className="form-group" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <label className="label" style={{ marginBottom: '0.75rem' }}>Options & Variantes</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flexDirection: 'column' }}>
                {availableOptions.map(opt => (
                  <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={config.selectedOptions?.includes(opt.id) || false}
                      onChange={e => setConfig(prev => ({ ...prev, selectedOptions: e.target.checked ? [...(prev.selectedOptions || []), opt.id] : (prev.selectedOptions || []).filter(id => id !== opt.id) }))}
                      style={{ width: '1.2rem', height: '1.2rem' }} />
                    <span>{opt.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Volet Roulant */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
              <input type="checkbox" checked={config.hasShutter || false} onChange={e => setConfig(prev => ({ ...prev, hasShutter: e.target.checked }))} style={{ width: '1.2rem', height: '1.2rem' }} />
              Ajouter un Volet Roulant
            </label>
            {config.hasShutter && database.shutterComponents && (
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  { key: 'caissonId', label: 'Caisson', items: database.shutterComponents.caissons },
                  { key: 'lameId', label: 'Lame', items: database.shutterComponents.lames },
                  { key: 'glissiereId', label: 'Glissière', items: database.shutterComponents.glissieres },
                  { key: 'axeId', label: 'Axe', items: database.shutterComponents.axes },
                  { key: 'kitId', label: 'Kit Manœuvre', items: database.shutterComponents.kits }
                ].map(({ key, label, items }) => {
                  let filteredItems = items || [];
                  if (key === 'glissiereId' && currentComp?.rangeId) {
                      filteredItems = filteredItems.filter(i => !i.rangeId || i.rangeId === currentComp.rangeId);
                  }

                  const handleShutterChange = (val) => {
                    setConfig(prev => ({
                      ...prev,
                      shutterConfig: { ...(prev.shutterConfig || {}), [key]: val }
                    }));
                  };

                  return (
                    <div key={key} className="form-group">
                      <label className="label" style={{ fontSize: '0.8rem' }}>{label}</label>
                      <select className="input" value={config.shutterConfig?.[key] || ''} onChange={e => handleShutterChange(e.target.value)}>
                        {key === 'glissiereId' && <option value="AUTO">-- Automatique (Kit) --</option>}
                        {filteredItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!validation.valid && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '0.5rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={16} /><span style={{ fontSize: '0.875rem' }}>{validation.message}</span>
            </div>
          )}

          {/* Detail Table */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '1rem' }}>RÉSUMÉ DÉTAILLÉ DU CALCUL</h3>
            <table className="data-table" style={{ fontSize: '0.7rem' }}>
              <thead><tr><th>Composant</th><th>Formule</th><th>Calcul</th><th>Nbre</th><th>Mesure Totale</th><th>Prix Unit.</th><th style={{ textAlign: 'right' }}>Prix Total</th></tr></thead>
              <tbody>
                {priceData?.bom.profiles.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.label}</td><td style={{ color: '#64748b', fontSize: '0.65rem' }}>{p.formula}</td>
                    <td style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{p.resolvedFormula}</td><td>{p.qty}u</td>
                    <td>{Math.round(p.totalMeasure)} mm</td><td>{p.unitPrice?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.cost.toFixed(2)} DZD</td>
                  </tr>
                ))}
                {priceData?.bom.accessories.map((acc, i) => (
                  <tr key={`acc-${i}`}>
                    <td style={{ fontWeight: 600 }}>{acc.label}</td><td style={{ color: '#64748b', fontSize: '0.65rem' }}>{acc.formula}</td>
                    <td style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{acc.resolvedFormula}</td><td>{acc.multiplier}u</td>
                    <td>{acc.totalMeasure?.toFixed(2)} {acc.unit === 'Ml' || acc.unit === 'Joint' ? 'mm' : 'u'}</td>
                    <td>{acc.unitPrice?.toFixed(2)}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{acc.cost.toFixed(2)} DZD</td>
                  </tr>
                ))}
                {priceData?.bom.gasket && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>Joint de vitrage</td><td style={{ color: '#64748b', fontSize: '0.65rem' }}>{priceData.bom.gasket.formula}</td>
                    <td style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{priceData.bom.gasket.resolvedFormula}</td><td>1u</td>
                    <td>{priceData.bom.gasket.totalMeasure.toFixed(2)} mm</td><td>{priceData.bom.gasket.unitPrice?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{priceData.bom.gasket.cost.toFixed(2)} DZD</td>
                  </tr>
                )}
                {priceData?.bom.shutters && priceData.bom.shutters.map((s, i) => (
                  <tr key={`shutter-${i}`}>
                    <td style={{ fontWeight: 600 }}>[Volet] {s.name}</td><td style={{ color: '#64748b', fontSize: '0.65rem' }}>{s.formula}</td>
                    <td style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{s.resolvedFormula || '-'}</td><td>{s.qty?.toFixed(2)} {s.priceUnit}</td>
                    <td>-</td><td>{s.price?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{(s.cost || 0).toFixed(2)} DZD</td>
                  </tr>
                ))}
                {priceData && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>Vitrage</td><td>-</td><td>-</td><td>{priceData.bom.glass.qty}u</td>
                    <td>{priceData.bom.glass.area.toFixed(2)} m²</td><td>{priceData.bom.glass.pricePerM2?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{priceData.bom.glass.cost.toFixed(2)} DZD</td>
                  </tr>
                )}
                <tr style={{ background: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}>
                  <td colSpan="6" style={{ textAlign: 'right' }}>COÛT TOTAL DE REVIENT</td>
                  <td style={{ textAlign: 'right', color: '#1e293b' }}>{priceData ? priceData.cost.toFixed(2) : '0.00'} DZD</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Drawing + Price */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <JoineryCanvas 
            config={config} 
            width={350} 
            height={350} 
            database={database} 
            onDrawComplete={(dataUrl) => setConfig(prev => ({...prev, thumbnail: dataUrl}))} 
          />
          <div className="price-card shadow-lg">
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Coefficient de Marge</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="number" step="0.1" min="1" value={config.margin}
                  onChange={e => setConfig(prev => ({ ...prev, margin: parseFloat(e.target.value) || 1 }))}
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '0.4rem', padding: '0.4rem 0.6rem', width: '80px', fontSize: '1.1rem', fontWeight: 700 }} />
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>x Coût Matériaux</span>
              </div>
            </div>
            <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>TOTAL DEVIS (HT) — 1 unité</span>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>
              {priceData ? `${priceData.priceHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD` : '---'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1rem' }}>
              <div style={{ opacity: 0.9 }}>TVA (19%)</div>
              <div style={{ fontWeight: 600 }}>{priceData ? `${(priceData.priceHT * 0.19).toFixed(2)} DZD` : '---'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <div style={{ fontWeight: 600 }}>PRIX TTC × {qty}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {priceData ? `${(priceData.priceTTC * qty).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD` : '---'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SETTINGS PANEL ────────────────────────────────────────────────────────
const QuoteSettingsPanel = ({ settings, onSave, onClose }) => {
  const [draft, setDraft] = useState({ ...settings });
  const logoRef = useRef();
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDraft(prev => ({ ...prev, logoBase64: ev.target.result }));
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', width: '560px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 700 }}>⚙️ Paramètres du Devis</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Identité de la Société</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                { key: 'companyName', label: 'Nom de la société', icon: Building2 },
                { key: 'companyAddress', label: 'Adresse', icon: MapPin },
                { key: 'companyPhone', label: 'Téléphone', icon: Phone },
                { key: 'companyEmail', label: 'Email', icon: Mail },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon size={16} color="#64748b" />
                  <input className="input" placeholder={label} value={draft[key] || ''} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} style={{ flex: 1 }} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Informations Légales & Bancaires</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { key: 'companyRC', label: 'RC (Registre de Commerce)' },
                { key: 'companyIMP', label: 'IMP (Article d\'Imposition)' },
                { key: 'companyMF', label: 'MF (Matricule Fiscal)' },
                { key: 'companyBank', label: 'RIP / Compte Bancaire' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</label>
                  <input className="input" value={draft[key] || ''} onChange={e => setDraft(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Logo</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {draft.logoBase64 && <img src={draft.logoBase64} alt="logo" style={{ height: '60px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.25rem' }} />}
              <button onClick={() => logoRef.current?.click()} style={{ padding: '0.5rem 1rem', border: '1.5px dashed #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', background: '#f8fafc', color: '#64748b', fontSize: '0.85rem' }}>
                {draft.logoBase64 ? 'Changer le logo' : '+ Téléverser un logo'}
              </button>
              {draft.logoBase64 && <button onClick={() => setDraft(p => ({ ...p, logoBase64: null }))} style={{ padding: '0.3rem 0.7rem', border: '1px solid #fee2e2', borderRadius: '0.4rem', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>Supprimer</button>}
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Paramètres du Devis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Préfixe numéro</label>
                <input className="input" value={draft.quotePrefix || ''} onChange={e => setDraft(p => ({ ...p, quotePrefix: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Validité (jours)</label>
                <input type="number" className="input" value={draft.validityDays || 30} onChange={e => setDraft(p => ({ ...p, validityDays: parseInt(e.target.value) || 30 }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>TVA (%)</label>
                <input type="number" className="input" value={draft.tvaRate || 19} onChange={e => setDraft(p => ({ ...p, tvaRate: parseFloat(e.target.value) || 19 }))} />
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Pied de page (conditions)</label>
            <textarea className="input" rows="3" value={draft.footerText || ''} onChange={e => setDraft(p => ({ ...p, footerText: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer', background: 'white', color: '#64748b' }}>Annuler</button>
          <button onClick={() => { onSave(draft); onClose(); }} style={{ flex: 2, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', background: '#2563eb', color: 'white', fontWeight: 700 }}>
            💾 Sauvegarder & Définir par défaut
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
const CommercialModule = ({ config, setConfig, database, setDatabase, currentQuote, setCurrentQuote, quoteSettings, setQuoteSettings, onNewQuote }) => {
  const engine = useMemo(() => new FormulaEngine(database), [database]);
  const [localView, setLocalView] = useState('list'); // 'list' | 'configure'
  const [editingItemId, setEditingItemId] = useState(null);
  const [draftConfig, setDraftConfig] = useState({ ...EMPTY_CONFIG });
  const [draftLabel, setDraftLabel] = useState('');
  const [draftQty, setDraftQty] = useState(1);
  const [activeListTab, setActiveListTab] = useState('quote'); // 'quote' | 'consumables'
  const [showSettings, setShowSettings] = useState(false);
  const [consumableFilter, setConsumableFilter] = useState('all'); // 'all' | item id

  const quote = currentQuote || { id: '', number: '', items: [] };

  // Totals
  const totals = useMemo(() => {
    let ht = 0;
    (quote.items || []).forEach(item => {
      ht += (item.unitPriceHT || 0) * (item.qty || 1);
    });
    const tva = ht * ((quoteSettings?.tvaRate || 19) / 100);
    return { ht, tva, ttc: ht + tva };
  }, [quote.items, quoteSettings]);

  // Consolidated BOM for consumables
  const allBoms = useMemo(() => {
    if (!quote.items?.length) return [];
    return quote.items.map(item => {
      try {
        const bom = engine.calculateBOM(item.config);
        return { itemId: item.id, label: item.label, bom };
      } catch { return null; }
    }).filter(Boolean);
  }, [quote.items, engine]);

  const consolidatedProfiles = useMemo(() => {
    const map = {};
    allBoms.forEach(({ itemId, label, bom }) => {
      const item = quote.items.find(i => i.id === itemId);
      const qty = item?.qty || 1;
      bom.profiles.forEach(p => {
        const key = p.id;
        if (!map[key]) {
          map[key] = { ...p, totalMeasure: p.length * p.qty * qty, items: [{ itemId, label, perUnit: p.length * p.qty }] };
        } else {
          map[key].totalMeasure += p.length * p.qty * qty;
          map[key].items.push({ itemId, label, perUnit: p.length * p.qty });
        }
      });
    });
    return Object.values(map);
  }, [allBoms, quote.items]);

  const startNewProduct = () => {
    const firstComp = database.compositions?.[0];
    setDraftConfig({
      ...EMPTY_CONFIG,
      compositionId: firstComp?.id || '',
      colorId: database.colors?.[0]?.id || '',
      glassId: database.glass?.[0]?.id || '',
    });
    setDraftLabel('');
    setDraftQty(1);
    setEditingItemId(null);
    setLocalView('configure');
  };

  const startEditProduct = (item) => {
    setDraftConfig({ ...item.config });
    setDraftLabel(item.label);
    setDraftQty(item.qty);
    setEditingItemId(item.id);
    setLocalView('configure');
  };

  const handleSaveProduct = () => {
    const priceData = engine.calculatePrice(draftConfig);
    const newItem = {
      id: editingItemId || `ITEM-${Date.now()}`,
      label: draftLabel || `Produit ${(quote.items?.length || 0) + 1}`,
      qty: draftQty,
      config: { ...draftConfig },
      unitPriceHT: priceData?.priceHT || 0,
      unitPriceTTC: priceData?.priceTTC || 0,
      priceData,
    };
    setCurrentQuote(prev => {
      const items = editingItemId
        ? (prev.items || []).map(i => i.id === editingItemId ? newItem : i)
        : [...(prev.items || []), newItem];
      return { ...prev, items };
    });
    // Also sync currentConfig for backward compat with ProductionModule
    setConfig(draftConfig);
    setLocalView('list');
  };

  const handleDeleteItem = (id) => {
    if (!window.confirm('Supprimer ce produit du devis ?')) return;
    setCurrentQuote(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  };

  const handleDuplicateItem = (item) => {
    const copy = { ...item, id: `ITEM-${Date.now()}`, label: `${item.label} (copie)` };
    setCurrentQuote(prev => ({ ...prev, items: [...prev.items, copy] }));
  };

  const handleQtyChange = (id, val) => {
    const q = Math.max(1, parseInt(val) || 1);
    setCurrentQuote(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? { ...i, qty: q } : i) }));
  };

  const filteredBoms = consumableFilter === 'all' ? allBoms : allBoms.filter(b => b.itemId === consumableFilter);

  // ── RENDER: CONFIGURE VIEW ──
  if (localView === 'configure') {
    return (
      <ProductConfigurator
        config={draftConfig}
        setConfig={setDraftConfig}
        database={database}
        onSave={handleSaveProduct}
        onCancel={() => setLocalView('list')}
        label={draftLabel}
        setLabel={setDraftLabel}
        qty={draftQty}
        setQty={setDraftQty}
      />
    );
  }

  const handleSaveGlobalQuote = () => {
    if (setDatabase) {
      const finalQuote = { ...quote, totals };
      setDatabase(prev => {
        const exists = prev.quotes?.some(q => q.id === quote.id);
        const quotes = exists 
          ? (prev.quotes || []).map(q => q.id === quote.id ? finalQuote : q)
          : [...(prev.quotes || []), finalQuote];
        return { ...prev, quotes };
      });
      alert('Devis enregistré avec succès !');
    } else {
      console.error('setDatabase est introuvable');
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Helper for reliable number formatting in jsPDF
    const formatPrice = (val) => Number(val || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    // ----- HEADER SECTION -----
    // Left: Logo
    if (quoteSettings?.logoBase64) {
      try {
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 35, 20, '', 'FAST');
      } catch (e) {}
    }
    
    // Middle: Company Information
    const midX = 60;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(quoteSettings?.companyName || 'Mon Entreprise', midX, y + 5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let phoneEmailYOffset = 15;
    if (quoteSettings?.companyAddress) {
      const addressLines = doc.splitTextToSize(quoteSettings.companyAddress, 85);
      doc.text(addressLines, midX, y + 10);
      phoneEmailYOffset = 10 + (addressLines.length * 4);
    }
    const phone = quoteSettings?.companyPhone || '';
    const email = quoteSettings?.companyEmail || '';
    doc.text(`${phone} ${email ? ' - ' + email : ''}`, midX, y + phoneEmailYOffset);

    // Right: Legal Information (RC, AI, NIF)
    const rightX = pw - 15;
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    let rightY = y + 5;
    if (quoteSettings?.companyRC) { doc.text(`RC N: ${quoteSettings.companyRC}`, rightX, rightY, { align: 'right' }); rightY += 5; }
    if (quoteSettings?.companyIMP) { doc.text(`AI N: ${quoteSettings.companyIMP}`, rightX, rightY, { align: 'right' }); rightY += 5; }
    if (quoteSettings?.companyMF) { doc.text(`NIF N: ${quoteSettings.companyMF}`, rightX, rightY, { align: 'right' }); rightY += 5; }
    doc.setTextColor(0, 0, 0);

    y = 40;
    doc.setLineWidth(0.5);
    doc.setDrawColor(220, 38, 38); // Redish line similar to image
    doc.line(15, y, pw - 15, y);
    y += 10;

    // ----- TITLE -----
    doc.setFontSize(22);
    doc.setFont('helvetica', 'normal');
    doc.text('Devis Estimatif', pw / 2, y, { align: 'center' });
    y += 15;

    // ----- CLIENT & QUOTE INFO -----
    doc.setFontSize(11);
    const currentClient = database.clients?.find(c => c.id === quote.clientId);
    
    // Left side: Client
    doc.setFont('helvetica', 'normal');
    doc.text(`Client : ${currentClient ? currentClient.nom : ''}`, 15, y);
    doc.text(`Contact : ${currentClient?.telephone || ''}`, 15, y + 6);
    
    // Right side: Quote
    doc.text(`Devis : ${quote.number}`, pw / 2 + 10, y);
    doc.text(`Validité de l'offre : ${(quoteSettings?.validityDays || 30)} jours`, pw / 2 + 10, y + 6);

    y += 15;

    // ----- TABLE HEADER -----
    doc.setFillColor(40, 40, 40);
    doc.rect(15, y, pw - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Image', 25, y + 5.5);
    doc.text('Description', 60, y + 5.5);
    doc.text('QTE', 135, y + 5.5, { align: 'right' });
    doc.text('PRIX UNITAIRE', 165, y + 5.5, { align: 'right' });
    doc.text('MONTANT TOTAL', pw - 17, y + 5.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 8;

    // ----- TABLE ROWS -----
    doc.setFontSize(9);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);

    if (quote.items && quote.items.length > 0) {
      quote.items.forEach((item, idx) => {
        const rowHeight = 40;
        
        // Draw row border
        doc.rect(15, y, pw - 30, rowHeight);
        
        // Image
        if (item.config?.thumbnail) {
          try {
             doc.addImage(item.config.thumbnail, 'PNG', 17, y + 2, 35, 35, '', 'FAST');
          } catch(e){}
        }
        
        // Description
        const descX = 60;
        let descY = y + 8;
        doc.setFont('helvetica', 'normal');
        
        const comp = database.compositions?.find(c => c.id === item.config?.compositionId);
        const color = database.colors?.find(c => c.id === item.config?.colorId);
        
        doc.text(`Système : ${comp?.name || ''}`, descX, descY); descY += 5;
        doc.text(`Couleur : ${color?.name || item.config?.colorId || ''}`, descX, descY); descY += 5;
        doc.text(`Dimensions : ${item.config?.L} x ${item.config?.H} mm`, descX, descY); descY += 5;
        
        // Specific configs
        const hasTopJoin = item.config?.optionalSides?.top;
        const hasLeftJoin = item.config?.optionalSides?.left;
        doc.text(`Couvre Joint : ${hasTopJoin || hasLeftJoin ? 'Oui' : 'Non'}`, descX, descY); descY += 5;

        // QTY & Prices
        const priceU = formatPrice(item.unitPriceHT);
        const totalLine = formatPrice((item.unitPriceHT || 0) * item.qty);
        
        doc.text(`${item.qty}`, 133, y + 20, { align: 'right' });
        doc.text(`${priceU} DZD`, 165, y + 20, { align: 'right' });
        doc.text(`${totalLine} DZD`, pw - 17, y + 20, { align: 'right' });
        
        y += rowHeight;
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
      });
    }

    y += 10;
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    // ----- TOTALS & FOOTER -----
    // Left Box: Signatures
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, y, 90, 30, 3, 3); // Signature box
    doc.line(60, y, 60, y+30); // split vertical
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Commercial', 37, y + 6, { align: 'center' });
    doc.text('Client', 82, y + 6, { align: 'center' });

    // Right Box: Totals
    const rightBoxX = 110;
    doc.roundedRect(rightBoxX, y, pw - 15 - rightBoxX, 30, 3, 3);
    const tvaRate = quoteSettings?.tvaRate || 19;
    
    doc.text('Montant HT', rightBoxX + 5, y + 8);
    doc.text(`${formatPrice(totals.ht)} DZD`, pw - 20, y + 8, { align: 'right' });
    
    doc.text(`Total TVA ${tvaRate}%`, rightBoxX + 5, y + 16);
    doc.text(`${formatPrice(totals.tva)} DZD`, pw - 20, y + 16, { align: 'right' });
    
    doc.text('Total TTC', rightBoxX + 5, y + 24);
    doc.text(`${formatPrice(totals.ttc)} DZD`, pw - 20, y + 24, { align: 'right' });

    y += 40;
    
    // Amount text in words
    const numberToFrenchWords = (num) => {
      if (!num || num === 0) return 'Zéro dinars';
      const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
      const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
      const convertLT1000 = (n) => {
        if (n === 0) return '';
        let res = '';
        if (n >= 100) {
            const h = Math.floor(n / 100);
            res += (h === 1 ? 'cent' : units[h] + ' cent') + (n % 100 === 0 && h > 1 ? 's' : '') + ' ';
            n %= 100;
        }
        if (n > 0) {
            if (n < 20) {
                res += units[n] + ' ';
            } else {
                const t = Math.floor(n / 10);
                const u = n % 10;
                if (t === 7 || t === 9) {
                    res += tens[t - 1] + (u===1 ? '-et-' : '-') + units[10 + u] + ' ';
                } else {
                    res += tens[t] + (u===1 && t<8 ? '-et-un' : (u>0 ? '-' + units[u] : '')) + ' ';
                }
            }
        }
        return res;
      };
      const convert = (n) => {
        if (n === 0) return 'zéro';
        let res = '';
        if (n >= 1000000) {
            const m = Math.floor(n / 1000000);
            res += convertLT1000(m) + 'million' + (m > 1 ? 's ' : ' ');
            n %= 1000000;
        }
        if (n >= 1000) {
            const th = Math.floor(n / 1000);
            res += (th === 1 ? 'mille ' : convertLT1000(th) + 'mille ');
            n %= 1000;
        }
        if (n > 0) res += convertLT1000(n);
        return res.trim();
      };
      const intPart = Math.floor(num);
      const decPart = Math.round((num - intPart) * 100);
      let text = convert(intPart) + ' dinars';
      if (decPart > 0) text += ' et ' + convert(decPart) + ' centimes';
      return text.charAt(0).toUpperCase() + text.slice(1);
    };

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(`Arrêté le présent devis à la somme de : ${numberToFrenchWords(totals.ttc)}.`, 15, y);

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(quoteSettings?.footerText || '', pw / 2, 285, { align: 'center' });

    doc.save(`Devis_${quote.number}.pdf`);
  };

  // ── RENDER: LIST VIEW ──
  const validityDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (quoteSettings?.validityDays || 30));
    return d.toLocaleDateString('fr-FR');
  })();

  return (
    <div className="animate-fade-in">
      {showSettings && (
        <QuoteSettingsPanel settings={quoteSettings} onSave={setQuoteSettings} onClose={() => setShowSettings(false)} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Devis Commercial</h1>
          <p style={{ color: '#64748b' }}>Gérez vos produits et générez vos devis professionnels.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem' }}>
            <Settings size={16} /> Paramètres
          </button>
          <button onClick={onNewQuote} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem' }}>
            📄 Nouveau Devis
          </button>
          <button onClick={startNewProduct} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.5rem', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
            <Plus size={16} /> Ajouter un produit
          </button>
        </div>
      </div>

      {/* Quote Header Card */}
      <div className="glass shadow-md" style={{ marginBottom: '1.5rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        {quoteSettings?.logoBase64 && <img src={quoteSettings.logoBase64} alt="logo" style={{ height: '50px', objectFit: 'contain' }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{quoteSettings?.companyName || 'Nom de la Société'}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{quoteSettings?.companyAddress}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{quoteSettings?.companyPhone} {quoteSettings?.companyEmail ? '· ' : ''} {quoteSettings?.companyEmail}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
             {[
               quoteSettings?.companyRC ? `RC: ${quoteSettings.companyRC}` : null,
               quoteSettings?.companyIMP ? `IMP: ${quoteSettings.companyIMP}` : null,
               quoteSettings?.companyMF ? `MF: ${quoteSettings.companyMF}` : null,
             ].filter(Boolean).join(' · ')}
          </div>
          {quoteSettings?.companyBank && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Banque/RIP: {quoteSettings.companyBank}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#2563eb' }}>{quote.number}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
            <Calendar size={12} /> {new Date(quote.createdAt || Date.now()).toLocaleDateString('fr-FR')}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
            <Clock size={12} /> Valide jusqu'au {validityDate}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <span style={{ fontWeight: 600 }}>Client :</span>
            <select 
              value={quote.clientId || ''} 
              onChange={e => setCurrentQuote(p => ({ ...p, clientId: e.target.value }))}
              style={{ padding: '0.2rem', borderRadius: '0.3rem', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#f8fafc' }}
            >
              <option value="">-- Aucun --</option>
              {(database.clients || []).map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        {[
          { id: 'quote', label: '📋 Lignes du Devis', count: quote.items?.length || 0 },
          { id: 'consumables', label: '🔩 Consommables (Interne)', count: null },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveListTab(tab.id)}
            style={{ padding: '0.5rem 1.2rem', fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: activeListTab === tab.id ? '3px solid #2563eb' : '3px solid transparent', color: activeListTab === tab.id ? '#2563eb' : '#64748b', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {tab.label}
            {tab.count !== null && <span style={{ background: '#e2e8f0', borderRadius: '999px', padding: '0 0.5rem', fontSize: '0.75rem' }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Quote Lines */}
      {activeListTab === 'quote' && (
        <div>
          {quote.items?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
              <Package size={48} style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Aucun produit dans ce devis</p>
              <p>Cliquez sur "Ajouter un produit" pour commencer.</p>
            </div>
          ) : (
            <>
              <div className="glass shadow-md" style={{ marginBottom: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th>Modèle / Dimensions</th>
                      <th>Finition</th>
                      <th>Qté</th>
                      <th>Prix U. HT</th>
                      <th>Total HT</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(quote.items || []).map((item, idx) => {
                      const comp = database.compositions?.find(c => c.id === item.config?.compositionId);
                      const color = database.colors?.find(c => c.id === item.config?.colorId);
                      const totalHT = (item.unitPriceHT || 0) * (item.qty || 1);
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div>{item.label}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{comp?.name}</div>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 700, color: '#2563eb' }}>{item.config?.L} × {item.config?.H}</span>{' '}mm
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{color?.name || item.config?.colorId}</td>
                          <td>
                            <input type="number" min="1" value={item.qty}
                              onChange={e => handleQtyChange(item.id, e.target.value)}
                              style={{ width: '60px', padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.4rem', textAlign: 'center', fontWeight: 700 }} />
                          </td>
                          <td style={{ fontWeight: 600 }}>{(item.unitPriceHT || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                          <td style={{ fontWeight: 700, color: '#2563eb' }}>{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => startEditProduct(item)} title="Modifier" style={{ padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', color: '#2563eb' }}><Edit2 size={14} /></button>
                              <button onClick={() => handleDuplicateItem(item)} title="Dupliquer" style={{ padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', color: '#10b981' }}><Copy size={14} /></button>
                              <button onClick={() => handleDeleteItem(item.id)} title="Supprimer" style={{ padding: '0.3rem', border: '1px solid #fee2e2', borderRadius: '0.3rem', background: '#fef2f2', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div className="price-card shadow-lg" style={{ minWidth: '320px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', opacity: 0.85 }}>
                    <span>Total HT</span><span>{totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', opacity: 0.85 }}>
                    <span>TVA ({quoteSettings?.tvaRate || 19}%)</span><span>{totals.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.3rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    <span>TOTAL TTC</span><span>{totals.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', opacity: 0.7, textAlign: 'right' }}>
                    Validité : {quoteSettings?.validityDays || 30} jours ({validityDate})
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem' }}>
                    <button onClick={handleSaveGlobalQuote} className="btn shadow-md" style={{ flex: 1, padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none' }}>
                      <Save size={18} /> Sauvegarder
                    </button>
                    <button onClick={generatePDF} className="btn btn-primary shadow-md" style={{ flex: 1, padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <FileText size={18} /> Exporter PDF
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Consumables Tab */}
      {activeListTab === 'consumables' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Filtrer par produit :</label>
            <select value={consumableFilter} onChange={e => setConsumableFilter(e.target.value)} className="input" style={{ width: 'auto' }}>
              <option value="all">Tous les produits (total consolidé)</option>
              {(quote.items || []).map(item => (
                <option key={item.id} value={item.id}>{item.label} — {item.config?.L}×{item.config?.H}mm (×{item.qty})</option>
              ))}
            </select>
          </div>

          {filteredBoms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Ajoutez des produits au devis pour voir les consommables.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Profiles */}
              <div className="glass shadow-md" style={{ borderLeft: '4px solid #8b5cf6' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }}></span>
                  Profilés Aluminium
                </h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Référence</th>
                      <th>Finition</th>
                      <th>Désignation</th>
                      <th>Longueur unitaire</th>
                      <th>Quantité totale</th>
                      <th>Consommation (ML)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedProfiles
                      .filter(p => consumableFilter === 'all' || p.items.some(it => it.itemId === consumableFilter))
                      .map((p, i) => {
                        const item = quote.items?.find(it => it.id === p.items[0]?.itemId);
                        const color = database.colors?.find(c => c.id === item?.config?.colorId);
                        const totalMl = consumableFilter === 'all' 
                          ? p.totalMeasure 
                          : p.items.filter(it => it.itemId === consumableFilter).reduce((s, it) => {
                              const itm = quote.items?.find(qi => qi.id === it.itemId);
                              return s + it.perUnit * (itm?.qty || 1);
                            }, 0);
                        return (
                          <tr key={i}>
                            <td style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{p.id}</td>
                            <td style={{ fontSize: '0.85rem' }}>{color?.name || '—'}</td>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td>{Math.round(p.length)} mm</td>
                            <td style={{ fontWeight: 700 }}>{p.qty}</td>
                            <td style={{ color: '#8b5cf6', fontWeight: 700 }}>{(totalMl / 1000).toFixed(2)} m</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Accessories */}
              {filteredBoms.some(b => b.bom.accessories?.length > 0 || b.bom.gasket) && (
                <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>🔩 Accessoires & Joints</h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>Référence</th><th>Finition</th><th>Désignation</th><th>Longueur</th><th>Quantité</th></tr>
                    </thead>
                    <tbody>
                      {filteredBoms.flatMap(({ itemId, bom }) => {
                        const item = quote.items?.find(i => i.id === itemId);
                        const color = database.colors?.find(c => c.id === item?.config?.colorId);
                        const qty = item?.qty || 1;
                        const rows = [];
                        const isMl = (unit) => ['M', 'ML', 'JOINT'].includes((unit || '').toUpperCase());
                        [...(bom.accessories || []), bom.gasket].filter(Boolean).forEach((acc, ai) => {
                          rows.push(
                            <tr key={`${itemId}-acc-${ai}`}>
                              <td style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{acc.id}</td>
                              <td style={{ fontSize: '0.85rem' }}>{color?.name || '—'}</td>
                              <td style={{ fontWeight: 600 }}>{acc.label || acc.name}</td>
                              <td>{isMl(acc.unit) ? `${((acc.totalMeasure || 0) * qty / 1000).toFixed(2)} m` : '—'}</td>
                              <td style={{ fontWeight: 700 }}>{isMl(acc.unit) ? '—' : Math.round(acc.qty * qty)}</td>
                            </tr>
                          );
                        });
                        return rows;
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Glass */}
              {filteredBoms.some(b => b.bom.glass) && (
                <div className="glass shadow-md" style={{ borderLeft: '4px solid #06b6d4' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>🪟 Vitrages</h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>Référence</th><th>Finition</th><th>Désignation</th><th>Longueur (L × H)</th><th>Quantité</th></tr>
                    </thead>
                    <tbody>
                      {filteredBoms.map(({ itemId, bom }) => {
                        const item = quote.items?.find(i => i.id === itemId);
                        const color = database.colors?.find(c => c.id === item?.config?.colorId);
                        const qty = item?.qty || 1;
                        const g = bom.glass;
                        if (!g) return null;
                        return (
                          <tr key={`${itemId}-glass`}>
                            <td style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{g.id}</td>
                            <td style={{ fontSize: '0.85rem' }}>{color?.name || '—'}</td>
                            <td style={{ fontWeight: 600 }}>{g.name || g.composition}</td>
                            <td style={{ fontWeight: 700 }}>{Math.round(g.width || 0)} × {Math.round(g.height || 0)} mm</td>
                            <td style={{ fontWeight: 700 }}>{Math.round((g.qty || 1) * qty)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommercialModule;
