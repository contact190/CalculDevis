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
    try {
      // Basic sanitization and evaluation
      return math.evaluate(formula, scope);
    } catch (error) {
      console.error(`Error evaluating formula: ${formula}`, error);
      return 0;
    }
  }

  /**
   * Calculate BOM for a single component (used by global BOM or individual cells)
   */
  calculateComponentBOM(config, L, H, compositionId, glassId, optionalSides = {}) {
    const composition = this.db.compositions.find(c => c.id === compositionId);
    if (!composition) return { profiles: [], accessories: [], glass: null, gasket: null };

    const profiles = [];
    const accessories = [];
    let totalGasketLength = 0;
    if (composition.hasGasket) {
      totalGasketLength = (L + H) * 2;
    }

    composition.elements.forEach(el => {
      const isCouvreJoint = el.label?.toLowerCase().includes('couvre-joint') || el.label?.toLowerCase().includes('couvre joint');
      if (isCouvreJoint) {
        const lowerLabel = el.label.toLowerCase();
        if (lowerLabel.includes('haut') && !optionalSides.top) return;
        if (lowerLabel.includes('bas') && !optionalSides.bottom) return;
        if (lowerLabel.includes('gauche') && !optionalSides.left) return;
        if (lowerLabel.includes('droite') && !optionalSides.right) return;
      }

      const value = this.evaluate(el.formula, { L, H });
      const qty = value * el.qty;

      if (el.type === 'profile') {
        const pRef = this.db.profiles.find(p => p.id === el.id);
        if (pRef) {
          profiles.push({
            ...pRef,
            label: el.label,
            qty: el.qty,
            length: value,
            formula: el.formula,
            cost: (qty / (pRef.barLength || 6000)) * (pRef.pricePerBar || pRef.pricePerKg || 0)
          });
        }
      } else if (el.type === 'accessory') {
        const aRef = this.db.accessories.find(a => a.id === el.id);
        if (aRef) {
          accessories.push({
            ...aRef,
            label: el.label,
            qty: qty,
            formula: el.formula,
            cost: qty * aRef.price
          });
        }
      }
    });

    const glass = this.db.glass.find(g => g.id === glassId);
    let gasket = null;
    let compatibility = null;
    
    if (glass) {
      compatibility = this.db.gasketCompatibility.find(
        c => c.rangeId === composition.rangeId && c.glassThickness === glass.thickness
      );
    }
    
    if (compatibility && totalGasketLength > 0) {
      const gRef = this.db.accessories.find(a => a.id === compatibility.gasketId);
      if (gRef) {
        const qty = totalGasketLength / 1000;
        gasket = {
          ...gRef,
          qty,
          cost: qty * gRef.price
        };
      }
    }

    if (glass) {
      const glassProfiles = this.db.glassProfileCompatibility?.filter(
        c => c.rangeId === composition.rangeId && c.glassThickness === glass.thickness
      ) || [];

      glassProfiles.forEach(gp => {
        const pRef = this.db.profiles.find(p => p.id === gp.profileId);
        if (pRef) {
          const value = this.evaluate(gp.formula || '(L+H)*2', { L, H });
          profiles.push({
            ...pRef,
            label: 'Parclose / Profilé Comp.',
            qty: 1,
            length: value,
            formula: gp.formula || '(L+H)*2',
            cost: (value / (pRef.barLength || 6000)) * (pRef.pricePerBar || pRef.pricePerKg || 0)
          });
        }
      });
    }

    const glassArea = (L * H) / 1000000;
    const glassWeight = glass ? (glassArea * glass.weightPerM2) : 0;
    const glassCost = glass ? (glassArea * glass.pricePerM2) : 0;

    return {
      profiles,
      accessories,
      glass: glass ? {
        ...glass,
        area: glassArea,
        weight: glassWeight,
        cost: glassCost
      } : { name: 'Vitrage Manquant', area: 0, weight: 0, cost: 0 },
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
        const selectedId = config.shutterConfig[key];
        const item = (source || []).find(x => x.id === selectedId);
        if (item) {
          const qty = this.evaluate(item.formula || '1', { L, H });
          shutterPack.push({
            ...item,
            qty,
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
      if (a.unit === 'Joint' || a.label?.toLowerCase().includes('joint')) {
        if (!finalGasket) {
          finalGasket = { ...a };
        } else {
          finalGasket.qty += a.qty;
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
        area: glasses.reduce((sum, g) => sum + (g.area || 0), 0),
        weight: glasses.reduce((sum, g) => sum + (g.weight || 0), 0),
        cost: glasses.reduce((sum, g) => sum + (g.cost || 0), 0)
      };
    }

    const bom = {
      profiles: Object.values(groupedProfilesMap),
      glass: finalGlass,
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
    
    const shutterCost = (bom.shutters || []).reduce((sum, s) => sum + (s.cost || 0), 0);

    const materialCost = bom.profiles.reduce((sum, p) => sum + p.cost, 0) + 
                       (bom.glass ? bom.glass.cost : 0) + 
                       bom.accessories.reduce((sum, a) => sum + (a.cost || 0), 0);
    
    const costWithColor = materialCost * (color ? color.factor : 1.0);
    
    const margin = this.db.margins.default;
    const priceHT = (costWithColor + shutterCost) * margin;
    
    return {
      cost: costWithColor + shutterCost,
      shutterCost,
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
