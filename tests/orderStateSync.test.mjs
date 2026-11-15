// Synchro de l'interface poseur : les états de chantier d'une commande (étapes de pose, livraisons,
// stock fini, statuts alu/vitrage) sont fusionnés repère par repère, sans perte entre appareils.
import test from 'node:test';
import assert from 'node:assert/strict';

import { generateOps, applyOps } from '../src/utils/patchEngine.js';
import { smartMerge } from '../src/utils/smartMerge.js';
import { orderStateOpsDuringRemote, prepareLocalBeforeRemote } from '../src/utils/reconnectSync.js';
import { mergeOrderState } from '../src/utils/orderStateSync.js';
import { installClock, restoreClock, tick, nowIso, clone, makeRng } from './helpers/syncSim.mjs';

test.before(installClock);
test.after(restoreClock);

const baseDb = () => ({
  orders: [{ id: 'CMD-1', status: 'En cours', items: [{ id: 'I1' }], installationSteps: {}, finishedGoodsDelivery: {}, _lastModified: nowIso() }],
});
const order = (db) => db.orders[0];
const setStep = (db, voidId, stepId, done, by) => ({
  ...db,
  orders: db.orders.map(o => ({
    ...o,
    installationSteps: { ...o.installationSteps, [voidId]: { ...(o.installationSteps[voidId] || {}), [stepId]: done ? { done: true, at: nowIso(), by } : { done: false, at: null, by: null } } },
  })),
});
/** Modification locale sur un appareil : renvoie [nouvel état, opérations envoyées]. */
const localEdit = (db, fn) => {
  const next = fn(db);
  const ops = generateOps(db, next);
  return [applyOps(next, ops).db, ops];
};
const receive = (db, ops) => applyOps(db, clone(ops)).db;

test('deux poseurs valident deux repères presque en même temps : les deux validations restent partout', () => {
  tick();
  const base = baseDb();
  tick(1000);
  let [A, opsA] = localEdit(base, db => setStep(db, 'V1', 'pose_alu', true, 'Poseur A'));
  tick(800);
  let [B, opsB] = localEdit(base, db => setStep(db, 'V2', 'pose_alu', true, 'Poseur B'));
  A = receive(A, opsB);
  B = receive(B, opsA);
  for (const dev of [A, B]) {
    assert.equal(order(dev).installationSteps.V1.pose_alu.done, true);
    assert.equal(order(dev).installationSteps.V2.pose_alu.done, true);
  }
  assert.deepEqual(order(A).installationSteps, order(B).installationSteps);
});

test('le bureau modifie la commande sans avoir reçu la saisie du poseur : la validation du poseur est conservée', () => {
  tick();
  const base = baseDb();
  tick(1000);
  let [P, opsP] = localEdit(base, db => setStep(db, 'V1', 'pose_alu', true, 'Poseur'));
  tick(1500);
  let [Bu, opsBu] = localEdit(base, db => ({ ...db, orders: db.orders.map(o => ({ ...o, status: 'Pose en cours' })) }));
  P = receive(P, opsBu);
  Bu = receive(Bu, opsP);
  for (const dev of [P, Bu]) {
    assert.equal(order(dev).status, 'Pose en cours');
    assert.equal(order(dev).installationSteps.V1.pose_alu.done, true);
  }
});

test('ordre d\'arrivée inversé (opération du bureau reçue avant celle du poseur) : même résultat', () => {
  tick();
  const base = baseDb();
  tick(1000);
  const [, opsP] = localEdit(base, db => setStep(db, 'V1', 'reglage', true, 'Poseur'));
  tick(1000);
  const [, opsBu] = localEdit(base, db => ({ ...db, orders: db.orders.map(o => ({ ...o, status: 'X' })) }));
  const third1 = receive(receive(base, opsBu), opsP);
  const third2 = receive(receive(base, opsP), opsBu);
  assert.equal(order(third1).installationSteps.V1.reglage.done, true);
  assert.equal(order(third2).installationSteps.V1.reglage.done, true);
  assert.equal(order(third1).status, 'X');
  assert.equal(order(third2).status, 'X');
});

test('une annulation d\'étape plus récente l\'emporte sur une validation plus ancienne', () => {
  tick();
  let [A] = localEdit(baseDb(), db => setStep(db, 'V1', 'finition', true, 'A'));
  const shared = clone(A);
  tick(1000);
  const [, opsUndo] = localEdit(shared, db => setStep(db, 'V1', 'finition', false));
  tick(1000);
  // un autre appareil, en retard, renvoie la commande avec l'ancienne validation (autre champ modifié)
  const [, opsStale] = localEdit(shared, db => ({ ...db, orders: db.orders.map(o => ({ ...o, status: 'Retard' })) }));
  const r1 = receive(receive(shared, opsUndo), opsStale);
  const r2 = receive(receive(shared, opsStale), opsUndo);
  for (const r of [r1, r2]) {
    assert.equal(order(r).installationSteps.V1.finition.done, false);
    assert.equal(order(r).status, 'Retard');
  }
});

test('un repère retiré des livraisons ne réapparaît pas à cause d\'une copie en retard', () => {
  tick();
  let [S] = localEdit(baseDb(), db => ({ ...db, orders: db.orders.map(o => ({ ...o, finishedGoodsDelivery: { V1: { delivered: true }, V2: { delivered: true } } })) }));
  const shared = clone(S);
  tick(1000);
  const [, opsDel] = localEdit(shared, db => ({ ...db, orders: db.orders.map(o => { const d = { ...o.finishedGoodsDelivery }; delete d.V1; return { ...o, finishedGoodsDelivery: d }; }) }));
  tick(1000);
  const [, opsStale] = localEdit(shared, db => ({ ...db, orders: db.orders.map(o => ({ ...o, status: 'Retard' })) }));
  for (const r of [receive(receive(shared, opsDel), opsStale), receive(receive(shared, opsStale), opsDel)]) {
    assert.equal(order(r).finishedGoodsDelivery.V1, undefined);
    assert.equal(order(r).finishedGoodsDelivery.V2.delivered, true);
  }
});

test('données d\'avant le correctif (sans dates) : ancienne règle, la commande la plus récente gagne', () => {
  const a = { installationSteps: { V1: { pose_alu: { done: true } } } };
  const b = { installationSteps: { V2: { pose_alu: { done: true } } } };
  assert.deepEqual(mergeOrderState(a, b, true).installationSteps, b.installationSteps);
  assert.deepEqual(mergeOrderState(a, b, false).installationSteps, a.installationSteps);
  assert.equal(mergeOrderState(a, b, true)._stateTs, undefined);
});

test('rechargement complet (smartMerge) : fusion repère par repère aussi', () => {
  tick();
  const base = baseDb();
  tick(1000);
  const [A] = localEdit(base, db => setStep(db, 'V1', 'pose_alu', true, 'A'));
  tick(1000);
  const [B] = localEdit(base, db => setStep(db, 'V2', 'pose_alu', true, 'B'));
  for (const m of [smartMerge(A, B), smartMerge(B, A)]) {
    assert.equal(order(m).installationSteps.V1.pose_alu.done, true);
    assert.equal(order(m).installationSteps.V2.pose_alu.done, true);
  }
});

test('clic pendant la réception d\'une mise à jour distante : la saisie de chantier est envoyée', () => {
  tick();
  const prev = baseDb();
  tick(500);
  const clicked = setStep(prev, 'V1', 'pose_alu', true, 'Poseur');
  const ops = orderStateOpsDuringRemote(prev, clicked);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].collection, 'orders');
  assert.equal(ops[0].data.installationSteps.V1.pose_alu.done, true);
  assert.ok(ops[0].data._stateTs.installationSteps['V1::pose_alu'] > 0);
  // un autre appareil la reçoit bien
  const other = receive(prev, ops);
  assert.equal(order(other).installationSteps.V1.pose_alu.done, true);
  // via la préparation avant reconnexion aussi
  const { pendingOps } = prepareLocalBeforeRemote(prev, clicked, true);
  assert.equal(pendingOps.length, 1);
});

test('pendant la réception, une modification autre qu\'un état de chantier garde l\'ancien comportement (non envoyée)', () => {
  const prev = baseDb();
  const edited = { ...prev, orders: prev.orders.map(o => ({ ...o, status: 'Autre' })) };
  assert.deepEqual(orderStateOpsDuringRemote(prev, edited), []);
  assert.deepEqual(prepareLocalBeforeRemote(prev, edited, true).pendingOps, []);
});

test('deux poseurs valident deux étapes différentes du MÊME repère : les deux restent', () => {
  tick();
  const base = baseDb();
  tick(1000);
  let [A, opsA] = localEdit(base, db => setStep(db, 'V1', 'pose_alu', true, 'A'));
  tick(500);
  let [B, opsB] = localEdit(base, db => setStep(db, 'V1', 'manutention_vitrage', true, 'B'));
  A = receive(A, opsB); B = receive(B, opsA);
  for (const r of [A, B]) {
    assert.equal(order(r).installationSteps.V1.pose_alu.done, true);
    assert.equal(order(r).installationSteps.V1.manutention_vitrage.done, true);
  }
});

test('3 appareils, 300 scénarios aléatoires : tout le monde converge et aucune saisie n\'est perdue', () => {
  const STEPS = ['manutention', 'pose_alu', 'pose_vitrage', 'reglage', 'finition'];
  for (let seed = 1; seed <= 300; seed++) {
    const rng = makeRng(seed);
    tick();
    const base = baseDb();
    const states = [clone(base), clone(base), clone(base)];
    const pending = [[], [], []];
    const expected = {}; // dernière valeur voulue par (repère, étape)
    for (let i = 0; i < 30; i++) {
      tick(200 + rng.int(3000));
      const d = rng.int(3);
      const v = `V${rng.int(6)}`, s = rng.pick(STEPS), done = rng.chance(0.7);
      let ops;
      if (rng.chance(0.2)) {
        [states[d], ops] = localEdit(states[d], db => ({ ...db, orders: db.orders.map(o => ({ ...o, status: `S${i}` })) }));
      } else {
        [states[d], ops] = localEdit(states[d], db => setStep(db, v, s, done, `dev${d}`));
        if (ops.length) expected[`${v}.${s}`] = done; // déjà dans cet état sur l'appareil → aucune saisie
      }
      for (let o = 0; o < 3; o++) if (o !== d && ops.length) pending[o].push(ops);
      for (let o = 0; o < 3; o++) {
        while (pending[o].length && rng.chance(0.4)) {
          const k = rng.int(pending[o].length);
          states[o] = receive(states[o], pending[o].splice(k, 1)[0]);
        }
      }
    }
    for (let o = 0; o < 3; o++) while (pending[o].length) states[o] = receive(states[o], pending[o].shift());
    const ref = order(states[0]).installationSteps;
    for (let o = 1; o < 3; o++) assert.deepEqual(order(states[o]).installationSteps, ref, `seed=${seed} dev=${o}`);
    for (const [key, done] of Object.entries(expected)) {
      const [v, s] = key.split('.');
      assert.equal(!!ref[v]?.[s]?.done, done, `seed=${seed} ${key}`);
    }
  }
});
