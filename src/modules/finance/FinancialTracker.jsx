import React, { useState, useMemo } from 'react';
import { CreditCard, Plus, Upload, ExternalLink, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Trash2, FileText, Link, X } from 'lucide-react';

const paymentStatuses = {
  'Payé': { color: '#10b981', bg: '#d1fae5', icon: '✅' },
  'En attente': { color: '#f59e0b', bg: '#fef3c7', icon: '⏳' },
  'Retard': { color: '#ef4444', bg: '#fee2e2', icon: '🔴' },
  'Bloqué PV': { color: '#8b5cf6', bg: '#ede9fe', icon: '🔒' },
};

// ─── Attachment input (file or Drive link) ───────────────────────────────────
const AttachmentInput = ({ value, onChange, label = 'Pièce jointe' }) => {
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange({ type: 'file', name: file.name, data: ev.target.result });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{label}</label>
      {value?.type === 'file' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '0.5rem' }}>
          <FileText size={14} color="#059669" />
          <span style={{ fontSize: '0.8rem', color: '#059669', flex: 1 }}>{value.name}</span>
          <button onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}><X size={14} /></button>
        </div>
      ) : value?.type === 'drive' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input value={value.url || ''} onChange={e => onChange({ type: 'drive', url: e.target.value })}
            placeholder="Lien Google Drive..."
            style={{ flex: 1, padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.8rem' }}
          />
          {value.url && <a href={value.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1e88e5' }}><ExternalLink size={14} /></a>}
          <button onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}><X size={14} /></button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}>
            <Upload size={13} /> Fichier
            <input type="file" style={{ display: 'none' }} onChange={handleFile} />
          </label>
          <button onClick={() => onChange({ type: 'drive', url: '' })}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}>
            <Link size={13} /> Drive
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Versement Row ────────────────────────────────────────────
const VersementRow = ({ versement, onUpdate, onDelete, delaiPaiementJours }) => {
  const [expanded, setExpanded] = useState(false);

  const pvBloque = versement.pvId && versement.pvStatus !== 'Validé';

  // Auto compute status based on PV status and deadline
  const computedStatus = useMemo(() => {
    if (pvBloque) return 'Bloqué PV';
    if (versement.statut === 'Payé') return 'Payé';
    if (!versement.dateEcheance) return 'En attente';
    const echeance = new Date(versement.dateEcheance);
    const now = new Date();
    if (now > echeance) return 'Retard';
    return 'En attente';
  }, [versement, pvBloque]);

  const status = paymentStatuses[computedStatus] || paymentStatuses['En attente'];

  return (
    <div style={{ border: `1px solid ${status.color}30`, borderRadius: '0.75rem', overflow: 'hidden', background: 'white' }}>
      {/* PV Bloqué Banner */}
      {pvBloque && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.5rem 1rem',
          background: 'linear-gradient(90deg, #ede9fe, #f5f3ff)',
          borderBottom: '1px solid #ddd6fe',
          fontSize: '0.8rem', color: '#6d28d9', fontWeight: 600,
        }}>
          🔒 <strong>PV {versement.pvId}</strong> en attente de validation — ce versement sera débloqué dans l'onglet <strong>Expédition &amp; Colisage</strong> après validation.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', background: `${status.bg}60` }}
        onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: '1.1rem' }}>{status.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{versement.id}</span>
            {versement.pvId && (
              <span style={{
                fontSize: '0.72rem', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 700,
                background: versement.pvStatus === 'Validé' ? '#dcfce7' : '#ede9fe',
                color: versement.pvStatus === 'Validé' ? '#065f46' : '#6d28d9',
              }}>
                PV: {versement.pvId} {versement.pvStatus === 'Validé' ? '✅' : '🔒'}
              </span>
            )}
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: status.bg, color: status.color }}>
              {computedStatus}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>Montant: <strong>{(versement.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></span>
            {versement.dateEcheance && <span>Échéance: {new Date(versement.dateEcheance).toLocaleDateString('fr-FR')}</span>}
            {versement.datePaiement && <span style={{ color: '#10b981' }}>Payé le: {new Date(versement.datePaiement).toLocaleDateString('fr-FR')}</span>}
            {(versement.etages || []).length > 0 && <span>Étages : {versement.etages.join(', ')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Bouton Marqué Payé — bloqué si PV non validé */}
          {computedStatus !== 'Payé' && (
            pvBloque ? (
              <span title="Déblouez le PV d'abord dans Expédition" style={{
                padding: '0.3rem 0.65rem', background: '#f3f4f6', border: '1px solid #e5e7eb',
                borderRadius: '0.4rem', fontSize: '0.78rem', color: '#9ca3af', cursor: 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                🔒 En attente PV
              </span>
            ) : (
              <button onClick={e => { e.stopPropagation(); onUpdate({ ...versement, statut: 'Payé', datePaiement: new Date().toISOString() }); }}
                style={{ padding: '0.3rem 0.65rem', background: '#10b981', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: 'white', fontSize: '0.78rem', fontWeight: 700 }}>
                Marquer Payé
              </button>
            )
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(versement.id); }}
            style={{ padding: '0.3rem 0.5rem', background: '#fee2e2', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#ef4444' }}>
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '1rem', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', opacity: pvBloque ? 0.6 : 1 }}>
          <div className="form-group">
            <label className="label">Montant (DZD)</label>
            <input className="input" type="number" value={versement.montant || 0} disabled={pvBloque}
              onChange={e => onUpdate({ ...versement, montant: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label className="label">Date d'échéance</label>
            <input className="input" type="date" value={versement.dateEcheance ? versement.dateEcheance.slice(0, 10) : ''}
              onChange={e => onUpdate({ ...versement, dateEcheance: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
          {!pvBloque && (
            <div className="form-group">
              <label className="label">Statut</label>
              <select className="input" value={versement.statut || 'En attente'}
                onChange={e => onUpdate({ ...versement, statut: e.target.value, datePaiement: e.target.value === 'Payé' ? new Date().toISOString() : versement.datePaiement })}>
                <option>En attente</option>
                <option>Payé</option>
              </select>
            </div>
          )}
          {versement.statut === 'Payé' && (
            <div className="form-group">
              <label className="label">Date de paiement</label>
              <input className="input" type="date" value={versement.datePaiement ? versement.datePaiement.slice(0, 10) : ''}
                onChange={e => onUpdate({ ...versement, datePaiement: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <AttachmentInput label="Pièce jointe / Lien Drive" value={versement.attachment}
              onChange={v => onUpdate({ ...versement, attachment: v })} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Single Tracker View ──────────────────────────────────────────────────────
const TrackerView = ({ tracker, data, setData, onBack }) => {
  const contract = (data.contracts || []).find(c => c.id === tracker.contractId);
  const client = (data.clients || []).find(c => c.id === tracker.clientId);
  const order = (data.orders || []).find(o => o.id === tracker.orderId);

  const versements = tracker.versements || [];
  const avance = tracker.avance || { montant: 0, date: null, fichier: null, lienDrive: '' };

  const totalVerse = useMemo(() => {
    const totalV = versements.filter(v => v.statut === 'Payé').reduce((s, v) => s + (v.montant || 0), 0);
    return totalV + (avance.montant || 0);
  }, [versements, avance]);

  const montantContrat = tracker.montantContrat || 0;
  const resteTotal = montantContrat - totalVerse;
  const pctPaye = montantContrat > 0 ? Math.min(100, (totalVerse / montantContrat) * 100) : 0;

  const updateTracker = (updatedTracker) => {
    setData(prev => ({
      ...prev,
      financialTrackers: (prev.financialTrackers || []).map(t => t.id === updatedTracker.id ? updatedTracker : t),
    }));
  };

  const handleAvanceChange = (field, value) => {
    const updated = { ...tracker, avance: { ...avance, [field]: value } };
    updateTracker(updated);
  };

  const handleAddVersement = () => {
    const newVers = {
      id: `VRS-${Date.now().toString().slice(-5)}`,
      pvId: null,
      pvStatus: 'Validé',   // création manuelle = pas de PV à valider
      montant: 0,
      statut: 'En attente',
      dateEcheance: null,
      datePaiement: null,
      attachment: null,
      etages: [],
      createdAt: new Date().toISOString(),
    };
    updateTracker({ ...tracker, versements: [...versements, newVers] });
  };

  const handleUpdateVersement = (updated) => {
    updateTracker({ ...tracker, versements: versements.map(v => v.id === updated.id ? updated : v) });
  };

  const handleDeleteVersement = (id) => {
    if (!window.confirm('Supprimer ce versement ?')) return;
    updateTracker({ ...tracker, versements: versements.filter(v => v.id !== id) });
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', marginBottom: '1.25rem', fontWeight: 600 }}>
        ← Retour à la liste
      </button>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Montant Contrat', value: montantContrat, color: '#0f4c75', bg: '#eff6ff' },
          { label: 'Total Versé (+ avance)', value: totalVerse, color: '#059669', bg: '#f0fdf4' },
          { label: 'Reste à payer', value: resteTotal, color: resteTotal > 0 ? '#dc2626' : '#059669', bg: resteTotal > 0 ? '#fff1f2' : '#f0fdf4' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '0.75rem', padding: '1.25rem', border: `1px solid ${k.color}20` }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '1.3rem', fontWeight: 800, color: k.color }}>
              {k.value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD
            </p>
          </div>
        ))}
        <div style={{ background: '#fafafa', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Avancement Paiement</p>
          <div style={{ marginTop: '0.5rem', height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctPaye}%`, background: pctPaye >= 100 ? '#10b981' : pctPaye > 50 ? '#f59e0b' : '#3b82f6', borderRadius: '99px', transition: 'width 0.5s' }} />
          </div>
          <p style={{ margin: '0.3rem 0 0', fontSize: '1.1rem', fontWeight: 700, color: pctPaye >= 100 ? '#059669' : '#374151' }}>{pctPaye.toFixed(1)}%</p>
        </div>
      </div>

      {/* Info commande / contrat */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass" style={{ padding: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Informations</p>
          <p style={{ margin: 0 }}><strong>Client :</strong> {client?.nom || tracker.clientId}</p>
          <p style={{ margin: '0.25rem 0 0' }}><strong>Commande :</strong> {tracker.orderId}</p>
          <p style={{ margin: '0.25rem 0 0' }}><strong>Contrat :</strong> {tracker.contractId} {contract?.status === 'Figé' ? '🔒' : ''}</p>
          <p style={{ margin: '0.25rem 0 0' }}><strong>Délai paiement :</strong> {contract?.delaiPaiementJours || '—'} jours</p>
        </div>
        {/* Avance section */}
        <div className="glass" style={{ padding: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>💵 Avance</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
              <label className="label">Montant avance (DZD)</label>
              <input className="input" type="number" value={avance.montant || 0}
                onChange={e => handleAvanceChange('montant', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
              <label className="label">Date de versement</label>
              <input className="input" type="date" value={avance.date ? avance.date.slice(0, 10) : ''}
                onChange={e => handleAvanceChange('date', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </div>
          </div>
          <AttachmentInput label="Pièce jointe / Lien Drive (avance)" value={avance.attachment}
            onChange={v => handleAvanceChange('attachment', v)} />
        </div>
      </div>

      {/* Versements */}
      <div className="glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>📋 Versements ({versements.length})</h3>
          <button onClick={handleAddVersement}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#0f4c75', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
            <Plus size={14} /> Ajouter Versement
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {versements.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem 0', fontSize: '0.9rem' }}>
              Aucun versement. Les versements sont créés automatiquement lors de la validation des PV de réception, ou manuellement ci-dessus.
            </p>
          ) : versements.map(v => (
            <VersementRow key={v.id} versement={v} onUpdate={handleUpdateVersement} onDelete={handleDeleteVersement}
              delaiPaiementJours={contract?.delaiPaiementJours || 30} />
          ))}
        </div>
        {/* Summary */}
        {versements.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '0.5rem', display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
            <span>Versements payés : <strong style={{ color: '#059669' }}>{versements.filter(v => v.statut === 'Payé').length}</strong></span>
            <span>En attente : <strong style={{ color: '#d97706' }}>{versements.filter(v => v.statut !== 'Payé').length}</strong></span>
            <span>Total versements : <strong>{versements.reduce((s, v) => s + (v.montant || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Financial Tracker List ───────────────────────────────────────────────────
const FinancialTracker = ({ data, setData, quoteSettings }) => {
  const [selectedTrackerId, setSelectedTrackerId] = useState(null);
  const trackers = data.financialTrackers || [];
  const contracts = data.contracts || [];
  const clients = data.clients || [];
  const orders = data.orders || [];

  const selectedTracker = trackers.find(t => t.id === selectedTrackerId);

  if (selectedTracker) {
    return <TrackerView tracker={selectedTracker} data={data} setData={setData} onBack={() => setSelectedTrackerId(null)} />;
  }

  return (
    <div>
      <div className="glass" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>💰 Suivis Financiers</h2>
        {trackers.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
            Aucun suivi financier. Finalisez un contrat pour en créer un automatiquement.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Suivi</th>
                  <th>Contrat</th>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Montant Contrat</th>
                  <th>Versé</th>
                  <th>Reste</th>
                  <th>Avancement</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {trackers.map(t => {
                  const client = clients.find(c => c.id === t.clientId);
                  const versements = t.versements || [];
                  const avanceMontant = t.avance?.montant || 0;
                  const totalVerse = versements.filter(v => v.statut === 'Payé').reduce((s, v) => s + (v.montant || 0), 0) + avanceMontant;
                  const reste = (t.montantContrat || 0) - totalVerse;
                  const pct = t.montantContrat > 0 ? Math.min(100, (totalVerse / t.montantContrat) * 100) : 0;
                  const hasRetard = versements.some(v => {
                    if (v.statut === 'Payé') return false;
                    if (v.pvId && v.pvStatus !== 'Validé') return false; // ignorer bloqués PV
                    if (!v.dateEcheance) return false;
                    return new Date() > new Date(v.dateEcheance);
                  });
                  const hasBloquesPV = versements.some(v => v.pvId && v.pvStatus !== 'Validé' && v.statut !== 'Payé');

                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700, color: '#0f4c75' }}>{t.id}</td>
                      <td style={{ fontSize: '0.85rem' }}>{t.contractId}</td>
                      <td>{t.orderId}</td>
                      <td>{client?.nom || t.clientId}</td>
                      <td style={{ fontWeight: 600 }}>{(t.montantContrat || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{totalVerse.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                      <td style={{ color: reste > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>{reste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', minWidth: '80px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: hasRetard ? '#ef4444' : pct >= 100 ? '#10b981' : '#3b82f6', borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: hasRetard ? '#ef4444' : '#374151' }}>
                            {hasRetard ? '🔴 ' : ''}{pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => setSelectedTrackerId(t.id)}
                          style={{ padding: '0.3rem 0.75rem', background: '#eff6ff', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#0f4c75', fontWeight: 700, fontSize: '0.8rem' }}>
                          Ouvrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialTracker;
