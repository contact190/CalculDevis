// Outil de vérification (hors suite de tests) : rejoue un export réel de operations_log (collection clients)
// sur l'ancien moteur (copie figée) et sur le nouveau, et compare.
//   node tests/tools/replayRealOps.mjs <dossier contenant clients_*.json>
// Les données réelles ne sont jamais ajoutées au dépôt.
import fs from 'node:fs';
import path from 'node:path';
import * as NEW from '../../src/utils/patchEngine.js';
import * as OLD from '../legacy/patchEngine.legacy.js';
import { smartMerge as newSmart } from '../../src/utils/smartMerge.js';
import { smartMerge as oldSmart } from '../legacy/smartMerge.legacy.js';
import { mergeSnapshotItems } from '../../src/utils/snapshotMerge.js';
import { makeRng } from '../helpers/syncSim.mjs';

const dir = process.argv[2];
const files = fs.readdirSync(dir).filter(f => /^clients_\d+\.json$/.test(f)).sort();
function* allOps() {
  for (const f of files) {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const r of rows) yield { op: r.op, collection: r.collection, id: r.doc_id, data: r.data, timestamp: r.timestamp, deviceId: r.device_id, created_at: r.created_at };
  }
}
const legacySnapshotMerge = (arrA, arrB) => {
  const map = new Map(); (arrA || []).forEach(i => { if (i && i.id) map.set(i.id, i); });
  (arrB || []).forEach(i => { if (!i || !i.id) return; const e = map.get(i.id); if (!e) map.set(i.id, i); else {
    const et = e._lastModified ? new Date(e._lastModified).getTime() : 0, it = i._lastModified ? new Date(i._lastModified).getTime() : 0; if (it >= et) map.set(i.id, i); } });
  return Array.from(map.values());
};
const sameClient = (a, b, id) => JSON.stringify((a.clients || []).find(c => c && c.id === id)) === JSON.stringify((b.clients || []).find(c => c && c.id === id));

const R = 5; // récepteur 0 : reçoit tout dans l'ordre ; les autres : pertes (30 %) + désordre
const rng = makeRng(20261111);
const recv = Array.from({ length: R }, () => ({ o: { clients: [] }, n: { clients: [] }, buf: [] }));
let total = 0, applied = 0, mismatches = 0, tOld = 0, tNew = 0, snapChecks = 0, maxNew = 0;
const apply = (r, op) => {
  let t = process.hrtime.bigint(); const o = OLD.applyOps(r.o, [op]).db; tOld += Number(process.hrtime.bigint() - t);
  t = process.hrtime.bigint(); const n = NEW.applyOps(r.n, [op]).db; const dt = Number(process.hrtime.bigint() - t); tNew += dt; if (dt > maxNew) maxNew = dt;
  r.o = o; r.n = n; applied++;
  if (!sameClient(o, n, op.id)) { mismatches++; if (mismatches <= 5) console.log('DIFFÉRENCE', op.id, op.created_at, op.deviceId); }
};
for (const op of allOps()) {
  total++;
  apply(recv[0], op);
  for (let i = 1; i < R; i++) {
    if (rng.chance(0.3)) continue;               // opération jamais reçue par cet appareil
    recv[i].buf.push(op);
    while (recv[i].buf.length > 20) apply(recv[i], recv[i].buf.splice(rng.int(recv[i].buf.length), 1)[0]);
  }
  if (total % 400 === 0) {                       // rechargements complets croisés
    for (let i = 0; i < R; i++) {
      const j = (i + 1) % R;
      const a = JSON.stringify(newSmart(recv[i].n, recv[j].n)), b = JSON.stringify(oldSmart(recv[i].o, recv[j].o));
      const c = JSON.stringify(mergeSnapshotItems(recv[i].n.clients, recv[j].n.clients)), d = JSON.stringify(legacySnapshotMerge(recv[i].o.clients, recv[j].o.clients));
      snapChecks += 2; if (a !== b || c !== d) { mismatches++; console.log('DIFFÉRENCE rechargement', total, i, j); }
    }
  }
}
for (let i = 1; i < R; i++) while (recv[i].buf.length) apply(recv[i], recv[i].buf.splice(rng.int(recv[i].buf.length), 1)[0]);
for (let i = 0; i < R; i++) if (JSON.stringify(recv[i].o) !== JSON.stringify(recv[i].n)) { mismatches++; console.log('DIFFÉRENCE état final récepteur', i); }
const voids = recv[0].n.clients.reduce((s, c) => s + (c.sitePlans || []).reduce((s2, p) => s2 + (p.floors || []).reduce((s3, f) => s3 + (f.apartments || []).reduce((s4, a) => s4 + (a.voids || []).length, 0), 0), 0), 0);
console.log(JSON.stringify({ operationsReelles: total, applications: applied, rechargementsCompares: snapChecks, clients: recv[0].n.clients.length, ouvertures: voids, differences: mismatches, msAncien: Math.round(tOld / 1e6), msNouveau: Math.round(tNew / 1e6), msMaxParOperationNouveau: Math.round(maxNew / 1e5) / 10 }));
process.exit(mismatches ? 1 : 0);
