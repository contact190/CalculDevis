import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { CreditCard, Plus, Upload, ExternalLink, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Trash2, FileText, Link, X, Download } from 'lucide-react';
import {
  drawDocumentHeader,
  formatAmountFR,
  amountToWordsFR,
  getCityFromAddress,
  buildAttachementRows,
  getSituationNumber,
  resolveClientRecord,
  drawSituationClientBlock,
  drawSituationTable,
} from '../../utils/pdfDocumentUtils';

const paymentStatuses = {
  'Payé': { color: '#10b981', bg: '#d1fae5', icon: '✅' },
  'En attente': { color: '#f59e0b', bg: '#fef3c7', icon: '⏳' },
  'Retard': { color: '#ef4444', bg: '#fee2e2', icon: '🔴' },
  'Bloqué PV': { color: '#8b5cf6', bg: '#ede9fe', icon: '🔒' },
};

// ─── Attachment input (file or Drive link) ───────────────────────────────────
const AttachmentInput = ({ value, onChange, label = 'Lien Drive' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input value={value?.url || ''} onChange={e => onChange(e.target.value ? { type: 'drive', url: e.target.value } : null)}
          placeholder="Lien Google Drive..."
          style={{ flex: 1, padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.8rem' }}
        />
        {value?.url && <a href={value.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1e88e5' }}><ExternalLink size={14} /></a>}
      </div>
    </div>
  );
};

// ─── Versement Row ────────────────────────────────────────────
const VersementRow = ({ versement, onUpdate, onDelete, delaiPaiementJours, onGenerateSituation, onGenerateAttachement, onGenerateOrdreVersement }) => {
  const [expanded, setExpanded] = useState(false);

  const pvBloque = versement.pvId && versement.pvStatus !== 'Validé';
  const isPV = !!versement.pvId;

  // Support for partial payments
  const paiements = versement.paiements || [];
  let effectivePaiements = [...paiements];

  // Migration on the fly for old "Payé" versements
  if (isPV && versement.statut === 'Payé' && effectivePaiements.length === 0) {
    effectivePaiements = [{
      id: `PAI-LEGACY`,
      montant: versement.montant || 0,
      date: versement.datePaiement || new Date().toISOString(),
      attachment: versement.attachment || null
    }];
  }

  const totalPayePV = isPV ? effectivePaiements.reduce((sum, p) => sum + (p.montant || 0), 0) : 0;
  const restePV = (versement.montant || 0) - totalPayePV;

  // Auto compute status based on PV status and deadline
  const computedStatus = useMemo(() => {
    if (pvBloque) return 'Bloqué PV';
    if (isPV) {
      if (effectivePaiements.length > 0 && restePV <= 0) return 'Payé';
      if (!versement.dateEcheance) return 'En attente';
      const echeance = new Date(versement.dateEcheance);
      if (new Date() > echeance && restePV > 0) return 'Retard';
      return 'En attente';
    } else {
      if (versement.statut === 'Payé') return 'Payé';
      if (!versement.dateEcheance) return 'En attente';
      const echeance = new Date(versement.dateEcheance);
      if (new Date() > echeance) return 'Retard';
      return 'En attente';
    }
  }, [versement, pvBloque, isPV, effectivePaiements.length, restePV]);

  const status = paymentStatuses[computedStatus] || paymentStatuses['En attente'];

  const handleAddPaiement = () => {
    const newP = { id: `PAI-${Date.now().toString().slice(-5)}`, montant: restePV > 0 ? restePV : 0, date: new Date().toISOString(), attachment: null };
    onUpdate({ ...versement, paiements: [...effectivePaiements, newP], statut: 'Partiel' });
  };

  const handleUpdatePaiement = (idx, field, value) => {
    const newPaiements = [...effectivePaiements];
    newPaiements[idx] = { ...newPaiements[idx], [field]: value };
    onUpdate({ ...versement, paiements: newPaiements });
  };

  const handleDeletePaiement = (idx) => {
    const newPaiements = effectivePaiements.filter((_, i) => i !== idx);
    onUpdate({ ...versement, paiements: newPaiements });
  };

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
            {isPV && (
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
            <span>Montant Total: <strong>{(versement.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></span>
            {isPV && <span>Payé: <strong style={{ color: '#059669' }}>{totalPayePV.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></span>}
            {isPV && restePV > 0 && <span>Reste: <strong style={{ color: '#ef4444' }}>{restePV.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></span>}
            {versement.dateEcheance && <span>Échéance: {new Date(versement.dateEcheance).toLocaleDateString('fr-FR')}</span>}
            {!isPV && versement.datePaiement && <span style={{ color: '#10b981' }}>Payé le: {new Date(versement.datePaiement).toLocaleDateString('fr-FR')}</span>}
            {(versement.etages || []).length > 0 && <span>Étages : {versement.etages.join(', ')}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Bouton Marqué Payé — bloqué si PV non validé */}
          {computedStatus !== 'Payé' && !isPV && (
            <button onClick={e => { e.stopPropagation(); onUpdate({ ...versement, statut: 'Payé', datePaiement: new Date().toISOString() }); }}
              style={{ padding: '0.3rem 0.65rem', background: '#10b981', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: 'white', fontSize: '0.78rem', fontWeight: 700 }}>
              Marquer Payé
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(versement.id); }}
            style={{ padding: '0.3rem 0.5rem', background: '#fee2e2', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', color: '#ef4444' }}>
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1rem', opacity: pvBloque ? 0.6 : 1 }}>
          {isPV && !pvBloque && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
               <button onClick={(e) => { e.stopPropagation(); onGenerateSituation(versement); }}
                 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                 <Download size={14} /> Situation des travaux
               </button>
               <button onClick={(e) => { e.stopPropagation(); onGenerateAttachement(versement); }}
                 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                 <Download size={14} /> Attachement des travaux
               </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="label">Montant Total PV (DZD)</label>
              <input className="input" type="number" value={versement.montant || 0} disabled={pvBloque || isPV}
                onChange={e => onUpdate({ ...versement, montant: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label className="label">Date d'échéance</label>
              <input className="input" type="date" value={versement.dateEcheance ? versement.dateEcheance.slice(0, 10) : ''}
                onChange={e => onUpdate({ ...versement, dateEcheance: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            {!isPV && (
              <>
                <div className="form-group">
                  <label className="label">Statut</label>
                  <select className="input" value={versement.statut || 'En attente'} disabled={versement.isConfirmed}
                    onChange={e => onUpdate({ ...versement, statut: e.target.value, datePaiement: e.target.value === 'Payé' ? new Date().toISOString() : versement.datePaiement })}>
                    <option>En attente</option>
                    <option>Payé</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Date de paiement</label>
                  <input className="input" type="date" value={versement.datePaiement ? versement.datePaiement.slice(0, 10) : ''} disabled={versement.isConfirmed}
                    onChange={e => onUpdate({ ...versement, datePaiement: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
                <div className="form-group">
                  <label className="label">Mode de paiement</label>
                  <select className="input" value={versement.modePaiement || ''} disabled={versement.isConfirmed}
                    onChange={e => onUpdate({ ...versement, modePaiement: e.target.value })}>
                    <option value="">Sélectionner</option>
                    <option value="Espèce">Espèce</option>
                    <option value="Chèque">Chèque</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  {!versement.isConfirmed ? (
                    <AttachmentInput label="Lien Drive" value={versement.attachment}
                      onChange={v => onUpdate({ ...versement, attachment: v })} />
                  ) : (
                    versement.attachment?.url ? <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}><a href={versement.attachment.url} target="_blank" rel="noreferrer">Ouvrir le Lien Drive</a></div> : <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#94a3b8' }}>Aucun lien Drive</div>
                  )}
                </div>
                {versement.modePaiement === 'Espèce' && (
                  <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); onGenerateOrdreVersement(versement.montant, versement.datePaiement, versement.modePaiement); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                      <FileText size={14} /> Générer Ordre de Versement
                    </button>
                  </div>
                )}
                {!versement.isConfirmed && versement.statut === 'Payé' && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'right', marginTop: '0.5rem' }}>
                    <button onClick={() => { if(window.confirm('Confirmer définitivement ce versement ?')) onUpdate({...versement, isConfirmed: true}); }} style={{ padding: '0.4rem 0.8rem', background: '#059669', color: 'white', border: 'none', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                      ✓ Confirmer le versement
                    </button>
                  </div>
                )}
                {versement.isConfirmed && (
                   <div style={{ gridColumn: '1 / -1', textAlign: 'right', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 'bold' }}>🔒 Versement Confirmé</span>
                   </div>
                )}
              </>
            )}
          </div>

          {/* Sous-Paiements pour les PVs */}
          {isPV && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>Paiements associés au PV</h4>
                <button onClick={handleAddPaiement} disabled={pvBloque}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.6rem', background: '#0f4c75', color: 'white', border: 'none', borderRadius: '0.3rem', fontSize: '0.75rem', cursor: pvBloque ? 'not-allowed' : 'pointer', opacity: pvBloque ? 0.5 : 1 }}>
                  <Plus size={12} /> Ajouter un paiement
                </button>
              </div>
              
              {effectivePaiements.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', margin: 0 }}>Aucun paiement enregistré pour ce PV.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {effectivePaiements.map((p, idx) => (
                    <div key={p.id || idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'white', padding: '0.75rem', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="label" style={{ fontSize: '0.7rem' }}>Montant</label>
                        <input className="input" type="number" value={p.montant || 0} disabled={p.isConfirmed}
                          onChange={e => handleUpdatePaiement(idx, 'montant', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="label" style={{ fontSize: '0.7rem' }}>Date</label>
                        <input className="input" type="date" value={p.date ? p.date.slice(0, 10) : ''} disabled={p.isConfirmed}
                          onChange={e => handleUpdatePaiement(idx, 'date', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="label" style={{ fontSize: '0.7rem' }}>Mode</label>
                        <select className="input" value={p.modePaiement || ''} disabled={p.isConfirmed}
                          onChange={e => handleUpdatePaiement(idx, 'modePaiement', e.target.value)}>
                          <option value="">Sél.</option>
                          <option value="Espèce">Espèce</option>
                          <option value="Chèque">Chèque</option>
                        </select>
                      </div>
                      <div style={{ flex: 2 }}>
                         {!p.isConfirmed ? (
                           <AttachmentInput label="Lien Drive" value={p.attachment} onChange={v => handleUpdatePaiement(idx, 'attachment', v)} />
                         ) : (
                           p.attachment?.url ? <div style={{ fontSize: '0.75rem', marginTop: '1.2rem' }}><a href={p.attachment.url} target="_blank" rel="noreferrer">Ouvrir le Lien Drive</a></div> : <div style={{ fontSize: '0.75rem', marginTop: '1.2rem', color: '#94a3b8' }}>Aucun lien Drive</div>
                         )}
                         {p.modePaiement === 'Espèce' && (
                           <button onClick={(e) => { e.stopPropagation(); onGenerateOrdreVersement(p.montant, p.date, p.modePaiement); }}
                             style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.5rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, color: '#334155', alignSelf: 'flex-start' }}>
                             <FileText size={12} /> Ordre Versement
                           </button>
                         )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1.2rem' }}>
                        {!p.isConfirmed && (
                          <button onClick={() => { if(window.confirm('Confirmer ce paiement définitivement ?')) handleUpdatePaiement(idx, 'isConfirmed', true); }} style={{ background: '#059669', border: 'none', color: 'white', borderRadius: '0.3rem', cursor: 'pointer', padding: '0.3rem 0.5rem', fontSize: '0.7rem', fontWeight: 600 }}>
                            Confirmer
                          </button>
                        )}
                        {p.isConfirmed && <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 'bold', alignSelf: 'center' }}>🔒 Confirmé</span>}
                        {!p.isConfirmed && (
                          <button onClick={() => handleDeletePaiement(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.3rem', alignSelf: 'center' }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// ─── Single Tracker View ──────────────────────────────────────────────────────
const TrackerView = ({ tracker, data, setData, onBack, quoteSettings }) => {
  const contract = (data.contracts || []).find(c => c.id === tracker.contractId);
  const client = (data.clients || []).find(c => c.id === tracker.clientId);
  const order = (data.orders || []).find(o => o.id === tracker.orderId);

  const versements = tracker.versements || [];
  const avance = tracker.avance || { montant: 0, date: null, fichier: null, lienDrive: '' };

  const totalVerse = useMemo(() => {
    const totalV = versements.reduce((s, v) => {
      if (v.pvId) {
        const pvPaiements = v.paiements || [];
        return s + pvPaiements.reduce((sum, p) => sum + (p.montant || 0), 0);
      } else {
        return s + (v.statut === 'Payé' ? (v.montant || 0) : 0);
      }
    }, 0);
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

  const handleGenerateSituation = (versement) => {
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const clientRecord = resolveClientRecord(tracker, order, contract, data.clients, data.quotes);
    const situationNum = getSituationNumber(versements, versement);
    const versementIndex = versements.findIndex(v => v.id === versement.id);
    const prevVersements = versements.slice(0, versementIndex);
    const currentAndPrev = versements.slice(0, versementIndex + 1);
    const tvaRate = contract?.tauxTVA ?? quoteSettings?.tvaRate ?? 9;
    const tvaMultiplier = 1 + tvaRate / 100;

    const cumulHT = currentAndPrev.reduce((s, v) => s + (v.montant || 0) / tvaMultiplier, 0);
    const prevHT = prevVersements.reduce((s, v) => s + (v.montant || 0) / tvaMultiplier, 0);
    const currentHT = (versement.montant || 0) / tvaMultiplier;
    const avanceTTC = avance.montant || 0;
    const total1 = cumulHT * tvaMultiplier - avanceTTC;
    const total2 = prevHT * tvaMultiplier;
    const total3 = avanceTTC > 0 && versementIndex === 0 ? avanceTTC : 0;
    const tvaAmount = currentHT * (tvaRate / 100);
    const brutTTC = versement.montant || 0;
    const netTTC = Math.max(0, total1 - total2 + total3);

    let y = drawDocumentHeader(doc, quoteSettings, clientRecord, { showClientBox: false });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`SITUATION DES TRAVAUX N° ${situationNum}`, pw / 2, y + 4, { align: 'center' });
    const city = getCityFromAddress(quoteSettings?.companyAddress);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${city} le : ${new Date().toLocaleDateString('fr-FR')}`, pw - 15, y + 4, { align: 'right' });
    y += 12;

    y = drawSituationClientBlock(doc, clientRecord, y, pw, {
      projet: order?.projectName || order?.sitePlanName || tracker.orderId,
      lot: 'Fourniture et pose de menuiserie aluminium (Fenêtres et Portes-fenêtres)',
      montantContrat,
    });

    const prevDate = prevVersements.length > 0
      ? new Date(prevVersements[prevVersements.length - 1].createdAt || Date.now()).toLocaleDateString('fr-FR')
      : new Date(tracker.createdAt || Date.now()).toLocaleDateString('fr-FR');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Arrêtée le : ${prevDate}`, 15, y);
    y += 6;

    y = drawSituationTable(doc, y, pw, [
      { label: 'Montant des travaux cumulés en HT', amount: cumulHT },
      { label: 'Avances perçues à ce jour en TTC', amount: avanceTTC > 0 ? -avanceTTC : 0 },
      { label: 'Total (1)', amount: total1, bold: true, isSectionEnd: true },
      { label: 'A déduire', amount: null, sectionTitle: true },
      { label: 'Montant des travaux réalisés précédemment en HT', amount: prevHT, indent: 4 },
      { label: 'Avances perçues antérieurement en TTC', amount: versementIndex > 0 ? 0 : (avanceTTC > 0 ? -avanceTTC : 0), indent: 4 },
      { label: 'Total (2)', amount: total2, bold: true, indent: 4, isSectionEnd: true },
      { label: 'Remboursement à effectuer', amount: null, sectionTitle: true },
      { label: 'Avances perçues antérieurement en TTC', amount: total3, indent: 4 },
      { label: 'Total (3)', amount: total3, bold: true, indent: 4, isSectionEnd: true },
      { label: `Montant de la TVA ${tvaRate}%`, amount: tvaAmount, bold: true },
      { label: 'Montant Brut de la situation en TTC', amount: brutTTC, bold: true },
      { label: 'Montant net à payer à l\'entreprise en TTC', amount: netTTC, bold: true },
    ]);

    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(amountToWordsFR(netTTC), 15, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`Fait à ${city} le ${new Date().toLocaleDateString('fr-FR')}`, 15, y);

    // Safe page check for signatures (needs about 25mm of space)
    if (y + 25 > ph - 18) {
      doc.addPage();
      y = 20;
    } else {
      y = Math.max(y + 12, ph - 42); // ph - 42 is 255. Signature line will be at 255 + 16 = 271, which is safe.
    }
    
    // Draw thin line for signatures
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    
    // Entreprise
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('L\'Entreprise :', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('(Signature et cachet)', 15, y + 4);
    doc.line(15, y + 16, 75, y + 16);

    // Maître d'ouvrage
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Le Maître de l\'Ouvrage :', pw - 75, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('(Signature)', pw - 75, y + 4);
    doc.line(pw - 75, y + 16, pw - 15, y + 16);

    doc.save(`Situation_${situationNum}_${versement.pvId || versement.id}.pdf`);
  };

  const drawAttachementTableHeader = (doc, y, pw) => {
    const tableX = 15;
    const tableW = pw - 30;
    const colNum = tableX + 1;
    const colDes = tableX + 10;
    const colU = 108;
    const colQC = 116;
    const colQP = 131;
    const colQM = 146;
    const colQCu = 161;
    const colObs = 176;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(tableX, y, tableW, 16);
    doc.line(colDes - 1, y, colDes - 1, y + 16);
    doc.line(colU - 1, y, colU - 1, y + 16);
    doc.line(colQC - 1, y + 8, colQCu + 14, y + 8);
    doc.line(colQC - 1, y, colQC - 1, y + 16);
    doc.line(colQP - 1, y + 8, colQP - 1, y + 16);
    doc.line(colQM - 1, y + 8, colQM - 1, y + 16);
    doc.line(colQCu - 1, y + 8, colQCu - 1, y + 16);
    doc.line(colObs - 1, y, colObs - 1, y + 16);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('N°', colNum + 1, y + 5);
    doc.text('Désignation des Ouvrages', colDes + 1, y + 5);
    doc.text('U', colU + 2, y + 5);
    doc.text('Quantité', colQC + 8, y + 4);
    doc.text('QTE', colQC + 1, y + 11);
    doc.text('Contrat', colQC, y + 15);
    doc.text('QTE', colQP + 1, y + 11);
    doc.text('Préce', colQP, y + 15);
    doc.text('QTE', colQM + 1, y + 11);
    doc.text('Mois', colQM + 1, y + 15);
    doc.text('QTE', colQCu + 1, y + 11);
    doc.text('Cumul', colQCu, y + 15);
    doc.text('Observations', colObs + 1, y + 5);

    return { y: y + 16, colNum, colDes, colU, colQC, colQP, colQM, colQCu, colObs, tableX, tableW };
  };

  const handleGenerateAttachement = (versement) => {
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const clientRecord = resolveClientRecord(tracker, order, contract, data.clients, data.quotes);
    const situationNum = getSituationNumber(versements, versement);
    const versementIndex = versements.findIndex(v => v.id === versement.id);
    const prevVersements = versements.slice(0, versementIndex);
    const rows = buildAttachementRows(order, versement, prevVersements);

    let y = drawDocumentHeader(doc, quoteSettings, clientRecord, { showClientBox: false });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`ATTACHEMENT DES TRAVAUX N° ${situationNum}`, pw / 2, y + 4, { align: 'center' });
    const city = getCityFromAddress(quoteSettings?.companyAddress);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${city} le : ${new Date().toLocaleDateString('fr-FR')}`, pw - 15, y + 4, { align: 'right' });
    y += 12;
    doc.text(`Projet : ${order?.projectName || clientRecord?.nom || tracker.orderId}`, 15, y);
    y += 8;

    let cols = drawAttachementTableHeader(doc, y, pw);
    y = cols.y;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    rows.forEach(row => {
      const desLines = doc.splitTextToSize(row.designation, 80);
      const rowH = Math.max(desLines.length * 3.5, 8);
      if (y + rowH > 275) {
        doc.addPage();
        cols = drawAttachementTableHeader(doc, 20, pw);
        y = cols.y;
      }

      doc.rect(cols.tableX, y, cols.tableW, rowH);
      doc.line(cols.colDes - 1, y, cols.colDes - 1, y + rowH);
      doc.line(cols.colU - 1, y, cols.colU - 1, y + rowH);
      doc.line(cols.colQC - 1, y, cols.colQC - 1, y + rowH);
      doc.line(cols.colQP - 1, y, cols.colQP - 1, y + rowH);
      doc.line(cols.colQM - 1, y, cols.colQM - 1, y + rowH);
      doc.line(cols.colQCu - 1, y, cols.colQCu - 1, y + rowH);
      doc.line(cols.colObs - 1, y, cols.colObs - 1, y + rowH);

      doc.text(row.num, cols.colNum + 1, y + 4);
      doc.text(desLines, cols.colDes + 1, y + 4);
      doc.text(row.unit, cols.colU + 2, y + 4);
      doc.text(formatAmountFR(row.qteContrat, 0), cols.colQC + 7, y + 4, { align: 'right' });
      doc.text(formatAmountFR(row.qtePrece, 2), cols.colQP + 7, y + 4, { align: 'right' });
      doc.text(formatAmountFR(row.qteMois, 2), cols.colQM + 7, y + 4, { align: 'right' });
      doc.text(formatAmountFR(row.qteCumul, 2), cols.colQCu + 7, y + 4, { align: 'right' });
      if (row.observations) {
        doc.text(doc.splitTextToSize(row.observations, 18), cols.colObs + 1, y + 4);
      }

      y += rowH;
    });

    if (rows.length === 0) {
      doc.rect(cols.tableX, y, cols.tableW, 10);
      doc.text('Aucun ouvrage réceptionné pour ce PV.', cols.colDes + 1, y + 6);
    }

    doc.save(`Attachement_${situationNum}_${versement.pvId || versement.id}.pdf`);
  };

  const handleGenerateOrdreVersement = (montant, date, clientNom, orderId, mode) => {
    const depositaire = window.prompt("Nom de la personne qui a effectué le versement :", clientNom || "");
    if (depositaire === null) return; // user cancelled generation

    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const halfH = ph / 2;

    const drawReceipt = (startY) => {
      // 1. Logo
      if (quoteSettings?.logoBase64) {
        try {
          const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
          const maxW = 45;
          const maxH = 18;
          const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
          const w = imgProps.width * ratio;
          const h = imgProps.height * ratio;
          doc.addImage(quoteSettings.logoBase64, 'PNG', 15, startY + 12, w, h, '', 'FAST');
        } catch (e) {
          try {
            doc.addImage(quoteSettings.logoBase64, 'PNG', 15, startY + 12, 45, 18, '', 'FAST');
          } catch (e2) {}
        }
      }

      // 2. Entreprise / Fournisseur
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      const companyName = quoteSettings?.companyName || 'EURL IDEAL ALUMINIUM';
      doc.text(companyName, 65, startY + 17);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // Slate-500
      const companyAddress = quoteSettings?.companyAddress || '';
      const companyPhone = quoteSettings?.companyPhone || '';
      let headerParts = [];
      if (companyAddress) headerParts.push(companyAddress);
      if (companyPhone) headerParts.push(`Tél : ${companyPhone}`);
      if (headerParts.length > 0) {
        doc.text(headerParts.join(' | '), 65, startY + 22);
      }

      // 3. Receipt Box
      const boxY = startY + 34;
      const boxW = pw - 30;
      const boxH = 75;

      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.setLineWidth(0.4);
      doc.roundedRect(15, boxY, boxW, boxH, 2, 2);

      // Header Bar inside Box
      doc.setDrawColor(226, 232, 240); // Slate-200 (very sober and light)
      doc.setLineWidth(0.25);
      doc.line(15, boxY + 11, 15 + boxW, boxY + 11);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 76, 117); // Blue
      doc.text('BON DE VERSEMENT', pw / 2, boxY + 7.5, { align: 'center' });

      // Receipt details
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85); // Slate-700

      // Client (Admin)
      doc.setFont('helvetica', 'bold');
      doc.text('Client :', 22, boxY + 18);
      doc.setFont('helvetica', 'normal');
      doc.text(clientNom || 'Client', 58, boxY + 18);

      // Versé par (Manuel)
      doc.setFont('helvetica', 'bold');
      doc.text('Versé par :', 22, boxY + 25);
      doc.setFont('helvetica', 'normal');
      doc.text(depositaire || '—', 58, boxY + 25);

      // Commande N°
      doc.setFont('helvetica', 'bold');
      doc.text('Commande N° :', 22, boxY + 32);
      doc.setFont('helvetica', 'normal');
      doc.text(String(orderId), 58, boxY + 32);

      // Date
      doc.setFont('helvetica', 'bold');
      doc.text('Date de versement :', 22, boxY + 39);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(date || Date.now()).toLocaleDateString('fr-FR'), 58, boxY + 39);

      // Mode
      doc.setFont('helvetica', 'bold');
      doc.text('Mode de paiement :', 22, boxY + 46);
      doc.setFont('helvetica', 'normal');
      doc.text(mode || 'Espèce', 58, boxY + 46);

      // Montant
      doc.setFont('helvetica', 'bold');
      doc.text('Montant :', 22, boxY + 54);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(5, 150, 105); // Green-600
      const formattedMontant = (Number(montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DZD').replace(/\s/g, ' ');
      doc.text(formattedMontant, 58, boxY + 54);

      // Montant en lettres
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`(soit : ${amountToWordsFR(montant)})`, 58, boxY + 60);

      // Signature/Stamp Box
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Signature & Cachet :', pw - 70, boxY + 20);

      doc.setDrawColor(226, 232, 240);
      doc.line(pw - 70, boxY + 66, pw - 22, boxY + 66);
    };

    // Draw first receipt (top half)
    drawReceipt(0);

    // Divider Line (dashed)
    doc.setDrawColor(148, 163, 184); // Slate-400
    doc.setLineWidth(0.4);
    if (typeof doc.setLineDashPattern === 'function') {
      doc.setLineDashPattern([2.5, 2.5], 0);
    }
    doc.line(10, halfH, pw - 10, halfH);
    if (typeof doc.setLineDashPattern === 'function') {
      doc.setLineDashPattern([], 0);
    }

    // Cut mark text
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('✂  DÉCOUPER ICI  ✂', pw - 45, halfH - 2);

    // Draw second receipt (bottom half)
    drawReceipt(halfH);

    doc.save(`Ordre_Versement_${orderId}.pdf`);
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass" style={{ padding: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Informations</p>
          <p style={{ margin: 0 }}><strong>Client :</strong> {client?.nom || tracker.clientId}</p>
          <p style={{ margin: '0.25rem 0 0' }}><strong>Commande :</strong> {tracker.orderId}</p>
          <p style={{ margin: '0.25rem 0 0' }}><strong>Contrat :</strong> {tracker.contractId} {contract?.status === 'Figé' ? '🔒' : ''}</p>
          <p style={{ margin: '0.25rem 0 0' }}><strong>Délai paiement :</strong> {contract?.delaiPaiementJours || '—'} jours</p>
        </div>
        {/* Avance section */}
        <div className="glass" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>💵 Avance</p>
            {!avance.isConfirmed && (
              <button onClick={() => { if(window.confirm('Confirmer définitivement cette avance ?')) handleAvanceChange('isConfirmed', true); }}
                style={{ padding: '0.2rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: '0.3rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}>
                ✓ Confirmer
              </button>
            )}
            {avance.isConfirmed && <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 'bold' }}>🔒 Confirmé</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
              <label className="label">Montant avance (DZD)</label>
              <input className="input" type="number" value={avance.montant || 0} disabled={avance.isConfirmed}
                onChange={e => handleAvanceChange('montant', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
              <label className="label">Date de versement</label>
              <input className="input" type="date" value={avance.date ? avance.date.slice(0, 10) : ''} disabled={avance.isConfirmed}
                onChange={e => handleAvanceChange('date', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
              <label className="label">Mode de paiement</label>
              <select className="input" value={avance.modePaiement || ''} disabled={avance.isConfirmed}
                onChange={e => handleAvanceChange('modePaiement', e.target.value)}>
                <option value="">Sélectionner</option>
                <option value="Espèce">Espèce</option>
                <option value="Chèque">Chèque</option>
              </select>
            </div>
            {avance.modePaiement === 'Espèce' && (avance.montant || 0) > 0 && (
               <button onClick={(e) => { e.stopPropagation(); handleGenerateOrdreVersement(avance.montant, avance.date, client?.nom, tracker.orderId, avance.modePaiement); }}
                 style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155', height: 'fit-content' }}>
                 <FileText size={14} /> Ordre de Versement
               </button>
            )}
          </div>
          {!avance.isConfirmed ? (
            <AttachmentInput label="Lien Drive (avance)" value={avance.attachment}
              onChange={v => handleAvanceChange('attachment', v)} />
          ) : (
            avance.attachment?.url ? <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}><a href={avance.attachment.url} target="_blank" rel="noreferrer">Ouvrir le Lien Drive</a></div> : <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#94a3b8' }}>Aucun lien Drive</div>
          )}
        </div>
        {/* Retenue de Garantie card */}
        <div className="glass" style={{ padding: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>🛡️ Retenue de Garantie</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '110px' }}>
              <label className="label">Taux (%)</label>
              <input className="input" type="number" min="0" max="100"
                value={tracker.retenueTaux !== undefined ? tracker.retenueTaux : 5}
                onChange={e => updateTracker({ ...tracker, retenueTaux: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group" style={{ flex: 1.5, minWidth: '150px' }}>
              <label className="label">Montant (DZD)</label>
              <input className="input" type="text" disabled
                value={((montantContrat * (tracker.retenueTaux !== undefined ? tracker.retenueTaux : 5)) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' DZD'}
              />
            </div>
          </div>
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: '#334155' }}>
            <strong>Date Début (Contrat validé) :</strong> {contract?.acceptedAt ? new Date(contract.acceptedAt).toLocaleDateString('fr-FR') : (contract?.createdAt ? new Date(contract.createdAt).toLocaleDateString('fr-FR') : 'Non validé')}
          </p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#334155' }}>
            <strong>Date Fin (PV Réception Final) :</strong> {finalPV?.createdAt ? new Date(finalPV.createdAt).toLocaleDateString('fr-FR') : (finalPV?.date ? new Date(finalPV.date).toLocaleDateString('fr-FR') : 'En attente')}
          </p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#0f4c75', fontWeight: 600 }}>
            <strong>Durée de la retenue :</strong> {calculateDurationStr(contract?.acceptedAt || contract?.createdAt, finalPV?.createdAt || finalPV?.date)}
          </p>
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
              delaiPaiementJours={contract?.delaiPaiementJours || 30} 
              onGenerateSituation={handleGenerateSituation}
              onGenerateAttachement={handleGenerateAttachement}
              onGenerateOrdreVersement={(montant, date, mode) => handleGenerateOrdreVersement(montant, date, client?.nom, tracker.orderId, mode)}
            />
          ))}
        </div>
        {/* Summary */}
        {versements.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '0.5rem', display: 'flex', gap: '2rem', fontSize: '0.85rem' }}>
            <span>Versements soldés : <strong style={{ color: '#059669' }}>{versements.filter(v => v.statut === 'Payé' || (v.pvId && (v.paiements||[]).reduce((s,p)=>s+p.montant,0)>=v.montant)).length}</strong></span>
            <span>En cours / Attente : <strong style={{ color: '#d97706' }}>{versements.filter(v => !(v.statut === 'Payé' || (v.pvId && (v.paiements||[]).reduce((s,p)=>s+p.montant,0)>=v.montant))).length}</strong></span>
            <span>Total versements prévus : <strong>{versements.reduce((s, v) => s + (v.montant || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></span>
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
    return <TrackerView tracker={selectedTracker} data={data} setData={setData} onBack={() => setSelectedTrackerId(null)} quoteSettings={quoteSettings} />;
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
                  const totalVerse = versements.reduce((s, v) => {
                    if (v.pvId) {
                      return s + (v.paiements || []).reduce((sum, p) => sum + (p.montant || 0), 0);
                    } else {
                      return s + (v.statut === 'Payé' ? (v.montant || 0) : 0);
                    }
                  }, 0) + avanceMontant;
                  const reste = (t.montantContrat || 0) - totalVerse;
                  const pct = t.montantContrat > 0 ? Math.min(100, (totalVerse / t.montantContrat) * 100) : 0;
                  const hasRetard = versements.some(v => {
                    if (v.pvId) {
                      const pvPaiements = v.paiements || [];
                      const pvTotalPaye = pvPaiements.reduce((s, p) => s + (p.montant || 0), 0);
                      if (v.montant && pvTotalPaye >= v.montant) return false;
                    } else {
                      if (v.statut === 'Payé') return false;
                    }
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
