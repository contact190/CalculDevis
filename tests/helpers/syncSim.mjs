// Outils de simulation pour les tests de synchronisation (plusieurs appareils, horloge contrôlée).

export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

// Horloge contrôlée : patchEngine lit Date.now()
const realNow = Date.now;
let clock = Date.parse('2026-11-01T08:00:00.000Z');
export const installClock = () => { Date.now = () => clock; };
export const restoreClock = () => { Date.now = realNow; };
export const tick = (ms = 1000) => { clock += ms; return clock; };
export const nowIso = () => new Date(clock).toISOString();

export const clone = (x) => JSON.parse(JSON.stringify(x));

const META = new Set(['_syncTs', '_syncDel', '_syncDelPlans']);
/** Retire les métadonnées de synchro (nouvelles) pour comparer au comportement historique. */
export function stripSyncMeta(x) {
  if (Array.isArray(x)) return x.map(stripSyncMeta);
  if (x && typeof x === 'object') {
    const o = {};
    for (const k of Object.keys(x)) {
      if (META.has(k)) continue;
      if (x[k] === undefined) continue;
      o[k] = stripSyncMeta(x[k]);
    }
    return o;
  }
  return x;
}

/** Vrai si un objet contient une métadonnée de synchro quelque part. */
export function hasSyncMeta(x) {
  if (Array.isArray(x)) return x.some(hasSyncMeta);
  if (x && typeof x === 'object') {
    return Object.keys(x).some(k => META.has(k) || hasSyncMeta(x[k]));
  }
  return false;
}

// ─── Fabrique de données réalistes (mêmes formes que la base réelle) ───
export function makeIdGen(prefix = '') {
  let n = 0;
  return (kind) => `${kind}-${prefix}${++n}`;
}

export const mkVoid = (id, itemId = 'ITEM-1', extra = {}) => ({
  id, name: '', itemId, L: '', H: '', wallDepth: '', handleHeight: 'Axé (fenêtre)',
  measurementsValidated: false, productionLaunched: false, partOverrides: {}, ...extra,
});

export function mkPlan(gen, { floors = 2, apts = 2, voids = 3, name = 'Plan', extra = {} } = {}) {
  return {
    id: gen('plan'), name, ...extra,
    floors: Array.from({ length: floors }, (_, fi) => ({
      id: gen('floor'), name: `${fi + 1}`,
      apartments: Array.from({ length: apts }, (_, ai) => ({
        id: gen('apt'), name: String.fromCharCode(65 + ai),
        voids: Array.from({ length: voids }, () => mkVoid(gen('void'), 'ITEM-1', { L: 1600, H: 1500 })),
      })),
    })),
  };
}

export function mkDb(gen) {
  return {
    clients: [
      { id: 'CLI-1', nom: 'Client A', telephone: '0550', sitePlans: [mkPlan(gen, { name: 'Plan 1' }), mkPlan(gen, { name: 'Plan 2', floors: 1 })], _lastModified: nowIso() },
      { id: 'CLI-2', nom: 'Client B', telephone: '0660', sitePlans: [mkPlan(gen, { name: 'Villa', floors: 1, apts: 1 })], _lastModified: nowIso() },
      { id: 'CLI-3', nom: 'Sans plan', sitePlans: [], _lastModified: nowIso() },
    ],
    orders: [
      { id: 'CMD-1', clientId: 'CLI-1', status: 'Confirmé', items: [{ id: 'ITEM-1', label: 'Produit 1', siteMeasurements: [] }], batches: [], unitStatusesDual: {}, fieldNotes: { a: 'x' }, _lastModified: nowIso() },
      { id: 'CMD-2', clientId: 'CLI-2', status: 'Confirmé', items: [{ id: 'ITEM-1', label: 'Produit 1' }], batches: [], _lastModified: nowIso() },
    ],
    quotes: [
      { id: 'DEV-1', clientId: 'CLI-1', status: 'Brouillon', items: [{ id: 'A', qty: 1 }], _lastModified: nowIso() },
    ],
    colors: [{ id: 'col-1', name: 'Blanc' }, { id: 'col-2', name: 'Gris' }],
    quoteSettings: { tva: 19, note: 'x' },
  };
}

// ─── Modifications aléatoires (immuables, comme dans l'application) ───
const mapClient = (db, cid, fn) => ({ ...db, clients: db.clients.map(c => (c.id === cid ? fn(c) : c)) });
const mapPlan = (db, cid, pid, fn) => mapClient(db, cid, c => ({ ...c, sitePlans: c.sitePlans.map(p => (p.id === pid ? fn(p) : p)), _lastModified: nowIso() }));
const mapFloor = (db, cid, pid, fid, fn) => mapPlan(db, cid, pid, p => ({ ...p, floors: p.floors.map(f => (f.id === fid ? fn(f) : f)) }));
const mapApt = (db, cid, pid, fid, aid, fn) => mapFloor(db, cid, pid, fid, f => ({ ...f, apartments: f.apartments.map(a => (a.id === aid ? fn(a) : a)) }));
const mapVoid = (db, cid, pid, fid, aid, vid, fn) => mapApt(db, cid, pid, fid, aid, a => ({ ...a, voids: a.voids.map(v => (v.id === vid ? fn(v) : v)) }));

function pickPath(db, rng) {
  const clients = db.clients.filter(c => (c.sitePlans || []).length > 0);
  if (!clients.length) return null;
  const c = rng.pick(clients); const p = rng.pick(c.sitePlans);
  const f = p.floors.length ? rng.pick(p.floors) : null;
  const a = f && f.apartments.length ? rng.pick(f.apartments) : null;
  const v = a && a.voids.length ? rng.pick(a.voids) : null;
  return { c, p, f, a, v };
}

export const PLAN_EDITS = {
  setCote(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.v) return db;
    const field = rng.pick(['L', 'H', 'wallDepth']);
    return mapVoid(db, t.c.id, t.p.id, t.f.id, t.a.id, t.v.id, v => ({ ...v, [field]: 1000 + rng.int(1500) }));
  },
  validate(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.v) return db;
    return mapVoid(db, t.c.id, t.p.id, t.f.id, t.a.id, t.v.id, v => ({ ...v, measurementsValidated: !v.measurementsValidated }));
  },
  launch(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.v) return db;
    return mapVoid(db, t.c.id, t.p.id, t.f.id, t.a.id, t.v.id, v => ({ ...v, measurementsValidated: true, productionLaunched: true }));
  },
  override(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.v) return db;
    return mapVoid(db, t.c.id, t.p.id, t.f.id, t.a.id, t.v.id, v => ({ ...v, partOverrides: { ...(v.partOverrides || {}), p1: { qty: rng.int(5) } } }));
  },
  addVoid(db, rng, gen) {
    const t = pickPath(db, rng); if (!t || !t.a) return db;
    return mapApt(db, t.c.id, t.p.id, t.f.id, t.a.id, a => ({ ...a, voids: [...a.voids, mkVoid(gen('void'))] }));
  },
  removeVoid(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.v) return db;
    return mapApt(db, t.c.id, t.p.id, t.f.id, t.a.id, a => ({ ...a, voids: a.voids.filter(v => v.id !== t.v.id) }));
  },
  swapVoids(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.a || t.a.voids.length < 2) return db;
    return mapApt(db, t.c.id, t.p.id, t.f.id, t.a.id, a => { const vs = [...a.voids]; [vs[0], vs[vs.length - 1]] = [vs[vs.length - 1], vs[0]]; return { ...a, voids: vs }; });
  },
  addApt(db, rng, gen) {
    const t = pickPath(db, rng); if (!t || !t.f) return db;
    return mapFloor(db, t.c.id, t.p.id, t.f.id, f => ({ ...f, apartments: [...f.apartments, { id: gen('apt'), name: 'Z', voids: [mkVoid(gen('void'))] }] }));
  },
  removeApt(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.a) return db;
    return mapFloor(db, t.c.id, t.p.id, t.f.id, f => ({ ...f, apartments: f.apartments.filter(a => a.id !== t.a.id) }));
  },
  renameApt(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.a) return db;
    return mapApt(db, t.c.id, t.p.id, t.f.id, t.a.id, a => ({ ...a, name: `N${rng.int(99)}` }));
  },
  addFloor(db, rng, gen) {
    const t = pickPath(db, rng); if (!t) return db;
    return mapPlan(db, t.c.id, t.p.id, p => ({ ...p, floors: [...p.floors, { id: gen('floor'), name: `${p.floors.length + 1}`, apartments: [] }] }));
  },
  duplicateFloor(db, rng, gen) {
    const t = pickPath(db, rng); if (!t || !t.f) return db;
    const cl = clone(t.f); cl.id = gen('floor'); cl.name = `${t.f.name} (copie)`;
    cl.apartments = cl.apartments.map(a => ({ ...a, id: gen('apt'), voids: a.voids.map(v => ({ ...v, id: gen('void'), productionLaunched: false })) }));
    return mapPlan(db, t.c.id, t.p.id, p => { const fs = [...p.floors]; fs.splice(fs.findIndex(f => f.id === t.f.id) + 1, 0, cl); return { ...p, floors: fs }; });
  },
  removeFloor(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.f) return db;
    return mapPlan(db, t.c.id, t.p.id, p => ({ ...p, floors: p.floors.filter(f => f.id !== t.f.id) }));
  },
  renameFloor(db, rng) {
    const t = pickPath(db, rng); if (!t || !t.f) return db;
    return mapFloor(db, t.c.id, t.p.id, t.f.id, f => ({ ...f, name: `E${rng.int(99)}` }));
  },
  renamePlan(db, rng) {
    const t = pickPath(db, rng); if (!t) return db;
    return mapPlan(db, t.c.id, t.p.id, p => ({ ...p, name: `Plan ${rng.int(999)}` }));
  },
  linkPlan(db, rng) {
    const t = pickPath(db, rng); if (!t) return db;
    return mapPlan(db, t.c.id, t.p.id, p => (p.orderId ? (({ orderId, ...rest }) => rest)(p) : { ...p, orderId: 'CMD-1', quoteId: 'DEV-1', _lastModified: nowIso() }));
  },
  addPlan(db, rng, gen) {
    const c = rng.pick(db.clients);
    return mapClient(db, c.id, cl => ({ ...cl, sitePlans: [...(cl.sitePlans || []), mkPlan(gen, { name: 'Nouveau', floors: 1, apts: 1, voids: 2 })], _lastModified: nowIso() }));
  },
  removePlan(db, rng) {
    const t = pickPath(db, rng); if (!t) return db;
    return mapClient(db, t.c.id, cl => ({ ...cl, sitePlans: cl.sitePlans.filter(p => p.id !== t.p.id), _lastModified: nowIso() }));
  },
};

export const OTHER_EDITS = {
  clientScalar(db, rng) {
    const c = rng.pick(db.clients);
    return mapClient(db, c.id, cl => ({ ...cl, telephone: `0${rng.int(999999)}`, _lastModified: nowIso() }));
  },
  orderStatus(db, rng) {
    const o = rng.pick(db.orders);
    return { ...db, orders: db.orders.map(x => (x.id === o.id ? { ...x, status: rng.pick(['Confirmé', 'PARTIEL_PRODUCTION', 'Livré']) } : x)) };
  },
  orderItems(db, rng) {
    const o = rng.pick(db.orders);
    return { ...db, orders: db.orders.map(x => (x.id === o.id ? { ...x, items: x.items.map(i => ({ ...i, siteMeasurements: [{ id: `m${rng.int(99)}`, L: rng.int(2000) }] })) } : x)) };
  },
  orderAddBatch(db, rng, gen) {
    const o = rng.pick(db.orders);
    return { ...db, orders: db.orders.map(x => (x.id === o.id ? { ...x, batches: [...(x.batches || []), { id: gen('BATCH'), name: 'Lot', items: [], _lastModified: nowIso() }] } : x)) };
  },
  orderEditBatch(db, rng) {
    const os = db.orders.filter(o => (o.batches || []).length); if (!os.length) return db;
    const o = rng.pick(os); const b = rng.pick(o.batches);
    return { ...db, orders: db.orders.map(x => (x.id === o.id ? { ...x, batches: x.batches.map(y => (y.id === b.id ? { ...y, name: `Lot ${rng.int(99)}`, _deleted: rng.chance(0.3) ? true : y._deleted, _lastModified: nowIso() } : y)) } : x)) };
  },
  orderDict(db, rng) {
    const o = rng.pick(db.orders);
    return { ...db, orders: db.orders.map(x => (x.id === o.id ? { ...x, unitStatusesDual: { ...(x.unitStatusesDual || {}), [`u${rng.int(5)}`]: rng.pick(['a', 'b']) }, fieldNotes: { ...(x.fieldNotes || {}), [`n${rng.int(3)}`]: 'note' } } : x)) };
  },
  quoteAdd(db, rng, gen) {
    return { ...db, quotes: [...db.quotes, { id: gen('DEV'), clientId: 'CLI-1', status: 'Brouillon', items: [] }] };
  },
  quoteItems(db, rng) {
    if (!db.quotes.length) return db; const q = rng.pick(db.quotes);
    return { ...db, quotes: db.quotes.map(x => (x.id === q.id ? { ...x, items: [...(x.items || []), { id: `I${rng.int(999)}`, qty: 1 }].slice(-3) } : x)) };
  },
  quoteDelete(db, rng) {
    const live = db.quotes.filter(q => !q._deleted); if (live.length < 2) return db; const q = rng.pick(live);
    return { ...db, quotes: db.quotes.filter(x => x.id !== q.id) };
  },
  colorEdit(db, rng) {
    const c = rng.pick(db.colors);
    return { ...db, colors: db.colors.map(x => (x.id === c.id ? { ...x, name: `C${rng.int(99)}` } : x)) };
  },
  settings(db, rng) {
    return { ...db, quoteSettings: { ...db.quoteSettings, tva: rng.int(25) } };
  },
};

export function randomEdit(db, rng, gen, table) {
  const names = Object.keys(table);
  return table[rng.pick(names)](db, rng, gen);
}

/** Normalise les opérations pour comparer deux implémentations (identifiant d'appareil fixe). */
export function tagOps(ops, deviceId) {
  return ops.map(op => ({
    ...op, deviceId,
    data: op.data && typeof op.data === 'object' && !Array.isArray(op.data) && op.op !== 'replace_key'
      ? { ...op.data, _modifiedBy: deviceId } : op.data,
  }));
}
