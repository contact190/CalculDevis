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

/**
 * Index « id d'ouverture → repère de chantier » (ex. 1A1, 2B3) sur tous les plans d'un client.
 * Le plan de la commande passe en premier ; les autres plans du client servent de secours.
 * Même formule que le portail technicien : étage + appartement + rang de l'ouverture.
 * Sert uniquement à l'affichage (fiches de coupe) : ne modifie rien, n'entre dans aucun calcul.
 */
export function buildVoidRepereIndex(plans, order) {
  const index = new Map();
  if (!Array.isArray(plans)) return index;
  const linked = order
    ? ((order.sitePlanId && plans.find(p => p && p.id === order.sitePlanId)) || findPlanByOrderOrQuote(plans, order))
    : undefined;
  const ordered = linked ? [linked, ...plans.filter(p => p !== linked)] : plans;
  for (const p of ordered) {
    for (const f of (p?.floors || [])) {
      for (const a of (f?.apartments || [])) {
        (a?.voids || []).forEach((v, i) => {
          if (v && v.id != null && !index.has(v.id)) index.set(v.id, `${f.name}${a.name}${i + 1}`);
        });
      }
    }
  }
  return index;
}
