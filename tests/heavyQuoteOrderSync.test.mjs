// Grosse commande / gros devis (> 500 Ko, ex. 6 articles avec volets) :
// avant, la commande partait SANS ses articles (CMD-15112 vide) et le devis n'était pas envoyé du tout.
// Désormais l'opération part en entier, marquée « lourde », et les autres postes la relisent dans la base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOps, applyOps } from '../src/utils/patchEngine.js';
import { supabase, cloudSync, HEAVY_OP_PREFIX, unwrapHeavyCollection } from '../src/utils/supabaseClient.js';

const heavyItems = () => Array.from({ length: 6 }, (_, i) => ({
  id: `ITEM-${i}`, label: `Produit ${i + 1}`, qty: 1, unitPriceHT: 1000 + i,
  priceData: { priceHT: 1000 + i, bom: { profiles: [{ ref: 'x'.repeat(100000) }] } }
}));

function captureInserts() {
  const inserted = [];
  const realFrom = supabase.from;
  supabase.from = () => ({ insert: async (rows) => { inserted.push(...rows); return { error: null }; } });
  return { inserted, restore: () => { supabase.from = realFrom; } };
}

test('nouvelle commande lourde : envoyée avec TOUS ses articles (plus de commande vide)', async () => {
  const before = { orders: [] };
  const after = { orders: [{ id: 'CMD-900', number: 'CMD-900', status: 'Confirmé', quoteId: 'Q1', items: heavyItems(), batches: [] }] };
  const ops = generateOps(before, after);
  assert.equal(ops[0].op, 'add');
  assert.ok(JSON.stringify(ops[0].data).length > 500000);

  const cap = captureInserts();
  let res;
  try { res = await cloudSync.pushOps(ops); } finally { cap.restore(); }
  assert.equal(res.success, true);
  const rows = cap.inserted.filter(r => r.doc_id === 'CMD-900');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].collection, HEAVY_OP_PREFIX + 'orders');
  assert.equal(rows[0].data.items.length, 6, 'les 6 articles sont dans l\'envoi');
  assert.ok(rows[0].data.items[0].priceData, 'le détail de chiffrage est conservé');
  assert.equal(cap.inserted.some(r => r.doc_id === 'force_refresh'), false);
});

test('devis lourd passé en Confirmé : la modification est envoyée (avant : perdue)', async () => {
  const quote = { id: 'Q1', number: 'DEV-1', status: 'Brouillon', items: heavyItems(), _lastModified: '2026-11-18T08:00:00.000Z' };
  const before = { quotes: [quote] };
  const after = { quotes: [{ ...quote, status: 'Confirmé' }] };
  const ops = generateOps(before, after);
  const cap = captureInserts();
  try { await cloudSync.pushOps(ops); } finally { cap.restore(); }
  const row = cap.inserted.find(r => r.doc_id === 'Q1');
  assert.ok(row, 'le devis est envoyé');
  assert.equal(row.collection, HEAVY_OP_PREFIX + 'quotes');
  assert.equal(row.data.status, 'Confirmé');
});

test('relecture (10 s / démarrage) : l\'opération lourde redevient une opération normale et crée la commande complète', async () => {
  const items = heavyItems();
  const rows = [{ op: 'add', collection: HEAVY_OP_PREFIX + 'orders', doc_id: 'CMD-900', data: { id: 'CMD-900', items, batches: [] }, timestamp: '2026-11-18T09:00:00.000Z', device_id: 'autre-poste' }];
  const realFrom = supabase.from;
  const chain = { select: () => chain, gt: () => chain, neq: () => chain, order: () => chain, limit: () => chain, abortSignal: async () => ({ data: rows, error: null }) };
  supabase.from = () => chain;
  let ops;
  try { ops = await cloudSync.fetchOpsSince('2026-11-18T08:00:00.000Z', 'ce-poste'); } finally { supabase.from = realFrom; }
  assert.equal(ops[0].collection, 'orders');
  const db = applyOps({ orders: [] }, ops).db;
  assert.equal(db.orders[0].items.length, 6);
});

test('temps réel : données absentes du message → relues dans la base avant application', async () => {
  const items = heavyItems();
  const realChannel = supabase.channel;
  const realFrom = supabase.from;
  const realRemove = supabase.removeChannel;
  let handler;
  const ch = { on: (_t, _f, cb) => { handler = cb; return ch; }, subscribe: () => ch };
  supabase.channel = () => ch;
  supabase.removeChannel = () => {};
  let askedId;
  const q = { select: () => q, eq: (_c, v) => { askedId = v; return q; }, single: async () => ({ data: { data: { id: 'CMD-900', items } }, error: null }) };
  supabase.from = () => q;
  const received = [];
  try {
    const stop = cloudSync.subscribe(ops => received.push(...ops), 'ce-poste');
    // Message tronqué par Supabase : plus de champ "data"
    handler({ new: { id: 'uuid-1', op: 'add', collection: HEAVY_OP_PREFIX + 'orders', doc_id: 'CMD-900', timestamp: '2026-11-18T09:00:00.000Z', device_id: 'autre-poste' } });
    await new Promise(r => setTimeout(r, 10));
    stop();
  } finally { supabase.channel = realChannel; supabase.from = realFrom; supabase.removeChannel = realRemove; }
  assert.equal(askedId, 'uuid-1');
  assert.equal(received.length, 1);
  assert.equal(received[0].collection, 'orders');
  assert.equal(received[0].data.items.length, 6);
});

test('ancienne version du logiciel : une opération lourde est ignorée sans rien casser', () => {
  const db = { orders: [{ id: 'CMD-1', items: [{ id: 'A' }] }] };
  const res = applyOps(db, [{ op: 'add', collection: HEAVY_OP_PREFIX + 'orders', id: 'CMD-900', data: undefined, timestamp: '2026-11-18T09:00:00.000Z', deviceId: 'x' }]);
  assert.deepEqual(res.db.orders, db.orders);
  assert.equal(unwrapHeavyCollection('orders'), 'orders');
});

test('petite commande : envoi strictement identique à avant', async () => {
  const ops = generateOps({ orders: [] }, { orders: [{ id: 'CMD-1', items: [{ id: 'A' }], batches: [] }] });
  const cap = captureInserts();
  try { await cloudSync.pushOps(ops); } finally { cap.restore(); }
  assert.equal(cap.inserted.length, 1);
  assert.equal(cap.inserted[0].collection, 'orders');
  assert.deepEqual(cap.inserted[0].data.items, [{ id: 'A' }]);
});
