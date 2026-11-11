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
      return { base: stampDbForSync(prevDb, current, getSynchronizedDate().getTime()), pendingOps: [] };
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
