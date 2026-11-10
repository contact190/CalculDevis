import React from 'react';

/**
 * Journal du filet de sécurité : articles retirés d'un devis par une
 * synchronisation (autre poste / Cloud), avec possibilité de les remettre.
 */
const QuoteSafetyNetModal = ({ entries, onClose, onRestore }) => {
  const list = Array.isArray(entries) ? entries : [];
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', color: '#0f172a', borderRadius: '0.75rem', width: 'min(760px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>🛟 Articles retirés par une synchronisation</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Une version venue d'un autre poste a remplacé un devis avec moins d'articles. Une copie des articles retirés est gardée ici, sur cet ordinateur.
              Si le retrait était voulu, il n'y a rien à faire.
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', borderRadius: '0.4rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>Fermer</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {list.length === 0 && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Aucun article retiré enregistré.</p>}
          {list.map(entry => (
            <div key={entry.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.75rem 0.9rem', background: entry.restoredAt ? '#f0fdf4' : '#fffbeb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '0.9rem' }}>{entry.quoteNumber}</strong>
                  {entry.clientName ? <span style={{ fontSize: '0.82rem', color: '#475569' }}> — {entry.clientName}</span> : null}
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                    {new Date(entry.at).toLocaleString()} • {entry.itemsBefore} → {entry.itemsAfter} article(s)
                    {entry.remoteModifiedBy ? ` • version reçue de : ${entry.remoteModifiedBy}` : ''}
                    {entry.source ? ` • ${entry.source}` : ''}
                  </p>
                </div>
                {entry.restoredAt ? (
                  <span style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap' }}>✅ Remis</span>
                ) : (
                  <button
                    onClick={() => onRestore(entry)}
                    style={{ border: '1px solid #f59e0b', background: '#f59e0b', color: 'white', borderRadius: '0.4rem', padding: '0.4rem 0.7rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.76rem', whiteSpace: 'nowrap' }}
                  >
                    Remettre dans le devis
                  </button>
                )}
              </div>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#334155' }}>
                {(entry.lostItems || []).map(item => (
                  <li key={item.id}>
                    {item.ref ? `${item.ref} — ` : ''}{item.label || item.name || item.id}{item.qty ? ` (x${item.qty})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuoteSafetyNetModal;
