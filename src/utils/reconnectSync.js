/**
 * Reconnexion : préparer l'état local AVANT d'y intégrer des données venues du Cloud.
 *
 * Problème corrigé : après une coupure réseau, le poste fusionnait l'instantané Cloud dans sa base,
 * puis renvoyait tout ce que cette fusion avait changé comme s'il venait de le saisir lui-même
 * (jusqu'à 600 dossiers d'un coup, avec la date du moment). Si l'instantané était en retard,
 * ces vieilles données écrasaient le travail récent des autres postes.
 *
 * Désormais, seules les vraies modifications locales pas encore envoyées partent ; ce qui vient
 * du Cloud est intégré sans être renvoyé.
 */
import { generateOps, applyOps, getSynchronizedDate } from './patchEngine.js';
import { stampDbForSync } from './sitePlanSync.js';
import { orderStateChanged } from './orderStateSync.js';

/**
 * @param {Object|null} prevDb   dernier état déjà synchronisé (référence de comparaison)
 * @param {Object} current       état local actuel
 * @param {boolean} receivingRemote  vrai pendant la fenêtre de réception d'opérations distantes
 *                                   (dans ce cas on n'envoie rien, comme avant, mais on date les plans)
 * @returns {{ base: Object, pendingOps: Array }}  base = état local daté, prêt à être fusionné ;
 *          pendingOps = modifications locales à envoyer.
 */
export function prepareLocalBeforeRemote(prevDb, current, receivingRemote) {
  try {
    if (!current || !prevDb || prevDb === current) return { base: current, pendingOps: [] };
    if (receivingRemote) {
      // Les saisies de chantier (étapes de pose, livraisons…) partent quand même : avant, un clic
      // fait dans cette fenêtre restait sur l'appareil et n'était jamais envoyé.
      const stateOps = orderStateOpsDuringRemote(prevDb, current);
      let base = current;
      if (stateOps.length > 0) {
        const applied = applyOps(current, stateOps);
        if (applied && applied.appliedCount > 0) base = applied.db;
      }
      return { base: stampDbForSync(prevDb, base, getSynchronizedDate().getTime()), pendingOps: stateOps };
    }
    const pendingOps = generateOps(prevDb, current);
    if (pendingOps.length === 0) return { base: current, pendingOps: [] };
    const applied = applyOps(current, pendingOps);
    const base = applied && applied.appliedCount > 0 ? applied.db : current;
    return { base, pendingOps };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Préparation avant reconnexion ignorée', e);
    return { base: current, pendingOps: [] };
  }
}

/**
 * Opérations à envoyer même pendant la fenêtre de réception d'opérations distantes :
 * uniquement les commandes dont un état de chantier (pose, livraison, stock fini,
 * statuts alu/vitrage) a été modifié localement. Le reste garde l'ancien comportement.
 * En cas d'erreur → aucune opération (ancien comportement).
 */
export function orderStateOpsDuringRemote(prevDb, current) {
  try {
    if (!prevDb || !current || prevDb === current || prevDb.orders === current.orders) return [];
    const oldMap = new Map();
    (prevDb.orders || []).forEach(o => { if (o && o.id) oldMap.set(o.id, o); });
    const touched = new Set();
    (current.orders || []).forEach(o => {
      if (!o || !o.id) return;
      const old = oldMap.get(o.id);
      if (old && old !== o && orderStateChanged(old, o)) touched.add(o.id);
    });
    if (touched.size === 0) return [];
    return generateOps(
      { orders: prevDb.orders },
      { orders: current.orders }
    ).filter(op => op.collection === 'orders' && op.op === 'update' && touched.has(op.id));
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Envoi des saisies de chantier ignoré', e);
    return [];
  }
}
