/**
 * Fusion d'une partition locale avec la même partition de l'instantané Cloud.
 * Règle historique : pour un même id, la version la plus récente (_lastModified) gagne d'un bloc.
 * Exception : les plans de chantier d'un client sont fusionnés ouverture par ouverture,
 * pour qu'un instantané envoyé par un appareil en retard n'efface pas des saisies récentes.
 */
import { mergeClientSnapshot } from './sitePlanSync.js';

export function mergeSnapshotItems(arrA, arrB) {
  const map = new Map();
  if (Array.isArray(arrA)) {
    arrA.forEach(item => { if (item && item.id) map.set(item.id, item); });
  }
  if (Array.isArray(arrB)) {
    arrB.forEach(item => {
      if (!item || !item.id) return;
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const existingTime = existing._lastModified ? new Date(existing._lastModified).getTime() : 0;
        const incomingTime = item._lastModified ? new Date(item._lastModified).getTime() : 0;
        const incomingNewer = incomingTime >= existingTime;

        if (Array.isArray(existing.sitePlans) && Array.isArray(item.sitePlans)) {
          let merged;
          try {
            merged = mergeClientSnapshot(existing, item, incomingNewer);
          } catch (e) {
            console.warn('Fusion des plans (instantané) : retour à l\'ancienne règle', e);
            merged = incomingNewer ? item : existing;
          }
          map.set(item.id, merged);
        } else if (incomingNewer) {
          map.set(item.id, item);
        }
      }
    });
  }
  return Array.from(map.values());
}
