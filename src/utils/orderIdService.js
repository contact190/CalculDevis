import { supabase } from './supabaseClient';

/**
 * Service centralisé pour générer le prochain numéro officiel de commande (CMD-...)
 * Vérifie à la fois la base locale et le Cloud Supabase pour éviter les doublons multi-appareils.
 */
export async function fetchLatestMaxOrderNumber(localOrders = []) {
  let maxNum = 0;

  // 1. Extraire le max des commandes locales
  for (const o of localOrders) {
    if (o && o.id && String(o.id).startsWith('CMD-')) {
      const n = parseInt(String(o.id).replace('CMD-', ''), 10);
      if (!isNaN(n) && n < 70000 && n > maxNum) {
        maxNum = n;
      }
    }
  }

  // 2. Interroger Supabase en direct pour vérifier si un autre appareil a créé une commande récemment
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const { data: recentOps, error } = await supabase
      .from('operations_log')
      .select('doc_id, data')
      .order('id', { ascending: false })
      .limit(30)
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);

    if (!error && Array.isArray(recentOps)) {
      for (const row of recentOps) {
        const idToCheck = row.doc_id || row.data?.id;
        if (idToCheck && String(idToCheck).startsWith('CMD-')) {
          const n = parseInt(String(idToCheck).replace('CMD-', ''), 10);
          if (!isNaN(n) && n < 70000 && n > maxNum) {
            maxNum = n;
          }
        }
      }
    }
  } catch (err) {
    // Si timeout ou offline, fallback sur maxNum local
    console.warn("Vérification Cloud orderId (mode fallback):", err);
  }

  return maxNum;
}

export function computeNextOrderId(maxNum, existingOrders = []) {
  let candidate = (maxNum || 0) + 1;
  let candidateId = `CMD-${candidate}`;
  while (existingOrders.some(o => o && o.id === candidateId)) {
    candidate++;
    candidateId = `CMD-${candidate}`;
  }
  return candidateId;
}
