export const getTechnicalDrawingDataURL = (cfg, database) => {
  if (!cfg || !database) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 700;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  
  const { L, H, compositionId, optionalSides = {} } = cfg;
  if (!L || !H) return null;

  const margin = 100;
  const canvasSize = 700;
  const drawAreaW = canvasSize - margin * 2;
  const drawAreaH = canvasSize - margin * 2;
  
  let caissonH = 0;
  if (cfg.hasShutter && cfg.shutterConfig?.caissonId && database.shutterComponents) {
    const cRef = database.shutterComponents.caissons.find(c => c.id === cfg.shutterConfig.caissonId);
    caissonH = parseFloat(cRef?.height) || 0;
  }

  // Total visual height includes caisson on top + couvre-joint at bottom
  const totalVisualH = H + caissonH;
  const scale = Math.min(drawAreaW / L, drawAreaH / totalVisualH);
  const dW = L * scale;
  const dCaissonH = caissonH * scale;
  const dH_total = H * scale;
  const dH_window = Math.max(0, H - caissonH) * scale;
  
  // Reserve extra 30px at top for caisson, 30px at bottom for couvre-joint
  const offsetX = (canvasSize - dW) / 2;
  const offsetY = (canvasSize - (dCaissonH + dH_total)) / 2;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 700, 700);

  ctx.lineJoin = 'round';
  
  // 1. Draw Caisson (Shutter Box)
  if (caissonH > 0) {
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.fillRect(offsetX, offsetY, dW, dCaissonH);
    ctx.strokeRect(offsetX, offsetY, dW, dCaissonH);
    
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`H.C : ${caissonH} mm`, offsetX + dW/2, offsetY + dCaissonH/2 + 4);
  }
  
  // 2. Draw Frame & Sashes
  const winOffsetY = offsetY + dCaissonH;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(offsetX, winOffsetY, dW, dH_window);
  ctx.strokeRect(offsetX, winOffsetY, dW, dH_window);

  const compo = database.compositions?.find(c => c.id === compositionId);
  const openingType = (compo?.openingType || '').toLowerCase();
  
  // Helper: detect vasistas from composition name or its rangeIds
  const isVasistas = (comp) => {
    if (!comp) return false;
    const name = (comp.name || '').toUpperCase();
    if (name.includes('VASISTAS')) return true;
    const rangeId = (comp.rangeId || comp.id || '').toUpperCase();
    return rangeId.includes('VASISTAS');
  };

  // Inner drawJoinery function
  const drawJoinery = (x, y, w, h, compId) => {
    const comp = database.compositions?.find(c => c.id === compId) || database.compositions?.find(c => c.id === compositionId);
    const oType = comp?.openingType || 'Fixe';
    const dir = cfg.openingDirection || 'gauche';

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.15)';
    ctx.fillRect(x, y, w, h);

    // ── VASISTAS (top-hung tilting) ──────────────────────────────────────────
    if (isVasistas(comp)) {
      // Inner sash frame
      ctx.setLineDash([]);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

      // Diagonal lines from top corners to bottom-centre (symbol for top-hung)
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.moveTo(x + 4,     y + 4);   // top-left
      ctx.lineTo(x + w / 2, y + h - 4); // bottom-centre
      ctx.lineTo(x + w - 4, y + 4);   // top-right
      ctx.stroke();
      ctx.setLineDash([]);

      // Hinge symbol on top edge (short horizontal bar)
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 4);
      ctx.lineTo(x + w * 0.7, y + 4);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('V', x + w / 2, y + h / 2 + 5);

      return; // done for vasistas
    }

    if (oType.includes('Ouvrant') || oType.includes('Battant') || oType.includes('Porte')) {
      const combined = (comp?.name || '').toLowerCase();
      let sc = 1;
      const m = combined.match(/(\d+)\s*(vantail|vanteau|vanteaux|battant|vant)/i);
      if (m) sc = parseInt(m[1]);
      else if (combined.includes('double') || combined.includes(' 2 ')) sc = 2;
      const sW = w / sc;
      for (let i = 0; i < sc; i++) {
        const sX = x + i * sW;
        ctx.setLineDash([]);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sX + 2, y + 2, sW - 4, h - 4);
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        const sDir = (sc === 1) ? dir : (i === 0 ? 'gauche' : 'droit');
        if (sDir === 'gauche') {
          ctx.moveTo(sX + 4, y + 4); ctx.lineTo(sX + sW - 4, y + h/2); ctx.lineTo(sX + 4, y + h - 4);
        } else {
          ctx.moveTo(sX + sW - 4, y + 4); ctx.lineTo(sX + 4, y + h/2); ctx.lineTo(sX + sW - 4, y + h - 4);
        }
        ctx.stroke();

        // Add G/D label only for the primary sash (with handle)
        ctx.setLineDash([]);
        const isG = dir.toLowerCase().includes('gauche');
        const isD = dir.toLowerCase().includes('droit');
        const isPrimary = (sc === 1) || 
                          (i === 0 && isG) || 
                          (i === sc - 1 && isD);
                          
        if (isPrimary) {
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 14px Inter, sans-serif';
          ctx.textAlign = 'center';
          const labelText = isG ? 'G' : 'D';
          ctx.fillText(labelText, sX + sW/2, y + h/2 + 5);
        }
      }
      ctx.setLineDash([]);
    } else if (oType.includes('Coulissant')) {
      const combined = (comp?.name || '').toLowerCase();
      let sc = 2;
      const m = combined.match(/(\d+)\s*(coulisse|vantail|vanteau|vant)/i);
      if (m) sc = parseInt(m[1]);
      else if (combined.includes(' 3 ')) sc = 3;
      const sW = w / sc;
      for (let i = 0; i < sc; i++) {
        const sX = x + i * sW;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sX + 2, y + 2, sW + (i < sc-1 ? 4 : -2), h - 4);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        const arrowY = y + h/2 + (i % 2 === 0 ? -10 : 10);
        const aDir = (i % 2 === 0) ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(sX + sW/2 - 12*aDir, arrowY);
        ctx.lineTo(sX + sW/2 + 12*aDir, arrowY);
        ctx.lineTo(sX + sW/2 + 6*aDir, arrowY - 4);
        ctx.moveTo(sX + sW/2 + 12*aDir, arrowY);
        ctx.lineTo(sX + sW/2 + 6*aDir, arrowY + 4);
        ctx.stroke();
      }
    } else {
      // Fixe: crossed lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y); ctx.lineTo(x, y + h);
      ctx.stroke();
    }
  };

  // Handle compound compositions
  if (cfg.compoundType && cfg.compoundType !== 'none' && cfg.compoundConfig?.parts) {
    const { parts, orientation, unionId, traverseId } = cfg.compoundConfig;
    const divRef = (database.profiles || []).find(p => p.id === (cfg.compoundType === 'fix_coulissant' ? unionId : traverseId));
    const thick = (divRef?.thickness || 20) * scale;

    const drawPartList = (list, bx, by, bw, bh, dir) => {
      const isH = dir !== 'vertical';
      let cx = bx, cy = by;
      list.forEach((part, idx) => {
        const pW = isH ? (part.width ? part.width * scale : bw / list.length) : bw;
        const pH = isH ? bh : (part.height ? part.height * scale : bh / list.length);
        if (part.type === 'group' && part.subParts) {
          drawPartList(part.subParts, cx, cy, pW, pH, isH ? 'vertical' : 'horizontal');
        } else {
          drawJoinery(cx, cy, pW, pH, part.compositionId || compositionId);
        }
        if (isH) {
          cx += pW;
          if (idx < list.length - 1) { ctx.fillStyle = '#64748b'; ctx.fillRect(cx, by, thick, bh); cx += thick; }
        } else {
          cy += pH;
          if (idx < list.length - 1) { ctx.fillStyle = '#64748b'; ctx.fillRect(bx, cy, bw, thick); cy += thick; }
        }
      });
    };
    drawPartList(parts, offsetX, winOffsetY, dW, dH_window, orientation);
  } else {
    drawJoinery(offsetX, winOffsetY, dW, dH_window, compositionId);
  }

  // 3. Couvre-joints (Architraves)
  const cjThick = Math.max(18 * scale, 20); // Minimum 20px so it's always visible
  // Force bottom CJ to always be drawn
  const effectiveSides = { ...optionalSides, bottom: true };
  const hasCJ = true; // always draw at least the bottom
  if (hasCJ) {
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    
    // Top Architrave
    if (effectiveSides.top) {
      ctx.fillRect(offsetX - cjThick, offsetY - cjThick, dW + cjThick * 2, cjThick);
      ctx.strokeRect(offsetX - cjThick, offsetY - cjThick, dW + cjThick * 2, cjThick);
    }
    // Bottom Architrave (always drawn)
    ctx.fillRect(offsetX - cjThick, offsetY + dH_total, dW + cjThick * 2, cjThick);
    ctx.strokeRect(offsetX - cjThick, offsetY + dH_total, dW + cjThick * 2, cjThick);
    // Left Architrave (Vertical) - Covers full height from Top CJ to Bottom CJ
    if (effectiveSides.left) {
      const startY = offsetY - (effectiveSides.top ? cjThick : 0);
      const hExt = dH_total + (effectiveSides.top ? cjThick : 0) + cjThick;
      ctx.fillRect(offsetX - cjThick, startY, cjThick, hExt);
      ctx.strokeRect(offsetX - cjThick, startY, cjThick, hExt);
    }
    // Right Architrave (Vertical) - Covers full height from Top CJ to Bottom CJ
    if (effectiveSides.right) {
      const startY = offsetY - (effectiveSides.top ? cjThick : 0);
      const hExt = dH_total + (effectiveSides.top ? cjThick : 0) + cjThick;
      ctx.fillRect(offsetX + dW, startY, cjThick, hExt);
      ctx.strokeRect(offsetX + dW, startY, cjThick, hExt);
    }
  }

  // 4. Shutter Control Position
  if (cfg.hasShutter && cfg.shutterConfig) {
    const kitId = cfg.shutterConfig.kitId || '';
    const controlPos = cfg.shutterConfig.controlPosition || 'Droite';
    const isLeft = controlPos === 'Gauche';
    const isMotor = kitId === 'KIT-MOTE' || kitId.toLowerCase().includes('mot') || !!cfg.shutterConfig.moteurId;
    const isDouble = cfg.shutterConfig.isDoubleShutter;
    const motorCount = isDouble ? (cfg.shutterConfig.motorCount || 2) : 1;

    const drawControl = (ctrlX, ctrlY, motor) => {
      if (motor) {
        ctx.beginPath();
        ctx.arc(ctrlX, ctrlY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M', ctrlX, ctrlY + 4);
      } else {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ctrlX, ctrlY);
        ctx.lineTo(ctrlX, offsetY + dCaissonH + 30);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(kitId.includes('MANI') ? 'Manivelle' : 'Sangle', ctrlX, offsetY + dCaissonH + 44);
      }
    };

    const ctrlY = offsetY + (caissonH > 0 ? dCaissonH / 2 : 15);

    if (isDouble && motorCount === 2) {
      drawControl(offsetX + 15, ctrlY, isMotor);
      drawControl(offsetX + dW - 15, ctrlY, isMotor);
    } else {
      const ctrlX = isLeft ? offsetX + 15 : offsetX + dW - 15;
      drawControl(ctrlX, ctrlY, isMotor);
    }
  }

  // Dimension Lines
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#1e293b';
  ctx.font = '11px Inter, sans-serif';
  
  const dimY = offsetY + dH_total + 40;
  ctx.beginPath();
  ctx.moveTo(offsetX, dimY - 5); ctx.lineTo(offsetX, dimY + 5);
  ctx.moveTo(offsetX, dimY); ctx.lineTo(offsetX + dW, dimY);
  ctx.moveTo(offsetX + dW, dimY - 5); ctx.lineTo(offsetX + dW, dimY + 5);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText(`${L} mm`, offsetX + dW/2, dimY + 20);

  const dimX = offsetX - 60;
  ctx.beginPath();
  ctx.moveTo(dimX - 5, offsetY); ctx.lineTo(dimX + 5, offsetY);
  ctx.moveTo(dimX, offsetY); ctx.lineTo(dimX, offsetY + dH_total);
  ctx.moveTo(dimX - 5, offsetY + dH_total); ctx.lineTo(dimX + 5, offsetY + dH_total);
  ctx.stroke();
  
  ctx.save();
  ctx.translate(dimX - 15, offsetY + dH_total/2);
  ctx.rotate(-Math.PI/2);
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText(`${H} mm (Total)`, 0, 0);
  ctx.restore();

  if (caissonH > 0) {
    const dimX2 = offsetX - 25;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(dimX2, winOffsetY); ctx.lineTo(dimX2, winOffsetY + dH_window);
    ctx.stroke();
    
    ctx.save();
    ctx.translate(dimX2 - 15, winOffsetY + dH_window/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(`${Math.round(H - caissonH)} mm (Ouv.)`, 0, 0);
    ctx.restore();
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`${caissonH}`, dimX2 - 15, offsetY + dCaissonH/2 + 5);
  }

  return canvas.toDataURL('image/png');
};
