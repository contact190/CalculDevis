import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, RefreshCw } from 'lucide-react';

const QRScanner = ({ onScan, onClose }) => {
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        // Preference for environment (rear) camera
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            // Success
            html5QrCode.stop().then(() => {
              onScan(decodedText);
            }).catch(() => {
              onScan(decodedText);
            });
          },
          (errorMessage) => {
            // Scan failed, usually silent
          }
        );
        setIsReady(true);
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.8)', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isReady ? '#10b981' : '#f59e0b' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Scanner Bordereau</h3>
        </div>
        <button 
          onClick={onClose} 
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '50%', display: 'grid', placeItems: 'center' }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Scanner Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div id="qr-reader" style={{ width: '100%', height: '100%' }}></div>
        
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', padding: '2rem', textAlign: 'center', color: 'white' }}>
            <p style={{ color: '#f87171', fontWeight: 700, marginBottom: '1rem' }}>{error}</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={18} /> Réessayer
            </button>
          </div>
        )}

        {!error && !isReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', background: '#000' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
          </div>
        )}
      </div>

      {/* Footer Instructions */}
      <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.8)', color: 'white' }}>
        <div style={{ maxWidth: '280px', margin: '0 auto' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: '#94a3b8' }}>
            Visez le QR Code présent sur l'étiquette de la fenêtre.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
