import test from 'node:test';
import assert from 'node:assert/strict';
import { detectQuoteItemLoss, appendSafetyNetEntries, restoreItemsIntoQuote, guardQuoteItems } from '../src/utils/quoteSafetyNet.js';
import { applyOps } from '../src/utils/patchEngine.js';
import { smartMerge } from '../src/utils/smartMerge.js';

const item = (id, label = id) => ({ id, label, qty: 1, unitPriceHT: 100 });
const quote = (id, items, extra = {}) => ({ id, number: id, clientId: 'CLI-1', status: 'Brouillon', items, ...extra });
const NOW = '2026-11-10T10:00:00.000Z';

test('aucune perte : rien à signaler', () => {
  const before = [quote('DEV-1', [item('A'), item('B')])];
  const after = [quote('DEV-1', [item('A'), item('B'), item('C')])];
  assert.deepEqual(detectQuoteItemLoss(before, after, { now: NOW }), []);
});

test('articles retirés par une version distante : copie conservée', () => {
  const before = [quote('DEV-1', [item('A'), item('B'), item('C')])];
  const after = [quote('DEV-1', [item('A')], { _modifiedBy: 'Fatima (dev-x)', _lastModified: NOW })];
  const res = detectQuoteItemLoss(before, after, { now: NOW, source: 'ops', clients: [{ id: 'CLI-1', name: 'Client Test' }] });
  assert.equal(res.length, 1);
  assert.deepEqual(res[0].lostItems.map(i => i.id), ['B', 'C']);
  assert.equal(res[0].itemsBefore, 3);
  assert.equal(res[0].itemsAfter, 1);
  assert.equal(res[0].clientName, 'Client Test');
  assert.equal(res[0].remoteModifiedBy, 'Fatima (dev-x)');
  assert.equal(res[0].source, 'ops');
});

test('article modifié (même id) : pas une perte', () => {
  const before = [quote('DEV-1', [item('A'), item('B')])];
  const after = [quote('DEV-1', [item('A'), { ...item('B'), qty: 5 }])];
  assert.deepEqual(detectQuoteItemLoss(before, after, { now: NOW }), []);
});

test('devis supprimé en entier, ignoré ou vide : hors périmètre', () => {
  const before = [quote('DEV-1', [item('A')]), quote('DEV-2', [item('B')]), quote('DEV-3', [])];
  const after = [quote('DEV-1', [], { _deleted: true }), quote('DEV-2', []), quote('DEV-3', [])];
  assert.deepEqual(detectQuoteItemLoss(before, after, { now: NOW, skipQuoteIds: ['DEV-2'] }), []);
});

test('entrées invalides : jamais d\'erreur', () => {
  assert.deepEqual(detectQuoteItemLoss(null, undefined), []);
  assert.deepEqual(detectQuoteItemLoss([null, {}, { id: 'X' }], [null]), []);
  assert.deepEqual(guardQuoteItems(null, null), []);
  assert.deepEqual(guardQuoteItems({ quotes: 5 }, { quotes: 'x' }), []);
});

test('journal : pas de doublon, plus récent en premier, taille limitée', () => {
  const e1 = detectQuoteItemLoss([quote('DEV-1', [item('A'), item('B')])], [quote('DEV-1', [item('A')])], { now: NOW })[0];
  const e2 = detectQuoteItemLoss([quote('DEV-2', [item('C')])], [quote('DEV-2', [])], { now: NOW })[0];
  let journal = appendSafetyNetEntries([], [e1]);
  journal = appendSafetyNetEntries(journal, [e1]);
  assert.equal(journal.length, 1);
  journal = appendSafetyNetEntries(journal, [e2]);
  assert.deepEqual(journal.map(e => e.quoteId), ['DEV-2', 'DEV-1']);
  // Une entrée déjà remise n'empêche pas d'enregistrer une nouvelle perte identique
  journal = appendSafetyNetEntries(journal.map(e => ({ ...e, restoredAt: NOW })), [e1]);
  assert.equal(journal.length, 3);
  assert.equal(appendSafetyNetEntries(journal, [e2], 2).length, 2);
});

test('remise des articles : ajoute seulement ceux qui manquent, sans modifier l\'original', () => {
  const q = quote('DEV-1', [item('A')]);
  const { quote: restored, addedCount } = restoreItemsIntoQuote(q, [item('A'), item('B'), item('C')]);
  assert.equal(addedCount, 2);
  assert.deepEqual(restored.items.map(i => i.id), ['A', 'B', 'C']);
  assert.equal(q.items.length, 1);
  assert.equal(restoreItemsIntoQuote(restored, [item('B')]).addedCount, 0);
});

// ─── Scénarios réels : reproduisent le défaut actuel et vérifient que le filet le voit ───

test('scénario 2 postes (ops temps réel) : le poste A voit ses articles écrasés et le filet les garde', () => {
  const dbA = { quotes: [quote('DEV-120', [item('A'), item('B'), item('C'), item('D')], { _lastModified: '2026-11-10T09:00:00.000Z' })], clients: [] };
  // Le poste B (ancienne version, 1 article) envoie une mise à jour plus récente
  const opFromB = { op: 'update', collection: 'quotes', id: 'DEV-120', timestamp: '2026-11-10T09:05:00.000Z', deviceId: 'dev-B',
    data: quote('DEV-120', [item('A')], { totals: { ht: 100 } }) };
  const { db: after } = applyOps(dbA, [opFromB]);
  assert.equal(after.quotes[0].items.length, 1, 'défaut actuel confirmé : la liste est remplacée en entier');
  const res = detectQuoteItemLoss(dbA.quotes, after.quotes, { now: NOW, source: 'ops' });
  assert.deepEqual(res[0].lostItems.map(i => i.id), ['B', 'C', 'D']);
  assert.equal(res[0].remoteModifiedBy, 'dev-B');
});

test('scénario rechargement Cloud (smartMerge) : même défaut, même protection', () => {
  const local = { quotes: [quote('DEV-7', [item('A'), item('B')], { _lastModified: '2026-11-10T09:00:00.000Z' })] };
  const cloud = { quotes: [quote('DEV-7', [item('A')], { _lastModified: '2026-11-10T09:30:00.000Z', _modifiedBy: 'dev-old' })] };
  const merged = smartMerge(local, cloud);
  const res = detectQuoteItemLoss(local.quotes, merged.quotes, { now: NOW, source: 'cloud' });
  assert.equal(res.length, 1);
  assert.deepEqual(res[0].lostItems.map(i => i.id), ['B']);
});

test('le filet ne modifie jamais les données comparées', () => {
  const before = { quotes: [quote('DEV-1', [item('A'), item('B')])] };
  const after = { quotes: [quote('DEV-1', [item('A')])] };
  const snapBefore = JSON.stringify(before), snapAfter = JSON.stringify(after);
  detectQuoteItemLoss(before.quotes, after.quotes, { now: NOW });
  assert.equal(JSON.stringify(before), snapBefore);
  assert.equal(JSON.stringify(after), snapAfter);
});
