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
