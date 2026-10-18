/**
 * Utilitaires pour le calcul et l'affichage des totaux de devis (Menuiserie & Shop).
 */

export const getQuoteTotals = (quote, quoteSettings = {}) => {
  if (!quote) return { ht: 0, ttc: 0, rawHT: 0, discountAmount: 0, tva: 0 };

  const items = quote.items || [];
  let rawHT = 0;
  let hasItemPrices = false;

  for (const item of items) {
    if (!item) continue;
    const qty = Number(item.qty) || 1;

    // 1. Devis Shop (totalHT pré-calculé sur l'article)
    if (typeof item.totalHT === 'number' && !isNaN(item.totalHT) && item.totalHT > 0) {
      rawHT += item.totalHT;
      hasItemPrices = true;
    }
    // 2. Article Menuiserie avec unitPriceHT direct
    else if (typeof item.unitPriceHT === 'number' && !isNaN(item.unitPriceHT) && item.unitPriceHT > 0) {
      rawHT += item.unitPriceHT * qty;
      hasItemPrices = true;
    }
    // 3. priceData.priceHT (snapshot chiffrage)
    else if (typeof item.priceData?.priceHT === 'number' && !isNaN(item.priceData.priceHT) && item.priceData.priceHT > 0) {
      rawHT += item.priceData.priceHT * qty;
      hasItemPrices = true;
    }
    // 4. item.price direct
    else if (typeof item.price === 'number' && !isNaN(item.price) && item.price > 0) {
      rawHT += item.price * qty;
      hasItemPrices = true;
    }
    // 5. Fallback via unitPriceTTC
    else if (typeof item.unitPriceTTC === 'number' && !isNaN(item.unitPriceTTC) && item.unitPriceTTC > 0) {
      const tvaRate = Number(quote.tvaRate ?? quoteSettings?.tvaRate ?? 19);
      rawHT += (item.unitPriceTTC / (1 + tvaRate / 100)) * qty;
      hasItemPrices = true;
    }
  }

  // Si on a des articles avec des prix calculables
  if (hasItemPrices && rawHT > 0) {
    const discountType = quote.discountType || 'percent';
    const discountValue = Number(quote.discountValue || 0);
    let discountAmount = 0;

    if (discountType === 'percent') {
      discountAmount = rawHT * (discountValue / 100);
    } else if (discountValue > 0) {
      discountAmount = Math.min(rawHT, discountValue);
    } else if (quote.totals?.discountAmount) {
      discountAmount = Math.min(rawHT, Number(quote.totals.discountAmount));
    } else if (quote.totals?.remise) {
      discountAmount = Math.min(rawHT, Number(quote.totals.remise));
    }

    const ht = Math.max(0, rawHT - discountAmount);
    const tvaRate = Number(quote.tvaRate ?? quoteSettings?.tvaRate ?? 19);
    const tva = ht * (tvaRate / 100);
    const ttc = ht + tva;
    return { rawHT, discountAmount, ht, tva, ttc };
  }

  // Fallback aux totals stockés si pas d'articles avec prix unitaires détectables
  if (quote.totals && typeof quote.totals.ht === 'number' && quote.totals.ht > 0) {
    const tvaRate = Number(quote.tvaRate ?? quoteSettings?.tvaRate ?? 19);
    return {
      rawHT: quote.totals.rawHT ?? quote.totals.ht,
      discountAmount: quote.totals.discountAmount ?? quote.totals.remise ?? 0,
      ht: quote.totals.ht,
      tva: quote.totals.tva ?? (quote.totals.ht * (tvaRate / 100)),
      ttc: quote.totals.ttc ?? (quote.totals.ht * (1 + tvaRate / 100))
    };
  }

  return { ht: 0, ttc: 0, rawHT: 0, discountAmount: 0, tva: 0 };
};
