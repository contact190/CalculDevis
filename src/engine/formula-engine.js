import { create, all } from 'mathjs';

const math = create(all);

/**
 * Formula Engine for Joinery Configurator
 */
export class FormulaEngine {
  constructor(database) {
    this.db = database;
  }

  evaluate(formula, scope, errorContext = '') {
    if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0;
    try {
      // Support French style commas by replacing them with dots
      let cleanFormula = formula.replace(/,/g, '.');
      // If trailing operators exist, mathjs fails, let's catch it
      return math.evaluate(cleanFormula, scope);
    } catch (error) {
      console.error(`Faute dans la formule (${errorContext}): "${formula}" \n ${error.message}`);
      // Return NaN so it propagates and we can flag it
      return NaN;
    }
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
    return resolved;
  }

  /**
   * Calculate BOM for a single component (used by global BOM or individual cells)
   */
  calculateComponentBOM(config, L, H, compositionId, glassId, optionalSides, totalH = null, originalL = null, originalH = null) {
    const composition = this.db.compositions.find(c => c.id === compositionId);
    if (!composition) return { profiles: [], accessories: [], glass: null, gasket: null };

    const profiles = [];
    const accessories = [];
    const scope = { L, H };
    const originalScope = { L: originalL || L, H: originalH || H };

    const expandedElements = [];

    composition.elements.forEach(el => {
      let label = el.label || '';
      let itemName = '';
      
      if (el.type === 'profile') {
        const p = this.db.profiles.find(x => x.id === el.id);
        if (p) itemName = p.name || '';
      } else if (el.type === 'accessory') {
        const a = this.db.accessories.find(x => x.id === el.id);
        if (a) itemName = a.name || '';
      }

      const searchStr = (label + ' ' + itemName).toLowerCase();
      const isCouvreJoint = /couvres?[- ]?joints?|cj[vh]?/i.test(searchStr);
      const isDormant = /dormant|cadre|chassis/i.test(searchStr) && !searchStr.includes('ouvrant') && !searchStr.includes('chicane');

      if (!isCouvreJoint && !isDormant) {
        expandedElements.push({ ...el, isCouvreJoint: false });
        return;
      }

      const isHorizontal = /haut|bas|h$|\bh\b|cjh|couvres?[- ]?joints?h/i.test(searchStr);
      const isVertical = /gauche|droite|v$|\bv\b|cjv|couvres?[- ]?joints?v/i.test(searchStr);
      const baseLabel = label || itemName;
      const isActuallyCouvreJoint = isCouvreJoint;

      if (isHorizontal) {
        const hasHaut = searchStr.includes('haut');
        const hasBas = searchStr.includes('bas');
        const isGenericH = !hasHaut && !hasBas;
        
        if (isGenericH) {
          if (optionalSides.top) expandedElements.push({ ...el, label: baseLabel + ' (Haut)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint });
          if (optionalSides.bottom) expandedElements.push({ ...el, label: baseLabel + ' (Bas)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint });
        } else {
          if (hasHaut && optionalSides.top) expandedElements.push({ ...el, isCouvreJoint: isActuallyCouvreJoint });
          if (hasBas && optionalSides.bottom) expandedElements.push({ ...el, isCouvreJoint: isActuallyCouvreJoint });
        }
      } else if (isVertical) {
        const hasGauche = searchStr.includes('gauche');
        const hasDroite = searchStr.includes('droite');
        const isGenericV = !hasGauche && !hasDroite;

        if (isGenericV) {
          if (optionalSides.left) expandedElements.push({ ...el, label: baseLabel + ' (Gauche)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint });
          if (optionalSides.right) expandedElements.push({ ...el, label: baseLabel + ' (Droite)', qty: el.qty / 2, isCouvreJoint: isActuallyCouvreJoint });
        } else {
          if (hasGauche && optionalSides.left) expandedElements.push({ ...el, isCouvreJoint: isActuallyCouvreJoint });
          if (hasDroite && optionalSides.right) expandedElements.push({ ...el, isCouvreJoint: isActuallyCouvreJoint });
        }
      } else {
        // Generic 4-sided (like a dormant defined as 4qty but one formula)
        const vFormula = (el.formula === 'L' || !el.formula) ? 'H' : el.formula;
        if (optionalSides.top) expandedElements.push({ ...el, label: baseLabel + ' (Haut)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint });
        if (optionalSides.bottom) expandedElements.push({ ...el, label: baseLabel + ' (Bas)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint });
        if (optionalSides.left) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Gauche)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint });
        if (optionalSides.right) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Droite)', qty: el.qty / 4, isCouvreJoint: isActuallyCouvreJoint });
      }
    });

    expandedElements.forEach(el => {
      let elQty = el.qty;
      const isAccessory = el.type === 'accessory';
      const formulaRaw = el.formula != null ? String(el.formula) : '';
      const formulaStr = (formulaRaw.trim() !== '') ? formulaRaw : (isAccessory ? '1' : '');
      
      // Use totalH for Couvre Joint if available. Use originalScope for Couvre-Joint profiles.
      let currentScope = (el.isCouvreJoint && totalH !== null) ? { L, H: totalH, HC: totalH - H } : scope;
      if (el.isCouvreJoint) {
        currentScope = { ...currentScope, ...originalScope };
      }
      
      const value = this.evaluate(formulaStr, currentScope, el.label || itemName);
      const isError = isNaN(value);
      const safeValue = isError ? 0 : value;
      const qty = safeValue * elQty;

      if (el.type === 'profile') {
        const pRef = this.db.profiles.find(p => p.id === el.id);
        if (pRef) {
          let unitPrice = 0;
          let cost = 0;
          
          if (pRef.pricePerBar) {
            unitPrice = pRef.pricePerBar;
            cost = (qty / (pRef.barLength || 6000)) * unitPrice;
          } else if (pRef.pricePerKg) {
            unitPrice = pRef.pricePerKg;
            // (Length in m) * (kg/m) * (price/kg)
            cost = (qty / 1000) * (pRef.weightPerM || 1) * unitPrice;
          }

          profiles.push({
            ...pRef,
            label: el.label,
            qty: elQty,
            length: safeValue,
            formula: el.formula,
            resolvedFormula: this.resolveFormula(el.formula, scope),
            error: isError ? "Formule Invalide" : null,
            unitPrice: unitPrice,
            totalMeasure: safeValue * elQty,
            cost: cost
          });
        }
      } else if (el.type === 'accessory') {
        const aRef = this.db.accessories.find(a => a.id === el.id);
        if (aRef) {
          const unitUpper = (aRef.unit || '').toUpperCase();
          const isLinear = ['M', 'ML', 'JOINT'].includes(unitUpper);
          const finalQty = isLinear ? (qty / 1000) : qty;

          accessories.push({
            ...aRef,
            label: el.label,
            qty: finalQty,
            multiplier: el.qty || 1,
            formula: el.formula || '1',
            resolvedFormula: this.resolveFormula(el.formula || '1', scope),
            error: isError ? "Formule Invalide" : null,
            unitPrice: aRef.price || 0,
            totalMeasure: qty, // Total in mm or units
            cost: (finalQty || 0) * (aRef.price || 0)
          });
        }
      }
    });

    const glass = this.db.glass.find(g => g.id === glassId);
    let gasket = null;
    
    if (glass && composition.hasGasket) {
      const compatibility = this.db.gasketCompatibility.find(
        c => c.rangeId === composition.rangeId && c.glassThickness === glass.thickness
      );
      
      if (compatibility) {
        const gRef = this.db.accessories.find(a => a.id === compatibility.gasketId);
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

    const glassL = this.evaluate(composition.glassFormulaL || 'L', scope, 'Largeur Vitre');
    const glassH = this.evaluate(composition.glassFormulaH || 'H', scope, 'Hauteur Vitre');
    const glassQty = this.evaluate(composition.glassFormulaQty || '1', scope, 'Quantité Vitre');
    const glassArea = (((isNaN(glassL)?0:glassL) * (isNaN(glassH)?0:glassH)) / 1000000) * (isNaN(glassQty)?0:glassQty);
    const glassWeight = glass ? (glassArea * glass.weightPerM2) : 0;
    const glassCost = glass ? (glassArea * glass.pricePerM2) : 0;

    // Add Parcloses based on glass compatibility ONLY if not already present in profiles
    if (glass) {
      const hasManualParcloseH = profiles.some(p => p.label?.toLowerCase() === 'parcloseh');
      const hasManualParcloseV = profiles.some(p => p.label?.toLowerCase() === 'parclosev');
      
      const glassProfiles = this.db.glassProfileCompatibility?.filter(
        c => c.rangeId === composition.rangeId && c.glassThickness === glass.thickness
      ) || [];

      glassProfiles.forEach(gp => {
        // Handle Parclose Horizontal
        const pHRef = this.db.profiles.find(p => p.id === gp.profileHId);
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
        const pVRef = this.db.profiles.find(p => p.id === gp.profileVId);
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
          const pRef = this.db.profiles.find(p => p.id === trv.profileId);
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
          const pRef = this.db.profiles.find(p => p.id === trv.profileId);
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
              cost: pPrice
            });
          }
        }
      });
    }

    return { profiles, accessories, glasses };
  }

  processShutterComponent(item, vars, shutterPack, key = '', config = {}) {
    const { L, H, HC } = vars;
    const barLength = parseFloat(item.barLength) || 6400; // Default to 6400mm to match UI if not set
    
    // Rule: Couvre Joint reduction ONLY on the caisson length
    let itemScopeL = L;
    if (key === 'caissonId' && config.shutterConfig?.hasCouvreJoint) {
      itemScopeL -= 3;
    }

    const qty = this.evaluate(item.formula || '1', { L: itemScopeL, H, HC });
    if (qty <= 0) return;

    let itemPrice = item.price || 0;
    let displayName = item.name;

    // Handle Glissiere Params
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

    let finalCost = 0;
    const unitRaw = (item.priceUnit || 'Unité').toUpperCase().trim();
    
    if (unitRaw === 'BARRE') {
      finalCost = (qty / barLength) * itemPrice;
    } else if (unitRaw === 'ML' || unitRaw === 'M' || unitRaw === 'JOINT') {
      // If result is large (e.g. > 50), it's likely mm being used with an ML price
      const effectiveQty = qty > 50 ? qty / 1000 : qty;
      finalCost = effectiveQty * itemPrice;
    } else {
      finalCost = qty * itemPrice;
    }

    shutterPack.push({
      ...item,
      name: displayName,
      qty: qty,
      barLength: barLength,
      price: itemPrice,
      priceUnit: item.priceUnit,
      resolvedFormula: this.resolveFormula(item.formula || '1', { L: itemScopeL, H, HC }),
      cost: finalCost
    });

    // Process Add-ons
    if (item.addOns && Array.isArray(item.addOns)) {
      item.addOns.forEach(addon => {
        const addonQty = this.evaluate(addon.formula || '1', { L: itemScopeL, H, HC });
        if (addonQty > 0) {
          const addonPrice = addon.price || 0;
          const addonUnit = (addon.unit || 'Unité').toUpperCase();
          
          let addonCost = 0;
          if (addonUnit === 'BARRE') {
            // Find linked bar length or default
            let addBarLen = 6400;
            if (addon.linkedId) {
              const linkedArt = this.db.profiles.find(p => p.id === addon.linkedId) || 
                               (this.db.shutterComponents.lames || []).find(l => l.id === addon.linkedId) ||
                               (this.db.shutterComponents.glissieres || []).find(g => g.id === addon.linkedId);
              if (linkedArt && linkedArt.barLength) addBarLen = parseFloat(linkedArt.barLength);
            }
            addonCost = (addonQty / addBarLen) * addonPrice;
          } else {
            addonCost = addonQty * addonPrice;
          }

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

    // Baguette
    if (key === 'glissiereId' && item.hasBaguette && config.shutterConfig?.enableBaguette) {
      const baguettePrice = item.baguettePrice || 0;
      // Baguette is explicitly set to ML, so cost is simply qty * price
      const bCost = qty * baguettePrice;
      shutterPack.push({
        id: `${item.id}-baguette`,
        name: `Baguette pour ${item.name}`,
        qty: qty,
        barLength: barLength,
        priceUnit: 'ML',
        price: baguettePrice,
        cost: bCost
      });
    }
  }

  /**
   * Calculate BOM (Bill of Materials) for a given configuration
   */

  calculateCompoundBOM(config, L, H) {
    const { compoundType, compoundConfig } = config;
    if (!compoundConfig || !compoundConfig.parts) return { profiles: [], accessories: [], glasses: [] };
    const { parts, unionId, traverseId, orientation } = compoundConfig;

    const results = { profiles: [], accessories: [], glasses: [] };
    const isHorizontal = orientation !== 'vertical';
    
    const divProfile = this.db.profiles.find(p => p.id === (compoundType === 'fix_coulissant' ? unionId : traverseId));
    const divThick = divProfile?.thickness || 0;

    const processPartList = (partList, boxL, boxH, direction) => {
      const isH = direction !== 'vertical';
      const divQty = partList.length - 1;

      // Add Dividers for this level
      if (divProfile && divQty > 0) {
        const len = (isH ? boxH : boxL);
        const dCost = divProfile.pricePerBar ? (len / divProfile.barLength * divProfile.pricePerBar) : ((len/1000) * divProfile.weightPerM * divProfile.pricePerKg);
        results.profiles.push({
          ...divProfile,
          label: compoundType === 'fix_coulissant' ? 'Profilé d\'Union' : 'Traverse',
          source: 'Jonction',
          qty: divQty, length: len, cost: dCost * divQty
        });
      }

      partList.forEach((part, idx) => {
        let pW = isH ? (part.width || (boxL / partList.length)) : boxL;
        let pH = isH ? boxH : (part.height || (boxH / partList.length));
        const pGlassId = part.glassId || config.glassId;
        const sourceLabel = `Partie ${idx + 1}`;

        if (part.type === 'group' && part.subParts) {
           processPartList(part.subParts, pW, pH, isH ? 'vertical' : 'horizontal');
           return;
        }

        // Determine which sides share a divider
        const sides = { top: true, bottom: true, left: true, right: true };
        if (partList.length > 1) {
           if (isH) {
              if (idx > 0) sides.left = false;
              if (idx < partList.length - 1) sides.right = false;
           } else {
              if (idx > 0) sides.top = false;
              if (idx < partList.length - 1) sides.bottom = false;
           }
        }

        const compId = part.compositionId || config.compositionId || parts.find(p=>p.type==='opening')?.compositionId;
        const res = this.calculateComponentBOM(config, pW, pH, compId, pGlassId, sides, pH, pW, pH);
        
        results.profiles.push(...res.profiles.map(p => ({ ...p, source: sourceLabel })));
        results.accessories.push(...res.accessories.map(a => ({ ...a, source: sourceLabel })));
        if (res.gasket) results.accessories.push({ ...res.gasket, source: sourceLabel });
        if (res.glass) results.glasses.push({ ...res.glass, source: sourceLabel });
      });
    };

    processPartList(parts, L, H, orientation);
    return results;
  }

  calculateBOM(config) {
    let { L, H, glassId } = config;
    
    // --- GLOBAL TECHNICAL REDUCTION (Mono Glissiere) ---
    // If Mono glissiere is selected, the whole window (L) is reduced by 90mm
    let isGlissiereMono = false;
    if (config.hasShutter && config.shutterConfig) {
      const sc = this.db.shutterComponents;
      let gid = config.shutterConfig.glissiereId;
      if (gid === 'AUTO') {
        const kitId = config.shutterConfig.kitId;
        const type = kitId === 'KIT-SANG' ? 'MONO' : (kitId === 'KIT-MOTE' ? 'PALA' : 'OTHER');
        const composition = this.db.compositions.find(c => c.id === config.compositionId);
        if (composition) {
          const autoG = (sc.glissieres || []).find(g => (!g.rangeId || g.rangeId === composition.rangeId) && g.shutterType === type);
          if (autoG) gid = autoG.id;
        }
      }
      const gDef = (sc.glissieres || []).find(x => x.id === gid);
      if (gDef && gDef.shutterType === 'MONO') {
        isGlissiereMono = true;
      }
    }

    if (isGlissiereMono) {
      L -= 90;
    }
    
    // Rule 1: Couvre Joint (-12mm) -> ONLY FOR CAISSON, but let's handle it inside the shutter loop.
    
    // Determine shutter box height if applicable
    let shutterHeight = 0;
    if (config.hasShutter && config.shutterConfig?.caissonId) {
      const caisson = this.db.shutterComponents.caissons.find(c => c.id === config.shutterConfig.caissonId);
      shutterHeight = parseFloat(caisson?.height) || 0;
    }
    
    // The Joinery (Window) height is the total opening minus the shutter box
    const windowH = H - shutterHeight;

    let profiles = [];
    let accessories = [];
    let glasses = [];

    if (config.compoundType && config.compoundType !== 'none') {
      const compRes = this.calculateCompoundBOM(config, L, windowH);
      profiles = compRes.profiles;
      accessories = compRes.accessories;
      glasses = compRes.glasses;
    } else if (config.useCustomLayout && config.customLayout && config.customLayout.cols) {
      // For custom layouts, we'll pass original L/H for covers
      const gridResults = this.calculateGridBOM(config.customLayout, L, windowH, config, H, config.L, config.H);
      profiles = gridResults.profiles;
      accessories = gridResults.accessories;
      glasses = gridResults.glasses;
    } else {
      // Simple Mode (Classic) - Pass original H as totalH AND original L/H for covers
      const res = this.calculateComponentBOM(config, L, windowH, config.compositionId, glassId, config.optionalSides, H, config.L, config.H);
      profiles = res.profiles;
      accessories = res.accessories;
      if (res.gasket) accessories.push(res.gasket);
      if (res.glass) glasses.push(res.glass);
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
    if (config.selectedOptions && config.selectedOptions.length > 0) {
      config.selectedOptions.forEach(optId => {
        const option = this.db.options?.find(o => o.id === optId);
        if (option) {
          // Remove if a replacement is specified
          if (option.removeAccessoryId) {
            activeAccessories = activeAccessories.filter(a => a.id !== option.removeAccessoryId);
          }
          // Add the option accessory
          if (option.addAccessoryId) {
            const addRef = this.db.accessories.find(a => a.id === option.addAccessoryId);
            if (addRef) {
              const qty = this.evaluate(option.formula || '1', { L, H });
              activeAccessories.push({
                ...addRef,
                label: `Option: ${option.name}`,
                qty: qty,
                formula: option.formula || '1',
                cost: qty * addRef.price
              });
            }
          }
        }
      });
    }

    // 6. Volet Roulant
    let shutterL = L;
    let shutterH_val = windowH;
    
    if (config.compoundType && config.compoundType !== 'none' && config.compoundConfig?.shutterMode === 'opening_only') {
       const opPart = config.compoundConfig.parts?.find(p => p.type === 'opening');
       if (opPart) {
          if (config.compoundConfig.orientation !== 'vertical') {
             shutterL = opPart.width;
          } else {
             shutterH_val = opPart.height;
          }
       }
    }

    const vars = { L: shutterL, H: shutterH_val, HC: shutterHeight };
    const shutterPack = [];
    if (config.hasShutter && config.shutterConfig && this.db.shutterComponents) {
      const sc = this.db.shutterComponents;
      const families = [
        { key: 'caissonId',    source: sc.caissons },
        { key: 'lameId',       source: sc.lames },
        { key: 'lameFinaleId', source: sc.lamesFinales },
        { key: 'glissiereId',  source: sc.glissieres },
        { key: 'axeId',        source: sc.axes },
        { key: 'moteurId',     source: sc.moteurs },
        { key: 'kitId',        source: sc.kits }
      ];

      families.forEach(({ key, source }) => {
        let selectedId = config.shutterConfig[key];
        
        // Resolve AUTO glissière
        if (key === 'glissiereId' && selectedId === 'AUTO') {
          const kitId = config.shutterConfig.kitId;
          const type = kitId === 'KIT-SANG' ? 'MONO' : (kitId === 'KIT-MOTE' ? 'PALA' : 'OTHER');
          const composition = this.db.compositions.find(c => c.id === config.compositionId);
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

    // --- GROUPING & AGGREGATION ---
    
    // Group profiles by (Id + Label + Length)
    const groupedProfilesMap = {};
    profiles.forEach(p => {
      const key = `${p.id}-${p.label}-${p.length}`;
      if (!groupedProfilesMap[key]) {
        groupedProfilesMap[key] = { ...p };
      } else {
        groupedProfilesMap[key].qty += p.qty;
        groupedProfilesMap[key].cost += p.cost;
      }
    });

    // Group accessories by (Id + Label)
    const groupedAccessoriesMap = {};
    let finalGasket = null;
    
    activeAccessories.forEach(a => {
      if (a.isGlassGasket) {
        if (!finalGasket) {
          finalGasket = { ...a };
        } else {
          finalGasket.qty += a.qty;
          finalGasket.totalMeasure += (a.totalMeasure || 0);
          finalGasket.cost += a.cost;
        }
        return;
      }

      const key = `${a.id}-${a.label}`;
      if (!groupedAccessoriesMap[key]) {
        groupedAccessoriesMap[key] = { ...a };
      } else {
        groupedAccessoriesMap[key].qty += a.qty;
        groupedAccessoriesMap[key].cost += a.cost;
      }
    });

    // Finalize glass aggregation
    let finalGlass = { name: 'Vitrage', area: 0, weight: 0, cost: 0 };
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
      profiles: Object.values(groupedProfilesMap),
      glass: finalGlass,
      glassDetails: glasses,
      gasket: finalGasket,
      accessories: Object.values(groupedAccessoriesMap),
      shutters: shutterPack
    };

    return this.mergeBOM(bom);
  }


  /**
   * Calculate final pricing
   */
  calculatePrice(config) {
    const bom = this.calculateBOM(config);
    const color = this.db.colors.find(c => c.id === config.colorId);
    
    // Subtotals (Raw material costs)
    const profilesRaw = bom.profiles.reduce((sum, p) => sum + p.cost, 0);
    const accessoriesTotal = bom.accessories.reduce((sum, a) => sum + (a.cost || 0), 0);
    const glassTotal = bom.glass ? bom.glass.cost : 0;
    const gasketTotal = bom.gasket ? bom.gasket.cost : 0;
    const shutterTotal = (bom.shutters || []).reduce((sum, s) => sum + (s.cost || 0), 0);

    // Apply color factor ONLY to profiles
    const profilesTotal = profilesRaw * (color ? color.factor : 1.0);
    
    // Total cost of goods (Revient)
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

    const composition = this.db.compositions.find(c => c.id === config.compositionId);
    if (!composition) return { valid: false, message: 'Composition inexistante' };

    const range = this.db.ranges.find(r => r.id === composition.rangeId);
    if (!range) return { valid: false, message: 'Gamme inexistante' };

    const glass = this.db.glass.find(g => g.id === config.glassId);
    if (!glass) return { valid: false, message: 'Vitrage selectionné inexistant' };

    const color = this.db.colors.find(c => c.id === config.colorId);
    if (!color) return { valid: false, message: 'Couleur selectionnée inexistante' };

    const { L, H } = config;
    if (L < range.minL || L > range.maxL) {
      return { valid: false, message: `Largeur hors limites (${range.minL}-${range.maxL} mm)` };
    }
    if (H < range.minH || H > range.maxH) {
      return { valid: false, message: `Hauteur hors limites (${range.minH}-${range.maxH} mm)` };
    }

    return { valid: true };
  }

  mergeBOM(bom) {
    const merge = (list, keyFields) => {
       const map = new Map();
       list.forEach(item => {
          const key = keyFields.map(f => item[f]).join('|');
          if (map.has(key)) {
             const existing = map.get(key);
             existing.qty = (existing.qty || 0) + (item.qty || 0);
             existing.cost = (existing.cost || 0) + (item.cost || 0);
             if (existing.area !== undefined) existing.area += (item.area || 0);
             if (existing.weight !== undefined) existing.weight += (item.weight || 0);
             
             // Merge sources
             if (item.source && existing.source) {
                const sources = new Set([...existing.source.split(', '), item.source]);
                existing.source = Array.from(sources).join(', ');
             } else if (item.source) {
                existing.source = item.source;
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
       glasses: merge(bom.glasses || [], ['id', 'label', 'width', 'height'])
    };
  }
}
