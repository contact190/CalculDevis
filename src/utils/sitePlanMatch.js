/**
 * Trouve le plan de chantier lié à une commande, par numéro de commande puis par devis.
 *
 * Ordre de priorité :
 *  1. Le plan qui porte exactement le numéro de la commande (p.orderId === order.id).
 *  2. Sinon, un plan issu du même devis (p.quoteId === order.quoteId) qui n'appartient
 *     pas déjà à une autre commande.
 *  3. Sinon, n'importe quel plan issu du même devis (comportement historique).
 *
 * Avant, les étapes 1 et 2 étaient mélangées dans un seul `find` : quand deux plans
 * venaient du même devis, le premier de la liste gagnait, même s'il n'était pas
 * celui de la commande (ex. CMD-62 qui affichait « maraval » au lieu de « maraval 2 »).
 *
 * Lecture seule : ne modifie jamais les plans.
 */
export function findPlanByOrderOrQuote(plans, order) {
  if (!order || !Array.isArray(plans)) return undefined;

  const byOrder = plans.find(p => p && order.id && p.orderId === order.id);
  if (byOrder) return byOrder;

  if (!order.quoteId) return undefined;
  const sameQuote = plans.filter(p => p && p.quoteId === order.quoteId);
  return sameQuote.find(p => !p.orderId) || sameQuote[0];
}
