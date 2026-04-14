import { create, all } from 'mathjs';

const math = create(all);

/**
 * Formula Engine for Joinery Configurator
 */
export class FormulaEngine {
  constructor(database) {
    this.db = database;
  }

  /**
   * Evaluate a formula string with context
   * @param {string} formula - e.g. "(L - 100) / 2"
   * @param {object} scope - { L: 1000, H: 2000 }
   */
  evaluate(formula, scope) {
    if (!formula || typeof formula !== 'string') return 0;
    try {
      // Support French style commas by replacing them with dots
      const cleanFormula = formula.replace(/,/g, '.');
      return math.evaluate(cleanFormula, scope);
    } catch (error) {
      console.error(`Error evaluating formula: ${formula}`, error);
      return 0;
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
  calculateComponentBOM(config, L, H, compositionId, glassId, optionalSides = {}) {
    const composition = this.db.compositions.find(c => c.id === compositionId);
    if (!composition) return { profiles: [], accessories: [], glass: null, gasket: null };

    const profiles = [];
    const accessories = [];
    const scope = { L, H };

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

      if (!isCouvreJoint) {
        expandedElements.push(el);
        return;
      }

      const isHorizontal = /haut|bas|h$|\bh\b|cjh|couvres?[- ]?joints?h/i.test(searchStr);
      const isVertical = /gauche|droite|v$|\bv\b|cjv|couvres?[- ]?joints?v/i.test(searchStr);
      const baseLabel = label || itemName;

      if (isHorizontal) {
        const hasHaut = searchStr.includes('haut');
        const hasBas = searchStr.includes('bas');
        const isGenericH = !hasHaut && !hasBas;
        
        if (isGenericH) {
          if (optionalSides.top) expandedElements.push({ ...el, label: baseLabel + ' (Haut)', qty: el.qty / 2 });
          if (optionalSides.bottom) expandedElements.push({ ...el, label: baseLabel + ' (Bas)', qty: el.qty / 2 });
        } else {
          if (hasHaut && optionalSides.top) expandedElements.push(el);
          if (hasBas && optionalSides.bottom) expandedElements.push(el);
        }
      } else if (isVertical) {
        const hasGauche = searchStr.includes('gauche');
        const hasDroite = searchStr.includes('droite');
        const isGenericV = !hasGauche && !hasDroite;

        if (isGenericV) {
          if (optionalSides.left) expandedElements.push({ ...el, label: baseLabel + ' (Gauche)', qty: el.qty / 2 });
          if (optionalSides.right) expandedElements.push({ ...el, label: baseLabel + ' (Droite)', qty: el.qty / 2 });
        } else {
          if (hasGauche && optionalSides.left) expandedElements.push(el);
          if (hasDroite && optionalSides.right) expandedElements.push(el);
        }
      } else {
        // Generic 4-sided
        const vFormula = (el.formula === 'L' || !el.formula) ? 'H' : el.formula;
        if (optionalSides.top) expandedElements.push({ ...el, label: baseLabel + ' (Haut)', qty: el.qty / 4 });
        if (optionalSides.bottom) expandedElements.push({ ...el, label: baseLabel + ' (Bas)', qty: el.qty / 4 });
        if (optionalSides.left) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Gauche)', qty: el.qty / 4 });
        if (optionalSides.right) expandedElements.push({ ...el, formula: vFormula, label: baseLabel + ' (Droite)', qty: el.qty / 4 });
      }
    });

    expandedElements.forEach(el => {
      let elQty = el.qty;
      const isAccessory = el.type === 'accessory';
      const formulaStr = (el.formula && el.formula.trim() !== '') ? el.formula : (isAccessory ? '1' : '');
      const value = this.evaluate(formulaStr, scope);
      const qty = value * elQty;

      if (el.type === 'profile') {
        const pRef = this.db.profiles.find(p => p.id === el.id);
        if (pRef) {
          const unitPrice = (pRef.pricePerBar || pRef.pricePerKg || 0);
          profiles.push({
            ...pRef,
            label: el.label,
            qty: elQty,
            length: value,
            formula: el.formula,
            resolvedFormula: this.resolveFormula(el.formula, scope),
            unitPrice: unitPrice,
            totalMeasure: value * elQty,
            cost: (qty / (pRef.barLength || 6000)) * unitPrice
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
          const lenMm = this.evaluate(formula, scope);
          const qtyMl = lenMm / 1000;
          
          gasket = {
            ...gRef,
            isGlassGasket: true,
            label: 'Joint de Vitrage',
            qty: qtyMl,
            formula: formula,
            resolvedFormula: this.resolveFormula(formula, scope),
            unitPrice: gRef.price || 0,
            totalMeasure: lenMm,
            cost: qtyMl * (gRef.price || 0)
          };
        }
      }
    }

    const glassL = this.evaluate(composition.glassFormulaL || 'L', scope);
    const glassH = this.evaluate(composition.glassFormulaH || 'H', scope);
    const glassQty = this.evaluate(composition.glassFormulaQty || '1', scope);
    const glassArea = ((glassL * glassH) / 1000000) * glassQty;
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
          const hValue = this.evaluate(formulaH, scope);
          const hQty = (gp.qtyH || 2) * glassQty;
          
          profiles.push({
            ...pHRef,
            label: 'ParcloseH',
            qty: hQty,
            length: hValue,
            formula: formulaH,
            resolvedFormula: this.resolveFormula(formulaH, scope),
            unitPrice: unitPrice,
            totalMeasure: hValue * hQty,
            cost: ((hValue * hQty) / (pHRef.barLength || 6000)) * unitPrice
          });
        }

        // Handle Parclose Vertical
        const pVRef = this.db.profiles.find(p => p.id === gp.profileVId);
        if (pVRef && !hasManualParcloseV) {
          const unitPrice = (pVRef.pricePerBar || pVRef.pricePerKg || 0);
          const formulaV = gp.formulaV || composition.glassFormulaH || 'H';
          const vValue = this.evaluate(formulaV, scope);
          const vQty = (gp.qtyV || 2) * glassQty;
          
          profiles.push({
            ...pVRef,
            label: 'ParcloseV',
            qty: vQty,
            length: vValue,
            formula: formulaV,
            resolvedFormula: this.resolveFormula(formulaV, scope),
            unitPrice: unitPrice,
            totalMeasure: vValue * vQty,
            cost: ((vValue * vQty) / (pVRef.barLength || 6000)) * unitPrice
          });
        }
      });
    }

    return {
      profiles,
      accessories,
      glass: glass ? {
        ...glass,
        width: glassL,
        height: glassH,
        qty: glassQty,
        area: glassArea,
        weight: glassWeight,
        cost: glassCost
      } : { name: 'Vitrage Manquant', width: 0, height: 0, qty: 0, area: 0, weight: 0, cost: 0 },
      gasket
    };
  }

  /**
   * Recursive grid BOM calculation (handles root and sub-layouts)
   */
  calculateGridBOM(grid, L, H, config) {
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
          const subRes = this.calculateGridBOM(cell.subLayout, Lc, Hc, config);
          profiles = [...profiles, ...subRes.profiles];
          accessories = [...accessories, ...subRes.accessories];
          glasses = [...glasses, ...subRes.glasses];
        } else {
          // Normal leaf cell
          const compId = cell.compositionId || config.compositionId;
          const glId = cell.glassId || config.glassId;

          const res = this.calculateComponentBOM(config, Lc, Hc, compId, glId, config.optionalSides);
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
            profiles.push({
              ...pRef,
              label: `Traverse Verticale (L:${Math.round(L)} H:${Math.round(H)})`,
              qty: 1,
              length: len,
              formula: 'H',
              cost: (len / (pRef.barLength || 6000)) * (pRef.pricePerBar || pRef.pricePerKg || 0)
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
            profiles.push({
              ...pRef,
              label: `Traverse Horizontale (L:${Math.round(L)} H:${Math.round(H)})`,
              qty: 1,
              length: len,
              formula: 'L',
              cost: (len / (pRef.barLength || 6000)) * (pRef.pricePerBar || pRef.pricePerKg || 0)
            });
          }
        }
      });
    }

    return { profiles, accessories, glasses };
  }

  /**
   * Calculate BOM (Bill of Materials) for a given configuration
   */
  calculateBOM(config) {
    const { L, H, glassId } = config;
    
    // Determine shutter box height if applicable
    let shutterHeight = 0;
    if (config.hasShutter && config.shutterConfig?.caissonId) {
      const caisson = this.db.shutterComponents.caissons.find(c => c.id === config.shutterConfig.caissonId);
      shutterHeight = caisson?.height || 0;
    }
    
    // The Joinery (Window) height is the total opening minus the shutter box
    const windowH = H - shutterHeight;

    let profiles = [];
    let accessories = [];
    let glasses = [];

    if (config.useCustomLayout && config.customLayout && config.customLayout.cols) {
      const gridResults = this.calculateGridBOM(config.customLayout, L, windowH, config);
      profiles = gridResults.profiles;
      accessories = gridResults.accessories;
      glasses = gridResults.glasses;
    } else {
      // Simple Mode (Classic)
      const res = this.calculateComponentBOM(config, L, windowH, config.compositionId, glassId, config.optionalSides);
      profiles = res.profiles;
      accessories = res.accessories;
      if (res.gasket) accessories.push(res.gasket);
      if (res.glass) glasses.push(res.glass);
    }

    // 5. Global Options & Variantes processing on the accumulated accessories
    let activeAccessories = [...accessories];
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
    const shutterPack = [];
    if (config.hasShutter && config.shutterConfig && this.db.shutterComponents) {
      const sc = this.db.shutterComponents;
      const families = [
        { key: 'caissonId',   source: sc.caissons },
        { key: 'lameId',      source: sc.lames },
        { key: 'glissiereId', source: sc.glissieres },
        { key: 'axeId',       source: sc.axes },
        { key: 'kitId',       source: sc.kits }
      ];
      families.forEach(({ key, source }) => {
        let selectedId = config.shutterConfig[key];
        
        // Resolve AUTO glissière
        if (key === 'glissiereId' && selectedId === 'AUTO') {
          const kitId = config.shutterConfig.kitId;
          const type = kitId === 'KIT-SANG' ? 'MONO' : (kitId === 'KIT-MOTE' ? 'PALA' : 'OTHER');
          const composition = this.db.compositions.find(c => c.id === config.compositionId);
          if (composition) {
            // Find universal or range-specific
            const autoG = (source || []).find(g => (!g.rangeId || g.rangeId === composition.rangeId) && g.shutterType === type);
            if (autoG) selectedId = autoG.id;
          }
        }

        const item = (source || []).find(x => x.id === selectedId);
        if (item) {
          const qty = this.evaluate(item.formula || '1', { L, H, HC: shutterHeight });
          
          let displayName = item.name;
          if (key === 'glissiereId' && item.options && config.shutterConfig.glissiereParams) {
            const params = config.shutterConfig.glissiereParams;
            const paramStrings = item.options.map(o => {
              const val = params[o.key] || (o.values && o.values[0]);
              return val ? `${o.label}: ${val}mm` : null;
            }).filter(Boolean);
            if (paramStrings.length > 0) {
              displayName += ` (${paramStrings.join(', ')})`;
            }
          }

          shutterPack.push({
            ...item,
            name: displayName,
            qty,
            resolvedFormula: this.resolveFormula(item.formula || '1', { L, H, HC: shutterHeight }),
            cost: qty * (item.price || 0)
          });
        }
      });
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

    return bom;
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
}
