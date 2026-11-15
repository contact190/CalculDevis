// Gros chantier : une commande de plus de 500 Ko doit quand même envoyer la saisie du poseur
// (version allégée avec seulement les champs modifiés), au lieu d'un simple signal de rechargement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOps, applyOps } from '../src/utils/patchEngine.js';
import { supabase, cloudSync } from '../src/utils/supabaseClient.js';

test('commande lourde : la validation d\'étape est envoyée (champs modifiés seulement) et appliquée au bureau', async () => {
  const bigItems = Array.from({ length: 400 }, (_, i) => ({ id: `I${i}`, label: 'x'.repeat(1500) }));
  const base = { orders: [{ id: 'CMD-BIG', status: 'En cours', items: bigItems, batches: [], installationSteps: {}, _lastModified: '2026-11-15T08:00:00.000Z' }] };
  const mobile = { ...base, orders: base.orders.map(o => ({ ...o, installationSteps: { V1: { pose_alu: { done: true, at: 'now', by: 'Poseur' } } } })) };
  const ops = generateOps(base, mobile);
  assert.equal(ops.length, 1);
  assert.ok(JSON.stringify(ops[0].data).length > 500000);

  const inserted = [];
  const realFrom = supabase.from;
  supabase.from = () => ({ insert: async (rows) => { inserted.push(...rows); return { error: null }; } });
  try {
    const res = await cloudSync.pushOps(ops);
    assert.equal(res.success, true);
  } finally {
    supabase.from = realFrom;
  }
  assert.equal(inserted.length, 1, 'une vraie opération, pas un signal de rechargement');
  const row = inserted[0];
  assert.equal(row.collection, 'orders');
  assert.ok(JSON.stringify(row.data).length < 10000);
  assert.equal(row.data.items, undefined);
  assert.ok(row.data._stateTs.installationSteps['V1::pose_alu'] > 0);

  // Le bureau reçoit l'opération allégée : l'étape apparaît, rien d'autre n'est perdu
  const desk = applyOps(base, [{ op: row.op, collection: row.collection, id: row.doc_id, data: row.data, timestamp: row.timestamp, deviceId: 'mobile' }]).db;
  assert.equal(desk.orders[0].installationSteps.V1.pose_alu.done, true);
  assert.equal(desk.orders[0].items.length, 400);
  assert.equal(desk.orders[0].status, 'En cours');
});

test('commande normale : envoi identique à avant (pas d\'allègement)', async () => {
  const base = { orders: [{ id: 'CMD-S', status: 'A', items: [{ id: 'I1' }], installationSteps: {}, _lastModified: '2026-11-15T08:00:00.000Z' }] };
  const next = { ...base, orders: base.orders.map(o => ({ ...o, status: 'B' })) };
  const ops = generateOps(base, next);
  const inserted = [];
  const realFrom = supabase.from;
  supabase.from = () => ({ insert: async (rows) => { inserted.push(...rows); return { error: null }; } });
  try { await cloudSync.pushOps(ops); } finally { supabase.from = realFrom; }
  assert.deepEqual(inserted[0].data.items, [{ id: 'I1' }]);
  assert.equal(inserted[0].data.status, 'B');
});
