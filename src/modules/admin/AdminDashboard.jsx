import React, { useState } from 'react';
import { Package, Search, Plus, Trash2, Save, Download, Upload, AlertCircle, RefreshCw, Layers, Edit2, ChevronDown, Check, FileSpreadsheet } from 'lucide-react';
import { DEFAULT_DATA } from '../../data/default-data';
import * as XLSX from 'xlsx';

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
    const defaultData = {
      ranges: { id: `G-${Date.now().toString().slice(-4)}`, name: 'Nouvelle Gamme', minL: 500, maxL: 2000, minH: 500, maxH: 2000 },
      profiles: { id: `P-${Date.now().toString().slice(-4)}`, name: 'Nouveau Profilé', rangeId: data.ranges?.[0]?.id || '', weightPerM: 1.0, pricePerKg: 5.0, barLength: 6000, colors: ['RAL9016'], type: 'ALU' },
      glass: { id: `V-${Date.now().toString().slice(-4)}`, name: 'Nouveau Vitrage', type: 'SIMPLE', composition: '4', specification: 'Standard', thickness: 4, weightPerM2: 10, pricePerM2: 20 },
      colors: { id: `C-${Date.now().toString().slice(-4)}`, name: 'Nouvelle Couleur', hex: '#FFFFFF', factor: 1.0 },
      accessories: { id: `A-${Date.now().toString().slice(-4)}`, name: 'Nouvel Accessoire', unit: 'Unité', price: 5.0 },
      categories: { id: `CAT-${Date.now().toString().slice(-4)}`, name: 'Nouvelle Catégorie' },
      gasketCompatibility: { rangeId: data.ranges?.[0]?.id || '', glassThickness: 4, gasketId: data.accessories.find(a => a.unit === 'Joint')?.id || '', formula: '(L+H)*2' },
      glassProfileCompatibility: { rangeId: data.ranges?.[0]?.id || '', glassThickness: 4, profileId: data.profiles?.[0]?.id || '', formula: '(L+H)*2' },
      options: { id: `OPT-${Date.now().toString().slice(-4)}`, name: 'Nouvelle Option', rangeId: data.ranges?.[0]?.id || '', addAccessoryId: data.accessories?.[0]?.id || '', removeAccessoryId: '', formula: '1' },
      traverses: { id: `TRV-${Date.now().toString().slice(-4)}`, name: 'Nouvelle Traverse', type: 'horizontale', usage: 'fenetre', profileId: '', formula: 'L', priceUnit: 'ML' }
    };

    setData(prev => ({
      ...prev,
      [category]: [...prev[category], defaultData[category]]
    }));
  };

  const handleDeleteItem = (category, id) => {
    setData(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item.id !== id)
    }));
  };

  const handleUpdateItem = (category, id, field, value) => {
    setData(prev => ({
      ...prev,
      [category]: prev[category].map(item => item.id === id ? { ...item, [field]: field === 'price' || field === 'pricePerKg' || field === 'pricePerBar' || field === 'weightPerM' || field === 'pricePerM2' || field === 'factor' || field === 'minL' || field === 'maxL' || field === 'minH' || field === 'maxH' || typeof item[field] === 'number' ? parseFloat(value) || 0 : value } : item)
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
                {data.categories.map(cat => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" defaultValue={cat.id} onBlur={e => handleUpdateItem('categories', cat.id, 'id', e.target.value)} style={{ width: '150px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={cat.name} onChange={e => handleUpdateItem('categories', cat.id, 'name', e.target.value)} style={{ width: '300px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('categories', cat.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
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
                {data.ranges.map(range => (
                  <tr key={range.id}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" defaultValue={range.id} onBlur={e => handleUpdateItem('ranges', range.id, 'id', e.target.value)} style={{ width: '80px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={range.name} onChange={e => handleUpdateItem('ranges', range.id, 'name', e.target.value)} style={{ width: '150px' }} /></td>
                    <td><input className="input" type="number" value={range.minL} onChange={e => handleUpdateItem('ranges', range.id, 'minL', e.target.value)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={range.maxL} onChange={e => handleUpdateItem('ranges', range.id, 'maxL', e.target.value)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={range.minH} onChange={e => handleUpdateItem('ranges', range.id, 'minH', e.target.value)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={range.maxH} onChange={e => handleUpdateItem('ranges', range.id, 'maxH', e.target.value)} style={{ width: '80px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('ranges', range.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.profiles.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" defaultValue={p.id} onBlur={e => handleUpdateItem('profiles', p.id, 'id', e.target.value)} style={{ width: '100px', fontWeight: 600 }} />
                    </td>
                    <td>
                      <select className="input" value={p.rangeId} onChange={e => handleUpdateItem('profiles', p.id, 'rangeId', e.target.value)} style={{ width: '100px' }}>
                        {data.ranges.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                      </select>
                    </td>
                    <td><input className="input" value={p.name} onChange={e => handleUpdateItem('profiles', p.id, 'name', e.target.value)} style={{ width: '180px' }} /></td>
                    <td><input className="input" type="number" value={p.barLength} onChange={e => handleUpdateItem('profiles', p.id, 'barLength', e.target.value)} style={{ width: '90px' }} /></td>
                    <td>
                      <input className="input" value={p.colors?.join(', ') || ''} onChange={e => handleUpdateItem('profiles', p.id, 'colors', e.target.value.split(',').map(s=>s.trim()))} style={{ width: '150px' }} title="RAL9016, RAL7016..." />
                    </td>
                    <td><input className="input" type="number" value={p.pricePerBar || p.pricePerKg} onChange={e => handleUpdateItem('profiles', p.id, 'pricePerBar', e.target.value)} style={{ width: '100px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('profiles', p.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
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
                {data.glass.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" defaultValue={g.id} onBlur={e => handleUpdateItem('glass', g.id, 'id', e.target.value)} style={{ width: '100px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={g.name} onChange={e => handleUpdateItem('glass', g.id, 'name', e.target.value)} style={{ width: '180px' }} /></td>
                    <td>
                      <select className="input" value={g.type} onChange={e => handleUpdateItem('glass', g.id, 'type', e.target.value)} style={{ width: '100px' }}>
                        <option value="SIMPLE">Simple</option>
                        <option value="DOUBLE">Double</option>
                        <option value="TRIPLE">Triple</option>
                        <option value="SPECIAL">Spécial</option>
                      </select>
                    </td>
                    <td><input className="input" value={g.composition} onChange={e => handleUpdateItem('glass', g.id, 'composition', e.target.value)} style={{ width: '100px' }} /></td>
                    <td><input className="input" value={g.specification || 'Standard'} onChange={e => handleUpdateItem('glass', g.id, 'specification', e.target.value)} style={{ width: '120px' }} /></td>
                    <td><input className="input" type="number" value={g.thickness} onChange={e => handleUpdateItem('glass', g.id, 'thickness', e.target.value)} style={{ width: '80px' }} /></td>
                    <td><input className="input" type="number" value={g.pricePerM2} onChange={e => handleUpdateItem('glass', g.id, 'pricePerM2', e.target.value)} style={{ width: '100px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('glass', g.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
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
                {data.colors.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" defaultValue={c.id} onBlur={e => handleUpdateItem('colors', c.id, 'id', e.target.value)} style={{ width: '100px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={c.name} onChange={e => handleUpdateItem('colors', c.id, 'name', e.target.value)} style={{ width: '200px' }} /></td>
                    <td>
                      <input 
                        type="color" 
                        value={c.hex || '#ffffff'} 
                        onChange={e => handleUpdateItem('colors', c.id, 'hex', e.target.value)}
                        style={{ width: '40px', height: '40px', padding: '0', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                    </td>
                    <td><input className="input" type="number" step="0.05" value={c.factor} onChange={e => handleUpdateItem('colors', c.id, 'factor', e.target.value)} style={{ width: '100px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('colors', c.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
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
                  <th>Désignation</th>
                  <th>Unité de Vente</th>
                  <th>Prix Achat (DZD/Unité ou ML)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.accessories.map(acc => (
                  <tr key={acc.id}>
                    <td style={{ fontWeight: 600 }}>
                      <input className="input" defaultValue={acc.id} onBlur={e => handleUpdateItem('accessories', acc.id, 'id', e.target.value)} style={{ width: '100px', fontWeight: 600 }} />
                    </td>
                    <td><input className="input" value={acc.name} onChange={e => handleUpdateItem('accessories', acc.id, 'name', e.target.value)} style={{ width: '250px' }} /></td>
                    <td>
                      <select className="input" value={acc.unit} onChange={e => handleUpdateItem('accessories', acc.id, 'unit', e.target.value)} style={{ width: '100px' }}>
                        <option value="Kit">Kit</option>
                        <option value="Ml">Ml</option>
                        <option value="Unité">Unité</option>
                        <option value="Joint">Joint</option>
                      </select>
                    </td>
                    <td><input className="input" type="number" step="0.01" value={acc.price} onChange={e => handleUpdateItem('accessories', acc.id, 'price', e.target.value)} style={{ width: '100px' }} /></td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('accessories', acc.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="5">
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
                {data.gasketCompatibility.map((gc, i) => (
                  <tr key={i}>
                    <td>
                      <select 
                        className="input" 
                        value={gc.rangeId} 
                        onChange={e => handleUpdateGasketCompatibility(i, 'rangeId', e.target.value)}
                        style={{ width: '120px' }}
                      >
                        {data.ranges.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                      </select>
                    </td>
                    <td>
                      <input 
                        className="input" 
                        type="number" 
                        value={gc.glassThickness} 
                        onChange={e => handleUpdateGasketCompatibility(i, 'glassThickness', e.target.value)}
                        style={{ width: '100px' }} 
                      />
                    </td>
                    <td>
                      <select 
                        className="input" 
                        value={gc.gasketId} 
                        onChange={e => handleUpdateGasketCompatibility(i, 'gasketId', e.target.value)}
                        style={{ width: '200px' }}
                      >
                        {data.accessories.filter(a => a.unit === 'Joint').map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input 
                        className="input" 
                        value={gc.formula || '(L+H)*2'} 
                        onChange={e => handleUpdateGasketCompatibility(i, 'formula', e.target.value)}
                        style={{ width: '150px' }} 
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gamme Associée</th>
                  <th>Épaisseur Vitrage (mm)</th>
                  <th>Profilé (Parclose/Complément)</th>
                  <th>Formule Qté</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.glassProfileCompatibility?.map((gc, i) => (
                  <tr key={i}>
                    <td>
                      <select 
                        className="input" 
                        value={gc.rangeId} 
                        onChange={e => {
                          const updated = [...data.glassProfileCompatibility];
                          updated[i].rangeId = e.target.value;
                          setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                        }}
                        style={{ width: '120px' }}>
                        {data.ranges.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                      </select>
                    </td>
                    <td>
                      <input 
                        className="input" 
                        type="number" 
                        value={gc.glassThickness} 
                        onChange={e => {
                          const updated = [...data.glassProfileCompatibility];
                          updated[i].glassThickness = parseFloat(e.target.value) || 0;
                          setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                        }} 
                        style={{ width: '100px' }} 
                      />
                    </td>
                    <td>
                      <select 
                        className="input" 
                        value={gc.profileId} 
                        onChange={e => {
                          const updated = [...data.glassProfileCompatibility];
                          updated[i].profileId = e.target.value;
                          setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                        }}
                        style={{ width: '200px' }}>
                        {data.profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input 
                        className="input" 
                        value={gc.formula} 
                        onChange={e => {
                          const updated = [...data.glassProfileCompatibility];
                          updated[i].formula = e.target.value;
                          setData(prev => ({ ...prev, glassProfileCompatibility: updated }));
                        }} 
                        style={{ width: '150px' }} 
                      />
                    </td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteGlassProfileCompatibility(i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="5">
                    <button className="btn btn-secondary" onClick={() => handleAddItem('glassProfileCompatibility')} style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter une Compatibilité
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
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
                                const newEls = [...editingComposition.elements];
                                newEls[i].type = e.target.value;
                                newEls[i].id = e.target.value === 'profile' ? data.profiles[0].id : data.accessories[0].id;
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
                            >
                              {el.type === 'profile' 
                                ? data.profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)
                                : data.accessories.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)
                              }
                            </select>
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
                {data.options?.map((opt, i) => (
                  <tr key={opt.id}>
                    <td>
                      <input 
                        className="input" 
                        value={opt.name} 
                        onChange={e => handleUpdateItem('options', opt.id, 'name', e.target.value)} 
                        style={{ width: '180px' }} 
                      />
                    </td>
                    <td>
                      <select 
                        className="input" 
                        value={opt.rangeId} 
                        onChange={e => handleUpdateItem('options', opt.id, 'rangeId', e.target.value)}
                        style={{ width: '120px' }}>
                        {data.ranges.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                      </select>
                    </td>
                    <td>
                      <select 
                        className="input" 
                        value={opt.addAccessoryId} 
                        onChange={e => handleUpdateItem('options', opt.id, 'addAccessoryId', e.target.value)}
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
                        onChange={e => handleUpdateItem('options', opt.id, 'formula', e.target.value)} 
                        style={{ width: '100px' }} 
                      />
                    </td>
                    <td>
                      <select 
                        className="input" 
                        value={opt.removeAccessoryId || ''} 
                        onChange={e => handleUpdateItem('options', opt.id, 'removeAccessoryId', e.target.value)}
                        style={{ width: '200px' }}>
                        <option value="">(Ne rien supprimer)</option>
                        {data.accessories.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="btn" onClick={() => handleDeleteItem('options', opt.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button>
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
              const id = `${family.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
              const newItem = { id, name: 'Nouvel élément', price: 0, priceUnit: 'ML', formula: '1' };
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
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Désignation</th>
                          <th>Formule Qté</th>
                          <th>Unité</th>
                          <th>Prix (DZD)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.shutterComponents?.[key] || []).map((item, i) => (
                          <tr key={item.id}>
                            <td><input className="input" value={item.name} onChange={e => updateShutterItem(key, i, 'name', e.target.value)} style={{ width: '200px' }} /></td>
                            <td><input className="input" value={item.formula} onChange={e => updateShutterItem(key, i, 'formula', e.target.value)} style={{ width: '160px' }} /></td>
                            <td>
                              <select className="input" value={item.priceUnit} onChange={e => updateShutterItem(key, i, 'priceUnit', e.target.value)} style={{ width: '90px' }}>
                                <option>ML</option>
                                <option>M2</option>
                                <option>Unité</option>
                              </select>
                            </td>
                            <td><input className="input" type="number" step="0.01" value={item.price} onChange={e => updateShutterItem(key, i, 'price', e.target.value)} style={{ width: '110px' }} /></td>
                            <td><button className="btn" onClick={() => deleteShutterItem(key, i)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan="5">
                            <button className="btn btn-secondary" onClick={() => addShutterItem(key)} style={{ width: '100%', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              <Plus size={16} /> Ajouter
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
                {(data.traverses || []).map((trv) => (
                  <tr key={trv.id}>
                    <td><input className="input" value={trv.name} onChange={e => handleUpdateItem('traverses', trv.id, 'name', e.target.value)} style={{ width: '190px' }} /></td>
                    <td>
                      <select className="input" value={trv.type} onChange={e => handleUpdateItem('traverses', trv.id, 'type', e.target.value)} style={{ width: '120px' }}>
                        <option value="horizontale">Horizontale</option>
                        <option value="verticale">Verticale</option>
                      </select>
                    </td>
                    <td>
                      <select className="input" value={trv.usage} onChange={e => handleUpdateItem('traverses', trv.id, 'usage', e.target.value)} style={{ width: '140px' }}>
                        <option value="fenetre">Fenêtre</option>
                        <option value="porte">Porte</option>
                        <option value="pf">Porte-Fenêtre</option>
                        <option value="coulissant">Coulissant</option>
                        <option value="universal">Universel</option>
                      </select>
                    </td>
                    <td>
                      <select className="input" value={trv.profileId || ''} onChange={e => handleUpdateItem('traverses', trv.id, 'profileId', e.target.value)} style={{ width: '200px' }}>
                        <option value="">(Aucun profil)</option>
                        {data.profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                      </select>
                    </td>
                    <td><input className="input" value={trv.formula || 'L'} onChange={e => handleUpdateItem('traverses', trv.id, 'formula', e.target.value)} style={{ width: '100px' }} /></td>
                    <td><button className="btn" onClick={() => handleDeleteItem('traverses', trv.id)} style={{ padding: '0.4rem', color: '#ef4444' }}><Trash2 size={16} /></button></td>
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
              <p style={{ margin: 0, fontWeight: 600, color: '#1d4ed8', fontSize: '0.875rem' }}>Note de sécurité</p>
              <p style={{ margin: '0.2rem 0 0 0', color: '#3b82f6', fontSize: '0.875rem' }}>
                Toutes les modifications effectuées ici impacteront directement le module Commercial pour les nouveaux devis.
                Assurez-vous de sauvegarder avant de quitter cette page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
