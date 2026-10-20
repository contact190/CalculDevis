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

export const generateNextQuoteNumber = (settings, db) => {
  let counter = settings?.quoteCounter || 1;
  const prefix = settings?.quotePrefix || 'DEV-';
  const quotes = db?.quotes || [];
  for (const q of quotes) {
    if (q && q.number && q.number.startsWith(prefix)) {
      const numPart = q.number.substring(prefix.length).split('-')[0].split(' ')[0];
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed >= counter) {
        counter = parsed + 1;
      }
    }
  }
  return `${prefix}${String(counter).padStart(3, '0')}`;
};

export const isQuoteLocked = (quote, orders = []) => {
  if (!quote) return false;
  if (quote.status === 'Figé' || quote.status === 'Confirmé') return true;
  if ((orders || []).some(o => o.quoteId === quote.id)) return true;
  return false;
};

/**
 * Vérifie si la cote réelle d'une ouverture s'écarte de plus de 100 mm par rapport à la cote devis.
 * Seuil critique : > 100 mm en largeur (L) ou en hauteur (H).
 */
export const checkVoidCriticalDelta = (v, item) => {
  if (!v || !item || !item.config) {
    return { isCritical: false, isCriticalL: false, isCriticalH: false, deltaL: 0, deltaH: 0, quoteL: 0, quoteH: 0, realL: 0, realH: 0 };
  }
  const quoteL = parseFloat(item.config.L) || 0;
  const quoteH = parseFloat(item.config.H) || 0;
  const realL = v.L !== undefined && v.L !== '' ? parseFloat(v.L) : quoteL;
  const realH = v.H !== undefined && v.H !== '' ? parseFloat(v.H) : quoteH;
  const deltaL = Math.round(realL - quoteL);
  const deltaH = Math.round(realH - quoteH);
  const isCriticalL = Math.abs(deltaL) > 100;
  const isCriticalH = Math.abs(deltaH) > 100;
  return {
    isCritical: isCriticalL || isCriticalH,
    isCriticalL,
    isCriticalH,
    deltaL,
    deltaH,
    quoteL,
    quoteH,
    realL,
    realH
  };
};

