import React, { useEffect, useRef } from 'react';

/**
 * Joinery Drawing Component (Canvas 2D)
 */
const JoineryCanvas = ({ config, width = 400, height = 400, database, onDrawComplete }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const { L, H, compositionId, isOnlyShutter } = config;
    const sides = config.optionalSides || {};
    // Show all 4 sides by default when none are explicitly configured
    const optionalSides = (sides.top || sides.bottom || sides.left || sides.right)
      ? sides
      : { top: true, bottom: true, left: true, right: true };
    if (!L || !H) return;

    const margin = 80;
    const drawAreaW = width - margin * 2;
    const drawAreaH = height - margin * 2;
    
    // Calculate Caisson height
    let caissonH = 0;
    if (config.hasShutter && config.shutterConfig?.caissonId && database.shutterComponents) {
      const cRef = database.shutterComponents.caissons.find(c => c.id === config.shutterConfig.caissonId);
      caissonH = parseFloat(cRef?.height) || 0;
    }

    const totalH_val = H;
    const scale = Math.min(drawAreaW / L, drawAreaH / totalH_val);
    
    const dW = L * scale;
    const dCaissonH = caissonH * scale;
    const dH_total = H * scale;
    const dH_window = Math.max(0, H - caissonH) * scale;
    
    const offsetX = (width - dW) / 2;
    const offsetY = (height - dH_total) / 2;

    // Drawing Styles
    ctx.strokeStyle = '#334155'; // Slate 700
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    // Window part starts AFTER caisson
    const winOffsetY = offsetY + dCaissonH;
    const dH = dH_window;

    // 1. Draw Couvre-joints FIRST (layer behind everything)
    const cjW = 40 * scale;
    ctx.fillStyle = '#f1f5f9';
    const oldStroke = ctx.strokeStyle;
    ctx.strokeStyle = '#cbd5e1';
    if (optionalSides.top) {
      ctx.fillRect(offsetX - cjW, offsetY - cjW, dW + cjW * 2, cjW);
      ctx.strokeRect(offsetX - cjW, offsetY - cjW, dW + cjW * 2, cjW);
    }
    if (optionalSides.bottom) {
      ctx.fillRect(offsetX - cjW, offsetY + dH_total, dW + cjW * 2, cjW);
      ctx.strokeRect(offsetX - cjW, offsetY + dH_total, dW + cjW * 2, cjW);
    }
    if (optionalSides.left) {
      const startY = offsetY - (optionalSides.top ? cjW : 0);
      const totalLen = dH_total + (optionalSides.top ? cjW : 0) + (optionalSides.bottom ? cjW : 0);
      ctx.fillRect(offsetX - cjW, startY, cjW, totalLen);
      ctx.strokeRect(offsetX - cjW, startY, cjW, totalLen);
    }
    if (optionalSides.right) {
      const startY = offsetY - (optionalSides.top ? cjW : 0);
      const totalLen = dH_total + (optionalSides.top ? cjW : 0) + (optionalSides.bottom ? cjW : 0);
      ctx.fillRect(offsetX + dW, startY, cjW, totalLen);
      ctx.strokeRect(offsetX + dW, startY, cjW, totalLen);
    }
    ctx.strokeStyle = oldStroke;

    // 2. Draw Caisson (Shutter Box) — on top of couvre-joints
    if (caissonH > 0) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(offsetX, offsetY, dW, dCaissonH);
      ctx.strokeRect(offsetX, offsetY, dW, dCaissonH);
      const kitId = config.shutterConfig?.kitId;
      const controlPos = config.shutterConfig?.controlPosition || 'Droite';
      const isLeft = controlPos === 'Gauche';
      if (kitId === 'KIT-MOTE') {
         ctx.beginPath();
         ctx.arc(isLeft ? offsetX + 10 : offsetX + dW - 10, offsetY + dCaissonH/2, 5, 0, Math.PI*2);
         ctx.fillStyle = '#3b82f6';
         ctx.fill();
         ctx.stroke();
      } else if (kitId === 'KIT-SANG' || kitId === 'KIT-MANI') {
         ctx.lineWidth = 3;
         ctx.strokeStyle = '#64748b';
         ctx.beginPath();
         const lineX = isLeft ? offsetX + 5 : offsetX + dW - 5;
         ctx.moveTo(lineX, offsetY + dCaissonH/2);
         ctx.lineTo(lineX, offsetY + dCaissonH + 20);
         ctx.stroke();
         ctx.lineWidth = 2;
      }
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`H.C : ${caissonH} mm`, offsetX + dW/2, offsetY + dCaissonH/2 + 4);
    }

    const drawJoinery = (x, y, w, h, compId) => {
      const comp = database.compositions?.find(c => c.id === compId);
      const openingType = comp?.openingType || 'Fixe';
      const dir = config.openingDirection || 'gauche';
      
      // Frame
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      
      // Glass
      ctx.fillStyle = 'rgba(186, 230, 253, 0.2)';
      ctx.fillRect(x, y, w, h);

      const fW = 12 * scale; // Sash frame width roughly

      if (openingType.includes('Ouvrant') || openingType.includes('Battant') || openingType.includes('Porte')) {
        const name = (comp?.name || '').toLowerCase();
        const typeStr = openingType.toLowerCase();
        const combined = name + ' ' + typeStr;
        
        let sashCount = 1;
        const matches = combined.match(/(\d+)\s*(vantail|vanteau|vanteaux|ouvrant|battant|vant)/i);
        if (matches) {
          sashCount = parseInt(matches[1]);
        } else if (combined.includes('double') || combined.includes(' 2 ')) {
          sashCount = 2;
        } else if (combined.includes('triple') || combined.includes(' 3 ')) {
          sashCount = 3;
        }

        const sW = w / sashCount;
        for (let i = 0; i < sashCount; i++) {
          const sX = x + i * sW;
          ctx.setLineDash([]);
          ctx.strokeStyle = '#334155';
          ctx.strokeRect(sX + 2, y + 2, sW - 4, h - 4);
          
          // Triangle
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#94a3b8';
          
          let sashDir = dir;
          if (sashCount === 2) {
            sashDir = (i === 0) ? 'gauche' : 'droit';
          } else if (sashCount > 2) {
             sashDir = (i % 2 === 0) ? 'gauche' : 'droit';
          }

          if (sashDir === 'gauche') {
            ctx.moveTo(sX + 4, y + 4);
            ctx.lineTo(sX + sW - 4, y + h/2);
            ctx.lineTo(sX + 4, y + h - 4);
          } else {
            ctx.moveTo(sX + sW - 4, y + 4);
            ctx.lineTo(sX + 4, y + h/2);
            ctx.lineTo(sX + sW - 4, y + h - 4);
          }
          ctx.stroke();

          // Add G/D label only for the primary sash (with handle)
          ctx.setLineDash([]);
          const isGauche = dir.toLowerCase().includes('gauche');
          const isDroit = dir.toLowerCase().includes('droit');
          const isPrimary = (sashCount === 1) || 
                            (i === 0 && isGauche) || 
                            (i === sashCount - 1 && isDroit);
                            
          if (isPrimary) {
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            const labelText = isGauche ? 'G' : 'D';
            ctx.fillText(labelText, sX + sW/2, y + h/2 + 4);
          }
        }
        ctx.setLineDash([]);
      } else if (openingType.includes('Coulissant')) {
        const name = (comp?.name || '').toLowerCase();
        const typeStr = openingType.toLowerCase();
        const combined = name + ' ' + typeStr;

        let sashCount = 2; 
        const matches = combined.match(/(\d+)\s*(coulisse|vantail|vanteau|vanteaux|ouvrant|vant)/i);
        if (matches) {
          sashCount = parseInt(matches[1]);
        } else if (combined.includes(' 3 ')) {
          sashCount = 3;
        } else if (combined.includes(' 4 ')) {
          sashCount = 4;
        }
        
        const sW = w / sashCount;
        for (let i = 0; i < sashCount; i++) {
          const sX = x + i * sW;
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          // Overlap effect for sliding
          const overlap = 4;
          ctx.strokeRect(sX + 2, y + 2, sW + (i < sashCount-1 ? overlap : -2), h - 4);
          
          // Sliding Arrow
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          const arrowY = y + h/2 + (i % 2 === 0 ? -10 : 10);
          const arrowDir = (i % 2 === 0) ? 1 : -1; // Alternate directions
          
          ctx.beginPath();
          ctx.moveTo(sX + sW/2 - 10 * arrowDir, arrowY);
          ctx.lineTo(sX + sW/2 + 10 * arrowDir, arrowY);
          ctx.lineTo(sX + sW/2 + 5 * arrowDir, arrowY - 3);
          ctx.moveTo(sX + sW/2 + 10 * arrowDir, arrowY);
          ctx.lineTo(sX + sW/2 + 5 * arrowDir, arrowY + 3);
          ctx.stroke();
        }
      } else {
        // Fixe
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y); ctx.lineTo(x, y + h);
        ctx.stroke();
      }
    };

    if (config.compoundType && config.compoundType !== 'none' && config.compoundConfig?.parts) {
      const { parts, orientation, unionId, traverseId } = config.compoundConfig;
      const divRef = database.profiles.find(p => p.id === (config.compoundType === 'fix_coulissant' ? unionId : traverseId));
      const thick = (divRef?.thickness || 20) * scale;
      
      const drawPartList = (list, bx, by, bw, bh, dir) => {
        if (!list || !Array.isArray(list)) return;
        const isH = dir !== 'vertical';
        let cx = bx;
        let cy = by;

        list.forEach((part, idx) => {
          const pW = isH ? (part.width ? part.width * scale : (bw / list.length)) : bw;
          const pH = isH ? bh : (part.height ? part.height * scale : (bh / list.length));

          if (part.type === 'group' && part.subParts) {
             drawPartList(part.subParts, cx, cy, pW, pH, isH ? 'vertical' : 'horizontal');
          } else {
             drawJoinery(cx, cy, pW, pH, part.compositionId || compositionId);
          }

          if (isH) {
             cx += pW;
             if (idx < list.length - 1) {
                ctx.fillStyle = '#64748b';
                ctx.fillRect(cx, by, thick, bh);
                cx += thick;
             }
          } else {
             cy += pH;
             if (idx < list.length - 1) {
                ctx.fillStyle = '#64748b';
                ctx.fillRect(bx, cy, bw, thick);
                cy += thick;
             }
          }
        });
      };

      if (!isOnlyShutter) {
        drawPartList(parts, offsetX, winOffsetY, dW, dH, orientation);
      }
    } else {
      if (!isOnlyShutter) {
        drawJoinery(offsetX, winOffsetY, dW, dH, compositionId);
      }
    }


    // 5. Draw dimensions with lines
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    // L dimension line
    const dimY = winOffsetY + dH + 35;
    ctx.beginPath();
    ctx.moveTo(offsetX, dimY);
    ctx.lineTo(offsetX + dW, dimY);
    ctx.moveTo(offsetX, dimY - 5); ctx.lineTo(offsetX, dimY + 5);
    ctx.moveTo(offsetX + dW, dimY - 5); ctx.lineTo(offsetX + dW, dimY + 5);
    ctx.stroke();
    ctx.fillText(`${L} mm`, offsetX + dW / 2, dimY - 5);

    // H dimension lines
    const dimX_total = offsetX - 55;
    const dimX_detail = offsetX - 25;
    ctx.lineWidth = 1;
    ctx.font = 'bold 10px Inter, sans-serif';

    // 1. Total Height Line
    ctx.beginPath();
    ctx.strokeStyle = '#94a3b8';
    ctx.moveTo(dimX_total, offsetY);
    ctx.lineTo(dimX_total, offsetY + dH_total);
    ctx.moveTo(dimX_total - 5, offsetY); ctx.lineTo(dimX_total + 5, offsetY);
    ctx.moveTo(dimX_total - 5, offsetY + dH_total); ctx.lineTo(dimX_total + 5, offsetY + dH_total);
    ctx.stroke();

    ctx.save();
    ctx.translate(dimX_total - 5, offsetY + dH_total / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillText(`${H} mm (Total)`, 0, 0);
    ctx.restore();

    // 2. Detail Height Lines (Box & Opening)
    if (caissonH > 0) {
      // Box height dim
      ctx.beginPath();
      ctx.strokeStyle = '#cbd5e1';
      ctx.moveTo(dimX_detail, offsetY);
      ctx.lineTo(dimX_detail, offsetY + dCaissonH);
      ctx.stroke();
      
      ctx.save();
      ctx.translate(dimX_detail - 3, offsetY + dCaissonH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${caissonH}`, 0, 0);
      ctx.restore();

      // Opening height dim
      if (!isOnlyShutter) {
        ctx.beginPath();
        ctx.moveTo(dimX_detail, winOffsetY);
        ctx.lineTo(dimX_detail, winOffsetY + dH);
        ctx.stroke();
        
        ctx.save();
        ctx.translate(dimX_detail - 3, winOffsetY + dH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#3b82f6'; // Blue for opening
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`${Math.round(H - caissonH)} mm (Ouv.)`, 0, 0);
        ctx.restore();
      }
    }

    // Export
    if (onDrawComplete) {
      setTimeout(() => {
        try {
          onDrawComplete(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error('Failed to export canvas', e);
        }
      }, 100);
    }

  }, [config, width, height, database, onDrawComplete]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col items-center justify-center">
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        className="max-w-full h-auto"
      />
      <p className="mt-2 text-xs text-slate-400 italic">Aperçu technique (Echelle 1:{Math.round(1/((width/config.L || 1))) || '?'})</p>
    </div>
  );
};

export default JoineryCanvas;
