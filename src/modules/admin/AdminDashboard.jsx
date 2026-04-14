import React, { useState } from 'react';
import { Package, Search, Plus, Trash2, Save, Download, Upload, AlertCircle, RefreshCw, Layers, Edit2, ChevronDown, Check, FileSpreadsheet, Info } from 'lucide-react';
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
    <div style={{ position: 'relative', width: '120px' }}>
      <button 
        className="input" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', background: 'white' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedIds.length === 0 ? 'Aucune' : selectedIds.length === allRanges.length ? 'Toutes' : `${selectedIds.length} gammes`}
        </span>
        <ChevronDown size={14} />
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

const AdminDashboard = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState('ranges');
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
      elements: []
    };
    setData(prev => ({ ...prev, compositions: [...prev.compositions, newComp] }));
    setEditingComposition(newComp);
  };

  const handleDeleteComposition = (id) => {
    setData(prev => ({ ...prev, compositions: prev.compositions.filter(c => c.id !== id) }));
    return true;
  };

  const handleAddItem = (category) => {
    const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    const defaultData = {
      ranges: { id: generateId('G'), name: 'Nouvelle Gamme', minL: 500, maxL: 2000, minH: 500, maxH: 2000 },
      profiles: { id: generateId('P'), name: 'Nouveau Profilé', rangeId: data.ranges?.[0]?.id || '', weightPerM: 1.0, pricePerKg: 5.0, barLength: 6000, colors: ['RAL9016'], type: 'ALU' },
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
      [category]: [...prev[category], defaultData[category]]
    }));
  };

  const handleUpdateItem = (category, id, field, value, index = -1) => {
    // Safety check for ID uniqueness
    if (field === 'id') {
      const exists = data[category].some((item, idx) => item.id === value && idx !== index && item.id !== id);
      if (exists) {
        alert("Cet identifiant existe déjà dans cette catégorie. Veuillez en choisir un autre.");
        return;
      }
    }

    setData(prev => {
      const updated = [...prev[category]];
      const parseValue = (val, prevVal) => {
        if (Array.isArray(prevVal)) return val; // Keep arrays as is
        if (typeof prevVal === 'number' || ['price', 'pricePerKg', 'pricePerBar', 'weightPerM', 'pricePerM2', 'factor', 'minL', 'maxL', 'minH', 'maxH'].includes(field)) {
          return parseFloat(val) || 0;
        }
        return val;
      };

      if (index !== -1 && index < updated.length) {
        updated[index] = { 
          ...updated[index], 
          [field]: parseValue(value, updated[index][field])
        };
      } else {
        return {
          ...prev,
          [category]: prev[category].map(item => item.id === id ? { 
            ...item, 
            [field]: parseValue(value, item[field])
          } : item)
        };
      }
      return { ...prev, [category]: updated };
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
    updated[index][field] = field === 'glassThickness' ? parseFloat(value) || 0 : value;
    setData(prev => ({ ...prev, gasketCompatibility: updated }));
  };

  const handleUpdateComposition = (updated) => {
    setData(prev => ({
      ...prev,
      compositions: prev.compositions.map(c => c.id === updated.id ? updated : c)
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
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const importedData = XLSX.utils.sheet_to_json(ws);
      
      console.log('Imported Excel Data:', importedData);
      alert(`${importedData.length} lignes importées avec succès !`);
      // Integration logic would go here to update prices in state
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

      <div className="glass shadow-lg" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
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
            { id: 'traverses', label: 'Traverses' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 1.5rem',
                border: 'none',
                background: activeTab === tab.id ? 'white' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab.id ? '#2563eb' : '#64748b',
                fontWeight: activeTab === tab.id ? 600 : 500,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.5rem' }}>
          {activeTab === 'categories' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code Catégorie</th>
                  <th>Nom de la Catégorie</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((cat, idx) => (
                  <tr key={`${cat.id}-${idx}`}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" value={cat.id} onChange={e => handleUpdateItem('categories', cat.id, 'id', e.target.value, idx)} style={{ width: '150px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={cat.name} onChange={e => handleUpdateItem('categories', cat.id, 'name', e.target.value, idx)} style={{ width: '300px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('categories', cat.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
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
          )}

          {activeTab === 'ranges' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom de la Gamme</th>
                  <th>L min (mm)</th>
                  <th>L max (mm)</th>
                  <th>H min (mm)</th>
                  <th>H max (mm)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.ranges.map((range, idx) => (
                  <tr key={`${range.id}-${idx}`}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" value={range.id} onChange={e => handleUpdateItem('ranges', range.id, 'id', e.target.value, idx)} style={{ width: '80px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={range.name} onChange={e => handleUpdateItem('ranges', range.id, 'name', e.target.value, idx)} style={{ width: '150px' }} /></td>
                    <td><input className="input" type="number" value={range.minL} onChange={e => handleUpdateItem('ranges', range.id, 'minL', e.target.value, idx)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={range.maxL} onChange={e => handleUpdateItem('ranges', range.id, 'maxL', e.target.value, idx)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={range.minH} onChange={e => handleUpdateItem('ranges', range.id, 'minH', e.target.value, idx)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={range.maxH} onChange={e => handleUpdateItem('ranges', range.id, 'maxH', e.target.value, idx)} style={{ width: '80px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('ranges', range.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="7">
                    <button className="btn btn-secondary" onClick={() => handleAddItem('ranges')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter une Gamme
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'profiles' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Gamme</th>
                  <th>Désignation</th>
                  <th>Long. Barre (mm)</th>
                  <th>Couleurs dispo.</th>
                  <th>Prix Achat (DZD/Barre)</th>
                  <th style={{ textAlign: 'right' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} 
                      onClick={() => {
                        const unique = [];
                        const seen = new Set();
                        data.profiles.forEach(p => {
                          if (!seen.has(p.id)) {
                            unique.push(p);
                            seen.add(p.id);
                          }
                        });
                        if (unique.length < data.profiles.length) {
                          setData(prev => ({ ...prev, profiles: unique }));
                          alert(`${data.profiles.length - unique.length} doublons supprimés.`);
                        } else {
                          alert("Aucun doublon détecté.");
                        }
                      }}
                    >
                      Dédoublonner
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.profiles.map((p, idx) => (
                  <tr key={`${p.id}-${idx}`}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" value={p.id} onChange={e => handleUpdateItem('profiles', p.id, 'id', e.target.value, idx)} style={{ width: '100px', fontWeight: 600 }} />
                    </td>
                    <td>
                      <select className="input" value={p.rangeId} onChange={e => handleUpdateItem('profiles', p.id, 'rangeId', e.target.value, idx)} style={{ width: '100px' }}>
                        {data.ranges.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                      </select>
                    </td>
                    <td><input className="input" value={p.name} onChange={e => handleUpdateItem('profiles', p.id, 'name', e.target.value, idx)} style={{ width: '180px' }} /></td>
                    <td><input className="input" type="number" value={p.barLength} onChange={e => handleUpdateItem('profiles', p.id, 'barLength', e.target.value, idx)} style={{ width: '90px' }} /></td>
                    <td>
                      <input className="input" value={p.colors?.join(', ') || ''} onChange={e => handleUpdateItem('profiles', p.id, 'colors', e.target.value.split(',').map(s=>s.trim()), idx)} style={{ width: '150px' }} title="RAL9016, RAL7016..." />
                    </td>
                    <td><input className="input" type="number" value={p.pricePerBar || p.pricePerKg} onChange={e => handleUpdateItem('profiles', p.id, 'pricePerBar', e.target.value, idx)} style={{ width: '100px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('profiles', p.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="7">
                    <button className="btn btn-secondary" onClick={() => handleAddItem('profiles')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter un Profilé
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'glass' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th>Type</th>
                  <th>Composition</th>
                  <th>Spécification</th>
                  <th>Épaisseur (mm)</th>
                  <th>Prix Achat (DZD/m²)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.glass.map((g, idx) => (
                  <tr key={`${g.id}-${idx}`}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" value={g.id} onChange={e => handleUpdateItem('glass', g.id, 'id', e.target.value, idx)} style={{ width: '100px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={g.name} onChange={e => handleUpdateItem('glass', g.id, 'name', e.target.value, idx)} style={{ width: '180px' }} /></td>
                    <td>
                      <select className="input" value={g.type} onChange={e => handleUpdateItem('glass', g.id, 'type', e.target.value, idx)} style={{ width: '100px' }}>
                        <option value="SIMPLE">Simple</option>
                        <option value="DOUBLE">Double</option>
                        <option value="TRIPLE">Triple</option>
                        <option value="SPECIAL">Spécial</option>
                      </select>
                    </td>
                    <td><input className="input" value={g.composition} onChange={e => handleUpdateItem('glass', g.id, 'composition', e.target.value, idx)} style={{ width: '100px' }} /></td>
                    <td><input className="input" value={g.specification || 'Standard'} onChange={e => handleUpdateItem('glass', g.id, 'specification', e.target.value, idx)} style={{ width: '120px' }} /></td>
                    <td><input className="input" type="number" value={g.thickness} onChange={e => handleUpdateItem('glass', g.id, 'thickness', e.target.value, idx)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={g.pricePerM2} onChange={e => handleUpdateItem('glass', g.id, 'pricePerM2', e.target.value, idx)} style={{ width: '100px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('glass', g.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="7">
                    <button className="btn btn-secondary" onClick={() => handleAddItem('glass')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter un Vitrage
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'colors' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code / ID</th>
                  <th>Nom (Ex: RAL9016)</th>
                  <th>Code Couleur</th>
                  <th>Facteur Multiplicateur</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.colors.map((c, idx) => (
                  <tr key={`${c.id}-${idx}`}>
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
          )}

          {activeTab === 'accessories' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code Article</th>
                  <th>Gamme</th>
                  <th>Désignation</th>
                  <th>Unité de Vente</th>
                  <th>Prix Achat (DZD/Unité ou ML)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.accessories.map((acc, idx) => (
                  <tr key={`${acc.id}-${idx}`}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" value={acc.id} onChange={e => handleUpdateItem('accessories', acc.id, 'id', e.target.value, idx)} style={{ width: '100px', fontWeight: 600 }} />
                    </td>
                    <td>
                      <MultiSelectRange 
                        selectedIds={acc.rangeIds || []} 
                        allRanges={data.ranges} 
                        onChange={newIds => handleUpdateItem('accessories', acc.id, 'rangeIds', newIds, idx)} 
                      />
                    </td>
                    <td><input className="input" value={acc.name} onChange={e => handleUpdateItem('accessories', acc.id, 'name', e.target.value, idx)} style={{ width: '200px' }} /></td>
                    <td>
                      <select className="input" value={acc.unit} onChange={e => handleUpdateItem('accessories', acc.id, 'unit', e.target.value, idx)} style={{ width: '100px' }}>
                        <option value="Kit">Kit</option>
                        <option value="Ml">Ml</option>
                        <option value="Unité">Unité</option>
                        <option value="Joint">Joint</option>
                      </select>
                    </td>
                    <td><input className="input" type="number" step="0.01" value={acc.price} onChange={e => handleUpdateItem('accessories', acc.id, 'price', e.target.value, idx)} style={{ width: '100px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('accessories', acc.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="6">
                    <button className="btn btn-secondary" onClick={() => handleAddItem('accessories')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter un Accessoire
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'gaskets' && (
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
                {(data.gasketCompatibility || []).map((gc, i) => (
                  <tr key={i}>
                    <td>
                      <select 
                        className="input" 
                        value={gc.rangeId || ''} 
                        onChange={e => handleUpdateGasketCompatibility(i, 'rangeId', e.target.value)}
                        style={{ width: '120px' }}
                      >
                        {(data.ranges || []).map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                      </select>
                    </td>
                    <td>
                      <input 
                        className="input" 
                        type="number" 
                        value={gc.glassThickness || 0} 
                        onChange={e => handleUpdateGasketCompatibility(i, 'glassThickness', e.target.value)}
                        style={{ width: '100px' }} 
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
                        placeholder="(L+H)*2"
                      />
                    </td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteGasketCompatibility(i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="5">
                    <button className="btn btn-secondary" onClick={() => handleAddItem('gasketCompatibility')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter une Compatibilité
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'glassProfiles' && (
            <div>
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
                {(data?.glassProfileCompatibility || []).map((gc, i) => {
                   if (!gc) return null;
                   return (
                   <tr key={`gp-${i}`}>
                     <td>
                       <select 
                         className="input" 
                         value={gc.rangeId || ''} 
                         onChange={e => {
                           const updated = [...(data.glassProfileCompatibility || [])];
                           updated[i].rangeId = e.target.value;
                           setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                         }}
                         style={{ width: '100px' }}>
                         {(data?.ranges || []).map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                       </select>
                     </td>
                     <td>
                       <input 
                         className="input" 
                         type="number" 
                         value={gc.glassThickness || 0} 
                         onChange={e => {
                           const updated = [...(data.glassProfileCompatibility || [])];
                           updated[i].glassThickness = parseFloat(e.target.value) || 0;
                           setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                         }} 
                         style={{ width: '60px' }} 
                       />
                     </td>
                     <td>
                       <select 
                         className="input" 
                         value={gc.profileHId || ''} 
                         onChange={e => {
                           const updated = [...(data.glassProfileCompatibility || [])];
                           updated[i].profileHId = e.target.value;
                           setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                         }}
                         style={{ width: '140px' }}>
                         <option value="">Sélectionner...</option>
                         {(data?.profiles || [])
                           .filter(p => p && (!gc.rangeId || p.rangeId === gc.rangeId))
                           .map(p => (
                             <option key={p.id} value={p.id}>{p.name || p.id}</option>
                           ))
                         }
                       </select>
                     </td>
                     <td>
                       <input 
                         className="input" 
                         type="number" 
                         value={gc.qtyH || 0} 
                         onChange={e => {
                           const updated = [...(data.glassProfileCompatibility || [])];
                           updated[i].qtyH = parseFloat(e.target.value) || 0;
                           setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                         }} 
                         style={{ width: '50px' }} 
                       />
                     </td>
                     <td>
                       <input 
                         className="input" 
                         value={gc.formulaH || ''} 
                         onChange={e => {
                           const updated = [...(data.glassProfileCompatibility || [])];
                           updated[i].formulaH = e.target.value;
                           setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                         }} 
                         style={{ width: '80px' }} 
                         placeholder="L-80"
                       />
                     </td>
                     <td>
                       <select 
                         className="input" 
                         value={gc.profileVId || ''} 
                         onChange={e => {
                           const updated = [...(data.glassProfileCompatibility || [])];
                           updated[i].profileVId = e.target.value;
                           setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                         }}
                         style={{ width: '140px' }}>
                         <option value="">Sélectionner...</option>
                         {(data?.profiles || [])
                           .filter(p => p && (!gc.rangeId || p.rangeId === gc.rangeId))
                           .map(p => (
                             <option key={p.id} value={p.id}>{p.name || p.id}</option>
                           ))
                         }
                       </select>
                     </td>
                      <td>
                        <input 
                          className="input" 
                          type="number" 
                          value={gc.qtyV || 0} 
                          onChange={e => {
                            const updated = [...(data.glassProfileCompatibility || [])];
                            updated[i].qtyV = parseFloat(e.target.value) || 0;
                            setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                          }} 
                          style={{ width: '50px' }} 
                        />
                      </td>
                      <td>
                        <input 
                          className="input" 
                          value={gc.formulaV || ''} 
                         onChange={e => {
                           const updated = [...(data.glassProfileCompatibility || [])];
                           updated[i].formulaV = e.target.value;
                           setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                         }} 
                         style={{ width: '100px' }} 
                         placeholder="H-80"
                       />
                     </td>
                     <td>
                       <button className="btn" onClick={() => handleDeleteGlassProfileCompatibility(i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                     </td>
                   </tr>
                 )})}
                <tr>
                    <td colSpan="9">
                      <button className="btn btn-secondary" onClick={() => handleAddItem('glassProfileCompatibility')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> Ajouter une Compatibilité
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

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
                                  const wrongRange = linked && editingComposition.rangeId && linked.rangeId !== editingComposition.rangeId;
                                  return (
                                    <>
                                      {wrongRange && (
                                        <span title={`⚠️ Ce profilé (${linked.rangeId}) n'appartient pas à la gamme ${editingComposition.rangeId} !`}
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
                                        {data.profiles.map(p => (
                                          <option key={p.id} value={p.id}>
                                            {p.rangeId !== editingComposition.rangeId ? `[${p.rangeId}] ` : ''}{p.name} ({p.id})
                                          </option>
                                        ))}
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
                                        {data.accessories.map(a => (
                                          <option key={a.id} value={a.id}>
                                            {!(a.rangeIds || []).includes(editingComposition.rangeId) ? `[Autre gamme] ` : ''}{a.name} ({a.id})
                                          </option>
                                        ))}
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
                    <div key={comp.id} className="glass" style={{ padding: '1rem', border: '1px solid #e2e8f0' }}>
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
          )}

          {activeTab === 'volets' && (() => {
            const shutterFamilies = [
              { key: 'caissons',   label: 'Caissons' },
              { key: 'lames',     label: 'Lames' },
              { key: 'glissieres',label: 'Glissières' },
              { key: 'axes',      label: 'Axes' },
              { key: 'kits',      label: 'Kits Manœuvre' }
            ];

            const updateShutterItem = (family, idx, field, value) => {
              setData(prev => {
                const updated = [...prev.shutterComponents[family]];
                updated[idx] = { ...updated[idx], [field]: field === 'price' ? parseFloat(value) || 0 : value };
                return { ...prev, shutterComponents: { ...prev.shutterComponents, [family]: updated } };
              });
            };

            const deleteShutterItem = (family, idx) => {
              setData(prev => {
                const updated = prev.shutterComponents[family].filter((_, i) => i !== idx);
                return { ...prev, shutterComponents: { ...prev.shutterComponents, [family]: updated } };
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
                barLength: 1,
                ...(family === 'caissons' ? { height: 185 } : {})
              };
              setData(prev => ({
                ...prev,
                shutterComponents: { ...prev.shutterComponents, [family]: [...prev.shutterComponents[family], newItem] }
              }));
            };

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
                          {key === 'caissons' && <th>Hauteur (mm)</th>}
                          {key === 'glissieres' && <th>Gamme</th>}
                          {key === 'glissieres' && <th>Type (Auto)</th>}
                          {key === 'glissieres' ? (
                            <>
                              <th>Option 1 (Nom)</th>
                              <th>Option 1 (Valeurs)</th>
                              <th>Option 2 (Nom)</th>
                              <th>Option 2 (Valeurs)</th>
                            </>
                          ) : null}
                          <th>Lg Barre (mm)</th>
                          <th>Formule Qté</th>
                          <th>Unité</th>
                          <th>Prix (DZD)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.shutterComponents?.[key] || []).map((item, i) => (
                          <tr key={item.id}>
                            <td><input className="input" value={item.name} onChange={e => updateShutterItem(key, i, 'name', e.target.value)} style={{ width: '180px' }} /></td>
                            {key === 'caissons' && (
                              <td><input className="input" type="number" value={item.height || 0} onChange={e => updateShutterItem(key, i, 'height', e.target.value)} style={{ width: '80px' }} /></td>
                            )}
                            {key === 'glissieres' && (
                              <td>
                                <select className="input" value={item.rangeId || ''} onChange={e => updateShutterItem(key, i, 'rangeId', e.target.value)} style={{ width: '90px' }}>
                                  <option value="">Toutes</option>
                                  {data.ranges.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                                </select>
                              </td>
                            )}
                            {key === 'glissieres' && (
                              <td>
                                <select className="input" value={item.shutterType || 'OTHER'} onChange={e => updateShutterItem(key, i, 'shutterType', e.target.value)} style={{ width: '90px' }}>
                                  <option value="MONO">Mono (Sangle)</option>
                                  <option value="PALA">Pala (Moteur)</option>
                                  <option value="OTHER">Autre</option>
                                </select>
                              </td>
                            )}
                            {key === 'glissieres' ? (
                              <>
                                <td><input className="input" value={item.opt1Label || ''} onChange={e => updateShutterItem(key, i, 'opt1Label', e.target.value)} style={{ width: '120px', fontSize: '0.7rem' }} placeholder="Ex: Largeur" /></td>
                                <td><input className="input" value={item.opt1Values || ''} onChange={e => updateShutterItem(key, i, 'opt1Values', e.target.value)} style={{ width: '150px', fontSize: '0.7rem' }} placeholder="Ex: 85, 120" /></td>
                                <td><input className="input" value={item.opt2Label || ''} onChange={e => updateShutterItem(key, i, 'opt2Label', e.target.value)} style={{ width: '120px', fontSize: '0.7rem' }} placeholder="Ex: Épaisseur" /></td>
                                <td><input className="input" value={item.opt2Values || ''} onChange={e => updateShutterItem(key, i, 'opt2Values', e.target.value)} style={{ width: '150px', fontSize: '0.7rem' }} placeholder="Ex: 120, 150" /></td>
                              </>
                            ) : null}
                            <td><input className="input" type="number" value={item.barLength || 6400} onChange={e => updateShutterItem(key, i, 'barLength', e.target.value)} style={{ width: '90px', fontSize: '0.8rem' }} /></td>
                            <td><input className="input" value={item.formula || ''} onChange={e => updateShutterItem(key, i, 'formula', e.target.value)} style={{ width: '140px' }} /></td>
                            <td>
                              <select className="input" value={item.priceUnit} onChange={e => updateShutterItem(key, i, 'priceUnit', e.target.value)} style={{ width: '90px' }}>
                                <option>ML</option>
                                <option>M2</option>
                                <option>Unité</option>
                                <option>Barre</option>
                              </select>
                            </td>
                            <td><input className="input" type="number" step="0.01" value={item.price} onChange={e => updateShutterItem(key, i, 'price', e.target.value)} style={{ width: '100px' }} /></td>
                            <td><button className="btn" onClick={() => deleteShutterItem(key, i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={key === 'glissieres' ? 8 : (key === 'caissons' ? 7 : 6)}>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Type</th>
                  <th>Usage</th>
                  <th>Profilé Associé</th>
                  <th>Formule Qté</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data.traverses || []).map((trv, idx) => (
                  <tr key={`${trv.id}-${idx}`}>
                    <td><input className="input" value={trv.name} onChange={e => handleUpdateItem('traverses', trv.id, 'name', e.target.value, idx)} style={{ width: '190px' }} /></td>
                    <td>
                      <select className="input" value={trv.type} onChange={e => handleUpdateItem('traverses', trv.id, 'type', e.target.value, idx)} style={{ width: '120px' }}>
                        <option value="horizontale">Horizontale</option>
                        <option value="verticale">Verticale</option>
                      </select>
                    </td>
                    <td>
                      <select className="input" value={trv.usage} onChange={e => handleUpdateItem('traverses', trv.id, 'usage', e.target.value, idx)} style={{ width: '140px' }}>
                        <option value="fenetre">Fenêtre</option>
                        <option value="porte">Porte</option>
                        <option value="pf">Porte-Fenêtre</option>
                        <option value="coulissant">Coulissant</option>
                        <option value="universal">Universel</option>
                      </select>
                    </td>
                    <td>
                      <select className="input" value={trv.profileId || ''} onChange={e => handleUpdateItem('traverses', trv.id, 'profileId', e.target.value, idx)} style={{ width: '200px' }}>
                        <option value="">(Aucun profil)</option>
                        {data.profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                      </select>
                    </td>
                    <td><input className="input" value={trv.formula || 'L'} onChange={e => handleUpdateItem('traverses', trv.id, 'formula', e.target.value, idx)} style={{ width: '100px' }} /></td>
                    <td><button className="btn" onClick={() => handleDeleteItem('traverses', trv.id, idx)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="6">
                    <button className="btn btn-secondary" onClick={() => handleAddItem('traverses')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter une Traverse
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
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
    </div>
  );
};

export default AdminDashboard;
