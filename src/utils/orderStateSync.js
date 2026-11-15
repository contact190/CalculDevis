/**
 * orderStateSync — fusion des états de chantier d'une commande, repère par repère.
 *
 * Problème corrigé : les dictionnaires d'états d'une commande (étapes de pose, livraisons,
 * stock fini, statuts alu/vitrage) étaient envoyés en bloc, et le bloc le plus récent
 * remplaçait l'autre en entier. Conséquences :
 *  - deux poseurs qui validaient chacun un repère presque en même temps : une validation disparaissait ;
 *  - le bureau qui modifiait la commande (statut…) avant d'avoir reçu la saisie du poseur :
 *    la validation du poseur était effacée.
 *
 * Principe (même logique que sitePlanSync) :
 *  - chaque entrée modifiée localement (ex. étape « pose_alu » du repère void-123) reçoit une date
 *    dans order._stateTs[dict]["void-123::pose_alu"] (ms), posée par l'appareil qui l'a réellement modifiée ;
 *  - à la fusion, on compare clé par clé : la date la plus récente gagne ; une suppression
 *    datée l'emporte sur une valeur plus ancienne (pas de « résurrection ») ;
 *  - quand aucune date ne départage (données d'avant ce correctif), on applique exactement
 *    l'ancienne règle : la version la plus récente de la commande gagne.
 *
 * Fonctions pures, sans dépendance : testables hors navigateur.
 */

export const STATE_DICT_KEYS = ['installationSteps', 'finishedGoodsDelivery', 'finishedGoodsStock', 'unitStatusesDual'];
export const STATE_TS = '_stateTs';

const isPlainObject = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const has = (o, k) => isPlainObject(o) && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const tsOf = (stamps, dict, k) => {
  const v = isPlainObject(stamps) && isPlainObject(stamps[dict]) ? stamps[dict][k] : 0;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a).filter(k => a[k] !== undefined);
  const kb = Object.keys(b).filter(k => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!sameValue(a[k], b[k])) return false;
  return true;
}

/** Vrai si les dictionnaires d'états diffèrent entre deux versions d'une commande. */
export function orderStateChanged(oldOrder, newOrder) {
  if (!isPlainObject(newOrder)) return false;
  for (const dict of STATE_DICT_KEYS) {
    if (!has(newOrder, dict)) continue;
    const before = isPlainObject(oldOrder) ? oldOrder[dict] : undefined;
    if (!sameValue(before, newOrder[dict])) return true;
  }
  return false;
}

// Profondeur de fusion : étapes de pose par (repère, étape), statuts par (repère, alu/vitrage),
// livraisons et stock fini par repère.
const DEPTH = { installationSteps: 2, unitStatusesDual: 2, finishedGoodsDelivery: 1, finishedGoodsStock: 1 };
const SEP = '::';

/** Aplatit un dictionnaire en feuilles { chemin → valeur } ; chemin = "repère" ou "repère::étape". */
function leaves(dict, depth) {
  const out = new Map();
  if (!isPlainObject(dict)) return out;
  for (const k1 of Object.keys(dict)) {
    const v = dict[k1];
    if (v === undefined) continue;
    if (depth === 2 && isPlainObject(v)) {
      for (const k2 of Object.keys(v)) if (v[k2] !== undefined) out.set(k1 + SEP + k2, v[k2]);
    } else {
      out.set(k1, v);
    }
  }
  return out;
}

/**
 * Date les entrées d'états réellement modifiées par cet appareil (ancien → nouveau).
 * Renvoie le même objet si rien n'est à dater.
 */
export function stampOrderForSync(oldOrder, newOrder, now) {
  if (!isPlainObject(newOrder)) return newOrder;
  const nowMs = typeof now === 'number' && Number.isFinite(now) ? now : (Date.parse(now) || Date.now());
  const oldStamps = isPlainObject(oldOrder) ? oldOrder[STATE_TS] : undefined;
  const newStamps = newOrder[STATE_TS];
  let out = null;

  for (const dict of STATE_DICT_KEYS) {
    if (!has(newOrder, dict) || !isPlainObject(newOrder[dict])) continue;
    const before = leaves(isPlainObject(oldOrder) ? oldOrder[dict] : undefined, DEPTH[dict]);
    const after = leaves(newOrder[dict], DEPTH[dict]);
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const k of keys) {
      const changed = before.has(k) !== after.has(k) || !sameValue(before.get(k), after.get(k));
      if (!changed) continue;
      // Déjà datée depuis l'ancienne version (ex. second passage) : on garde cette date
      if (tsOf(newStamps, dict, k) !== tsOf(oldStamps, dict, k)) continue;
      if (!out) out = isPlainObject(newStamps) ? { ...newStamps } : {};
      out[dict] = { ...(out[dict] || {}), [k]: Math.max(nowMs, tsOf(oldStamps, dict, k) + 1) };
    }
  }
  return out ? { ...newOrder, [STATE_TS]: out } : newOrder;
}

/**
 * Fusionne les dictionnaires d'états de deux versions d'une même commande.
 * @param {Object} a   version existante
 * @param {Object} b   version entrante
 * @param {boolean} bNewer  la version entrante est la plus récente (ancienne règle, pour départager)
 * @returns {Object} champs à poser sur la commande fusionnée (dictionnaires + _stateTs)
 */
export function mergeOrderState(a, b, bNewer) {
  const res = {};
  const sa = isPlainObject(a) ? a[STATE_TS] : undefined;
  const sb = isPlainObject(b) ? b[STATE_TS] : undefined;

  for (const dict of STATE_DICT_KEYS) {
    const inA = has(a, dict), inB = has(b, dict);
    if (!inA && !inB) continue;
    if (!inB) { res[dict] = a[dict]; continue; }   // ancienne règle : clé absente côté entrant → on garde
    if (!inA) { res[dict] = b[dict]; continue; }
    const da = a[dict], db = b[dict];
    if (!isPlainObject(da) || !isPlainObject(db)) { res[dict] = bNewer ? db : da; continue; }

    const depth = DEPTH[dict];
    const la = leaves(da, depth), lb = leaves(db, depth);
    const out = {};
    for (const k of new Set([...la.keys(), ...lb.keys()])) {
      const ta = tsOf(sa, dict, k), tb = tsOf(sb, dict, k);
      const takeB = ta === tb ? bNewer : tb > ta;
      const src = takeB ? lb : la;
      if (!src.has(k)) continue;
      const i = k.indexOf(SEP);
      if (depth === 2 && i >= 0) {
        const k1 = k.slice(0, i), k2 = k.slice(i + SEP.length);
        if (!isPlainObject(out[k1])) out[k1] = {};
        out[k1][k2] = src.get(k);
      } else {
        out[k] = src.get(k);
      }
    }
    // Repères présents mais vides (ex. {}) : on les garde selon l'ancienne règle
    if (depth === 2) {
      const winner = bNewer ? db : da;
      for (const k1 of new Set([...Object.keys(da), ...Object.keys(db)])) {
        if (out[k1] !== undefined) continue;
        const v = has(winner, k1) ? winner[k1] : undefined;
        if (isPlainObject(v) && Object.keys(v).length === 0) out[k1] = {};
      }
    }
    res[dict] = sameValue(out, db) ? db : (sameValue(out, da) ? da : out);
  }

  // Dates : la plus récente par clé
  if (isPlainObject(sa) || isPlainObject(sb)) {
    const stamps = {};
    for (const dict of STATE_DICT_KEYS) {
      const ka = isPlainObject(sa) && isPlainObject(sa[dict]) ? Object.keys(sa[dict]) : [];
      const kb = isPlainObject(sb) && isPlainObject(sb[dict]) ? Object.keys(sb[dict]) : [];
      if (ka.length === 0 && kb.length === 0) continue;
      const d = {};
      for (const k of new Set([...ka, ...kb])) d[k] = Math.max(tsOf(sa, dict, k), tsOf(sb, dict, k));
      stamps[dict] = d;
    }
    res[STATE_TS] = stamps;
  }
  return res;
}

// ─── Versions « ceinture et bretelles » : en cas d'erreur, ancien comportement ───

export function safeStampOrderForSync(oldOrder, newOrder, now) {
  try {
    return stampOrderForSync(oldOrder, newOrder, now);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Datage des états de chantier ignoré', e);
    return newOrder;
  }
}

/** Applique la fusion sur mergedItem ; en cas d'erreur → ancienne règle (bloc le plus récent). */
export function applyOrderStateMerge(mergedItem, existing, incoming, bNewer) {
  try {
    Object.assign(mergedItem, mergeOrderState(existing, incoming, bNewer));
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Fusion des états de chantier : ancienne règle', e);
    for (const dict of STATE_DICT_KEYS) {
      if (has(incoming, dict) && bNewer) mergedItem[dict] = incoming[dict];
    }
  }
  return mergedItem;
}

/** Clés gérées par applyOrderStateMerge (à ignorer dans la fusion générique). */
export function isOrderStateKey(key) {
  return key === STATE_TS || STATE_DICT_KEYS.includes(key);
}
