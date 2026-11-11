// Fusion des plans de chantier ouverture par ouverture : on rejoue les incidents réels
// (CMD-62 étage 9C, CMD-46 « Plan 6 », plans/ouvertures qui disparaissent) et on prouve
// qu'un appareil en retard ne peut plus effacer le travail des autres.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as NEW from '../src/utils/patchEngine.js';
import * as OLD from './legacy/patchEngine.legacy.js';
import { smartMerge } from '../src/utils/smartMerge.js';
import { smartMerge as oldSmartMerge } from './legacy/smartMerge.legacy.js';
import { mergeSnapshotItems } from '../src/utils/snapshotMerge.js';
import {
  mergeSitePlans, mergeTombstones, stampClientForSync, stampDbForSync, SYNC_TS, SYNC_DEL, SYNC_DEL_PLANS,
} from '../src/utils/sitePlanSync.js';
import {
  makeRng, installClock, restoreClock, tick, nowIso, clone, stripSyncMeta, makeIdGen, mkPlan, mkVoid, tagOps,
} from './helpers/syncSim.mjs';

test.before(installClock);
test.after(restoreClock);

// ─── mini-réseau : chaque appareil a sa copie ; on choisit qui reçoit quoi et quand ───
function network(impl, seedDb, names) {
  const dev = {}; names.forEach(n => { dev[n] = clone(seedDb); });
  const sent = [];
  return {
    dev,
    /** l'appareil `n` modifie ; renvoie le paquet d'opérations (non encore distribué) */
    edit(n, fn) {
      tick(1000);
      const before = dev[n]; const after = fn(before);
      const ops = tagOps(impl.generateOps(before, after), n);
      dev[n] = ops.length ? impl.applyOps(after, ops).db : after;
      const packet = { from: n, ops: clone(ops) }; sent.push(packet); return packet;
    },
    deliver(packet, ...to) { to.forEach(n => { if (n !== packet.from) dev[n] = impl.applyOps(dev[n], clone(packet.ops)).db; }); },
    sent,
  };
}

const editVoid = (cid, vid, patch) => (db) => ({
  ...db,
  clients: db.clients.map(c => c.id !== cid ? c : {
    ...c, _lastModified: nowIso(),
    sitePlans: c.sitePlans.map(p => ({ ...p, floors: p.floors.map(f => ({ ...f, apartments: f.apartments.map(a => ({ ...a, voids: a.voids.map(v => v.id === vid ? { ...v, ...patch } : v) })) })) })),
  }),
});
const allVoids = (db, cid) => db.clients.find(c => c.id === cid).sitePlans.flatMap(p => p.floors.flatMap(f => f.apartments.flatMap(a => a.voids)));
const findVoid = (db, cid, vid) => allVoids(db, cid).find(v => v.id === vid);
const count = (db, cid, pred) => allVoids(db, cid).filter(pred).length;

function seed() {
  const gen = makeIdGen('');
  const plan = mkPlan(gen, { name: "Plan bloc A' maraval 2", floors: 3, apts: 2, voids: 3, extra: { orderId: 'CMD-62' } });
  // comme en vrai : un plan neuf a des cotes vides
  plan.floors.forEach(f => f.apartments.forEach(a => a.voids.forEach(v => { v.L = ''; v.H = ''; })));
  return {
    gen,
    db: { clients: [{ id: 'CLI-5808', nom: 'Eurl benammar urbain', telephone: '0', sitePlans: [plan], _lastModified: nowIso() }], orders: [], quotes: [] },
    ids: plan.floors.flatMap(f => f.apartments.flatMap(a => a.voids.map(v => v.id))),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENTS RÉELS
// ─────────────────────────────────────────────────────────────────────────────

test('incident CMD-62 (9C) : une tablette en retard n\'efface plus les cotes saisies par le technicien', () => {
  const run = (impl) => {
    const { db, ids } = seed();
    const net = network(impl, db, ['technicien', 'bureau', 'vieilleTablette']);
    // le technicien saisit et valide 2 ouvertures ; la vieille tablette ne reçoit rien (en veille)
    const p1 = net.edit('technicien', editVoid('CLI-5808', ids[0], { L: 1540, H: 1345, wallDepth: 999, measurementsValidated: true }));
    const p2 = net.edit('technicien', editVoid('CLI-5808', ids[1], { L: 1540, H: 1345, wallDepth: 999 }));
    net.deliver(p1, 'bureau'); net.deliver(p2, 'bureau');
    // deux jours plus tard, la vieille tablette modifie AUTRE CHOSE dans le même dossier client
    tick(2 * 86400000);
    const p3 = net.edit('vieilleTablette', (d) => ({ ...d, clients: d.clients.map(c => ({ ...c, telephone: '0555 12 34 56', _lastModified: nowIso() })) }));
    net.deliver(p3, 'technicien', 'bureau');
    return net;
  };

  const before = run(OLD);
  assert.equal(count(before.dev.bureau, 'CLI-5808', v => v.L === 1540), 0, 'ancien moteur : les 2 cotes étaient effacées (bug reproduit)');

  const net = run(NEW);
  for (const n of ['technicien', 'bureau']) {
    assert.equal(count(net.dev[n], 'CLI-5808', v => v.L === 1540 && v.H === 1345), 2, `${n} garde les 2 cotes`);
    assert.equal(count(net.dev[n], 'CLI-5808', v => v.measurementsValidated), 1, `${n} garde la validation`);
    assert.equal(net.dev[n].clients[0].telephone, '0555 12 34 56', 'la vraie modification de la tablette est bien prise');
  }
  // …et la vieille tablette se remet à jour dès qu'elle reçoit enfin les opérations manquées, même en retard
  net.deliver(net.sent[0], 'vieilleTablette'); net.deliver(net.sent[1], 'vieilleTablette');
  assert.equal(count(net.dev.vieilleTablette, 'CLI-5808', v => v.L === 1540), 2);
  assert.deepEqual(stripSyncMeta(net.dev.vieilleTablette.clients[0].sitePlans), stripSyncMeta(net.dev.bureau.clients[0].sitePlans));
});

test('incident CMD-46 (Plan 6) : les marques « lancée » ne sont plus retirées par un appareil en retard', () => {
  const run = (impl) => {
    const { db, ids } = seed();
    const net = network(impl, db, ['atelier', 'bureau', 'retard']);
    // l'atelier valide puis lance toutes les ouvertures ; « retard » ne reçoit rien
    const packets = ids.map(id => net.edit('atelier', editVoid('CLI-5808', id, { L: 1600, H: 1500, wallDepth: 300, measurementsValidated: true, productionLaunched: true })));
    packets.forEach(p => net.deliver(p, 'bureau'));
    // « retard » (copie d'avant) valide une ouverture de son côté
    const p = net.edit('retard', editVoid('CLI-5808', ids[4], { L: 1612, H: 1508, wallDepth: 300, measurementsValidated: true }));
    net.deliver(p, 'atelier', 'bureau');
    return { net, ids };
  };

  const old = run(OLD);
  assert.equal(count(old.net.dev.bureau, 'CLI-5808', v => v.productionLaunched), 0, 'ancien moteur : toutes les marques « lancée » perdues (bug reproduit)');

  const { net, ids } = run(NEW);
  for (const n of ['atelier', 'bureau']) {
    assert.equal(count(net.dev[n], 'CLI-5808', v => v.productionLaunched), ids.length - 1, `${n} : lancements conservés`);
    // l'ouverture réellement modifiée par « retard » prend SA version (la plus récente pour cette ouverture)
    assert.equal(findVoid(net.dev[n], 'CLI-5808', ids[4]).L, 1612);
  }
});

test('un plan créé ailleurs n\'est plus supprimé par un appareil qui ne le connaît pas', () => {
  const run = (impl) => {
    const { db, ids, gen } = seed();
    const net = network(impl, db, ['bureau', 'chantier', 'retard']);
    const p1 = net.edit('bureau', (d) => ({ ...d, clients: d.clients.map(c => ({ ...c, _lastModified: nowIso(), sitePlans: [...c.sitePlans, mkPlan(gen, { name: 'Nouveau plan', floors: 1, apts: 1, voids: 2 })] })) }));
    net.deliver(p1, 'chantier');
    const p2 = net.edit('retard', editVoid('CLI-5808', ids[0], { L: 1500 }));
    net.deliver(p2, 'bureau', 'chantier');
    return net;
  };
  assert.equal(run(OLD).dev.chantier.clients[0].sitePlans.length, 1, 'ancien moteur : le nouveau plan disparaissait');
  const net = run(NEW);
  assert.deepEqual(net.dev.chantier.clients[0].sitePlans.map(p => p.name), ["Plan bloc A' maraval 2", 'Nouveau plan']);
  assert.deepEqual(net.dev.bureau.clients[0].sitePlans.map(p => p.name), ["Plan bloc A' maraval 2", 'Nouveau plan']);
});

test('une ouverture ajoutée ailleurs garde sa place (les repères automatiques ne se décalent pas)', () => {
  const { db, ids, gen } = seed();
  const net = network(NEW, db, ['bureau', 'chantier', 'retard']);
  const newId = gen('void');
  // le bureau insère une ouverture en 2e position du premier appartement
  const p1 = net.edit('bureau', (d) => ({ ...d, clients: d.clients.map(c => ({ ...c, _lastModified: nowIso(), sitePlans: c.sitePlans.map(p => ({ ...p, floors: p.floors.map((f, fi) => fi ? f : ({ ...f, apartments: f.apartments.map((a, ai) => ai ? a : ({ ...a, voids: [a.voids[0], mkVoid(newId), ...a.voids.slice(1)] })) })) })) })) }));
  net.deliver(p1, 'chantier');
  const p2 = net.edit('retard', editVoid('CLI-5808', ids[2], { L: 1777 }));
  net.deliver(p2, 'bureau', 'chantier');
  net.deliver(p1, 'retard');
  const order = (n) => net.dev[n].clients[0].sitePlans[0].floors[0].apartments[0].voids.map(v => v.id);
  for (const n of ['bureau', 'chantier', 'retard']) assert.deepEqual(order(n), [ids[0], newId, ids[1], ids[2]], n);
});

test('suppression : elle se propage, et une vieille copie ne fait pas réapparaître l\'ouverture', () => {
  const { db, ids } = seed();
  const net = network(NEW, db, ['bureau', 'chantier', 'retard']);
  // le chantier saisit une cote (l'ouverture est donc datée), reçue par tous
  const p0 = net.edit('chantier', editVoid('CLI-5808', ids[0], { L: 1500 }));
  net.deliver(p0, 'bureau', 'retard');
  // le bureau supprime cette ouverture ; « retard » ne reçoit pas la suppression
  const p1 = net.edit('bureau', (d) => ({ ...d, clients: d.clients.map(c => ({ ...c, _lastModified: nowIso(), sitePlans: c.sitePlans.map(p => ({ ...p, floors: p.floors.map(f => ({ ...f, apartments: f.apartments.map(a => ({ ...a, voids: a.voids.filter(v => v.id !== ids[0]) })) })) })) })) }));
  net.deliver(p1, 'chantier');
  assert.equal(findVoid(net.dev.chantier, 'CLI-5808', ids[0]), undefined, 'suppression reçue');
  // « retard » modifie une AUTRE ouverture et renvoie tout le dossier, avec l'ouverture supprimée dedans
  const p2 = net.edit('retard', editVoid('CLI-5808', ids[5], { L: 1444 }));
  net.deliver(p2, 'bureau', 'chantier');
  for (const n of ['bureau', 'chantier']) {
    assert.equal(findVoid(net.dev[n], 'CLI-5808', ids[0]), undefined, `${n} : l'ouverture supprimée ne revient pas`);
    assert.equal(findVoid(net.dev[n], 'CLI-5808', ids[5]).L, 1444);
  }
  // et quand « retard » reçoit enfin la suppression (en retard), il l'applique aussi
  net.deliver(p1, 'retard');
  assert.equal(findVoid(net.dev.retard, 'CLI-5808', ids[0]), undefined);
});

test('plan supprimé : la suppression se propage et le plan ne revient pas d\'un appareil en retard', () => {
  const { db, ids, gen } = seed();
  const net = network(NEW, db, ['bureau', 'chantier', 'retard']);
  let planB;
  const p0 = net.edit('bureau', (d) => { planB = mkPlan(gen, { name: 'À supprimer', floors: 1, apts: 1, voids: 1 }); return { ...d, clients: d.clients.map(c => ({ ...c, _lastModified: nowIso(), sitePlans: [...c.sitePlans, planB] })) }; });
  net.deliver(p0, 'chantier', 'retard');
  const p1 = net.edit('bureau', (d) => ({ ...d, clients: d.clients.map(c => ({ ...c, _lastModified: nowIso(), sitePlans: c.sitePlans.filter(p => p.id !== planB.id) })) }));
  net.deliver(p1, 'chantier');
  const p2 = net.edit('retard', editVoid('CLI-5808', ids[1], { H: 1234 }));
  net.deliver(p2, 'bureau', 'chantier');
  for (const n of ['bureau', 'chantier']) assert.deepEqual(net.dev[n].clients[0].sitePlans.map(p => p.name), ["Plan bloc A' maraval 2"], n);
  net.deliver(p1, 'retard');
  assert.equal(net.dev.retard.clients[0].sitePlans.length, 1);
});

test('rechargement : un instantané Cloud envoyé par un appareil en retard n\'efface plus les saisies locales', () => {
  const { db, ids } = seed();
  const net = network(NEW, db, ['technicien', 'retard']);
  net.edit('technicien', editVoid('CLI-5808', ids[0], { L: 1540, H: 1345, measurementsValidated: true }));
  // « retard » modifie le dossier plus tard → son instantané Cloud est « plus récent » mais périmé pour cette ouverture
  net.edit('retard', (d) => ({ ...d, clients: d.clients.map(c => ({ ...c, telephone: '0777', _lastModified: nowIso() })) }));
  const snapshot = clone(net.dev.retard);

  const viaBuckets = mergeSnapshotItems(net.dev.technicien.clients, snapshot.clients);
  assert.equal(viaBuckets[0].telephone, '0777');
  assert.equal(viaBuckets[0].sitePlans[0].floors[0].apartments[0].voids[0].L, 1540);

  const viaSmart = smartMerge(net.dev.technicien, snapshot);
  assert.equal(findVoid(viaSmart, 'CLI-5808', ids[0]).L, 1540);
  assert.equal(findVoid(viaSmart, 'CLI-5808', ids[0]).measurementsValidated, true);

  // ancien moteur : la cote était perdue dans les deux cas
  const oldNet = network(OLD, db, ['technicien', 'retard']);
  oldNet.edit('technicien', editVoid('CLI-5808', ids[0], { L: 1540, H: 1345, measurementsValidated: true }));
  oldNet.edit('retard', (d) => ({ ...d, clients: d.clients.map(c => ({ ...c, telephone: '0777', _lastModified: nowIso() })) }));
  assert.equal(findVoid(oldSmartMerge(oldNet.dev.technicien, clone(oldNet.dev.retard)), 'CLI-5808', ids[0]).L, '');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROPRIÉTÉS GÉNÉRALES (scénarios aléatoires)
// ─────────────────────────────────────────────────────────────────────────────

function chaos(impl, seedN, { nDev = 4, steps = 60 } = {}) {
  const { db, ids } = seed();
  const rng = makeRng(seedN);
  const names = Array.from({ length: nDev }, (_, i) => `d${i}`);
  const net = network(impl, db, names);
  const pending = Object.fromEntries(names.map(n => [n, []]));
  const expected = new Map(); // dernière modification voulue pour chaque ouverture

  for (let i = 0; i < steps; i++) {
    const n = rng.pick(names);
    const vid = rng.pick(ids);
    const patch = rng.pick([
      { L: 1000 + rng.int(900), H: 1000 + rng.int(900) },
      { wallDepth: 100 + rng.int(300) },
      { measurementsValidated: true },
      { measurementsValidated: true, productionLaunched: true },
    ]);
    const packet = net.edit(n, editVoid('CLI-5808', vid, patch));
    if (packet.ops.length) {
      expected.set(vid, stripSyncMeta(findVoid(net.dev[n], 'CLI-5808', vid)));
      names.forEach(o => { if (o !== n) pending[o].push(packet); });
    }
    // livraisons aléatoires : retards longs et désordre
    names.forEach(o => { while (pending[o].length && rng.chance(0.25)) net.deliver(pending[o].splice(rng.int(pending[o].length), 1)[0], o); });
  }
  // à la fin, tout le monde reçoit tout ce qui lui manque, dans un ordre quelconque
  names.forEach(o => { while (pending[o].length) net.deliver(pending[o].splice(rng.int(pending[o].length), 1)[0], o); });

  let lost = 0;
  for (const n of names) for (const [vid, want] of expected) {
    try { assert.deepEqual(stripSyncMeta(findVoid(net.dev[n], 'CLI-5808', vid)), want); } catch { lost++; }
  }
  return { net, names, lost, checked: expected.size * names.length };
}

test('200 scénarios chaotiques (4 appareils, retards, désordre) : aucune saisie perdue et tous les appareils finissent identiques', () => {
  let lostNew = 0, lostOld = 0, checked = 0;
  for (let s = 1; s <= 200; s++) {
    const r = chaos(NEW, s);
    lostNew += r.lost; checked += r.checked;
    const ref = clone(r.net.dev[r.names[0]].clients[0].sitePlans);
    for (const n of r.names) assert.deepEqual(clone(r.net.dev[n].clients[0].sitePlans), ref, `convergence seed=${s} ${n}`);
    lostOld += chaos(OLD, s).lost;
  }
  assert.equal(lostNew, 0, `nouveau moteur : ${lostNew} saisies perdues sur ${checked}`);
  assert.ok(lostOld > 0, 'l\'ancien moteur perdait des saisies sur ces mêmes scénarios (le test est donc discriminant)');
  console.log(`    saisies vérifiées : ${checked} — perdues avec l'ancien moteur : ${lostOld} — avec le nouveau : ${lostNew}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLES DE BASE
// ─────────────────────────────────────────────────────────────────────────────

test('appareils à jour : la fusion renvoie exactement la version reçue (même objet → comportement historique)', () => {
  const { db } = seed();
  const a = db.clients[0].sitePlans;
  const b = clone(a); b[0].floors[0].apartments[0].voids[0].L = 1234;
  assert.equal(mergeSitePlans(a, b, true).plans, b);
  assert.equal(mergeSitePlans(a, b, false).plans, a);
});

test('listes non identifiables (id manquant ou en double) : ancienne règle, d\'un bloc', () => {
  const a = [{ id: 'p1', floors: [{ name: 'sans id', apartments: [] }] }];
  const b = [{ id: 'p1', floors: [{ name: 'autre', apartments: [] }, { name: 'x', apartments: [] }] }];
  assert.equal(mergeSitePlans(a, b, true).plans[0].floors, b[0].floors);
  assert.equal(mergeSitePlans(a, b, false).plans[0].floors, a[0].floors);
  const dup = [{ id: 'p1' }, { id: 'p1' }];
  assert.equal(mergeSitePlans(dup, [{ id: 'p1' }], true).plans.length, 1);
  assert.equal(mergeSitePlans(dup, [{ id: 'p1' }], false).plans, dup);
  assert.equal(mergeSitePlans(undefined, [{ id: 'p1' }], false).plans, undefined);
});

test('date par ouverture : la plus récente gagne, quel que soit l\'ordre d\'arrivée', () => {
  const mk = (L, ts) => [{ id: 'p', floors: [{ id: 'f', apartments: [{ id: 'a', voids: [{ id: 'v', L, ...(ts ? { [SYNC_TS]: ts } : {}) }] }] }] }];
  const v = (r) => r.plans[0].floors[0].apartments[0].voids[0];
  assert.equal(v(mergeSitePlans(mk(1500, 200), mk(1600, 100), true)).L, 1500, 'reçu plus vieux pour cette ouverture → on garde le local');
  assert.equal(v(mergeSitePlans(mk(1500, 100), mk(1600, 200), false)).L, 1600, 'reçu plus récent pour cette ouverture → on le prend même si le dossier est plus vieux');
  assert.equal(v(mergeSitePlans(mk(1500, 100), mk(1600), true)).L, 1500, 'daté contre non daté → le daté gagne');
  assert.equal(v(mergeSitePlans(mk(1500), mk(1600), true)).L, 1600, 'aucune date → ancienne règle');
  assert.equal(v(mergeSitePlans(mk(1500), mk(1600), false)).L, 1500, 'aucune date → ancienne règle');
});

test('datage local : seules les ouvertures réellement modifiées sont datées ; les suppressions sont tracées', () => {
  const { db } = seed();
  const old = db.clients[0];
  const apt = old.sitePlans[0].floors[0].apartments[0];
  const [v0, v1, v2] = apt.voids;
  const next = { ...old, sitePlans: old.sitePlans.map(p => ({ ...p, floors: p.floors.map((f, fi) => fi ? f : ({ ...f, apartments: f.apartments.map((a, ai) => ai ? a : ({ ...a, voids: [{ ...v0, L: 1555 }, v2] })) })) })) };
  const s = stampClientForSync(old, next, 5000);
  const sApt = s.sitePlans[0].floors[0].apartments[0];
  assert.equal(sApt.voids[0][SYNC_TS], 5000, 'ouverture modifiée → datée');
  assert.equal(sApt.voids[1][SYNC_TS], undefined, 'ouverture non modifiée → pas de date');
  assert.deepEqual(sApt[SYNC_DEL], { [v1.id]: 5000 }, 'ouverture retirée → trace de suppression');
  assert.equal(s.sitePlans[0][SYNC_TS], undefined, 'le plan lui-même (nom, lien commande) n\'a pas changé');
  assert.equal(s.sitePlans[0].floors[1], old.sitePlans[0].floors[1], 'étages non touchés : mêmes objets');
  // rejouer le datage ne change plus rien (pas de boucle)
  assert.equal(stampClientForSync(old, s, 9000), s);
  assert.equal(stampClientForSync(s, s, 9000), s);
  // une date reçue d'ailleurs (plus récente) n'est pas écrasée par le datage local
  const remote = clone(s); remote.sitePlans[0].floors[0].apartments[0].voids[0][SYNC_TS] = 7000; remote.sitePlans[0].floors[0].apartments[0].voids[0].L = 1666;
  assert.equal(stampClientForSync(s, remote, 9000).sitePlans[0].floors[0].apartments[0].voids[0][SYNC_TS], 7000);
  // un écran qui reconstruit une ouverture sans ses métadonnées ne lui fait pas perdre sa date
  const rebuilt = clone(s); delete rebuilt.sitePlans[0].floors[0].apartments[0].voids[0][SYNC_TS];
  assert.equal(stampClientForSync(s, rebuilt, 9000).sitePlans[0].floors[0].apartments[0].voids[0][SYNC_TS], 5000);
  // suppression déjà tracée par un autre appareil : on ne la re-date pas
  const withTomb = clone(next); withTomb.sitePlans[0].floors[0].apartments[0][SYNC_DEL] = { [v1.id]: 4000 };
  assert.deepEqual(stampClientForSync(old, withTomb, 9000).sitePlans[0].floors[0].apartments[0][SYNC_DEL], { [v1.id]: 4000 });
});

test('modification locale faite pendant la réception d\'opérations : datée quand même (stampDbForSync)', () => {
  const { db, ids } = seed();
  const edited = editVoid('CLI-5808', ids[3], { L: 1490 })(db);
  const stamped = stampDbForSync(db, edited, Date.now());
  assert.notEqual(stamped, edited);
  assert.equal(findVoid(stamped, 'CLI-5808', ids[3])[SYNC_TS], Date.now());
  assert.equal(stampDbForSync(db, stamped, Date.now() + 5), stamped, 'deuxième passage : rien à faire');
  assert.equal(stampDbForSync(db, db, 1), db);
  const other = { ...db, quotes: [{ id: 'DEV-9' }] };
  assert.equal(stampDbForSync(db, other, 1), other, 'les clients n\'ont pas changé → base renvoyée telle quelle');
});

test('modifier après une suppression faite ailleurs : la modification la plus récente l\'emporte', () => {
  const mk = (voids, del) => [{ id: 'p', floors: [{ id: 'f', apartments: [{ id: 'a', voids, ...(del ? { [SYNC_DEL]: del } : {}) }] }] }];
  const vs = (r) => r.plans[0].floors[0].apartments[0].voids.map(v => v.id);
  assert.deepEqual(vs(mergeSitePlans(mk([], { v: 300 }), mk([{ id: 'v', L: 1, [SYNC_TS]: 200 }]), true)), [], 'copie plus vieille que la suppression → reste supprimée');
  assert.deepEqual(vs(mergeSitePlans(mk([], { v: 300 }), mk([{ id: 'v', L: 1, [SYNC_TS]: 400 }]), true)), ['v'], 'modifiée après la suppression → conservée');
  assert.deepEqual(mergeTombstones({ a: 1, b: 5 }, { b: 3, c: 2 }), { a: 1, b: 5, c: 2 });
});

test('les opérations générées portent les dates et les suppressions de plans', () => {
  const { db, ids } = seed();
  tick(1000);
  const edited = editVoid('CLI-5808', ids[0], { L: 1500 })(db);
  const [op] = NEW.generateOps(db, edited);
  assert.equal(op.collection, 'clients');
  assert.equal(findVoid({ clients: [op.data] }, 'CLI-5808', ids[0])[SYNC_TS], Date.parse(op.timestamp));
  const removed = { ...db, clients: db.clients.map(c => ({ ...c, sitePlans: [] })) };
  const [op2] = NEW.generateOps(db, removed);
  assert.deepEqual(Object.keys(op2.data[SYNC_DEL_PLANS]), [db.clients[0].sitePlans[0].id]);
  // les dates seules ne déclenchent jamais d'envoi
  const onlyStamps = clone(db); onlyStamps.clients[0].sitePlans[0].floors[0].apartments[0].voids[0][SYNC_TS] = 123;
  assert.deepEqual(NEW.generateOps(db, onlyStamps), []);
});

test('modifications de structure en plein chaos (ajouts, suppressions, copies d\'étage, déplacements) : tout le monde se réaligne', async () => {
  const { mkDb, randomEdit, PLAN_EDITS } = await import('./helpers/syncSim.mjs');
  for (const N of [2, 3, 4]) {
    for (let s = 1; s <= 120; s++) {
      const seedDb = mkDb(makeIdGen(`h${s}-`));
      const st = Array.from({ length: N }, () => clone(seedDb));
      const rng = makeRng(s * 31 + N), gen = makeIdGen(`g${s}-`);
      const pend = Array.from({ length: N }, () => []);
      const send = (d, after) => {
        const ops = tagOps(NEW.generateOps(st[d], after), `dev-${d}`);
        st[d] = ops.length ? NEW.applyOps(after, ops).db : after;
        return clone(ops);
      };
      for (let i = 0; i < 30; i++) {
        tick(1000 + rng.int(500));
        const d = rng.int(N);
        const ops = send(d, randomEdit(st[d], rng, gen, PLAN_EDITS));
        if (ops.length) for (let o = 0; o < N; o++) if (o !== d) pend[o].push(ops);
        for (let o = 0; o < N; o++) while (pend[o].length && rng.chance(0.3)) st[o] = NEW.applyOps(st[o], clone(pend[o].splice(rng.int(pend[o].length), 1)[0])).db;
      }
      for (let o = 0; o < N; o++) while (pend[o].length) st[o] = NEW.applyOps(st[o], clone(pend[o].splice(rng.int(pend[o].length), 1)[0])).db;
      // chaque appareil refait ensuite une modification quelconque de chaque dossier (reçue par tous)
      for (let d = 0; d < N; d++) {
        tick(2000);
        const ops = send(d, { ...st[d], clients: st[d].clients.map(c => ({ ...c, telephone: `t${d}`, _lastModified: nowIso() })) });
        for (let o = 0; o < N; o++) if (o !== d) st[o] = NEW.applyOps(st[o], clone(ops)).db;
      }
      const key = (x) => JSON.stringify(stripSyncMeta(x.clients.map(c => c.sitePlans)));
      for (let o = 1; o < N; o++) assert.equal(key(st[o]), key(st[0]), `N=${N} seed=${s} appareil=${o}`);
    }
  }
});

test('filet de sécurité : si la fusion ou le datage échouait, on retombe sur l\'ancien comportement (jamais de blocage)', async () => {
  const { safeMergeSitePlans, safeStampClientForSync, safeMergeTombstones } = await import('../src/utils/sitePlanSync.js');
  const boom = new Proxy([], { get(t, k) { if (k === 'length' || k === 'map' || typeof k === 'symbol') throw new Error('boom'); return Reflect.get(t, k); } });
  const good = [{ id: 'p', floors: [] }];
  const quiet = console.warn; console.warn = () => {};
  try {
    assert.equal(safeMergeSitePlans(good, boom, true), boom);
    assert.equal(safeMergeSitePlans(good, boom, false), good);
    const client = { id: 'c', sitePlans: boom };
    assert.equal(safeStampClientForSync({ id: 'c', sitePlans: good }, client, 1), client);
  } finally { console.warn = quiet; }
  assert.deepEqual(safeMergeTombstones({ a: 1 }, undefined), { a: 1 });
  assert.deepEqual(safeMergeTombstones({}, {}), {});
});

test('horloge d\'un appareil en retard (cas réel : 1 h 34 et jusqu\'à 31 h) : ses saisies passent quand même', () => {
  // Constat sur l'historique réel : ~7 % des opérations viennent d'appareils dont l'horloge retarde de plus d'une heure.
  const run = (impl) => {
    const { db, ids } = seed();
    const net = network(impl, db, ['bureau', 'tablette']);
    // le bureau saisit une cote ; la tablette la reçoit (elle est à jour)
    const p1 = net.edit('bureau', editVoid('CLI-5808', ids[0], { L: 1500, H: 1300 }));
    net.deliver(p1, 'tablette');
    // la tablette, dont l'horloge retarde de 2 h, corrige la cote et valide
    const realNow = Date.now; const saved = Date.now();
    Date.now = () => saved - 2 * 3600 * 1000;
    let p2;
    try {
      const before = net.dev.tablette;
      const after = editVoid('CLI-5808', ids[0], { L: 1512, H: 1308, measurementsValidated: true })(before);
      const ops = tagOps(impl.generateOps(before, after), 'tablette');
      net.dev.tablette = impl.applyOps(after, ops).db;
      p2 = { from: 'tablette', ops: clone(ops) };
    } finally { Date.now = realNow; }
    net.deliver(p2, 'bureau');
    return { net, ids };
  };
  const old = run(OLD);
  assert.equal(findVoid(old.net.dev.bureau, 'CLI-5808', old.ids[0]).L, 1500, 'ancien moteur : la correction de la tablette était ignorée par le bureau');
  const { net, ids } = run(NEW);
  assert.equal(findVoid(net.dev.bureau, 'CLI-5808', ids[0]).L, 1512);
  assert.equal(findVoid(net.dev.bureau, 'CLI-5808', ids[0]).measurementsValidated, true);
  assert.equal(findVoid(net.dev.tablette, 'CLI-5808', ids[0]).L, 1512);
  // puis le bureau re-modifie : sa version (basée sur celle de la tablette) gagne partout
  const p3 = net.edit('bureau', editVoid('CLI-5808', ids[0], { wallDepth: 280 }));
  net.deliver(p3, 'tablette');
  for (const n of ['bureau', 'tablette']) {
    assert.equal(findVoid(net.dev[n], 'CLI-5808', ids[0]).wallDepth, 280, n);
    assert.equal(findVoid(net.dev[n], 'CLI-5808', ids[0]).L, 1512, n);
  }
});

test('horloge en retard : une suppression et un nouvel ajout passent aussi', () => {
  const old = { id: 'c', sitePlans: [{ id: 'p', floors: [{ id: 'f', apartments: [{ id: 'a', voids: [{ id: 'v1', L: 1, [SYNC_TS]: 9000 }, { id: 'v2', L: 2, [SYNC_TS]: 9000 }] }] }] }] };
  const next = clone(old); next.sitePlans[0].floors[0].apartments[0].voids = [{ id: 'v2', L: 22, [SYNC_TS]: 9000 }];
  const s = stampClientForSync(old, next, 100); // « maintenant » = 100, très en retard sur 9000
  const apt = s.sitePlans[0].floors[0].apartments[0];
  assert.equal(apt.voids[0][SYNC_TS], 9001, 'modification datée juste après la version remplacée');
  assert.deepEqual(apt[SYNC_DEL], { v1: 9001 }, 'suppression datée juste après la version supprimée');
  const merged = mergeSitePlans(old.sitePlans, s.sitePlans, false).plans[0].floors[0].apartments[0];
  assert.deepEqual(merged.voids.map(v => [v.id, v.L]), [['v2', 22]], 'appliqué même si le dossier reçu paraît « plus vieux »');
  // ré-ajout local d'un élément supprimé : il survit à la trace de suppression
  const readd = clone(s); readd.sitePlans[0].floors[0].apartments[0].voids.push({ id: 'v1', L: 1 });
  const s2 = stampClientForSync(s, readd, 100);
  assert.equal(s2.sitePlans[0].floors[0].apartments[0].voids[1][SYNC_TS], 9002);
  assert.deepEqual(mergeSitePlans(s.sitePlans, s2.sitePlans, false).plans[0].floors[0].apartments[0].voids.map(v => v.id), ['v2', 'v1']);
});
