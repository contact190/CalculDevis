export const drawTechnicalDrawing = (canvas, cfg, database) => {
  if (!canvas || !cfg || !database) return;

  canvas.width = 700;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  
  const { L, H, compositionId, optionalSides = {} } = cfg;
  if (!L || !H) {
    ctx.clearRect(0, 0, 700, 700);
    return;
  }

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
  const drawJoinery = (x, y, w, h, compId, partDirection) => {
    const comp = database.compositions?.find(c => c.id === compId) || database.compositions?.find(c => c.id === compositionId);
    const oType = comp?.openingType || 'Fixe';
    const dir = partDirection || cfg.openingDirection || 'gauche';

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
      
      if (/\b(deux|2)\b.*\b(vantau|vantail|vantaux|battant|ouvrant|vant)/.test(combined) || combined.includes('double') || combined.includes(' 2 ')) {
        sc = 2;
      } else if (/\b(trois|3)\b.*\b(vantau|vantail|vantaux|battant|ouvrant|vant)/.test(combined) || combined.includes('triple') || combined.includes(' 3 ')) {
        sc = 3;
      } else if (/\b(quatre|4)\b.*\b(vantau|vantail|vantaux|battant|ouvrant|vant)/.test(combined) || combined.includes(' 4 ')) {
        sc = 4;
      } else {
        const m = combined.match(/(\d+)\s*(vantail|vanteau|vanteaux|battant|ouvrant|vant)/);
        if (m) {
          const val = parseInt(m[1]);
          if (val > 0 && val <= 10) sc = val;
        }
      }

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
  const compoName = (compo?.name || '').toLowerCase();
  const isPrecadreOrVitrage = compo?.isPrecadre || compoName.includes('precadre') || compoName.includes('pres cadre') || compoName.includes('vitrage');

  if (isPrecadreOrVitrage) {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(offsetX, winOffsetY, dW, dH_window);
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX + 5, winOffsetY + 5, dW - 10, dH_window - 10);
    // REMOVED BLUE FILL FOR PRECADRE

    let numTravH = 0;
    let numTravV = 0;
    
    // Check V (H means Hauteur = Vertical)
    const matchV = compoName.match(/(\d+)?\s*trav[a-z]*\s*(?:v|vert|verticale|h|hauteur)\b/i);
    if (matchV) numTravV = matchV[1] ? parseInt(matchV[1]) : 1;

    // Check H (L means Largeur = Horizontal)
    const matchH = compoName.match(/(\d+)?\s*trav[a-z]*\s*(?:horiz|horizontale|l|largeur)\b/i);
    if (matchH) numTravH = matchH[1] ? parseInt(matchH[1]) : 1;

    // Default to H if neither V nor H is specified but 'trav' is present
    if (numTravH === 0 && numTravV === 0) {
      const matchAny = compoName.match(/(\d+)?\s*trav[a-z]*/i);
      if (matchAny) {
        const count = matchAny[1] ? parseInt(matchAny[1]) : 1;
        if (count === 2) {
          numTravH = 1;
          numTravV = 1;
        } else {
          numTravH = count;
        }
      }
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    
    if (numTravH > 0) {
      const step = dH_window / (numTravH + 1);
      for (let i = 1; i <= numTravH; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, winOffsetY + step * i);
        ctx.lineTo(offsetX + dW, winOffsetY + step * i);
        ctx.stroke();
        
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(offsetX + 5, winOffsetY + step * i - 2.5);
        ctx.lineTo(offsetX + dW - 5, winOffsetY + step * i - 2.5);
        ctx.moveTo(offsetX + 5, winOffsetY + step * i + 2.5);
        ctx.lineTo(offsetX + dW - 5, winOffsetY + step * i + 2.5);
        ctx.stroke();
        ctx.lineWidth = 4;
      }
    }
    
    if (numTravV > 0) {
      const step = dW / (numTravV + 1);
      for (let i = 1; i <= numTravV; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + step * i, winOffsetY);
        ctx.lineTo(offsetX + step * i, winOffsetY + dH_window);
        ctx.stroke();
        
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(offsetX + step * i - 2.5, winOffsetY + 5);
        ctx.lineTo(offsetX + step * i - 2.5, winOffsetY + dH_window - 5);
        ctx.moveTo(offsetX + step * i + 2.5, winOffsetY + 5);
        ctx.lineTo(offsetX + step * i + 2.5, winOffsetY + dH_window - 5);
        ctx.stroke();
        ctx.lineWidth = 4;
      }
    }
  } else if (cfg.compoundType && cfg.compoundType !== 'none' && cfg.compoundConfig?.parts) {
    const { parts, orientation } = cfg.compoundConfig;

    const drawPartList = (list, bx, by, bw, bh, dir) => {
      const isH = dir !== 'vertical';
      let cx = bx, cy = by;
      list.forEach((part, idx) => {
        const pW = isH ? (part.width ? part.width * scale : bw / list.length) : bw;
        const pH = isH ? bh : (part.height ? part.height * scale : bh / list.length);
        const itemThick = (part.traverseThickness ?? 25) * scale;
        if (part.type === 'group' && part.subParts) {
          drawPartList(part.subParts, cx, cy, pW, pH, isH ? 'vertical' : 'horizontal');
        } else if (part.type === 'extra') {
          ctx.fillStyle = '#475569';
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.fillRect(cx, cy, pW, pH);
          ctx.strokeRect(cx, cy, pW, pH);
          if (pW > 35) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('POTEAU', cx + pW/2, cy + pH/2 + 3);
          }
        } else {
          drawJoinery(cx, cy, pW, pH, part.compositionId || compositionId, part.openingDirection);
        }
        if (isH) {
          cx += pW;
          if (idx < list.length - 1) { ctx.fillStyle = '#64748b'; ctx.fillRect(cx, by, itemThick, bh); cx += itemThick; }
        } else {
          cy += pH;
          if (idx < list.length - 1) { ctx.fillStyle = '#64748b'; ctx.fillRect(bx, cy, bw, itemThick); cy += itemThick; }
        }
      });
    };
    drawPartList(parts, offsetX, winOffsetY, dW, dH_window, orientation);
  } else {
    drawJoinery(offsetX, winOffsetY, dW, dH_window, compositionId, cfg.openingDirection);
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
};

export const getTechnicalDrawingDataURL = (cfg, database) => {
  if (!cfg || !database) return null;
  const canvas = document.createElement('canvas');
  drawTechnicalDrawing(canvas, cfg, database);
  return canvas.toDataURL('image/jpeg', 0.5);
};
