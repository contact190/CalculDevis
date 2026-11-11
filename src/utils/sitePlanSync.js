/**
 * sitePlanSync — fusion des plans de chantier ouverture par ouverture.
 *
 * Problème corrigé : chaque appareil envoie le dossier client COMPLET (tous ses plans).
 * Avant, le dernier envoi remplaçait tous les plans d'un bloc : un appareil avec une
 * vieille copie effaçait donc les cotes / validations / lancements saisis ailleurs.
 *
 * Principe :
 *  - chaque nœud (plan, étage, appartement, ouverture) porte une date `_syncTs`
 *    (ms) posée par l'appareil qui l'a réellement modifié ;
 *  - à la fusion, on compare nœud par nœud : la date la plus récente gagne ;
 *  - une suppression laisse une trace (`_syncDel` sur le parent, `_syncDelPlans`
 *    sur le client) pour qu'une vieille copie ne fasse pas réapparaître l'élément ;
 *  - quand aucune date ne départage (données d'avant ce correctif), on applique
 *    exactement l'ancienne règle : la version la plus récente du dossier gagne.
 *
 * Fonctions pures, sans dépendance : testables hors navigateur.
 */

export const SYNC_TS = '_syncTs';
export const SYNC_DEL = '_syncDel';
export const SYNC_DEL_PLANS = '_syncDelPlans';

// plan → floors → apartments → voids (feuille)
const CHILD_KEYS = ['floors', 'apartments', 'voids'];

const toMs = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; }
  return 0;
};

const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

/** Égalité profonde, insensible à l'ordre des clés ; une clé `undefined` vaut clé absente. */
function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null ? a === b : false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const arrA = Array.isArray(a), arrB = Array.isArray(b);
  if (arrA !== arrB) return false;
  if (arrA) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  const keysA = Object.keys(a).filter(k => a[k] !== undefined);
  const keysB = Object.keys(b).filter(k => b[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (b[k] === undefined) return false;
    if (!sameValue(a[k], b[k])) return false;
  }
  return true;
}

/** Compare les champs propres d'un nœud (hors enfants et hors métadonnées de synchro). */
function sameOwnFields(a, b, childKey) {
  const skip = (k) => k === SYNC_TS || k === SYNC_DEL || k === childKey;
  const keysA = Object.keys(a).filter(k => !skip(k) && a[k] !== undefined);
  const keysB = Object.keys(b).filter(k => !skip(k) && b[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (b[k] === undefined) return false;
    if (!sameValue(a[k], b[k])) return false;
  }
  return true;
}

/** Une liste est fusionnable par id si chaque élément est un objet avec un id unique. */
function isMergeableList(arr) {
  if (!Array.isArray(arr)) return false;
  const seen = new Set();
  for (const el of arr) {
    if (!isPlainObject(el)) return false;
    const id = el.id;
    if (!(typeof id === 'string' && id !== '') && typeof id !== 'number') return false;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** Ordre stable entre deux ids : date de création contenue dans l'id (void-<ms>-<aléa>), sinon ordre alphabétique. */
function compareIds(a, b) {
  const sa = String(a), sb = String(b);
  const ma = /\d{10,}/.exec(sa), mb = /\d{10,}/.exec(sb);
  if (ma && mb) {
    const na = Number(ma[0]), nb = Number(mb[0]);
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return sa < sb ? -1 : (sa > sb ? 1 : 0);
}

function tombIsEmpty(t) {
  return !isPlainObject(t) || Object.keys(t).length === 0;
}

function sameTomb(a, b) {
  const ea = tombIsEmpty(a), eb = tombIsEmpty(b);
  if (ea || eb) return ea && eb;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (toMs(a[k]) !== toMs(b[k])) return false;
  return true;
}

/** Union de deux registres de suppressions (date la plus récente par id). */
export function mergeTombstones(a, b) {
  const ea = tombIsEmpty(a), eb = tombIsEmpty(b);
  if (ea && eb) return undefined;
  if (ea) return b;
  if (eb) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (toMs(b[k]) > toMs(out[k])) out[k] = b[k];
  }
  if (sameTomb(out, b)) return b;
  if (sameTomb(out, a)) return a;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUSION
// ─────────────────────────────────────────────────────────────────────────────

function mergeNode(a, b, bNewer, depth) {
  if (a === b) return a; // même objet des deux côtés (datage local) : rien à fusionner
  const sa = toMs(a[SYNC_TS]), sb = toMs(b[SYNC_TS]);
  // Date la plus récente du nœud ; à égalité (ou sans date) → ancienne règle (dossier le plus récent)
  const bWins = sb > sa ? true : (sb < sa ? false : bNewer);
  const w = bWins ? b : a;

  const childKey = CHILD_KEYS[depth];
  if (!childKey) return w; // ouverture : bloc indivisible

  const tomb = mergeTombstones(a[SYNC_DEL], b[SYNC_DEL]);
  const ca = a[childKey], cb = b[childKey];
  const children = (Array.isArray(ca) && Array.isArray(cb))
    ? mergeList(ca, cb, bNewer, tomb, depth + 1)
    : (bNewer ? cb : ca);

  if (children === w[childKey] && sameTomb(tomb, w[SYNC_DEL])) return w;

  const res = { ...w };
  if (children !== undefined) res[childKey] = children; else delete res[childKey];
  if (!tombIsEmpty(tomb)) res[SYNC_DEL] = tomb;
  return res;
}

function mergeList(arrA, arrB, bNewer, tomb, depth) {
  // Liste non identifiable (id manquant / en double) → ancienne règle, d'un bloc
  if (!isMergeableList(arrA) || !isMergeableList(arrB)) return bNewer ? arrB : arrA;

  const mapA = new Map(arrA.map(x => [x.id, x]));
  const mapB = new Map(arrB.map(x => [x.id, x]));

  // Ordre : celui de la version la plus récente ; les éléments connus seulement de
  // l'autre côté sont insérés juste après leur voisin précédent.
  const back = bNewer ? arrB : arrA;
  const other = bNewer ? arrA : arrB;
  // Deux appareils ont ajouté chacun un élément au même endroit : ordre de création (lu dans l'id),
  // pour que tous les appareils obtiennent le même ordre quel que soit l'ordre d'arrivée.
  const order = back.map(x => x.id);
  const inBack = new Set(order);
  const inOther = new Set(other.map(x => x.id));
  let anchor = -1;
  for (const x of other) {
    if (inBack.has(x.id)) {
      anchor = order.indexOf(x.id);
    } else {
      let pos = anchor + 1;
      while (pos < order.length && !inOther.has(order[pos]) && compareIds(order[pos], x.id) < 0) pos++;
      order.splice(pos, 0, x.id);
      anchor = pos;
    }
  }

  const out = [];
  for (const id of order) {
    const a = mapA.get(id), b = mapB.get(id);
    let node;
    if (a && b) {
      node = mergeNode(a, b, bNewer, depth);
    } else {
      node = a || b;
      const fromNewerSide = a ? !bNewer : bNewer;
      // Élément sans date connu seulement du côté le plus ancien → ancienne règle : il disparaît
      if (!toMs(node[SYNC_TS]) && !fromNewerSide) continue;
    }
    // Supprimé (trace de suppression plus récente que sa dernière modification)
    const delTs = tomb ? toMs(tomb[id]) : 0;
    if (delTs && delTs >= toMs(node[SYNC_TS])) continue;
    out.push(node);
  }

  const identical = (ref) => ref.length === out.length && ref.every((x, i) => x === out[i]);
  if (identical(arrB)) return arrB;
  if (identical(arrA)) return arrA;
  return out;
}

/**
 * Fusionne deux listes de plans de chantier.
 * @param {Array} plansA  version locale (existante)
 * @param {Array} plansB  version reçue
 * @param {boolean} bNewer  true si le dossier reçu est le plus récent (ancienne règle de départage)
 * @param {Object} [tombA]  suppressions de plans connues côté local
 * @param {Object} [tombB]  suppressions de plans connues côté reçu
 * @returns {{ plans: Array, tombstones: Object|undefined }}
 */
export function mergeSitePlans(plansA, plansB, bNewer, tombA, tombB) {
  const tombstones = mergeTombstones(tombA, tombB);
  if (!Array.isArray(plansA) || !Array.isArray(plansB)) {
    return { plans: bNewer ? plansB : plansA, tombstones };
  }
  return { plans: mergeList(plansA, plansB, bNewer, tombstones, 0), tombstones };
}

/**
 * Fusion « d'un bloc » de deux versions d'un même client (instantanés Cloud) :
 * la version la plus récente gagne, sauf les plans qui sont fusionnés ouverture par ouverture.
 */
export function mergeClientSnapshot(existing, incoming, incomingNewer) {
  const winner = incomingNewer ? incoming : existing;
  if (!isPlainObject(existing) || !isPlainObject(incoming)) return winner;
  if (!Array.isArray(existing.sitePlans) || !Array.isArray(incoming.sitePlans)) return winner;

  const { plans, tombstones } = mergeSitePlans(
    existing.sitePlans, incoming.sitePlans, incomingNewer,
    existing[SYNC_DEL_PLANS], incoming[SYNC_DEL_PLANS]
  );
  if (plans === winner.sitePlans && sameTomb(tombstones, winner[SYNC_DEL_PLANS])) return winner;
  const res = { ...winner, sitePlans: plans };
  if (!tombIsEmpty(tombstones)) res[SYNC_DEL_PLANS] = tombstones;
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATAGE (au moment où l'appareil détecte ses propres modifications)
// ─────────────────────────────────────────────────────────────────────────────

function stampNode(old, node, now, depth) {
  if (old === node) return node;
  const childKey = CHILD_KEYS[depth];

  let stamp;
  if (!old) {
    // Nouveau nœud : on garde sa date s'il en a déjà une (copie, fusion), sinon maintenant
    stamp = toMs(node[SYNC_TS]) ? node[SYNC_TS] : now;
  } else {
    const so = toMs(old[SYNC_TS]), sn = toMs(node[SYNC_TS]);
    if (sn > so) stamp = node[SYNC_TS];                         // déjà daté plus récemment (fusion reçue)
    // modification locale : toujours plus récente que la version qu'elle remplace, même si
    // l'horloge de l'appareil est en retard (cas réel : des postes ont 1 h 30 à 30 h de retard)
    else if (!sameOwnFields(old, node, childKey)) stamp = Math.max(now, so + 1);
    else stamp = old[SYNC_TS];                                  // inchangé (on conserve / restaure la date)
  }

  let children = childKey ? node[childKey] : undefined;
  let tomb = childKey ? node[SYNC_DEL] : undefined;
  if (childKey) {
    const r = stampList(old ? old[childKey] : undefined, node[childKey], now, depth + 1,
      old ? old[SYNC_DEL] : undefined, node[SYNC_DEL]);
    children = r.list;
    tomb = r.tomb;
  }

  const stampSame = toMs(stamp) === toMs(node[SYNC_TS]);
  const childrenSame = !childKey || children === node[childKey];
  const tombSame = !childKey || sameTomb(tomb, node[SYNC_DEL]);
  if (stampSame && childrenSame && tombSame) return node;

  const res = { ...node };
  if (toMs(stamp)) res[SYNC_TS] = stamp;
  if (childKey) {
    if (children !== undefined) res[childKey] = children;
    if (!tombIsEmpty(tomb)) res[SYNC_DEL] = tomb;
  }
  return res;
}

function stampList(oldArr, newArr, now, depth, oldTomb, newTomb) {
  let tomb = mergeTombstones(oldTomb, newTomb); // un registre de suppressions ne se perd jamais
  if (!isMergeableList(newArr)) return { list: newArr, tomb };
  if (oldArr !== undefined && oldArr !== null && !isMergeableList(oldArr)) return { list: newArr, tomb };

  const oldList = Array.isArray(oldArr) ? oldArr : [];
  if (oldList === newArr) return { list: newArr, tomb };

  const oldMap = new Map(oldList.map(x => [x.id, x]));
  const newIds = new Set(newArr.map(x => x.id));

  // Éléments retirés localement → trace de suppression
  for (const o of oldList) {
    if (newIds.has(o.id)) continue;
    const known = tomb && Object.prototype.hasOwnProperty.call(tomb, o.id) ? toMs(tomb[o.id]) : -1;
    if (known >= 0 && known >= toMs(o[SYNC_TS])) continue; // déjà tracée (suppression reçue d'ailleurs)
    // la suppression est toujours plus récente que la version supprimée (horloge en retard comprise)
    tomb = { ...(tomb || {}), [o.id]: Math.max(now, toMs(o[SYNC_TS]) + 1) };
  }

  let changed = false;
  const list = newArr.map(n => {
    const old = oldMap.get(n.id);
    let s = stampNode(old, n, now, depth);
    // élément (ré)ajouté localement alors qu'une suppression est connue : il doit lui survivre
    if (!old && tomb && Object.prototype.hasOwnProperty.call(tomb, n.id) && toMs(tomb[n.id]) >= toMs(s[SYNC_TS])) {
      s = { ...s, [SYNC_TS]: toMs(tomb[n.id]) + 1 };
    }
    if (s !== n) changed = true;
    return s;
  });
  return { list: changed ? list : newArr, tomb };
}

/**
 * Date les nœuds de plans qu'un client a modifiés localement (comparaison ancien → nouveau)
 * et enregistre les suppressions. Renvoie le même objet si rien n'est à dater.
 */
export function stampClientForSync(oldClient, newClient, now) {
  if (!isPlainObject(newClient) || !Array.isArray(newClient.sitePlans)) return newClient;
  const oldOk = isPlainObject(oldClient);
  const nowMs = toMs(now) || Date.now();

  const { list, tomb } = stampList(
    oldOk ? oldClient.sitePlans : undefined, newClient.sitePlans, nowMs, 0,
    oldOk ? oldClient[SYNC_DEL_PLANS] : undefined, newClient[SYNC_DEL_PLANS]
  );
  if (list === newClient.sitePlans && sameTomb(tomb, newClient[SYNC_DEL_PLANS])) return newClient;
  const res = { ...newClient, sitePlans: list };
  if (!tombIsEmpty(tomb)) res[SYNC_DEL_PLANS] = tomb;
  return res;
}

/**
 * Même datage, pour toute la base (utilisé quand une modification locale ne passe pas
 * par la génération d'opérations). Renvoie la même base si rien n'est à dater.
 */
export function stampDbForSync(oldDb, newDb, now) {
  if (!oldDb || !newDb) return newDb;
  const oldClients = oldDb.clients, newClients = newDb.clients;
  if (oldClients === newClients || !Array.isArray(newClients)) return newDb;
  const oldMap = new Map();
  if (Array.isArray(oldClients)) oldClients.forEach(c => { if (c && c.id) oldMap.set(c.id, c); });

  let changed = false;
  const clients = newClients.map(c => {
    if (!c || !c.id) return c;
    const old = oldMap.get(c.id);
    if (old === c) return c;
    const s = stampClientForSync(old, c, now);
    if (s !== c) changed = true;
    return s;
  });
  return changed ? { ...newDb, clients } : newDb;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERSIONS « CEINTURE ET BRETELLES » utilisées par le moteur de synchro :
// en cas d'erreur inattendue, on retombe exactement sur l'ancien comportement.
// ─────────────────────────────────────────────────────────────────────────────

/** Fusion des plans ; en cas d'erreur → ancienne règle (la version la plus récente d'un bloc). */
export function safeMergeSitePlans(plansA, plansB, bNewer, tombA, tombB) {
  try {
    return mergeSitePlans(plansA, plansB, bNewer, tombA, tombB).plans;
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Fusion des plans : retour à l\'ancienne règle', e);
    return bNewer ? plansB : plansA;
  }
}

/** Union des registres de suppressions ; ne renvoie jamais undefined si l'un des deux existe. */
export function safeMergeTombstones(a, b) {
  try {
    return mergeTombstones(a, b) || a || b;
  } catch (e) {
    return a || b;
  }
}

/** Datage d'un client ; en cas d'erreur → client inchangé (ancien comportement). */
export function safeStampClientForSync(oldClient, newClient, now) {
  try {
    return stampClientForSync(oldClient, newClient, now);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Datage des plans ignoré', e);
    return newClient;
  }
}
