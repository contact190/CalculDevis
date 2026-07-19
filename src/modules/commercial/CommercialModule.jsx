import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calculator, Package, Settings, FileText, Info, LayoutGrid, Plus, Edit2, Trash2, Copy, ArrowLeft, Save, ChevronDown, ChevronUp, Building2, Phone, Mail, MapPin, Calendar, Clock, GitCompare, Search, Layers, AlertTriangle, X } from 'lucide-react';
import { FormulaEngine } from '../../engine/formula-engine';
import JoineryCanvas from '../../components/shared/JoineryCanvas';
import LayoutComposer, { defaultLayout, rescaleTree } from '../../components/shared/LayoutComposer';
import jsPDF from 'jspdf';
import { getTechnicalDrawingDataURL } from '../../utils/drawingUtils';


const EMPTY_CONFIG = {
  L: 1200, H: 2150,
  compositionId: '', colorId: '', glassId: '', openingDirection: 'gauche',
  optionalSides: { top: true, bottom: true, left: true, right: true },
  selectedOptions: [],
  hasShutter: false,
  shutterConfig: { caissonId: '', lameId: '', glissiereId: 'AUTO', axeId: '', kitId: '', glissiereParams: {} },
  margin: 2.2,
  useCustomLayout: false,
  customLayout: null,
  compoundType: 'none',
  compoundConfig: {
    parts: [
      { id: 'main', type: 'opening', compositionId: '', glassId: '', width: 800, height: 1500, subParts: null },
      { id: 'fix1', type: 'fixe', glassId: '', width: 400, height: 1500, subParts: null }
    ],
    orientation: 'horizontal',
    unionId: 'AUTO', 
    traverseId: 'AUTO',
    shutterMode: 'total',
  },
  doorConfig: {
    type: 'seuil', // 'seuil', 'complement', 'plainte'
  }
};

const getCanonicalConfigKey = (config) => {
  if (!config) return '';
  const copy = {
    L: config.L,
    H: config.H,
    compositionId: config.compositionId,
    colorId: config.colorId,
    glassId: config.glassId,
    openingDirection: config.openingDirection,
    optionalSides: config.optionalSides,
    selectedOptions: Array.isArray(config.selectedOptions) ? [...config.selectedOptions].sort() : [],
    hasShutter: config.hasShutter,
    shutterConfig: config.shutterConfig,
    compoundType: config.compoundType,
    compoundConfig: config.compoundConfig,
    doorConfig: config.doorConfig,
    useCustomLayout: config.useCustomLayout,
    customLayout: config.customLayout
  };
  return JSON.stringify(copy);
};

// ─── REUSABLE COMPONENT: SearchableDropdown ────────────────────────────────
const SearchableDropdown = ({ value, onChange, options, placeholder, style = {}, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  const filteredOptions = (options || []).filter(o => {
    if (!o) return false;
    const label = o.label ? String(o.label) : '';
    const val = o.value != null ? String(o.value) : '';
    return label.toLowerCase().includes(search.toLowerCase()) || 
           val.toLowerCase().includes(search.toLowerCase());
  });

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: compact ? 'auto' : '100%', textAlign: 'left', ...style }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: compact ? '0.3rem 0.6rem' : '0.6rem 0.75rem',
          border: '1px solid #cbd5e1',
          borderRadius: compact ? '0.4rem' : '0.5rem',
          background: 'white',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: compact ? '0.8rem' : '0.9rem',
          fontWeight: 600,
          minWidth: compact ? '160px' : 'auto',
          textAlign: 'left'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={compact ? 12 : 16} color="#64748b" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>

      {isOpen && (
        <div className="shadow-xl" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.5rem',
          marginTop: '0.25rem',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '0.75rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#3b82f6' }} />
              <input 
                autoFocus
                className="input"
                placeholder="Tapez le nom ou l'ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                style={{ 
                  paddingLeft: '2.2rem', 
                  fontSize: '0.85rem', 
                  height: '36px', 
                  width: '100%', 
                  textAlign: 'left',
                  border: '1px solid #3b82f6',
                  borderRadius: '0.5rem',
                  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)',
                  background: 'white'
                }}
              />
            </div>
          </div>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {filteredOptions.length > 0 ? filteredOptions.map(o => (
              <div 
                key={o.value}
                onClick={(e) => { e.stopPropagation(); onChange(o.value); setIsOpen(false); setSearch(''); }}
                style={{
                  padding: '0.75rem 1rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: value === o.value ? '#eff6ff' : 'transparent',
                  color: value === o.value ? '#2563eb' : '#1e293b',
                  fontWeight: value === o.value ? 600 : 400,
                  transition: 'all 0.15s ease',
                  margin: '0 0.25rem',
                  borderRadius: '0.4rem'
                }}
                onMouseEnter={e => {
                  e.target.style.background = value === o.value ? '#eff6ff' : '#f1f5f9';
                  e.target.style.paddingLeft = '1.25rem';
                }}
                onMouseLeave={e => {
                  e.target.style.background = value === o.value ? '#eff6ff' : 'transparent';
                  e.target.style.paddingLeft = '1rem';
                }}
              >
                {o.label}
              </div>
            )) : (
              <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>Aucun résultat</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SUB-COMPONENT: Product Configurator (View B) ──────────────────────────
const ProductConfigurator = ({ config, setConfig, database, onSave, onCancel, label, setLabel, itemRef, setItemRef, qty, setQty, globalMargin }) => {
  const engine = useMemo(() => new FormulaEngine(database), [database]);
  const [validation, setValidation] = useState({ valid: true });
  const [priceData, setPriceData] = useState(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tech');
  const [showDetailsTablet, setShowDetailsTablet] = useState(false);
  const [activePartPath, setActivePartPath] = useState([0]);

  const getDividerThickness = (cfg = config) => {
    const isMulti = cfg.compoundType === 'fix_coulissant';
    if (!isMulti) return 0; // Don't subtract for Divided Chassis (Traverses)
    const divId = cfg.compoundConfig?.unionId;
    if (!divId || divId === 'AUTO') return 3;
    const trv = (database.traverses || []).find(t => t.id === divId || t.profileId === divId);
    if (trv?.thickness) return trv.thickness;
    const prof = (database.profiles || []).find(p => p.id === (trv?.profileId || divId));
    return prof?.thickness || 3;
  };

  const syncCompoundParts = (prev, name, newVal) => {
    const next = { ...prev, [name]: newVal };
    if (!next.compoundConfig || !next.compoundConfig.parts) return next;
    const isH = next.compoundConfig.orientation === 'horizontal';
    const totalDim = isH ? next.L : next.H;
    const divThick = getDividerThickness(next);
    const parts = next.compoundConfig.parts;
    const divQty = parts.length - 1;
    const totalDivThick = divQty * divThick;

    const newList = parts.map(p => ({ ...p }));
    const fixeSum = newList.filter(p => p.type === 'fixe').reduce((s, p) => s + (isH ? (p.width || 0) : (p.height || 0)), 0);
    const autoOpenDim = Math.max(0, totalDim - fixeSum - totalDivThick);

    newList.forEach(p => {
      if (p.type === 'opening') {
        if (isH) p.width = autoOpenDim; else p.height = autoOpenDim;
      } else {
        if (isH) p.height = next.H; else p.width = next.L;
      }
    });
    next.compoundConfig = { ...next.compoundConfig, parts: newList };
    return next;
  };

  useEffect(() => {
    // Standard initialization: Force default if nothing selected
    if (database.compositions?.length > 0) {
      setConfig(prev => ({
        ...prev,
        compositionId: prev.compositionId || database.compositions[0].id,
        colorId: prev.colorId || database.colors?.[0]?.id || '',
        glassId: prev.glassId || database.glass?.[0]?.id || '',
        clientId: prev.clientId || database.clients?.[0]?.id || ''
      }));
    }
  }, []);

  useEffect(() => {
    const v = engine.validate(config);
    setValidation(v);
    if (v.valid) {
      try { setPriceData(engine.calculatePrice({ ...config, margin: globalMargin })); }
      catch(e) { setPriceData(null); }
    } else {
      setPriceData(null);
    }
  }, [config, globalMargin]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    const newVal = (name === 'L' || name === 'H') ? (parseInt(value) || 0) : value;
    setConfig(prev => {
      const next = { ...prev, [name]: newVal };
      if (name === 'compositionId') {
         const comp = (database.compositions || []).find(c => c.id === value);
         if (comp?.defaultOpeningDirection) {
            next.openingDirection = comp.defaultOpeningDirection;
         }
         if (comp?.isPrecadre || (comp?.name || '').toLowerCase().includes('precadre')) {
            next.glassId = '';
         }
      }
      if ((name === 'L' || name === 'H') && prev.useCustomLayout && prev.customLayout) {
        next.customLayout = rescaleTree(prev.customLayout, name === 'L' ? newVal : prev.L, name === 'H' ? newVal : prev.H);
      }
      if ((name === 'L' || name === 'H') && prev.compoundType && prev.compoundType !== 'none') {
        return syncCompoundParts(prev, name, newVal);
      }
      return next;
    });
  };

  const subtotals = useMemo(() => {
    const bom = priceData?.bom;
    if (!bom) return { profiles: 0, accessories: 0, glass: 0, shutters: 0 };
    return {
      profiles: bom.profiles?.reduce((sum, p) => sum + (p.cost || 0), 0) || 0,
      accessories: (bom.accessories?.reduce((sum, a) => sum + (a.cost || 0), 0) || 0) + (bom.gasket?.cost || 0) || 0,
      glass: bom.glass?.cost || 0,
      shutters: bom.shutters?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0
    };
  }, [priceData]);

  const currentCompId = (config.compoundType && config.compoundType !== 'none' && config.compoundConfig?.parts?.length > 0)
    ? (config.compoundConfig.parts.find(p => p.type === 'opening' && p.compositionId) || config.compoundConfig.parts[0])?.compositionId
    : config.compositionId;
  const currentComp = (database.compositions || []).find(c => c.id === currentCompId);
  const activeCat = currentComp?.categoryId || database.categories?.[0]?.id || '';
  const activeOpen = currentComp?.openingType || 'Fixe';
  const compsInCat = (database.compositions || []).filter(c => c.categoryId === activeCat);
  const availableOpenings = [...new Set(compsInCat.map(c => c.openingType))];

  const hasCouvreJoint = currentComp?.elements?.some(e => {
    let itemName = '';
    if (e.type === 'profile') { const p = (database.profiles || []).find(x => x.id === e.id); if (p) itemName = p.name || ''; }
    else if (e.type === 'accessory') { const a = (database.accessories || []).find(x => x.id === e.id); if (a) itemName = a.name || ''; }
    return /couvres?[- ]?joints?|cj[vh]?/i.test(((e.label || '') + ' ' + itemName).toLowerCase());
  });

  const availableOptions = (database.options || []).filter(o => {
    if (!(o.rangeIds || []).includes(currentComp?.rangeId)) return false;
    const acc = database.accessories?.find(a => a.id === o.addAccessoryId);
    if (acc) {
      if (acc.side && acc.side !== 'both') {
        const dir = (config.openingDirection || '').toLowerCase();
        if (acc.side === 'gauche' && !dir.includes('gauch')) return false;
        if (acc.side === 'droit' && !dir.includes('droit')) return false;
      }
      // New: Compatibility formula check for accessories
      if (acc.compatibilityFormula && acc.compatibilityFormula.trim() !== '') {
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('L', 'H', `return (${acc.compatibilityFormula});`);
          if (!fn(config.L || 0, config.H || 0)) return false;
        } catch (e) {
          console.warn(`[Accessory Compatibility] Formula error for "${acc.name}":`, e.message);
        }
      }
    }
    return true;
  }) || [];
  const isPorte = activeCat === 'porte' || activeCat === 'CAT-P' || currentComp?.name?.toLowerCase().includes('porte');

  return (
    <div className="animate-fade-in">
      {/* Top Bar - Sticky */}
      <div className="flex-mobile-stack shadow-md" style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 100, 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        marginBottom: '2rem', 
        padding: '1rem 1.5rem', 
        background: 'white', 
        borderBottom: '1px solid #e2e8f0',
        borderRadius: '0.5rem'
      }}>
        <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Désignation du produit (ex: Fenêtre salon)"
            style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>Qté:</label>
          <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
            style={{ width: '65px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', textAlign: 'center', fontWeight: 700 }} />
        </div>
        <button onClick={onSave} disabled={!priceData} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: priceData ? '#10b981' : '#94a3b8', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: priceData ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
          <Save size={16} /> Enregistrer
        </button>
      </div>

      <div className="configurator-grid">
        {/* Left: Config */}
        <div className="glass shadow-lg" style={{ padding: '1.5rem', minWidth: '0px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calculator size={20} color="#2563eb" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Détails de l'ouvrage</h2>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               Client Assigné
               <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>Obligatoire</span>
            </label>
            <SearchableDropdown 
              value={config.clientId}
              onChange={val => setConfig(prev => ({ ...prev, clientId: val }))}
              options={(database.clients || []).map(c => ({ value: c.id, label: `${c.nom} (${c.id})` }))}
              placeholder="Sélectionner un client..."
            />
          </div>

          {/* Dimensions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <div className="form-group">
                <label className="label">{config.isOnlyShutter ? 'Largeur Volet (LV) en mm' : 'Largeur (L) en mm'}</label>
                <input type="number" name="L" value={config.L} onChange={handleChange} className="input" />
              </div>
              <div className="form-group">
                <label className="label">{config.isOnlyShutter ? 'Hauteur Totale (HT) en mm' : 'Hauteur (H) en mm'}</label>
                <input type="number" name="H" value={config.H} onChange={handleChange} className="input" />
              </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="label">Type de Configuration</label>
              <div style={{ display: 'flex', gap: '0.3rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '0.5rem' }}>
                <button onClick={() => setConfig(prev => ({ ...prev, useCustomLayout: false, compoundType: 'none', compositionId: prev.compositionId || database.compositions?.[0]?.id || '' }))}
                  style={{ flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: 'none', background: (!config.useCustomLayout && config.compoundType === 'none') ? 'white' : 'transparent', fontWeight: (!config.useCustomLayout && config.compoundType === 'none') ? 700 : 400, color: (!config.useCustomLayout && config.compoundType === 'none') ? '#1d4ed8' : '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>
                  Standard
                </button>
                <button onClick={() => setConfig(prev => ({ ...prev, useCustomLayout: false, compoundType: 'fix_coulissant', compositionId: '' }))}
                  style={{ flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: 'none', background: (config.compoundType !== 'none' && config.compoundType !== 'structure') ? 'white' : 'transparent', fontWeight: (config.compoundType !== 'none' && config.compoundType !== 'structure') ? 700 : 400, color: (config.compoundType !== 'none' && config.compoundType !== 'structure') ? '#0891b2' : '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>
                  🧩 Assemblé
                </button>
                <button onClick={() => setConfig(prev => {
                  const base = { ...prev, useCustomLayout: false, compoundType: 'structure', compositionId: '' };
                  if (!base.compoundConfig || !base.compoundConfig.parts || base.compoundConfig.parts.length === 0) {
                    base.compoundConfig = {
                      parts: [
                        { id: 'part1', type: 'opening', compositionId: '', glassId: '', width: 800, height: 1500, traverseId: 'AUTO', traverseThickness: 25 },
                        { id: 'part2', type: 'fixe', compositionId: '', glassId: '', width: 400, height: 1500, traverseId: 'AUTO', traverseThickness: 25 }
                      ],
                      orientation: 'horizontal',
                      unionId: 'AUTO',
                      unionThickness: 25,
                      traverseId: 'AUTO',
                      traverseThickness: 25,
                      shutterMode: 'total'
                    };
                  }
                  return base;
                })}
                  style={{ flex: 1, padding: '0.45rem', borderRadius: '0.4rem', border: 'none', background: (config.compoundType === 'structure') ? 'white' : 'transparent', fontWeight: (config.compoundType === 'structure') ? 700 : 400, color: (config.compoundType === 'structure') ? '#7c3aed' : '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>
                  🏗️ Structure
                </button>
              </div>
            </div>
          </div>

          {!config.isOnlyShutter && config.useCustomLayout && config.compoundType === 'none' && (
            <LayoutComposer layout={config.customLayout || defaultLayout()} onChange={newLayout => setConfig(prev => ({ ...prev, customLayout: newLayout }))} database={database} globalConfig={config} />
          )}

          {!config.isOnlyShutter && config.compoundType !== 'none' && config.compoundType !== 'structure' && (
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '15px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', animation: 'slideUp 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                   <div style={{ background: '#3b82f6', color: 'white', width: '36px', height: '36px', borderRadius: '10px', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.2rem' }}>🧩</div>
                   <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Composition par Assemblage</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Configurez vos châssis complexes bloc par bloc.</p>
                   </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                   <div className="form-group">
                      <label className="label">Modèle Structurel</label>
                      <select className="input" value={config.compoundType} onChange={e => {
                         const newType = e.target.value;
                         if (config.compoundType && config.compoundType !== newType) {
                            alert("Veuillez retaper la valeur de la partie fixe");
                         }
                         setConfig(prev => ({ ...prev, compoundType: newType }));
                      }}>
                        <option value="fix_coulissant">Multi-Châssis (Unions)</option>
                        <option value="fix_ouvrant">Châssis Divisé (Traverses)</option>
                      </select>
                   </div>
                   <div className="form-group">
                      <label className="label">Orientation</label>
                      <select className="input" value={config.compoundConfig?.orientation} onChange={e => {
                         const newOri = e.target.value;
                         const isH = newOri === 'horizontal';
                         const totalDim = isH ? config.L : config.H;
                         const otherDim = isH ? config.H : config.L;
                         const newList = config.compoundConfig.parts.map(p => ({
                           ...p,
                           ...(isH ? { height: otherDim } : { width: otherDim })
                         }));
                         const fixeSum = newList.filter(p => p.type === 'fixe').reduce((s, p) => s + (isH ? (p.width || 0) : (p.height || 0)), 0);
                         const divThick = getDividerThickness();
                         const divQty = config.compoundConfig.parts.length - 1;
                         const totalDivThick = divQty * divThick;
                         const autoOpenDim = Math.max(0, totalDim - fixeSum - totalDivThick);
                         const finalList = newList.map(p => p.type === 'opening' 
                            ? { ...p, ...(isH ? { width: autoOpenDim } : { height: autoOpenDim }) }
                            : p
                         );
                         setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, orientation: newOri, parts: finalList } }));
                       }}>
                        <option value="horizontal">Horizontal</option>
                        <option value="vertical">Vertical</option>
                      </select>
                   </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', padding: '1rem', background: 'white', borderRadius: '10px', border: '1px dashed #cbd5e1', justifyContent: 'center', overflowX: 'auto', minHeight: '140px' }}>
                   {(() => {
                      const renderNodes = (list, dir) => {
                         const isH = dir !== 'vertical';
                         return (
                            <div style={{ display: 'flex', flexDirection: isH ? 'row' : 'column', gap: '4px', flex: 1, alignItems: 'stretch' }}>
                               {list.map((part, idx) => (
                                  <React.Fragment key={part.id}>
                                     <div style={{ 
                                        flex: 1,
                                        minWidth: isH ? '60px' : 'auto',
                                        minHeight: isH ? 'auto' : '40px',
                                        background: part.type === 'opening' ? '#eff6ff' : (part.type === 'group' ? 'transparent' : '#f8fafc'),
                                        border: part.type === 'group' ? '1px dashed #e2e8f0' : '2px solid',
                                        borderColor: part.type === 'opening' ? '#3b82f6' : (part.type === 'group' ? 'transparent' : '#94a3b8'),
                                        borderRadius: '6px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '4px'
                                     }}>
                                        {part.type === 'group' && part.subParts ? (
                                           renderNodes(part.subParts, isH ? 'vertical' : 'horizontal')
                                        ) : (
                                           <>
                                              <span style={{ fontSize: '0.55rem', fontWeight: 800, color: part.type === 'opening' ? '#2563eb' : '#64748b' }}>{part.type.toUpperCase()}</span>
                                              <span style={{ fontSize: '0.5rem', color: '#94a3b8' }}>{isH ? part.width : part.height}mm</span>
                                           </>
                                        )}
                                     </div>
                                     {idx < list.length - 1 && (
                                        <div style={{ width: isH ? '2px' : '100%', height: isH ? '100%' : '2px', background: '#cbd5e1' }}></div>
                                     )}
                                  </React.Fragment>
                               ))}
                            </div>
                         );
                      };
                      return renderNodes(config.compoundConfig.parts, config.compoundConfig.orientation);
                   })()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                   <label className="label">Séquence des blocs (G à D / Haut en Bas)</label>
                   {config.compoundConfig?.parts?.map((part, idx) => (
                     <div key={part.id} style={{ marginBottom: '1rem' }}>
                        <div className="glass shadow-sm" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 80px 40px', gap: '1rem', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                           <div style={{ fontWeight: 800, color: '#94a3b8' }}>#{idx+1}</div>
                           
                           <div>
                              <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Type & Dimension</label>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                 <select className="input" style={{ width: '100px', fontSize: '0.8rem', padding: '0.3rem' }} value={part.type} onChange={e => {
                                    const newList = [...config.compoundConfig.parts];
                                    newList[idx].type = e.target.value;
                                    setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                 }}>
                                    <option value="opening">Ouverture</option>
                                    <option value="fixe">Fixe</option>
                                    <option value="group">Groupe</option>
                                 </select>
                                  {part.type === 'opening' ? (
                                    <input 
                                      type="number" 
                                      className="input" 
                                      style={{ width: '70px', fontSize: '0.8rem', padding: '0.3rem', background: '#f0fdf4', color: '#15803d', fontWeight: 700, border: '1px solid #86efac' }} 
                                      value={config.compoundConfig.orientation === 'horizontal' ? part.width : part.height} 
                                      readOnly
                                      title="Calculé automatiquement : Total - somme des Fixes"
                                    />
                                  ) : (
                                    <input type="number" className="input" style={{ width: '70px', fontSize: '0.8rem', padding: '0.3rem' }} value={config.compoundConfig.orientation === 'horizontal' ? part.width : part.height} onChange={e => {
                                       const val = parseInt(e.target.value) || 0;
                                       const isH = config.compoundConfig.orientation === 'horizontal';
                                       const totalDim = isH ? config.L : config.H;
                                       const newList = config.compoundConfig.parts.map((p, i) => {
                                          if (i === idx) return { ...p, ...(isH ? { width: val } : { height: val }) };
                                          return p;
                                       });
                                       const fixeSum = newList.filter(p => p.type === 'fixe').reduce((s, p) => s + (isH ? (p.width || 0) : (p.height || 0)), 0);
                                        const divThick = getDividerThickness();
                                        const divQty = config.compoundConfig.parts.length - 1;
                                        const totalDivThick = divQty * divThick;
                                        const autoOpenDim = Math.max(0, totalDim - fixeSum - totalDivThick);
                                       const finalList = newList.map(p => p.type === 'opening' 
                                          ? { ...p, ...(isH ? { width: autoOpenDim } : { height: autoOpenDim }) }
                                          : p
                                       );
                                       setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: finalList } }));
                                    }} />
                                  )}
                              </div>
                           </div>

                           <div>
                              <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Configuration</label>
                              {(part.type === 'opening' || part.type === 'fixe') ? (
                                 <select className="input" style={{ fontSize: '0.8rem', padding: '0.3rem' }} value={part.compositionId || ''} onChange={e => {
                                    const newList = [...config.compoundConfig.parts];
                                    newList[idx].compositionId = e.target.value;
                                    setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                 }}>
                                    <option value="">-- Composition --</option>
                                    {database.compositions.filter(c => {
                                       if (part.type === 'opening') {
                                          return (config.compoundType === 'fix_coulissant' && c.openingType === 'Coulissant') ||
                                                 (config.compoundType === 'fix_ouvrant' && c.openingType !== 'Coulissant' && c.openingType !== 'Fixe');
                                       } else {
                                          return c.openingType === 'Fixe' || c.openingType === 'Fixe Vitré';
                                       }
                                    }).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                 </select>
                              ) : part.type === 'group' ? (
                                 <div style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>Divisé {config.compoundConfig.orientation === 'horizontal' ? 'H' : 'V'}</div>
                              ) : (
                                 <div style={{ fontSize: '0.8rem', color: '#0ea5e9', fontWeight: 600, padding: '0.3rem' }}>Vitrage direct</div>
                              )}
                           </div>

                           <div>
                              <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Vitrage</label>
                              <select className="input" style={{ fontSize: '0.8rem', padding: '0.3rem' }} disabled={part.type === 'group'} value={part.glassId || ''} onChange={e => {
                                 const newList = [...config.compoundConfig.parts];
                                 newList[idx].glassId = e.target.value;
                                 setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                              }}>
                                 <option value="">(Vitrage global)</option>
                                 {database.glass?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                              </select>
                           </div>

                           <div style={{ display: 'flex', gap: '0.2rem' }}>
                              {part.type !== 'group' ? (
                                 <button className="btn" style={{ fontSize: '0.65rem', padding: '0.3rem', background: '#f5f3ff', color: '#7c3aed' }} onClick={() => {
                                    const newList = [...config.compoundConfig.parts];
                                    newList[idx].type = 'group';
                                    newList[idx].subParts = [
                                       { id: `sub-${Date.now()}-1`, type: part.type, compositionId: part.compositionId, glassId: part.glassId, width: part.width, height: part.height },
                                       { id: `sub-${Date.now()}-2`, type: 'fixe', glassId: '', width: 500, height: 500 }
                                    ];
                                    setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                 }}>Diviser</button>
                              ) : (
                                 <button className="btn" style={{ fontSize: '0.65rem', padding: '0.3rem', background: '#fef2f2', color: '#ef4444' }} onClick={() => {
                                    const newList = [...config.compoundConfig.parts];
                                    newList[idx].type = 'opening';
                                    newList[idx].subParts = null;
                                    setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                 }}>Annuler</button>
                              )}
                           </div>

                           <button className="btn" style={{ color: '#ef4444', padding: '0.3rem', border: 'none' }} onClick={() => {
                              if (config.compoundConfig.parts.length <= 1) return;
                              const newList = config.compoundConfig.parts.filter((_, i) => i !== idx);
                              setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                           }}>
                              <Trash2 size={16} />
                           </button>
                        </div>
                        
                        {/* Sub-parts rendering */}
                        {part.type === 'group' && part.subParts && (
                           <div style={{ marginLeft: '3rem', marginTop: '0.5rem', padding: '0.8rem', borderLeft: '3px solid #7c3aed', background: '#f5f3ff', borderRadius: '0 8px 8px 0' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', marginBottom: '0.5rem' }}>DIVISION {config.compoundConfig.orientation === 'horizontal' ? 'VERTICALE' : 'HORIZONTALE'}</div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', background: 'white', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                                 <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>Traverse de Division :</label>
                                 <select 
                                   className="input" 
                                   style={{ width: '220px', fontSize: '0.75rem', padding: '0.2rem', height: 'auto' }} 
                                   value={part.traverseId || ''} 
                                   onChange={e => {
                                     const newList = [...config.compoundConfig.parts];
                                     newList[idx].traverseId = e.target.value;
                                     setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                   }}
                                 >
                                   <option value="">(Par défaut)</option>
                                   {(database.traverses || []).filter(t => {
                                      const normalize = (s) => (s || '').replace(/[-\s]+/g, '').toLowerCase();
                                      const currentNorm = normalize(currentComp?.rangeId || ((database.ranges || [])[0]?.id || ''));
                                      return (t.rangeIds || []).some(rid => normalize(rid) === currentNorm);
                                   }).map(t => { 
                                      const p = (database.profiles || []).find(px => px.id === t.profileId); 
                                      if (!p) return null; 
                                      return <option key={t.id} value={p.id}>{t.name}</option>; 
                                   }).filter(Boolean)}
                                   <option disabled>── PROFILÉS JONCTION ──</option>
                                   {(database.profiles || []).filter(p => p.category === 'divider').map(p => (
                                      <option key={p.id} value={p.id}>{p.name} ({p.thickness}mm)</option>
                                   ))}
                                 </select>
                              </div>

                              {part.subParts.map((sub, sidx) => (
                                 <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: '0.5rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                       <select className="input" style={{ fontSize: '0.75rem', padding: '0.2rem' }} value={sub.type} onChange={e => {
                                          const newList = [...config.compoundConfig.parts];
                                          newList[idx].subParts[sidx].type = e.target.value;
                                          setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                       }}>
                                          <option value="opening">Ouvrant</option>
                                          <option value="fixe">Fixe</option>
                                       </select>
                                       <input type="number" className="input" style={{ width: '60px', fontSize: '0.75rem', padding: '0.2rem' }} value={config.compoundConfig.orientation === 'horizontal' ? sub.height : sub.width} onChange={e => {
                                          const newList = [...config.compoundConfig.parts];
                                          const val = parseInt(e.target.value) || 0;
                                          if (config.compoundConfig.orientation === 'horizontal') newList[idx].subParts[sidx].height = val;
                                          else newList[idx].subParts[sidx].width = val;
                                          setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                       }} />
                                    </div>
                                    <select className="input" style={{ fontSize: '0.75rem', padding: '0.2rem' }} value={sub.compositionId || ''} onChange={e => {
                                       const newList = [...config.compoundConfig.parts];
                                       newList[idx].subParts[sidx].compositionId = e.target.value;
                                       setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                    }}>
                                       <option value="">-- Composition --</option>
                                       {database.compositions.filter(c => {
                                          if (sub.type === 'opening') {
                                             return (config.compoundType === 'fix_coulissant' && c.openingType === 'Coulissant') ||
                                                    (config.compoundType === 'fix_ouvrant' && c.openingType !== 'Coulissant' && c.openingType !== 'Fixe');
                                          } else {
                                             return c.openingType === 'Fixe' || c.openingType === 'Fixe Vitré';
                                          }
                                       }).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <select className="input" style={{ fontSize: '0.75rem', padding: '0.2rem' }} value={sub.glassId || ''} onChange={e => {
                                       const newList = [...config.compoundConfig.parts];
                                       newList[idx].subParts[sidx].glassId = e.target.value;
                                       setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                    }}>
                                       <option value="">(Vitrage global)</option>
                                       {database.glass?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                    <button className="btn" style={{ color: '#ef4444', padding: '0' }} onClick={() => {
                                       if (part.subParts.length <= 1) return;
                                       const newList = [...config.compoundConfig.parts];
                                       newList[idx].subParts = part.subParts.filter((_, i) => i !== sidx);
                                       setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                                    }}><Trash2 size={14} /></button>
                                 </div>
                              ))}
                              <button className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem' }} onClick={() => {
                                 const newList = [...config.compoundConfig.parts];
                                 newList[idx].subParts.push({ id: `sub-${Date.now()}`, type: 'fixe', glassId: '', width: 500, height: 500 });
                                 setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                              }}>+ Sous-partie</button>
                           </div>
                        )}
                     </div>
                   ))}
                   <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ flex: '1 1 140px', fontSize: '0.75rem', padding: '0.5rem', background: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => {
                         const newList = [
                            { id: `fix-${Date.now()}`, type: 'fixe', glassId: '', width: 500, height: 1500, subParts: null },
                            ...config.compoundConfig.parts
                         ];
                         setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, orientation: 'horizontal', parts: newList } }));
                      }}><Plus size={14} /> Fixe Gauche</button>
                      <button className="btn btn-secondary" style={{ flex: '1 1 140px', fontSize: '0.75rem', padding: '0.5rem', background: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => {
                         const newList = [
                            ...config.compoundConfig.parts,
                            { id: `fix-${Date.now()}`, type: 'fixe', glassId: '', width: 500, height: 1500, subParts: null }
                         ];
                         setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, orientation: 'horizontal', parts: newList } }));
                      }}><Plus size={14} /> Fixe Droite</button>
                      <button className="btn btn-secondary" style={{ flex: '1 1 140px', fontSize: '0.75rem', padding: '0.5rem', background: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => {
                         const newList = [
                            { id: `fix-${Date.now()}`, type: 'fixe', glassId: '', width: 1500, height: 500, subParts: null },
                            ...config.compoundConfig.parts
                         ];
                         setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, orientation: 'vertical', parts: newList } }));
                      }}><Plus size={14} /> Imposte (Haut)</button>
                      <button className="btn btn-secondary" style={{ flex: '1 1 140px', fontSize: '0.75rem', padding: '0.5rem', background: 'white', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => {
                         const newList = [
                            ...config.compoundConfig.parts,
                            { id: `fix-${Date.now()}`, type: 'fixe', glassId: '', width: 1500, height: 500, subParts: null }
                         ];
                         setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, orientation: 'vertical', parts: newList } }));
                      }}><Plus size={14} /> Allége (Bas)</button>
                   </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
                   <div className="form-group">
                      <label className="label">{config.compoundType === 'fix_coulissant' ? 'Profilé d\'UNION' : 'Profilé TRAVERSE (Division)'}</label>
                      <select className="input" value={config.compoundType === 'fix_coulissant' ? config.compoundConfig?.unionId : config.compoundConfig?.traverseId} onChange={e => {
                         const key = config.compoundType === 'fix_coulissant' ? 'unionId' : 'traverseId';
                         setConfig(prev => {
                            const next = { ...prev, compoundConfig: { ...prev.compoundConfig, [key]: e.target.value } };
                            return syncCompoundParts(next, 'L', next.L);
                         });
                      }}>
                           {(database.traverses || []).filter(t => {
                              const normalize = (s) => (s || '').replace(/[-\s]+/g, '').toLowerCase();
                              const currentNorm = normalize(currentComp?.rangeId || ((database.ranges || [])[0]?.id || ''));
                              return (t.rangeIds || []).some(rid => normalize(rid) === currentNorm);
                           }).map(t => { 
                              const p = (database.profiles || []).find(px => px.id === t.profileId); 
                              if (!p) return null; 
                              return <option key={t.id} value={p.id} style={{ fontWeight: 'bold' }}>{t.name} (Mapping Admin)</option>; 
                           }).filter(Boolean)}
                           <option disabled>── PROFILÉS JONCTION ──</option>
                           {(database.profiles || []).filter(p => p.category === 'divider').map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.thickness}mm)</option>
                           ))}
                      </select>
                   </div>
                   <div className="form-group">
                      <label className="label">Mode du Volet</label>
                      <select className="input" value={config.compoundConfig?.shutterMode} onChange={e => setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, shutterMode: e.target.value } }))}>
                         <option value="total">Volet sur TOUTE la largeur</option>
                         <option value="opening_only">Volet sur OUVERTURE uniquement</option>
                      </select>
                   </div>
                   <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingTop: '1.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#1e40af' }}>
                        <input 
                          type="checkbox" 
                          checked={config.shutterConfig?.isDoubleShutter || false} 
                          onChange={e => setConfig(prev => ({ 
                            ...prev, 
                            shutterConfig: { 
                              ...(prev.shutterConfig || {}), 
                              isDoubleShutter: e.target.checked 
                            } 
                          }))}
                          style={{ width: '1.1rem', height: '1.1rem' }}
                        />
                        Volet Double (Séparé)
                      </label>
                   </div>
                </div>
            </div>
          )}

          {!config.isOnlyShutter && config.compoundType === 'structure' && (() => {
             const getParentOrientation = (path) => {
                if (path.length === 1) {
                   return config.compoundConfig?.orientation || 'horizontal';
                }
                const parentPath = path.slice(0, -1);
                let current = config.compoundConfig?.parts;
                let parentGroup = null;
                for (let i = 0; i < parentPath.length; i++) {
                   parentGroup = current[parentPath[i]];
                   current = parentGroup.subParts;
                }
                return parentGroup?.orientation || 'horizontal';
             };

             let activePart = null;
             let pathValid = true;
             if (config.compoundConfig?.parts) {
                let current = config.compoundConfig.parts;
                for (let i = 0; i < activePartPath.length; i++) {
                   const idx = activePartPath[i];
                   if (current && current[idx]) {
                      activePart = current[idx];
                      current = current[idx].subParts;
                   } else {
                      pathValid = false;
                      break;
                   }
                }
             }
             if (!pathValid || !activePart) {
                activePart = config.compoundConfig?.parts?.[0] || null;
                if (activePart && activePartPath.length !== 1) {
                   setTimeout(() => setActivePartPath([0]), 0);
                }
             }

             const updatePartInPath = (path, key, value) => {
                setConfig(prev => {
                   const parts = JSON.parse(JSON.stringify(prev.compoundConfig?.parts || []));
                   let current = parts;
                   for (let i = 0; i < path.length - 1; i++) {
                      if (!current[path[i]].subParts) current[path[i]].subParts = [];
                      current = current[path[i]].subParts;
                   }
                   const target = current[path[path.length - 1]];
                   target[key] = value;
                   if (key === 'type') {
                      if (value === 'extra') {
                         target.extraElementId = database.extraElements?.[0]?.id || database.profiles?.[0]?.id || '';
                         target.compositionId = database.extraElements?.[0]?.id || database.profiles?.[0]?.id || '';
                         delete target.subParts;
                      } else if (value === 'group') {
                         target.subParts = [
                            { id: `sub-${Date.now()}-1`, type: 'opening', compositionId: '', glassId: '', width: 400, height: 1500, traverseThickness: 25 },
                            { id: `sub-${Date.now()}-2`, type: 'fixe', compositionId: '', glassId: '', width: 400, height: 1500, traverseThickness: 25 }
                         ];
                         target.orientation = (prev.compoundConfig?.orientation === 'horizontal') ? 'vertical' : 'horizontal';
                      } else {
                         delete target.subParts;
                      }
                   }
                   return { ...prev, compoundConfig: { ...prev.compoundConfig, parts } };
                });
             };

             const deletePartInPath = (path) => {
                setConfig(prev => {
                   const parts = JSON.parse(JSON.stringify(prev.compoundConfig?.parts || []));
                   if (path.length === 1) {
                      if (parts.length <= 1) return prev;
                      parts.splice(path[0], 1);
                   } else {
                      let current = parts;
                      for (let i = 0; i < path.length - 2; i++) {
                         current = current[path[i]].subParts;
                      }
                      const parent = current[path[path.length - 2]];
                      if (parent.subParts.length <= 1) return prev;
                      parent.subParts.splice(path[path.length - 1], 1);
                   }
                   return { ...prev, compoundConfig: { ...prev.compoundConfig, parts } };
                });
             };

             const renderPartCard = (part, path) => {
                const isGroup = part.type === 'group';
                const isExtra = part.type === 'extra';
                const isOpening = part.type === 'opening';
                const isFixe = part.type === 'fixe';
                const isActive = JSON.stringify(path) === JSON.stringify(activePartPath);
                
                if (isGroup) {
                   return (
                      <div onClick={(e) => { e.stopPropagation(); setActivePartPath(path); }} style={{
                         flex: '1 1 0%',
                         minWidth: '150px',
                         maxWidth: '220px',
                         padding: '0.5rem',
                         border: isActive ? '2.5px solid #7c3aed' : '1.5px solid #ddd6fe',
                         background: isActive ? '#fbfbfe' : '#f5f3ff',
                         borderRadius: '8px',
                         cursor: 'pointer',
                         boxSizing: 'border-box',
                         display: 'flex',
                         flexDirection: 'column',
                         gap: '0.3rem'
                      }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#7c3aed' }}>Groupe #{path[path.length-1]+1} ({part.orientation === 'vertical' ? 'V' : 'H'})</span>
                            <button onClick={(e) => { e.stopPropagation(); deletePartInPath(path); if (isActive) setActivePartPath([0]); }} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
                               <Trash2 size={12} />
                            </button>
                         </div>
                         <div style={{ display: 'flex', flexDirection: part.orientation === 'vertical' ? 'column' : 'row', gap: '0.2rem', background: 'rgba(255,255,255,0.6)', padding: '0.25rem', borderRadius: '4px' }}>
                            {(part.subParts || []).map((sub, sidx) => (
                               <div key={sub.id} onClick={(e) => { e.stopPropagation(); setActivePartPath([...path, sidx]); }} style={{
                                  flex: 1,
                                  padding: '0.2rem',
                                  background: JSON.stringify([...path, sidx]) === JSON.stringify(activePartPath) ? '#ddd6fe' : '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '3px',
                                  fontSize: '0.6rem',
                                  textAlign: 'center',
                                  fontWeight: 600
                               }}>
                                  {sub.type === 'opening' ? 'Ouv' : (sub.type === 'extra' ? 'Pot' : 'Fix')} ({sub.width}x{sub.height})
                               </div>
                            ))}
                         </div>
                      </div>
                   );
                }

                return (
                   <div onClick={(e) => { e.stopPropagation(); setActivePartPath(path); }} style={{
                      flex: '1 1 0%',
                      minWidth: '90px',
                      maxWidth: '130px',
                      padding: '0.5rem',
                      border: isActive ? '2.5px solid #7c3aed' : '1.5px solid #cbd5e1',
                      background: isActive ? '#f5f3ff' : 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '100px',
                      boxSizing: 'border-box'
                   }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>#{path[path.length-1]+1}</span>
                         <button onClick={(e) => { e.stopPropagation(); deletePartInPath(path); if (isActive) setActivePartPath([0]); }} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
                            <Trash2 size={12} />
                         </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, margin: '0.2rem 0' }}>
                         {isOpening ? 'Ouvrant' : (isExtra ? 'Poteau' : 'Fixe')}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                         {isOpening && path.length === 1 && config.compoundConfig?.orientation === 'horizontal' ? config.L : (part.width || 400)} x {part.height || 1500}
                      </div>
                   </div>
                );
             };

             return (
                <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '15px', border: '1px solid #7c3aed', marginBottom: '1.5rem', animation: 'slideUp 0.3s ease' }}>
                   {/* Header */}
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: '#7c3aed', color: 'white', width: '36px', height: '36px', borderRadius: '10px', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '1.2rem' }}>🏗️</div>
                      <div style={{ flex: 1 }}>
                         <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Visualiseur de Structure Complexe (Grille 2D)</h3>
                         <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Sélectionnez un bloc pour configurer ses options détaillées ci-dessous.</p>
                      </div>
                   </div>

                   {/* Main controls */}
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div className="form-group">
                         <label className="label">Orientation Globale</label>
                         <select className="input" value={config.compoundConfig?.orientation || 'horizontal'} onChange={e => {
                            const newOri = e.target.value;
                            const isH = newOri === 'horizontal';
                            const totalDim = isH ? config.L : config.H;
                            const otherDim = isH ? config.H : config.L;
                            const newList = (config.compoundConfig?.parts || []).map(p => ({
                              ...p,
                              ...(isH ? { height: otherDim } : { width: otherDim })
                            }));
                            const fixeSum = newList.filter(p => p.type === 'fixe').reduce((s, p) => s + (isH ? (p.width || 0) : (p.height || 0)), 0);
                            const divThick = config.compoundConfig?.unionThickness ?? 25;
                            const divQty = newList.length - 1;
                            const totalDivThick = divQty * divThick;
                            const autoOpenDim = Math.max(0, totalDim - fixeSum - totalDivThick);
                            const finalList = newList.map(p => p.type === 'opening' 
                               ? { ...p, ...(isH ? { width: autoOpenDim } : { height: autoOpenDim }) }
                               : p
                            );
                            setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, orientation: newOri, parts: finalList } }));
                         }}>
                           <option value="horizontal">Horizontal (Côte à côte)</option>
                           <option value="vertical">Vertical (Superposé)</option>
                         </select>
                      </div>
                      <div className="form-group">
                         <label className="label">Gamme Principale</label>
                         <select className="input" value={config.rangeId || ''} onChange={e => {
                            const rangeId = e.target.value;
                            setConfig(prev => ({ ...prev, rangeId }));
                         }}>
                            {database.ranges?.map(r => <option key={r.id} value={r.id}>{r.name} ({r.id})</option>)}
                         </select>
                      </div>
                      <div className="form-group">
                         <label className="label">Liaison Globale (Union)</label>
                         <select className="input" value={config.compoundConfig?.unionId || ''} onChange={e => {
                            const val = e.target.value;
                            setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, unionId: val, traverseId: val } }));
                         }}>
                            <option value="AUTO">AUTO (Par défaut)</option>
                            {(database.traverses || []).map(t => <option key={t.id} value={t.profileId}>{t.name}</option>)}
                         </select>
                      </div>
                      <div className="form-group">
                         <label className="label">Épaisseur Liaison (mm)</label>
                         <input type="number" className="input" value={config.compoundConfig?.unionThickness ?? 25} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, unionThickness: val, traverseThickness: val } }));
                         }} />
                      </div>
                   </div>

                   {/* Visual Cards Row */}
                   <div style={{ display: 'flex', flexDirection: config.compoundConfig?.orientation === 'vertical' ? 'column' : 'row', gap: '1rem', alignItems: 'center', background: 'white', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px dashed #cbd5e1', overflow: 'hidden', maxWidth: '100%', width: '100%', boxSizing: 'border-box', marginBottom: '1rem' }}>
                      {(config.compoundConfig?.parts || []).map((part, idx) => (
                         <React.Fragment key={part.id}>
                            {renderPartCard(part, [idx])}

                            {/* Traverse separator between cards */}
                            {idx < config.compoundConfig.parts.length - 1 && (
                               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', padding: '0.25rem', background: '#f1f5f9', borderRadius: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                                  <select className="input" style={{ width: '55px', padding: '0.05rem', fontSize: '0.65rem', height: 'auto', border: '1px solid #cbd5e1' }} value={part.traverseId || 'AUTO'} onChange={e => {
                                     const val = e.target.value;
                                     let th = part.traverseThickness ?? 25;
                                     if (val !== 'AUTO') {
                                        const trv = database.traverses?.find(t => t.id === val || t.profileId === val);
                                        if (trv?.thickness) th = trv.thickness;
                                        else {
                                           const prof = database.profiles?.find(p => p.id === val);
                                           if (prof?.thickness) th = prof.thickness;
                                        }
                                     }
                                     setConfig(prev => {
                                        const parts = [...prev.compoundConfig.parts];
                                        parts[idx].traverseId = val;
                                        parts[idx].traverseThickness = th;
                                        return { ...prev, compoundConfig: { ...prev.compoundConfig, parts } };
                                     });
                                  }}>
                                     <option value="AUTO">AUTO</option>
                                     {(database.traverses || []).map(t => <option key={t.id} value={t.profileId || t.id}>{t.name}</option>)}
                                  </select>
                                  <input type="number" className="input" style={{ width: '38px', padding: '0.1rem', fontSize: '0.7rem', textAlign: 'center' }} value={part.traverseThickness ?? 25} onChange={e => {
                                     const val = parseFloat(e.target.value) || 0;
                                     setConfig(prev => {
                                        const parts = [...prev.compoundConfig.parts];
                                        parts[idx].traverseThickness = val;
                                        return { ...prev, compoundConfig: { ...prev.compoundConfig, parts } };
                                     });
                                  }} title="Épaisseur de la traverse (mm)" />
                               </div>
                            )}
                         </React.Fragment>
                      ))}

                      {/* Add card button */}
                      <button className="shadow-sm flex-center" onClick={() => {
                         const newList = [...(config.compoundConfig?.parts || [])];
                         const newId = `part-${Date.now()}`;
                         newList.push({
                            id: newId,
                            type: 'fixe',
                            compositionId: '',
                            glassId: '',
                            width: 400,
                            height: 1500,
                            traverseId: 'AUTO',
                            traverseThickness: 25
                         });
                         setConfig(prev => ({ ...prev, compoundConfig: { ...prev.compoundConfig, parts: newList } }));
                      }} style={{ minWidth: '100px', background: 'rgba(124, 58, 237, 0.05)', color: '#7c3aed', border: '2px dashed #7c3aed', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.8rem', height: '100px', boxSizing: 'border-box' }}>
                         <Plus size={20} />
                         <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Ajouter</span>
                      </button>
                   </div>

                   {/* Configuration Edit Panel */}
                   {activePart && (
                      <div style={{ marginTop: '1.5rem', background: '#fbfbfe', padding: '1.2rem', borderRadius: '10px', border: '1.5px solid #7c3aed', animation: 'fadeIn 0.25s ease' }}>
                         <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#4c1d95', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>⚙️ Configuration du bloc sélectionné</span>
                            <span style={{ background: '#ddd6fe', color: '#5b21b6', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                               Chemin: {activePartPath.map(i => i + 1).join(' ➔ ')}
                            </span>
                         </h4>
                         
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                               <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Type de bloc</label>
                               <div style={{ display: 'flex', gap: '0.3rem' }}>
                                  {['opening', 'fixe', 'extra', 'group'].map(t => (
                                     <button key={t} onClick={() => updatePartInPath(activePartPath, 'type', t)} 
                                        className="btn"
                                        style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid', borderColor: activePart.type === t ? '#7c3aed' : '#cbd5e1', background: activePart.type === t ? '#f5f3ff' : 'white', color: activePart.type === t ? '#7c3aed' : '#64748b', cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}>
                                        {t === 'opening' ? 'Ouvrant' : (t === 'extra' ? 'Poteau' : (t === 'group' ? 'Groupe' : 'Fixe'))}
                                     </button>
                                  ))}
                                </div>
                            </div>

                            {activePart.type === 'group' ? (
                               <div style={{ display: 'flex', gap: '1rem' }}>
                                  <div className="form-group" style={{ flex: 1 }}>
                                     <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Orientation division</label>
                                     <select className="input" value={activePart.orientation || 'vertical'} onChange={e => updatePartInPath(activePartPath, 'orientation', e.target.value)}>
                                        <option value="horizontal">Horizontal (Côte à côte)</option>
                                        <option value="vertical">Vertical (Superposé)</option>
                                     </select>
                                  </div>
                                  <div className="form-group" style={{ flex: 1 }}>
                                     <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Épaisseur traverse (mm)</label>
                                     <input type="number" className="input" value={activePart.traverseThickness ?? 25} onChange={e => updatePartInPath(activePartPath, 'traverseThickness', parseFloat(e.target.value) || 0)} />
                                  </div>
                               </div>
                            ) : (
                               <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                                  {(() => {
                                     const parentOri = getParentOrientation(activePartPath);
                                     if (activePart.type === 'extra') {
                                        if (parentOri === 'horizontal') {
                                           return (
                                              <>
                                                 <div className="form-group" style={{ flex: 1 }}>
                                                    <label className="label" style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>Épaisseur Poteau (Largeur en mm)</label>
                                                    <input type="number" className="input" value={activePart.width || 60} onChange={e => updatePartInPath(activePartPath, 'width', parseInt(e.target.value) || 0)} />
                                                 </div>
                                                 <div className="form-group" style={{ flex: 1 }}>
                                                    <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Hauteur Poteau (mm)</label>
                                                    <input type="number" className="input" value={activePartPath.length === 1 ? config.H : (activePart.height || 1500)} readOnly style={{ background: '#f8fafc' }} />
                                                 </div>
                                              </>
                                           );
                                        } else {
                                           return (
                                              <>
                                                 <div className="form-group" style={{ flex: 1 }}>
                                                    <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Largeur Poteau (mm)</label>
                                                    <input type="number" className="input" value={activePartPath.length === 1 ? config.L : (activePart.width || 400)} readOnly style={{ background: '#f8fafc' }} />
                                                 </div>
                                                 <div className="form-group" style={{ flex: 1 }}>
                                                    <label className="label" style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>Épaisseur Poteau (Hauteur en mm)</label>
                                                    <input type="number" className="input" value={activePart.height || 60} onChange={e => updatePartInPath(activePartPath, 'height', parseInt(e.target.value) || 0)} />
                                                 </div>
                                              </>
                                           );
                                        }
                                     }

                                     return (
                                        <>
                                           <div className="form-group" style={{ flex: 1 }}>
                                              <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Largeur (mm)</label>
                                              {activePart.type === 'opening' && activePartPath.length === 1 && config.compoundConfig?.orientation === 'horizontal' ? (
                                                 <input type="number" className="input" value={config.L} readOnly style={{ background: '#f0fdf4' }} />
                                              ) : (
                                                 <input type="number" className="input" value={activePart.width || 400} onChange={e => updatePartInPath(activePartPath, 'width', parseInt(e.target.value) || 0)} />
                                              )}
                                           </div>
                                           <div className="form-group" style={{ flex: 1 }}>
                                              <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Hauteur (mm)</label>
                                              {activePart.type === 'opening' && activePartPath.length === 1 && config.compoundConfig?.orientation === 'vertical' ? (
                                                 <input type="number" className="input" value={config.H} readOnly style={{ background: '#f0fdf4' }} />
                                              ) : (
                                                 <input type="number" className="input" value={activePart.height || 1500} onChange={e => updatePartInPath(activePartPath, 'height', parseInt(e.target.value) || 0)} />
                                              )}
                                           </div>
                                        </>
                                     );
                                  })()}
                               </div>
                            )}
                         </div>

                         {activePart.type !== 'group' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                               <div className="form-group">
                                  <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Modèle de menuiserie</label>
                                  {activePart.type === 'extra' ? (
                                     <select className="input" value={activePart.extraElementId || activePart.compositionId || ''} onChange={e => {
                                        const val = e.target.value;
                                        const extra = database.extraElements?.find(el => el.id === val);
                                        const prof = database.profiles?.find(p => p.id === val);
                                        const thick = extra?.thickness || prof?.thickness || 60;
                                        
                                        setConfig(prev => {
                                           const parts = JSON.parse(JSON.stringify(prev.compoundConfig?.parts || []));
                                           let current = parts;
                                           for (let i = 0; i < activePartPath.length - 1; i++) {
                                              current = current[activePartPath[i]].subParts;
                                           }
                                           const target = current[activePartPath[activePartPath.length - 1]];
                                           target.extraElementId = val;
                                           target.compositionId = val;
                                           const parentOri = getParentOrientation(activePartPath);
                                           if (parentOri === 'horizontal') {
                                              target.width = thick;
                                           } else {
                                              target.height = thick;
                                           }
                                           return { ...prev, compoundConfig: { ...prev.compoundConfig, parts } };
                                        });
                                     }}>
                                        <option value="">-- Choisir un poteau --</option>
                                        {(database.extraElements || []).map(el => <option key={el.id} value={el.id}>{el.name} ({el.id})</option>)}
                                        <optgroup label="Profilés Standard">
                                           {(database.profiles || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                                        </optgroup>
                                     </select>
                                  ) : (
                                     <select className="input" value={activePart.compositionId || ''} onChange={e => updatePartInPath(activePartPath, 'compositionId', e.target.value)}>
                                        <option value="">-- Composition --</option>
                                        {database.compositions.filter(c => {
                                           if (activePart.type === 'opening') {
                                              return c.openingType === 'Coulissant' || (c.openingType !== 'Fixe' && c.openingType !== 'Fixe Vitré');
                                           } else {
                                              return c.openingType === 'Fixe' || c.openingType === 'Fixe Vitré';
                                           }
                                        }).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                     </select>
                                  )}
                               </div>
                               {activePart.type !== 'extra' ? (
                                  <div className="form-group">
                                     <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Vitrage</label>
                                     <select className="input" value={activePart.glassId || ''} onChange={e => updatePartInPath(activePartPath, 'glassId', e.target.value)}>
                                        <option value="">(Vitrage global)</option>
                                        {database.glass?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                     </select>
                                  </div>
                               ) : null}

                               {activePart.type === 'opening' && (
                                   <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                      <label className="label" style={{ fontSize: '0.8rem', color: '#64748b' }}>Sens d'ouverture</label>
                                      <select className="input" value={activePart.openingDirection || ''} onChange={e => updatePartInPath(activePartPath, 'openingDirection', e.target.value)}>
                                         <option value="">(Par défaut global)</option>
                                         <option value="gauche">Ouvrant Gauche (G)</option>
                                         <option value="droit">Ouvrant Droit (D)</option>
                                      </select>
                                   </div>
                                )}
                            </div>
                         )}

                         {activePart.type !== 'group' && (
                            (() => {
                               const isSubPart = activePartPath.length > 1;
                               const parentPath = activePartPath.slice(0, -1);
                               let parentParts = config.compoundConfig?.parts;
                               for(let i=0; i<parentPath.length; i++) {
                                  parentParts = parentParts[parentPath[i]].subParts;
                               }
                               const targetIndex = activePartPath[activePartPath.length - 1];
                               const hasNextSibling = parentParts && targetIndex < parentParts.length - 1;
                               
                               if (hasNextSibling) {
                                  const targetPart = parentParts[targetIndex];
                                  return (
                                     <div style={{ marginTop: '1rem', padding: '0.8rem', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                        <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Liaison / Jonction après ce bloc</h5>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                           <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                              <label className="label" style={{ fontSize: '0.75rem' }}>Traverse</label>
                                              <select className="input" value={targetPart.traverseId || 'AUTO'} onChange={e => {
                                                 const val = e.target.value;
                                                 let th = targetPart.traverseThickness ?? 25;
                                                 if (val !== 'AUTO') {
                                                    const trv = database.traverses?.find(t => t.id === val || t.profileId === val);
                                                    if (trv?.thickness) th = trv.thickness;
                                                    else {
                                                       const prof = database.profiles?.find(p => p.id === val);
                                                       if (prof?.thickness) th = prof.thickness;
                                                    }
                                                 }
                                                 updatePartInPath(activePartPath, 'traverseId', val);
                                                 updatePartInPath(activePartPath, 'traverseThickness', th);
                                              }}>
                                                 <option value="AUTO">AUTO (Par défaut)</option>
                                                 {(database.traverses || []).map(t => <option key={t.id} value={t.profileId || t.id}>{t.name}</option>)}
                                              </select>
                                           </div>
                                           <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                              <label className="label" style={{ fontSize: '0.75rem' }}>Épaisseur (mm)</label>
                                              <input type="number" className="input" value={targetPart.traverseThickness ?? 25} onChange={e => updatePartInPath(activePartPath, 'traverseThickness', parseFloat(e.target.value) || 0)} />
                                           </div>
                                        </div>
                                     </div>
                                  );
                               }
                               return null;
                            })()
                         )}

                         {activePart.type === 'group' && (
                            <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.5rem' }}>
                               <button className="btn btn-secondary" onClick={() => {
                                  setConfig(prev => {
                                     const parts = JSON.parse(JSON.stringify(prev.compoundConfig?.parts || []));
                                     let current = parts;
                                     for (let i = 0; i < activePartPath.length; i++) {
                                        current = current[activePartPath[i]].subParts;
                                     }
                                     current.push({
                                        id: `sub-${Date.now()}`,
                                        type: 'fixe',
                                        compositionId: '',
                                        glassId: '',
                                        width: 400,
                                        height: 1500,
                                        traverseThickness: 25
                                     });
                                     return { ...prev, compoundConfig: { ...prev.compoundConfig, parts } };
                                  });
                               }} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
                                  + Ajouter un sous-bloc dans ce groupe
                               </button>
                            </div>
                         )}
                      </div>
                   )}
                </div>
             );
          })()}

          {!config.isOnlyShutter && (
            <div style={{ display: (config.useCustomLayout || config.compoundType !== 'none') ? 'none' : 'block' }}>
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
            </div>
          </div>
        )}

          {!config.isOnlyShutter && (
            <div className="form-group" style={{ marginTop: '1rem', background: '#eff6ff', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #bfdbfe' }}>
              <label className="label" style={{ color: '#1e40af', fontWeight: 700 }}>4. Sens d'ouverture / Main</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {[
                  { id: 'gauche', label: 'Ouvrant Gauche', icon: '⬅️' },
                  { id: 'droit', label: 'Ouvrant Droit', icon: '➡️' }
                ].map(dir => (
                  <label key={dir.id} style={{ 
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', 
                    padding: '0.75rem', border: `2px solid ${config.openingDirection === dir.id ? '#2563eb' : '#e2e8f0'}`,
                    borderRadius: '0.5rem', cursor: 'pointer', background: config.openingDirection === dir.id ? 'white' : '#f8fafc',
                    transition: 'all 0.2s', fontWeight: config.openingDirection === dir.id ? 700 : 400,
                    boxShadow: config.openingDirection === dir.id ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : 'none'
                  }}>
                    <input type="radio" name="openingDirection" value={dir.id} checked={config.openingDirection === dir.id}
                      onChange={() => setConfig(prev => ({ ...prev, openingDirection: dir.id }))}
                      style={{ display: 'none' }} />
                    {dir.icon} {dir.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentComp?.openingType !== 'VoletSeul' && !config.isOnlyShutter && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label className="label">Finition / Couleur</label>
                <select name="colorId" value={config.colorId} onChange={handleChange} className="input">
                  {database.colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="label">Vitrage</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select 
                    name="glassId" 
                    value={config.glassId} 
                    onChange={handleChange} 
                    className="input" 
                    style={{ flex: 1 }}
                    disabled={currentComp?.isPrecadre || (currentComp?.name || '').toLowerCase().includes('precadre')}
                  >
                    {currentComp?.isPrecadre || (currentComp?.name || '').toLowerCase().includes('precadre') ? (
                      <option value="">-- Sans Vitrage (Précadre) --</option>
                    ) : (
                      <>
                        <option value="">-- Sélectionner Vitrage --</option>
                        {database.glass.map(g => <option key={g.id} value={g.id}>{g.name} {g.composition ? `(${g.composition})` : ''}</option>)}
                      </>
                    )}
                  </select>
                  <button onClick={() => setCompareModalOpen(true)} className="btn btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Comparer les vitrages" disabled={currentComp?.isPrecadre || (currentComp?.name || '').toLowerCase().includes('precadre')}>
                    <GitCompare size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasCouvreJoint && !config.isOnlyShutter && (
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

          {availableOptions.length > 0 && !config.isOnlyShutter && (
            <div className="form-group" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <label className="label" style={{ marginBottom: '0.75rem' }}>Options & Variantes</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                {availableOptions.map(opt => {
                  const isSelected = (config.selectedOptions || []).includes(opt.id);
                  const dir = (config.openingDirection || '').toLowerCase();
                  const defaultSide = dir.includes('gauch') ? 'gauche' : (dir.includes('droit') ? 'droit' : 'both');
                  const optionSide = config.optionSides?.[opt.id] || defaultSide;
                  
                  return (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: isSelected ? '#f0f9ff' : 'transparent', borderRadius: '0.5rem', border: isSelected ? '1px solid #bae6fd' : '1px solid transparent' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', flex: 1 }}>
                        <input type="checkbox" checked={isSelected}
                          onChange={e => setConfig(prev => ({ ...prev, selectedOptions: e.target.checked ? [...(prev.selectedOptions || []), opt.id] : (prev.selectedOptions || []).filter(id => id !== opt.id) }))}
                          style={{ width: '1.1rem', height: '1.1rem' }} />
                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{opt.name}</span>
                      </label>
                      
                      {isSelected && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', background: 'white', padding: '0.2rem', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                          {['both', 'gauche', 'droit'].map(side => (
                            <button
                              key={side}
                              onClick={() => setConfig(prev => ({ ...prev, optionSides: { ...(prev.optionSides || {}), [opt.id]: side } }))}
                              style={{
                                padding: '0.2rem 0.4rem', fontSize: '0.65rem', border: 'none', borderRadius: '0.2rem', cursor: 'pointer',
                                background: optionSide === side ? '#3b82f6' : 'transparent',
                                color: optionSide === side ? 'white' : '#64748b',
                                fontWeight: optionSide === side ? 700 : 400
                              }}
                            >
                              {side === 'both' ? '2 Côtés' : side === 'gauche' ? 'G' : 'D'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Precadre Option */}
          {!config.isOnlyShutter && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: config.hasPrecadre ? '#f0fdf4' : '#f8fafc', borderRadius: '0.75rem', border: `1px solid ${config.hasPrecadre ? '#86efac' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 600, color: config.hasPrecadre ? '#166534' : '#1e293b', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={config.hasPrecadre || false}
                  onChange={e => setConfig(prev => ({ ...prev, hasPrecadre: e.target.checked }))}
                  style={{ width: '1.2rem', height: '1.2rem' }} />
                🔲 Pose sur Précadre
                {config.hasPrecadre && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#15803d', marginLeft: '0.5rem' }}>→ Chevilles supprimées automatiquement</span>}
              </label>
            </div>
          )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
            <input type="checkbox" 
              checked={config.hasShutter || config.isOnlyShutter || false} 
              disabled={config.isOnlyShutter}
              onChange={e => setConfig(prev => ({ ...prev, hasShutter: e.target.checked }))} 
              style={{ width: '1.2rem', height: '1.2rem' }} />
            {config.isOnlyShutter ? 'Produit : Volet Rénovation Selectionné' : 'Ajouter un Volet Roulant'}
          </label>
          
          {config.hasShutter && (
             <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#1e40af', cursor: 'pointer', border: '1px solid #bfdbfe', background: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '0.4rem' }}>
                  <input type="checkbox" checked={config.isOnlyShutter || false} 
                    onChange={e => setConfig(prev => ({ ...prev, isOnlyShutter: e.target.checked, hasShutter: e.target.checked ? true : prev.hasShutter }))} />
                  Volet Seul
                </label>
                <button 
                  onClick={() => setConfig(prev => ({ ...prev, shutterConfig: { ...prev.shutterConfig, isStandalone: !prev.shutterConfig?.isStandalone } }))}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', background: config.shutterConfig?.isStandalone ? '#eff6ff' : 'white', color: config.shutterConfig?.isStandalone ? '#3b82f6' : '#64748b', cursor: 'pointer' }}
                >
                  {config.shutterConfig?.isStandalone ? '⚙️ Mode Détail' : '📦 Mode Pack'}
                </button>
             </div>
          )}
        </div>

        {config.hasShutter && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f1f5f9', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, color: '#1e40af' }}>
              <input type="checkbox" checked={config.shutterConfig?.isExistant || false}
                onChange={e => setConfig(prev => ({ ...prev, shutterConfig: { ...(prev.shutterConfig || {}), isExistant: e.target.checked } }))} />
              Caisson Tunnel (Existant)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700, color: '#2563eb', padding: '0.2rem 0.5rem', background: '#dbeafe', borderRadius: '0.3rem' }}>
              <input type="checkbox" checked={config.shutterConfig?.isDoubleShutter || false}
                onChange={e => setConfig(prev => ({ ...prev, shutterConfig: { ...(prev.shutterConfig || {}), isDoubleShutter: e.target.checked } }))} />
              ⚡ Volet Double (Séparé)
            </label>

            {config.shutterConfig?.isDoubleShutter && (() => {
              const kitId = config.shutterConfig?.kitId || '';
              const kitObj = (database.shutterComponents?.kits || []).find(k => k.id === kitId);
              const kitName = kitObj?.name || kitId;
              return kitObj?.type === 'MOTEUR' || kitId.startsWith('KIT-MOTE') || kitId.toLowerCase().includes('mot') || kitName.toLowerCase().includes('moteur');
            })() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', borderLeft: '2px solid #3b82f6', paddingLeft: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af' }}>Nb Moteurs :</span>
                <select 
                  className="input" 
                  value={config.shutterConfig?.motorCount || 2} 
                  onChange={e => setConfig(prev => ({ ...prev, shutterConfig: { ...(prev.shutterConfig || {}), motorCount: parseInt(e.target.value) } }))}
                  style={{ width: '100px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', height: '24px', background: 'white', border: '1px solid #3b82f6' }}
                >
                  <option value={1}>1 Moteur</option>
                  <option value={2}>2 Moteurs</option>
                </select>
              </div>
            )}
            
            {config.shutterConfig?.isStandalone && (
              <div style={{ display: 'flex', gap: '0.75rem', borderLeft: '2px solid #cbd5e1', paddingLeft: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'caisson', label: 'Caisson' },
                  { id: 'tablier', label: 'Tablier' },
                  { id: 'axe', label: 'Axe/Mot.' },
                  { id: 'glissieres', label: 'Glissières' }
                ].map(part => {
                  const includedParts = config.shutterConfig?.includedParts || { caisson: true, tablier: true, axe: true, glissieres: true, accessories: true };
                  return (
                    <label key={part.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={includedParts[part.id]} 
                        onChange={e => setConfig(prev => ({ 
                          ...prev, 
                          shutterConfig: { 
                            ...prev.shutterConfig, 
                            includedParts: { ...(prev.shutterConfig?.includedParts || { caisson: true, tablier: true, axe: true, glissieres: true, accessories: true }), [part.id]: e.target.checked }
                          } 
                        }))} />
                      {part.label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {config.hasShutter && database.shutterComponents && (
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>

                {[
                  { key: 'caissonId', label: 'Caisson', items: database.shutterComponents?.caissons || [] },
                  { key: 'axeId', label: 'Axe', items: database.shutterComponents?.axes || [] },
                  { key: 'lameId', label: 'Lame', items: database.shutterComponents?.lames || [] },
                  { key: 'lameFinaleId', label: 'Lame Finale', items: database.shutterComponents?.lameFinales || [] },
                  { key: 'glissiereId', label: 'Glissière', items: database.shutterComponents?.glissieres || [] },
                  { key: 'moteurId', label: 'Moteur', items: database.shutterComponents?.moteurs || [] },
                  { key: 'kitId', label: 'Kit Manœuvre', items: database.shutterComponents?.kits || [] }
                ].map(({ key, label, items }) => {
                  if (key === 'moteurId') {
                    const selectedKitId = config.shutterConfig?.kitId;
                    const selectedKit = (database.shutterComponents?.kits || []).find(k => k.id === selectedKitId);
                    const isMotor = selectedKit?.type === 'MOTEUR' || 
                                            (selectedKitId || '').toLowerCase().includes('mote') || 
                                            selectedKit?.name?.toLowerCase().includes('moteur');
                    if (!selectedKit || !isMotor) return null;
                  }


                  let filteredItems = (items || []).filter(item => {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const usage = item.usageVolet || (key === 'moteurId' ? 'BOTH' : 'NORMAL');
                    if (isDouble) return usage === 'DOUBLE' || usage === 'BOTH';
                    return usage === 'NORMAL' || usage === 'BOTH';
                  });
                  if (key === 'glissiereId' && currentComp?.rangeId) {
                      // Show items for this range OR universal items (no rangeId)
                      filteredItems = filteredItems.filter(i => !i.rangeId || i.rangeId === currentComp.rangeId);
                  }
                  
                  // Apply compatibility formula for caissons (based on L and lameWidth of selected lame)
                  if (key === 'caissonId') {
                    const L = config.L || 0;
                    const H = config.H || 0;
                    const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === config.shutterConfig?.lameId);
                    const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                    
                    filteredItems = filteredItems.filter(caisson => {
                      const formula = caisson.compatibilityFormula;
                      if (!formula || formula.trim() === '') return true;
                      try {
                        const area = (L * H) / 1000000;
                        const scope = { L, H, area, lameWidth };
                        return engine.evaluate(formula, scope);
                      } catch (e) {
                        console.warn(`[Caisson Compatibility] Formula error for "${caisson.name}":`, e.message);
                        return true;
                      }
                    });
                  }

                  // Apply compatibility formula for lames
                  if (key === 'lameId') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;
                    const selectedAxeId = config.shutterConfig?.axeId;
                    const axes = database.shutterComponents?.axes || [];
                    const selectedAxe = axes.find(a => a.id === selectedAxeId) || axes[0]; // Fallback to first axe if none
                    const axeDiameter = selectedAxe ? parseFloat(selectedAxe.diameter) || 0 : 0;
                    
                    filteredItems = filteredItems.filter(lame => {
                      const formula = lame.compatibilityFormula;
                      if (!formula || formula.trim() === '') return true;
                      try {
                        const area = (L * H) / 1000000;
                        const weightPerM2 = parseFloat(lame.weightPerM2) || 0;
                        const totalWeight = area * weightPerM2;
                        const liftingWeight = totalWeight;
                        const lameWidth = parseFloat(lame.lameWidth) || 0;
                        const scope = { L, H, area, axeDiameter, weightPerM2, totalWeight, liftingWeight, lameWidth };
                        return engine.evaluate(formula, scope);
                      } catch (e) {
                        console.warn(`[Lame Compatibility] Formula error for "${lame.name}":`, e.message);
                        return true;
                      }
                    });
                  }

                  // Apply compatibility formula for motors
                  if (key === 'moteurId') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;
                    
                    const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === config.shutterConfig?.lameId);
                    const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;
                    const area = (L * H) / 1000000;
                    const totalWeight = area * weightPerM2;

                    // Lifting weight logic based on axle diameter
                    const selectedAxeId = config.shutterConfig?.axeId;
                    const axes = database.shutterComponents?.axes || [];
                    const selectedAxe = axes.find(a => a.id === selectedAxeId) || axes[0];
                    const axeDiameter = selectedAxe ? parseFloat(selectedAxe.diameter) || 0 : 0;

                    const liftingWeight = totalWeight;

                    filteredItems = filteredItems.filter(moteur => {
                      const formula = moteur.compatibilityFormula;
                      if (!formula || formula.trim() === '') {
                        console.log(`[Motor Debug] ${moteur.name} | No formula -> Compatible (usage=${moteur.usageVolet || 'BOTH'})`);
                        return true;
                      }
                      try {
                        const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                        const scope = { L, H, area, totalWeight, weightPerM2, liftingWeight, axeDiameter, lameWidth };
                        const res = engine.evaluate(formula, scope);
                        console.log(`[Motor Debug] ${moteur.name} | Formula: "${formula}" | Scope: L=${L}, H=${H}, area=${area.toFixed(3)}, weight=${totalWeight.toFixed(2)}, lift=${liftingWeight.toFixed(2)}, axe=${axeDiameter} | Result -> ${res} (usage=${moteur.usageVolet || 'BOTH'})`);
                        return res;
                      } catch (e) {
                        console.log(`[Motor Debug] ${moteur.name} | Formula: "${formula}" | Error: ${e.message}`);
                        console.warn(`[Motor Compatibility] Formula error for "${moteur.name}":`, e.message);
                        return true;
                      }
                    });
                  }

                  // Apply compatibility formula for axes
                  if (key === 'axeId') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;
                    
                    const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === config.shutterConfig?.lameId);
                    const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;
                    const area = (L * H) / 1000000;
                    const totalWeight = area * weightPerM2;

                    filteredItems = filteredItems.filter(axe => {
                      const formula = axe.compatibilityFormula;
                      if (!formula || formula.trim() === '') return true;
                      try {
                        const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                        const liftingWeight = totalWeight;
                        const scope = { L, H, area, totalWeight, liftingWeight, weightPerM2, lameWidth };
                        return engine.evaluate(formula, scope);
                      } catch (e) {
                        console.warn(`[Axe Compatibility] Formula error for "${axe.name}":`, e.message);
                        return true;
                      }
                    });
                  }

                  // Apply compatibility formula for kits
                  if (key === 'kitId' || key === 'kits') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;
                    const area = (L * H) / 1000000;
                    
                    const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === config.shutterConfig?.lameId);
                    const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;
                    const totalWeight = area * weightPerM2;

                    const selectedCaissonKit = (database.shutterComponents?.caissons || []).find(c => c.id === config.shutterConfig?.caissonId);
                    const caissonSize = parseFloat(selectedCaissonKit?.height) || parseFloat(selectedCaissonKit?.size) || parseFloat(selectedCaissonKit?.thickness) || 0;

                    const axesKit = database.shutterComponents?.axes || [];
                    const selectedAxeKit = axesKit.find(a => a.id === config.shutterConfig?.axeId) || axesKit[0];
                    const axeDiameter = selectedAxeKit ? parseFloat(selectedAxeKit.diameter) || parseFloat((selectedAxeKit.name || '').match(/\d+/)?.[0]) || 0 : 0;

                    filteredItems = filteredItems.filter(kit => {
                      const formula = kit.compatibilityFormula;
                      if (!formula || formula.trim() === '') return true;
                      try {
                        const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                        const scope = { L, H, area, totalWeight, weightPerM2, lameWidth, caissonSize, axeDiameter };
                        return engine.evaluate(formula, scope);
                      } catch (e) {
                        console.warn(`[Kit Compatibility] Formula error for "${kit.name}":`, e.message);
                        return true;
                      }
                    });
                  }

                  // Apply compatibility formula for extras
                  if (key === 'extraId' || key === 'extras') {
                    const isDouble = config.shutterConfig?.isDoubleShutter || false;
                    const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                    const H = config.H || 0;
                    const area = (L * H) / 1000000;

                    const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === config.shutterConfig?.lameId);
                    const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                    const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;
                    const totalWeight = area * weightPerM2;

                    const selectedCaissonKit = (database.shutterComponents?.caissons || []).find(c => c.id === config.shutterConfig?.caissonId);
                    const caissonSize = parseFloat(selectedCaissonKit?.height) || parseFloat(selectedCaissonKit?.size) || parseFloat(selectedCaissonKit?.thickness) || 0;

                    const axesKit = database.shutterComponents?.axes || [];
                    const selectedAxeKit = axesKit.find(a => a.id === config.shutterConfig?.axeId) || axesKit[0];
                    const axeDiameter = selectedAxeKit ? parseFloat(selectedAxeKit.diameter) || parseFloat((selectedAxeKit.name || '').match(/\d+/)?.[0]) || 0 : 0;

                    filteredItems = filteredItems.filter(extra => {
                      const formula = extra.compatibilityFormula;
                      if (!formula || formula.trim() === '') return true;
                      try {
                        const scope = { L, H, area, lameWidth, totalWeight, weightPerM2, caissonSize, axeDiameter };
                        return engine.evaluate(formula, scope);
                      } catch (e) {
                        console.warn(`[Extra Compatibility] Formula error for "${extra.name}":`, e.message);
                        return true;
                      }
                    });
                  }

                  const handleShutterChange = (val) => {
                    setConfig(prev => ({ 
                      ...prev, 
                      shutterConfig: { 
                        ...(prev.shutterConfig || {}), 
                        [key]: val,
                        // Reset params if glissiere changes
                        ...(key === 'glissiereId' ? { glissiereParams: {} } : {})
                      } 
                    }));
                  };

                  const toggleCouvreJoint = (checked) => {
                    setConfig(prev => ({
                      ...prev,
                      shutterConfig: {
                        ...(prev.shutterConfig || {}),
                        hasCouvreJoint: checked
                      }
                    }));
                  };

                  const selectedItemId = config.shutterConfig?.[key];
                  
                  let effectiveItem = null;
                  if (key === 'glissiereId') {
                    let id = selectedItemId;
                    if (id === 'AUTO') {
                      const kitId = config.shutterConfig?.kitId;
                      const selectedKit = (database.shutterComponents?.kits || []).find(k => k.id === kitId);
                      const kitType = selectedKit?.type || 'SANGLE';
                      const type = kitType === 'MOTEUR' ? 'PALA' : (kitType === 'SANGLE' ? 'MONO' : 'OTHER');
                      const autoG = (database.shutterComponents?.glissieres || []).find(g => 
                        (!g.rangeId || !currentComp || g.rangeId === currentComp.rangeId) && 
                        g.shutterType === type
                      );
                      id = autoG?.id;
                    }
                    effectiveItem = (database.shutterComponents?.glissieres || []).find(g => g.id === id);
                  } else {
                    effectiveItem = filteredItems.find(i => i.id === selectedItemId);
                  }

                  const handleParamChange = (pKey, pVal) => {
                    setConfig(prev => ({
                      ...prev,
                      shutterConfig: {
                        ...(prev.shutterConfig || {}),
                        glissiereParams: { ...(prev.shutterConfig?.glissiereParams || {}), [pKey]: pVal }
                      }
                    }));
                  };

                  return (
                    <React.Fragment key={key}>
                      <div className="form-group">
                        <label className="label" style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{label}</span>
                          {key === 'lameId' && config.shutterConfig?.lameId && (() => {
                            const isDouble = config.shutterConfig?.isDoubleShutter || false;
                            const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                            const H = config.H || 0;
                            const area = (L * H) / 1000000;
                            const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === config.shutterConfig.lameId);
                            if (!selectedLame) return null;
                            const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;
                            const totalWeight = area * weightPerM2;
                            return <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }} title="Poids du tablier">⚖️ {totalWeight.toFixed(2)} kg</span>;
                          })()}
                        </label>
                        <select className="input" value={selectedItemId || ''} onChange={e => handleShutterChange(e.target.value)}>
                          <option value="">-- Sélectionner --</option>
                          {key === 'glissiereId' && <option value="AUTO">-- Automatique (Kit) --</option>}
                          {filteredItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>

                      {/* Weight Info Display for Lames */}
                      {key === 'lameId' && (
                        <div style={{ gridColumn: 'span 2', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                          {(() => {
                            const isDouble = config.shutterConfig?.isDoubleShutter || false;
                            const L = isDouble ? (config.L || 0) / 2 : (config.L || 0);
                            const H = config.H || 0;
                            const area = (L * H) / 1000000;
                            const selectedAxeId = config.shutterConfig?.axeId;
                            const axes = database.shutterComponents?.axes || [];
                            const selectedAxe = axes.find(a => a.id === selectedAxeId) || axes[0];
                            const axeDiameter = selectedAxe ? parseFloat(selectedAxe.diameter) || 0 : 0;
                            
                            const selectedLameId = config.shutterConfig?.lameId;
                            const lames = database.shutterComponents?.lames || [];
                            const selectedLame = lames.find(l => l.id === selectedLameId);
                            const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;
                            const totalWeight = area * weightPerM2;

                            const liftingWeight = totalWeight;
                            
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#64748b', background: '#f8fafc', padding: '0.3rem 0.6rem', borderRadius: '0.3rem', border: '1px solid #e2e8f0', width: 'fit-content' }}>
                                <span style={{ fontWeight: 700, color: '#334155' }}>⚖️ Charge de levage :</span> {liftingWeight.toFixed(2)} kg (Axe {axeDiameter})
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Technical Alert for Shutter Components & Add-ons */}
                      {(key === 'lameId' || key === 'axeId' || key === 'moteurId' || key === 'extraId' || key === 'extras' || key === 'kitId') && effectiveItem && (
                        <div style={{ gridColumn: 'span 2', marginTop: '-0.5rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {(() => {
                             try {
                               const L = config.L || 0;
                               const H = config.H || 0;
                               const area = (L * H) / 1000000;
                               const selectedLameId = config.shutterConfig?.lameId;
                               const selectedLame = (database.shutterComponents?.lames || []).find(l => l.id === selectedLameId);
                               const weightPerM2 = parseFloat(selectedLame?.weightPerM2) || 0;
                               const lameWidth = parseFloat(selectedLame?.lameWidth) || 0;
                               const totalWeight = area * weightPerM2;
                               
                               const selectedCaissonId = config.shutterConfig?.caissonId;
                               const selectedCaisson = (database.shutterComponents?.caissons || []).find(c => c.id === selectedCaissonId);
                               const caissonSize = parseFloat(selectedCaisson?.size) || 0;

                               const selectedAxeId = config.shutterConfig?.axeId;
                               const axes = database.shutterComponents?.axes || [];
                               const selectedAxe = axes.find(a => a.id === selectedAxeId) || axes[0];
                               const axeDiameter = selectedAxe ? parseFloat(selectedAxe.diameter) || 0 : 0;
                               const liftingWeight = totalWeight;
                               
                               const scope = { L, H, area, totalWeight, liftingWeight, axeDiameter, lameWidth, caissonSize };
                               const alerts = [];

                               // 1. Check main item alert
                               if (effectiveItem.technicalAlert && effectiveItem.technicalAlert.trim() !== "") {
                                 const alertMsg = engine.evaluate(effectiveItem.technicalAlert, scope);
                                 if (alertMsg && String(alertMsg).trim() !== '' && alertMsg !== true && alertMsg !== false) {
                                   alerts.push(String(alertMsg));
                                 } else if (typeof alertMsg === 'string' && !effectiveItem.technicalAlert.includes('if') && alertMsg.trim() !== "") {
                                   // Simple string fallback
                                   alerts.push(alertMsg);
                                 }
                               }

                               // 2. Check Add-ons alerts
                               (effectiveItem.addOns || []).forEach(addon => {
                                 if (addon.technicalAlert && addon.technicalAlert.trim() !== "") {
                                    const alertMsg = engine.evaluate(addon.technicalAlert, scope);
                                    if (alertMsg && String(alertMsg).trim() !== '' && alertMsg !== true && alertMsg !== false) {
                                      alerts.push(String(alertMsg));
                                    }
                                 }
                               });

                               if (alerts.length === 0) return null;

                               return alerts.map((msg, i) => (
                                 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '0.4rem', color: '#c2410c', fontSize: '0.75rem', fontWeight: 600 }}>
                                   <AlertTriangle size={14} /> {msg}
                                 </div>
                               ));
                             } catch(e) {
                               console.warn("[Alert Eval Error]", e);
                             }
                             return null;
                          })()}
                        </div>
                      )}

                      {/* Special Option: Couvre Joint (Only shown once, e.g. next to caisson) */}
                      {key === 'caissonId' && (
                        <div className="form-group">
                          <label className="label" style={{ fontSize: '0.8rem' }}>Type de pose (Réduction)</label>
                          <select 
                            className="input" 
                            value={config.shutterConfig?.couvreJointType || (config.shutterConfig?.hasCouvreJoint ? 'total' : 'none')}
                            onChange={e => setConfig(prev => ({ 
                              ...prev, 
                              shutterConfig: { 
                                ...(prev.shutterConfig || {}), 
                                couvreJointType: e.target.value,
                                hasCouvreJoint: e.target.value !== 'none'
                              } 
                            }))}
                            style={{ background: '#eff6ff', color: '#1e40af', fontWeight: 600, border: '1px solid #bfdbfe' }}
                          >
                            <option value="none">Sans réduction</option>
                            <option value="half">1 côté pose avec CJ (-1.5 mm)</option>
                            <option value="total">Pose avec Couvre-Joint (-3mm L)</option>
                          </select>
                        </div>
                      )}
                      {key === 'lameId' && effectiveItem?.hasBaguette && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', background: '#f0f9ff', padding: '0.4rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #bae6fd', width: '100%' }}>
                            <input type="checkbox" checked={config.shutterConfig?.enableBaguette || false}
                              onChange={e => setConfig(prev => ({ ...prev, shutterConfig: { ...(prev.shutterConfig || {}), enableBaguette: e.target.checked } }))} />
                            Ajouter Baguette (Prix: {effectiveItem.baguettePrice} DZD)
                          </label>
                        </div>
                      )}
                      {key === 'glissiereId' && (
                        <>
                          {(() => {
                            const isDouble = config.shutterConfig?.isDoubleShutter || false;
                            const opt1L = (isDouble && effectiveItem.doubleOpt1Label) ? effectiveItem.doubleOpt1Label : effectiveItem.opt1Label;
                            const opt1V = (isDouble && effectiveItem.doubleOpt1Values) ? effectiveItem.doubleOpt1Values : effectiveItem.opt1Values;
                            
                            if (!opt1L) return null;

                            return (
                              <div className="form-group">
                                <label className="label" style={{ fontSize: '0.8rem' }}>{opt1L}</label>
                                <select 
                                  className="input" 
                                  style={{ border: '2px solid #3b82f6', background: '#eff6ff' }}
                                  value={config.shutterConfig?.glissiereParams?.opt1 || opt1V?.split(',')[0]?.trim() || ''} 
                                  onChange={e => handleParamChange('opt1', e.target.value)}
                                >
                                  {(opt1V || '').split(',').map(v => v.trim()).filter(Boolean).map(v => (
                                    <option key={v} value={v}>{v} mm</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}
                          {effectiveItem?.opt2Label && (
                            <div className="form-group">
                              <label className="label" style={{ fontSize: '0.8rem' }}>{effectiveItem.opt2Label}</label>
                              <select 
                                className="input" 
                                style={{ border: '2px solid #3b82f6', background: '#eff6ff' }}
                                value={config.shutterConfig?.glissiereParams?.opt2 || effectiveItem.opt2Values?.split(',')[0]?.trim() || ''} 
                                onChange={e => handleParamChange('opt2', e.target.value)}
                              >
                                {(effectiveItem.opt2Values || '').split(',').map(v => v.trim()).filter(Boolean).map(v => (
                                  <option key={v} value={v}>{v} mm</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Control Position (Motor/Strap/Crank) */}
                {(() => {
                  const kitId = config.shutterConfig?.kitId || '';
                  if (!kitId) return false;
                  const kitObj = (database.shutterComponents?.kits || []).find(k => k.id === kitId);
                  const kitName = kitObj?.name || kitId;
                  const isMotor = kitObj?.type === 'MOTEUR' || kitId.startsWith('KIT-MOTE') || kitId.toLowerCase().includes('mot') || kitName.toLowerCase().includes('moteur');
                  const isSangle = kitObj?.type === 'SANGLE' || kitId.startsWith('KIT-SANG') || kitId.toLowerCase().includes('sang') || kitName.toLowerCase().includes('sangle');
                  const isMani = kitObj?.type === 'MANIVELLE' || kitId.startsWith('KIT-MANI') || kitId.toLowerCase().includes('mani') || kitName.toLowerCase().includes('manivelle');
                  return isMotor || isSangle || isMani;
                })() && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      {(() => {
                        const kitId = config.shutterConfig?.kitId || '';
                        const kitObj = (database.shutterComponents?.kits || []).find(k => k.id === kitId);
                        const kitName = kitObj?.name || kitId;
                        if (kitObj?.type === 'MOTEUR' || kitId.startsWith('KIT-MOTE') || kitId.toLowerCase().includes('mot') || kitName.toLowerCase().includes('moteur')) return 'Position du Câble Moteur';
                        if (kitObj?.type === 'SANGLE' || kitId.startsWith('KIT-SANG') || kitId.toLowerCase().includes('sang') || kitName.toLowerCase().includes('sangle')) return 'Position de la Sangle';
                        return 'Position de la Manivelle';
                      })()}
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {['Gauche', 'Droite'].map(pos => {
                        const isSelected = (config.shutterConfig?.controlPosition || 'Droite') === pos;
                        
                        return (
                          <label key={pos} style={{ 
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', 
                            padding: '0.6rem', border: `2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                            borderRadius: '0.5rem', cursor: 'pointer', background: isSelected ? '#eff6ff' : 'white',
                            transition: 'all 0.2s', fontWeight: isSelected ? 700 : 400
                          }}>
                            <input type="radio" name="controlPos" checked={isSelected}
                              onChange={() => setConfig(prev => ({ 
                                ...prev, 
                                shutterConfig: { 
                                  ...(prev.shutterConfig || {}), 
                                  controlPosition: pos 
                                } 
                              }))}
                              style={{ display: 'none' }} />
                            {pos === 'Gauche' ? '⬅️' : '➡️'} {pos}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {priceData?.errors && priceData.errors.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.5rem', color: '#92400e' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 ⚠️ Erreurs de calcul détectées
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.75rem' }}>
                {priceData.errors.map((err, i) => (
                  <li key={i}><strong>{err.context}</strong> : {err.error} (Formule: <code>{err.formula}</code>)</li>
                ))}
              </ul>
            </div>
          )}

          {!validation.valid && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '0.5rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={16} /><span style={{ fontSize: '0.875rem' }}>{validation.message}</span>
            </div>
          )}

          {/* Detail Table */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
            <h3 
              className="details-toggle-btn"
              onClick={() => {
                if (window.innerWidth >= 641 && window.innerWidth <= 1024) {
                  setShowDetailsTablet(!showDetailsTablet);
                }
              }}
              style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              RÉSUMÉ DÉTAILLÉ DU CALCUL
              <span className="tablet-only-icon" style={{ marginLeft: 'auto' }}>
                {showDetailsTablet ? '▲' : '▼'}
              </span>
            </h3>
            <div className={`table-responsive details-content ${!showDetailsTablet ? 'tablet-collapsed' : ''}`}>
              <table className="data-table" style={{ fontSize: '0.7rem' }}>
                <thead><tr><th>Composant</th><th>Source</th><th>Formule</th><th>Calcul</th><th>Nbre</th><th>Mesure Totale</th><th>Prix Unit.</th><th style={{ textAlign: 'right' }}>Prix Total</th></tr></thead>
                <tbody>
                  {priceData?.bom?.profiles?.map((p, i) => (
                    <tr key={i}>
                      <td data-label="Composant" style={{ fontWeight: 600 }}>{p.label}</td>
                      <td data-label="Source"><span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: '1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{p.source || 'Standard'}</span></td>
                      <td data-label="Formule" style={{ color: '#64748b', fontSize: '0.65rem' }}>{p.formula}</td>
                      <td data-label="Calcul" style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{p.resolvedFormula}</td><td data-label="Nbre">{p.qty}u</td>
                      <td data-label="Mesure Totale">{Math.round(p.totalMeasure || 0)} mm</td><td data-label="Prix Unit." style={{ color: Number(p.unitPrice) === 0 ? '#ef4444' : 'inherit', fontWeight: Number(p.unitPrice) === 0 ? 600 : 'normal' }}>{p.unitPrice?.toFixed(2)}</td>
                      <td data-label="Prix Total" style={{ textAlign: 'right', fontWeight: 600 }}>{(p.cost || 0).toFixed(2)} DZD</td>
                    </tr>
                  ))}
                  {priceData?.bom?.accessories?.map((acc, i) => (
                    <tr key={`acc-${i}`}>
                      <td data-label="Composant" style={{ fontWeight: 600 }}>{acc.label}</td>
                      <td data-label="Source"><span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: '1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{acc.source || 'Standard'}</span></td>
                      <td data-label="Formule" style={{ color: '#64748b', fontSize: '0.65rem' }}>{acc.formula}</td>
                      <td data-label="Calcul" style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{acc.resolvedFormula}</td><td data-label="Nbre">{acc.multiplier}u</td>
                      <td data-label="Mesure Totale">{(acc.totalMeasure || 0).toFixed(2)} {acc.unit === 'Ml' || acc.unit === 'Joint' ? 'mm' : 'u'}</td>
                      <td data-label="Prix Unit." style={{ color: Number(acc.unitPrice) === 0 ? '#ef4444' : 'inherit', fontWeight: Number(acc.unitPrice) === 0 ? 600 : 'normal' }}>{acc.unitPrice?.toFixed(2)}</td><td data-label="Prix Total" style={{ textAlign: 'right', fontWeight: 600 }}>{(acc.cost || 0).toFixed(2)} DZD</td>
                    </tr>
                  ))}

                  {priceData?.bom?.shutters?.map((s, i) => (
                    <tr key={`shutter-${i}`}>
                      <td data-label="Composant" style={{ fontWeight: 600 }}>
                        [Volet] {s.name}
                        {s.totalWeight > 0 && <span style={{ marginLeft: '0.5rem', color: '#0ea5e9', fontSize: '0.65rem' }}>(Poids: {s.totalWeight.toFixed(2)} kg)</span>}
                      </td>
                      <td data-label="Source"><span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: '1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{s.source || 'Volet'}</span></td>
                      <td data-label="Formule" style={{ color: '#64748b', fontSize: '0.65rem' }}>{s.formula}</td>
                      <td data-label="Calcul" style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{s.resolvedFormula || '-'}</td>
                      <td data-label="Nbre">
                        {(s.qty || 0).toFixed(2)} u
                      </td>
                      <td data-label="Mesure Totale">
                        {s.totalMeasure ? `${Math.round(s.totalMeasure)} mm` : '-'}
                      </td>
                      <td data-label="Prix Unit." style={{ color: Number(s.price) === 0 ? '#ef4444' : 'inherit', fontWeight: Number(s.price) === 0 ? 600 : 'normal' }}>{s.price?.toFixed(2)}</td>
                      <td data-label="Prix Total" style={{ textAlign: 'right', fontWeight: 600 }}>{(s.cost || 0).toFixed(2)} DZD</td>
                    </tr>
                  ))}
                  {(priceData?.bom?.glassDetails || (priceData?.bom?.glass ? [priceData.bom.glass] : [])).filter(Boolean).map((g, gi) => (
                    <tr key={`glass-${gi}`}>
                      <td data-label="Composant" style={{ fontWeight: 600 }}>Vitrage {g.name && g.name !== 'Vitrage' ? `(${g.name})` : ''}</td>
                      <td data-label="Source"><span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: '1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{g.source || 'Interne'}</span></td>
                      <td data-label="Formule">{Math.round(g.width || 0)} x {Math.round(g.height || 0)} mm</td>
                      <td data-label="Calcul" style={{ color: '#3b82f6', fontSize: '0.65rem' }}>{g.calculation || '-'}</td>
                      <td data-label="Nbre">{g.qty}u</td>
                      <td data-label="Mesure Totale">{(g.area || 0).toFixed(2)} m²</td><td data-label="Prix Unit." style={{ color: Number(g.pricePerM2 || g.unitPrice) === 0 ? '#ef4444' : 'inherit', fontWeight: Number(g.pricePerM2 || g.unitPrice) === 0 ? 600 : 'normal' }}>{(g.pricePerM2 || g.unitPrice)?.toFixed(2)}</td>
                      <td data-label="Prix Total" style={{ textAlign: 'right', fontWeight: 600 }}>{(g.cost || 0).toFixed(2)} DZD</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem' }}>
                    <td colSpan="7" style={{ textAlign: 'right' }}>COÛT TOTAL DE REVIENT</td>
                    <td data-label="Prix Total" style={{ textAlign: 'right', color: '#1e293b' }}>{priceData ? priceData.cost.toFixed(2) : '0.00'} DZD</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Drawing + Price - Sticky */}
        <div className="configurator-sticky-sidebar" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem', 
          alignItems: 'center',
          position: 'sticky',
          top: '80px'
        }}>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <JoineryCanvas 
              config={config} 
              width={320} 
              height={320} 
              database={database} 
              onDrawComplete={null} 
            />
          </div>
          <div className="price-card shadow-lg">
            {/* Coefficient de Marge removed from here (now global) */}
            <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>TOTAL DEVIS (HT) — 1 unité</span>
            <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>
              {priceData ? `${priceData.priceHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD` : '---'}
            </div>
            <div style={{ marginTop: '1rem', marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7, marginBottom: '0.2rem' }}>
                <span>Total Profilés</span><span>{subtotals.profiles.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7, marginBottom: '0.2rem' }}>
                <span>Total Accessoires</span><span>{subtotals.accessories.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7, marginBottom: '0.2rem' }}>
                <span>Total Vitrage</span><span>{subtotals.glass.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
              </div>
              {subtotals.shutters > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7, marginBottom: '0.2rem' }}>
                  <span>Total Volet</span><span>{subtotals.shutters.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                </div>
              )}
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

      {/* Compare Modal */}
      {compareModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', width: '700px', maxWidth: '90vw', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitCompare size={20} color="#2563eb" /> Comparaison des Vitrages
              </h2>
              <button onClick={() => setCompareModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vitrage</th>
                  <th>Composition</th>
                  <th>Épaisseur</th>
                  <th>Performances (Ug)</th>
                  <th>Poids (kg/m²)</th>
                  <th>Prix Supplémentaire</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {database.glass.map(g => {
                  const currentGlassPrice = priceData?.bom?.glass?.cost || 0;
                  const gPriceEst = config.L * config.H / 1000000 * (g.pricePerM2 || 0) * config.margin;
                  const diff = gPriceEst - currentGlassPrice;
                  const isCurrent = g.id === config.glassId;
                  return (
                    <tr key={g.id} style={{ background: isCurrent ? '#eff6ff' : 'transparent' }}>
                      <td style={{ fontWeight: 600 }}>{g.name} {isCurrent && '(Actuel)'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{g.composition || '-'}</td>
                      <td>{g.thickness || '-'} mm</td>
                      <td style={{ color: g.ug < 1.5 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{g.ug || 'N/A'}</td>
                      <td>{g.weightPerM2 || '-'} kg</td>
                      <td style={{ fontWeight: 600, color: diff > 0 ? '#ef4444' : (diff < 0 ? '#10b981' : '#64748b') }}>
                         {diff > 0 ? '+' : ''}{diff.toFixed(2)} DZD
                      </td>
                      <td>
                        {!isCurrent && (
                          <button onClick={() => { setConfig(prev => ({ ...prev, glassId: g.id })); setCompareModalOpen(false); }} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                            Choisir
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SETTINGS PANEL ────────────────────────────────────────────────────────
export const QuoteSettingsPanel = ({ settings, onSave, onClose, title = "Paramètres du Devis" }) => {
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
          <h2 style={{ fontWeight: 700 }}>⚙️ {title}</h2>
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
  const quote = currentQuote || { id: '', number: '', items: [] };
  const engine = useMemo(() => new FormulaEngine(database), [database]);
  const [localView, setLocalView] = useState('list'); // 'list' | 'configure'
  const [editingItemId, setEditingItemId] = useState(null);
  const [infoPopupItem, setInfoPopupItem] = useState(null);
  const [draftConfig, setDraftConfig] = useState({ ...EMPTY_CONFIG });
  const [draftLabel, setDraftLabel] = useState('');
  const [draftRef, setDraftRef] = useState('');
  const [draftQty, setDraftQty] = useState(1);
  const [activeListTab, setActiveListTab] = useState('quote'); // 'quote' | 'consumables'
  const [showSettings, setShowSettings] = useState(false);
  const [consumableFilter, setConsumableFilter] = useState('all'); // 'all' | item id
  const [newManualOption, setNewManualOption] = useState('');
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [editingOptionText, setEditingOptionText] = useState('');

  // Per-product manual option editor state
  const [expandedProductOptions, setExpandedProductOptions] = useState({}); // item.id -> boolean
  const [productOptionInputs, setProductOptionInputs] = useState({}); // item.id -> string
  const [editingProductOptionId, setEditingProductOptionId] = useState(null); // opt.id
  const [editingProductOptionText, setEditingProductOptionText] = useState('');

  useEffect(() => {
    if (setCurrentQuote && !quote.clientId && database.clients?.length > 0) {
      setCurrentQuote(prev => ({ ...prev, clientId: database.clients[0].id }));
    }
  }, [database.clients, quote.clientId, setCurrentQuote]);

  const isQuoteFrozen = useMemo(() => {
    if (!quote.status || quote.status === 'Brouillon') return false;
    if (quote.status !== 'Validé') return false; // Orders etc might be handled differently, but Validé is the target here
    const validityDays = Number(quoteSettings?.validityDays || 30);
    if (!quote.validatedAt) return false;
    const diff = new Date() - new Date(quote.validatedAt);
    return diff <= (validityDays * 24 * 60 * 60 * 1000);
  }, [quote.status, quote.validatedAt, quoteSettings]);

  // Totals
  const [showKitDetails, setShowKitDetails] = useState(false);
  
  const totals = useMemo(() => {
    let ht = 0;
    let profiles = 0;
    let accessories = 0;
    let glass = 0;
    let shutters = 0;

    (quote.items || []).forEach(item => {
      let currentPriceHT = item.unitPriceHT || 0;
      let pd = item.priceData;

      const shouldLiveRecalculate = !isQuoteFrozen;

          try {
            const tempConfig = { ...item.config, margin: quote.globalMargin ?? quoteSettings?.globalMargin ?? 2.2 };
            const livePd = engine.calculatePrice(tempConfig);
            if (livePd) {
              pd = livePd;
              if (livePd.priceHT) currentPriceHT = livePd.priceHT;
            }
          } catch(e) {
            console.error("Error recalulating item price:", e);
          }


      ht += currentPriceHT * (item.qty || 1);
      
      // Aggregate category costs for the whole quote using the effective price data
      try {
        if (!pd || !pd.bom) return;
        const itemQty = Number(item.qty) || 1;
        profiles += (pd.bom.profiles?.reduce((s, p) => s + (Number(p.cost) || 0), 0) || 0) * itemQty;
        accessories += ((pd.bom.accessories?.reduce((s, a) => s + (Number(a.cost) || 0), 0) || 0) + (pd.bom.gasket?.cost || 0)) * itemQty;
        glass += (Number(pd.bom.glass?.cost) || 0) * itemQty;
        shutters += (pd.bom.shutters?.reduce((s, sh) => s + (Number(sh.cost) || 0), 0) || 0) * itemQty;
      } catch (e) {
        console.error("Error calculating subtotals for item:", item.id, e);
      }
    });

    const rawHT = ht;
    const discountType = quote.discountType || 'percent';
    const discountValue = Number(quote.discountValue || 0);
    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = rawHT * (discountValue / 100);
    } else {
      discountAmount = Math.min(rawHT, discountValue);
    }
    const netHT = Math.max(0, rawHT - discountAmount);
    const tva = netHT * ((quoteSettings?.tvaRate ?? 19) / 100);
    return { rawHT, discountAmount, ht: netHT, tva, ttc: netHT + tva, profiles, accessories, glass, shutters };
  }, [quote.items, quote.discountType, quote.discountValue, quote.globalMargin, isQuoteFrozen, engine]);

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

  const identicalGroups = useMemo(() => {
    const groups = {};
    (quote.items || []).forEach(item => {
      const key = getCanonicalConfigKey(item.config);
      if (!key) return;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    return Object.values(groups).filter(g => g.length > 1);
  }, [quote.items]);

  const handlePairItems = (items, groupRefInput) => {
    const groupId = `group-${Date.now()}`;
    const groupRef = groupRefInput || `JUM-${Date.now().toString().slice(-4)}`;
    const itemIds = items.map(i => i.id);
    setCurrentQuote(prev => {
      const updatedItems = (prev.items || []).map(item => {
        if (itemIds.includes(item.id)) {
          return { ...item, pairedGroupId: groupId, pairedGroupRef: groupRef };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleUnpairItems = (groupId) => {
    setCurrentQuote(prev => {
      const updatedItems = (prev.items || []).map(item => {
        if (item.pairedGroupId === groupId) {
          return { ...item, pairedGroupId: null, pairedGroupRef: null };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleUpdateGroupRef = (groupId, newRef) => {
    setCurrentQuote(prev => {
      const updatedItems = (prev.items || []).map(item => {
        if (item.pairedGroupId === groupId) {
          return { ...item, pairedGroupRef: newRef };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const startNewProduct = () => {
    const firstComp = database.compositions?.[0];
    setDraftConfig({
      ...EMPTY_CONFIG,
      compositionId: firstComp?.id || '',
      colorId: database.colors?.[0]?.id || '',
      glassId: database.glass?.[0]?.id || '',
    });
    setDraftLabel('');
    setDraftRef('');
    setDraftQty(1);
    setEditingItemId(null);
    setLocalView('configure');
  };

  const startEditProduct = (item) => {
    setDraftConfig({ ...item.config });
    setDraftLabel(item.label);
    setDraftRef(item.ref || '');
    setDraftQty(item.qty);
    setEditingItemId(item.id);
    setLocalView('configure');
  };

  const handleSaveProduct = () => {
    const tempConfig = { ...draftConfig, margin: quote.globalMargin ?? quoteSettings?.globalMargin ?? 2.2 };
    const priceData = engine.calculatePrice(tempConfig);
    const existingItem = editingItemId ? (quote.items || []).find(i => i.id === editingItemId) : null;
    const newItem = {
      id: editingItemId || `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      label: draftLabel || `Produit ${(quote.items?.length || 0) + 1}`,
      ref: draftRef || '',
      pairedGroupId: existingItem ? (existingItem.pairedGroupId || null) : null,
      pairedGroupRef: existingItem ? (existingItem.pairedGroupRef || null) : null,
      qty: draftQty || 1,
      config: JSON.parse(JSON.stringify(draftConfig)), // Snapshot config (Prices at the time)
      unitPriceHT: priceData?.priceHT || 0,
      unitPriceTTC: priceData?.priceTTC || 0,
      priceData: JSON.parse(JSON.stringify(priceData)), // Snapshot bom and prices
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
    const deepClone = JSON.parse(JSON.stringify(item));
    const copy = { ...deepClone, id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`, label: `${item.label} (copie)` };
    setCurrentQuote(prev => ({ ...prev, items: [...prev.items, copy] }));
  };

  const handleQtyChange = (id, val) => {
    const q = Math.max(1, parseInt(val) || 1);
    setCurrentQuote(prev => ({ 
      ...prev, 
      items: prev.items.map(i => {
        if (i.id === id) {
          const updated = { ...i, qty: q };
          if (updated.measurements && updated.measurements.length > 0) {
            updated.measurements = [{ ...updated.measurements[0], qty: q }];
          }
          if (updated.siteMeasurements && updated.siteMeasurements.length > 0) {
            updated.siteMeasurements = [{ ...updated.siteMeasurements[0], qty: q }];
          }
          return updated;
        }
        return i;
      }) 
    }));
  };

  const filteredBoms = consumableFilter === 'all' ? allBoms : allBoms.filter(b => b.itemId === consumableFilter);

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
        itemRef={draftRef}
        setItemRef={setDraftRef}
        qty={draftQty}
        setQty={setDraftQty}
        globalMargin={quote.globalMargin ?? quoteSettings?.globalMargin ?? 2.2}
      />
    );
  }

  const handleStatusChange = (newStatus) => {
    setCurrentQuote(prev => {
      const q = { ...prev, status: newStatus };
      if (newStatus === 'Validé') {
        q.validatedAt = new Date().toISOString();
        // Snapshot
        q.items = (q.items || []).map(item => {
          try {
            const pd = engine.calculatePrice(item.config);
            return {
              ...item,
              unitPriceHT: pd?.priceHT || item.unitPriceHT,
              unitPriceTTC: pd?.priceTTC || item.unitPriceTTC,
              priceData: JSON.parse(JSON.stringify(pd)),
              config: JSON.parse(JSON.stringify(item.config))
            };
          } catch(e) { return item; }
        });
      }
      return q;
    });
  };


  const handleSaveGlobalQuote = () => {
    if (setDatabase) {
      const finalQuote = { ...quote, totals };
      const isNewQuote = !(database?.quotes || []).some(q => q.id === finalQuote.id);

      setDatabase(prev => {
        // Update quotes list
        const existsInQuotes = (prev.quotes || []).some(q => q.id === finalQuote.id);
        const quotes = existsInQuotes 
          ? prev.quotes.map(q => q.id === finalQuote.id ? finalQuote : q)
          : [...(prev.quotes || []), finalQuote];

        // Update orders list if status is "Confirmé"
        let orders = prev.orders || [];
        if (finalQuote.status === 'Confirmé') {
          const existingOrder = orders.find(o => o.quoteId === finalQuote.id);
          let orderId = existingOrder ? existingOrder.id : null;
          
          if (!orderId) {
            const ids = orders
              .map(o => o.id)
              .filter(id => id && id.startsWith('CMD-'))
              .map(id => parseInt(id.split('-')[1], 10))
              .filter(num => !isNaN(num));
            let candidate = 1;
            while (ids.includes(candidate)) {
              candidate++;
            }
            orderId = `CMD-${String(candidate).padStart(2, '0')}`;
          }

          const existsInOrders = orders.some(o => o.id === orderId);
          if (!existsInOrders) {
            orders = [...orders, { ...finalQuote, id: orderId, quoteId: finalQuote.id, batches: [], createdAt: new Date().toISOString() }];
          } else {
            // Update order info but preserve existing batches and site measurements
            orders = orders.map(o => o.id === orderId ? { ...o, ...finalQuote, id: orderId, quoteId: finalQuote.id, batches: o.batches || [] } : o);
          }
        }

        const updatedIds = orders
          .map(o => o.id)
          .filter(id => id && id.startsWith('CMD-'))
          .map(id => parseInt(id.split('-')[1], 10))
          .filter(num => !isNaN(num));
        let nextOrderCounter = 1;
        while (updatedIds.includes(nextOrderCounter)) {
          nextOrderCounter++;
        }

        return { ...prev, quotes, orders, orderCounter: nextOrderCounter };
      });

      if (isNewQuote && setQuoteSettings) {
        setQuoteSettings(prevSettings => ({
          ...prevSettings,
          quoteCounter: (prevSettings.quoteCounter || 1) + 1
        }));
      }

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
        const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
        const maxW = 60;
        const maxH = 25;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
      } catch (e) {
        try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 60, 25, '', 'FAST'); } catch(e2) {}
      }
    }
    
    // Top Right: Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('DEVIS ESTIMATIF', pw - 15, y + 15, { align: 'right' });
    
    // Gauche: Devis number and date
    y += 35;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const quoteYear = new Date(quote.createdAt || Date.now()).getFullYear().toString().slice(-2);
    doc.text(`Devis N° : ${quote.number} / ${quoteYear}`, 15, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 15, y + 5);
    
    y += 8;
    
    const boxY = y;
    const boxWidth = (pw - 35) / 2; // 15 margin L/R, 5 gap = 35
    
    // Company box (Left)
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.roundedRect(15, boxY, boxWidth, 42, 2, 2);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(quoteSettings?.companyName || 'Mon Entreprise', 18, boxY + 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cy = boxY + 11;
    if (quoteSettings?.companyAddress) {
      const addressLines = doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6);
      doc.text(addressLines, 18, cy);
      cy += addressLines.length * 4;
    }
    const phone = quoteSettings?.companyPhone || '';
    const email = quoteSettings?.companyEmail || '';
    if (phone || email) {
      doc.text(`${phone} ${email ? ' - ' + email : ''}`, 18, cy);
      cy += 5;
    }
    doc.setTextColor(80, 80, 80);
    if (quoteSettings?.companyRC) { doc.text(`RC N°: ${quoteSettings.companyRC}`, 18, cy); cy += 4; }
    if (quoteSettings?.companyIMP) { doc.text(`AI N°: ${quoteSettings.companyIMP}`, 18, cy); cy += 4; }
    if (quoteSettings?.companyMF) { doc.text(`NIF N°: ${quoteSettings.companyMF}`, 18, cy); cy += 4; }
    doc.setTextColor(0, 0, 0);

    // Client box (Right)
    const currentClient = database.clients?.find(c => c.id === quote.clientId);
    const rightBoxXHeader = 15 + boxWidth + 5;
    doc.roundedRect(rightBoxXHeader, boxY, boxWidth, 42, 2, 2);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Destinataire :', rightBoxXHeader + 3, boxY + 6);
    doc.setFontSize(10);
    doc.text(currentClient?.nom || 'Client', rightBoxXHeader + 3, boxY + 11);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cly = boxY + 16;
    if (currentClient?.adresse) {
      const addrLines = doc.splitTextToSize(currentClient.adresse, boxWidth - 6);
      doc.text(addrLines, rightBoxXHeader + 3, cly);
      cly += addrLines.length * 4;
    }
    if (currentClient?.telephone) {
      doc.text(`Tél : ${currentClient.telephone}`, rightBoxXHeader + 3, cly);
      cly += 4;
    }
    if (currentClient?.email) {
      doc.text(`Email : ${currentClient.email}`, rightBoxXHeader + 3, cly);
      cly += 5;
    }
    doc.setTextColor(80, 80, 80);
    if (currentClient?.rc) { doc.text(`RC : ${currentClient.rc}`, rightBoxXHeader + 3, cly); cly += 4; }
    if (currentClient?.nif) { doc.text(`NIF : ${currentClient.nif}`, rightBoxXHeader + 3, cly); cly += 4; }
    if (currentClient?.nis) { doc.text(`NIS : ${currentClient.nis}`, rightBoxXHeader + 3, cly); cly += 4; }
    if (currentClient?.ai) { doc.text(`AI : ${currentClient.ai}`, rightBoxXHeader + 3, cly); cly += 4; }
    doc.setTextColor(0, 0, 0);

    y = boxY + 48;

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
      // Helper to calculate the effective price including the margin if in draft/brouillon state
      const getEffectivePriceHT = (itm) => {
        let effectivePriceHT = itm.unitPriceHT || 0;
        const shouldLiveRecalculate = !isQuoteFrozen;
        if (shouldLiveRecalculate) {
          try {
            const tempConfig = { ...itm.config, margin: quote.globalMargin ?? quoteSettings?.globalMargin ?? 2.2 };
            const pd = engine.calculatePrice(tempConfig);
            if (pd && pd.priceHT) effectivePriceHT = pd.priceHT;
          } catch(e) {}
        }
        return effectivePriceHT;
      };

      // Group items before rendering
      const pdfItems = [];
      const groupsMap = {};
      
      quote.items.forEach(item => {
        const effPrice = getEffectivePriceHT(item);
        if (item.pairedGroupId) {
          if (!groupsMap[item.pairedGroupId]) {
             groupsMap[item.pairedGroupId] = {
                isGroup: true,
                id: item.pairedGroupId,
                label: item.pairedGroupRef || 'Ensemble',
                qty: 0,
                unitPriceHT: effPrice,
                config: item.config || {},
                originalItems: []
             };
             pdfItems.push(groupsMap[item.pairedGroupId]);
          }
          groupsMap[item.pairedGroupId].originalItems.push(item);
          groupsMap[item.pairedGroupId].qty += item.qty;
        } else {
          pdfItems.push({
            ...item,
            unitPriceHT: effPrice
          });
        }
      });

      pdfItems.forEach((item, idx) => {
        // Build description lines dynamically
        const cfg = item.config || {};
        let comp = database.compositions?.find(c => c.id === cfg.compositionId);
        let openingComp = null;
        const descLines = [];
        
        // Désignation
        descLines.push(`Désignation : ${item.label || '—'}`);
        
          // Système / Modèle
          const isCompound = cfg.compoundType && cfg.compoundType !== 'none' && cfg.compoundConfig?.parts?.length > 0;
        if (isCompound) {
          const openingPart = cfg.compoundConfig.parts.find(p => p.type === 'opening');
          const fixParts = cfg.compoundConfig.parts.filter(p => p.type === 'fixe');
          openingComp = database.compositions?.find(c => c.id === openingPart?.compositionId);
          
          let fixLabel = '';
          if (fixParts.length > 0) {
            const fixComps = [...new Set(fixParts.map(p => {
              const c = database.compositions?.find(comp => comp.id === p.compositionId);
              return c ? c.name : 'Fixe';
            }))];
            fixLabel = ` + Fix ${fixComps.length > 0 ? '(' + fixComps.join(', ') + ')' : ''} (×${fixParts.length})`;
          }
          
          descLines.push(`Système : ${openingComp?.name || comp?.name || '—'}${fixLabel}`);
        } else {
          descLines.push(`Système : ${comp?.name || '—'}`);
        }

        const color = database.colors?.find(c => c.id === cfg.colorId);
        const glass = database.glass?.find(g => g.id === cfg.glassId);
        const sc = database.shutterComponents;

        // Couleur & Dimensions
        descLines.push(`Couleur : ${color?.name || cfg.colorId || '—'}`);
        descLines.push(`Dimensions : ${cfg.L} x ${cfg.H} mm`);

        // Vitrage
        if (isCompound) {
          const openingPart = cfg.compoundConfig.parts.find(p => p.type === 'opening');
          const fixParts = cfg.compoundConfig.parts.filter(p => p.type === 'fixe');
          
          const openingGlass = database.glass?.find(g => g.id === (openingPart?.glassId || cfg.glassId)) || glass;
          if (openingGlass) {
            descLines.push(`Vitrage : ${openingGlass.name} (${openingGlass.thickness || ''}mm)`);
          }
          
          if (fixParts.length > 0) {
            const fixGlassStrs = fixParts.map(p => {
               const fg = database.glass?.find(g => g.id === (p.glassId || cfg.glassId)) || glass;
               return fg ? `${fg.name} (${fg.thickness || ''}mm)` : '';
            }).filter(Boolean);
            const uniqueFixGlasses = [...new Set(fixGlassStrs)];
            if (uniqueFixGlasses.length > 0) {
               descLines.push(`Vitrage (Fixe) : ${uniqueFixGlasses.join(', ')}`);
            }
          }
        } else {
          if (glass) {
            descLines.push(`Vitrage : ${glass.name} (${glass.thickness || ''}mm)`);
          }
        }

        // Couvre-joint
        const cjSides = [];
        if (cfg.optionalSides?.top) cjSides.push('Haut');
        if (cfg.optionalSides?.bottom) cjSides.push('Bas');
        if (cfg.optionalSides?.left) cjSides.push('Gauche');
        if (cfg.optionalSides?.right) cjSides.push('Droite');
        
        if (cjSides.length > 0) {
          descLines.push(`Couvre-Joint : ${cjSides.join(', ')}`);
        } else {
          descLines.push(`Couvre-Joint : Non`);
        }

        // Options sélectionnées
        if (cfg.selectedOptions?.length > 0) {
          const optNames = cfg.selectedOptions.map(oId => {
            const opt = (database.options || []).find(o => o.id === oId);
            return opt?.name || oId;
          }).join(', ');
          descLines.push(`Options : ${optNames}`);
        }

        // Options manuelles du produit
        if (item.manualOptions?.length > 0) {
          descLines.push(`Options du produit :`);
          item.manualOptions.forEach(opt => {
            descLines.push(`  • ${opt.text}`);
          });
        }

        // Options manuelles du devis
        if (quote.manualOptions?.length > 0) {
          descLines.push(`Options supplémentaires :`);
          quote.manualOptions.forEach(opt => {
            descLines.push(`  • ${opt.text}`);
          });
        }

        // Volet roulant
        if (cfg.hasShutter && sc) {
          const caisson = sc.caissons?.find(c => c.id === (cfg.shutterConfig?.caissonId));
          const glissiere = sc.glissieres?.find(g => g.id === (cfg.shutterConfig?.glissiereId));
          const lame = sc.lames?.find(l => l.id === (cfg.shutterConfig?.lameId));
          const kit = sc.kits?.find(k => k.id === (cfg.shutterConfig?.kitId));
          const axe = sc.axes?.find(a => a.id === (cfg.shutterConfig?.axeId));
          const moteur = sc.moteurs?.find(m => m.id === (cfg.shutterConfig?.moteurId));
          const extra = sc.extras?.find(e => e.id === (cfg.shutterConfig?.extraId));

          const area = ((cfg.L || 0) * (cfg.H || 0)) / 1000000;
          const weightPerM2 = parseFloat(lame?.weightPerM2) || 0;
          const lameWidth = parseFloat(lame?.lameWidth) || 0;
          const apronItem = item.priceData?.bom?.shutters?.find(sh => sh.itemKey === 'lameId');
          const totalWeight = apronItem?.totalWeight || (area * weightPerM2);
          const caissonSize = parseFloat(caisson?.size) || 0;
          const axeDiameter = parseFloat(axe?.diameter) || 0;
          const liftingWeight = totalWeight;
          const scope = { L: cfg.L || 0, H: cfg.H || 0, area, totalWeight, liftingWeight, axeDiameter, lameWidth, caissonSize };

          const isDoubleStr = cfg.shutterConfig?.isDoubleShutter ? ' (Double)' : '';
          const isDouble = cfg.shutterConfig?.isDoubleShutter;
          const doubleSuffix = isDouble ? ' (x2)' : '';
          descLines.push(`Volet Roulant${isDoubleStr} :`);
          if (caisson) descLines.push(`  Caisson : ${caisson.name}${doubleSuffix}`);
          if (glissiere) descLines.push(`  Glissière : ${glissiere.name}`);
          
          const processAlerts = (item) => {
            if (!item) return;
            if (item.technicalAlert && item.technicalAlert.trim() !== '') {
              try {
                const alertMsg = engine.evaluate(item.technicalAlert, scope);
                if (alertMsg && String(alertMsg).trim() !== '' && alertMsg !== true && alertMsg !== false) {
                  descLines.push(`[ALERTE TECHNIQUE] : ${String(alertMsg)}`);
                }
              } catch (e) {
                console.warn("[PDF Alert] Eval error:", e.message);
              }
            }
            // Add-ons alerts
            (item.addOns || []).forEach(addon => {
              if (addon.technicalAlert && addon.technicalAlert.trim() !== '') {
                try {
                  const alertMsg = engine.evaluate(addon.technicalAlert, scope);
                  if (alertMsg && String(alertMsg).trim() !== '' && alertMsg !== true && alertMsg !== false) {
                    descLines.push(`[ALERTE TECHNIQUE] : ${String(alertMsg)}`);
                  }
                } catch (e) {
                  console.warn("[PDF Addon Alert] Eval error:", e.message);
                }
              }
            });
          };

          if (lame) {
            descLines.push(`  Lame : ${lame.name} (Poids: ${totalWeight.toFixed(2)} kg)`);
            processAlerts(lame);
          }
          if (axe) {
            descLines.push(`  Axe : ${axe.name}${doubleSuffix}`);
            processAlerts(axe);
          }
          if (moteur) {
            const motorCount = isDouble ? (cfg.shutterConfig?.motorCount || 2) : 1;
            const motorSuffix = motorCount > 1 ? ` (x${motorCount})` : '';
            descLines.push(`  Moteur : ${moteur.name}${motorSuffix}`);
            processAlerts(moteur);
          }
          if (extra) {
            descLines.push(`  Option : ${extra.name}`);
            processAlerts(extra);
          }
          if (kit) {
            descLines.push(`  Kit : ${kit.name}`);
            processAlerts(kit);
          }
        }

        // Calculate total lines after wrapping to get accurate row height
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let totalWrappedLines = 0;
        descLines.forEach(line => {
           if (line.startsWith('[ALERTE TECHNIQUE]')) {
              doc.setFont('helvetica', 'bold');
              totalWrappedLines += doc.splitTextToSize(line, 60).length;
              doc.setFont('helvetica', 'normal');
           } else {
              const isBoldLabel = line === 'Volet Roulant :' || line === 'Volet Roulant (Double) :' || line === 'Options supplémentaires :' || line === 'Options du produit :';
              if (isBoldLabel) doc.setFont('helvetica', 'bold');
              totalWrappedLines += doc.splitTextToSize(line, 60).length;
              doc.setFont('helvetica', 'normal');
           }
        });

        // Dynamic row height (5pt per line + padding)
        const lineHeight = 5;
        const padding = 8;
        const rowHeight = Math.max(50, totalWrappedLines * lineHeight + padding * 2); // Min 50 for larger image

        // Check page break BEFORE drawing the row
        if (y + rowHeight > 280) {
          doc.addPage();
          y = 20;
        }

        // Draw row border
        doc.rect(15, y, pw - 30, rowHeight);

        // Image
        let imgData = null;
        try {
          // 1. Try to generate technical drawing
          imgData = getTechnicalDrawingDataURL(cfg, database);
        } catch(e) {
          console.error('Drawing generation error:', e);
        }
        
        // 2. Fallback to saved thumbnail or composition image
        if (!imgData) {
          imgData = item.config?.thumbnail || openingComp?.image || comp?.image;
        }

        if (imgData) {
          try {
            let format = 'JPEG';
            if (imgData.includes('png') || imgData.startsWith('data:image/png')) format = 'PNG';
            else if (imgData.includes('webp') || imgData.startsWith('data:image/webp')) format = 'WEBP';
            // Increased image size to 45x45
            doc.addImage(imgData, format, 17, y + 2.5, 45, 45, '', 'FAST');
          } catch(e) {
            console.error('PDF Image Error:', e);
            doc.setDrawColor(226, 232, 240);
            doc.rect(17, y + 2.5, 45, 45);
          }
        } else {
          doc.setDrawColor(226, 232, 240);
          doc.rect(17, y + 2.5, 45, 45);
        }

        // Description
        const descX = 70; // Moved right to accommodate larger image
        let descY = y + padding;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        descLines.forEach(line => {
          if (line.startsWith('[ALERTE TECHNIQUE]')) {
            doc.setTextColor(234, 88, 12); // Orange #ea580c
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            const lines = doc.splitTextToSize(line, 60); // Wrap if too long
            lines.forEach((l, i) => {
              doc.text(l, descX, descY);
              if (i < lines.length - 1) descY += lineHeight;
            });
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
          } else {
            const isBoldLabel = line === 'Volet Roulant :' || line === 'Volet Roulant (Double) :' || line === 'Options supplémentaires :' || line === 'Options du produit :';
            const isVoletSubItem = line.startsWith('  Caisson') || line.startsWith('  Glissière') || line.startsWith('  Lame') || line.startsWith('  Axe') || line.startsWith('  Moteur') || line.startsWith('  Kit') || line.startsWith('  Option') || line.startsWith('  •');
            
            if (isBoldLabel) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8);
            } else if (isVoletSubItem) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
            }
            const lines = doc.splitTextToSize(line, 60); // Wrap if too long
            lines.forEach((l, i) => {
              doc.text(l, descX, descY);
              if (i < lines.length - 1) descY += lineHeight;
            });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
          }
          descY += lineHeight;
        });

        // QTY & Prices
        const priceU = formatPrice(item.unitPriceHT);
        const totalLine = formatPrice((item.unitPriceHT || 0) * item.qty);
        const midY = y + rowHeight / 2;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.qty}`, 133, midY, { align: 'right' });
        doc.text(`${priceU} DZD`, 165, midY, { align: 'right' });
        doc.text(`${totalLine} DZD`, pw - 17, midY, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        y += rowHeight;

      });
      
      // Total QTE Box at the end of the table
      const totalQte = pdfItems.reduce((sum, item) => sum + item.qty, 0);
      
      // Page break check for total box
      if (y + 10 > 280) {
        doc.addPage();
        y = 20;
      }
      
      // Draw border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(125, y, 20, 8); // Box strictly under QTE column
      
      // Text
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${totalQte}`, 143, y + 5.5, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`T. QTE : `, 123, y + 5.5, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      
      y += 15;
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

    // Right Box: Totals (simplified - total only)
    const rightBoxX = 110;
    const discountAmount = totals.discountAmount || 0;
    const hasDiscount = discountAmount > 0;
    const boxHeight = hasDiscount ? 30 : 22;
    doc.roundedRect(rightBoxX, y, pw - 15 - rightBoxX, boxHeight, 3, 3);
    const tvaRate = quoteSettings?.tvaRate ?? 19;
    
    if (hasDiscount) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL BRUT HT', rightBoxX + 5, y + 7);
      doc.text(`${formatPrice(totals.rawHT)} DZD`, pw - 20, y + 7, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 38, 38);
      const discLabel = quote.discountType === 'percent' ? `REMISE COMMERCIAL (${quote.discountValue}%)` : 'REMISE EXCEPTIONNELLE (FIXE)';
      doc.text(discLabel, rightBoxX + 5, y + 13);
      doc.text(`-${formatPrice(totals.discountAmount)} DZD`, pw - 20, y + 13, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL NET HT', rightBoxX + 5, y + 19);
      doc.text(`${formatPrice(totals.ht)} DZD`, pw - 20, y + 19, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.text(`TVA ${tvaRate}% :`, rightBoxX + 5, y + 25);
      doc.text(`${formatPrice(totals.tva)} DZD`, pw - 20, y + 25, { align: 'right' });
    } else {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text('MONTANT TOTAL HT', rightBoxX + 5, y + 9);
      doc.text(`${formatPrice(totals.ht)} DZD`, pw - 20, y + 9, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`TVA ${tvaRate}% :`, rightBoxX + 5, y + 16);
      doc.text(`${formatPrice(totals.tva)} DZD`, pw - 20, y + 16, { align: 'right' });
    }

    y += boxHeight + 15;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`NET À PAYER TTC : ${formatPrice(totals.ttc)} DZD`, pw - 15, y, { align: 'right' });

    y += 15;
    
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
    const totalAmountText = `Arrêté le présent devis à la somme de : ${numberToFrenchWords(totals.ttc)}.`;
    const totalAmountLines = doc.splitTextToSize(totalAmountText, pw - 30);
    doc.text(totalAmountLines, 15, y);
    
    y += totalAmountLines.length * 5 + 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Validité de l'offre : ${(quoteSettings?.validityDays || 30)} jours`, 15, y);

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
      <header className="flex-header">
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Devis Commercial</h1>
          <p style={{ color: '#64748b' }}>Gérez vos produits et générez vos devis professionnels.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem' }}>
            <Settings size={16} /> Paramètres
          </button>
          <button onClick={onNewQuote} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem' }}>
            📄 Nouveau Devis
          </button>
          {!isQuoteFrozen && (
            <button onClick={startNewProduct} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.5rem', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
              <Plus size={16} /> Ajouter un produit
            </button>
          )}
        </div>
      </header>

      {isQuoteFrozen && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          <Info size={18} /> Ce devis est figé (Validé le {new Date(quote.validatedAt).toLocaleDateString('fr-FR')}). Validité : {quoteSettings.validityDays || 30} j.
        </div>
      )}


      {/* Quote Header Card */}
      <div className="glass shadow-md flex-header" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', flex: 1 }}>
          {quoteSettings?.logoBase64 && <img src={quoteSettings.logoBase64} alt="logo" style={{ height: '50px', objectFit: 'contain' }} />}
          <div style={{ flex: 1, minWidth: '200px' }}>
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
          </div>
        </div>
        
        <div style={{ textAlign: 'right', minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>N° :</span>
            <input 
              value={quote.number || ''} 
              onChange={e => setCurrentQuote(p => ({ ...p, number: e.target.value }))}
              style={{ 
                fontWeight: 800, fontSize: '1.3rem', color: '#2563eb', border: 'none', 
                background: 'rgba(37, 99, 235, 0.05)', textAlign: 'right', width: '150px',
                padding: '0.2rem 0.5rem', borderRadius: '0.4rem', outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Statut :</span>
            <select 
              value={quote.status || 'Brouillon'} 
              onChange={e => handleStatusChange(e.target.value)}
              style={{
                padding: '0.2rem', borderRadius: '0.3rem', border: 'none', background: quote.status === 'Brouillon' || !quote.status ? '#fef3c7' : '#dcfce3', color: quote.status === 'Brouillon' || !quote.status ? '#d97706' : '#16a34a', fontSize: '0.8rem', fontWeight: 700, outline: 'none'
              }}
            >
              <option value="Brouillon">Brouillon</option>
              <option value="Validé">Validé</option>
              <option value="Envoyé">Envoyé</option>
              <option value="Confirmé">Confirmé</option>
            </select>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <Calendar size={12} /> {new Date(quote.createdAt || Date.now()).toLocaleDateString('fr-FR')}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <span style={{ fontWeight: 600 }}>Client :</span>
            <SearchableDropdown 
              compact
              value={quote.clientId}
              onChange={val => setCurrentQuote(p => ({ ...p, clientId: val }))}
              options={(database.clients || []).map(c => ({ value: c.id, label: c.nom }))}
              placeholder="Client..."
            />
          </div>
          {quote.clientId && (
            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
              <span style={{ fontWeight: 600 }}>Plan de Chantier :</span>
              <SearchableDropdown 
                compact
                value={quote.sitePlanId || ''}
                onChange={val => setCurrentQuote(p => ({ ...p, sitePlanId: val }))}
                options={[
                  { value: '', label: 'Aucun (Non assigné)' },
                  ...(database.clients?.find(c => c.id === quote.clientId)?.sitePlans || []).map(p => ({ value: p.id, label: p.name || 'Plan sans nom' }))
                ]}
                placeholder="Sélectionnez un plan..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {[
          { id: 'quote', label: '📋 Lignes du Devis', count: quote.items?.length || 0 },
          { id: 'jumelage', label: '🔗 Jumelage des produits', count: identicalGroups.length || null },
          { id: 'consumables', label: '🔩 Consommables (Interne)', count: null },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveListTab(tab.id)}
            className={`tab-button ${activeListTab === tab.id ? 'active' : ''}`}>
            {tab.label}
            {tab.count !== null && <span style={{ background: '#e2e8f0', borderRadius: '999px', padding: '0 0.5rem', fontSize: '0.72rem', marginLeft: '0.4rem' }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Quote Lines */}
      {activeListTab === 'quote' && (
        <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '0.5rem' }}>
           <button onClick={() => setShowKitDetails(!showKitDetails)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '0.4rem', border: '1px solid #e2e8f0', background: showKitDetails ? '#eff6ff' : 'white', color: showKitDetails ? '#2563eb' : '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
             {showKitDetails ? <Layers size={14} /> : <Package size={14} />}
             {showKitDetails ? 'Masquer Détails Kits' : 'Afficher Détails Kits'}
           </button>
        </div>

        <div>
          {quote.items?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
              <Package size={48} style={{ margin: '0 auto 1rem' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Aucun produit dans ce devis</p>
              <p>Cliquez sur "Ajouter un produit" pour commencer.</p>
            </div>
          ) : (
            <div className="table-responsive shadow-md" style={{ marginBottom: '1.5rem' }}>
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
                  {(quote.items || []).map((item) => {
                    const comp = database.compositions?.find(c => c.id === item.config?.compositionId);
                    const color = database.colors?.find(c => c.id === item.config?.colorId);
                    let effectivePriceHT = item.unitPriceHT || 0;
                    if (!isQuoteFrozen) {
                      try {
                        const tempConfig = { ...item.config, margin: quote.globalMargin ?? quoteSettings?.globalMargin ?? 2.2 };
                        const pd = engine.calculatePrice(tempConfig);
                        if (pd && pd.priceHT) effectivePriceHT = pd.priceHT;
                      } catch(e) {}
                    }
                    const totalHT = effectivePriceHT * (item.qty || 1);
                    return (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td data-label="Désignation" style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span>{item.label}</span>
                              {(item.pairedGroupRef || item.ref) && (
                                <span style={{ padding: '0.1rem 0.3rem', background: item.pairedGroupRef ? '#e0f2fe' : '#f1f5f9', color: item.pairedGroupRef ? '#0369a1' : '#475569', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                                  {item.pairedGroupRef ? `Gr: ${item.pairedGroupRef}` : `Ref: ${item.ref}`}
                                </span>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setExpandedProductOptions(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                                }} 
                                title="Gérer les options de ce produit"
                                style={{ 
                                  display: 'inline-flex', alignItems: 'center', gap: '0.2rem', 
                                  padding: '0.15rem 0.4rem', border: '1px solid #cbd5e1', 
                                  borderRadius: '0.25rem', background: item.manualOptions?.length ? '#f5f3ff' : 'white', 
                                  cursor: 'pointer', color: item.manualOptions?.length ? '#7c3aed' : '#64748b', 
                                  fontSize: '0.65rem', fontWeight: 700, outline: 'none'
                                }}
                              >
                                <span>+</span> Option{(item.manualOptions || []).length > 0 && ` (${(item.manualOptions || []).length})`}
                              </button>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{comp?.name}</div>
                          </td>
                          <td data-label="Modèle / Dim." style={{ fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 700, color: '#2563eb' }}>{item.config?.L} × {item.config?.H}</span>{' '}mm
                          </td>
                          <td data-label="Finition" style={{ fontSize: '0.85rem' }}>{color?.name || item.config?.colorId}</td>
                          <td data-label="Qté">
                            <input type="number" min="1" value={item.qty}
                              disabled={isQuoteFrozen}
                              onChange={e => handleQtyChange(item.id, e.target.value)}
                              style={{ width: '60px', padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.4rem', textAlign: 'center', fontWeight: 700, background: isQuoteFrozen ? '#f1f5f9' : 'white' }} />
                          </td>

                          <td data-label="Prix U. HT" style={{ fontWeight: 600 }}>{effectivePriceHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                          <td data-label="Total HT" style={{ fontWeight: 700, color: '#2563eb' }}>{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                          <td data-label="Actions">
                            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                              <button onClick={() => setInfoPopupItem(item)} title="Détails" style={{ padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', color: '#3b82f6' }}><Info size={14} /></button>
                              <button onClick={() => startEditProduct(item)} title={isQuoteFrozen ? "Voir (Lecture seule)" : "Modifier"} style={{ padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', color: '#2563eb' }}>{isQuoteFrozen ? <FileText size={14} /> : <Edit2 size={14} />}</button>
                              {!isQuoteFrozen && (
                                <>
                                  <button onClick={() => handleDuplicateItem(item)} title="Dupliquer" style={{ padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', color: '#10b981' }}><Copy size={14} /></button>
                                  <button onClick={() => handleDeleteItem(item.id)} title="Supprimer" style={{ padding: '0.3rem', border: '1px solid #fee2e2', borderRadius: '0.3rem', background: '#fef2f2', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {showKitDetails && item.priceData?.bom?.shutters?.length > 0 && (
                          <tr>
                            <td colSpan="7" style={{ padding: '0', background: '#f8fafc' }}>
                               <div style={{ padding: '0.75rem 1.5rem', borderLeft: '4px solid #2563eb', margin: '0.5rem 0' }}>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Détail des composants du volet</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', fontSize: '0.75rem' }}>
                                     {item.priceData.bom.shutters.map((s, idx) => (
                                        <React.Fragment key={idx}>
                                           <div style={{ color: '#1e293b' }}>• {s.name}</div>
                                           <div style={{ color: '#64748b' }}>{s.qty} {s.priceUnit || 'u'}</div>
                                           <div style={{ fontWeight: 600, textAlign: 'right' }}>{(s.cost * (item.qty || 1)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</div>
                                        </React.Fragment>
                                     ))}
                                  </div>
                               </div>
                            </td>
                          </tr>
                        )}
                        {expandedProductOptions[item.id] && (
                          <tr>
                            <td colSpan="7" style={{ padding: '0', background: '#fcfaff' }}>
                              <div style={{ padding: '1rem 1.5rem', borderLeft: '4px solid #8b5cf6', margin: '0.5rem 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.9rem' }}>✏️</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Options Manuelles pour ce Produit</span>
                                  </div>
                                  <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700 }}>
                                    {(item.manualOptions || []).length} option{(item.manualOptions || []).length !== 1 ? 's' : ''}
                                  </span>
                                </div>

                                {/* Existing product manual options list */}
                                {(item.manualOptions || []).length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                    {(item.manualOptions || []).map((opt, oIdx) => (
                                      <div key={opt.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        padding: '0.4rem 0.6rem', background: '#faf5ff', borderRadius: '0.35rem',
                                        border: '1px solid #e9d5ff'
                                      }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#a78bfa', minWidth: '15px' }}>#{oIdx + 1}</span>
                                        {editingProductOptionId === opt.id ? (
                                          <input
                                            autoFocus
                                            className="input"
                                            value={editingProductOptionText}
                                            onChange={e => setEditingProductOptionText(e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter' && editingProductOptionText.trim()) {
                                                setCurrentQuote(prev => ({
                                                  ...prev,
                                                  items: (prev.items || []).map(it => it.id === item.id ? {
                                                    ...it,
                                                    manualOptions: (it.manualOptions || []).map(o => o.id === opt.id ? { ...o, text: editingProductOptionText.trim() } : o)
                                                  } : it)
                                                }));
                                                setEditingProductOptionId(null);
                                                setEditingProductOptionText('');
                                              }
                                              if (e.key === 'Escape') { setEditingProductOptionId(null); setEditingProductOptionText(''); }
                                            }}
                                            onBlur={() => {
                                              if (editingProductOptionText.trim()) {
                                                setCurrentQuote(prev => ({
                                                  ...prev,
                                                  items: (prev.items || []).map(it => it.id === item.id ? {
                                                    ...it,
                                                    manualOptions: (it.manualOptions || []).map(o => o.id === opt.id ? { ...o, text: editingProductOptionText.trim() } : o)
                                                  } : it)
                                                }));
                                              }
                                              setEditingProductOptionId(null);
                                              setEditingProductOptionText('');
                                            }}
                                            style={{ flex: 1, fontSize: '0.8rem', padding: '0.25rem 0.5rem', height: 'auto', minHeight: 'unset', borderColor: '#8b5cf6' }}
                                          />
                                        ) : (
                                          <span style={{ flex: 1, fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{opt.text}</span>
                                        )}
                                        {!isQuoteFrozen && (
                                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                                            <button
                                              onClick={() => { setEditingProductOptionId(opt.id); setEditingProductOptionText(opt.text); }}
                                              title="Modifier"
                                              style={{ padding: '0.2rem', border: '1px solid #e9d5ff', borderRadius: '0.25rem', background: 'white', cursor: 'pointer', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                              <Edit2 size={11} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setCurrentQuote(prev => ({
                                                  ...prev,
                                                  items: (prev.items || []).map(it => it.id === item.id ? {
                                                    ...it,
                                                    manualOptions: (it.manualOptions || []).filter(o => o.id !== opt.id)
                                                  } : it)
                                                }));
                                              }}
                                              title="Supprimer"
                                              style={{ padding: '0.2rem', border: '1px solid #fecaca', borderRadius: '0.25rem', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Add new product manual option */}
                                {!isQuoteFrozen && (
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <input
                                      className="input"
                                      placeholder="Ajouter une option manuelle pour ce produit..."
                                      value={productOptionInputs[item.id] || ''}
                                      onChange={e => setProductOptionInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      onKeyDown={e => {
                                        const optText = productOptionInputs[item.id] || '';
                                        if (e.key === 'Enter' && optText.trim()) {
                                          setCurrentQuote(prev => ({
                                            ...prev,
                                            items: (prev.items || []).map(it => it.id === item.id ? {
                                              ...it,
                                              manualOptions: [...(it.manualOptions || []), { id: `PROPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`, text: optText.trim() }]
                                            } : it)
                                          }));
                                          setProductOptionInputs(prev => ({ ...prev, [item.id]: '' }));
                                        }
                                      }}
                                      style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.75rem', height: 'auto', minHeight: 'unset' }}
                                    />
                                    <button
                                      onClick={() => {
                                        const optText = productOptionInputs[item.id] || '';
                                        if (optText.trim()) {
                                          setCurrentQuote(prev => ({
                                            ...prev,
                                            items: (prev.items || []).map(it => it.id === item.id ? {
                                              ...it,
                                              manualOptions: [...(it.manualOptions || []), { id: `PROPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`, text: optText.trim() }]
                                            } : it)
                                          }));
                                          setProductOptionInputs(prev => ({ ...prev, [item.id]: '' }));
                                        }
                                      }}
                                      disabled={!(productOptionInputs[item.id] || '').trim()}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                                        padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.35rem',
                                        background: (productOptionInputs[item.id] || '').trim() ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : '#e2e8f0',
                                        color: (productOptionInputs[item.id] || '').trim() ? 'white' : '#94a3b8',
                                        cursor: (productOptionInputs[item.id] || '').trim() ? 'pointer' : 'not-allowed',
                                        fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <Plus size={13} /> Ajouter
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Manual Options Section */}
          {!isQuoteFrozen && (
            <div className="glass shadow-md" style={{ marginTop: '1.5rem', padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', width: '32px', height: '32px', borderRadius: '8px', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem' }}>✏️</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Options Manuelles</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Ajoutez des options personnalisées qui apparaîtront sur le devis PDF.</p>
                  </div>
                </div>
                <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                  {(quote.manualOptions || []).length} option{(quote.manualOptions || []).length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Existing manual options */}
              {(quote.manualOptions || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {(quote.manualOptions || []).map((opt, idx) => (
                    <div key={opt.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.85rem', background: '#faf5ff', borderRadius: '0.5rem',
                      border: '1px solid #e9d5ff', transition: 'all 0.2s'
                    }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa', minWidth: '20px' }}>#{idx + 1}</span>
                      {editingOptionId === opt.id ? (
                        <input
                          autoFocus
                          className="input"
                          value={editingOptionText}
                          onChange={e => setEditingOptionText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editingOptionText.trim()) {
                              setCurrentQuote(prev => ({
                                ...prev,
                                manualOptions: (prev.manualOptions || []).map(o => o.id === opt.id ? { ...o, text: editingOptionText.trim() } : o)
                              }));
                              setEditingOptionId(null);
                              setEditingOptionText('');
                            }
                            if (e.key === 'Escape') { setEditingOptionId(null); setEditingOptionText(''); }
                          }}
                          onBlur={() => {
                            if (editingOptionText.trim()) {
                              setCurrentQuote(prev => ({
                                ...prev,
                                manualOptions: (prev.manualOptions || []).map(o => o.id === opt.id ? { ...o, text: editingOptionText.trim() } : o)
                              }));
                            }
                            setEditingOptionId(null);
                            setEditingOptionText('');
                          }}
                          style={{ flex: 1, fontSize: '0.85rem', padding: '0.35rem 0.6rem', borderColor: '#8b5cf6' }}
                        />
                      ) : (
                        <span style={{ flex: 1, fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>{opt.text}</span>
                      )}
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={() => { setEditingOptionId(opt.id); setEditingOptionText(opt.text); }}
                          title="Modifier"
                          style={{ padding: '0.25rem', border: '1px solid #e9d5ff', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setCurrentQuote(prev => ({
                              ...prev,
                              manualOptions: (prev.manualOptions || []).filter(o => o.id !== opt.id)
                            }));
                          }}
                          title="Supprimer"
                          style={{ padding: '0.25rem', border: '1px solid #fecaca', borderRadius: '0.3rem', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new manual option */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  placeholder="Saisissez une option manuelle (ex: Moustiquaire, Grille de ventilation, Habillage...)"
                  value={newManualOption}
                  onChange={e => setNewManualOption(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newManualOption.trim()) {
                      setCurrentQuote(prev => ({
                        ...prev,
                        manualOptions: [...(prev.manualOptions || []), { id: `OPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`, text: newManualOption.trim() }]
                      }));
                      setNewManualOption('');
                    }
                  }}
                  style={{ flex: 1, fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
                />
                <button
                  onClick={() => {
                    if (newManualOption.trim()) {
                      setCurrentQuote(prev => ({
                        ...prev,
                        manualOptions: [...(prev.manualOptions || []), { id: `OPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`, text: newManualOption.trim() }]
                      }));
                      setNewManualOption('');
                    }
                  }}
                  disabled={!newManualOption.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.55rem 1rem', border: 'none', borderRadius: '0.5rem',
                    background: newManualOption.trim() ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : '#e2e8f0',
                    color: newManualOption.trim() ? 'white' : '#94a3b8',
                    cursor: newManualOption.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 600, fontSize: '0.85rem',
                    transition: 'all 0.2s', whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={15} /> Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Display manual options in read-only mode when frozen */}
          {isQuoteFrozen && (quote.manualOptions || []).length > 0 && (
            <div className="glass shadow-md" style={{ marginTop: '1.5rem', padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1rem' }}>✏️</span>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Options Manuelles</h3>
                <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, marginLeft: 'auto' }}>
                  {quote.manualOptions.length} option{quote.manualOptions.length !== 1 ? 's' : ''}
                </span>
              </div>
              {quote.manualOptions.map((opt, idx) => (
                <div key={opt.id} style={{ padding: '0.5rem 0.85rem', background: '#faf5ff', borderRadius: '0.4rem', border: '1px solid #e9d5ff', marginBottom: '0.35rem', fontSize: '0.85rem', color: '#374151' }}>
                  <span style={{ fontWeight: 700, color: '#a78bfa', marginRight: '0.5rem' }}>#{idx + 1}</span>{opt.text}
                </div>
              ))}
            </div>
          )}

          {/* Totals — toujours visible dans l'onglet devis */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <div className="price-card shadow-lg" style={{ width: '100%', maxWidth: '380px' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Récapitulatif du Devis</div>

              <div style={{ margin: '0 0 1rem 0', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span>🔩 Total Profilés</span><span style={{ fontWeight: 600 }}>{totals.profiles.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span>⚙️ Total Accessoires</span><span style={{ fontWeight: 600 }}>{totals.accessories.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: totals.shutters > 0 ? '0.4rem' : 0 }}>
                  <span>🪟 Total Vitrage</span><span style={{ fontWeight: 600 }}>{totals.glass.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                </div>
                {totals.shutters > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>🏠 Total Volets</span><span style={{ fontWeight: 600 }}>{totals.shutters.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', opacity: 0.85 }}>
                <span>Total Brut (HT)</span><span>{totals.rawHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
              </div>

              {/* Remise / Discount Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem', background: 'rgba(255, 255, 255, 0.1)', padding: '0.5rem', borderRadius: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Remise Commerciale</span>
                  <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.2)', padding: '2px', borderRadius: '4px' }}>
                    <button 
                      onClick={() => setCurrentQuote(p => ({ ...p, discountType: 'percent', discountValue: p.discountType === 'fixed' ? 0 : p.discountValue }))}
                      style={{ fontSize: '0.65rem', border: 'none', background: (quote.discountType || 'percent') === 'percent' ? 'white' : 'transparent', color: (quote.discountType || 'percent') === 'percent' ? '#1e293b' : 'white', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      %
                    </button>
                    <button 
                      onClick={() => setCurrentQuote(p => ({ ...p, discountType: 'fixed', discountValue: p.discountType === 'percent' ? 0 : p.discountValue }))}
                      style={{ fontSize: '0.65rem', border: 'none', background: quote.discountType === 'fixed' ? 'white' : 'transparent', color: quote.discountType === 'fixed' ? '#1e293b' : 'white', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      DZD
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    min="0"
                    max={(quote.discountType || 'percent') === 'percent' ? 100 : undefined}
                    value={quote.discountValue || 0}
                    onChange={e => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setCurrentQuote(p => ({ ...p, discountValue: val }));
                    }}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '4px', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '60px', textAlign: 'right' }}>
                    -{totals.discountAmount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DZD
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', opacity: 0.85, borderBottom: '1px dashed rgba(255,255,255,0.2)', paddingBottom: '0.4rem' }}>
                <span>Total Net (HT)</span><span style={{ fontWeight: 700 }}>{totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', opacity: 0.85 }}>
                <span>Marge Globale</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input type="number" step="0.1" min="1" value={quote.globalMargin ?? quoteSettings?.globalMargin ?? 2.2}
                    disabled={isQuoteFrozen}
                    onChange={e => setCurrentQuote(prev => ({ ...prev, globalMargin: parseFloat(e.target.value) || 2.2 }))}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '4px', padding: '2px 6px', width: '60px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'right' }} />
                  <span style={{ fontSize: '0.75rem' }}>x</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', opacity: 0.85 }}>
                <span>TVA (%)</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[0, 9, 19].map(rate => (
                    <button 
                      key={rate}
                      onClick={() => setQuoteSettings(prev => ({ ...prev, tvaRate: rate }))}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.3)',
                        background: (quoteSettings?.tvaRate ?? 19) === rate ? 'white' : 'transparent',
                        color: (quoteSettings?.tvaRate ?? 19) === rate ? '#1e293b' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', opacity: 0.85 }}>
                <span>Montant TVA</span><span>{totals.tva.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.3rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <span>TOTAL TTC</span><span>{totals.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
              </div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', opacity: 0.7, textAlign: 'right' }}>
                Validité : {quoteSettings?.validityDays || 30} jours 
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem' }}>
                {!isQuoteFrozen && (
                  <button onClick={handleSaveGlobalQuote} className="btn shadow-md" style={{ flex: 1, padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none' }}>
                    <Save size={18} /> Sauvegarder
                  </button>
                )}
                <button onClick={generatePDF} className="btn btn-primary shadow-md" style={{ flex: 1, padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <FileText size={18} /> Exporter PDF
                </button>
              </div>

            </div>
          </div>
        </div>
        </>
      )}


      {/* Jumelage Tab */}
      {activeListTab === 'jumelage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', minHeight: '300px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} color="#2563eb" /> Jumelage des produits identiques
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Regroupez les menuiseries ayant des dimensions, vitrages et configurations de volet 100% identiques pour leur attribuer une référence unique sur le devis PDF.
            </p>
          </div>

          {identicalGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
              <Layers size={32} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Aucun lot de produits identiques détecté</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Ajoutez des produits avec la même configuration (dimensions, couleur, volet, vitrage, etc.) pour pouvoir les jumeler.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {identicalGroups.map((group, gIdx) => {
                const sampleItem = group[0];
                const comp = database.compositions?.find(c => c.id === sampleItem.config?.compositionId);
                const color = database.colors?.find(c => c.id === sampleItem.config?.colorId);
                const isGrouped = !!sampleItem.pairedGroupId;

                return (
                  <div key={gIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', background: isGrouped ? '#f0fdf4' : '#f8fafc', borderLeft: isGrouped ? '4px solid #10b981' : '4px solid #3b82f6', transition: 'all 0.25s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isGrouped ? '#15803d' : '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {isGrouped ? 'Menuiseries Jumelées' : 'Jumelage Disponible'}
                        </span>
                        <h4 style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                          {comp?.name} — {sampleItem.config?.L} × {sampleItem.config?.H} mm ({color?.name || sampleItem.config?.colorId})
                        </h4>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isGrouped ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Référence de groupe :</label>
                              <input 
                                type="text"
                                className="input"
                                value={sampleItem.pairedGroupRef || ''}
                                onChange={e => handleUpdateGroupRef(sampleItem.pairedGroupId, e.target.value)}
                                style={{ width: '150px', padding: '0.35rem 0.6rem', fontSize: '0.85rem', fontWeight: 700, background: 'white' }}
                              />
                            </div>
                            <button 
                              onClick={() => handleUnpairItems(sampleItem.pairedGroupId)}
                              className="btn"
                              style={{ padding: '0.35rem 0.75rem', background: '#fef2f2', color: '#ef4444', borderColor: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                              Dissocier
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handlePairItems(group)}
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none' }}
                          >
                            🔗 Jumeler les {group.length} produits
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', padding: '0.5rem 1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.25rem', marginBottom: '0.4rem', display: 'grid', gridTemplateColumns: '1fr 80px' }}>
                        <span>Désignation</span>
                        <span style={{ textAlign: 'right' }}>Quantité</span>
                      </div>
                      {group.map(item => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{item.label}</span>
                          <span style={{ textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>×{item.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
                <div className="table-responsive">
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
                              <td data-label="Ref" style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{p.id}</td>
                              <td data-label="Finit." style={{ fontSize: '0.85rem' }}>{color?.name || '—'}</td>
                              <td data-label="Nom" style={{ fontWeight: 600 }}>{p.name}</td>
                              <td data-label="L. Unit">{Math.round(p.length)} mm</td>
                              <td data-label="Qté Tot." style={{ fontWeight: 700 }}>{p.qty}</td>
                              <td data-label="Consom." style={{ color: '#8b5cf6', fontWeight: 700 }}>{(totalMl / 1000).toFixed(2)} m</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Accessories */}
              {filteredBoms.some(b => b.bom.accessories?.length > 0 || b.bom.gasket) && (
                <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b', overflowX: 'auto' }}>
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
                <div className="glass shadow-md" style={{ borderLeft: '4px solid #06b6d4', overflowX: 'auto' }}>
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

              {/* Shutter Components */}
              {filteredBoms.some(b => b.bom.shutters?.length > 0) && (
                <div className="glass shadow-md" style={{ borderLeft: '4px solid #ef4444', overflowX: 'auto' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                    Composants Volets Roulants
                  </h3>
                  <table className="data-table">
                    <thead>
                      <tr><th>Référence</th><th>Finition</th><th>Désignation</th><th>Dimensions / Détails</th><th>Quantité</th></tr>
                    </thead>
                    <tbody>
                      {filteredBoms.flatMap(({ itemId, bom }) => {
                        const item = quote.items?.find(i => i.id === itemId);
                        const color = database.colors?.find(c => c.id === item?.config?.colorId);
                        const qty = item?.qty || 1;
                        
                        return (bom.shutters || []).map((s, si) => (
                          <tr key={`${itemId}-shutter-${si}`}>
                            <td style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{s.id}</td>
                            <td style={{ fontSize: '0.85rem' }}>{color?.name || '—'}</td>
                            <td style={{ fontWeight: 600 }}>
                              {s.name}
                              {s.side && s.side !== 'both' && (
                                <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: '#fee2e2', color: '#ef4444', padding: '0.1rem 0.4rem', borderRadius: '1rem', fontWeight: 700 }}>
                                  {s.side.toUpperCase()}
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>
                              {s.length ? `${Math.round(s.length)} mm` : (s.width && s.height ? `${Math.round(s.width)}×${Math.round(s.height)}` : '—')}
                            </td>
                            <td style={{ fontWeight: 700 }}>{Math.round(s.qty * qty)}</td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Info Popup Modal */}
      {infoPopupItem && (() => {
        const popupComp = (database.compositions || []).find(c => c.id === infoPopupItem.config?.compositionId);
        const popupRange = popupComp ? (database.ranges || []).find(r => r.id === popupComp.rangeId) : null;
        let gammeDisplay = popupRange?.name || '—';

        if (infoPopupItem.config?.compoundType && infoPopupItem.config.compoundType !== 'none' && infoPopupItem.config.compoundConfig?.parts) {
           const parts = infoPopupItem.config.compoundConfig.parts;
           const ouvrantCompId = parts.find(p => p.type === 'opening')?.compositionId;
           const fixeCompId = parts.find(p => p.type === 'fixe')?.compositionId;
           
           const ouvrantComp = (database.compositions || []).find(c => c.id === ouvrantCompId);
           const fixeComp = (database.compositions || []).find(c => c.id === fixeCompId);
           
           const ouvrantRange = ouvrantComp ? (database.ranges || []).find(r => r.id === ouvrantComp.rangeId)?.name : '';
           const fixeRange = fixeComp ? (database.ranges || []).find(r => r.id === fixeComp.rangeId)?.name : '';
           
           if (ouvrantRange && fixeRange && ouvrantRange !== fixeRange) {
              gammeDisplay = `${ouvrantRange} (Ouvrant) + ${fixeRange} (Fixe)`;
           } else if (ouvrantRange || fixeRange) {
              gammeDisplay = ouvrantRange || fixeRange;
           }
        }

        const popupColor = (database.colors || []).find(c => c.id === infoPopupItem.config?.colorId);
        const techDrawing = getTechnicalDrawingDataURL(infoPopupItem.config, database);
        return (
          <div 
            onClick={() => setInfoPopupItem(null)}
            style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, animation: 'fadeIn 0.2s ease'
            }}
          >
            <div 
              onClick={e => e.stopPropagation()}
              style={{
                background: 'white', borderRadius: '1.25rem', padding: '2rem',
                width: '560px', maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)', position: 'relative',
                animation: 'slideUp 0.25s ease'
              }}
            >
              {/* Close button */}
              <button 
                onClick={() => setInfoPopupItem(null)}
                style={{ 
                  position: 'absolute', top: '1rem', right: '1rem',
                  background: '#f1f5f9', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.target.style.background = '#e2e8f0'; e.target.style.color = '#1e293b'; }}
                onMouseLeave={e => { e.target.style.background = '#f1f5f9'; e.target.style.color = '#64748b'; }}
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={20} color="#3b82f6" /> Détails du Produit
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Aperçu et spécifications de l'article
                </p>
              </div>

              {/* Technical Drawing */}
              {techDrawing && (
                <div style={{ 
                  background: '#f8fafc', borderRadius: '0.75rem', padding: '1rem',
                  border: '1px solid #e2e8f0', marginBottom: '1.25rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <img 
                    src={techDrawing} 
                    alt="Dessin technique" 
                    style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} 
                  />
                </div>
              )}

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: '#f0fdf4', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Désignation</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#166534' }}>{infoPopupItem.label || '—'}</div>
                </div>
                <div style={{ background: '#eff6ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Composition</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e40af' }}>{popupComp?.name || infoPopupItem.categoryId || '—'}</div>
                </div>
                <div style={{ background: '#faf5ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Gamme</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#6b21a8' }}>{gammeDisplay}</div>
                </div>
                <div style={{ background: '#fff7ed', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Dimensions</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#9a3412' }}>{infoPopupItem.config?.L || '?'} × {infoPopupItem.config?.H || '?'} mm</div>
                </div>
                <div style={{ background: '#f0f9ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #bae6fd', gridColumn: popupColor ? 'auto' : '1 / -1' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Couleur</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#075985' }}>{popupColor?.name || infoPopupItem.config?.colorId || '—'}</div>
                </div>
                {infoPopupItem.config?.openingType && (
                  <div style={{ background: '#fefce8', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #fef08a' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Type d'ouverture</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#854d0e' }}>{infoPopupItem.config.openingType}</div>
                  </div>
                )}
                {infoPopupItem.config?.hasShutter && (
                  <div style={{ background: '#fdf4ff', borderRadius: '0.6rem', padding: '0.75rem', border: '1px solid #f5d0fe', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#86198f', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Détails du Volet</div>
                    <div style={{ fontSize: '0.85rem', color: '#701a75' }}>
                      {(() => {
                        const sCfg = infoPopupItem.config?.shutterConfig || {};
                        const caisson = (database.accessories || []).find(a => a.id === sCfg.caissonId)?.name || sCfg.caissonId;
                        const lame = (database.accessories || []).find(a => a.id === sCfg.lameId)?.name || sCfg.lameId;
                        const moteur = (database.accessories || []).find(a => a.id === sCfg.kitId)?.name || sCfg.kitId;
                        return `Caisson: ${caisson || '-'} | Lame: ${lame || '-'} | Motorisation: ${moteur || '-'}`;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity info */}
              <div style={{ marginTop: '1rem', padding: '0.6rem 0.75rem', background: '#f1f5f9', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span>Quantité devis : <strong>{infoPopupItem.qty || 1}</strong></span>
                <span>ID : <strong style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{infoPopupItem.id}</strong></span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CommercialModule;
