import test from 'node:test';
import assert from 'node:assert/strict';
import { findPlanByOrderOrQuote } from '../src/utils/sitePlanMatch.js';

const Q = 'QUOTE-1792406412827';
const oldPlan = { id: 'plan-old', name: "maraval", orderId: undefined, quoteId: Q };
const newPlan = { id: 'plan-new', name: "maraval 2", orderId: 'CMD-62', quoteId: Q };

test('CMD-62 : le plan portant le numéro de commande gagne, même s\'il est après', () => {
  assert.equal(findPlanByOrderOrQuote([oldPlan, newPlan], { id: 'CMD-62', quoteId: Q }), newPlan);
});

test('sans plan au numéro de commande, on retombe sur le devis (comportement historique)', () => {
  assert.equal(findPlanByOrderOrQuote([oldPlan], { id: 'CMD-99', quoteId: Q }), oldPlan);
});

test('par devis, on évite un plan déjà attribué à une autre commande', () => {
  assert.equal(findPlanByOrderOrQuote([newPlan, oldPlan], { id: 'CMD-99', quoteId: Q }), oldPlan);
});

test('si seul un plan d\'une autre commande a le devis, on le garde (pas de perte d\'affichage)', () => {
  assert.equal(findPlanByOrderOrQuote([newPlan], { id: 'CMD-99', quoteId: Q }), newPlan);
});

test('rien ne correspond → undefined, sans planter', () => {
  assert.equal(findPlanByOrderOrQuote([{ id: 'x' }], { id: 'CMD-1' }), undefined);
  assert.equal(findPlanByOrderOrQuote(undefined, { id: 'CMD-1' }), undefined);
  assert.equal(findPlanByOrderOrQuote([oldPlan], null), undefined);
});

test('ne modifie pas les plans', () => {
  const plans = [oldPlan, newPlan];
  const snap = JSON.stringify(plans);
  findPlanByOrderOrQuote(plans, { id: 'CMD-62', quoteId: Q });
  assert.equal(JSON.stringify(plans), snap);
});

// ─── Repères de chantier sur les fiches de coupe ───
import { buildVoidRepereIndex } from '../src/utils/sitePlanMatch.js';

const mkPlanR = (id, extra, floors) => ({ id, ...extra, floors: floors.map(([fname, apts]) => ({ id: `${id}-f${fname}`, name: fname, apartments: apts.map(([aname, vids]) => ({ id: `${id}-${fname}${aname}`, name: aname, voids: vids.map(v => ({ id: v, name: '' })) })) })) });

test('fiche de coupe : le repère (1A1, 2B3…) est retrouvé quand le plan est lié par le numéro de commande', () => {
  const oldPlan = mkPlanR('plan-old', { quoteId: Q }, [['1', [['A', ['o1', 'o2']]]]]);
  const newPlanR = mkPlanR('plan-new', { orderId: 'CMD-62', quoteId: Q }, [['1', [['A', ['v1', 'v2']], ['B', ['v3']]]], ['2', [['B', ['v4', 'v5', 'v6']]]]]);
  const idx = buildVoidRepereIndex([oldPlan, newPlanR], { id: 'CMD-62', quoteId: Q }); // commande sans sitePlanId
  assert.equal(idx.get('v1'), '1A1');
  assert.equal(idx.get('v2'), '1A2');
  assert.equal(idx.get('v3'), '1B1');
  assert.equal(idx.get('v6'), '2B3');
});

test('fiche de coupe : sitePlanId reste prioritaire ; les autres plans du client servent de secours', () => {
  const a = mkPlanR('plan-a', {}, [['1', [['A', ['x1']]]]]);
  const b = mkPlanR('plan-b', {}, [['7', [['C', ['x1', 'y1']]]]]);
  assert.equal(buildVoidRepereIndex([a, b], { id: 'CMD-1', sitePlanId: 'plan-b' }).get('x1'), '7C1');
  assert.equal(buildVoidRepereIndex([a, b], { id: 'CMD-1' }).get('y1'), '7C2', 'plan sans aucun lien : retrouvé par l\'id de l\'ouverture');
  assert.equal(buildVoidRepereIndex([a, b], { id: 'CMD-1' }).get('inconnu'), undefined);
  assert.equal(buildVoidRepereIndex(undefined, { id: 'CMD-1' }).size, 0);
  assert.equal(buildVoidRepereIndex([a, null, { id: 'p', floors: [{ name: '1' }] }], null).get('x1'), '1A1');
});
