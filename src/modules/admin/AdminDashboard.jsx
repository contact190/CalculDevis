import React, { useState, useMemo } from 'react';
import { Package, Search, Plus, Trash2, Save, Download, Upload, AlertCircle, RefreshCw, Layers, Edit2, ChevronDown, Check, FileSpreadsheet, Info, Copy, Image as ImageIcon } from 'lucide-react';
import { DEFAULT_DATA } from '../../data/default-data';
import * as XLSX from 'xlsx';

const MultiSelectRange = ({ selectedIds = [], allRanges, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleRange = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div style={{ position: 'relative', width: '150px' }}>
      <button 
        className="input" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontSize: '0.75rem', background: 'white', padding: '0.4rem 0.65rem' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedIds.length === 0 ? 'Aucune' : 
           selectedIds.length === (allRanges?.length || 0) ? 'Toutes' : 
           selectedIds.map(id => allRanges.find(r => r.id === id)?.id || id).join(', ')}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: '4px' }} />
      </button>
      
      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsOpen(false)} />
          <div style={{ 
            position: 'absolute', top: '100%', left: 0, 
            width: '180px',
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.4rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50,
            maxHeight: '200px', overflowY: 'auto', padding: '0.5rem'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.75rem' }}>
              <input 
                type="checkbox" 
                checked={Array.isArray(selectedIds) && Array.isArray(allRanges) && selectedIds.length === allRanges.length && allRanges.length > 0}
                onChange={() => {
                  if (selectedIds.length === allRanges.length) onChange([]);
                  else onChange((allRanges || []).map(r => r.id));
                }}
              />
              Plusieurs / Toutes
            </label>
            {(allRanges || []).map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input 
                  type="checkbox" 
                  checked={(selectedIds || []).includes(r.id)}
                  onChange={() => toggleRange(r.id)}
                />
                {r.id}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const MultiSelectColor = ({ selectedColors = [], allColors, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleColor = (id) => {
    if (selectedColors.includes(id)) {
      onChange(selectedColors.filter(x => x !== id));
    } else {
      onChange([...selectedColors, id]);
    }
  };
  return (
    <div style={{ position: 'relative', width: '130px' }}>
      <button 
        className="input" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontSize: '0.75rem', background: 'white', padding: '0.4rem 0.65rem' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedColors.length === 0 ? 'Aucun' : 
           selectedColors.length === (allColors?.length || 0) ? 'Tous' : 
           selectedColors.map(id => allColors.find(c => c.id === id)?.name?.split(' ')[0] || id).join(', ')}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: '4px' }} />
      </button>
      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setIsOpen(false)} />
          <div style={{ 
            position: 'absolute', top: '100%', left: 0, 
            width: '180px',
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.4rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50,
            maxHeight: '200px', overflowY: 'auto', padding: '0.5rem'
          }}>
            {(allColors || []).map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input type="checkbox" checked={(selectedColors || []).includes(c.id)} onChange={() => toggleColor(c.id)} />
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: c.hex || '#fff', border: '1px solid #e2e8f0' }} />
                {c.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const CollapsibleGroup = ({ title, children, defaultOpen = false, count = 0 }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden', background: 'white' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.5rem',
          background: isOpen ? '#f8fafc' : 'white',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Layers size={18} style={{ color: '#3b82f6' }} />
          {title}
          <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.2rem 0.6rem', borderRadius: '1rem', background: '#e0f2fe', color: '#0369a1' }}>
            {count}
          </span>
        </span>
        <ChevronDown size={20} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: '#64748b' }} />
      </button>
      {isOpen && (
        <div style={{ padding: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState('ranges');
  const [editingAddonItem, setEditingAddonItem] = useState(null); // { family, idx, item }
  const [editingComposition, setEditingComposition] = useState(null);

  const handleAddComposition = () => {
    const newComp = {
      id: `COMP-${Date.now()}`,
      name: 'Nouveau Modèle',
      rangeId: data.ranges[0].id,
      categoryId: data.categories?.[0]?.id || 'CAT-F',
      openingType: 'Ouvrant',
      hasGasket: true,
      glassFormulaL: 'L-80',
      glassFormulaH: 'H-80',
      glassFormulaQty: '1',
      elements: [],
      _isNew: true
    };
    setData(prev => ({ ...prev, compositions: [...prev.compositions, newComp] }));
    setEditingComposition(newComp);
  };

  // Shutter Helpers (Moved to Top for Accessibility)
  const updateShutterItem = (family, idx, field, value) => {
    setData(prev => {
      const components = prev.shutterComponents || {};
      const list = components[family] || [];
      const updated = [...list];
      if (updated[idx] !== undefined) {
        const item = { ...updated[idx], [field]: (field === 'price' || field === 'height' || field === 'jointPrice' || field === 'baguettePrice' || field === 'barLength' || field === 'scrapThreshold') ? parseFloat(value) || 0 : value };
        delete item._isNew;
        updated[idx] = item;
      }
      return { ...prev, shutterComponents: { ...components, [family]: updated } };
    });
  };

  const deleteShutterItem = (family, idx) => {
    setData(prev => {
      const components = prev.shutterComponents || {};
      const list = components[family] || [];
      const updated = list.filter((_, i) => i !== idx);
      return { ...prev, shutterComponents: { ...components, [family]: updated } };
    });
  };

  const addShutterItem = (family) => {
    const id = `${family.slice(0,3).toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newItem = { 
      id, 
      name: 'Nouvel élément', 
      price: 0, 
      priceUnit: 'ML', 
      formula: '1', 
      barLength: 6400,
      ...(family === 'caissons' ? { height: 185, jointPrice: 0, jointFormula: 'L/1000' } : {}),
      ...(family === 'lames' ? { hasBaguette: false, baguettePrice: 0 } : {}),
      _isNew: true
    };
    setData(prev => {
      const components = prev.shutterComponents || {};
      const list = components[family] || [];
      return {
        ...prev,
        shutterComponents: { ...components, [family]: [...list, newItem] }
      };
    });
  };


  const handleDeleteComposition = (id) => {
    setData(prev => ({ ...prev, compositions: prev.compositions.filter(c => c.id !== id) }));
    return true;
  };

  const handleAddItem = (category) => {
    const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    const lastProfileRange = data.profiles?.[data.profiles.length - 1]?.rangeIds?.[0] || data.profiles?.[data.profiles.length - 1]?.rangeId;
    
    const defaultData = {
      ranges: { id: generateId('G'), name: 'Nouvelle Gamme', minL: 500, maxL: 2000, minH: 500, maxH: 2000 },
      profiles: { id: generateId('P'), name: 'Nouveau Profilé', rangeIds: [lastProfileRange || data.ranges?.[0]?.id || ''], weightPerM: 1.0, pricePerKg: 5.0, barLength: 6000, colors: ['RAL9016'], type: 'ALU' },
      glass: { id: generateId('V'), name: 'Nouveau Vitrage', type: 'SIMPLE', composition: '4', specification: 'Standard', thickness: 4, weightPerM2: 10, pricePerM2: 20 },
      colors: { id: generateId('C'), name: 'Nouvelle Couleur', hex: '#FFFFFF', factor: 1.0 },
      accessories: { id: generateId('A'), name: 'Nouvel Accessoire', rangeIds: [data.ranges?.[0]?.id || ''], unit: 'Unité', price: 5.0 },
      categories: { id: generateId('CAT'), name: 'Nouvelle Catégorie' },
      gasketCompatibility: { rangeId: data.ranges?.[0]?.id || '', glassThickness: 4, gasketId: data.accessories.find(a => a.unit === 'Joint')?.id || '', formula: '(L+H)*2' },
      glassProfileCompatibility: { rangeId: data.ranges?.[0]?.id || '', glassThickness: 4, profileHId: data.profiles?.[0]?.id || '', qtyH: 2, formulaH: 'L-80', profileVId: data.profiles?.[0]?.id || '', qtyV: 2, formulaV: 'H-80' },
      options: { id: generateId('OPT'), name: 'Nouvelle Option', rangeIds: [data.ranges?.[0]?.id || ''], addAccessoryId: data.accessories?.[0]?.id || '', removeAccessoryId: '', formula: '1' },
      traverses: { id: generateId('TRV'), name: 'Nouvelle Traverse', type: 'horizontale', usage: 'fenetre', profileId: '', formula: 'L', priceUnit: 'ML' }
    };

    setData(prev => ({
      ...prev,
      [category]: [...prev[category], { ...defaultData[category], _isNew: true }]
    }));
  };

  const handleUpdateItem = (category, id, field, value, index = -1) => {
    // Safety check for ID uniqueness
    if (field === 'id') {
      if (!value || value.trim() === '') {
        alert("L'identifiant ne peut pas être vide.");
        return;
      }
      const exists = data[category].some((item, idx) => item.id === value && idx !== index && item.id !== id);
      if (exists) {
        alert("Cet identifiant existe déjà dans cette catégorie. Veuillez en choisir un autre.");
        return;
      }
    }

    setData(prev => {
      let nextData = { ...prev };
      
      // Cascading update for Ranges
      if (category === 'ranges' && field === 'id' && id !== value) {
        const oldId = id;
        const newId = value;

        // Profiles
        if (nextData.profiles) {
          nextData.profiles = nextData.profiles.map(p => ({
            ...p,
            rangeIds: (p.rangeIds || (p.rangeId ? [p.rangeId] : [])).map(rid => rid === oldId ? newId : rid)
          }));
        }
        
        // Accessories
        if (nextData.accessories) {
          nextData.accessories = nextData.accessories.map(a => ({
            ...a,
            rangeIds: (a.rangeIds || []).map(rid => rid === oldId ? newId : rid)
          }));
        }

        // Compositions
        if (nextData.compositions) {
          nextData.compositions = nextData.compositions.map(c => c.rangeId === oldId ? { ...c, rangeId: newId } : c);
        }

        // Gasket Compatibility
        if (nextData.gasketCompatibility) {
          nextData.gasketCompatibility = nextData.gasketCompatibility.map(gc => gc.rangeId === oldId ? { ...gc, rangeId: newId } : gc);
        }

        // Glass Profile Compatibility
        if (nextData.glassProfileCompatibility) {
          nextData.glassProfileCompatibility = nextData.glassProfileCompatibility.map(gpc => gpc.rangeId === oldId ? { ...gpc, rangeId: newId } : gpc);
        }

        // Options
        if (nextData.options) {
          nextData.options = nextData.options.map(o => ({
            ...o,
            rangeIds: (o.rangeIds || []).map(rid => rid === oldId ? newId : rid)
          }));
        }

        // Shutter - Glissieres
        if (nextData.shutterComponents?.glissieres) {
          const updatedGlissieres = nextData.shutterComponents.glissieres.map(g => g.rangeId === oldId ? { ...g, rangeId: newId } : g);
          nextData.shutterComponents = { ...nextData.shutterComponents, glissieres: updatedGlissieres };
        }
      }

      // Cascading update for Profiles
      if (category === 'profiles' && field === 'id' && id !== value) {
        const oldId = id;
        const newId = value;

        // Compositions (Elements)
        if (nextData.compositions) {
          nextData.compositions = nextData.compositions.map(comp => ({
            ...comp,
            elements: (comp.elements || []).map(el => (el.type === 'profile' && el.id === oldId) ? { ...el, id: newId } : el)
          }));
        }

        // Traverses
        if (nextData.traverses) {
          nextData.traverses = nextData.traverses.map(t => t.profileId === oldId ? { ...t, profileId: newId } : t);
        }

        // Glass Profile Compatibility
        if (nextData.glassProfileCompatibility) {
          nextData.glassProfileCompatibility = nextData.glassProfileCompatibility.map(gpc => {
            let updated = { ...gpc };
            if (gpc.profileHId === oldId) updated.profileHId = newId;
            if (gpc.profileVId === oldId) updated.profileVId = newId;
            return updated;
          });
        }
      }

      // Cascading update for Accessories
      if (category === 'accessories' && field === 'id' && id !== value) {
        const oldId = id;
        const newId = value;

        // Compositions (Elements)
        if (nextData.compositions) {
          nextData.compositions = nextData.compositions.map(comp => ({
            ...comp,
            elements: (comp.elements || []).map(el => (el.type === 'accessory' && el.id === oldId) ? { ...el, id: newId } : el)
          }));
        }

        // Gasket Compatibility
        if (nextData.gasketCompatibility) {
          nextData.gasketCompatibility = nextData.gasketCompatibility.map(gc => gc.gasketId === oldId ? { ...gc, gasketId: newId } : gc);
        }

        // Options
        if (nextData.options) {
          nextData.options = nextData.options.map(opt => {
            const up = { ...opt };
            if (opt.addAccessoryId === oldId) up.addAccessoryId = newId;
            if (opt.removeAccessoryId === oldId) up.removeAccessoryId = newId;
            return up;
          });
        }
      }

      const parseValue = (val, prevVal) => {
        if (Array.isArray(prevVal)) return val;
        if (typeof prevVal === 'number' || ['price', 'pricePerKg', 'pricePerBar', 'weightPerM', 'pricePerM2', 'factor', 'minL', 'maxL', 'minH', 'maxH', 'height', 'jointPrice', 'baguettePrice'].includes(field)) {
          return parseFloat(val) || 0;
        }
        return val;
      };

      const updatedCategoryList = [...nextData[category]];
      if (index !== -1 && index < updatedCategoryList.length) {
        const item = { ...updatedCategoryList[index], [field]: parseValue(value, updatedCategoryList[index][field]) };
        delete item._isNew;
        updatedCategoryList[index] = item;
      } else {
        const itemIdx = updatedCategoryList.findIndex(item => item.id === id);
        if (itemIdx !== -1) {
          const item = { ...updatedCategoryList[itemIdx], [field]: parseValue(value, updatedCategoryList[itemIdx][field]) };
          delete item._isNew;
          updatedCategoryList[itemIdx] = item;
        }
      }
      
      return { ...nextData, [category]: updatedCategoryList };
    });
  };

  const handleDeleteItem = (category, id, index = -1) => {
    setData(prev => {
      if (index !== -1) {
        const updated = [...prev[category]];
        updated.splice(index, 1);
        return { ...prev, [category]: updated };
      }
      return {
        ...prev,
        [category]: prev[category].filter(item => item.id !== id)
      };
    });
  };

  const handleDuplicateItem = (category, originalItem) => {
    const newItem = { ...originalItem };
    
    // Only handle ID duplication if the item has an ID
    if (newItem.id) {
      let newId = `${originalItem.id}-copie`;
      let counter = 1;
      while (data[category].some(x => x.id === newId)) {
        newId = `${originalItem.id}-copie-${counter}`;
        counter++;
      }
      newItem.id = newId;
    }
    
    setData(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }));
  };

  const handleDeleteGlassProfileCompatibility = (index) => {
    setData(prev => ({ ...prev, glassProfileCompatibility: prev.glassProfileCompatibility.filter((_, i) => i !== index) }));
  };

  const handleDeleteGasketCompatibility = (index) => {
    setData(prev => ({
      ...prev,
      gasketCompatibility: prev.gasketCompatibility.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateGasketCompatibility = (index, field, value) => {
    const updated = [...data.gasketCompatibility];
    const item = { ...updated[index], [field]: field === 'glassThickness' ? parseFloat(value) || 0 : value };
    delete item._isNew;
    updated[index] = item;
    setData(prev => ({ ...prev, gasketCompatibility: updated }));
  };

  const handleUpdateGlassProfileCompatibility = (index, field, value) => {
    const updated = [...(data.glassProfileCompatibility || [])];
    const item = { ...updated[index], [field]: (field === 'glassThickness' || field === 'qtyH' || field === 'qtyV') ? parseFloat(value) || 0 : value };
    delete item._isNew;
    updated[index] = item;
    setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
  };

  const handleUpdateComposition = (updated) => {
    const cleanUpdated = { ...updated };
    delete cleanUpdated._isNew;
    setData(prev => ({
      ...prev,
      compositions: prev.compositions.map(c => c.id === cleanUpdated.id ? cleanUpdated : c)
    }));
  };

  const handleAddElement = (compId) => {
    const comp = data.compositions.find(c => c.id === compId);
    if (!comp) return;
    const newElements = [...comp.elements, { type: 'profile', id: data.profiles[0].id, label: 'Nouvel élément', formula: 'L', qty: 1 }];
    const updated = { ...comp, elements: newElements };
    setEditingComposition(updated);
    handleUpdateComposition(updated);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "database_menuiserie.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (window.confirm("Voulez-vous vraiment écraser la base de données actuelle par ce fichier ?")) {
          setData(imported);
        }
      } catch (err) {
        alert("Erreur lors de la lecture du fichier JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const importedRows = XLSX.utils.sheet_to_json(ws);
        
        if (!['profiles', 'accessories', 'glass'].includes(activeTab)) {
          alert("Veuillez vous placer dans l'onglet 'Profilés', 'Accessoires' ou 'Vitrages' pour effectuer l'importation.");
          return;
        }

        if (importedRows.length === 0) {
          alert("Le fichier est vide.");
          return;
        }

        const category = activeTab;
        const newItems = importedRows.map(row => {
          // Normalize keys to lowercase and remove spaces/special chars if needed
          const normalizedRow = Object.keys(row).reduce((acc, key) => {
            const cleanKey = key.toLowerCase()
              .replace(/ /g, '')
              .replace(/é/g, 'e')
              .replace(/è/g, 'e')
              .replace(/\(.*\)/g, ''); // Remove (mm), (kg), etc.
            acc[cleanKey] = row[key];
            return acc;
          }, {});

          const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

          if (category === 'profiles') {
            return {
              id: normalizedRow.id || normalizedRow.code || generateId('P'),
              name: normalizedRow.name || normalizedRow.designation || 'Profilé Importé',
              rangeIds: normalizedRow.gammes ? normalizedRow.gammes.toString().split(',').map(s => s.trim()) : [data.ranges[0].id],
              weightPerM: parseFloat(normalizedRow.poids) || 0,
              pricePerKg: parseFloat(normalizedRow.prix) || 0,
              barLength: parseFloat(normalizedRow.lgbarre) || 6000,
              thickness: parseFloat(normalizedRow.epaisseur) || 0,
              isUnion: !!normalizedRow.isunion,
              colors: normalizedRow.couleurs ? normalizedRow.couleurs.toString().split(',').map(s => s.trim()) : ['RAL9016'],
              type: 'ALU',
              _isNew: true
            };
          }
          
          if (category === 'accessories') {
            return {
              id: normalizedRow.id || normalizedRow.code || generateId('A'),
              name: normalizedRow.name || normalizedRow.designation || 'Accessoire Importé',
              rangeIds: normalizedRow.gammes ? normalizedRow.gammes.toString().split(',').map(s => s.trim()) : [data.ranges[0].id],
              unit: normalizedRow.unite || 'Unité',
              price: parseFloat(normalizedRow.prix) || 0,
              _isNew: true
            };
          }

          if (category === 'glass') {
            return {
              id: normalizedRow.id || normalizedRow.code || generateId('V'),
              name: normalizedRow.name || normalizedRow.designation || 'Vitrage Importé',
              type: (normalizedRow.type || 'SIMPLE').toUpperCase(),
              composition: normalizedRow.composition || '4',
              specification: normalizedRow.specification || 'Standard',
              thickness: parseFloat(normalizedRow.epaisseur) || 4,
              pricePerM2: parseFloat(normalizedRow.prix) || 0,
              _isNew: true
            };
          }
          return null;
        }).filter(Boolean);

        if (window.confirm(`Voulez-vous ajouter ces ${newItems.length} éléments à la liste actuelle ?`)) {
          setData(prev => ({
            ...prev,
            [category]: [...prev[category], ...newItems]
          }));
          alert("Importation réussie !");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur lors de l'importation. Vérifiez le format du fichier.");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Administration Système</h1>
          <p style={{ color: '#64748b' }}>Gestion du catalogue, des tarifs et des formules de calcul.</p>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={handleExportJSON} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Download size={16} /> Exporter JSON
            </button>
            
            <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
              <Upload size={16} /> Importer JSON
              <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            </label>

            <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 0.5rem' }}></div>

            <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
              <FileSpreadsheet size={16} /> Import Excel
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={18} />
            Sauvegarder les modifications
          </button>
        </div>
      </header>

      <div className="glass shadow-lg" style={{ padding: 0 }}>
        {/* Tabs */}
        <div className="tabs-container">
          {[
            { id: 'ranges', label: 'Gammes & Limites' },
            { id: 'categories', label: 'Catégories' },
            { id: 'profiles', label: 'Profilés & Stocks' },
            { id: 'glass', label: 'Vitrages' },
            { id: 'colors', label: 'Coloris & Plus-values' },
            { id: 'accessories', label: 'Accessoires' },
            { id: 'gaskets', label: 'Joints Vitrage' },
            { id: 'glassProfiles', label: 'Parcloses' },
            { id: 'compositions', label: 'Compositions (Modèles)' },
            { id: 'options', label: 'Options & Variantes' },
            { id: 'volets', label: 'Volets Roulants' },
            { id: 'traverses', label: 'Traverses & Unions' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Add-ons Manager Modal */}
        {editingAddonItem && (() => {
          const currentItem = editingAddonItem.isShutter 
            ? (data.shutterComponents?.[editingAddonItem.family]?.[editingAddonItem.idx])
            : (data[editingAddonItem.family]?.find(x => x.id === editingAddonItem.item.id));
            
          if (!currentItem) return null;

          return (
            <div style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              width: '100vw', 
              height: '100vh', 
              background: 'rgba(0,0,0,0.6)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              zIndex: 9999, 
              padding: '1rem',
              backdropFilter: 'blur(4px)'
            }}>
              <div className="glass shadow-2xl" style={{ 
                width: '100%', 
                maxWidth: '900px', 
                maxHeight: '85vh', 
                overflowY: 'auto',
                background: 'white',
                color: '#1e293b',
                padding: '2rem',
                borderRadius: '1rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0 }}>Options Supplémentaires : {currentItem.name}</h3>
                  <button onClick={() => setEditingAddonItem(null)} className="btn btn-secondary"> Fermer</button>
                </div>
                
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nom de l'option</th>
                      <th>Lier à un article (Optionnel)</th>
                      <th>Formule Quantité (ex: 1, L/1000)</th>
                      <th>Prix Unit. (DZD)</th>
                      <th>Unité</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(currentItem.addOns || []).map((addon, ai) => (
                      <tr key={ai}>
                        <td><input className="input" value={addon.name} onChange={e => {
                          const newAddons = [...(currentItem.addOns || [])];
                          newAddons[ai].name = e.target.value;
                          if (editingAddonItem.isShutter) {
                            updateShutterItem(editingAddonItem.family, editingAddonItem.idx, 'addOns', newAddons);
                          } else {
                            handleUpdateItem(editingAddonItem.family, currentItem.id, 'addOns', newAddons, editingAddonItem.idx);
                          }
                        }} /></td>
                        <td>
                          <select className="input" value={addon.linkedId || ''} onChange={e => {
                            const newAddons = [...(currentItem.addOns || [])];
                            const linkedId = e.target.value;
                            newAddons[ai].linkedId = linkedId;
                            // Auto-fill price and name if linked
                            if (linkedId) {
                               const linked = data.accessories.find(a => a.id === linkedId) || data.profiles.find(p => p.id === linkedId);
                               if (linked) {
                                  newAddons[ai].name = linked.name;
                                  newAddons[ai].price = linked.price || 0;
                                  newAddons[ai].unit = linked.unit || 'ML';
                               }
                            }
                            if (editingAddonItem.isShutter) {
                              updateShutterItem(editingAddonItem.family, editingAddonItem.idx, 'addOns', newAddons);
                            } else {
                              handleUpdateItem(editingAddonItem.family, currentItem.id, 'addOns', newAddons, editingAddonItem.idx);
                            }
                          }}>
                            <option value="">(Libre)</option>
                            <optgroup label="Accessoires">
                              {data.accessories.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </optgroup>
                            <optgroup label="Profilés">
                              {data.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </optgroup>
                          </select>
                        </td>

                        <td><input className="input" value={addon.formula} onChange={e => {
                          const newAddons = [...(currentItem.addOns || [])];
                          newAddons[ai].formula = e.target.value;
                          if (editingAddonItem.isShutter) {
                            updateShutterItem(editingAddonItem.family, editingAddonItem.idx, 'addOns', newAddons);
                          } else {
                            handleUpdateItem(editingAddonItem.family, currentItem.id, 'addOns', newAddons, editingAddonItem.idx);
                          }
                        }} /></td>
                        <td><input className="input" type="number" value={addon.price} onChange={e => {
                          const newAddons = [...(currentItem.addOns || [])];
                          newAddons[ai].price = parseFloat(e.target.value) || 0;
                          if (editingAddonItem.isShutter) {
                            updateShutterItem(editingAddonItem.family, editingAddonItem.idx, 'addOns', newAddons);
                          } else {
                            handleUpdateItem(editingAddonItem.family, currentItem.id, 'addOns', newAddons, editingAddonItem.idx);
                          }
                        }} /></td>
                        <td>
                          <select className="input" value={addon.unit || 'Unité'} onChange={e => {
                            const newAddons = [...(currentItem.addOns || [])];
                            newAddons[ai].unit = e.target.value;
                            if (editingAddonItem.isShutter) {
                              updateShutterItem(editingAddonItem.family, editingAddonItem.idx, 'addOns', newAddons);
                            } else {
                              handleUpdateItem(editingAddonItem.family, currentItem.id, 'addOns', newAddons, editingAddonItem.idx);
                            }
                          }}>
                            <option>Unité</option>
                            <option>ML</option>
                            <option>M2</option>
                            <option>Barre</option>
                            <option>Joint</option>
                          </select>
                        </td>
                        <td><button className="btn" onClick={() => {
                          const newAddons = (currentItem.addOns || []).filter((_, i) => i !== ai);
                          if (editingAddonItem.isShutter) {
                            updateShutterItem(editingAddonItem.family, editingAddonItem.idx, 'addOns', newAddons);
                          } else {
                            handleUpdateItem(editingAddonItem.family, currentItem.id, 'addOns', newAddons, editingAddonItem.idx);
                          }
                        }} style={{ color: '#ef4444' }}><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan="6">
                        <button className="btn btn-secondary" style={{ width: '100%', padding: '1rem', fontWeight: 'bold' }} onClick={() => {
                          const newAddons = [...(currentItem.addOns || []), { name: 'Nouvel add-on', formula: '1', price: 0, unit: 'Unité' }];
                          if (editingAddonItem.isShutter) {
                            updateShutterItem(editingAddonItem.family, editingAddonItem.idx, 'addOns', newAddons);
                          } else {
                            handleUpdateItem(editingAddonItem.family, currentItem.id, 'addOns', newAddons, editingAddonItem.idx);
                          }
                        }}>
                          <Plus size={16} /> Ajouter une nouvelle ligne d'option
                        </button>
                      </td>
                    </tr>

                  </tbody>
                </table>
                
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                   <button onClick={() => setEditingAddonItem(null)} className="btn btn-primary" style={{ padding: '0.8rem 2rem' }}>Valider et Fermer</button>
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ padding: '1.5rem' }}>
          {activeTab === 'categories' && (
            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((cat, idx) => (
                    <tr key={cat.id} style={cat._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                      <td data-label="ID">{cat.id}</td>
                      <td data-label="Nom"><input className="input" value={cat.name} onChange={e => handleUpdateItem('categories', cat.id, 'name', e.target.value, idx)} /></td>
                      <td data-label="Actions"><button className="btn" onClick={() => handleDeleteItem('categories', cat.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="3">
                      <button className="btn btn-secondary" onClick={() => handleAddItem('categories')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Ajouter une Catégorie
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'ranges' && (
            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Image</th>
                    <th>Nom commercial</th>
                    <th>Min L (mm)</th>
                    <th>Max L (mm)</th>
                    <th>Min H (mm)</th>
                    <th>Max H (mm)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranges.map((range, idx) => (
                    <tr key={range.id} style={range._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                      <td data-label="ID" style={{ fontWeight: 600 }}>
                        <input className="input" value={range.id} onChange={e => handleUpdateItem('ranges', range.id, 'id', e.target.value, idx)} style={{ width: '80px', fontWeight: 600 }} />
                      </td>
                      <td data-label="Visuel">
                        <div style={{ 
                          width: '45px', height: '45px', borderRadius: '6px', 
                          background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          position: 'relative'
                        }}>
                          {range.image ? <img src={range.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Layers size={16} style={{ color: '#94a3b8' }} />}
                          <input 
                            type="file" accept="image/*" 
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                            onChange={(e) => {
                              const f = e.target.files[0];
                              if(!f) return;
                                const reader = new FileReader();
                                reader.onload = (re) => {
                                  const img = new Image();
                                  img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    const MAX_WIDTH = 400; const MAX_HEIGHT = 400;
                                    let width = img.width; let height = img.height;
                                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                                    canvas.width = width; canvas.height = height;
                                    const ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0, width, height);
                                    handleUpdateItem('ranges', range.id, 'image', canvas.toDataURL('image/jpeg', 0.8), idx);
                                  };
                                  img.src = re.target.result;
                                };
                                reader.readAsDataURL(f);
                            }}
                          />
                        </div>
                      </td>
                      <td data-label="Nom commercial"><input className="input" value={range.name} onChange={e => handleUpdateItem('ranges', range.id, 'name', e.target.value, idx)} /></td>
                      <td data-label="Min L"><input type="number" className="input" value={range.minL} onChange={e => handleUpdateItem('ranges', range.id, 'minL', e.target.value, idx)} /></td>
                      <td data-label="Max L"><input type="number" className="input" value={range.maxL} onChange={e => handleUpdateItem('ranges', range.id, 'maxL', e.target.value, idx)} /></td>
                      <td data-label="Min H"><input type="number" className="input" value={range.minH} onChange={e => handleUpdateItem('ranges', range.id, 'minH', e.target.value, idx)} /></td>
                      <td data-label="Max H"><input type="number" className="input" value={range.maxH} onChange={e => handleUpdateItem('ranges', range.id, 'maxH', e.target.value, idx)} /></td>
                      <td data-label="Actions"><button className="btn" onClick={() => handleDeleteItem('ranges', range.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="8">
                      <button className="btn btn-secondary" onClick={() => handleAddItem('ranges')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Ajouter une Gamme
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

           {activeTab === 'profiles' && (
             <div>
               {/* Emergency display for profiles that might be orphans or newly created */}
               {(() => {
                 const unassigned = data.profiles.filter(p => p._isNew || !(p.rangeIds || (p.rangeId ? [p.rangeId] : [])).some(rid => data.ranges.some(r => r.id === rid)));
                 if (unassigned.length === 0) return null;
                 return (
                   <CollapsibleGroup title="Profilés Nouveaux ou Non Assignés" count={unassigned.length} defaultOpen={true}>
                     <div style={{ overflowX: 'auto', border: '2px dashed #3b82f6', borderRadius: '8px', padding: '0.5rem', marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.05)' }}>
                       <table className="data-table">
                         <thead>
                           <tr>
                             <th>ID</th>
                             <th>Aperçu</th>
                             <th>Dessin</th>
                             <th>Désignation</th>
                             <th>Type</th>
                             <th>Gammes</th>
                             <th>Actions</th>
                           </tr>
                         </thead>
                         <tbody>
                           {unassigned.map((p) => {
                             const idx = data.profiles.indexOf(p);
                             return (
                               <tr key={p.id} style={p._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                                  <td><input className="input" value={p.id} onChange={e => handleUpdateItem('profiles', p.id, 'id', e.target.value, idx)} style={{ width: '80px', fontWeight: 700 }} /></td>
                                  <td><div style={{ width: '30px', height: '30px', background: 'white', borderRadius: '4px' }}>{p.image && <img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}</div></td>
                                  <td>{p.technicalDrawing ? '✅' : '❌'}</td>
                                  <td><input className="input" value={p.name} onChange={e => handleUpdateItem('profiles', p.id, 'name', e.target.value, idx)} style={{ width: '120px' }} /></td>
                                  <td>
                                    <select className="input" value={p.category || 'standard'} onChange={e => handleUpdateItem('profiles', p.id, 'category', e.target.value, idx)} style={{ width: '90px', fontSize: '0.75rem' }}>
                                      <option value="standard">Standard</option>
                                      <option value="divider">Jonction</option>
                                    </select>
                                  </td>
                                  <td><MultiSelectRange selectedIds={p.rangeIds || []} allRanges={data.ranges} onChange={newR => handleUpdateItem('profiles', p.id, 'rangeIds', newR, idx)} /></td>
                                 <td style={{ display: 'flex', gap: '0.2rem' }}>
                                   <button className="btn" onClick={() => handleDuplicateItem('profiles', p)}><Copy size={14} /></button>
                                   <button className="btn" onClick={() => handleDeleteItem('profiles', p.id, idx)}><Trash2 size={14} /></button>
                                 </td>
                               </tr>
                             )
                           })}
                         </tbody>
                       </table>
                     </div>
                   </CollapsibleGroup>
                 )
               })()}

               {(data.ranges || []).map(range => {
                const rangeProfiles = data.profiles.filter(p => (p.category !== 'divider') && (p.rangeIds || (p.rangeId ? [p.rangeId] : [])).includes(range.id));
                if (rangeProfiles.length === 0) return null;
                
                return (
                  <CollapsibleGroup key={range.id} title={range.name || range.id} count={rangeProfiles.length}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                         <thead>
                           <tr>
                             <th>ID</th>
                             <th>Photo</th>
                             <th>Dessin</th>
                             <th>Désignation</th>
                             <th>Type</th>
                             <th>Poids</th>
                             <th>Prix</th>
                             <th>Épas.</th>
                             <th>Lg Barre</th>
                             <th>Seuil</th>
                             <th>Gammes</th>
                             <th>Couleurs</th>
                             <th>Coupe</th>
                             <th>Actions</th>
                           </tr>
                         </thead>
                        <tbody>
                          {rangeProfiles.map((p) => {
                            const idx = data.profiles.indexOf(p);
                            return (
                              <tr key={p.id} style={p._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                                <td style={{ fontWeight: 600 }}>
                                  <input className="input" value={p.id} onChange={e => handleUpdateItem('profiles', p.id, 'id', e.target.value, idx)} style={{ width: '80px', fontWeight: 600 }} />
                                </td>
                                <td>
                                  <div style={{ width: '35px', height: '35px', position: 'relative' }}>
                                    {p.image && <img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                    <input type="file" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => {
                                      const f = e.target.files[0]; if(!f) return;
                                      const reader = new FileReader();
                                      reader.onload = (re) => handleUpdateItem('profiles', p.id, 'image', re.target.result, idx);
                                      reader.readAsDataURL(f);
                                    }} />
                                  </div>
                                </td>
                                <td>
                                  <div style={{ width: '35px', height: '35px', position: 'relative' }}>
                                    {p.technicalDrawing ? 'OK' : '...'}
                                    <input type="file" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => {
                                      const f = e.target.files[0]; if(!f) return;
                                      const reader = new FileReader();
                                      reader.onload = (re) => handleUpdateItem('profiles', p.id, 'technicalDrawing', re.target.result, idx);
                                      reader.readAsDataURL(f);
                                    }} />
                                  </div>
                                </td>
                                <td><input className="input" value={p.name} onChange={e => handleUpdateItem('profiles', p.id, 'name', e.target.value, idx)} style={{ width: '130px' }} /></td>
                                <td>
                                  <select className="input" value={p.category || 'standard'} onChange={e => handleUpdateItem('profiles', p.id, 'category', e.target.value, idx)} style={{ width: '80px', fontSize: '0.7rem' }}>
                                    <option value="standard">Std</option>
                                    <option value="divider">Jonct</option>
                                  </select>
                                </td>
                                <td><input type="number" step="0.001" className="input" value={p.weightPerM} onChange={e => handleUpdateItem('profiles', p.id, 'weightPerM', e.target.value, idx)} style={{ width: '60px' }} /></td>
                                <td><input type="number" step="0.01" className="input" value={p.pricePerKg} onChange={e => handleUpdateItem('profiles', p.id, 'pricePerKg', e.target.value, idx)} style={{ width: '60px' }} /></td>
                                <td><input type="number" className="input" value={p.thickness || 0} onChange={e => handleUpdateItem('profiles', p.id, 'thickness', e.target.value, idx)} style={{ width: '50px' }} /></td>
                                <td><input type="number" className="input" value={p.barLength || 6000} onChange={e => handleUpdateItem('profiles', p.id, 'barLength', e.target.value, idx)} style={{ width: '60px' }} /></td>
                                <td><input type="number" className="input" value={p.scrapThreshold || 0} onChange={e => handleUpdateItem('profiles', p.id, 'scrapThreshold', e.target.value, idx)} style={{ width: '55px' }} /></td>
                                <td><MultiSelectRange selectedIds={p.rangeIds || []} allRanges={data.ranges} onChange={newR => handleUpdateItem('profiles', p.id, 'rangeIds', newR, idx)} /></td>
                                <td>
                                   <select className="input" value={p.cutType || '45/45'} onChange={e => handleUpdateItem('profiles', p.id, 'cutType', e.target.value, idx)} style={{ width: '70px', fontSize: '0.7rem' }}>
                                     <option value="45/45">45/45</option>
                                     <option value="90/90">90/90</option>
                                     <option value="45/90">45/90</option>
                                   </select>
                                 </td>
                                <td><MultiSelectColor selectedColors={p.colors || []} allColors={data.colors} onChange={newC => handleUpdateItem('profiles', p.id, 'colors', newC, idx)} /></td>
                                <td style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button className="btn" onClick={() => handleDuplicateItem('profiles', p)} style={{ padding: '0.4rem', color: '#6366f1' }} title="Dupliquer"><Copy size={16} /></button>
                                  <button className="btn" onClick={() => handleDeleteItem('profiles', p.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }} title="Supprimer"><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleGroup>
                );
              })}

              {/* SECTION CATALOGUE DES JONCTIONS */}
              {(() => {
                const dividerProfiles = data.profiles.filter(p => p.category === 'divider');
                if (dividerProfiles.length === 0) return null;
                return (
                  <CollapsibleGroup title="📦 Catalogue des Jonctions (Traverses & Unions)" count={dividerProfiles.length} defaultOpen={true}>
                    <div style={{ overflowX: 'auto', border: '2px solid #6366f1', borderRadius: '8px', padding: '0.5rem' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Code / ID</th>
                            <th>Dessin</th>
                            <th>Désignation</th>
                            <th>Type</th>
                            <th>Poids</th>
                            <th>Prix</th>
                            <th>Épaisseur</th>
                            <th>Gammes Compatibles</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dividerProfiles.map(p => {
                            const idx = data.profiles.indexOf(p);
                            return (
                              <tr key={p.id}>
                                <td><input className="input" value={p.id} onChange={e => handleUpdateItem('profiles', p.id, 'id', e.target.value, idx)} style={{ width: '80px', fontWeight: 700 }} /></td>
                                <td>{p.technicalDrawing ? '✅' : '...'}</td>
                                <td><input className="input" value={p.name} onChange={e => handleUpdateItem('profiles', p.id, 'name', e.target.value, idx)} style={{ width: '150px' }} /></td>
                                <td>
                                  <select className="input" value={p.category || 'standard'} onChange={e => handleUpdateItem('profiles', p.id, 'category', e.target.value, idx)} style={{ width: '80px' }}>
                                    <option value="standard">Std</option>
                                    <option value="divider">Jonct</option>
                                  </select>
                                </td>
                                <td><input type="number" className="input" value={p.weightPerM} onChange={e => handleUpdateItem('profiles', p.id, 'weightPerM', e.target.value, idx)} style={{ width: '60px' }} /></td>
                                <td><input type="number" className="input" value={p.pricePerKg} onChange={e => handleUpdateItem('profiles', p.id, 'pricePerKg', e.target.value, idx)} style={{ width: '60px' }} /></td>
                                <td><input type="number" className="input" value={p.thickness || 0} onChange={e => handleUpdateItem('profiles', p.id, 'thickness', e.target.value, idx)} style={{ width: '50px' }} /></td>
                                <td><MultiSelectRange selectedIds={p.rangeIds || []} allRanges={data.ranges} onChange={newR => handleUpdateItem('profiles', p.id, 'rangeIds', newR, idx)} /></td>
                                <td style={{ display: 'flex', gap: '0.2rem' }}>
                                  <button className="btn" onClick={() => handleDuplicateItem('profiles', p)} style={{ color: '#6366f1' }} title="Dupliquer"><Copy size={16} /></button>
                                  <button className="btn" onClick={() => handleDeleteItem('profiles', p.id, idx)} style={{ color: '#ef4444' }} title="Supprimer"><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleGroup>
                );
              })()}
              <button className="btn btn-secondary" onClick={() => handleAddItem('profiles')} style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={16} /> Ajouter un Profilé
              </button>
            </div>
          )}

          {activeTab === 'glass' && (
            <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Aperçu</th>
                    <th>Désignation</th>
                    <th>Type</th>
                    <th>Composition</th>
                    <th>Spécification</th>
                    <th>Épaisseur (mm)</th>
                    <th>Prix Achat (m²)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.glass.map((g, idx) => (
                    <tr key={`${g.id}-${idx}`} style={g._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                      <td data-label="ID" style={{ fontWeight: 600 }}>
                        <input className="input" value={g.id} onChange={e => handleUpdateItem('glass', g.id, 'id', e.target.value, idx)} style={{ width: '100px', fontWeight: 600 }} />
                      </td>
                      <td data-label="Aperçu">
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '4px', background: '#f8fafc', 
                          overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative'
                        }}>
                          {g.image ? <img src={g.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Layers size={14} style={{ color: '#94a3b8' }} />}
                          <input 
                            type="file" accept="image/*" 
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                            onChange={(e) => {
                              const f = e.target.files[0];
                              if(!f) return;
                              const reader = new FileReader();
                              reader.onload = (re) => handleUpdateItem('glass', g.id, 'image', re.target.result, idx);
                              reader.readAsDataURL(f);
                            }}
                          />
                        </div>
                      </td>
                      <td data-label="Nom"><input className="input" value={g.name} onChange={e => handleUpdateItem('glass', g.id, 'name', e.target.value, idx)} style={{ width: '180px' }} /></td>
                      <td data-label="Type">
                        <select className="input" value={g.type} onChange={e => handleUpdateItem('glass', g.id, 'type', e.target.value, idx)} style={{ width: '100px' }}>
                          <option value="SIMPLE">Simple</option>
                          <option value="DOUBLE">Double</option>
                          <option value="TRIPLE">Triple</option>
                          <option value="SPECIAL">Spécial</option>
                        </select>
                      </td>
                      <td data-label="Comp."><input className="input" value={g.composition} onChange={e => handleUpdateItem('glass', g.id, 'composition', e.target.value, idx)} style={{ width: '100px' }} /></td>
                      <td data-label="Spec."><input className="input" value={g.specification || 'Standard'} onChange={e => handleUpdateItem('glass', g.id, 'specification', e.target.value, idx)} style={{ width: '120px' }} /></td>
                      <td data-label="Ep. (mm)"><input className="input" type="number" value={g.thickness} onChange={e => handleUpdateItem('glass', g.id, 'thickness', e.target.value, idx)} style={{ width: '80px' }} /></td>
                      <td data-label="Prix/m2"><input className="input" type="number" value={g.pricePerM2} onChange={e => handleUpdateItem('glass', g.id, 'pricePerM2', e.target.value, idx)} style={{ width: '100px' }} /></td>
                      <td data-label="Actions"><button className="btn" onClick={() => handleDeleteItem('glass', g.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="9">
                      <button className="btn btn-secondary" onClick={() => handleAddItem('glass')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Ajouter un Vitrage
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'colors' && (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom (Ex: RAL9016)</th>
                    <th>Code Couleur</th>
                    <th>Facteur Multiplicateur</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.colors.map((c, idx) => (
                    <tr key={`${c.id}-${idx}`} style={c._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                      <td style={{ fontWeight: 600 }}>
                        <input className="input" value={c.id} onChange={e => handleUpdateItem('colors', c.id, 'id', e.target.value, idx)} style={{ width: '100px', fontWeight: 600 }} />
                      </td>
                      <td><input className="input" value={c.name} onChange={e => handleUpdateItem('colors', c.id, 'name', e.target.value, idx)} style={{ width: '200px' }} /></td>
                      <td>
                        <input 
                          type="color" 
                          value={c.hex || '#ffffff'} 
                          onChange={e => handleUpdateItem('colors', c.id, 'hex', e.target.value, idx)}
                          style={{ width: '40px', height: '40px', padding: '0', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                      </td>
                      <td><input className="input" type="number" step="0.05" value={c.factor} onChange={e => handleUpdateItem('colors', c.id, 'factor', e.target.value, idx)} style={{ width: '100px' }} /></td>
                      <td>
                        <button className="btn" onClick={() => handleDeleteItem('colors', c.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="5">
                      <button className="btn btn-secondary" onClick={() => handleAddItem('colors')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Ajouter une Couleur
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'accessories' && (
            <div>
              {/* Orphans Accessories */}
              {(() => {
                const unassigned = (data.accessories || []).filter(a => a._isNew || !(a.rangeIds || []).some(rid => data.ranges.some(r => r.id === rid)));
                if (unassigned.length === 0) return null;
                return (
                  <CollapsibleGroup title="Accessoires Non Assignés" count={unassigned.length} defaultOpen={true}>
                    <div style={{ overflowX: 'auto', border: '2px dashed #f59e0b', borderRadius: '8px', padding: '0.5rem', marginBottom: '1.5rem' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Photo</th>
                            <th>Dessin</th>
                            <th>Désignation</th>
                            <th>Unité</th>
                            <th>Prix (DZD)</th>
                            <th>Gammes</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassigned.map((acc) => {
                             const idx = data.accessories.indexOf(acc);
                             return (
                               <tr key={acc.id}>
                                 <td><input className="input" value={acc.id} onChange={e => handleUpdateItem('accessories', acc.id, 'id', e.target.value, idx)} style={{ width: '80px' }} /></td>
                                 <td>
                                   <div style={{ width: '35px', height: '35px', position: 'relative' }}>
                                     {acc.image && <img src={acc.image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                     <input type="file" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => {
                                       const f = e.target.files[0]; if(!f) return;
                                       const reader = new FileReader();
                                       reader.onload = (re) => handleUpdateItem('accessories', acc.id, 'image', re.target.result, idx);
                                       reader.readAsDataURL(f);
                                     }} />
                                   </div>
                                 </td>
                                 <td>
                                   <div style={{ width: '35px', height: '35px', position: 'relative' }}>
                                     {acc.technicalDrawing ? 'OK' : '...'}
                                     <input type="file" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => {
                                       const f = e.target.files[0]; if(!f) return;
                                       const reader = new FileReader();
                                       reader.onload = (re) => handleUpdateItem('accessories', acc.id, 'technicalDrawing', re.target.result, idx);
                                       reader.readAsDataURL(f);
                                     }} />
                                   </div>
                                 </td>
                                 <td><input className="input" value={acc.name} onChange={e => handleUpdateItem('accessories', acc.id, 'name', e.target.value, idx)} style={{ width: '150px' }} /></td>
                                 <td><input className="input" value={acc.unit} onChange={e => handleUpdateItem('accessories', acc.id, 'unit', e.target.value, idx)} style={{ width: '80px' }} /></td>
                                 <td><input type="number" className="input" value={acc.price} onChange={e => handleUpdateItem('accessories', acc.id, 'price', e.target.value, idx)} style={{ width: '80px' }} /></td>
                                 <td><MultiSelectRange selectedIds={acc.rangeIds || []} allRanges={data.ranges} onChange={newR => handleUpdateItem('accessories', acc.id, 'rangeIds', newR, idx)} /></td>
                                 <td style={{ display: 'flex', gap: '0.2rem' }}>
                                   <button className="btn" onClick={() => setEditingAddonItem({ item: acc, family: 'accessories', idx })} title="Add-ons"><Layers size={16} /></button>
                                   <button className="btn" onClick={() => handleDuplicateItem('accessories', acc)} style={{ color: '#6366f1' }}><Copy size={16} /></button>
                                   <button className="btn" onClick={() => handleDeleteItem('accessories', acc.id, idx)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                                 </td>
                               </tr>
                             )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleGroup>
                )
              })()}

              {(data.ranges || []).map(range => {
                const rangeAccs = data.accessories.filter(a => (a.rangeIds || []).includes(range.id));
                if (rangeAccs.length === 0) return null;
                
                return (
                  <CollapsibleGroup key={range.id} title={range.name || range.id} count={rangeAccs.length}>
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Photo</th>
                            <th>Dessin</th>
                            <th>Désignation</th>
                            <th>Unité</th>
                            <th>Prix (DZD)</th>
                            <th>Gammes</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rangeAccs.map((acc) => {
                            const idx = data.accessories.indexOf(acc);
                            return (
                              <tr key={acc.id} style={acc._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                                <td data-label="ID" style={{ fontWeight: 600 }}>
                                  <input className="input" value={acc.id} onChange={e => handleUpdateItem('accessories', acc.id, 'id', e.target.value, idx)} style={{ width: '80px', fontWeight: 600 }} />
                                </td>
                                <td>
                                  <div style={{ width: '35px', height: '35px', position: 'relative' }}>
                                    {acc.image && <img src={acc.image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                    <input type="file" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => {
                                      const f = e.target.files[0]; if(!f) return;
                                      const reader = new FileReader();
                                      reader.onload = (re) => handleUpdateItem('accessories', acc.id, 'image', re.target.result, idx);
                                      reader.readAsDataURL(f);
                                    }} />
                                  </div>
                                </td>
                                <td>
                                  <div style={{ width: '35px', height: '35px', position: 'relative' }}>
                                    {acc.technicalDrawing ? 'OK' : '...'}
                                    <input type="file" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => {
                                      const f = e.target.files[0]; if(!f) return;
                                      const reader = new FileReader();
                                      reader.onload = (re) => handleUpdateItem('accessories', acc.id, 'technicalDrawing', re.target.result, idx);
                                      reader.readAsDataURL(f);
                                    }} />
                                  </div>
                                </td>
                                <td><input className="input" value={acc.name} onChange={e => handleUpdateItem('accessories', acc.id, 'name', e.target.value, idx)} style={{ width: '150px' }} /></td>
                                <td><input className="input" value={acc.unit} onChange={e => handleUpdateItem('accessories', acc.id, 'unit', e.target.value, idx)} style={{ width: '60px' }} /></td>
                                <td><input type="number" className="input" value={acc.price} onChange={e => handleUpdateItem('accessories', acc.id, 'price', e.target.value, idx)} style={{ width: '70px' }} /></td>
                                <td><MultiSelectRange selectedIds={acc.rangeIds || []} allRanges={data.ranges} onChange={newR => handleUpdateItem('accessories', acc.id, 'rangeIds', newR, idx)} /></td>
                                <td style={{ display: 'flex', gap: '0.3rem' }}>
                                  <button className="btn" onClick={() => setEditingAddonItem({ item: acc, family: 'accessories', idx })} title="Add-ons" style={{ color: '#6366f1' }}><Layers size={16} /></button>
                                  <button className="btn" onClick={() => handleDuplicateItem('accessories', acc)} style={{ color: '#6366f1' }}><Copy size={16} /></button>
                                  <button className="btn" onClick={() => handleDeleteItem('accessories', acc.id, idx)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleGroup>
                );
              })}
              <button className="btn btn-secondary" onClick={() => handleAddItem('accessories')} style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={16} /> Ajouter un Accessoire
              </button>
            </div>
          )}

          {activeTab === 'gaskets' && (
            <div>
              {(data.ranges || []).concat([{ id: 'unassigned', name: 'Non assignés / Tous' }]).map(range => {
                const rangeGaskets = (data.gasketCompatibility || []).filter(gc => 
                  range.id === 'unassigned' 
                    ? (gc._isNew || !gc.rangeId || !data.ranges.find(r => r.id === gc.rangeId)) 
                    : (!gc._isNew && gc.rangeId === range.id)
                );
                if (rangeGaskets.length === 0) return null;

                return (
                  <CollapsibleGroup key={range.id} title={range.name || range.id} count={rangeGaskets.length}>

                    <div className="table-responsive">
                      <table className="data-table">
                      <thead>
                        <tr>
                          <th>Gamme</th>
                          <th>Épaisseur Vitrage (mm)</th>
                          <th>Joint Compatible</th>
                          <th>Formule Qté</th>
                          <th>Actions</th>

                        </tr>
                      </thead>
                      <tbody>
                        {rangeGaskets.map((gc) => {
                          const i = data.gasketCompatibility.indexOf(gc);
                          return (
                            <tr key={i}>
                              <td>
                                <select 
                                  className="input" 
                                  value={gc.rangeId || ''} 
                                  onChange={e => handleUpdateGasketCompatibility(i, 'rangeId', e.target.value)}
                                  style={{ width: '120px' }}
                                >
                                  {(data.ranges || []).map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                                </select>
                              </td>
                              <td>
                                <input 
                                  className="input" 
                                  type="number" 
                                  value={gc.glassThickness || 0} 
                                  onChange={e => handleUpdateGasketCompatibility(i, 'glassThickness', e.target.value)}
                                  style={{ width: '60px' }} 
                                />
                              </td>

                              <td>
                                <select 
                                  className="input" 
                                  value={gc.gasketId || ''} 
                                  onChange={e => handleUpdateGasketCompatibility(i, 'gasketId', e.target.value)}
                                  style={{ width: '200px' }}
                                >
                                  <option value="">Sélectionner...</option>
                                  {(data.accessories || [])
                                    .filter(a => a.unit === 'Joint' && (a.rangeIds || []).includes(gc.rangeId))
                                    .map(a => (
                                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                                    ))
                                  }
                                </select>
                              </td>
                              <td>
                                <input 
                                  className="input" 
                                  value={gc.formula || ''} 
                                  onChange={e => handleUpdateGasketCompatibility(i, 'formula', e.target.value)}
                                  style={{ width: '150px' }} 
                                />
                              </td>
                              <td style={{ display: 'flex', gap: '0.3rem' }}>
                                <button className="btn" onClick={() => handleDuplicateItem('gasketCompatibility', gc)} style={{ padding: '0.4rem', color: '#6366f1' }}><Copy size={16} /></button>
                                <button className="btn" onClick={() => handleDeleteGasketCompatibility(i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      </table>
                    </div>
                  </CollapsibleGroup>
                )
              })}
              <button className="btn btn-secondary" onClick={() => handleAddItem('gasketCompatibility')} style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={16} /> Ajouter une Compatibilité
              </button>
            </div>
          )}

          {activeTab === 'glassProfiles' && (
            <div>
              {(data.ranges || []).concat([{ id: 'unassigned', name: 'Non assignés / Tous' }]).map(range => {
                const rangeGPS = (data.glassProfileCompatibility || []).filter(gp => 
                  range.id === 'unassigned' 
                    ? (gp._isNew || !gp.rangeId || !data.ranges.find(r => r.id === gp.rangeId)) 
                    : (!gp._isNew && gp.rangeId === range.id)
                );
                if (rangeGPS.length === 0) return null;


                return (
                  <CollapsibleGroup key={range.id} title={range.name || range.id} count={rangeGPS.length}>
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Gamme</th>
                            <th>Vitrage (mm)</th>
                            <th>Parclose H</th>
                            <th>Qté H</th>
                            <th>Formule H</th>
                            <th>Parclose V</th>
                            <th>Qté V</th>
                            <th>Formule V</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rangeGPS.map((gc) => {
                            const i = data.glassProfileCompatibility.indexOf(gc);
                            return (
                              <tr key={i}>
                                <td data-label="Gamme">
                                  <select 
                                    className="input" value={gc.rangeId || ''} 
                                    onChange={e => handleUpdateGlassProfileCompatibility(i, 'rangeId', e.target.value)}
                                    style={{ width: '110px' }}>
                                    <option value="">Sélectionner...</option>
                                    {(data.ranges || []).map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                                  </select>
                                </td>
                                <td data-label="Vitrage">
                                  <input 
                                    className="input" type="number" value={gc.glassThickness || 0} 
                                    onChange={e => handleUpdateGlassProfileCompatibility(i, 'glassThickness', e.target.value)} 
                                    style={{ width: '50px' }} 
                                  />
                                </td>
                                <td data-label="Parclose H">
                                  <select 
                                    className="input" value={gc.profileHId || ''} 
                                    onChange={e => handleUpdateGlassProfileCompatibility(i, 'profileHId', e.target.value)}
                                    style={{ width: '140px' }}>
                                    <option value="">Sélectionner...</option>
                                    {(data?.profiles || [])
                                      .filter(p => p && (p.rangeIds || (p.rangeId ? [p.rangeId] : [])).includes(gc.rangeId))
                                      .map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)
                                    }
                                  </select>
                                </td>
                                <td data-label="Qté H">
                                  <input className="input" type="number" value={gc.qtyH || 0} 
                                    onChange={e => handleUpdateGlassProfileCompatibility(i, 'qtyH', e.target.value)} 
                                    style={{ width: '50px' }} 
                                  />
                                </td>
                                <td data-label="Formule H"><input className="input" value={gc.formulaH || ''} 
                                  onChange={e => handleUpdateGlassProfileCompatibility(i, 'formulaH', e.target.value)} 
                                  style={{ width: '80px' }} 
                                /></td>
                                <td data-label="Parcase V">
                                  <select 
                                    className="input" value={gc.profileVId || ''} 
                                    onChange={e => handleUpdateGlassProfileCompatibility(i, 'profileVId', e.target.value)}
                                    style={{ width: '140px' }}>
                                    <option value="">Sélectionner...</option>
                                    {(data?.profiles || [])
                                      .filter(p => p && (p.rangeIds || (p.rangeId ? [p.rangeId] : [])).includes(gc.rangeId))
                                      .map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)
                                    }
                                  </select>
                                </td>
                                <td data-label="Qté V">
                                  <input className="input" type="number" value={gc.qtyV || 0} 
                                    onChange={e => handleUpdateGlassProfileCompatibility(i, 'qtyV', e.target.value)} 
                                    style={{ width: '50px' }} 
                                  />
                                </td>
                                <td data-label="Formule V"><input className="input" value={gc.formulaV || ''} 
                                  onChange={e => handleUpdateGlassProfileCompatibility(i, 'formulaV', e.target.value)} 
                                  style={{ width: '80px' }} 
                                /></td>
                                <td data-label="Actions" style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                  <button className="btn" onClick={() => handleDuplicateItem('glassProfileCompatibility', gc)} style={{ padding: '0.4rem', color: '#6366f1' }} title="Dupliquer"><Copy size={16} /></button>
                                  <button className="btn" onClick={() => handleDeleteGlassProfileCompatibility(i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleGroup>
                )
              })}
              <button className="btn btn-secondary" onClick={() => handleAddItem('glassProfileCompatibility')} style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Plus size={16} /> Ajouter une Compatibilité
              </button>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5' }}>
                  <Info size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: '#3b82f6' }} />
                  <strong>Note sur les Parcloses :</strong> Le moteur de calcul génère 
                  automatiquement les débits <em>ParcloseH</em> (Horizontal) et <em>ParcloseV</em> (Vertical) 
                  pour chaque vitrage en utilisant le profilé compatible défini ici. 
                  <br />Ces lignes calculées apparaissent dans le devis mais ne sont pas ajoutées à votre bibliothèque de profilés.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'compositions' && (
            <div>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Catalogue des Modèles</h3>
                <button 
                  onClick={handleAddComposition}
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
                >
                  <Plus size={16} /> Nouveau Modèle
                </button>
              </div>

              {editingComposition ? (
                <div className="glass" style={{ padding: '1.5rem', border: '2px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>Édition du Modèle</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn" 
                        style={{ color: '#ef4444', borderColor: '#ef4444' }} 
                        onClick={() => {
                          if (handleDeleteComposition(editingComposition.id)) {
                            setEditingComposition(null);
                          }
                        }}
                      >
                        <Trash2 size={16} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                        Supprimer le modèle
                      </button>
                      <button className="btn" onClick={() => setEditingComposition(null)}>Fermer l'éditeur</button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 1fr 120px 1fr 120px', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="form-group">
                      <label className="label">Nom du Modèle</label>
                      <input 
                        className="input" 
                        value={editingComposition.name} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, name: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Catégorie</label>
                      <select 
                        className="input" 
                        value={editingComposition.categoryId || ''} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, categoryId: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }}
                      >
                        {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">Ouverture</label>
                      <select 
                        className="input" 
                        value={editingComposition.openingType || ''} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, openingType: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }}
                      >
                        <option value="Fixe">Fixe</option>
                        <option value="Ouvrant">Ouvrant</option>
                        <option value="Coulissant">Coulissant</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">Gamme Associée</label>
                      <select 
                        className="input" 
                        value={editingComposition.rangeId} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, rangeId: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }}
                      >
                        {data.ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">Sens par défaut</label>
                      <select 
                        className="input" 
                        value={editingComposition.defaultOpeningDirection || 'gauche'} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, defaultOpeningDirection: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }}
                      >
                        <option value="gauche">Gauche</option>
                        <option value="droit">Droit</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                      <input 
                        type="checkbox" 
                        id="hasGasket"
                        checked={editingComposition.hasGasket} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, hasGasket: e.target.checked };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }}
                      />
                      <label htmlFor="hasGasket" className="label" style={{ marginBottom: 0 }}>Joint</label>
                    </div>

                    <div className="form-group">
                      <label className="label">Dessin Technique (Coupe complète)</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                         <div style={{ 
                            width: '40px', height: '40px', borderRadius: '4px', background: 'white', 
                            overflow: 'hidden', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', cursor: 'pointer'
                          }}>
                            {editingComposition.technicalDrawing ? <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981' }}>OK</div> : <Layers size={14} style={{ color: '#64748b' }} />}
                            <input 
                              type="file" accept=".svg,image/*" 
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                              onChange={(e) => {
                                const f = e.target.files[0];
                                if(!f) return;
                                const reader = new FileReader();
                                reader.onload = (re) => {
                                  const updated = { ...editingComposition, technicalDrawing: re.target.result };
                                  setEditingComposition(updated);
                                  handleUpdateComposition(updated);
                                };
                                reader.readAsDataURL(f);
                              }}
                            />
                         </div>
                         <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {editingComposition.technicalDrawing ? "Coupe chargée" : "Aucune coupe"}
                         </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                    <div className="form-group">
                      <label className="label">Formule Largeur Vitrage (L-..)</label>
                      <input 
                        className="input" 
                        value={editingComposition.glassFormulaL || 'L-80'} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, glassFormulaL: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Formule Hauteur Vitrage (H-..)</label>
                      <input 
                        className="input" 
                        value={editingComposition.glassFormulaH || 'H-80'} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, glassFormulaH: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }} 
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Nombre de Vitrages</label>
                      <input 
                        className="input" 
                        value={editingComposition.glassFormulaQty || '1'} 
                        onChange={(e) => {
                          const updated = { ...editingComposition, glassFormulaQty: e.target.value };
                          setEditingComposition(updated);
                          handleUpdateComposition(updated);
                        }} 
                      />
                    </div>
                  </div>

                  <h5 style={{ marginBottom: '1rem' }}>Composants (Profilés & Accessoires)</h5>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Article</th>
                        <th>Repère / Label</th>
                        <th>Quantité</th>
                        <th>Formule (L, H)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingComposition.elements.map((el, i) => (
                        <tr key={i}>
                          <td>
                            <select 
                              className="input" 
                              value={el.type} 
                              onChange={(e) => {
                                const newType = e.target.value;
                                const newEls = [...editingComposition.elements];
                                newEls[i].type = newType;
                                newEls[i].id = newType === 'profile' ? data.profiles[0].id : data.accessories[0].id;
                                newEls[i].formula = newType === 'profile' ? 'L' : '1';
                                const updated = { ...editingComposition, elements: newEls };
                                setEditingComposition(updated);
                                handleUpdateComposition(updated);
                              }}
                            >
                              <option value="profile">Profilé</option>
                              <option value="accessory">Accessoire</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {(() => {
                                // Check if linked item is from a different range
                                if (el.type === 'profile') {
                                  const linked = data.profiles.find(p => p.id === el.id);
                                  const pLinkedRangeIds = linked ? (linked.rangeIds || (linked.rangeId ? [linked.rangeId] : [])) : [];
                                  const wrongRange = linked && editingComposition.rangeId && !pLinkedRangeIds.includes(editingComposition.rangeId);
                                  return (
                                    <>
                                      {wrongRange && (
                                        <span title={`⚠️ Ce profilé ([${pLinkedRangeIds.join('+')}]) n'appartient pas à la gamme ${editingComposition.rangeId} !`}
                                          style={{ fontSize: '1rem', cursor: 'help', color: '#f59e0b' }}>⚠️</span>
                                      )}
                                      <select 
                                        className="input" 
                                        value={el.id}
                                        onChange={(e) => {
                                          const newEls = [...editingComposition.elements];
                                          newEls[i].id = e.target.value;
                                          const updated = { ...editingComposition, elements: newEls };
                                          setEditingComposition(updated);
                                          handleUpdateComposition(updated);
                                        }}
                                        style={{ borderColor: wrongRange ? '#f59e0b' : undefined }}
                                      >
                                        {data.profiles.map(p => {
                                          const pRangeIds = p.rangeIds || (p.rangeId ? [p.rangeId] : []);
                                          const inRange = !editingComposition.rangeId || pRangeIds.includes(editingComposition.rangeId);
                                          return (
                                            <option 
                                              key={p.id} 
                                              value={p.id}
                                              style={{ 
                                                background: inRange ? 'white' : '#475569', 
                                                color: inRange ? 'black' : 'white' 
                                              }}
                                            >
                                              {!inRange ? `[HORS GAMME] ` : ''}{p.name} ({p.id})
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </>
                                  );
                                } else {
                                  const linked = data.accessories.find(a => a.id === el.id);
                                  const wrongRange = linked && editingComposition.rangeId && !(linked.rangeIds || []).includes(editingComposition.rangeId);
                                  return (
                                    <>
                                      {wrongRange && (
                                        <span title={`⚠️ Cet accessoire n'est pas compatiblee avec la gamme ${editingComposition.rangeId} !`}
                                          style={{ fontSize: '1rem', cursor: 'help', color: '#f59e0b' }}>⚠️</span>
                                      )}
                                      <select 
                                        className="input" 
                                        value={el.id}
                                        onChange={(e) => {
                                          const newEls = [...editingComposition.elements];
                                          newEls[i].id = e.target.value;
                                          const updated = { ...editingComposition, elements: newEls };
                                          setEditingComposition(updated);
                                          handleUpdateComposition(updated);
                                        }}
                                        style={{ borderColor: wrongRange ? '#f59e0b' : undefined }}
                                      >
                                        {data.accessories.map(a => {
                                          const inRange = !editingComposition.rangeId || (a.rangeIds || []).includes(editingComposition.rangeId);
                                          return (
                                            <option 
                                              key={a.id} 
                                              value={a.id}
                                              style={{ 
                                                background: inRange ? 'white' : '#475569', 
                                                color: inRange ? 'black' : 'white' 
                                              }}
                                            >
                                              {!inRange ? `[HORS GAMME] ` : ''}{a.name} ({a.id})
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </>
                                  );
                                }
                              })()}
                            </div>
                          </td>
                          <td>
                            <input 
                              className="input" 
                              value={el.label} 
                              onChange={(e) => {
                                const newEls = [...editingComposition.elements];
                                newEls[i].label = e.target.value;
                                const updated = { ...editingComposition, elements: newEls };
                                setEditingComposition(updated);
                                handleUpdateComposition(updated);
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              className="input" 
                              type="number" 
                              value={el.qty} 
                              onChange={(e) => {
                                const newEls = [...editingComposition.elements];
                                newEls[i].qty = parseFloat(e.target.value) || 0;
                                const updated = { ...editingComposition, elements: newEls };
                                setEditingComposition(updated);
                                handleUpdateComposition(updated);
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              className="input" 
                              value={el.formula} 
                              onChange={(e) => {
                                const newEls = [...editingComposition.elements];
                                newEls[i].formula = e.target.value;
                                const updated = { ...editingComposition, elements: newEls };
                                setEditingComposition(updated);
                                handleUpdateComposition(updated);
                              }}
                            />
                          </td>
                          <td>
                            <button 
                              className="btn" 
                              onClick={() => {
                                const newEls = editingComposition.elements.filter((_, idx) => idx !== i);
                                const updated = { ...editingComposition, elements: newEls };
                                setEditingComposition(updated);
                                handleUpdateComposition(updated);
                              }}
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '100%', marginTop: '1rem' }}
                    onClick={() => handleAddElement(editingComposition.id)}
                  >
                    <Plus size={16} /> Ajouter un composant
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {data.compositions.map(comp => (
                    <div key={comp.id} className="glass" style={{ padding: '1rem', border: comp._isNew ? '2px solid #22c55e' : '1px solid #e2e8f0', background: comp._isNew ? '#dcfce7' : 'white', transition: 'all 0.5s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, color: '#1e293b' }}>{comp.name}</h4>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn" 
                            style={{ padding: '0.3rem' }} 
                            title="Éditer"
                            onClick={() => setEditingComposition(comp)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="btn" 
                            style={{ padding: '0.3rem', color: '#ef4444' }} 
                            title="Supprimer"
                            onClick={() => handleDeleteComposition(comp.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input type="checkbox" checked={comp.hasGasket} readOnly />
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Comporte Joint Vitrage</span>
                      </div>
                      <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#64748b' }}>Gamme: <span style={{ fontWeight: 600 }}>{comp.rangeId}</span></p>
                      <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#64748b' }}>Catégorie: <span style={{ fontWeight: 600 }}>{comp.categoryId}</span> - <span style={{ fontWeight: 600 }}>{comp.openingType}</span></p> 
                      <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#64748b' }}>Composants: <span style={{ fontWeight: 600 }}>{comp.elements.length}</span></p>
                      
                      <div style={{ marginTop: '1rem' }}>
                        <table className="data-table" style={{ fontSize: '0.75rem' }}>
                          <thead>
                            <tr>
                              <th>Élément</th>
                              <th>Formule</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comp.elements.slice(0, 3).map((el, i) => (
                              <tr key={i}>
                                <td>{el.id}</td>
                                <td>{el.formula}</td>
                              </tr>
                            ))}
                            {comp.elements.length > 3 && (
                              <tr><td colSpan="2" style={{ textAlign: 'center', color: '#94a3b8' }}>... +{comp.elements.length - 3} autres</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'options' && (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom de l'Option</th>
                    <th>Gamme Associée</th>
                    <th>Accessoire Inclus</th>
                    <th>Formule Qté</th>
                    <th>Remplace Accessoire (Facultatif)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.options?.map((opt, idx) => (
                    <tr key={`${opt.id}-${idx}`}>
                      <td>
                        <input 
                          className="input" 
                          value={opt.name} 
                          onChange={e => handleUpdateItem('options', opt.id, 'name', e.target.value, idx)} 
                          style={{ width: '180px' }} 
                        />
                      </td>
                      <td>
                        <MultiSelectRange 
                          selectedIds={opt.rangeIds || []} 
                          allRanges={data.ranges} 
                          onChange={newIds => handleUpdateItem('options', opt.id, 'rangeIds', newIds, idx)} 
                        />
                      </td>
                      <td>
                        <select 
                          className="input" 
                          value={opt.addAccessoryId} 
                          onChange={e => handleUpdateItem('options', opt.id, 'addAccessoryId', e.target.value, idx)}
                          style={{ width: '200px' }}>
                          <option value="">(Aucun)</option>
                          {data.accessories.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input 
                          className="input" 
                          value={opt.formula} 
                          onChange={e => handleUpdateItem('options', opt.id, 'formula', e.target.value, idx)} 
                          style={{ width: '100px' }} 
                        />
                      </td>
                      <td>
                        <select 
                          className="input" 
                          value={opt.removeAccessoryId || ''} 
                          onChange={e => handleUpdateItem('options', opt.id, 'removeAccessoryId', e.target.value, idx)}
                          style={{ width: '200px' }}>
                          <option value="">(Ne rien supprimer)</option>
                          {data.accessories.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="btn" onClick={() => handleDeleteItem('options', opt.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="6">
                      <button className="btn btn-secondary" onClick={() => handleAddItem('options')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Ajouter une Option
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'volets' && (() => {
            const shutterFamilies = [
              { key: 'caissons',    label: 'Caissons' },
              { key: 'lames',       label: 'Lames' },
              { key: 'lameFinales', label: 'Lames Finales' },
              { key: 'glissieres',  label: 'Glissières' },
              { key: 'axes',        label: 'Axes' },
              { key: 'moteurs',     label: 'Moteurs' },
              { key: 'kits',        label: 'Kits Manœuvre' },
              { key: 'extras',      label: 'Composants Divers' }
            ];


            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {shutterFamilies.map(({ key, label }) => (
                  <div key={key}>
                    <h4 style={{ margin: '0 0 0.75rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem' }}>{label}</h4>
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <table className="data-table" style={{ minWidth: key === 'glissieres' ? '1200px' : '100%', marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>Désignation</th>
                          {key === 'caissons' && (
                            <>
                              <th>Hauteur (mm)</th>
                              <th>Prix Joint HSF</th>
                              <th>Formule Joint</th>
                            </>
                          )}
                          {key === 'lames' && (
                            <>
                              <th>Baguette (Oui)</th>
                              <th>Prix Baguette (ML)</th>
                            </>
                          )}
                          {key === 'glissieres' && (
                            <>
                              <th>Gamme</th>
                              <th>Type (Auto)</th>
                              <th>Épaisseur L (mm)</th>
                            </>
                          )}
                          {key === 'glissieres' ? (
                            <>
                              <th>Option 1 (Nom)</th>
                              <th>Option 1 (Valeurs)</th>
                              <th>Option 1 (Prix)</th>
                              <th>Option 2 (Nom)</th>
                              <th>Option 2 (Valeurs)</th>
                              <th>Option 2 (Prix)</th>
                            </>
                          ) : null}

                          {key !== 'extras' && <th>Lg Barre (mm)</th>}
                          {key !== 'extras' && <th>Seuil Chute</th>}

                          <th>Formule Quantité (Nb)</th>
                          <th>Formule Dimension (L/H)</th>
                          <th>Unité</th>
                          <th>Prix (DZD)</th>
                          <th>Add-ons (JSON)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.shutterComponents?.[key] || []).map((item, i) => (
                          <tr key={item.id} style={item._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                             <td><input className="input" value={item.name} onChange={e => updateShutterItem(key, i, 'name', e.target.value)} style={{ width: '180px' }} /></td>
                            {key === 'caissons' && (
                              <>
                                <td><input className="input" type="number" value={item.height || 0} onChange={e => updateShutterItem(key, i, 'height', e.target.value)} style={{ width: '80px' }} /></td>
                                <td><input className="input" type="number" step="0.01" value={item.jointPrice || 0} onChange={e => updateShutterItem(key, i, 'jointPrice', e.target.value)} style={{ width: '80px' }} /></td>
                                <td><input className="input" value={item.jointFormula || 'L/1000'} onChange={e => updateShutterItem(key, i, 'jointFormula', e.target.value)} style={{ width: '100px' }} /></td>
                              </>
                            )}
                            {key === 'lames' && (
                              <>
                                <td style={{ textAlign: 'center' }}>
                                  <input type="checkbox" checked={item.hasBaguette || false} onChange={e => updateShutterItem(key, i, 'hasBaguette', e.target.checked)} />
                                </td>
                                <td><input className="input" type="number" step="0.01" value={item.baguettePrice || 0} onChange={e => updateShutterItem(key, i, 'baguettePrice', e.target.value)} style={{ width: '90px' }} /></td>
                              </>
                            )}
                            {key === 'glissieres' && (
                              <>
                                <td>
                                  <select className="input" value={item.rangeId || ''} onChange={e => updateShutterItem(key, i, 'rangeId', e.target.value)} style={{ width: '90px' }}>
                                    <option value="">Toutes</option>
                                    {data.ranges.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                                  </select> 
                                </td>
                                <td>
                                  <select className="input" value={item.shutterType || 'OTHER'} onChange={e => updateShutterItem(key, i, 'shutterType', e.target.value)} style={{ width: '90px' }}>
                                  <option value="MONO">Mono (Sangle)</option>
                                  <option value="PALA">Pala (Moteur)</option>
                                  <option value="OTHER">Autre</option>
                                </select>
                                </td>
                                <td><input className="input" type="number" step="1" value={item.thickness || 0} onChange={e => updateShutterItem(key, i, 'thickness', e.target.value)} style={{ width: '80px' }} /></td>
                              </>
                            )}
                            {key === 'glissieres' ? (
                              <>
                                <td><input className="input" value={item.opt1Label || ''} onChange={e => updateShutterItem(key, i, 'opt1Label', e.target.value)} style={{ width: '120px', fontSize: '0.7rem' }} placeholder="Ex: Largeur" /></td>
                                <td><input className="input" value={item.opt1Values || ''} onChange={e => updateShutterItem(key, i, 'opt1Values', e.target.value)} style={{ width: '150px', fontSize: '0.7rem' }} placeholder="Ex: 85, 120" /></td>
                                <td><input className="input" value={item.opt1Prices || ''} onChange={e => updateShutterItem(key, i, 'opt1Prices', e.target.value)} style={{ width: '120px', fontSize: '0.7rem' }} placeholder="Ex: 200, 500" /></td>
                                <td><input className="input" value={item.opt2Label || ''} onChange={e => updateShutterItem(key, i, 'opt2Label', e.target.value)} style={{ width: '120px', fontSize: '0.7rem' }} placeholder="Ex: Épaisseur" /></td>
                                <td><input className="input" value={item.opt2Values || ''} onChange={e => updateShutterItem(key, i, 'opt2Values', e.target.value)} style={{ width: '150px', fontSize: '0.7rem' }} placeholder="Ex: 120, 150" /></td>
                                <td><input className="input" value={item.opt2Prices || ''} onChange={e => updateShutterItem(key, i, 'opt2Prices', e.target.value)} style={{ width: '120px', fontSize: '0.7rem' }} placeholder="Ex: 100, 300" /></td>
                              </>
                            ) : null}
                            {key !== 'extras' && <td><input className="input" type="number" value={item.barLength || 6400} onChange={e => updateShutterItem(key, i, 'barLength', e.target.value)} style={{ width: '90px', fontSize: '0.8rem' }} /></td>}
                            {key !== 'extras' && <td><input className="input" type="number" value={item.scrapThreshold || 0} onChange={e => updateShutterItem(key, i, 'scrapThreshold', e.target.value)} style={{ width: '90px', fontSize: '0.8rem' }} placeholder="Ex: 500" /></td>}

                            <td><input className="input" value={item.formula || '1'} onChange={e => updateShutterItem(key, i, 'formula', e.target.value)} style={{ width: '120px' }} placeholder="Ex: ceil(H/39)" /></td>
                            <td><input className="input" value={item.cuttingFormula || ''} onChange={e => updateShutterItem(key, i, 'cuttingFormula', e.target.value)} style={{ width: '120px' }} placeholder="Ex: L-10" /></td>
                            <td>
                              <select className="input" value={item.priceUnit} onChange={e => updateShutterItem(key, i, 'priceUnit', e.target.value)} style={{ width: '90px' }}>
                                <option>ML</option>
                                <option>M2</option>
                                <option>Unité</option>
                                <option>Barre</option>
                                <option>Joint</option>
                              </select>
                            </td>
                            <td><input className="input" type="number" step="0.01" value={item.price} onChange={e => updateShutterItem(key, i, 'price', e.target.value)} style={{ width: '100px' }} /></td>
                            <td>
                              <button className="base-btn btn-secondary" onClick={() => setEditingAddonItem({ family: key, idx: i, item, isShutter: true })} style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}>
                                 🔧 Options ({item.addOns?.length || 0})
                              </button>
                            </td>
                            <td><button className="btn" onClick={() => deleteShutterItem(key, i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>


                          </tr>
                        ))}
                        <tr>
                          <td colSpan={key === 'glissieres' ? 15 : (key === 'caissons' ? 10 : 9)}>
                            <button className="btn btn-secondary" onClick={() => addShutterItem(key)} style={{ width: '100%', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              <Plus size={16} /> Ajouter
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                ))}
              </div>
            );
          })()}

          {activeTab === 'traverses' && (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Désignation (Commercial)</th>
                    <th>Rôle Technique (AUTO)</th>
                    <th>Profilé à utiliser</th>
                    <th>Gammes Compatibles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.traverses || []).map((trv, idx) => (
                    <tr key={`${trv.id}-${idx}`} style={trv._isNew ? { background: '#dcfce7', transition: 'background 1s' } : {}}>
                      <td><input className="input" value={trv.name} onChange={e => handleUpdateItem('traverses', trv.id, 'name', e.target.value, idx)} style={{ width: '220px' }} placeholder="Ex: Traverse renforcée H" /></td>
                      <td>
                        <select className="input" value={trv.role} onChange={e => handleUpdateItem('traverses', trv.id, 'role', e.target.value, idx)} style={{ width: '160px' }}>
                          <option value="traverse_h">Traverse Horizontale (Division H)</option>
                          <option value="traverse_l">Traverse Verticale (Division L)</option>
                          <option value="union_h">Union Horizontale (Assemblage H)</option>
                          <option value="union_l">Union Verticale (Assemblage L)</option>
                        </select>
                      </td>
                      <td>
                        <select className="input" value={trv.profileId || ''} onChange={e => handleUpdateItem('traverses', trv.id, 'profileId', e.target.value, idx)} style={{ width: '250px' }}>
                          <option value="">-- Choisir un profilé de JONCTION --</option>
                          {data.profiles.filter(p => p.category === 'divider').map(p => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <MultiSelectRange 
                          selectedIds={trv.rangeIds || []} 
                          allRanges={data.ranges} 
                          onChange={newIds => handleUpdateItem('traverses', trv.id, 'rangeIds', newIds, idx)} 
                        />
                      </td>
                      <td><button className="btn" onClick={() => handleDeleteItem('traverses', trv.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan="5">
                      <button className="btn btn-secondary" onClick={() => handleAddItem('traverses')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Ajouter une Traverse/Union au catalogue
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: '2rem', padding: '1rem', background: '#eff6ff', borderRadius: '0.75rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <AlertCircle size={20} color="#3b82f6" style={{ marginTop: '0.2rem' }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#1d4ed8', fontSize: '0.875rem' }}>Aide: Formules de calcul</p>
              <p style={{ margin: '0.2rem 0 0 0', color: '#3b82f6', fontSize: '0.875rem', lineHeight: '1.5' }}>
                Variables utilisables :<br />
                • <strong>L</strong> : Largeur totale (mm)<br />
                • <strong>H</strong> : Hauteur totale (mm)<br />
                • <strong>HC</strong> : Hauteur du Caisson (mm) - <i>Uniquement pour les composants du volet</i><br />
                <br />
                Fonctions mathématiques autorisées : <i>ceil, floor, abs, sqrt, + , - , * , /</i><br />
                <br />
                * Les modifications impactent directement le module Commercial pour les nouveaux devis.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* FLOATING ADD BUTTON */}
      {['ranges', 'profiles', 'glass', 'colors', 'accessories', 'categories', 'compositions', 'options', 'traverses'].includes(activeTab) && (
        <button 
          onClick={() => activeTab === 'compositions' ? handleAddComposition() : handleAddItem(activeTab)}
          title={`Ajouter ${activeTab === 'compositions' ? 'un modèle' : 'un élément'}`}
          style={{
            position: 'fixed',
            bottom: '2.5rem',
            right: '2.5rem',
            width: '64px',
            height: '64px',
            borderRadius: '32px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1) translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 15px 30px -5px rgba(37, 99, 235, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.5)';
          }}
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default AdminDashboard;

