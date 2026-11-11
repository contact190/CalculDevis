// ZÉRO RÉGRESSION — on compare le nouveau moteur de synchro à une copie figée de l'ancien
// (tests/legacy/*, version en production le 11 nov. 2026) sur des milliers de scénarios aléatoires.
// Partout où il n'y a pas de conflit entre appareils, le résultat doit être IDENTIQUE.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as NEW from '../src/utils/patchEngine.js';
import { smartMerge as newSmartMerge } from '../src/utils/smartMerge.js';
import { mergeSnapshotItems } from '../src/utils/snapshotMerge.js';
import * as OLD from './legacy/patchEngine.legacy.js';
import { smartMerge as oldSmartMerge } from './legacy/smartMerge.legacy.js';
import {
  makeRng, installClock, restoreClock, tick, clone, stripSyncMeta, hasSyncMeta,
  makeIdGen, mkDb, randomEdit, PLAN_EDITS, OTHER_EDITS, tagOps,
} from './helpers/syncSim.mjs';

// Copie figée de l'ancienne fusion local ↔ instantané Cloud (supabaseClient.js, loadWithMeta)
function legacySnapshotMerge(arrA, arrB) {
  const map = new Map();
  if (Array.isArray(arrA)) arrA.forEach(item => { if (item && item.id) map.set(item.id, item); });
  if (Array.isArray(arrB)) {
    arrB.forEach(item => {
      if (!item || !item.id) return;
      const existing = map.get(item.id);
      if (!existing) { map.set(item.id, item); } else {
        const existingTime = existing._lastModified ? new Date(existing._lastModified).getTime() : 0;
        const incomingTime = item._lastModified ? new Date(item._lastModified).getTime() : 0;
        if (incomingTime >= existingTime) map.set(item.id, item);
      }
    });
  }
  return Array.from(map.values());
}

test.before(installClock);
test.after(restoreClock);

const ALL_EDITS = { ...PLAN_EDITS, ...OTHER_EDITS };

/** Un « monde » = N appareils utilisant la même implémentation. */
function makeWorld(impl, nDevices, seedDb) {
  return { impl, states: Array.from({ length: nDevices }, () => clone(seedDb)) };
}

/** L'appareil d modifie, génère ses opérations, se les applique (datage local) ; renvoie les ops « transportées ». */
function localEdit(world, d, editFn) {
  const before = world.states[d];
  const after = editFn(before);
  const ops = tagOps(world.impl.generateOps(before, after), `dev-${d}`);
  world.states[d] = ops.length ? world.impl.applyOps(after, ops).db : after;
  return clone(ops); // passage réseau = JSON
}

test('appareils synchronisés : 300 séquences × 40 modifications → résultat identique à l\'ancien moteur', () => {
  let steps = 0, withMeta = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const seedDb = mkDb(makeIdGen(`s${seed}-`));
    const wNew = makeWorld(NEW, 2, seedDb), wOld = makeWorld(OLD, 2, seedDb);
    const rngNew = makeRng(seed), rngOld = makeRng(seed);
    const genNew = makeIdGen(`n${seed}-`), genOld = makeIdGen(`n${seed}-`);

    for (let i = 0; i < 40; i++) {
      tick(1000 + i);
      const d = i % 2 === 0 ? 0 : 1; // tour à tour, toujours à jour
      const opsNew = localEdit(wNew, d, db => randomEdit(db, rngNew, genNew, ALL_EDITS));
      const opsOld = localEdit(wOld, d, db => randomEdit(db, rngOld, genOld, ALL_EDITS));

      // mêmes opérations émises (aux métadonnées de synchro près)
      assert.deepEqual(stripSyncMeta(opsNew), stripSyncMeta(opsOld), `ops seed=${seed} step=${i}`);

      const o = 1 - d;
      wNew.states[o] = NEW.applyOps(wNew.states[o], opsNew).db;
      wOld.states[o] = OLD.applyOps(wOld.states[o], opsOld).db;

      for (const dev of [0, 1]) {
        assert.deepEqual(stripSyncMeta(wNew.states[dev]), stripSyncMeta(wOld.states[dev]), `état seed=${seed} step=${i} dev=${dev}`);
      }
      // les deux appareils du nouveau monde sont strictement identiques, métadonnées comprises
      const plansOf = (st) => clone(st.clients).map(c => ({ id: c.id, sitePlans: c.sitePlans, del: c._syncDelPlans }));
      assert.deepEqual(plansOf(wNew.states[0]), plansOf(wNew.states[1]), `convergence seed=${seed} step=${i}`);
      steps++;
      if (hasSyncMeta(wNew.states[0])) withMeta++;
    }
  }
  assert.ok(steps === 12000);
  assert.ok(withMeta > 6000, 'le datage doit réellement être actif pendant le test');
});

test('rechargements complets entre appareils synchronisés (smartMerge + instantané Cloud) : identique à l\'ancien', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const seedDb = mkDb(makeIdGen(`r${seed}-`));
    const wNew = makeWorld(NEW, 2, seedDb), wOld = makeWorld(OLD, 2, seedDb);
    const rngNew = makeRng(seed), rngOld = makeRng(seed);
    const genNew = makeIdGen(`m${seed}-`), genOld = makeIdGen(`m${seed}-`);

    for (let i = 0; i < 25; i++) {
      tick(1500);
      const d = i % 2;
      const opsNew = localEdit(wNew, d, db => randomEdit(db, rngNew, genNew, ALL_EDITS));
      const opsOld = localEdit(wOld, d, db => randomEdit(db, rngOld, genOld, ALL_EDITS));
      const o = 1 - d;
      wNew.states[o] = NEW.applyOps(wNew.states[o], opsNew).db;
      wOld.states[o] = OLD.applyOps(wOld.states[o], opsOld).db;

      if (i % 5 === 4) {
        // l'autre appareil recharge l'instantané complet de celui qui vient de modifier
        const snapNew = clone(wNew.states[d]), snapOld = clone(wOld.states[d]);
        const mNew = newSmartMerge(wNew.states[o], snapNew), mOld = oldSmartMerge(wOld.states[o], snapOld);
        assert.deepEqual(stripSyncMeta(mNew), stripSyncMeta(mOld), `smartMerge seed=${seed} step=${i}`);
        for (const key of ['clients', 'orders', 'quotes']) {
          const a = mergeSnapshotItems(wNew.states[o][key], snapNew[key]);
          const b = legacySnapshotMerge(wOld.states[o][key], snapOld[key]);
          assert.deepEqual(stripSyncMeta(a), stripSyncMeta(b), `instantané ${key} seed=${seed} step=${i}`);
        }
      }
    }
  }
});

test('données sans date (ancien format) : même avec appareils en retard et ordre d\'arrivée aléatoire, résultat identique à l\'ancien', () => {
  // Les opérations sont générées par l'ANCIEN moteur (aucune date par ouverture) :
  // le nouveau moteur doit alors se comporter exactement comme l'ancien, conflits compris.
  let compared = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const seedDb = mkDb(makeIdGen(`c${seed}-`));
    const N = 3;
    const recvNew = Array.from({ length: N }, () => clone(seedDb));
    const recvOld = Array.from({ length: N }, () => clone(seedDb));

    // On rejoue tout le trafic, dans un ordre aléatoire, sur les deux moteurs
    const traffic = [];
    const world2 = makeWorld(OLD, N, seedDb);
    const rng2 = makeRng(5000 + seed), gen2 = makeIdGen(`z${seed}-`);
    for (let i = 0; i < 30; i++) {
      tick(900);
      const d = rng2.int(N);
      const ops = localEdit(world2, d, db => randomEdit(db, rng2, gen2, ALL_EDITS));
      if (ops.length) traffic.push(ops);
      if (rng2.chance(0.4)) { // cet appareil reçoit une partie seulement → les autres restent en retard
        const o = rng2.int(N);
        if (o !== d && ops.length) world2.states[o] = OLD.applyOps(world2.states[o], clone(ops)).db;
      }
    }
    for (let r = 0; r < N; r++) {
      const order = traffic.map((_, i) => i).sort(() => rng2.next() - 0.5);
      for (const idx of order) {
        recvNew[r] = NEW.applyOps(recvNew[r], clone(traffic[idx])).db;
        recvOld[r] = OLD.applyOps(recvOld[r], clone(traffic[idx])).db;
        assert.deepEqual(recvNew[r], recvOld[r], `seed=${seed} récepteur=${r}`);
        compared++;
      }
      assert.equal(hasSyncMeta(recvNew[r]), false);
      // rechargement complet croisé
      const other = recvOld[(r + 1) % N];
      assert.deepEqual(newSmartMerge(recvNew[r], clone(other)), oldSmartMerge(recvOld[r], clone(other)), `smartMerge seed=${seed}`);
      assert.deepEqual(mergeSnapshotItems(recvNew[r].clients, clone(other.clients)), legacySnapshotMerge(recvOld[r].clients, clone(other.clients)), `instantané seed=${seed}`);
    }
  }
  assert.ok(compared > 5000);
});

test('tout ce qui n\'est pas un plan de chantier (commandes, lots, devis, catalogue, réglages) : identique même en conflit', () => {
  let compared = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const seedDb = mkDb(makeIdGen(`o${seed}-`));
    const N = 3;
    const wNew = makeWorld(NEW, N, seedDb), wOld = makeWorld(OLD, N, seedDb);
    const rngNew = makeRng(seed * 7), rngOld = makeRng(seed * 7);
    const genNew = makeIdGen(`q${seed}-`), genOld = makeIdGen(`q${seed}-`);
    const ctl = makeRng(seed * 13);
    const pendNew = Array.from({ length: N }, () => []), pendOld = Array.from({ length: N }, () => []);

    for (let i = 0; i < 40; i++) {
      tick(500 + ctl.int(2000));
      const d = ctl.int(N);
      const opsNew = localEdit(wNew, d, db => randomEdit(db, rngNew, genNew, OTHER_EDITS));
      const opsOld = localEdit(wOld, d, db => randomEdit(db, rngOld, genOld, OTHER_EDITS));
      assert.deepEqual(opsNew, opsOld);
      for (let o = 0; o < N; o++) if (o !== d) { pendNew[o].push(opsNew); pendOld[o].push(opsOld); }
      // livraisons aléatoires (retards, désordre)
      for (let o = 0; o < N; o++) {
        while (pendNew[o].length && ctl.chance(0.45)) {
          const k = ctl.int(pendNew[o].length);
          wNew.states[o] = NEW.applyOps(wNew.states[o], clone(pendNew[o].splice(k, 1)[0])).db;
          wOld.states[o] = OLD.applyOps(wOld.states[o], clone(pendOld[o].splice(k, 1)[0])).db;
        }
        assert.deepEqual(wNew.states[o], wOld.states[o], `seed=${seed} step=${i} dev=${o}`);
        compared++;
      }
    }
  }
  assert.ok(compared === 36000);
});
