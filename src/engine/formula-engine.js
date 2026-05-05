import { create, all } from 'mathjs';

const math = create(all);

/**
 * Formula Engine for Joinery Configurator
 */
export class FormulaEngine {
  constructor(database) {
    this.db = database || {};
  }

  evaluate(formula, scope, errorContext = '') {
    if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0;
    try {
      // 1. Convert French decimals "1,5" -> "1.5" but preserve function commas "max(1, 2)"
      let cleanFormula = formula.replace(/(\d),(\d)/g, '$1.$2');
      
      // 2. Convert JS logical operators to mathjs
      cleanFormula = cleanFormula.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');

      // 3. Inject custom functions
      const evalScope = { 
        ...scope, 
        'if': (cond, a, b) => cond ? a : b 
      };

      return math.evaluate(cleanFormula, evalScope);
    } catch (err) {
      console.warn(`Formula Error [${errorContext}]: "${formula}"`, err);
      return 0;
    }
  }

  getUsageCategory(label) {
    const l = (label || '').toLowerCase();
    if (l.includes('dormant') || l.includes('cadre') || l.includes('seuil') || l.includes('precadre')) return 'DORMANT (CADRE)';
    if (l.includes('fixe') || l.includes('fix')) return 'FIXE';
    if (l.includes('ouvrant') || l.includes('battement') || l.includes('inverseur')) return 'FENETRE (OUVRANT)';
    if (l.includes('parclose')) {
      // If parclose is mentioned with fix/fixe, it goes to FIXE, otherwise OUVRANT
      return (l.includes('fixe') || l.includes('fix')) ? 'FIXE' : 'FENETRE (OUVRANT)';
    }
    if (l.includes('lame') || l.includes('coulisse') || l.includes('caisson') || l.includes('axe') || l.includes('glissiere')) return 'VOLET ROULANT';
    if (l.includes('traverse') || l.includes('montant')) return 'FIXE'; 
    return 'ACCESSOIRES / FINITION';
  }

  /**
   * Resolve a formula by replacing L and H with their values
   */
  resolveFormula(formula, scope) {
    if (!formula || typeof formula !== 'string') return '';
    let resolved = formula;
    if (scope.L !== undefined) resolved = resolved.replace(/L/g, Math.round(scope.L));
    if (scope.HC !== undefined) resolved = resolved.replace(/HC/g, Math.round(scope.HC));
    if (scope.H !== undefined) resolved = resolved.replace(/H/g, Math.round(scope.H));
    if (scope.EPt !== undefined) resolved = resolved.replace(/EPt/g, Math.round(scope.EPt));
    if (scope.Epd !== undefined) resolved = resolved.replace(/Epd/g, Math.round(scope.Epd));
    return resolved;
  }

  calculateComponentBOM(config, L, H, compositionId, glassId, optionalSides, totalH = null, originalL = null, originalH = null, EPt = 0) {
    const opt = optionalSides || { top: true, bottom: true, left: true, right: true };
    let composition = (this.db.compositions || []).find(c => c.id === compositionId);
    if (!composition) {
      composition = (this.db.compositions || []).find(c => c.name === compositionId);
    }
    if (!composition) return { profiles: [], accessories: [], glass: null, gasket: null };

    let HC = 0;
    if (config.hasShutter) {
      if (config.shutterOverrides?.customHC) {
        HC = config.shutterOverrides.customHC;
      } else if (config.shutterConfig?.caissonId && this.db.shutterComponents) {
        const cRef = (this.db.shutterComponents?.caissons || []).find(c => c.id === config.shutterConfig.caissonId);
        HC = parseFloat(cRef?.height) || 0;
      }
    }

    const profiles = [];
    const accessories = [];
    // --- Epd DETECTION (Dormant Thickness) ---
    let Epd = 40; 
    const isDormantFn = (l, n) => /dormant|cadre|chassis|batit|dorme/i.test(((l || '') + ' ' + (n || '')).toLowerCase());
    const dormantId = composition.elements.find(el => {
       if (el.type !== 'profile') return false;
       const pDef = (this.db.profiles || []).find(x => x.id === el.id);
       return pDef && isDormantFn(el.label, pDef.name);
    })?.id;
    if (dormantId) {
       const pDef = (this.db.profiles || []).find(x => x.id === dormantId);
       Epd = pDef.thickness || (parseInt((pDef.name || '').match(/\d+/)?.[0]) || 40);
    }

    // 1. Calculate glass dimensions and quantity first to have them in scope
    const tempScope = { L, H, HC, totalH: totalH || H, originalL: originalL || L, totalOriginalH: originalH || H, EPt, Epd };
    const glassL = this.evaluate(composition.glassFormulaL || 'L', tempScope, 'Largeur Vitre');
    const glassH = this.evaluate(composition.glassFormulaH || 'H', tempScope, 'Hauteur Vitre');
    const glassQtyRaw = this.evaluate(composition.glassFormulaQty || '1', tempScope, 'Quantité Vitre');
    const glassQty = isNaN(glassQtyRaw) ? 0 : glassQtyRaw;

    // 2. Build the final enriched scope for all subsequent calculations
    const scope = { 
      ...tempScope,
      glassQty,
      qty: glassQty, // alias
      openingDirection: config.openingDirection || 'gauche'
    };
    
    const originalScope = { L: originalL || L, H: originalH || H, HC, openingDirection: config.openingDirection || 'gauche' };

    const isCompoundWithTraverse = config.compoundType === 'compound';
    
    // Detection via layout/config
    let hasHorizontalTraverse = (config.customLayout?.rows?.length > 1) || (config.rows > 1) || (isCompoundWithTraverse && config.compoundConfig?.orientation === 'vertical');
    let hasVerticalTraverse = (config.customLayout?.cols?.length > 1) || (config.cols > 1) || (isCompoundWithTraverse && config.compoundConfig?.orientation === 'horizontal');

    // Detection via composition elements (manual traverses)
    composition.elements.forEach(el => {
      const p = (this.db.profiles || []).find(x => x.id === el.id || x.name === el.id);
      const a = (this.db.accessories || []).find(x => x.id === el.id || x.name === el.id);
      const s = ((el.label || '') + ' ' + (p?.name || a?.name || '')).toLowerCase();
      
      if (s.includes('traverse')) {
        // A horizontal traverse piece implies a [T] on vertical frames
        if (s.includes('horiz') || s.includes(' h') || s.includes(' l') || s.includes('largeur')) {
          hasHorizontalTraverse = true;
        }
        // A vertical traverse piece implies a [T] on horizontal frames
        if (s.includes('vert') || s.includes(' v') || s.includes('hauteur')) {
          hasVerticalTraverse = true;
        }
      }
    });

    const expandedElements = [];

    composition.elements.forEach(el => {
      let label = el.label || '';
      let itemName = '';
      
      if (el.type === 'profile') {
        let p = (this.db.profiles || []).find(x => x.id === el.id);
        if (!p) {
          p = (this.db.profiles || []).find(x => x.name === el.id); // Fallback if ID is actually a name
        }
        if (p) itemName = p.name || '';
      } else if (el.type === 'accessory') {
        const a = (this.db.accessories || []).find(x => x.id === el.id);
        if (a) itemName = a.name || '';
      }

      const searchStr = (label + ' ' + itemName).toLowerCase();
      const isCouvreJoint = /couvres?[- ]?joints?|cj[vh]?/i.test(searchStr);
      const isDormant = /dormant|cadre|chassis|batit|dorme/i.test(searchStr);

      if (!isCouvreJoint && !isDormant) {
        expandedElements.push({ ...el, isFrame: false, isCouvreJoint: false });
        return;
      }
      const isHorizontal = /haut|bas|couvres?[- ]?joints?h/i.test(searchStr) || (/\bL\b| L$/i.test(searchStr));
      const isVertical = /gauche|droite|couvres?[- ]?joints?v/i.test(searchStr) || (/\bH\b| H$/i.test(searchStr));
      let baseLabel = label || itemName;
      
      // Marquage T croisé pour l'atelier
      if (isDormant) {
        if (isHorizontal && hasVerticalTraverse) baseLabel += ' [T]';
        if (isVertical && hasHorizontalTraverse) baseLabel += ' [T]';
      }

      const isActuallyCouvreJoint = isCouvreJoint;

      // SUB-PARTS never get expanded frame elements (they only get their own internal opening profiles)
      // This ensures the main frame doesn't double-count profiles inside sub-parts for multi-chassis
      if (opt.isSubPart && (isDormant || isCouvreJoint)) {
        return;
      }

      // ACCESSORIES never get expanded/split
      if (el.type === 'accessory') {
        expandedElements.push({ ...el, isFrame: isDormant || isCouvreJoint, isCouvreJoint: isActuallyCouvreJoint });
        return;
      }

      // Smart Formula Swapping Helper
      const swapFormula = (f, from, to) => {
        if (!f || typeof f !== 'string') return f;
        const regex = new RegExp(`\\b${from}\\b`, 'g');
        return f.replace(regex, to);
      };

      // PROFILES expansion logic
      if (isHorizontal) {
        const hasHaut = searchStr.includes('haut');
        const hasBas = searchStr.includes('bas');
        const isGenericH = !hasHaut && !hasBas;
        
        // Ensure horizontal profiles use 'L' if they were accidentally defined with 'H'
        const hFormula = swapFormula(el.formula || 'L', 'H', 'L');
        
        if (isGenericH) {
          const allowTop = isActuallyCouvreJoint ? opt.top : true;
          const allowBottom = isActuallyCouvreJoint ? opt.bottom : true;
          
          if (allowTop) expandedElements.push({ ...el, formula: hFormula, label: baseLabel + ' (Haut)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
          if (allowBottom) expandedElements.push({ ...el, formula: hFormula, label: baseLabel + ' (Bas)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
        } else {
          const allowTop = isActuallyCouvreJoint ? opt.top : true;
          const allowBottom = isActuallyCouvreJoint ? opt.bottom : true;
          
          if (hasHaut && allowTop) expandedElements.push({ ...el, formula: hFormula, label: baseLabel, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
          if (hasBas && allowBottom) expandedElements.push({ ...el, formula: hFormula, label: baseLabel, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
        }
      } else if (isVertical) {
        const hasGauche = searchStr.includes('gauche');
        const hasDroite = searchStr.includes('droite');
        const isGenericV = !hasGauche && !hasDroite;

        // Ensure vertical profiles use 'H' if they were accidentally defined with 'L'
        const vFormula = swapFormula(el.formula || 'H', 'L', 'H');

        if (isGenericV) {
          const allowLeft = isActuallyCouvreJoint ? opt.left : true;
          const allowRight = isActuallyCouvreJoint ? opt.right : true;
          
          if (allowLeft) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Gauche)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
          if (allowRight) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Droite)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
        } else {
          const allowLeft = isActuallyCouvreJoint ? opt.left : true;
          const allowRight = isActuallyCouvreJoint ? opt.right : true;
          
          if (hasGauche && allowLeft) expandedElements.push({ ...el, formula: vFormula, label: baseLabel, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
          if (hasDroite && allowRight) expandedElements.push({ ...el, formula: vFormula, label: baseLabel, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
        }
      } else {
        // Generic 4-sided
        const allowTop = isActuallyCouvreJoint ? opt.top : true;
        const allowBottom = isActuallyCouvreJoint ? opt.bottom : true;
        const allowLeft = isActuallyCouvreJoint ? opt.left : true;
        const allowRight = isActuallyCouvreJoint ? opt.right : true;

        const hFormula = swapFormula(el.formula || 'L', 'H', 'L');
        const vFormula = swapFormula(el.formula || 'H', 'L', 'H');

        if (allowTop) expandedElements.push({ ...el, formula: hFormula, label: baseLabel + ' (Haut)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
        if (allowBottom) expandedElements.push({ ...el, formula: hFormula, label: baseLabel + ' (Bas)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
        if (allowLeft) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Gauche)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
        if (allowRight) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Droite)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint, isFrame: true });
      }
    });

    expandedElements.forEach(el => {
      let elQty = el.qty;
      const isAccessory = el.type === 'accessory';
      const formulaRaw = el.formula != null ? String(el.formula) : '';
      const formulaStr = (formulaRaw.trim() !== '') ? formulaRaw : (isAccessory ? '1' : '');
      
      // Use totalH and initialL for Couvre Joint if available.
      let currentScope = (el.isCouvreJoint) ? { ...scope, H: totalH || scope.totalOriginalH || H, L: originalL || scope.originalL || L } : scope;
      if (el.isCouvreJoint) {
        currentScope = { ...currentScope, ...originalScope, H: totalH || scope.totalOriginalH || H, L: originalL || scope.originalL || L };
      }
      
      const value = this.evaluate(formulaStr, currentScope, el.label || itemName);
      const isError = isNaN(value);
      const safeValue = isError ? 0 : value;
      const qty = safeValue * elQty;

      if (el.type === 'profile') {
        let pRef = (this.db.profiles || []).find(p => p.id === el.id);
        if (!pRef) {
          pRef = (this.db.profiles || []).find(p => p.name === el.id);
        }
        if (pRef) {
          let unitPrice = 0;
          let cost = 0;
          
          if (pRef.pricePerBar) {
            unitPrice = pRef.pricePerBar;
            cost = (qty / (pRef.barLength || 6000)) * unitPrice;
          } else if (pRef.pricePerKg) {
            unitPrice = pRef.pricePerKg;
            cost = (qty / 1000) * (pRef.weightPerM || 1) * unitPrice;
          }

          profiles.push({
            ...pRef,
            label: el.label,
            qty: elQty,
            formula: el.formula,
            resolvedFormula: this.resolveFormula(formulaStr, currentScope),
            calculation: `${this.resolveFormula(formulaStr, currentScope)}`,
            isFrame: el.isFrame,
            isCouvreJoint: el.isCouvreJoint,
            length: safeValue,
            usage: this.getUsageCategory((el.label || '') + ' ' + (pRef.name || '')),
            error: isError ? "Formule Invalide" : null,
            unitPrice: unitPrice,
            compositionId: composition.id,
            compositionName: composition.name,
            totalMeasure: safeValue * elQty,
            cost: cost
          });
        }
      } else if (el.type === 'accessory') {
        const aRef = (this.db.accessories || []).find(a => a.id === el.id);
        if (aRef) {
          const unitUpper = (aRef.unit || '').toUpperCase();
          const isLinear = ['M', 'ML', 'JOINT'].includes(unitUpper);
          const finalQty = isLinear ? (qty / 1000) : qty;

          accessories.push({
            ...aRef,
            label: el.label,
            qty: finalQty,
            isFrame: el.isFrame,
            isCouvreJoint: el.isCouvreJoint,
            multiplier: el.qty || 1,
            formula: el.formula || '1',
            resolvedFormula: this.resolveFormula(el.formula || '1', currentScope),
            error: isError ? "Formule Invalide" : null,
            unitPrice: aRef.price || 0,
            totalMeasure: qty, 
            cost: (finalQty || 0) * (aRef.price || 0)
          });
        }
      }
    });

    const glass = (this.db.glass || []).find(g => g.id === glassId);
    // Normalize rangeId: strip hyphens and spaces for flexible matching
    const normalizeRangeId = (id) => (id || '').replace(/[-\s]+/g, '').toLowerCase();
    const compNormRangeId = normalizeRangeId(composition.rangeId);

    let gasket = null;
    
    if (glass) {
      const allGasketEntries = this.db.gasketCompatibility || [];
      
      let compatibility = allGasketEntries.find(
        c => normalizeRangeId(c.rangeId) === compNormRangeId &&
             parseFloat(c.glassThickness) === parseFloat(glass.thickness)
      );
      
      // Fallback: only if no rangeId is explicitly defined (headless or manual composition)
      if (!compatibility && !composition.rangeId) {
        compatibility = allGasketEntries.find(
          c => parseFloat(c.glassThickness) === parseFloat(glass.thickness)
        );
      }
      
      if (compatibility) {
        const gRef = (this.db.accessories || []).find(a => a.id === compatibility.gasketId);
        if (gRef) {
          const formula = compatibility.formula || '(L+H)*2';
          const lenMm = this.evaluate(formula, scope, 'Joint Vitrage');
          const isError = isNaN(lenMm);
          const safeLenMm = isError ? 0 : lenMm;
          const qtyMl = safeLenMm / 1000;
          
          gasket = {
            ...gRef,
            isGlassGasket: true,
            label: 'Joint de Vitrage',
            qty: qtyMl,
            multiplier: 1,
            unit: 'Joint',
            formula: formula,
            resolvedFormula: this.resolveFormula(formula, scope),
            error: isError ? "Formule Invalide" : null,
            unitPrice: gRef.price || 0,
            totalMeasure: safeLenMm,
            cost: qtyMl * (gRef.price || 0)
          };
        }
      }
    }

    const glassArea = (((isNaN(glassL)?0:glassL) * (isNaN(glassH)?0:glassH)) / 1000000) * (isNaN(glassQty)?0:glassQty);
    const glassWeight = glass ? (glassArea * glass.weightPerM2) : 0;
    const glassCost = glass ? (glassArea * glass.pricePerM2) : 0;

    // Add Parcloses based on glass compatibility ONLY if not already present in profiles
    if (glass) {
      const hasManualParcloseH = profiles.some(p => p.label?.toLowerCase() === 'parcloseh');
      const hasManualParcloseV = profiles.some(p => p.label?.toLowerCase() === 'parclosev');
      
      let glassProfiles = (this.db.glassProfileCompatibility || []).filter(
        c => normalizeRangeId(c.rangeId) === compNormRangeId &&
             parseFloat(c.glassThickness) === parseFloat(glass.thickness)
      );

      // Fallback: If no exact range match AND no rangeId is defined on the composition,
      // try matching by thickness ONLY (supports generic/manual compositions)
      if (glassProfiles.length === 0 && !composition.rangeId) {
        glassProfiles = (this.db.glassProfileCompatibility || []).filter(
          c => parseFloat(c.glassThickness) === parseFloat(glass.thickness)
        );
      }

      if (glassProfiles.length === 0) {
          console.warn(`[Parclose] No compatibility found for range=${composition.rangeId} thickness=${glass.thickness}`);
      }

      glassProfiles.forEach(gp => {
        console.log(`[Parclose] Match found: H=${gp.profileHId} V=${gp.profileVId}`);
        // Handle Parclose Horizontal
        const pHRef = (this.db.profiles || []).find(p => p.id === gp.profileHId);
        if (pHRef && !hasManualParcloseH) {
          const unitPrice = (pHRef.pricePerBar || pHRef.pricePerKg || 0);
          const formulaH = gp.formulaH || composition.glassFormulaL || 'L';
          const hValue = this.evaluate(formulaH, scope, 'ParcloseH');
          const isErrorH = isNaN(hValue);
          const safeHValue = isErrorH ? 0 : hValue;
          const hQty = (gp.qtyH || 2) * (isNaN(glassQty)?0:glassQty);
          
          profiles.push({
            ...pHRef,
            label: 'ParcloseH',
            isFrame: false,
            isCouvreJoint: false,
            qty: hQty,
            length: safeHValue,
            formula: formulaH,
            resolvedFormula: this.resolveFormula(formulaH, scope),
            error: isErrorH ? "Formule Invalide" : null,
            unitPrice: unitPrice,
            totalMeasure: safeHValue * hQty,
            cost: ((safeHValue * hQty) / (pHRef.barLength || 6000)) * unitPrice
          });
        }

        // Handle Parclose Vertical
        const pVRef = (this.db.profiles || []).find(p => p.id === gp.profileVId);
        if (pVRef && !hasManualParcloseV) {
          const unitPrice = (pVRef.pricePerBar || pVRef.pricePerKg || 0);
          const formulaV = gp.formulaV || composition.glassFormulaH || 'H';
          const vValue = this.evaluate(formulaV, scope, 'ParcloseV');
          const isErrorV = isNaN(vValue);
          const safeVValue = isErrorV ? 0 : vValue;
          const vQty = (gp.qtyV || 2) * (isNaN(glassQty)?0:glassQty);
          
          profiles.push({
            ...pVRef,
            label: 'ParcloseV',
            isFrame: false,
            isCouvreJoint: false,
            qty: vQty,
            length: safeVValue,
            formula: formulaV,
            resolvedFormula: this.resolveFormula(formulaV, scope),
            error: isErrorV ? "Formule Invalide" : null,
            unitPrice: unitPrice,
            totalMeasure: safeVValue * vQty,
            cost: pVRef.pricePerBar 
              ? ((safeVValue * vQty) / (pVRef.barLength || 6000)) * unitPrice
              : ((safeVValue * vQty) / 1000) * (pVRef.weightPerM || 1) * unitPrice
          });
        }
      });
    }

    return {
      profiles,
      accessories,
      glass: glass ? {
        ...glass,
        width: isNaN(glassL)?0:glassL,
        height: isNaN(glassH)?0:glassH,
        qty: isNaN(glassQty)?0:glassQty,
        area: glassArea,
        weight: glassWeight,
        cost: glassCost,
        calculation: `L: ${this.resolveFormula(composition.glassFormulaL || 'L', scope)} = ${Math.round(glassL)} | H: ${this.resolveFormula(composition.glassFormulaH || 'H', scope)} = ${Math.round(glassH)}`,
        error: (isNaN(glassL) || isNaN(glassH) || isNaN(glassQty)) ? "Formule Invalide" : null
      } : { name: 'Vitrage Manquant', width: 0, height: 0, qty: 0, area: 0, weight: 0, cost: 0 },
      gasket
    };
  }

  /**
   * Recursive grid BOM calculation (handles root and sub-layouts)
   */
  calculateGridBOM(grid, L, H, config, totalH = null, originalL = null, originalH = null) {
    let profiles = [];
    let accessories = [];
    let glasses = [];

    const { cols, rows, cells } = grid;
    const totalColFrac = cols.reduce((a, b) => a + b, 0) || 1;
    const totalRowFrac = rows.reduce((a, b) => a + b, 0) || 1;
    
    const colWidths = cols.map(c => (c / totalColFrac) * L);
    const rowHeights = rows.map(r => (r / totalRowFrac) * H);

    // 1. Process Cells
    rows.forEach((_, ri) => {
      cols.forEach((_, ci) => {
        const cell = cells[ri][ci];
        const Lc = colWidths[ci];
        const Hc = rowHeights[ri];
        
        if (cell.subLayout) {
          // Recursive call for sub-layout
          const subRes = this.calculateGridBOM(cell.subLayout, Lc, Hc, config, totalH, originalL, originalH);
          profiles = [...profiles, ...subRes.profiles];
          accessories = [...accessories, ...subRes.accessories];
          glasses = [...glasses, ...subRes.glasses];
        } else {
          // Normal leaf cell
          const compId = cell.compositionId || config.compositionId;
          const glId = cell.glassId || config.glassId;

          const res = this.calculateComponentBOM(config, Lc, Hc, compId, glId, config.optionalSides, totalH, originalL, originalH);
          profiles = [...profiles, ...res.profiles];
          accessories = [...accessories, ...res.accessories];
          if (res.gasket) accessories.push(res.gasket);
          if (res.glass) glasses.push(res.glass);
        }
      });
    });

    // 2. Add Traverses for THIS grid level
    // Vertical traverses (between columns)
    if (cols.length > 1) {
      cols.slice(0, -1).forEach((_, ci) => {
        const trv = this.db.traverses?.find(t => t.type === 'verticale') || this.db.traverses?.[0];
        if (trv && trv.profileId) {
          const pRef = (this.db.profiles || []).find(p => p.id === trv.profileId);
          if (pRef) {
            const len = H; // Spans height of CURRENT grid
            const pPrice = pRef.pricePerBar 
              ? (len / (pRef.barLength || 6000)) * pRef.pricePerBar
              : (pRef.pricePerKg ? (len / 1000) * (pRef.weightPerM || 1) * pRef.pricePerKg : 0);

            profiles.push({
              ...pRef,
              label: `Traverse Verticale (L:${Math.round(L)} H:${Math.round(H)})`,
              qty: 1,
              length: len,
              formula: 'H',
              usage: 'DORMANT',
              cost: pPrice
            });
          }
        }
      });
    }

    // Horizontal traverses (between rows)
    if (rows.length > 1) {
      rows.slice(0, -1).forEach((_, ri) => {
        const trv = this.db.traverses?.find(t => t.type === 'horizontale') || this.db.traverses?.[0];
        if (trv && trv.profileId) {
          const pRef = (this.db.profiles || []).find(p => p.id === trv.profileId);
          if (pRef) {
            const len = L; // Spans width of CURRENT grid
            const pPrice = pRef.pricePerBar 
              ? (len / (pRef.barLength || 6000)) * pRef.pricePerBar
              : (pRef.pricePerKg ? (len / 1000) * (pRef.weightPerM || 1) * pRef.pricePerKg : 0);

            profiles.push({
              ...pRef,
              label: `Traverse Horizontale (L:${Math.round(L)} H:${Math.round(H)})`,
              qty: 1,
              length: len,
              formula: 'L',
              usage: 'DORMANT',
              cost: pPrice
            });
          }
        }
      });
    }

    return { profiles, accessories, glasses };
  }
  processShutterComponent(item, vars, shutterPack, key = '', config = {}) {
    const { L, H, HC, HT } = vars;
    const barLength = parseFloat(item.barLength) || 6400;
    
    // Detect if this shutter component is a couvre-joint
    const isCJ = /couvres?[- ]?joints?|cj[vh]?/i.test((item.name || '').toLowerCase());
    const effectiveH = HT || (H + HC);

    // Rule: Couvre Joint reduction ONLY on the caisson length
    let itemScopeL = L;
    if (key === 'caissonId') {
      const cjType = config.shutterConfig?.couvreJointType;
      if (cjType === 'total') {
        itemScopeL -= 3;
      } else if (cjType === 'half') {
        itemScopeL -= 1.5;
      } else if (config.shutterConfig?.hasCouvreJoint) {
        itemScopeL -= 3;
      }
    }

    const evalScope = { ...vars, L: itemScopeL, H: effectiveH, HC, HT: HT || (H + HC) };

    // 1. Compatibility Check (Standalone Logic V3.3)
    if (item.compatibilityFormula) {
      const isCompatible = this.evaluate(item.compatibilityFormula, evalScope, `Compatibilité ${item.name}`);
      if (!isCompatible) return;
    }

    // 2. Calculate Piece Length (Dimension de coupe)
    let itemLength = 0;
    if (item.cuttingFormula) {
      itemLength = this.evaluate(item.cuttingFormula, evalScope);
    } else {
      if (key === 'caissonId' || key === 'axeId' || key === 'lameId' || key === 'lameFinaleId') {
        itemLength = itemScopeL;
      } else if (key === 'glissiereId') {
        itemLength = effectiveH;
      }
    }

    // 2. Calculate Piece Count (Nombre de pièces)
    const pieceCount = this.evaluate(item.formula || '1', evalScope);
    if (pieceCount <= 0) return;

    // 3. Inclusion & Existing Checks (Standalone Logic V3.2)
    const includedParts = config.shutterConfig?.includedParts || { caisson: true, tablier: true, axe: true, glissieres: true, accessories: true };
    const isExistant = config.shutterConfig?.isExistant || false;
    const categoryMap = {
      'caissonId': 'caisson', 'lameId': 'tablier', 'lameFinaleId': 'tablier',
      'axeId': 'axe', 'glissiereId': 'glissieres', 'kitId': 'accessories', 'baguetteId': 'tablier'
    };
    const category = categoryMap[key] || 'accessories';
    if (!includedParts[category]) return;

    let itemPrice = item.price || 0;
    let displayName = item.name;
    let nameSuffix = '';

    // Special case: Caisson Tunnel (Existing)
    if (key === 'caissonId' && isExistant) {
      itemPrice = 0;
      nameSuffix = ' (Existant - Tunnel)';
    }

    // 4. Glissiere Params Logic
    if (key === 'glissiereId' && config.shutterConfig?.glissiereParams) {
      const params = config.shutterConfig.glissiereParams;
      const paramStrings = [];
      if (item.opt1Label) {
        const val = params.opt1 || item.opt1Values?.split(',')[0]?.trim();
        if (val) paramStrings.push(`${item.opt1Label}: ${val}mm`);
      }
      if (item.opt2Label) {
        const val = params.opt2 || item.opt2Values?.split(',')[0]?.trim();
        if (val) paramStrings.push(`${item.opt2Label}: ${val}mm`);
      }
      if (paramStrings.length > 0) displayName += ` (${paramStrings.join(', ')})`;

      // Option Plus-Values
      if (item.opt1Values && item.opt1Prices) {
        const vals = item.opt1Values.split(',').map(v => v.trim());
        const prs = item.opt1Prices.split(',').map(p => parseFloat(p.trim()) || 0);
        const selectedVal = params.opt1 || vals[0];
        const vIdx = vals.indexOf(selectedVal);
        if (vIdx !== -1 && prs[vIdx] !== undefined) itemPrice += prs[vIdx];
      }
      if (item.opt2Values && item.opt2Prices) {
        const vals = item.opt2Values.split(',').map(v => v.trim());
        const prs = item.opt2Prices.split(',').map(p => parseFloat(p.trim()) || 0);
        const selectedVal = params.opt2 || vals[0];
        const vIdx = vals.indexOf(selectedVal);
        if (vIdx !== -1 && prs[vIdx] !== undefined) itemPrice += prs[vIdx];
      }
    }

    // 5. Calculate Total Measure for Pricing
    let totalMeasure = 0;
    const unitUpper = (item.priceUnit || 'Unité').toUpperCase().trim();
    if (unitUpper === 'ML' || unitUpper === 'M' || unitUpper === 'JOINT') {
      totalMeasure = pieceCount * (itemLength / 1000);
    } else if (unitUpper === 'BARRE') {
      totalMeasure = pieceCount * (itemLength / barLength);
    } else {
      totalMeasure = pieceCount;
    }

    const finalCost = totalMeasure * itemPrice;

    shutterPack.push({
      ...item,
      itemKey: key,
      name: displayName + nameSuffix,
      qty: pieceCount,
      totalMeasure: totalMeasure * (unitUpper === 'ML' || unitUpper === 'M' || unitUpper === 'JOINT' ? 1000 : 1), 
      length: itemLength,
      barLength: barLength,
      price: itemPrice,
      priceUnit: item.priceUnit,
      resolvedFormula: `${this.resolveFormula(item.formula || '1', evalScope)} x [${this.resolveFormula(item.cuttingFormula || 'L/H', evalScope)}]`,
      usage: 'VOLET ROULANT',
      cost: finalCost
    });

    // 6. Process Add-ons
    if (item.addOns && Array.isArray(item.addOns)) {
      item.addOns.forEach(addon => {
        // Compatibility Check for Add-on
        if (addon.compatibilityFormula) {
          const isCompatible = this.evaluate(addon.compatibilityFormula, evalScope, `Compatibilité Add-on ${addon.name}`);
          if (!isCompatible) return;
        }
        const addonQty = this.evaluate(addon.formula || '1', evalScope);
        if (addonQty > 0) {
          const addonPrice = addon.price || 0;
          const addonUnit = (addon.unit || 'Unité').toUpperCase();
          let addonCost = (addonUnit === 'BARRE') ? (addonQty / 6400 * addonPrice) : (addonQty * addonPrice);
          shutterPack.push({
            id: `${item.id}-addon-${(addon.name || 'opt').replace(/\s+/g, '-').toLowerCase()}`,
            name: `Add-on (${item.name}): ${addon.name}`,
            qty: addonQty,
            priceUnit: addon.unit || 'Unité',
            price: addonPrice,
            formula: addon.formula || '1',
            cost: addonCost
          });
        }
      });
    }

    // 7. Baguette
    if (key === 'lameId' && config.shutterConfig?.enableBaguette) {
      const bPrice = item.baguettePrice || 0;
      const bCost = pieceCount * (itemLength / 1000) * bPrice;
      shutterPack.push({
        id: `${item.id}-baguette`,
        itemKey: 'baguetteId',
        name: `Baguette pour ${item.name}`,
        qty: pieceCount,
        length: itemLength,
        priceUnit: 'ML',
        price: bPrice,
        cost: bCost
      });
    }
  }

  /**
   * Calculate BOM (Bill of Materials) for a given configuration
   */

  calculateCompoundBOM(config, L, H, totalH, originalL = null) {
    const { compoundType, compoundConfig } = config;
    if (!compoundConfig || !compoundConfig.parts) return { profiles: [], accessories: [], glasses: [] };
    const { parts, unionId, traverseId, orientation } = compoundConfig;

    const results = { profiles: [], accessories: [], glasses: [] };
    const isVerticalSplit = orientation === 'horizontal'; // Côte à côte = séparation verticale

    // --- 1. GLOBAL FRAME ---
    const mainOp = (parts || []).find(p => p.type === 'opening' && p.compositionId) || 
                   (parts || []).find(p => p.compositionId) || 
                   (parts || [])[0];
    const frameCompId = (mainOp && mainOp.compositionId) || config.compositionId || '';
    
    const isMultiChassis = (compoundType === 'fix_coulissant');
    
    if (frameCompId && !isMultiChassis) {
       const globalOpt = config.optionalSides || { top: true, bottom: true, left: true, right: true };
       const frameRes = this.calculateComponentBOM(config, L, H, frameCompId, config.glassId, globalOpt, totalH, originalL || L, totalH);
       
       const isCouvreJointFn = p => /couvres?[- ]?joints?|cj[vh]?/i.test(((p.label || '') + ' ' + (p.name || '')).toLowerCase());
       const isDormantFn = p => /dormant|cadre|chassis|batit|dorme/i.test(((p.label || '') + ' ' + (p.name || '')).toLowerCase());

       const frameProfiles = frameRes.profiles.filter(p => isDormantFn(p) || isCouvreJointFn(p)).map(p => ({ ...p, source: 'Cadre Global' }));
       results.profiles.push(...frameProfiles);
       results.accessories.push(...frameRes.accessories.filter(a => isDormantFn(a) || isCouvreJointFn(a)).map(a => ({ ...a, source: 'Cadre Global' })));
    }

    // --- 2. DIVIDER SETUP ---
    const normalize = (s) => (s || '').replace(/[-\s]+/g, '').toLowerCase();
    const currentNormRangeId = normalize(config.rangeId);
    
    let effectiveDivId = (compoundType === 'fix_coulissant') ? unionId : traverseId;
    if (effectiveDivId === 'AUTO') {
      const targetRole = isVerticalSplit ? 'traverse_v' : 'traverse_h';
      const dividerEntry = (this.db.traverses || []).find(t => 
        (t.role === targetRole || t.type === targetRole) && 
        (t.rangeIds || []).some(rid => normalize(rid) === currentNormRangeId)
      );
      if (dividerEntry) effectiveDivId = dividerEntry.profileId;
    }

    const divProfile = (this.db.profiles || []).find(p => p.id === effectiveDivId);
    let divThick = divProfile?.thickness;

    if (!divThick) {
        // Fallback 1: Regex on name (e.g., "Traverse 25" -> 25)
        const nameMatch = (divProfile?.name || '').match(/(\d+)/);
        if (nameMatch) {
            divThick = parseInt(nameMatch[0]);
        } else {
            // Fallback 2: Check standard traverses for a match
            const trvEntry = (this.db.traverses || []).find(t => t.id === effectiveDivId || t.profileId === effectiveDivId);
            divThick = trvEntry?.thickness || 25; // Default to 25 (user standard)
        }
    }

    // --- 3. RECURSIVE PROCESSING ---
    const processPartList = (partList, boxL, boxH, direction) => {
      const isDividerHorizontal = direction === 'vertical';
      const divQty = (partList || []).length - 1;

      if (divQty > 0) {
        const len = isDividerHorizontal ? boxL : boxH;
        let prof = divProfile || { id: 'TRAVERSE-TMP', name: 'Traverse à définir', pricePerBar: 0, weightPerM: 0 };
        let cost = prof.pricePerBar ? (len / prof.barLength * prof.pricePerBar) : ((len/1000) * (prof.weightPerM||0) * (prof.pricePerKg||0));
        
        results.profiles.push({
          ...prof,
          label: compoundType === 'fix_coulissant' ? 'Profilé d\'Union' : `Traverse ${isDividerHorizontal ? 'Horiz.' : 'Vert.'}`,
          source: 'Jonction',
          formula: isDividerHorizontal ? 'L' : 'H',
          resolvedFormula: `${len} mm`,
          unitPrice: prof.pricePerBar ? (prof.pricePerBar / (prof.barLength || 6000)) : ((prof.weightPerM||0) * (prof.pricePerKg||0) / 1000),
          qty: divQty, length: len, totalMeasure: len * divQty, cost: cost * divQty
        });
      }

      // 1. Pre-calculate raw dimensions for all parts
      const items = (partList || []).map((part, idx) => {
        const overrideW = config.partOverrides?.[part.id]?.width;
        const overrideH = config.partOverrides?.[part.id]?.height;
        return {
          ...part,
          idx,
          rawL: Number((direction === 'horizontal') ? (overrideW || part.width || (boxL / partList.length)) : boxL),
          rawH: Number((direction === 'vertical') ? (overrideH || part.height || (boxH / partList.length)) : boxH)
        };
      });

      // 2. Adjust dimensions if they exceed available space (e.g. caisson deduction)
      const available = (direction === 'horizontal' ? boxL : boxH);
      // User requested NOT to deduct divider thickness from the available space for part calculation
      const totalRequested = items.reduce((sum, item) => sum + (direction === 'horizontal' ? item.rawL : item.rawH), 0);

      if (totalRequested > available + 0.1) {
        const excess = totalRequested - available;
        const flexibleItems = items.filter(it => it.type !== 'fixe');
        
        if (flexibleItems.length > 0) {
          const totalFlex = flexibleItems.reduce((sum, it) => sum + (direction === 'horizontal' ? it.rawL : it.rawH), 0);
          flexibleItems.forEach(it => {
            const weight = totalFlex > 0 ? (direction === 'horizontal' ? it.rawL : it.rawH) / totalFlex : (1 / flexibleItems.length);
            if (direction === 'horizontal') it.rawL -= excess * weight;
            else it.rawH -= excess * weight;
          });
        } else {
          // Fallback: Proportional reduction if all parts are fixed
          const scale = available / totalRequested;
          items.forEach(it => {
            if (direction === 'horizontal') it.rawL *= scale;
            else it.rawH *= scale;
          });
        }
      }

      // 3. Process each item with adjusted dimensions
      items.forEach((part, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === items.length - 1;
        
        let calcL = part.rawL;
        let calcH = part.rawH;

        let inflation = (!isFirst) ? (divThick / 2) : 0;
        const hasFixeInOriginal = partList.some(p => p.type === 'fixe');
        if (hasFixeInOriginal) {
            // If there's a fixed part, it absorbs the divider thickness
            inflation = (part.type === 'fixe') ? divThick : 0;
        }

        if (direction === 'horizontal') {
           calcL += inflation;
        } else {
           calcH += inflation;
        }

        if (part.type === 'group' && part.subParts) {
           processPartList(part.subParts, calcL, calcH, direction === 'horizontal' ? 'vertical' : 'horizontal');
           return;
        }

        const compId = part.compositionId || frameCompId;
        const subPartOpt = isMultiChassis 
          ? { ...(config.optionalSides || { top: true, bottom: true, left: true, right: true }), isSubPart: false } 
          : { top: false, bottom: false, left: false, right: false, isSubPart: true };
        
        const res = this.calculateComponentBOM(config, calcL, calcH, compId, part.glassId || config.glassId, subPartOpt, calcH, Number(originalL || L), totalH, isMultiChassis ? 0 : divThick);
        const sourceLabel = `Partie ${idx + 1} (${part.type})`;

        const filterFn = (i) => {
           if (compoundType === 'fix_coulissant') return true; // In multi-chassis, we keep everything (each has its frame)
           
           const s = ((i.label || '') + ' ' + (i.name || '')).toLowerCase();
           if (s.includes('parclose') || s.includes('joint')) return true;
           if (i.isCouvreJoint) return false;
           if (['dormant', 'cadre', 'batit', 'dorme'].some(t => s.includes(t))) return false;
           if (part.type === 'fixe' && ['ouvrant', 'vantail', 'chicane', 'panneau', 'reducteur', 'poignee', 'cremone', 'paumelle', 'galet', 'serrure'].some(t => s.includes(t))) return false;
           return true;
        };

        results.profiles.push(...(res.profiles || []).filter(filterFn).map(p => ({ ...p, source: sourceLabel })));
        results.accessories.push(...(res.accessories || []).filter(filterFn).map(a => ({ ...a, source: sourceLabel })));
        if (res.gasket) results.accessories.push({ ...res.gasket, source: sourceLabel });
        if (res.glass) results.glasses.push({ ...res.glass, source: sourceLabel });
      });
    };

    processPartList(parts, L, H, orientation);
    return results;
  }

  calculateBOM(config) {
    if (!this.db || !config) return { profiles: [], accessories: [], glasses: [], shutters: [] };
    let { L, H, glassId } = config;
    
    const isOnlyShutter = !!config.isOnlyShutter;
    let widthReduction = 0;

    if (!isOnlyShutter && config.hasShutter && config.shutterConfig) {
      const sc = this.db.shutterComponents;
      
      // FIX: Use overridden glissiereId if present
      let gid = config.shutterOverrides?.glissiereId || config.shutterConfig.glissiereId;

      if (gid === 'AUTO') {
        const kitId = config.shutterConfig.kitId;
        const type = kitId === 'KIT-SANG' ? 'MONO' : (kitId === 'KIT-MOTE' ? 'PALA' : 'OTHER');
        
        let compForRange = (config.compoundType && config.compoundType !== 'none' && config.compoundConfig?.parts?.length > 0)
          ? (this.db.compositions || []).find(c => c.id === (config.compoundConfig.parts.find(p => p.type === 'opening' && p.compositionId) || config.compoundConfig.parts[0])?.compositionId)
          : (this.db.compositions || []).find(c => c.id === config.compositionId);

        if (compForRange) {
          const autoG = (sc.glissieres || []).find(g => 
             (!g.rangeId || g.rangeId === compForRange.rangeId) && 
             g.shutterType === type
          );
          if (autoG) gid = autoG.id;
        }
      }

      const gDef = (sc.glissieres || []).find(x => x.id === gid);
      if (gDef) {
        if (gDef.thickness != null && gDef.thickness !== '') {
          widthReduction = parseFloat(gDef.thickness) || 0;
        } else if (gDef.shutterType === 'MONO') {
          widthReduction = 90;
        }
      }
    }

    const initialL = L;

    if (widthReduction > 0) {
      L -= widthReduction;
    }
    
    // --- 4. PREPARE DIMENSIONS ---
    let shutterHeight = 0;
    if (config.hasShutter) {
      const shutterConfig = config.shutterConfig || {};
      if (config.shutterOverrides?.customHC) {
        shutterHeight = config.shutterOverrides.customHC;
      } else {
        // FIX: Use overridden caissonId if present
        const effectiveCaissonId = config.shutterOverrides?.caissonId || shutterConfig.caissonId;
        const caisson = (this.db.shutterComponents?.caissons || []).find(c => c.id === effectiveCaissonId);
        shutterHeight = parseFloat(caisson?.height) || 0;
      }
    }

    const totalH = H;
    const windowH = isOnlyShutter ? 0 : Math.max(0, H - shutterHeight);

    let profiles = [];
    let accessories = [];
    let glasses = [];

    if (!isOnlyShutter) {
      if (config.compoundType && config.compoundType !== 'none') {
        const compRes = this.calculateCompoundBOM(config, L, windowH, totalH, initialL);
        profiles = compRes.profiles;
        accessories = compRes.accessories;
        glasses = compRes.glasses;
      } else if (config.useCustomLayout && config.customLayout && config.customLayout.cols) {
        const gridResults = this.calculateGridBOM(config.customLayout, L, windowH, config, totalH, initialL, totalH);
        profiles = gridResults.profiles;
        accessories = gridResults.accessories;
        glasses = gridResults.glasses;
      } else {
        const res = this.calculateComponentBOM(config, L, windowH, config.compositionId, glassId, config.optionalSides, totalH, initialL, totalH);
        profiles = res.profiles;
        accessories = res.accessories;
        if (res.gasket) accessories.push(res.gasket);
        if (res.glass) glasses.push(res.glass);
      }
    }

    // 5. Précadre Filter: Remove only chevilles if pre-frame installation is selected
    let activeAccessories = [...accessories];
    if (config.hasPrecadre) {
      activeAccessories = activeAccessories.filter(a => {
        const searchStr = ((a.name || '') + ' ' + (a.label || '')).toLowerCase();
        return !searchStr.includes('cheville');
      });
    }

    // 6. Global Options & Variantes processing on the accumulated accessories
    if (!isOnlyShutter && config.selectedOptions && config.selectedOptions.length > 0) {
      config.selectedOptions.forEach(optId => {
        const option = this.db.options?.find(o => o.id === optId);
        if (option) {
          // Remove if a replacement is specified
          if (option.removeAccessoryId) {
            activeAccessories = activeAccessories.filter(a => a.id !== option.removeAccessoryId);
          }
          // Add the option accessory
          if (option.addAccessoryId) {
            const addRef = (this.db.accessories || []).find(a => a.id === option.addAccessoryId);
            if (addRef) {
              const optionSide = config.optionSides?.[optId] || 'both';
              const sideFactor = (optionSide === 'gauche' || optionSide === 'droit') ? 0.5 : 1.0;
              
              const rawQty = this.evaluate(option.formula || '1', { L, H });
              const qty = rawQty * sideFactor;
              
              activeAccessories.push({
                ...addRef,
                label: `Option: ${option.name}${optionSide !== 'both' ? ' (' + optionSide + ')' : ''}`,
                qty: qty,
                formula: option.formula || '1',
                cost: qty * (addRef.price || 0),
                side: optionSide
              });
            }
          }
        }
      });
    }

    // 6. Volet Roulant
    let shutterL = config.shutterOverrides?.customLV || initialL;
    let shutterH_val = isOnlyShutter ? H : windowH;
    
    if (!isOnlyShutter && config.compoundType && config.compoundType !== 'none' && config.compoundConfig?.shutterMode === 'opening_only') {
       const opPart = config.compoundConfig.parts?.find(p => p.type === 'opening');
       if (opPart) {
          if (config.compoundConfig.orientation !== 'vertical') {
             shutterL = config.shutterOverrides?.customLV || opPart.width;
          } else {
             shutterH_val = opPart.height;
          }
       }
    }

    const vars = { 
      L: shutterL, 
      H: shutterH_val, 
      HC: config.shutterOverrides?.customHC || shutterHeight, 
      HT: H,
      caissonSize: 0,
      axeSize: 0,
      kitId: config.shutterConfig?.kitId,
      caissonId: config.shutterConfig?.caissonId,
      axeId: config.shutterConfig?.axeId,
      lameId: config.shutterConfig?.lameId,
      openingDirection: config.openingDirection || 'gauche'
    };
    
    const sc = this.db.shutterComponents || {};

    if (vars.caissonId) {
      const c = (sc.caissons || []).find(x => x.id === vars.caissonId);
      if (c) vars.caissonSize = parseFloat(c.height) || parseFloat(c.thickness) || 0;
    }
    if (vars.axeId) {
      const a = (sc.axes || []).find(x => x.id === vars.axeId);
      if (a) vars.axeSize = parseFloat(a.diameter) || parseFloat((a.name || "").match(/\d+/)?.[0]) || 0;
    }
    const shutterPack = [];
    if (config.hasShutter && config.shutterConfig && this.db.shutterComponents) {
      const sc = this.db.shutterComponents;
      const families = [
        { key: 'caissonId',    source: sc.caissons },
        { key: 'lameId',       source: sc.lames },
        { key: 'lameFinaleId', source: sc.lameFinales },
        { key: 'glissiereId',  source: sc.glissieres },
        { key: 'axeId',        source: sc.axes },
        { key: 'moteurId',     source: sc.moteurs },
        { key: 'kitId',        source: sc.kits }
      ];

      families.forEach(({ key, source }) => {
        let selectedId = config.shutterOverrides?.[key] || config.shutterConfig[key];
        
        // Resolve AUTO glissière
        if (key === 'glissiereId' && selectedId === 'AUTO') {
          const kitId = config.shutterConfig.kitId;
          const type = kitId === 'KIT-SANG' ? 'MONO' : (kitId === 'KIT-MOTE' ? 'PALA' : 'OTHER');
          
          let compositionId = config.compositionId;
          if (!compositionId && config.compoundConfig?.parts) {
             const parts = config.compoundConfig.parts;
             compositionId = (parts.find(p => p.type === 'opening' && p.compositionId) || parts.find(p => p.compositionId))?.compositionId;
          }

          const composition = (this.db.compositions || []).find(c => c.id === compositionId);
          if (composition) {
            const autoG = (source || []).find(g => (!g.rangeId || g.rangeId === composition.rangeId) && g.shutterType === type);
            if (autoG) selectedId = autoG.id;
          }
        }

        const item = (source || []).find(x => x.id === selectedId);
        if (item) {
          this.processShutterComponent(item, vars, shutterPack, key, config);
        }
      });

      // 7. Automatic Shutter Extras (All components in 'extras' category)
      if (sc.extras && Array.isArray(sc.extras)) {
        sc.extras.forEach(extra => {
           this.processShutterComponent(extra, vars, shutterPack, 'extraId', config);
        });
      }
    }

    // --- AGGREGATION PRE-PASS (for UI summaries) ---
    
    // Aggregated Gasket (Singular field for compatibility if needed, but we don't pull it out of accessories anymore)
    let finalGasket = null;

    // Aggregated Glass (Singular field for UI)
    let finalGlass = { name: 'Vitrage', area: 0, weight: 0, cost: 0, qty: 0 };
    if (glasses.length > 0) {
      finalGlass = {
        ...glasses[0],
        name: glasses.length > 1 ? `Mixte (${glasses.length} panneaux)` : glasses[0].name,
        qty: glasses.reduce((sum, g) => sum + (g.qty || 0), 0),
        area: glasses.reduce((sum, g) => sum + (g.area || 0), 0),
        weight: glasses.reduce((sum, g) => sum + (g.weight || 0), 0),
        cost: glasses.reduce((sum, g) => sum + (g.cost || 0), 0)
      };
    }

    const bom = {
      profiles,
      glass: finalGlass,
      glassDetails: glasses,
      gasket: finalGasket,
      accessories: activeAccessories,
      shutters: shutterPack
    };

    return this.mergeBOM(bom);
  }


  /**
   * Calculate final pricing
   */
  calculatePrice(config) {
    if (!this.db || !config) return { cost: 0, priceHT: 0, priceTTC: 0, subtotals: {}, bom: { profiles: [], accessories: [], glass: {}, shutters: [] } };
    const bom = this.calculateBOM(config);
    const color = (this.db.colors || []).find(c => c.id === config.colorId);
    
    // Subtotals (Raw material costs)
    const profilesRaw = bom.profiles.reduce((sum, p) => sum + p.cost, 0);
    
    // Separate gaskets from other accessories for clear subtotal reporting
    const gasketsOnly = bom.accessories.filter(a => a.isGlassGasket);
    const accessoriesOnly = bom.accessories.filter(a => !a.isGlassGasket);
    
    const accessoriesTotal = accessoriesOnly.reduce((sum, a) => sum + (a.cost || 0), 0);
    const gasketTotal = (bom.gasket ? bom.gasket.cost : 0) + gasketsOnly.reduce((sum, g) => sum + (g.cost || 0), 0);
    
    const glassTotal = bom.glass ? bom.glass.cost : 0;
    const shutterTotal = (bom.shutters || []).reduce((sum, s) => sum + (s.cost || 0), 0);

    // Apply color factor ONLY to profiles
    const profilesTotal = profilesRaw * (color ? color.factor : 1.0);
    
    // Total cost (Revient)
    const totalRevient = profilesTotal + accessoriesTotal + glassTotal + gasketTotal + shutterTotal;
    
    const margin = config.margin || (this.db.margins?.default || 2.2);
    const priceHT = totalRevient * margin;
    
    return {
      cost: totalRevient,
      subtotals: {
        profiles: profilesTotal,
        accessories: accessoriesTotal,
        glass: glassTotal,
        gasket: gasketTotal,
        shutter: shutterTotal
      },
      priceHT,
      priceTTC: priceHT * 1.20,
      bom
    };
  }

  /**
   * Check if configuration is valid within technical limits
   */
  validate(config) {
    if (config.useCustomLayout) return { valid: true }; // Custom layouts skip basic range checks for now

    // If it's an assemblage, the global compositionId might be empty (Automatic)
    const isAssemblage = config.compoundType && config.compoundType !== 'none';
    const composition = (this.db.compositions || []).find(c => c.id === config.compositionId);
    
    if (!composition && !isAssemblage) return { valid: false, message: 'Composition inexistante' };

    const range = composition ? (this.db.ranges || []).find(r => r.id === composition.rangeId) : null;
    if (!range && !isAssemblage) return { valid: false, message: 'Gamme inexistante' };

    const glass = (this.db.glass || []).find(g => g.id === config.glassId);
    if (!glass) return { valid: false, message: 'Vitrage selectionné inexistant' };

    const color = (this.db.colors || []).find(c => c.id === config.colorId);
    if (!color) return { valid: false, message: 'Couleur selectionnée inexistante' };

    const { L, H } = config;
    if (range) {
       if (L < range.minL || L > range.maxL) {
         return { valid: false, message: `Largeur hors limites (${range.minL}-${range.maxL} mm)` };
       }
       if (H < range.minH || H > range.maxH) {
         return { valid: false, message: `Hauteur hors limites (${range.minH}-${range.maxH} mm)` };
       }
    }

    return { valid: true };
  }

  mergeBOM(bom) {
    const merge = (list, keyFields) => {
       const map = new Map();
       list.forEach(item => {
          // Include source in key to keep parts separate if they have different sources
          const fields = [...keyFields];
          if (item.source) fields.push('source');
          
          const key = fields.map(f => {
              const val = item[f];
              if (f === 'length' && typeof val === 'number') return Math.round(val);
              return val;
          }).join('|');
          
          if (map.has(key)) {
             const existing = map.get(key);
             existing.qty = (existing.qty || 0) + (item.qty || 0);
             existing.cost = (existing.cost || 0) + (item.cost || 0);
             if (existing.area !== undefined) existing.area = (existing.area || 0) + (item.area || 0);
             if (existing.weight !== undefined) existing.weight = (existing.weight || 0) + (item.weight || 0);
             if (existing.totalMeasure !== undefined) existing.totalMeasure = (existing.totalMeasure || 0) + (item.totalMeasure || 0);
             
             // Merge sources (fallback if not in key)
             if (!fields.includes('source')) {
                if (item.source && existing.source) {
                   const sources = new Set([...existing.source.split(', '), item.source]);
                   existing.source = Array.from(sources).join(', ');
                } else if (item.source) {
                   existing.source = item.source;
                }
             }
          } else {
             map.set(key, { ...item });
          }
       });
       return Array.from(map.values());
    };

    return {
       ...bom,
       profiles: merge(bom.profiles || [], ['id', 'length', 'label']),
       accessories: merge(bom.accessories || [], ['id', 'label']),
       glassDetails: merge(bom.glassDetails || bom.glasses || [], ['id', 'label', 'width', 'height'])
    };
  }
}
