import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { supabaseFetch } from '../../utils/supabaseClient';

export default function OfflineGuard({ onReconnect }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const checkIntervalRef = useRef(null);

  // Vérification active de la connectivité réelle (ping Supabase)
  const verifyRealConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOffline(true);
      return false;
    }
    try {
      // Requête légère avec court timeout (3s) pour vérifier l'accès réel à Internet et Supabase
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      
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
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérification périodique toutes les 15 secondes
    checkIntervalRef.current = setInterval(() => {
      verifyRealConnection();
    }, 15000);

    // Vérification initiale
    verifyRealConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
      background: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(8px)',
      zIndex: 999999,
      display: 'grid',
      placeItems: 'center',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        border: '1.5px solid #fecaca',
        animation: 'fadeIn 0.25s ease'
      }}>
        {/* Icône animée */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: '#fef2f2',
          border: '2px solid #fecaca',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 1.5rem auto'
        }}>
          <WifiOff size={36} color="#dc2626" />
        </div>

        <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
          Connexion Internet Interrompue
        </h2>

        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.92rem', color: '#475569', lineHeight: '1.5' }}>
          L'application a été <strong style={{ color: '#dc2626' }}>temporairement suspendue</strong> pour empêcher toute divergence ou écrasement de commandes entre vos différents appareils.
        </p>

        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          marginBottom: '1.5rem',
          textAlign: 'left',
          fontSize: '0.82rem',
          color: '#334155',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start'
        }}>
          <ShieldAlert size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Sécurité des données active :</strong> Aucune saisie ni validation locale n'est autorisée sans connexion au serveur central Cloud.
          </div>
        </div>

        {retryError && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            marginBottom: '1.25rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}>
            <AlertTriangle size={15} /> Serveur toujours injoignable. Vérifiez votre Wi-Fi / 4G.
          </div>
        )}

        <button
          onClick={handleManualRetry}
          disabled={isChecking}
          style={{
            width: '100%',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            background: isChecking ? '#94a3b8' : '#0284c7',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: isChecking ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            transition: 'background 0.2s',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
          }}
        >
          <RefreshCw size={18} className={isChecking ? 'spin' : ''} style={{ animation: isChecking ? 'spin 1s linear infinite' : 'none' }} />
          {isChecking ? 'Vérification en cours...' : 'Tester la connexion & Reprendre'}
        </button>
      </div>
    </div>
  );
}
