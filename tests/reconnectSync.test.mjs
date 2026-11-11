// Reconnexion après coupure réseau : le poste ne renvoie plus les données du Cloud comme s'il les avait saisies.
// Constat sur l'historique réel : le 5 nov. 2026, un poste a renvoyé d'un coup 50 dossiers clients, 92 commandes
// et 459 devis au moment de sa reconnexion ; c'est ce renvoi qui a effacé les cotes de l'étage 9C (CMD-62).
import test from 'node:test';
import assert from 'node:assert/strict';

import * as NEW from '../src/utils/patchEngine.js';
import { smartMerge } from '../src/utils/smartMerge.js';
import { prepareLocalBeforeRemote } from '../src/utils/reconnectSync.js';
import { SYNC_TS } from '../src/utils/sitePlanSync.js';
import { installClock, restoreClock, tick, nowIso, clone, makeIdGen, mkPlan, tagOps } from './helpers/syncSim.mjs';

test.before(installClock);
test.after(restoreClock);

const editVoid = (vid, patch) => (db) => ({
  ...db,
  clients: db.clients.map(c => ({
    ...c, _lastModified: nowIso(),
    sitePlans: c.sitePlans.map(p => ({ ...p, floors: p.floors.map(f => ({ ...f, apartments: f.apartments.map(a => ({ ...a, voids: a.voids.map(v => v.id === vid ? { ...v, ...patch } : v) })) })) })),
  })),
});
const findVoid = (db, vid) => db.clients[0].sitePlans.flatMap(p => p.floors.flatMap(f => f.apartments.flatMap(a => a.voids))).find(v => v.id === vid);
function seed() {
  const plan = mkPlan(makeIdGen(''), { name: 'Plan', floors: 2, apts: 1, voids: 3 });
  plan.floors.forEach(f => f.apartments.forEach(a => a.voids.forEach(v => { v.L = ''; v.H = ''; })));
  const ids = plan.floors.flatMap(f => f.apartments.flatMap(a => a.voids.map(v => v.id)));
  return { ids, db: { clients: [{ id: 'CLI-1', nom: 'Client', sitePlans: [plan], _lastModified: nowIso() }], orders: [], quotes: [{ id: 'DEV-1', clientId: 'CLI-1', items: [{ id: 'A' }], _lastModified: nowIso() }] } };
}
const localEdit = (state, fn, dev) => { tick(1000); const after = fn(state); const ops = tagOps(NEW.generateOps(state, after), dev); return { state: NEW.applyOps(after, ops).db, ops: clone(ops) }; };

/** Reconnexion, ANCIEN déroulé : on fusionne l'instantané puis on renvoie toute la différence. */
function reconnectOld(prevRef, current, snapshot) {
  const merged = smartMerge(current, snapshot);
  tick(1000);
  const ops = tagOps(NEW.generateOps(prevRef, merged), 'reconnecte');
  return { state: ops.length ? NEW.applyOps(merged, ops).db : merged, sent: clone(ops) };
}
/** Reconnexion, NOUVEAU déroulé : seules les vraies modifications locales partent. */
function reconnectNew(prevRef, current, snapshot) {
  tick(1000);
  const { base, pendingOps } = prepareLocalBeforeRemote(prevRef, current, false);
  return { state: smartMerge(base, snapshot), sent: clone(tagOps(pendingOps, 'reconnecte')) };
}

function scenario(reconnect) {
  const { db, ids } = seed();
  // Avant ce correctif, quelqu'un avait saisi une cote sur l'ouverture 0 (donnée ancienne, sans date) :
  // elle figure dans l'instantané Cloud mais pas chez le poste qui va se reconnecter.
  const legacy = clone(db); legacy.clients[0].sitePlans[0].floors[0].apartments[0].voids[0].L = 1400; legacy.clients[0]._lastModified = nowIso();
  tick(60000);
  // Le technicien corrige ensuite cette cote et valide (saisie récente, datée). L'instantané Cloud ne l'a pas encore.
  let tech = clone(legacy);
  const t = localEdit(tech, editVoid(ids[0], { L: 1540, H: 1345, measurementsValidated: true }), 'technicien'); tech = t.state;
  const snapshot = clone(legacy); // instantané en retard
  // Le poste hors ligne (vieille copie) ajoute pendant ce temps un article à un devis, pas encore envoyé
  const offlineSynced = clone(db);
  tick(1000);
  const offlineNow = { ...offlineSynced, quotes: offlineSynced.quotes.map(q => ({ ...q, items: [...q.items, { id: 'HORS-LIGNE' }], _lastModified: nowIso() })) };
  // …puis le réseau revient
  const r = reconnect(offlineSynced, offlineNow, snapshot);
  // Le technicien et le bureau reçoivent ce que le poste reconnecté envoie
  if (r.sent.length) tech = NEW.applyOps(tech, r.sent).db;
  return { tech, ids, sent: r.sent, reconnected: r.state };
}

test('reconnexion : ancien déroulé → le renvoi en bloc écrase une saisie récente d\'un autre poste', () => {
  const { tech, ids, sent } = scenario(reconnectOld);
  assert.deepEqual(sent.map(o => `${o.collection}:${o.id}`).sort(), ['clients:CLI-1', 'quotes:DEV-1'], 'le dossier client venu du Cloud est renvoyé comme une saisie locale');
  assert.equal(findVoid(tech, ids[0]).L, 1400, 'la cote récente du technicien (1540) est remplacée par la vieille (1400)');
  assert.notEqual(findVoid(tech, ids[0]).measurementsValidated, true);
});

test('reconnexion : nouveau déroulé → la saisie récente est conservée et la saisie hors ligne part bien', () => {
  const { tech, ids, sent, reconnected } = scenario(reconnectNew);
  assert.equal(findVoid(tech, ids[0]).L, 1540, 'cote du technicien conservée');
  assert.equal(findVoid(tech, ids[0]).measurementsValidated, true);
  assert.deepEqual(sent.map(o => `${o.collection}:${o.id}`), ['quotes:DEV-1'], 'seule la vraie modification locale est envoyée');
  assert.deepEqual(tech.quotes[0].items.map(i => i.id), ['A', 'HORS-LIGNE'], 'la saisie faite hors ligne arrive chez le technicien');
  // le poste reconnecté a bien intégré le Cloud, sans dater ce qu'il n'a pas saisi
  assert.equal(findVoid(reconnected, ids[0]).L, 1400);
  assert.equal(findVoid(reconnected, ids[0])[SYNC_TS], undefined);
  assert.deepEqual(reconnected.quotes[0].items.map(i => i.id), ['A', 'HORS-LIGNE']);
  // une fois la référence mise à jour, plus rien n'est renvoyé
  assert.deepEqual(NEW.generateOps(reconnected, reconnected), []);
  // et dès que le technicien renvoie son dossier, le poste reconnecté récupère la bonne cote
  const back = localEdit(tech, editVoid(ids[1], { L: 1500 }), 'technicien');
  const healed = NEW.applyOps(reconnected, back.ops).db;
  assert.equal(findVoid(healed, ids[0]).L, 1540);
});

test('prepareLocalBeforeRemote : rien en attente → rien à envoyer, état inchangé', () => {
  const { db } = seed();
  assert.deepEqual(prepareLocalBeforeRemote(db, db, false), { base: db, pendingOps: [] });
  assert.deepEqual(prepareLocalBeforeRemote(null, db, false), { base: db, pendingOps: [] });
  const sameContent = { ...db };
  const r = prepareLocalBeforeRemote(db, sameContent, false);
  assert.equal(r.base, sameContent); assert.deepEqual(r.pendingOps, []);
});

test('prepareLocalBeforeRemote : modifications locales en attente → envoyées une seule fois, tous types de données', () => {
  const { db, ids } = seed();
  tick(1000);
  let cur = editVoid(ids[2], { L: 1234 })(db);
  cur = { ...cur, quotes: cur.quotes.map(q => ({ ...q, items: [...q.items, { id: 'B' }] })) };
  const { base, pendingOps } = prepareLocalBeforeRemote(db, cur, false);
  assert.deepEqual(pendingOps.map(o => `${o.op}:${o.collection}:${o.id}`).sort(), ['update:clients:CLI-1', 'update:quotes:DEV-1']);
  assert.equal(findVoid(base, ids[2]).L, 1234);
  assert.ok(findVoid(base, ids[2])[SYNC_TS] > 0);
  assert.deepEqual(prepareLocalBeforeRemote(base, base, false).pendingOps, [], 'pas de second envoi');
  // pendant la fenêtre de réception : rien n'est envoyé (comme avant), mais la saisie est datée
  const w = prepareLocalBeforeRemote(db, cur, true);
  assert.deepEqual(w.pendingOps, []);
  assert.ok(findVoid(w.base, ids[2])[SYNC_TS] > 0);
});

test('prepareLocalBeforeRemote : ne plante jamais', () => {
  const bad = { clients: new Proxy([], { get() { throw new Error('boom'); } }) };
  const quiet = console.warn; console.warn = () => {};
  try { const r = prepareLocalBeforeRemote({ clients: [] }, bad, false); assert.equal(r.base, bad); assert.deepEqual(r.pendingOps, []); }
  finally { console.warn = quiet; }
});
