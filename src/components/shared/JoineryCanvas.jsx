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
    const composition = database.compositions.find(c => c.id === compositionId);
    const rangeId = composition?.rangeId;
    if (!L || !H) return;

    // Calculate scaling
    const margin = 80;
    const drawAreaW = width - margin * 2;
    const drawAreaH = height - margin * 2;
    
    const scale = Math.min(drawAreaW / L, drawAreaH / H);
    
    const dW = L * scale;
    const dH = H * scale;
    const offsetX = (width - dW) / 2;
    const offsetY = (height - dH) / 2;

    // Drawing Styles
    ctx.strokeStyle = '#334155'; // Slate 700
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    
    // 0. Draw Architraves (Couvre-joints optionnels)
    const cjW = 40 * scale; // 40mm
    ctx.fillStyle = '#f1f5f9';
    const oldStroke = ctx.strokeStyle;
    ctx.strokeStyle = '#cbd5e1';
    
    if (optionalSides.top) {
      ctx.fillRect(offsetX - cjW, offsetY - cjW, dW + cjW * 2, cjW);
      ctx.strokeRect(offsetX - cjW, offsetY - cjW, dW + cjW * 2, cjW);
    }
    if (optionalSides.bottom) {
      ctx.fillRect(offsetX - cjW, offsetY + dH, dW + cjW * 2, cjW);
      ctx.strokeRect(offsetX - cjW, offsetY + dH, dW + cjW * 2, cjW);
    }
    if (optionalSides.left) {
      ctx.fillRect(offsetX - cjW, offsetY, cjW, dH);
      ctx.strokeRect(offsetX - cjW, offsetY, cjW, dH);
    }
    if (optionalSides.right) {
      ctx.fillRect(offsetX + dW, offsetY, cjW, dH);
      ctx.strokeRect(offsetX + dW, offsetY, cjW, dH);
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
      const isHorizontal = orientation !== 'vertical';
      const divRef = database.profiles.find(p => p.id === (config.compoundType === 'fix_coulissant' ? unionId : traverseId));
      const thick = (divRef?.thickness || 20) * scale;
      
      let currentX = offsetX;
      let currentY = offsetY;

      parts.forEach((part, idx) => {
        const pW = isHorizontal ? (part.width * scale) : dW;
        const pH = isHorizontal ? dH : (part.height * scale);
        
        drawJoinery(currentX, currentY, pW, pH, part.compositionId || compositionId);
        
        if (isHorizontal) {
           currentX += pW;
           if (idx < parts.length - 1) {
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(currentX, offsetY, thick, dH);
              currentX += thick;
           }
        } else {
           currentY += pH;
           if (idx < parts.length - 1) {
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(offsetX, currentY, dW, thick);
              currentY += thick;
           }
        }
      });
    } else {
      drawJoinery(offsetX, offsetY, dW, dH, compositionId);
    }

    // 5. Draw dimensions
    ctx.fillStyle = '#64748b'; // Slate 500
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    // L dimension
    ctx.fillText(`${L} mm`, offsetX + dW / 2, offsetY + dH + 20);
    // H dimension
    ctx.save();
    ctx.translate(offsetX - 25, offsetY + dH / 2);
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
