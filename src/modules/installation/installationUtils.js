import { findPlanByOrderOrQuote } from '../../utils/sitePlanMatch.js';
/**
 * installationUtils.js
 * Utilitaires pour le Suivi de Pose sur Chantier (Desktop & Mobile)
 */

export const INSTALLATION_STEPS = [
  { 
    id: 'manutention', 
    label: 'Manutention', 
    icon: 'Package', 
    shortLabel: 'Manut.',
    desc: 'Acheminement et montée du châssis à l\'étage' 
  },
  { 
    id: 'pose_alu', 
    label: 'Pose Alu', 
    icon: 'Wrench', 
    shortLabel: 'Pose Alu',
    desc: 'Fixation, calage et niveau du bâti aluminium' 
  },
  { 
    id: 'manutention_vitrage', 
    label: 'Manutention Vitrage', 
    icon: 'Layers', 
    shortLabel: 'Manut. Vit.',
    desc: 'Montée et acheminement sécurisé des vitrages' 
  },
  { 
    id: 'pose_vitrage', 
    label: 'Pose Vitrage', 
    labelSliding: 'Pose Vitrage',
    shortLabel: 'Pose Vit.',
    shortLabelSliding: 'Pose Vit.',
    icon: 'Maximize2', 
    desc: 'Pose et calage des vitrages' 
  },
  { 
    id: 'reglage', 
    label: 'Réglage', 
    icon: 'Sliders', 
    shortLabel: 'Réglage',
    desc: 'Équerrage, alignement, compression et réglage quincaillerie' 
  },
  { 
    id: 'finition', 
    label: 'Silicone', 
    labelSliding: 'Silicone',
    icon: 'CheckCircle2', 
    shortLabel: 'Silicone',
    desc: 'Joints silicone, étanchéité et finitions' 
  },
];

/**
 * Détermine le nom formaté d'un étage
 */
export function formatFloorName(rawName) {
  if (!rawName) return 'Étage Indéfini';
  const str = String(rawName).trim();
  const lower = str.toLowerCase();
  
  if (lower === '0' || lower === 'rdc' || lower.includes('rez')) {
    return 'Rez-de-chaussée (RDC)';
  }
  if (str === '1' || lower === '1er' || lower === '1e') {
    return '1er Étage';
  }
  if (/^\d+$/.test(str)) {
    return `${str}ème Étage`;
  }
  if (!lower.includes('étage') && !lower.includes('etage') && !lower.includes('niveau') && !lower.includes('rdc')) {
    return `Étage ${str}`;
  }
  return str;
}

/**
 * Classifie la famille d'une ouverture (coulissant, ouvrant, fixe)
 */
export function classifyOpeningFamily(item, database) {
  const comp = database?.compositions?.find(c => c.id === item?.config?.compositionId);
  const openingType = (comp?.openingType || '').toLowerCase();
  const compoundType = (item?.config?.compoundType || '').toLowerCase();
  const label = (item?.label || '').toLowerCase();
  const name = (comp?.name || '').toLowerCase();

  if (compoundType === 'fix_coulissant' || openingType.includes('coulissant') || label.includes('coulissant') || name.includes('coulissant')) {
    return 'coulissant';
  }
  if (compoundType === 'fix_ouvrant' || openingType.includes('ouvrant') || label.includes('ouvrant') || label.includes('battant') || name.includes('ouvrant')) {
    return 'ouvrant';
  }
  if (openingType.includes('fixe') || label.includes('fixe') || name.includes('fixe')) {
    return 'fixe';
  }
  return 'ouvrant';
}

/**
 * Vérifie si une ouverture ou sous-lot est considéré comme terminé en fabrication
 */
function isVoidFinishedInProduction(voidId, repere, order) {
  if (!order) return false;

  // 1. Check direct stock finish flag
  const stock = order.finishedGoodsStock || {};
  if (stock[voidId] || stock[`coul_${voidId}`] || stock[`ouv_${voidId}`] || stock[`fix_${voidId}`] || stock[repere]) {
    return true;
  }

  // 2. Check in sublots
  const allSubLots = [...(order.subLots || [])];
  (order.batches || []).forEach(b => {
    (b.subLots || []).forEach(sl => {
      if (!allSubLots.some(s => s.id === sl.id)) allSubLots.push(sl);
    });
  });

  for (const sl of allSubLots) {
    const isSlTermine = sl.status === 'Terminé' || !!sl.completedAt;
    const checklist = sl.checklist || {};

    // Check in sl.ouvertures
    for (const o of (sl.ouvertures || [])) {
      if (o.id === voidId || o.id === `coul_${voidId}` || o.id === `ouv_${voidId}` || o.id === `fix_${voidId}` || o.repere === repere) {
        if (isSlTermine || checklist[o.id] || stock[o.id]) return true;
      }
    }

    // Check in sl.cadres
    for (const c of (sl.cadres || [])) {
      if (c.id === voidId || c.id === `c_${voidId}` || c.repere === repere) {
        if (isSlTermine || checklist[c.id] || stock[c.id]) return true;
      }
    }

    // Check in sl.panneaux
    for (const p of (sl.panneaux || [])) {
      if (p.id === voidId || p.id === `p_${voidId}` || p.repere === repere) {
        if (isSlTermine || checklist[p.id] || stock[p.id]) return true;
      }
    }

    // If sublot contains this item by items array
    if ((sl.items || []).some(it => it.id === voidId || it.voidId === voidId || it.repere === repere)) {
      if (isSlTermine) return true;
    }
  }

  // 3. Check batches if any batch containing this item is completed
  for (const b of (order.batches || [])) {
    if (b.status === 'Terminé') {
      const hasItem = (b.items || []).some(bi => {
        return (bi.measurements || []).some(m => m.id === voidId);
      });
      if (hasItem) return true;
    }
  }

  return false;
}

/**
 * Vérifie si une ouverture est livrée sur le chantier
 */
function isVoidDelivered(voidId, repere, order) {
  if (!order) return false;

  const deliveries = order.finishedGoodsDelivery || {};
  const testKeys = [
    voidId,
    `coul_${voidId}`,
    `ouv_${voidId}`,
    `fix_${voidId}`,
    `c_${voidId}`,
    `p_${voidId}`,
    repere,
    repere?.toUpperCase(),
    repere?.toLowerCase()
  ];

  for (const k of testKeys) {
    if (k && deliveries[k]?.delivered) return true;
  }

  // Also check unitStatusesDual if used in shipping
  const dual = order.unitStatusesDual || {};
  for (const k of testKeys) {
    if (k && (dual[k]?.alu === 'Livré' || dual[k]?.alu === 'Posé' || dual[k]?.alu === 'Fini')) {
      return true;
    }
  }

  return false;
}

/**
 * Trouve le plan de chantier actif pour une commande
 */
export function findActiveSitePlan(order, database) {
  if (!order) return null;

  const client = (database?.clients || []).find(c => c.id === order.clientId);
  const clientPlans = client?.sitePlans || [];
  
  if (order.sitePlanId) {
    const found = clientPlans.find(p => p.id === order.sitePlanId);
    if (found) return found;
  }

  const byOrderOrQuote = findPlanByOrderOrQuote(clientPlans, order);
  if (byOrderOrQuote) return byOrderOrQuote;

  // Search in global sitePlans array if any
  if (Array.isArray(database?.sitePlans)) {
    const foundGlobal = (order.sitePlanId && database.sitePlans.find(p => p.id === order.sitePlanId)) ||
      findPlanByOrderOrQuote(database.sitePlans, order);
    if (foundGlobal) return foundGlobal;
  }

  // Search if any plan contains void referring to order item
  for (const plan of clientPlans) {
    for (const floor of (plan.floors || [])) {
      for (const apt of (floor.apartments || [])) {
        for (const v of (apt.voids || [])) {
          if (order.items?.some(i => i.id === v.itemId)) {
            return plan;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Construit la structure complète du chantier découpée par étage pour une commande
 */
export function buildChantierStructure(order, database) {
  if (!order) {
    return { floors: [], stats: { total: 0, nonProduit: 0, enStock: 0, livre: 0, pose: 0, percentProgress: 0 } };
  }

  const activeSitePlan = findActiveSitePlan(order, database);
  const floorsMap = new Map();

  // Helper pour initialiser un étage
  const getOrCreateFloor = (rawFloorName) => {
    const key = String(rawFloorName || 'Étage 1').trim();
    if (!floorsMap.has(key)) {
      floorsMap.set(key, {
        id: `floor-${key}`,
        rawName: key,
        displayName: formatFloorName(key),
        items: []
      });
    }
    return floorsMap.get(key);
  };

  // CAS 1: On a un Plan de Chantier avec étages et appartements
  if (activeSitePlan && Array.isArray(activeSitePlan.floors) && activeSitePlan.floors.length > 0) {
    activeSitePlan.floors.forEach((f, fIdx) => {
      const floorObj = getOrCreateFloor(f.name || `${fIdx + 1}`);

      (f.apartments || []).forEach(a => {
        (a.voids || []).forEach((v, vIdx) => {
          const item = (order.items || []).find(i => i.id === v.itemId);
          
          // Référence type 1a1, 1a2, 2a1, etc.
          const defaultRef = `${f.name || (fIdx + 1)}${a.name || 'A'}${vIdx + 1}`.toUpperCase();
          const repere = (v.name?.trim() || defaultRef).toUpperCase();

          const family = classifyOpeningFamily(item, database);
          const isSliding = family === 'coulissant';

          const L = v.L !== undefined && v.L !== '' ? parseFloat(v.L) : (item?.config?.L || 1200);
          const H = v.H !== undefined && v.H !== '' ? parseFloat(v.H) : (item?.config?.H || 1200);

          const delivered = isVoidDelivered(v.id, repere, order);
          const inStock = delivered || isVoidFinishedInProduction(v.id, repere, order);

          let status = 'non_produit';
          if (delivered) {
            status = 'livre';
          } else if (inStock) {
            status = 'en_stock';
          }

          // Étapes de pose
          const stepsData = order.installationSteps?.[v.id] || order.installationSteps?.[repere] || {};
          const stepsState = {};
          let completedStepsCount = 0;

          INSTALLATION_STEPS.forEach(step => {
            const isDone = !!stepsData[step.id]?.done;
            if (isDone) completedStepsCount++;
            stepsState[step.id] = {
              done: isDone,
              at: stepsData[step.id]?.at || null,
              by: stepsData[step.id]?.by || null
            };
          });

          const isFullyInstalled = completedStepsCount === INSTALLATION_STEPS.length;

          floorObj.items.push({
            id: v.id,
            voidId: v.id,
            itemId: item?.id || null,
            repere: repere,
            label: item?.label || (isSliding ? 'Fenêtre Coulissante' : family === 'fixe' ? 'Châssis Fixe' : 'Fenêtre Ouvrante'),
            dimensions: `${L} × ${H} mm`,
            L,
            H,
            floorName: f.name,
            aptName: a.name,
            family,
            isSliding,
            status, // 'non_produit' | 'en_stock' | 'livre'
            isDelivered: delivered,
            inStock: inStock,
            steps: stepsState,
            completedStepsCount,
            totalStepsCount: INSTALLATION_STEPS.length,
            isFullyInstalled,
            shutter: v.shutter || null,
            rawItem: item,
            rawVoid: v
          });
        });
      });
    });
  }

  // CAS 2: Pas de plan formel ou plan vide -> Extraction depuis les items / siteMeasurements / subLots
  if (floorsMap.size === 0) {
    (order.items || []).forEach(item => {
      const family = classifyOpeningFamily(item, database);
      const isSliding = family === 'coulissant';

      if (Array.isArray(item.siteMeasurements) && item.siteMeasurements.length > 0) {
        item.siteMeasurements.forEach((m, mIdx) => {
          const rawFloor = m.instanceFloors?.[0] || '1';
          const floorObj = getOrCreateFloor(rawFloor);

          const defaultRef = m.instanceNames?.[0] || `1A${mIdx + 1}`;
          const repere = (m.label || defaultRef).toUpperCase();

          const L = m.L !== undefined && m.L !== '' ? parseFloat(m.L) : (item.config?.L || 1200);
          const H = m.H !== undefined && m.H !== '' ? parseFloat(m.H) : (item.config?.H || 1200);

          const voidId = m.id || `M-${item.id}-${mIdx}`;
          const delivered = isVoidDelivered(voidId, repere, order);
          const inStock = delivered || isVoidFinishedInProduction(voidId, repere, order);

          let status = 'non_produit';
          if (delivered) {
            status = 'livre';
          } else if (inStock) {
            status = 'en_stock';
          }

          const stepsData = order.installationSteps?.[voidId] || order.installationSteps?.[repere] || {};
          const stepsState = {};
          let completedStepsCount = 0;

          INSTALLATION_STEPS.forEach(step => {
            const isDone = !!stepsData[step.id]?.done;
            if (isDone) completedStepsCount++;
            stepsState[step.id] = {
              done: isDone,
              at: stepsData[step.id]?.at || null,
              by: stepsData[step.id]?.by || null
            };
          });

          floorObj.items.push({
            id: voidId,
            voidId: voidId,
            itemId: item.id,
            repere: repere,
            label: item.label,
            dimensions: `${L} × ${H} mm`,
            L,
            H,
            floorName: rawFloor,
            family,
            isSliding,
            status,
            isDelivered: delivered,
            inStock: inStock,
            steps: stepsState,
            completedStepsCount,
            totalStepsCount: INSTALLATION_STEPS.length,
            isFullyInstalled: completedStepsCount === INSTALLATION_STEPS.length,
            rawItem: item
          });
        });
      } else {
        // Fallback article unitaire
        const floorObj = getOrCreateFloor('1');
        const repere = (item.label?.substring(0, 3) || '1A1').toUpperCase();
        const voidId = item.id;
        const delivered = isVoidDelivered(voidId, repere, order);
        const inStock = delivered || isVoidFinishedInProduction(voidId, repere, order);

        let status = 'non_produit';
        if (delivered) {
          status = 'livre';
        } else if (inStock) {
          status = 'en_stock';
        }

        const stepsData = order.installationSteps?.[voidId] || order.installationSteps?.[repere] || {};
        const stepsState = {};
        let completedStepsCount = 0;

        INSTALLATION_STEPS.forEach(step => {
          const isDone = !!stepsData[step.id]?.done;
          if (isDone) completedStepsCount++;
          stepsState[step.id] = {
            done: isDone,
            at: stepsData[step.id]?.at || null,
            by: stepsData[step.id]?.by || null
          };
        });

        floorObj.items.push({
          id: voidId,
          voidId: voidId,
          itemId: item.id,
          repere: repere,
          label: item.label,
          dimensions: `${item.config?.L || 1200} × ${item.config?.H || 1200} mm`,
          L: item.config?.L || 1200,
          H: item.config?.H || 1200,
          floorName: '1',
          family,
          isSliding,
          status,
          isDelivered: delivered,
          inStock: inStock,
          steps: stepsState,
          completedStepsCount,
          totalStepsCount: INSTALLATION_STEPS.length,
          isFullyInstalled: completedStepsCount === INSTALLATION_STEPS.length,
          rawItem: item
        });
      }
    });
  }

  // Trier les étages naturellement (RDC en premier, puis 1er, 2e, etc.)
  const sortedFloors = Array.from(floorsMap.values()).sort((a, b) => {
    const numA = parseInt(a.rawName.replace(/\D/g, ''), 10);
    const numB = parseInt(b.rawName.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (a.rawName.toLowerCase().includes('rdc')) return -1;
    if (b.rawName.toLowerCase().includes('rdc')) return 1;
    return a.rawName.localeCompare(b.rawName);
  });

  // Calcul des statistiques globales et par étage
  let totalItems = 0;
  let nonProduit = 0;
  let enStock = 0;
  let livre = 0;
  let fullyPose = 0;
  let totalStepsCompleted = 0;
  let totalStepsPossible = 0;

  sortedFloors.forEach(floor => {
    let floorDelivered = 0;
    let floorPose = 0;
    let floorStepsDone = 0;
    let floorStepsPossible = 0;

    floor.items.forEach(it => {
      totalItems++;
      if (it.status === 'livre') {
        livre++;
        floorDelivered++;
        floorStepsPossible += INSTALLATION_STEPS.length;
        floorStepsDone += it.completedStepsCount;
        totalStepsPossible += INSTALLATION_STEPS.length;
        totalStepsCompleted += it.completedStepsCount;
        if (it.isFullyInstalled) {
          fullyPose++;
          floorPose++;
        }
      } else if (it.status === 'en_stock') {
        enStock++;
      } else {
        nonProduit++;
      }
    });

    floor.stats = {
      total: floor.items.length,
      delivered: floorDelivered,
      pose: floorPose,
      stepsDone: floorStepsDone,
      stepsPossible: floorStepsPossible,
      percent: floorStepsPossible > 0 ? Math.round((floorStepsDone / floorStepsPossible) * 100) : 0
    };
  });

  const percentProgress = totalStepsPossible > 0 
    ? Math.round((totalStepsCompleted / totalStepsPossible) * 100) 
    : (totalItems > 0 && fullyPose === totalItems ? 100 : 0);

  return {
    floors: sortedFloors,
    stats: {
      total: totalItems,
      nonProduit,
      enStock,
      livre,
      pose: fullyPose,
      totalStepsCompleted,
      totalStepsPossible,
      percentProgress
    }
  };
}

/**
 * Met à jour une étape d'installation pour un article dans la base de données
 */
export function updateInstallationStep(setData, orderId, voidId, stepId, isDone, userName = 'Poseur') {
  const nowIso = new Date().toISOString();
  setData(prev => {
    const orders = (prev.orders || []).map(o => {
      if (o.id !== orderId) return o;

      const currentSteps = { ...(o.installationSteps || {}) };
      const itemSteps = { ...(currentSteps[voidId] || {}) };

      itemSteps[stepId] = isDone
        ? { done: true, at: nowIso, by: userName }
        : { done: false, at: null, by: null };

      currentSteps[voidId] = itemSteps;

      return {
        ...o,
        installationSteps: currentSteps,
        _lastModified: nowIso
      };
    });

    return { ...prev, orders };
  });
}

/**
 * Valide ou annule toutes les étapes d'installation d'un article en un seul clic
 */
export function toggleAllInstallationSteps(setData, orderId, voidId, targetDone, userName = 'Poseur') {
  const nowIso = new Date().toISOString();
  setData(prev => {
    const orders = (prev.orders || []).map(o => {
      if (o.id !== orderId) return o;

      const currentSteps = { ...(o.installationSteps || {}) };
      const itemSteps = { ...(currentSteps[voidId] || {}) };

      INSTALLATION_STEPS.forEach(step => {
        itemSteps[step.id] = targetDone
          ? { done: true, at: nowIso, by: userName }
          : { done: false, at: null, by: null };
      });

      currentSteps[voidId] = itemSteps;

      return {
        ...o,
        installationSteps: currentSteps,
        _lastModified: nowIso
      };
    });

    return { ...prev, orders };
  });
}

/**
 * Permet de marquer un article comme livré ou de revenir en stock
 */
export function toggleArticleDelivery(setData, orderId, voidId, currentlyDelivered, userName = 'Chantier') {
  const nowIso = new Date().toISOString();
  setData(prev => {
    const orders = (prev.orders || []).map(o => {
      if (o.id !== orderId) return o;

      const newDelivery = { ...(o.finishedGoodsDelivery || {}) };
      if (currentlyDelivered) {
        delete newDelivery[voidId];
      } else {
        newDelivery[voidId] = {
          delivered: true,
          deliveredAt: nowIso,
          deliveredBy: userName,
          deliveryRef: 'BL-CHANTIER'
        };
      }

      return {
        ...o,
        finishedGoodsDelivery: newDelivery,
        _lastModified: nowIso
      };
    });

    return { ...prev, orders };
  });
}

