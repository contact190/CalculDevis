/**
 * Filet de sécurité des articles de devis
 *
 * Quand une version d'un devis venue d'un autre poste (ou du Cloud) remplace
 * la version locale et contient MOINS d'articles, on garde une copie des
 * articles retirés dans un journal local (IndexedDB). Rien n'est bloqué ni
 * modifié dans la synchronisation : c'est uniquement un enregistrement qui
 * permet de voir ce qui a disparu, depuis quel poste, et de le remettre.
 */
import { persistentStorage } from './storage.js';

export const SAFETY_NET_KEY = 'calculDevis_quoteSafetyNet';
export const SAFETY_NET_MAX_ENTRIES = 100;

const itemIdsOf = (quote) => {
  const ids = new Set();
  const items = quote && Array.isArray(quote.items) ? quote.items : [];
  for (const item of items) {
    if (item && item.id) ids.add(item.id);
  }
  return ids;
};

/**
 * Compare les devis avant/après et renvoie une entrée par devis ayant perdu
 * au moins un article. Fonction pure (aucun effet de bord).
 *
 * @param {Array} beforeQuotes - devis avant application des données distantes
 * @param {Array} afterQuotes  - devis après application
 * @param {Object} [options]
 * @param {string} [options.source]   - origine du remplacement (libellé libre)
 * @param {Array}  [options.clients]  - pour retrouver le nom du client
 * @param {Array<string>} [options.skipQuoteIds] - devis à ignorer
 * @param {string} [options.now]      - date ISO (injectable pour les tests)
 */
export function detectQuoteItemLoss(beforeQuotes, afterQuotes, options = {}) {
  if (!Array.isArray(beforeQuotes) || !Array.isArray(afterQuotes)) return [];
  const { source = 'inconnu', clients = [], skipQuoteIds = [], now = new Date().toISOString() } = options;
  const skip = new Set(skipQuoteIds || []);

  const afterById = new Map();
  for (const q of afterQuotes) {
    if (q && q.id) afterById.set(q.id, q);
  }

  const entries = [];
  for (const before of beforeQuotes) {
    if (!before || !before.id || before._deleted || skip.has(before.id)) continue;
    if (!Array.isArray(before.items) || before.items.length === 0) continue;

    const after = afterById.get(before.id);
    // Devis absent ou supprimé en entier : hors périmètre de ce filet (articles uniquement)
    if (!after || after._deleted) continue;
    if (after === before || after.items === before.items) continue;

    const afterIds = itemIdsOf(after);
    const lostItems = before.items.filter(item => item && item.id && !afterIds.has(item.id));
    if (lostItems.length === 0) continue;

    const client = (clients || []).find(c => c && c.id === before.clientId);
    entries.push({
      id: `SN-${Date.parse(now) || Date.now()}-${before.id}`,
      at: now,
      source,
      quoteId: before.id,
      quoteNumber: before.number || before.id,
      clientId: before.clientId || null,
      clientName: (client && client.name) || before.clientName || '',
      itemsBefore: before.items.length,
      itemsAfter: Array.isArray(after.items) ? after.items.length : 0,
      lostItems,
      remoteModifiedBy: after._modifiedBy || null,
      remoteModifiedAt: after._lastModified || null,
      restoredAt: null
    });
  }
  return entries;
}

const sameLoss = (a, b) => {
  if (!a || !b || a.quoteId !== b.quoteId) return false;
  const idsA = (a.lostItems || []).map(i => i.id).sort().join('|');
  const idsB = (b.lostItems || []).map(i => i.id).sort().join('|');
  return idsA === idsB;
};

/**
 * Ajoute de nouvelles entrées au journal (les plus récentes en premier),
 * sans doublon immédiat et avec une taille maximale. Fonction pure.
 */
export function appendSafetyNetEntries(existing, newEntries, max = SAFETY_NET_MAX_ENTRIES) {
  const journal = Array.isArray(existing) ? [...existing] : [];
  for (const entry of newEntries || []) {
    // Doublon : même devis + mêmes articles, pas encore remis
    const duplicate = journal.some(e => !e.restoredAt && sameLoss(e, entry));
    if (!duplicate) journal.unshift(entry);
  }
  return journal.slice(0, max);
}

/**
 * Remet dans un devis les articles d'une entrée qui n'y sont plus.
 * Fonction pure : renvoie { quote, addedCount } sans modifier l'original.
 */
export function restoreItemsIntoQuote(quote, lostItems) {
  if (!quote) return { quote, addedCount: 0 };
  const present = itemIdsOf(quote);
  const toAdd = (lostItems || []).filter(item => item && item.id && !present.has(item.id));
  if (toAdd.length === 0) return { quote, addedCount: 0 };
  return {
    quote: { ...quote, items: [...(Array.isArray(quote.items) ? quote.items : []), ...toAdd] },
    addedCount: toAdd.length
  };
}

// ─── Stockage (IndexedDB) ─────────────────────────────────────────────────
// Les écritures sont mises en file pour éviter que deux enregistrements
// simultanés ne s'écrasent.
let writeQueue = Promise.resolve();

export async function loadSafetyNet() {
  try {
    const data = await persistentStorage.load(SAFETY_NET_KEY);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export function recordSafetyNetEntries(newEntries) {
  if (!Array.isArray(newEntries) || newEntries.length === 0) return writeQueue;
  writeQueue = writeQueue.then(async () => {
    try {
      const journal = await loadSafetyNet();
      const next = appendSafetyNetEntries(journal, newEntries);
      await persistentStorage.save(SAFETY_NET_KEY, next);
      console.warn(`🛟 Filet de sécurité : ${newEntries.length} devis ont perdu des articles (copie conservée).`,
        newEntries.map(e => `${e.quoteNumber}: -${e.lostItems.length} article(s), source=${e.source}, par=${e.remoteModifiedBy || '?'}`));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:quote-safety-net', { detail: { count: next.length } }));
      }
    } catch (e) {
      console.warn('Filet de sécurité : enregistrement impossible', e);
    }
  });
  return writeQueue;
}

export function markSafetyNetEntryRestored(entryId) {
  writeQueue = writeQueue.then(async () => {
    try {
      const journal = await loadSafetyNet();
      const next = journal.map(e => e.id === entryId ? { ...e, restoredAt: new Date().toISOString() } : e);
      await persistentStorage.save(SAFETY_NET_KEY, next);
    } catch (e) {
      console.warn('Filet de sécurité : mise à jour impossible', e);
    }
  });
  return writeQueue;
}

/**
 * Point d'entrée unique utilisé par l'application : compare et enregistre.
 * Ne lève jamais d'erreur (ne doit en aucun cas gêner la synchronisation).
 */
export function guardQuoteItems(beforeDb, afterDb, options = {}) {
  try {
    if (!beforeDb || !afterDb || beforeDb === afterDb) return [];
    if (beforeDb.quotes === afterDb.quotes) return [];
    const entries = detectQuoteItemLoss(beforeDb.quotes, afterDb.quotes, {
      ...options,
      clients: afterDb.clients || beforeDb.clients || []
    });
    if (entries.length > 0) recordSafetyNetEntries(entries);
    return entries;
  } catch (e) {
    console.warn('Filet de sécurité : comparaison impossible', e);
    return [];
  }
}

/**
 * Renvoie une copie légère de la base où le devis ouvert à l'écran remplace
 * sa version en base (l'écran peut contenir des articles pas encore enregistrés).
 * Fonction pure.
 */
export function withActiveQuote(db, activeQuote) {
  if (!db || !activeQuote || !activeQuote.id || !Array.isArray(db.quotes)) return db;
  if (!db.quotes.some(q => q && q.id === activeQuote.id)) return db;
  return { ...db, quotes: db.quotes.map(q => (q && q.id === activeQuote.id) ? activeQuote : q) };
}
