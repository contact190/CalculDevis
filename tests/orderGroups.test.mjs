import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOrdersForWorkshop, isHistoryStatus } from '../src/utils/orderGroups.js';

const lot = (createdAt, extra = {}) => ({ id: `B-${createdAt}`, createdAt, items: [], ...extra });

test('atelier : les commandes en production passent en tête, la plus récemment lancée d\'abord', () => {
  const orders = [
    { id: 'CMD-1', status: 'Confirmé', batches: [] },
    { id: 'CMD-2', status: 'PARTIEL_PRODUCTION', batches: [lot('2026-10-01T08:00:00Z')] },
    { id: 'CMD-3', status: 'Terminé / Historique', batches: [lot('2026-11-10T08:00:00Z')] },
    { id: 'CMD-4', status: 'En Fabrication', batches: [lot('2026-09-01T08:00:00Z'), lot('2026-11-12T08:00:00Z')] },
    { id: 'CMD-5', status: 'Confirmé' },
    { id: 'CMD-6', status: 'Confirmé', batches: [lot('2026-11-05T08:00:00Z')] }, // statut pas à jour mais un lot est lancé
  ];
  const g = groupOrdersForWorkshop(orders);
  assert.deepEqual(g.active.map(o => o.id), ['CMD-4', 'CMD-6', 'CMD-2']);
  assert.deepEqual(g.pending.map(o => o.id), ['CMD-1', 'CMD-5']);
  assert.deepEqual(g.history.map(o => o.id), ['CMD-3']);
});

test('atelier : un lot supprimé ne rend pas la commande active ; aucune commande ne disparaît de la liste', () => {
  const orders = [
    { id: 'CMD-62', status: 'Confirmé', batches: [lot('2026-11-12T07:05:06Z', { _deleted: true })] },
    { id: 'CMD-7', status: 'PARTIEL_PRODUCTION', batches: [lot('x-date-invalide'), lot('2026-01-01T00:00:00Z', { _deleted: true })] },
    { id: 'CMD-8', status: 'Livré', batches: [] },
    { id: 'CMD-9', status: '  ANNULÉE ' },
    null,
  ];
  const g = groupOrdersForWorkshop(orders);
  assert.deepEqual(g.active.map(o => o.id), ['CMD-7']);
  assert.deepEqual(g.pending.map(o => o.id), ['CMD-62']);
  assert.deepEqual(g.history.map(o => o.id), ['CMD-8', 'CMD-9']);
  assert.equal(g.active.length + g.pending.length + g.history.length, 4);
  assert.deepEqual(groupOrdersForWorkshop(undefined), { active: [], pending: [], history: [] });
  assert.equal(isHistoryStatus('Terminé / Historique'), true);
  assert.equal(isHistoryStatus('PARTIEL_PRODUCTION'), false);
});

test('atelier : à date de lot égale ou absente, l\'ordre d\'origine est conservé', () => {
  const orders = [
    { id: 'A', status: 'PARTIEL_PRODUCTION', batches: [lot('2026-11-01T00:00:00Z')] },
    { id: 'B', status: 'PARTIEL_PRODUCTION', batches: [{ id: 'sans-date' }] },
    { id: 'C', status: 'PARTIEL_PRODUCTION', batches: [lot('2026-11-01T00:00:00Z')] },
    { id: 'D', status: 'PARTIEL_PRODUCTION', batches: [{ id: 'sans-date-2' }] },
  ];
  assert.deepEqual(groupOrdersForWorkshop(orders).active.map(o => o.id), ['A', 'C', 'B', 'D']);
});
