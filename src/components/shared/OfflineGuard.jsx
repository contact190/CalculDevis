import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function OfflineGuard({ onReconnect }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const checkIntervalRef = useRef(null);

  // Vérification active de la connectivité réelle (ping Supabase ultra-léger, seuil strict de 2.5s)
  const verifyRealConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOffline(true);
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      
      const res = await fetch('https://uxfktjdibabwcjinynlk.supabase.co/rest/v1/', {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4Zmt0amRpYmFid2NqaW55bmxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDczNTUsImV4cCI6MjA5OTY4MzM1NX0.p7tzcrPlxmes7pyoWES6bKsf7tO7HAGfgn7Cs5r_AE0'
        }
      });
      clearTimeout(timeoutId);
      
      const reachable = res.status < 500;
      setIsOffline(!reachable);
      return reachable;
    } catch (err) {
      setIsOffline(true);
      return false;
    }
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    setRetryError(false);
    const reachable = await verifyRealConnection();
    setIsChecking(false);
    if (reachable) {
      if (onReconnect) {
        onReconnect();
      }
    } else {
      setRetryError(true);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      const ok = await verifyRealConnection();
      if (ok && onReconnect) {
        onReconnect();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setRetryError(false);
    };

    const handleNetworkError = () => {
      verifyRealConnection();
    };

    const handleNetworkSlow = () => {
      setIsOffline(true);
      setRetryError(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('app:network-error', handleNetworkError);
    window.addEventListener('app:network-slow', handleNetworkSlow);

    // Vérification rapide toutes les 5 secondes
    checkIntervalRef.current = setInterval(() => {
      verifyRealConnection();
    }, 5000);

    // Vérification immédiate au montage
    verifyRealConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app:network-error', handleNetworkError);
      window.removeEventListener('app:network-slow', handleNetworkSlow);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [verifyRealConnection, onReconnect]);

  if (!isOffline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.92)',
      backdropFilter: 'blur(10px)',
      zIndex: 999999,
      display: 'grid',
      placeItems: 'center',
      padding: '1.25rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 25px 60px -15px rgba(220, 38, 38, 0.35), 0 0 0 1px rgba(239, 68, 68, 0.2)',
        border: '2px solid #ef4444',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* En-tête d'alerte avec icône pulsante */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: '#fef2f2',
          border: '3px solid #f87171',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 1.25rem auto',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)'
        }}>
          <WifiOff size={42} color="#dc2626" strokeWidth={2.4} />
        </div>

        {/* Titre Erreur / Alerte */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: '#fee2e2',
          color: '#991b1b',
          padding: '0.35rem 0.85rem',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem'
        }}>
          <AlertTriangle size={15} color="#b91c1c" />
          ERREUR DE CONNEXION / RÉSEAU TROP LENT
        </div>

        <h2 style={{
          margin: '0 0 0.85rem 0',
          fontSize: '1.45rem',
          fontWeight: 800,
          color: '#0f172a',
          lineHeight: 1.3
        }}>
          Vérifiez votre connexion internet
        </h2>

        {/* Bandeau d'alerte explicite */}
        <div style={{
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.25rem',
          textAlign: 'left'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem'
          }}>
            <AlertTriangle size={20} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.88rem', color: '#881337', lineHeight: 1.45 }}>
              <strong style={{ display: 'block', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                Connexion réseau trop lente (&gt; 2.5s) ou coupée
              </strong>
              L'enregistrement est suspendu pour protéger vos données contre les conflits entre appareils. Veuillez vérifier votre accès <strong>Wi-Fi</strong> ou <strong>4G/5G</strong>.
            </div>
          </div>
        </div>

        {/* Explication du blocage de sécurité */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.75rem 0.95rem',
          marginBottom: '1.5rem',
          textAlign: 'left',
          fontSize: '0.82rem',
          color: '#475569',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center'
        }}>
          <ShieldAlert size={18} color="#0284c7" style={{ flexShrink: 0 }} />
          <span>
            <strong>Protection active :</strong> L'écran est verrouillé pour empêcher l'écrasement ou la perte de commandes entre vos différents appareils.
          </span>
        </div>

        {/* Erreur lors du réessai manuel */}
        {retryError && (
          <div style={{
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            color: '#991b1b',
            borderRadius: '10px',
            padding: '0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.84rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            animation: 'shake 0.3s ease'
          }}>
            <AlertTriangle size={17} color="#dc2626" />
            Toujours pas de connexion. Vérifiez votre réseau puis réessayez.
          </div>
        )}

        {/* Bouton d'action */}
        <button
          onClick={handleManualRetry}
          disabled={isChecking}
          style={{
            width: '100%',
            padding: '0.95rem 1.25rem',
            borderRadius: '12px',
            background: isChecking ? '#94a3b8' : '#dc2626',
            color: '#ffffff',
            border: 'none',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: isChecking ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)'
          }}
          onMouseEnter={(e) => {
            if (!isChecking) e.currentTarget.style.background = '#b91c1c';
          }}
          onMouseLeave={(e) => {
            if (!isChecking) e.currentTarget.style.background = '#dc2626';
          }}
        >
          <RefreshCw
            size={20}
            style={{
              animation: isChecking ? 'spin 1s linear infinite' : 'none'
            }}
          />
          {isChecking ? 'Vérification en cours...' : 'Vérifier la connexion & Débloquer'}
        </button>
      </div>
    </div>
  );
}
