import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, ShieldAlert, ArrowRight, Delete, Eye, EyeOff, ShieldCheck, User } from 'lucide-react';
import { authenticateWithCode, recordAccessLog, setActiveUser } from '../../utils/accessControl';
import { setCurrentAuthorName } from '../../utils/patchEngine';

export default function LoginModal({ database, setDatabase, onLoginSuccess }) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus automatique sur l'entrée clavier
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleCodeChange = (val) => {
    setError('');
    // Ne garder que les caractères alphanumériques/chiffres, max 10
    const clean = val.replace(/\s+/g, '').slice(0, 10);
    setCode(clean);
  };

  const handleKeyPress = (char) => {
    setError('');
    if (code.length < 10) {
      setCode(prev => prev + char);
    }
  };

  const handleBackspace = () => {
    setError('');
    setCode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setCode('');
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!code) {
      setError('Veuillez saisir votre code d\'accès');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Petite temporisation visuelle pour une transition agréable
    setTimeout(() => {
      const user = authenticateWithCode(code, database);

      if (user) {
        // Enregistrer la session
        setActiveUser(user);
        setCurrentAuthorName(user.name);
        recordAccessLog(user, 'login', database, setDatabase);
        
        if (onLoginSuccess) {
          onLoginSuccess(user);
        }
      } else {
        setError('Code d\'accès incorrect ou compte désactivé');
        setIsSubmitting(false);
      }
    }, 150);
  };

  // Écoute des touches du clavier physique
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Backspace') {
        // Laisser le comportement par défaut si le focus est sur l'input
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, database]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'radial-gradient(circle at center, #1e293b 0%, #090d16 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      userSelect: 'none',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(30, 41, 59, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '1.25rem',
        padding: '2rem 1.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(59, 130, 246, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        color: '#f8fafc',
      }}>
        
        {/* Logo / Badge */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '1rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          display: 'grid',
          placeItems: 'center',
          marginBottom: '1rem',
          boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <Lock size={30} color="white" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.25rem 0', letterSpacing: '-0.5px' }}>
          CalculDevis <span style={{ color: '#3b82f6' }}>PRO</span>
        </h2>
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center' }}>
          Saisissez votre code d'accès pour déverrouiller votre espace
        </p>

        {/* Input avec affichage des caractères masqués */}
        <form onSubmit={handleSubmit} style={{ width: '100%', marginBottom: '1.25rem' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            border: error ? '1.5px solid #ef4444' : '1.5px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
            transition: 'border-color 0.2s',
          }}>
            <div style={{ padding: '0 0.85rem', color: '#64748b' }}>
              <KeyRound size={20} color="#3b82f6" />
            </div>
            
            <input
              ref={inputRef}
              type={showCode ? 'text' : 'password'}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Code d'accès..."
              autoComplete="off"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '0.85rem 0.25rem',
                fontSize: '1.25rem',
                letterSpacing: showCode ? '2px' : '4px',
                fontWeight: 700,
                color: 'white',
                fontFamily: 'monospace',
                textAlign: 'center',
              }}
            />

            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0.85rem',
                display: 'grid',
                placeItems: 'center',
              }}
              title={showCode ? 'Masquer' : 'Afficher'}
            >
              {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#f87171',
              fontSize: '0.78rem',
              marginTop: '0.6rem',
              justifyContent: 'center',
              animation: 'fadeIn 0.2s ease-in-out',
            }}>
              <ShieldAlert size={14} />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Pavé numérique tactile pour poste d'atelier ou souris */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.65rem',
          width: '100%',
          maxWidth: '320px',
          marginBottom: '1.5rem',
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              style={{
                padding: '0.85rem 0',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '0.65rem',
                color: '#f1f5f9',
                fontSize: '1.25rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {num}
            </button>
          ))}

          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '0.85rem 0',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '0.65rem',
              color: '#fca5a5',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            C
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            style={{
              padding: '0.85rem 0',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0.65rem',
              color: '#f1f5f9',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            style={{
              padding: '0.85rem 0',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0.65rem',
              color: '#cbd5e1',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
            title="Effacer le dernier caractère"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Bouton de validation */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !code}
          style={{
            width: '100%',
            padding: '0.9rem',
            background: code ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            borderRadius: '0.75rem',
            color: code ? 'white' : '#64748b',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: code ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: code ? '0 10px 20px -5px rgba(59, 130, 246, 0.5)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <span>{isSubmitting ? 'Vérification...' : 'Ouvrir la session'}</span>
          <ArrowRight size={18} />
        </button>

        <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.72rem' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Accès sécurisé par profil utilisateur & traçabilité active</span>
        </div>

      </div>
    </div>
  );
}
