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
    const cjW = 40 * scale; // 40mm
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
      const comp = database.compositions.find(c => c.id === compId);
      const rid = comp?.rangeId;
      ctx.strokeRect(x, y, w, h);
      const fW = 10 * scale; 
      ctx.strokeRect(x + fW, y + fW, w - fW * 2, h - fW * 2);
      if (rid === 'H36') {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + fW);
        ctx.lineTo(x + w / 2, y + h - fW);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(186, 230, 253, 0.3)';
      ctx.fillRect(x + fW*2, y + fW*2, w - fW * 4, h - fW * 4);
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
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(cx, by, thick, bh);
                cx += thick;
             }
          } else {
             cy += pH;
             if (idx < list.length - 1) {
                ctx.fillStyle = '#cbd5e1';
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

    // 5. Draw dimensions
    ctx.fillStyle = '#64748b'; // Slate 500
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    // L dimension
    ctx.fillText(`${L} mm`, offsetX + dW / 2, winOffsetY + dH + 25);
    // H dimension
    ctx.save();
    ctx.translate(offsetX - 25, offsetY + dH_total / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${H} mm`, 0, 0);
    ctx.restore();

    // Notifications (Optionnel)
    if (onDrawComplete) {
      setTimeout(() => {
        try {
          onDrawComplete(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error('Failed to export canvas', e);
        }
      }, 50);
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
