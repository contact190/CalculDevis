import React, { useState, useMemo } from 'react';
import { Settings } from 'lucide-react';

// ----- Constants & Utils -----
const PANEL_TYPES = [
  { key: 'fixe', label: 'Fixe' },
  { key: 'ouvrant', label: 'Ouvrant' },
  { key: 'coulissant', label: 'Coulissant' },
  { key: 'porte', label: 'Porte' },
  { key: 'pf', label: 'P-Fenêtre' },
];

const PANEL_STYLE = {
  fixe:       { bg: '#f0f9ff', stroke: '#0ea5e9', label: 'FIXE' },
  ouvrant:    { bg: '#eff6ff', stroke: '#3b82f6', label: 'OUVRANT' },
  coulissant: { bg: '#f0fdf4', stroke: '#22c55e', label: 'COULISSANT' },
  porte:      { bg: '#fff7ed', stroke: '#f97316', label: 'PORTE' },
  pf:         { bg: '#fdf4ff', stroke: '#a855f7', label: 'P.FENÊTRE' },
};

// Deep clone a cell to prevent reference sharing
const cloneCell = (cell) => ({
  ...cell,
  id: Math.random().toString(36).substr(2, 9),
  openingDirection: cell.openingDirection || 'gauche',
  subLayout: cell.subLayout ? {
    ...cell.subLayout,
    cells: cell.subLayout.cells.map(row => row.map(c => cloneCell(c)))
  } : null
});

export const defaultLayout = (L = 1000, H = 1500) => ({
  cols: [1],
  rows: [1],
  cells: [[{ 
    id: 'root-cell',
    type: 'ouvrant',
    openingDirection: 'gauche'
  }]]
});

// ----- Main LayoutComposer -----
export default function LayoutComposer({ layout, onChange, database, globalConfig }) {
  const [selectedPath, setSelectedPath] = useState(null); // Array of {ri, ci}

  // Ensure layout is valid grid
  const currentLayout = useMemo(() => {
    if (layout && layout.cols && layout.rows && layout.cells) return layout;
    return defaultLayout(globalConfig.L, globalConfig.H);
  }, [layout, globalConfig.L, globalConfig.H]);

  // Helper: Traverse to find cell and its parent grid/dimensions
  const getInfoAtPath = (path, winH) => {
    if (!path || path.length === 0) return null;
    let grid = currentLayout;
    let cw = globalConfig.L;
    let rh = winH;
    let targetCell = null;
    let parentGrid = null;

    for (let i = 0; i < path.length; i++) {
        const { ri, ci } = path[i];
        const totalColFrac = grid.cols.reduce((sum, c) => sum + (c || 0), 0) || 1;
        const totalRowFrac = grid.rows.reduce((sum, r) => sum + (r || 0), 0) || 1;
        
        parentGrid = grid;
        targetCell = grid.cells[ri]?.[ci];
        if (!targetCell) return null;

        const cellW = (grid.cols[ci] / totalColFrac) * cw;
        const cellH = (grid.rows[ri] / totalRowFrac) * rh;

        if (i < path.length - 1) {
            grid = targetCell.subLayout;
            if (!grid) return null;
            cw = cellW;
            rh = cellH;
        } else {
            return { cell: targetCell, parentGrid, parentW: cw, parentH: rh, ri, ci };
        }
    }
    return null;
  };

  const updateCellAtPath = (path, updates) => {
    const newLayout = JSON.parse(JSON.stringify(currentLayout));
    let grid = newLayout;
    let targetCell = null;
    for (let i = 0; i < path.length; i++) {
        const { ri, ci } = path[i];
        if (i < path.length - 1) {
            grid = grid.cells[ri][ci].subLayout;
        } else {
            targetCell = grid.cells[ri][ci];
        }
    }
    Object.assign(targetCell, updates);
    onChange(newLayout);
  };

  const updateDimensionAtPath = (path, type, mmValue, winH) => {
     const W = parseFloat(mmValue) || 100;
     const newLayout = JSON.parse(JSON.stringify(currentLayout));
     let grid = newLayout;
     let parentW = globalConfig.L;
     let parentH = winH;

     for (let i = 0; i < path.length - 1; i++) {
        const { ri, ci } = path[i];
        const totalColFrac = grid.cols.reduce((sum, c) => sum + (c || 0), 0) || 1;
        const totalRowFrac = grid.rows.reduce((sum, r) => sum + (r || 0), 0) || 1;
        const cellW = (grid.cols[ci] / totalColFrac) * parentW;
        const cellH = (grid.rows[ri] / totalRowFrac) * parentH;
        grid = grid.cells[ri][ci].subLayout;
        parentW = cellW;
        parentH = cellH;
     }

     const targetIdx = type === 'width' ? path[path.length-1].ci : path[path.length-1].ri;
     const arr = type === 'width' ? grid.cols : grid.rows;
     const parentDim = type === 'width' ? parentW : parentH;

     if (W >= parentDim - 10) return; 

     const othersSum = arr.filter((_, i) => i !== targetIdx).reduce((a, b) => a + (b || 0), 0);
     const newFrac = (W * othersSum) / (parentDim - W);
     arr[targetIdx] = newFrac;
     onChange(newLayout);
  };

  const addTraverse = (type) => {
    setSelectedPath(null);
    const newLayout = JSON.parse(JSON.stringify(currentLayout));
    if (type === 'vertical') {
        newLayout.cols.push(1);
        newLayout.cells.forEach(row => row.push(cloneCell(row[row.length-1])));
    } else {
        newLayout.rows.push(1);
        const newRow = newLayout.cols.map(() => cloneCell(newLayout.cells[0][0]));
        newLayout.cells.push(newRow);
    }
    onChange(newLayout);
  };

  const removeTraverse = (path, type) => {
    setSelectedPath(null);
    const newLayout = JSON.parse(JSON.stringify(currentLayout));
    let grid = newLayout;
    for (let i = 0; i < path.length - 1; i++) grid = grid.cells[path[i].ri][path[i].ci].subLayout;
    
    const idx = type === 'vertical' ? path[path.length-1].ci : path[path.length-1].ri;
    if (type === 'vertical' && grid.cols.length > 1) {
        grid.cols.splice(idx, 1);
        grid.cells.forEach(row => row.splice(idx, 1));
    } else if (type === 'horizontal' && grid.rows.length > 1) {
        grid.rows.splice(idx, 1);
        grid.cells.splice(idx, 1);
    }
    onChange(newLayout);
  };

  // SVG Rendering Helper
  const renderGrid = (grid, parentX, parentY, parentW, parentH, currentPath = []) => {
    const totalColFrac = grid.cols.reduce((sum, c) => sum + (c || 0), 0) || 1;
    const totalRowFrac = grid.rows.reduce((sum, r) => sum + (r || 0), 0) || 1;

    return grid.rows.map((rFrac, ri) => {
      const rh = (rFrac / totalRowFrac) * parentH;
      const y = parentY + (grid.rows.slice(0, ri).reduce((sum, r) => sum + (r || 0), 0) / totalRowFrac) * parentH;
      
      return grid.cols.map((cFrac, ci) => {
        const cw = (cFrac / totalColFrac) * parentW;
        const x = parentX + (grid.cols.slice(0, ci).reduce((sum, c) => sum + (c || 0), 0) / totalColFrac) * parentW;
        const cell = grid.cells[ri]?.[ci];
        if (!cell) return null;

        const path = [...currentPath, { ri, ci }];
        const isSelected = JSON.stringify(selectedPath) === JSON.stringify(path);

        if (cell.subLayout) {
          return (
            <g key={cell.id} onClick={(e) => { e.stopPropagation(); setSelectedPath(path); }} style={{ cursor: 'pointer' }}>
              {renderGrid(cell.subLayout, x, y, cw, rh, path)}
              <rect x={x+4} y={y+4} width={cw-8} height={rh-8} fill="none" stroke={isSelected ? "#3b82f6" : "#94a3b8"} strokeWidth={isSelected ? 10 : 4} strokeDasharray="15,10" rx={10} />
            </g>
          );
        }

        const style = PANEL_STYLE[cell.type] || PANEL_STYLE.ouvrant;
        const fontSizeLabel = Math.max(26, (parentW + parentH) / 50);
        const fontSizeSub = Math.max(16, (parentW + parentH) / 90);

        return (
          <g key={cell.id} onClick={(e) => { e.stopPropagation(); setSelectedPath(path); }} style={{ cursor: 'pointer' }}>
            <rect 
              x={x + 10} y={y + 10} width={cw - 20} height={rh - 20} 
              fill={isSelected ? '#eff6ff' : style.bg} 
              stroke={isSelected ? '#3b82f6' : style.stroke} 
              strokeWidth={isSelected ? 20 : 6}
              rx={15}
            />
            {cell.type === 'ouvrant' && (
              <g>
                {/* Visual Opening Symbol (Triangles) */}
                {cell.openingDirection === 'droit' ? (
                   <path d={`M ${x+cw-30} ${y+30} L ${x+30} ${y+rh/2} L ${x+cw-30} ${y+rh-30}`} fill="none" stroke={style.stroke} strokeWidth={6} strokeOpacity={0.4} />
                ) : (
                   <path d={`M ${x+30} ${y+30} L ${x+cw-30} ${y+rh/2} L ${x+30} ${y+rh-30}`} fill="none" stroke={style.stroke} strokeWidth={6} strokeOpacity={0.4} />
                )}
              </g>
            )}
            {cell.type === 'porte' && (
              <circle cx={x+cw-50} cy={y+rh/2} r={15} fill={style.stroke} fillOpacity={0.5} />
            )}
            {cell.type === 'coulissant' && (
              <path d={`M ${x+cw/2-50} ${y+rh/2} L ${x+cw/2+50} ${y+rh/2} M ${x+cw/2+30} ${y+rh/2-20} L ${x+cw/2+50} ${y+rh/2} L ${x+cw/2+30} ${y+rh/2+20}`} fill="none" stroke={style.stroke} strokeWidth={8} />
            )}
            <text x={x + cw/2} y={y + rh/2 - 15} textAnchor="middle" fontSize={fontSizeLabel} fontWeight="800" fill={style.stroke}>
              {style.label} {cell.type === 'ouvrant' && (cell.openingDirection === 'droit' ? '(D)' : '(G)')}
            </text>
            <text x={x + cw/2} y={y + rh/2 + fontSizeSub + 10} textAnchor="middle" fontSize={fontSizeSub} fill="#475569" fontWeight="600">
              {Math.round(cw)}×{Math.round(rh)}mm
            </text>
          </g>
        );
      });
    });
  };

  // Logic for Shutter Heights
  const shutterH = useMemo(() => {
    if (!globalConfig.hasShutter || !globalConfig.shutterConfig?.caissonId) return 0;
    const caisson = database.shutterComponents?.caissons?.find(c => c.id === globalConfig.shutterConfig.caissonId);
    return caisson?.height || 140;
  }, [globalConfig.hasShutter, globalConfig.shutterConfig, database]);

  const totalOpeningH = globalConfig.H;
  const windowH = Math.max(100, totalOpeningH - shutterH);
  
  const svgWidth = 320;
  const svgHeight = Math.min(500, (totalOpeningH / globalConfig.L) * svgWidth);
  
  const info = getInfoAtPath(selectedPath, windowH);
  const cellAt = info?.cell;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '15px' }}>
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.2rem' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => addTraverse('vertical')}>+ Traverse V</button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => addTraverse('horizontal')}>+ Traverse H</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', background: '#f1f5f9', padding: '20px', borderRadius: '6px' }}>
          <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${globalConfig.L} ${totalOpeningH}`} style={{ background: 'white', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
            {globalConfig.hasShutter && (
              <g>
                <rect x={0} y={0} width={globalConfig.L} height={shutterH} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={6} />
                <text x={globalConfig.L/2} y={shutterH/2 + 5} textAnchor="middle" fontSize={Math.max(24, shutterH/3)} fill="#64748b" fontWeight="800">COFFRE VOLET ({shutterH}mm)</text>
              </g>
            )}
            <g transform={`translate(0, ${shutterH})`}>
              {renderGrid(currentLayout, 0, 0, globalConfig.L, windowH)}
            </g>
          </svg>
        </div>
      </div>

      {selectedPath && cellAt && info && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass" style={{ padding: '1.5rem', width: '380px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 40px -10px rgb(0 0 0 / 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={22} color="#3b82f6" />
                <h4 style={{ margin: 0 }}>Configuration Panneau</h4>
              </div>
              <button onClick={() => setSelectedPath(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.8rem', color: '#64748b' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="label">L de cette col (mm)</label>
                <input 
                  type="number" className="input" 
                  value={Math.round(info.parentGrid.cols[info.ci] / (info.parentGrid.cols.reduce((sum,c)=>sum+(c||0),0) || 1) * info.parentW)} 
                  onChange={e => updateDimensionAtPath(selectedPath, 'width', e.target.value, windowH)} 
                />
              </div>
              <div className="form-group">
                <label className="label">H de cette ligne (mm)</label>
                <input 
                  type="number" className="input" 
                  value={Math.round(info.parentGrid.rows[info.ri] / (info.parentGrid.rows.reduce((sum,r)=>sum+(r||0),0) || 1) * info.parentH)} 
                  onChange={e => updateDimensionAtPath(selectedPath, 'height', e.target.value, windowH)} 
                />
              </div>
            </div>

            {cellAt.type === 'ouvrant' && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="label" style={{ color: '#3b82f6', fontWeight: 700 }}>Sens d'ouverture</label>
                <select 
                  className="input" 
                  value={cellAt.openingDirection || 'gauche'} 
                  onChange={e => updateCellAtPath(selectedPath, { openingDirection: e.target.value })}
                >
                  <option value="gauche">Gauche (Harnais à gauche)</option>
                  <option value="droit">Droit (Harnais à droite)</option>
                </select>
              </div>
            )}

            <div style={{ padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', marginBottom: '1.5rem' }}>
               <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0369a1', marginBottom: '0.8rem' }}>✂️ Division de cette case</p>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => updateCellAtPath(selectedPath, { subLayout: { cols: [1,1], rows: [1], cells: [[{ type: cellAt.type }, { type: cellAt.type }]] } })}>Div.V</button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => updateCellAtPath(selectedPath, { subLayout: { cols: [1], rows: [1,1], cells: [[{ type: cellAt.type }], [{ type: cellAt.type }]] } })}>Div.H</button>
                  {cellAt.subLayout && (
                    <button className="btn" style={{ flex: 1, color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', fontSize: '0.8rem' }} onClick={() => updateCellAtPath(selectedPath, { subLayout: null })}>Retirer</button>
                  )}
               </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="label">Gamme spécifique</label>
              <select className="input" value={cellAt.rangeId || ''} onChange={e => updateCellAtPath(selectedPath, { rangeId: e.target.value })}>
                <option value="">(Hériter de l'ouvrage)</option>
                {database.ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="label">Modèle / Composition</label>
              <select className="input" value={cellAt.compositionId || ''} onChange={e => updateCellAtPath(selectedPath, { compositionId: e.target.value })}>
                <option value="">(Hériter de l'ouvrage)</option>
                {database.compositions
                    .filter(c => !cellAt.rangeId || c.rangeId === cellAt.rangeId)
                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Type de panneau</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {PANEL_TYPES.map(pt => (
                  <button 
                    key={pt.key}
                    onClick={() => updateCellAtPath(selectedPath, { type: pt.key })}
                    style={{ 
                        padding: '0.7rem 0.2rem', fontSize: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                        background: cellAt.type === pt.key ? '#2563eb' : 'white',
                        color: cellAt.type === pt.key ? 'white' : '#64748b',
                        fontWeight: cellAt.type === pt.key ? 700 : 500
                    }}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1, color: '#ef4444', fontSize: '0.8rem' }} onClick={() => removeTraverse(selectedPath, 'vertical')}>Retirer Col</button>
                <button className="btn btn-secondary" style={{ flex: 1, color: '#ef4444', fontSize: '0.8rem' }} onClick={() => removeTraverse(selectedPath, 'horizontal')}>Retirer Ligne</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const rescaleTree = (node) => node;
