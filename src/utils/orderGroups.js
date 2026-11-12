/**
 * Regroupe les commandes pour la liste de sélection de l'Atelier :
 *  - actives   : en cours de production (au moins un lot lancé, commande non terminée),
 *                la plus récemment lancée en premier ;
 *  - pending   : confirmées mais sans lot lancé ;
 *  - history   : terminées, livrées, archivées ou annulées.
 * Aucune commande n'est retirée : chaque commande se retrouve dans exactement un groupe.
 * Lecture seule.
 */
const HISTORY_STATUSES = new Set([
  'terminé / historique', 'terminé', 'termine', 'livré', 'livre',
  'archivé', 'archive', 'annulée', 'annulee', 'annulé', 'annule',
]);

export function isHistoryStatus(status) {
  return HISTORY_STATUSES.has(String(status || '').toLowerCase().trim());
}

const liveBatches = (order) => (Array.isArray(order?.batches) ? order.batches.filter(b => b && !b._deleted) : []);

/** Date (ms) du lot le plus récent d'une commande, 0 si aucune date exploitable. */
function lastBatchTime(order) {
  let max = 0;
  for (const b of liveBatches(order)) {
    const t = Date.parse(b.createdAt || b._lastModified || '');
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

export function groupOrdersForWorkshop(orders) {
  const active = [], pending = [], history = [];
  if (!Array.isArray(orders)) return { active, pending, history };
  orders.forEach((o, index) => {
    if (!o) return;
    if (isHistoryStatus(o.status)) history.push(o);
    else if (liveBatches(o).length > 0) active.push({ o, index, t: lastBatchTime(o) });
    else pending.push(o);
  });
  active.sort((a, b) => (b.t - a.t) || (a.index - b.index));
  return { active: active.map(x => x.o), pending, history };
}

/**
 * Numéro à afficher pour un document de l'Atelier.
 * Une commande garde dans son champ `number` le numéro du DEVIS dont elle est issue (ex. DEV-74018) :
 * pour une commande, on affiche donc son propre numéro (CMD-62). Pour un devis, rien ne change.
 */
export function getDocNumber(doc, fallback = '') {
  if (!doc) return fallback;
  if (typeof doc.id === 'string' && doc.id.startsWith('CMD')) return doc.id;
  return doc.number || fallback;
}
