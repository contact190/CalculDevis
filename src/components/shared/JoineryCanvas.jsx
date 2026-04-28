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
    
    const { L, H, compositionId, optionalSides = {} } = config;
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

    // 0. Draw Caisson (Shutter Box)
    if (caissonH > 0) {
      ctx.fillStyle = '#e2e8f0'; // Slate 200
      ctx.fillRect(offsetX, offsetY, dW, dCaissonH);
      ctx.strokeRect(offsetX, offsetY, dW, dCaissonH);
      
      // Add a small circle to indicate shutter roll
      ctx.beginPath();
      ctx.arc(offsetX + dW - dCaissonH/2, offsetY + dCaissonH/2, dCaissonH/3, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Window part starts AFTER total caisson
    const winOffsetY = offsetY + dCaissonH;
    const dH = dH_window; // For compatibility with rest of code
    
    // 0. Draw Architraves (Couvre-joints optionnels)
    const cjW = 40 * scale; 
    ctx.fillStyle = '#f1f5f9';
    const oldStroke = ctx.strokeStyle;
    ctx.strokeStyle = '#cbd5e1';
    
    if (optionalSides.top) {
      ctx.fillRect(offsetX - cjW, winOffsetY - cjW, dW + cjW * 2, cjW);
      ctx.strokeRect(offsetX - cjW, winOffsetY - cjW, dW + cjW * 2, cjW);
    }
    if (optionalSides.bottom) {
      ctx.fillRect(offsetX - cjW, winOffsetY + dH, dW + cjW * 2, cjW);
      ctx.strokeRect(offsetX - cjW, winOffsetY + dH, dW + cjW * 2, cjW);
    }
    if (optionalSides.left) {
      ctx.fillRect(offsetX - cjW, winOffsetY, cjW, dH);
      ctx.strokeRect(offsetX - cjW, winOffsetY, cjW, dH);
    }
    if (optionalSides.right) {
      ctx.fillRect(offsetX + dW, winOffsetY, cjW, dH);
      ctx.strokeRect(offsetX + dW, winOffsetY, cjW, dH);
    }

    ctx.strokeStyle = oldStroke;

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
        const isDouble = openingType.includes('2') || openingType.includes('Double');
        
        if (isDouble) {
          // Ventail 1
          ctx.strokeRect(x + 2, y + 2, w/2 - 2, h - 4);
          // Triangle V1
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#94a3b8';
          ctx.moveTo(x + 2, y + 2);
          ctx.lineTo(x + w/2 - 2, y + h/2);
          ctx.lineTo(x + 2, y + h - 4);
          ctx.stroke();
          
          // Ventail 2
          ctx.setLineDash([]);
          ctx.strokeStyle = '#334155';
          ctx.strokeRect(x + w/2, y + 2, w/2 - 2, h - 4);
          // Triangle V2
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#94a3b8';
          ctx.moveTo(x + w - 2, y + 2);
          ctx.lineTo(x + w/2 + 2, y + h/2);
          ctx.lineTo(x + w - 2, y + h - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeRect(x + fW, y + fW, w - fW * 2, h - fW * 2);
          // Opening Triangle
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#94a3b8';
          if (dir === 'gauche') {
            ctx.moveTo(x + fW, y + fW);
            ctx.lineTo(x + w - fW, y + h/2);
            ctx.lineTo(x + fW, y + h - fW);
          } else {
            ctx.moveTo(x + w - fW, y + fW);
            ctx.lineTo(x + fW, y + h/2);
            ctx.lineTo(x + w - fW, y + h - fW);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (openingType.includes('Coulissant')) {
        const isDouble = openingType.includes('2') || openingType.includes('Double');
        ctx.strokeRect(x + 2, y + 2, w/2 + 2, h - 4);
        ctx.strokeRect(x + w/2 - 2, y + 2, w/2, h - 4);
        
        // Sliding Arrows
        ctx.fillStyle = '#64748b';
        const arrowY = y + h/2;
        // Arrow 1
        ctx.beginPath();
        ctx.moveTo(x + w/4 - 10, arrowY);
        ctx.lineTo(x + w/4 + 10, arrowY);
        ctx.lineTo(x + w/4 + 5, arrowY - 3);
        ctx.moveTo(x + w/4 + 10, arrowY);
        ctx.lineTo(x + w/4 + 5, arrowY + 3);
        ctx.stroke();
        // Arrow 2
        ctx.beginPath();
        ctx.moveTo(x + 3*w/4 + 10, arrowY + 10);
        ctx.lineTo(x + 3*w/4 - 10, arrowY + 10);
        ctx.lineTo(x + 3*w/4 - 5, arrowY + 7);
        ctx.moveTo(x + 3*w/4 - 10, arrowY + 10);
        ctx.lineTo(x + 3*w/4 - 5, arrowY + 13);
        ctx.stroke();
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

      drawPartList(parts, offsetX, winOffsetY, dW, dH, orientation);
    } else {
      drawJoinery(offsetX, winOffsetY, dW, dH, compositionId);
    }

    // 4. Draw Caisson (Shutter Box) - Re-draw on top for better visibility
    if (caissonH > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#334155';
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(offsetX, offsetY, dW, dCaissonH);
      ctx.strokeRect(offsetX, offsetY, dW, dCaissonH);
      
      // Write HC
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`H.C : ${caissonH} mm`, offsetX + dW/2, offsetY + dCaissonH/2 + 4);

      // Manoeuvre side
      const mSide = config.shutterConfig?.motorCablePosition || 'Droite';
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      const dotX = (mSide === 'Gauche') ? offsetX + 10 : offsetX + dW - 10;
      ctx.arc(dotX, offsetY + dCaissonH/2, 4, 0, Math.PI * 2);
      ctx.fill();
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

    // H dimension line
    const dimX = offsetX - 45;
    ctx.beginPath();
    ctx.moveTo(dimX, offsetY);
    ctx.lineTo(dimX, offsetY + dH_total);
    ctx.moveTo(dimX - 5, offsetY); ctx.lineTo(dimX + 5, offsetY);
    ctx.moveTo(dimX - 5, offsetY + dH_total); ctx.lineTo(dimX + 5, offsetY + dH_total);
    ctx.stroke();

    ctx.save();
    ctx.translate(dimX - 5, offsetY + dH_total / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${H} mm`, 0, 0);
    ctx.restore();

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
