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
 * Vérifie si la cote réelle d'une ouverture s'écarte des cotes devis.
 * - Seuil critique bloquant (+10 cm / > +100 mm) : Bloque la validation et le passage en fabrication (devis à refaire).
 * - Seuil alerte non-bloquant (-10 cm / < -100 mm) : Alerte visuelle (champ rouge, message d'avertissement), mais saisie et validation autorisées.
 */
export const checkVoidCriticalDelta = (v, item) => {
  if (!v || !item || !item.config) {
    return { 
      isCritical: false, isCriticalL: false, isCriticalH: false, 
      isWarning: false, isWarningL: false, isWarningH: false,
      hasDeltaIssue: false, hasDeltaIssueL: false, hasDeltaIssueH: false,
      deltaL: 0, deltaH: 0, quoteL: 0, quoteH: 0, realL: 0, realH: 0 
    };
  }
  const quoteL = parseFloat(item.config.L) || 0;
  const quoteH = parseFloat(item.config.H) || 0;
  const realL = v.L !== undefined && v.L !== '' ? parseFloat(v.L) : quoteL;
  const realH = v.H !== undefined && v.H !== '' ? parseFloat(v.H) : quoteH;
  const deltaL = Math.round(realL - quoteL);
  const deltaH = Math.round(realH - quoteH);

  // Écart supérieur à +10 cm (+100 mm) : BLOQUANT
  const isCriticalL = deltaL > 100;
  const isCriticalH = deltaH > 100;
  const isCritical = isCriticalL || isCriticalH;

  // Écart inférieur à -10 cm (-100 mm) : ALERTE NON BLOQUANTE (validation permise)
  const isWarningL = deltaL < -100;
  const isWarningH = deltaH < -100;
  const isWarning = isWarningL || isWarningH;

  return {
    isCritical,
    isCriticalL,
    isCriticalH,
    isWarning,
    isWarningL,
    isWarningH,
    hasDeltaIssue: isCritical || isWarning,
    hasDeltaIssueL: isCriticalL || isWarningL,
    hasDeltaIssueH: isCriticalH || isWarningH,
    deltaL,
    deltaH,
    quoteL,
    quoteH,
    realL,
    realH
  };
};

/**
 * Clone un plan de chantier pour un nouveau devis afin de garantir la règle 1 Plan = 1 Devis.
 * Préserve la structure architecturale (étages, appartements, noms des ouvertures)
 * mais réinitialise les identifiants, les cotes réelles mesurées et les statuts de fabrication.
 */
export const cloneSitePlanForNewQuote = (sourcePlan, oldItems = [], newItems = [], newQuoteId, newQuoteNumber) => {
  if (!sourcePlan) return null;

  const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  // Correspondance des identifiants d'articles
  const itemIdMap = {};
  oldItems.forEach((oldItem, idx) => {
    if (newItems[idx]) {
      itemIdMap[oldItem.id] = newItems[idx].id;
    }
  });

  const clonedPlanId = generateId('plan');
  const planName = newQuoteNumber 
    ? `${sourcePlan.name || 'Plan'} (Devis ${newQuoteNumber})`
    : `${sourcePlan.name || 'Plan'} (Copie)`;

  const clonedFloors = (sourcePlan.floors || []).map(floor => ({
    ...floor,
    id: generateId('floor'),
    apartments: (floor.apartments || []).map(apt => ({
      ...apt,
      id: generateId('apt'),
      voids: (apt.voids || []).map(v => {
        const newVoidId = generateId('void');
        const mappedItemId = itemIdMap[v.itemId] || v.itemId;
        return {
          ...v,
          id: newVoidId,
          itemId: mappedItemId,
          // Réinitialisation stricte des cotes réelles et validation
          L: undefined,
          H: undefined,
          wallDepth: undefined,
          handleHeight: undefined,
          measurementsValidated: false,
          productionLaunched: false,
          productionBatchId: undefined,
          shutter: v.shutter ? {
            ...v.shutter,
            id: `shutter-${newVoidId}`,
            customLV: undefined
          } : null
        };
      })
    }))
  }));

  return {
    ...JSON.parse(JSON.stringify(sourcePlan)),
    id: clonedPlanId,
    quoteId: newQuoteId,
    orderId: null,
    name: planName,
    floors: clonedFloors,
    _lastModified: new Date().toISOString()
  };
};
