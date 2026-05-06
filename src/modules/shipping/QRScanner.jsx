import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRScanner = ({ onScan, onClose }) => {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render((decodedText) => {
      scanner.clear().then(() => {
        onScan(decodedText);
      }).catch(err => {
        console.error("Failed to clear scanner", err);
        onScan(decodedText);
      });
    }, (error) => {
      // ignore errors
    });

    return () => {
      scanner.clear().catch(err => console.error("Scanner cleanup error", err));
    };
  }, [onScan]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 10001, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', color: 'white' }}>
        <h3 style={{ margin: 0 }}>Scanner QR Code</h3>
        <button onClick={onClose} style={{ background: 'white', color: 'black', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 800 }}>Fermer</button>
      </div>
      <div id="qr-reader" style={{ width: '100%', flex: 1 }}></div>
      <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
        Placez le QR Code dans le carré pour scanner automatiquement.
      </div>
    </div>
  );
};

export default QRScanner;
