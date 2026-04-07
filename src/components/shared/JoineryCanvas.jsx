import React, { useEffect, useRef } from 'react';

/**
 * Joinery Drawing Component (Canvas 2D)
 */
const JoineryCanvas = ({ config, width = 400, height = 400, database }) => {
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

    // 1. Draw outer frame (Dormant)
    ctx.strokeRect(offsetX, offsetY, dW, dH);
    
    // 2. Draw inner offset (Ouvrant approx)
    const frameW = 10 * scale; // 10mm visual frame
    ctx.strokeRect(offsetX + frameW, offsetY + frameW, dW - frameW * 2, dH - frameW * 2);

    // 3. Draw sash division if applicable (e.g. Coulissant)
    if (rangeId === 'H36') {
      ctx.beginPath();
      ctx.moveTo(offsetX + dW / 2, offsetY + frameW);
      ctx.lineTo(offsetX + dW / 2, offsetY + dH - frameW);
      ctx.stroke();
    }

    // 4. Draw glass effect
    ctx.fillStyle = 'rgba(186, 230, 253, 0.3)'; // Sky 200 with opacity
    ctx.fillRect(offsetX + frameW*2, offsetY + frameW*2, dW - frameW * 4, dH - frameW * 4);

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

  }, [config, width, height]);

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
