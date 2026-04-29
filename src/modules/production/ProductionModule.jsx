import React, { useState, useMemo, useEffect } from 'react';
import { Package, Scissors, Download, CheckCircle, Barcode, ShoppingCart, Layers, Edit2, Link2, Link2Off, Plus, QrCode, Trash2, ArrowLeft, FileText, FileSpreadsheet, RefreshCw, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FormulaEngine } from '../../engine/formula-engine';
import { DEFAULT_DATA } from '../../data/default-data';
import jsPDF from 'jspdf';

const ProductionModule = ({ currentConfig, currentQuote, database, setData }) => {
  const engine = useMemo(() => new FormulaEngine(database), [database]);
  const [activeTab, setActiveTab] = useState('achat');
  const [barLengths, setBarLengths] = useState({});
  const [jumelageGroups, setJumelageGroups] = useState([]);
  const [jumelageMode, setJumelageMode] = useState(false);
  const [jumelageSelection, setJumelageSelection] = useState(new Set());
  // 'total' = consolidated, or an item ID for a single product
  const [productFilter, setProductFilter] = useState('total');
  // Kitting / Logistics
  const [kitConfig, setKitConfig] = useState({ trolleys: 2, slotsPerTrolley: 10, barsPerSlot: 1 });
  const [selectedLabelItem, setSelectedLabelItem] = useState(null);
  const [manualStockOffcuts, setManualStockOffcuts] = useState(() => {
    try {
      const saved = localStorage.getItem('manualStockOffcuts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('manualStockOffcuts', JSON.stringify(manualStockOffcuts));
  }, [manualStockOffcuts]);

  // Prise de mesures states
  const [selectedGlobalQuoteId, setSelectedGlobalQuoteId] = useState(currentQuote?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState('ALL');
  const [proformaSelection, setProformaSelection] = useState(new Set()); // Selected IDs for proforma
  const [offcutInputs, setOffcutInputs] = useState({}); // { [barKey]: "" }
  const [supplierName, setSupplierName] = useState('');
  const [docHeader, setDocHeader] = useState('DEMANDE DE PROFORMA');
  const [companyInfo, setCompanyInfo] = useState({
    name: 'MA MENUISERIE ALU',
    address: '123 Rue de l\'Atelier, Alger',
    phone: '0550 11 22 33',
    email: 'contact@menuiserie.dz',
    rc: '',
    nif: '',
    nis: '',
    ai: '',
    logo: '' // URL or DataURI
  });
  
  const toggleProformaSelection = (id) => {
    setProformaSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeQuote = useMemo(() => {
    // Only look at orders (launched projects), exclude simple quotes
    const allSources = database?.orders || [];
    return allSources.find(q => q.id === selectedGlobalQuoteId) || (currentQuote?.status === 'COMMANDE' ? currentQuote : null);
  }, [database, selectedGlobalQuoteId, currentQuote]);

  const quoteItems = activeQuote?.items || [];

  // Determine which config(s) to aggregate
  const activeConfigs = useMemo(() => {
    // 1. If it's an order/batch system
    if (activeQuote?.batches && activeQuote.batches.length > 0) {
      let configs = [];
      activeQuote.batches.forEach(batch => {
        if (selectedBatchId !== 'ALL' && batch.id !== selectedBatchId) return;
        
        batch.items.forEach(item => {
          (item.measurements || []).forEach(m => {
            const totalQty = m.qty || 1;
            const shutters = m.shutterList || [];
            
            // Robust processing: Always process totalQty windows
            const instancesProcessed = new Set();
            
            // 1. First process windows with explicit shutter overrides
            let nameOffset = 0;
            shutters.forEach((sh, shIdx) => {
              const sQty = Number(sh.qty) || 1;
              for (let i = 0; i < sQty; i++) {
                const globalIdx = nameOffset + i;
                if (globalIdx >= totalQty) break; // Safety
                
                configs.push({
                  config: { 
                    ...item.config, 
                    L: m.L, 
                    H: m.H, 
                    partOverrides: m.partOverrides,
                    shutterConfig: {
                      ...(item.config?.shutterConfig || {}),
                      ...(sh.overrides || {})
                    },
                    shutterOverrides: { ...(sh.overrides || {}), customLV: sh.customLV }
                  },
                  qty: 1,
                  label: item.label,
                  allLabels: [m.instanceNames?.[globalIdx] || `${item.label}-${globalIdx + 1}`],
                  itemId: item.id,
                  measureId: `${m.id}-sh${shIdx}-i${i}`
                });
                instancesProcessed.add(globalIdx);
              }
              nameOffset += sQty;
            });

            // 2. Process remaining windows with base configuration
            for (let i = 0; i < totalQty; i++) {
              if (instancesProcessed.has(i)) continue;
              
              configs.push({
                config: { ...item.config, L: m.L, H: m.H, partOverrides: m.partOverrides },
                qty: 1,
                label: item.label,
                allLabels: [m.instanceNames?.[i] || `${item.label}-${i + 1}`],
                itemId: item.id,
                measureId: `${m.id}-base-i${i}`
              });
            }
          });
        });
      });

      if (productFilter === 'total') return configs;
      // Filter by item type OR specific instance
      return configs.filter(c => c && (c.itemId === productFilter || c.measureId === productFilter));
    }

    // 2. Fallback to standard quote items
    if (quoteItems.length > 0) {
      if (productFilter === 'total') return quoteItems.map(i => ({ config: i.config, qty: i.qty || 1, label: i.label, itemId: i.id }));
      const found = quoteItems.find(i => i.id === productFilter);
      return found ? [{ config: found.config, qty: found.qty || 1, label: found.label, itemId: found.id }] : [];
    }

    // 3. Fallback: single currentConfig
    return currentConfig ? [{ config: currentConfig, qty: 1, label: 'Produit courant' }] : [];
  }, [activeQuote, quoteItems, productFilter, currentConfig, selectedBatchId]);

  const bomResult = useMemo(() => {
    const cfg = activeConfigs[0]?.config || currentConfig;
    if (!cfg) return { bom: null, error: null };
    try { 
      const b = engine.calculateBOM(cfg); 
      return { bom: b, error: null };
    } catch (e) { 
      console.error(e); 
      return { bom: null, error: e.message || 'Erreur inattendue' }; 
    }
  }, [activeConfigs, engine, currentConfig]);
  
  const bom = bomResult?.bom || { profiles: [], accessories: [], shutters: [], glass: { name: '', weight: 0 } };
  
  // Derived arrays for Purchasing List
  const purchasingProfiles = useMemo(() => {
    const map = {};
    activeConfigs.forEach((entry, configIdx) => {
      const cfg = entry?.config;
      const cfgQty = entry?.qty || 1;
      if (!cfg) return;

      const colorInfo = database.colors?.find(c => c.id === cfg.colorId);
      const colorName = colorInfo?.name || cfg.colorId || 'Standard';
      try {
        const b = engine.calculateBOM(cfg);
        if (!b) return;

        // Use grouped labels
        const groupLabels = entry.allLabels?.filter(Boolean).join(', ') || entry.label;
        
        // Standard profiles
        if (b.profiles) {
          b.profiles.forEach(p => {
          const mapKey = `${p.id}|${colorName}`;
          const displayName = p.name || p.label || 'Sans nom';
          const measure = p.length * p.qty * cfgQty;
          
          const newPieces = Array(p.qty * cfgQty).fill(0).map((_, i) => ({ 
            length: p.length, 
            instanceLabel: entry.allLabels?.[Math.floor(i / p.qty)] || groupLabels,
            usage: p.usage || 'FINITION',
            label: p.label,
            windowIdx: configIdx
          }));
          
          const pRef = (database.profiles || []).find(x => x.id === p.id);
          
          if (!map[mapKey]) {
            map[mapKey] = { 
              ...p, 
              originalNames: new Set([displayName]), 
              totalMeasure: measure, 
              pieces: newPieces, 
              colorName, 
              colorId: cfg.colorId,
              baseId: p.id,
              image: pRef?.image,
              technicalDrawing: pRef?.technicalDrawing
            };
          } else {
            map[mapKey].totalMeasure += measure;
            map[mapKey].pieces = [...map[mapKey].pieces, ...newPieces];
            map[mapKey].originalNames.add(displayName);
          }
        });
        } // end if (b.profiles)
        // Shutter profiles (Linear items)
        (b.shutters || []).forEach(s => {
          const unit = (s.priceUnit || '').toUpperCase().trim();
          if (unit === 'ML' || unit === 'BARRE' || unit === 'JOINT') {
            const mapKey = `${s.id}|${colorName}`;
            // If ML/JOINT and qty is small (meters), multiply by 1000 for mm. 
            const qtyMultiplier = (['ML', 'JOINT'].includes(unit) && s.qty < 50) ? 1000 : 1;
            const measure = (s.qty || 0) * cfgQty * qtyMultiplier;
            const newPieces = Array(cfgQty).fill((s.qty || 0) * qtyMultiplier);
            
            if (!map[mapKey]) {
              map[mapKey] = { ...s, originalNames: new Set([s.name]), totalMeasure: measure, pieces: newPieces, colorName };
            } else {
              map[mapKey].totalMeasure += measure;
              map[mapKey].pieces.push(...newPieces);
              map[mapKey].originalNames.add(s.name);
            }
          }
        });
      } catch (e) { console.warn(e); }
    });
    return Object.values(map).map(item => ({
      ...item,
      // For jumelage later we will use original base ref for id, but unique id is key
      baseId: item.id,
      id: `${item.id}|${item.colorName}`,
      combinedName: Array.from(item.originalNames).filter(Boolean).join(' / ')
    }));
  }, [activeConfigs, engine, database.colors]);

  const purchasingAccessories = useMemo(() => {
    const map = {};
    activeConfigs.forEach(({ config: cfg, qty: cfgQty }) => {
      const colorInfo = database.colors?.find(c => c.id === cfg.colorId);
      const colorName = colorInfo?.name || cfg.colorId || 'Standard';
      try {
        const b = engine.calculateBOM(cfg);
        const items = [...(b.accessories || [])];
        if (b.gasket) items.push(b.gasket);
        // Add non-profile shutter items
        (b.shutters || []).forEach(s => {
          const unit = (s.priceUnit || '').toUpperCase().trim();
          if (unit !== 'ML' && unit !== 'BARRE' && unit !== 'JOINT') items.push(s);
        });

        items.forEach(a => {
          const mapKey = `${a.id}|${colorName}`;
          const displayName = a.name ? `${a.name} ${a.label ? `[${a.label}]` : ''}` : (a.label || '');
          if (!map[mapKey]) {
            map[mapKey] = { ...a, originalNames: new Set([displayName]), totalMeasure: (a.totalMeasure || 0) * cfgQty, totalQty: (a.qty || 0) * cfgQty, colorName };
          } else {
            map[mapKey].totalMeasure += (a.totalMeasure || 0) * cfgQty;
            map[mapKey].totalQty += (a.qty || 0) * cfgQty;
            map[mapKey].originalNames.add(displayName);
          }
        });
      } catch (e) { console.warn(e); }
    });
    return Object.values(map).map(item => ({
      ...item,
      baseId: item.id,
      id: `${item.id}|${item.colorName}`,
      combinedName: Array.from(item.originalNames).filter(Boolean).join(' / ')
    }));
  }, [activeConfigs, engine, database.colors]);

  const purchasingGlass = useMemo(() => {
    const map = {};
    activeConfigs.forEach(({ config: cfg, qty: cfgQty }) => {
      const colorInfo = database.colors?.find(c => c.id === cfg.colorId);
      const colorName = colorInfo?.name || cfg.colorId || 'Standard';
      try {
        const b = engine.calculateBOM(cfg);
        (b.glassDetails || []).forEach(g => {
          const w = Math.round(g.width || 0);
          const h = Math.round(g.height || 0);
          const mapKey = `${g.id}|${colorName}-${w}-${h}`;
          if (!map[mapKey]) {
            map[mapKey] = { ...g, width: w, height: h, count: (g.qty || 1) * cfgQty, colorName };
          } else {
            map[mapKey].count += (g.qty || 1) * cfgQty;
          }
        });
      } catch (e) { console.warn(e); }
    });
    return Object.values(map).map(item => ({...item, baseId: item.id}));
  }, [activeConfigs, engine, database.colors]);


  const handleBarLengthChange = (id, val) => {
    setBarLengths(prev => ({ ...prev, [id]: parseFloat(val) || 6400 }));
  };

  const handleAddStockOffcut = (key) => {
    const val = parseFloat(offcutInputs[key]);
    if (!val || isNaN(val)) return;
    setManualStockOffcuts(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), val].sort((a,b) => b-a)
    }));
    setOffcutInputs(prev => ({ ...prev, [key]: "" }));
  };

  const handleRemoveStockOffcut = (key, idx) => {
    setManualStockOffcuts(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== idx)
    }));
  };

  const handleJumelageToggle = (id) => {
    setJumelageSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirmJumelage = () => {
    if (jumelageSelection.size < 2) return;
    const ids = Array.from(jumelageSelection);
    // Remove these ids from any existing groups first
    const cleanedGroups = jumelageGroups
      .map(g => g.filter(id => !ids.includes(id)))
      .filter(g => g.length > 1);
    setJumelageGroups([...cleanedGroups, ids]);
    setJumelageSelection(new Set());
    setJumelageMode(false);
  };

  const handleDissolveGroup = (groupIndex) => {
    setJumelageGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };

  // Build the final display rows applying jumelage
  const displayProfiles = useMemo(() => {
    const handledIds = new Set(jumelageGroups.flat());
    const rows = [];

    // Add merged group rows first
    jumelageGroups.forEach((groupIds, gi) => {
      const members = purchasingProfiles.filter(p => groupIds.includes(p.id));
      if (members.length === 0) return;
      const totalMeasure = members.reduce((s, p) => s + p.totalMeasure, 0);
      const combinedId = members.map(p => p.id).join(' + ');
      const combinedName = members.map(p => p.combinedName || p.name).join(' + ');
      const firstBar = barLengths[members[0].id] || 6400;
      const allPieces = members.flatMap(m => m.pieces || []);
      rows.push({
        _isGroup: true,
        _groupIndex: gi,
        id: combinedId,
        combinedName,
        totalMeasure,
        pieces: allPieces,
        unitPrice: members[0].unitPrice,
        _barKey: members[0].id // use first member's ID for bar length setting
      });
    });

    // Add individual rows not in any group
    purchasingProfiles.forEach(p => {
      if (!handledIds.has(p.id)) rows.push(p);
    });

    return rows;
  }, [purchasingProfiles, jumelageGroups, barLengths]);

  const chutesData = useMemo(() => {
    const scraps = [];
    const reusable = [];
    const blade = 4; // 4mm blade width
    let totalRawLength = 0;
    let totalScrapLength = 0;
    let totalReusableLength = 0;
    
    displayProfiles.forEach(p => {
       const barKey = p.id;
       const bLength = barLengths[barKey] || p.barLength || 6400;
       const sThreshold = p.scrapThreshold || 500; // Default 500mm
       
       const pieces = (p.pieces || []).sort((a, b) => (b.length || b) - (a.length || a));
       
       if (pieces.length > 0) {
          // Initialize bars with stock
          const currentBars = (manualStockOffcuts[barKey] || []).map((len, idx) => ({
            remaining: Number(len),
            originalLen: Number(len),
            isStock: true
          }));

          // Best Fit optimization
          pieces.forEach(pObj => {
            const piece = pObj.length || pObj;
            let bestFitIdx = -1;
            let minRemainder = Infinity;

            for (let j = 0; j < currentBars.length; j++) {
              const remainder = currentBars[j].remaining - (piece + blade);
              if (remainder >= 0 && remainder < minRemainder) {
                minRemainder = remainder;
                bestFitIdx = j;
              }
            }
            
            if (bestFitIdx !== -1) {
              currentBars[bestFitIdx].remaining -= (piece + blade);
            } else {
              currentBars.push({ 
                remaining: bLength - (piece + blade),
                originalLen: bLength,
                isStock: false
              });
            }
          });
          
          currentBars.forEach(bar => {
            totalRawLength += bar.originalLen;
            const remaining = bar.remaining;
            if (remaining > 10) { // Only count if more than 10mm
              const chute = {
                id: p.id,
                baseId: p.baseId || p.id.split('|')[0],
                name: p.combinedName || p.name,
                length: Math.round(remaining),
                color: p.colorName || 'Std',
                isFromStock: bar.isStock
              };
              if (remaining <= sThreshold) {
                scraps.push(chute);
                totalScrapLength += remaining;
              } else {
                reusable.push(chute);
                totalReusableLength += remaining;
              }
            }
          });
       }
    });
    
    const totalWasteRate = totalRawLength > 0 ? ((totalScrapLength + totalReusableLength) / totalRawLength) * 100 : 0;
    const scrapRate = totalRawLength > 0 ? (totalScrapLength / totalRawLength) * 100 : 0;
    const reusableRate = totalRawLength > 0 ? (totalReusableLength / totalRawLength) * 100 : 0;

    return { 
      scraps, 
      reusable, 
      totalRawLength, 
      totalScrapLength, 
      totalReusableLength,
      totalWasteRate,
      scrapRate,
      reusableRate
    };
  }, [displayProfiles, barLengths, manualStockOffcuts]);

  const exportChutesCSV = (type) => {
    const target = type === 'scraps' ? chutesData.scraps : chutesData.reusable;
    const title = type === 'scraps' ? 'Déchets_Chutes_Non_Reutilisables' : 'Chutes_Reutilisables';
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Référence;Désignation;Couleur;Longueur (mm)\n"
      + target.map(c => `${c.baseId};${c.name};${c.color};${c.length}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title}_${activeQuote?.number || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTechnicalDrawingDataURL = (cfg) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    const { L, H, compositionId, optionalSides = {} } = cfg;
    if (!L || !H) return null;

    const margin = 100;
    const drawAreaW = 600 - margin * 2;
    const drawAreaH = 600 - margin * 2;
    
    let caissonH = 0;
    if (cfg.hasShutter && cfg.shutterConfig?.caissonId && database.shutterComponents) {
      const cRef = database.shutterComponents.caissons.find(c => c.id === cfg.shutterConfig.caissonId);
      caissonH = parseFloat(cRef?.height) || 0;
    }

    const scale = Math.min(drawAreaW / L, drawAreaH / H);
    const dW = L * scale;
    const dCaissonH = caissonH * scale;
    const dH_total = H * scale;
    const dH_window = Math.max(0, H - caissonH) * scale;
    
    const offsetX = (600 - dW) / 2;
    const offsetY = (600 - dH_total) / 2;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 600);

    ctx.lineJoin = 'round';
    
    // 1. Draw Caisson (Shutter Box)
    if (caissonH > 0) {
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.fillRect(offsetX, offsetY, dW, dCaissonH);
      ctx.strokeRect(offsetX, offsetY, dW, dCaissonH);
      
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`H.C : ${caissonH} mm`, offsetX + dW/2, offsetY + dCaissonH/2 + 4);
    }
    
    // 2. Draw Frame & Sashes
    const winOffsetY = offsetY + dCaissonH;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(offsetX, winOffsetY, dW, dH_window);
    ctx.strokeRect(offsetX, winOffsetY, dW, dH_window);

    const compo = database.compositions?.find(c => c.id === compositionId);
    const openingType = (compo?.openingType || '').toLowerCase();
    
    // Inner drawJoinery function (mirrors JoineryCanvas logic)
    const drawJoinery = (x, y, w, h, compId) => {
      const comp = database.compositions?.find(c => c.id === compId) || database.compositions?.find(c => c.id === compositionId);
      const oType = comp?.openingType || 'Fixe';
      const dir = cfg.openingDirection || 'gauche';

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.15)';
      ctx.fillRect(x, y, w, h);

      if (oType.includes('Ouvrant') || oType.includes('Battant') || oType.includes('Porte')) {
        const combined = (comp?.name || '').toLowerCase();
        let sc = 1;
        const m = combined.match(/(\d+)\s*(vantail|vanteau|vanteaux|battant|vant)/i);
        if (m) sc = parseInt(m[1]);
        else if (combined.includes('double') || combined.includes(' 2 ')) sc = 2;
        const sW = w / sc;
        for (let i = 0; i < sc; i++) {
          const sX = x + i * sW;
          ctx.setLineDash([]);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sX + 2, y + 2, sW - 4, h - 4);
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.2;
          const sDir = (sc === 1) ? dir : (i === 0 ? 'gauche' : 'droit');
          if (sDir === 'gauche') {
            ctx.moveTo(sX + 4, y + 4); ctx.lineTo(sX + sW - 4, y + h/2); ctx.lineTo(sX + 4, y + h - 4);
          } else {
            ctx.moveTo(sX + sW - 4, y + 4); ctx.lineTo(sX + 4, y + h/2); ctx.lineTo(sX + sW - 4, y + h - 4);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else if (oType.includes('Coulissant')) {
        const combined = (comp?.name || '').toLowerCase();
        let sc = 2;
        const m = combined.match(/(\d+)\s*(coulisse|vantail|vanteau|vant)/i);
        if (m) sc = parseInt(m[1]);
        else if (combined.includes(' 3 ')) sc = 3;
        const sW = w / sc;
        for (let i = 0; i < sc; i++) {
          const sX = x + i * sW;
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(sX + 2, y + 2, sW + (i < sc-1 ? 4 : -2), h - 4);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          const arrowY = y + h/2 + (i % 2 === 0 ? -10 : 10);
          const aDir = (i % 2 === 0) ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(sX + sW/2 - 12*aDir, arrowY);
          ctx.lineTo(sX + sW/2 + 12*aDir, arrowY);
          ctx.lineTo(sX + sW/2 + 6*aDir, arrowY - 4);
          ctx.moveTo(sX + sW/2 + 12*aDir, arrowY);
          ctx.lineTo(sX + sW/2 + 6*aDir, arrowY + 4);
          ctx.stroke();
        }
      } else {
        // Fixe: crossed lines
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y); ctx.lineTo(x, y + h);
        ctx.stroke();
      }
    };

    // Handle compound compositions (fix + coulissant, etc.)
    if (cfg.compoundType && cfg.compoundType !== 'none' && cfg.compoundConfig?.parts) {
      const { parts, orientation, unionId, traverseId } = cfg.compoundConfig;
      const divRef = (database.profiles || []).find(p => p.id === (cfg.compoundType === 'fix_coulissant' ? unionId : traverseId));
      const thick = (divRef?.thickness || 20) * scale;

      const drawPartList = (list, bx, by, bw, bh, dir) => {
        const isH = dir !== 'vertical';
        let cx = bx, cy = by;
        list.forEach((part, idx) => {
          const pW = isH ? (part.width ? part.width * scale : bw / list.length) : bw;
          const pH = isH ? bh : (part.height ? part.height * scale : bh / list.length);
          if (part.type === 'group' && part.subParts) {
            drawPartList(part.subParts, cx, cy, pW, pH, isH ? 'vertical' : 'horizontal');
          } else {
            drawJoinery(cx, cy, pW, pH, part.compositionId || compositionId);
          }
          if (isH) {
            cx += pW;
            if (idx < list.length - 1) { ctx.fillStyle = '#64748b'; ctx.fillRect(cx, by, thick, bh); cx += thick; }
          } else {
            cy += pH;
            if (idx < list.length - 1) { ctx.fillStyle = '#64748b'; ctx.fillRect(bx, cy, bw, thick); cy += thick; }
          }
        });
      };
      drawPartList(parts, offsetX, winOffsetY, dW, dH_window, orientation);
    } else {
      drawJoinery(offsetX, winOffsetY, dW, dH_window, compositionId);
    }

    // 3. Couvre-joints (Architraves) around the window
    const cjThick = 18 * scale;
    const hasCJ = cfg.optionalSides && Object.values(cfg.optionalSides).some(Boolean);
    if (hasCJ) {
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      // Top
      if (optionalSides.top || true) {
        ctx.fillRect(offsetX - cjThick, offsetY - cjThick, dW + cjThick * 2, cjThick);
        ctx.strokeRect(offsetX - cjThick, offsetY - cjThick, dW + cjThick * 2, cjThick);
      }
      // Bottom
      if (optionalSides.bottom || true) {
        ctx.fillRect(offsetX - cjThick, offsetY + dH_total, dW + cjThick * 2, cjThick);
        ctx.strokeRect(offsetX - cjThick, offsetY + dH_total, dW + cjThick * 2, cjThick);
      }
      // Left
      if (optionalSides.left || true) {
        ctx.fillRect(offsetX - cjThick, offsetY, cjThick, dH_total);
        ctx.strokeRect(offsetX - cjThick, offsetY, cjThick, dH_total);
      }
      // Right
      if (optionalSides.right || true) {
        ctx.fillRect(offsetX + dW, offsetY, cjThick, dH_total);
        ctx.strokeRect(offsetX + dW, offsetY, cjThick, dH_total);
      }
    }

    // 4. Shutter Control Position (Motor / Strap)
    if (caissonH > 0 && cfg.shutterConfig) {
      const kitId = cfg.shutterConfig.kitId || '';
      const controlPos = cfg.shutterConfig.controlPosition || 'Droite';
      const isLeft = controlPos === 'Gauche';
      const ctrlX = isLeft ? offsetX + 15 : offsetX + dW - 15;
      const ctrlY = offsetY + dCaissonH / 2;

      if (kitId === 'KIT-MOTE' || kitId.toLowerCase().includes('mot')) {
        // Motor: blue filled circle with 'M' label
        ctx.beginPath();
        ctx.arc(ctrlX, ctrlY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M', ctrlX, ctrlY + 4);
      } else {
        // Strap/Manivelle: vertical line hanging down from caisson
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ctrlX, ctrlY);
        ctx.lineTo(ctrlX, offsetY + dCaissonH + 30);
        ctx.stroke();
        // Strap label
        ctx.fillStyle = '#475569';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(kitId.includes('MANI') ? 'Manivelle' : 'Sangle', ctrlX, offsetY + dCaissonH + 44);
      }
    }

    // 3. Dimension Lines (Matching the user's "desired" image)
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#1e293b';
    ctx.font = '11px Inter, sans-serif';
    
    // Width Dimension (Bottom)
    const dimY = offsetY + dH_total + 40;
    ctx.beginPath();
    ctx.moveTo(offsetX, dimY - 5); ctx.lineTo(offsetX, dimY + 5);
    ctx.moveTo(offsetX, dimY); ctx.lineTo(offsetX + dW, dimY);
    ctx.moveTo(offsetX + dW, dimY - 5); ctx.lineTo(offsetX + dW, dimY + 5);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(`${L} mm`, offsetX + dW/2, dimY + 15);

    // Height Dimensions (Left)
    const dimX = offsetX - 60;
    // Total H
    ctx.beginPath();
    ctx.moveTo(dimX - 5, offsetY); ctx.lineTo(dimX + 5, offsetY);
    ctx.moveTo(dimX, offsetY); ctx.lineTo(dimX, offsetY + dH_total);
    ctx.moveTo(dimX - 5, offsetY + dH_total); ctx.lineTo(dimX + 5, offsetY + dH_total);
    ctx.stroke();
    
    ctx.save();
    ctx.translate(dimX - 15, offsetY + dH_total/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText(`${H} mm (Total)`, 0, 0);
    ctx.restore();

    // Window H (if shutter exists)
    if (caissonH > 0) {
      const dimX2 = offsetX - 25;
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(dimX2, winOffsetY); ctx.lineTo(dimX2, winOffsetY + dH_window);
      ctx.stroke();
      
      ctx.save();
      ctx.translate(dimX2 - 10, winOffsetY + dH_window/2);
      ctx.rotate(-Math.PI/2);
      ctx.fillStyle = '#3b82f6';
      ctx.fillText(`${Math.round(H - caissonH)} mm (Ouv.)`, 0, 0);
      ctx.restore();
      
      // Caisson H label on the side
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`${caissonH}`, dimX2 - 10, offsetY + dCaissonH/2);
    }

    return canvas.toDataURL('image/png');
  };

  const drawCutVisual = (doc, x, y, width, height, cutType) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    
    // Default rectangle
    if (cutType === '90/90') {
      doc.rect(x, y, width, height);
    } else if (cutType === '45/45') {
      doc.line(x, y + height, x + 5, y); // left slant
      doc.line(x + 5, y, x + width - 5, y); // top
      doc.line(x + width - 5, y, x + width, y + height); // right slant
      doc.line(x + width, y + height, x, y + height); // bottom
    } else if (cutType === '45/90') {
      doc.line(x, y + height, x + 5, y); // left slant
      doc.line(x + 5, y, x + width, y); // top
      doc.line(x + width, y, x + width, y + height); // right vertical
      doc.line(x + width, y + height, x, y + height); // bottom
    } else {
      doc.rect(x, y, width, height); // fallback
    }
  };

  const generateDetailedProductionPDF = (type = 'opening') => {
    const doc = new jsPDF();
    const isOpening = type === 'opening';
    const title = isOpening ? 'FICHE DE PRODUCTION : OUVERTURES' : 'FICHE DE PRODUCTION : SPÉCIAL VOLET';
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Client: ${database.clients?.find(c => c.id === activeQuote?.clientId)?.nom || '—'}`, 20, 30);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 160, 30);
    doc.line(20, 35, 190, 35);

    let currentY = 45;

    // Group configurations based on their technical identity
    const groupedConfigs = [];
    activeConfigs.forEach(item => {
      const b = engine.calculateBOM(item.config);
      
      // Use a very specific technical key including itemId to keep different items separate
      // and stringify the whole config to catch every single detail
      const technicalKey = JSON.stringify({
        itemId: item.itemId,
        config: item.config
      });
      
      const existing = groupedConfigs.find(g => g.technicalKey === technicalKey);
      if (existing) {
        existing.qty += (item.qty || 1);
        const newLabels = (item.allLabels || []);
        existing.allLabels = [...(existing.allLabels || []), ...newLabels];
      } else {
        groupedConfigs.push({ 
          ...item, 
          technicalKey, 
          qty: item.qty || 1,
          bom: b 
        });
      }
    });

    // Process each grouped item
    groupedConfigs.forEach((item, idx) => {
      const cfg = item.config;
      const b = item.bom;
      const compo = database.compositions?.find(c => c.id === cfg.compositionId);
      const range = database.ranges?.find(r => r.id === cfg.rangeId);
      const color = database.colors?.find(c => c.id === cfg.colorId);
      
      // Combine regular profiles with ALL shutter components (slats, caissons, motors, etc.)
      const allItems = [
        ...(b.profiles || []),
        ...(b.shutters || []).map(s => {
           const unit = (s.priceUnit || '').toUpperCase().trim();
           const isLinear = ['ML', 'BARRE', 'JOINT'].includes(unit);
           return { 
             ...s, 
             usage: 'VOLET ROULANT',
             // If it's a unit item (caisson, motor), set length to 0 or null to distinguish from cutting items
             length: isLinear ? s.length : null 
           };
        })
      ];

      // Filter based on document type (Opening vs Shutter)
      const filteredItems = allItems.filter(p => {
        const isShutter = p.usage === 'VOLET ROULANT' || p.name?.toLowerCase().includes('lame') || p.name?.toLowerCase().includes('coulisse');
        return isOpening ? !isShutter : isShutter;
      });

      if (filteredItems.length === 0) return;
      
      // FIX: Each window starts on a new page
      if (idx > 0) {
        doc.addPage();
        currentY = 20;
      }

      // Item Header with background (Enlarged to take ~1/2 page width/height)
      doc.setFillColor(248, 250, 252);
      doc.rect(20, currentY, 170, 100, 'F');
      
      // Top Left: Opening technical drawing (ENLARGED)
      const techImage = getTechnicalDrawingDataURL(cfg);
      if (techImage) {
        try { 
          doc.addImage(techImage, 'PNG', 25, currentY + 7, 85, 85); 
        } catch(e) {
          console.error("PDF Tech Drawing Error:", e);
        }
      } else if (compo?.image) {
        try { 
          const imgData = compo.image;
          let format = 'JPEG';
          if (imgData.includes('png')) format = 'PNG';
          else if (imgData.includes('webp')) format = 'WEBP';
          doc.addImage(imgData, format, 25, currentY + 7, 85, 85); 
        } catch(e) {
          doc.setDrawColor(226, 232, 240);
          doc.rect(25, currentY + 7, 85, 85);
          doc.text("Erreur Image", 67.5, currentY + 45, { align: 'center' });
        }
      } else {
        doc.setDrawColor(226, 232, 240);
        doc.rect(25, currentY + 7, 85, 85);
        doc.setFontSize(10);
        doc.text("Sans Photo", 67.5, currentY + 45, { align: 'center' });
      }

      // Top Right Table
      const startX = 115;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Réf: ${item.label}`, startX, currentY + 12);
      doc.text(`Qté Totale: ${item.qty} u.`, startX, currentY + 20);
      
      doc.setFontSize(9);
      const labels = item.allLabels?.filter(Boolean).join(', ');
      let labelOffset = 0;
      if (labels) {
        doc.setFont('helvetica', 'italic');
        const splitLabels = doc.splitTextToSize(`Postes: ${labels}`, 70);
        doc.text(splitLabels, startX, currentY + 28);
        labelOffset = (splitLabels.length - 1) * 3.5; // Offset for next lines
      }
      doc.setFont('helvetica', 'normal');

      // ── Modèle & Dimensions (smart for compound configs) ──
      const isCompound = cfg.compoundType && cfg.compoundType !== 'none' && cfg.compoundConfig?.parts?.length > 0;
      
      const detailsStartY = currentY + 37 + labelOffset;
      if (isCompound) {
        // Find opening part and fix parts
        const openingPart = cfg.compoundConfig.parts.find(p => p.type === 'opening');
        const fixParts = cfg.compoundConfig.parts.filter(p => p.type === 'fixe');
        
        const openingComp = database.compositions?.find(c => c.id === openingPart?.compositionId);
        const fixLabel = fixParts.length > 0 ? `Fix (×${fixParts.length})` : '';
        
        const modelLabel = [openingComp?.name, fixLabel].filter(Boolean).join(' + ');
        doc.setFontSize(11);
        doc.text(`Modèle: ${modelLabel || '—'}`, startX, detailsStartY);
        doc.text(`Couleur: ${color?.name || '—'}`, startX, detailsStartY + 7);
        doc.text(`RAL: ${cfg.colorId || 'Std'}`, startX, detailsStartY + 14);
        
        // Total dimension
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`DIM TOTALE: ${cfg.L} x ${cfg.H} mm`, startX, currentY + 82);
        
        // Per-part breakdown
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        let partY = currentY + 89;
        
        if (openingPart) {
          const w = openingPart.width || cfg.L;
          const h = openingPart.height || cfg.H;
          doc.text(`↳ Ouverture: ${w} x ${h} mm`, startX, partY);
          partY += 6;
        }
        fixParts.forEach((fp, fi) => {
          const w = fp.width || 0;
          const h = fp.height || cfg.H;
          doc.text(`↳ Fix ${fi + 1}: ${w} x ${h} mm`, startX, partY);
          partY += 6;
        });
        
        doc.setTextColor(0, 0, 0);
      } else {
        doc.setFontSize(11);
        doc.text(`Modèle: ${compo?.name || '—'}`, startX, detailsStartY);
        doc.text(`Couleur: ${color?.name || '—'}`, startX, detailsStartY + 8);
        doc.text(`RAL: ${cfg.colorId || 'Std'}`, startX, detailsStartY + 16);
        
        doc.setTextColor(0, 0, 0);

        // ── Dynamic Positions for following elements ──
        let nextY = detailsStartY + 24;

        // Couvre-joint detection
        const cjProfiles = filteredItems.filter(p => p.isCouvreJoint || p.usage === 'ACCESSOIRES / FINITION' && /couvre|cj/i.test(p.label || ''));
        const cjSummary = [];
        const seenThick = new Set();

        cjProfiles.forEach(pCalc => {
          const pRef = (database.profiles || []).find(x => x.id === pCalc.id || x.name === pCalc.id);
          const thicknessValue = pRef?.thickness || pRef?.epas || pRef?.epaisseur || pRef?.ep || pRef?.e || 0;
          const thickness = parseFloat(thicknessValue) || 0;
          if (thickness > 0 && !seenThick.has(thickness)) {
            seenThick.add(thickness);
            cjSummary.push({ name: pRef?.name || pCalc?.name || 'Couvre-joint', thickness });
          }
        });

        if (cjSummary.length > 0) {
          doc.setFontSize(9);
          cjSummary.forEach((cj, cjIdx) => {
            doc.text(`Couvre-joint: ${cj.thickness} mm`, startX, nextY);
            nextY += 7;
          });
        } else {
          doc.setFontSize(9);
          doc.text("Couvre-joint: Sans", startX, nextY);
          nextY += 7;
        }

        // Shutter Info Box
        if (cfg.hasShutter && database.shutterComponents) {
           const sc = database.shutterComponents;
           const caisson = sc.caissons?.find(c => c.id === (cfg.shutterOverrides?.caissonId || cfg.shutterConfig?.caissonId));
           const glissiere = sc.glissieres?.find(g => g.id === (cfg.shutterOverrides?.glissiereId || cfg.shutterConfig?.glissiereId));
           const lame = sc.lames?.find(l => l.id === (cfg.shutterOverrides?.lameId || cfg.shutterConfig?.lameId));
           const kit = sc.kits?.find(k => k.id === (cfg.shutterOverrides?.kitId || cfg.shutterConfig?.kitId));

           const boxY = nextY + 2;
           doc.setFillColor(241, 245, 249);
           doc.roundedRect(110, boxY, 80, 25, 2, 2, 'F');
           doc.setFontSize(8);
           doc.setFont('helvetica', 'bold');
           doc.text("INFO VOLET :", 115, boxY + 5);
           doc.setFont('helvetica', 'normal');
           doc.setFontSize(7.5);
           doc.text(`Caisson: ${caisson?.name || '—'}`, 115, boxY + 10);
           doc.text(`Glissière: ${glissiere?.name || '—'}`, 115, boxY + 15);
           doc.text(`Lame: ${lame?.name || '—'} / ${kit?.name || '—'}`, 115, boxY + 20);
           nextY = boxY + 28;
        } else {
          nextY += 5;
        }

        // DIM TOTALE position adjusted
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`DIM: ${cfg.L} x ${cfg.H} mm`, startX, currentY + 95);
        doc.setTextColor(0, 0, 0);
      }
      
      currentY += 105;

      // Group items by category
      const itemsByCategory = filteredItems.reduce((acc, p) => {
        const cat = p.usage || 'AUTRE';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {});

      const catOrder = ['DORMANT (CADRE)', 'FIXE', 'FENETRE (OUVRANT)', 'VOLET ROULANT', 'ACCESSOIRES / FINITION'];
      
      Object.entries(itemsByCategory).sort((a, b) => {
        const idxA = catOrder.indexOf(a[0]);
        const idxB = catOrder.indexOf(b[0]);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      }).forEach(([cat, catProfiles]) => {
        if (currentY > 240) { doc.addPage(); currentY = 20; }

        // Category Sub-header
        doc.setFillColor(30, 41, 59);
        doc.rect(20, currentY, 170, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(cat, 25, currentY + 5);
        
        // Headers for this category
        doc.setFontSize(7);
        doc.text("Photo", 55, currentY + 5);
        doc.text("Désignation", 75, currentY + 5);
        doc.text("Longueur", 135, currentY + 5);
        doc.text("Coupe", 160, currentY + 5);
        doc.text("Qté", 188, currentY + 5);
        
        currentY += 15; // Increased space to avoid overlap with header
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

          catProfiles.forEach(p => {
            if (currentY > 275) { doc.addPage(); currentY = 20; }
            
            // Flexible lookup (try exact, then normalized)
            let pRef = (database.profiles || []).find(x => x.id === p.id);
            if (!pRef) {
              const normId = String(p.id).replace(/[^a-zA-Z0-9]/g, '');
              pRef = (database.profiles || []).find(x => String(x.id).replace(/[^a-zA-Z0-9]/g, '') === normId);
            }
            
            // If still not found, check shutter components
            if (!pRef && database.shutterComponents) {
               const allShutterComp = [
                 ...(database.shutterComponents.caissons || []),
                 ...(database.shutterComponents.lames || []),
                 ...(database.shutterComponents.lamesFinales || []),
                 ...(database.shutterComponents.glissieres || []),
                 ...(database.shutterComponents.axes || [])
               ];
               pRef = allShutterComp.find(x => x.id === p.id);
            }

            const cutType = pRef?.cutType || (cat === 'VOLET ROULANT' ? '90/90' : '45/45');
            const photo = pRef?.image;

            doc.setFontSize(7);
            doc.text(`${p.id}`, 22, currentY);
            
            // Photo column
            if (photo) {
              try {
                let format = 'JPEG';
                if (photo.includes('png')) format = 'PNG';
                else if (photo.includes('webp')) format = 'WEBP';
                doc.addImage(photo, format, 53, currentY - 5, 12, 10);
              } catch(e) {
                doc.setDrawColor(240, 240, 240);
                doc.rect(53, currentY - 5, 12, 10);
              }
            } else {
               doc.setDrawColor(240, 240, 240);
               doc.rect(53, currentY - 5, 12, 10);
            }

            doc.setFontSize(8);
            // Use maxWidth to prevent designation overlapping with Longueur
            doc.text(`${p.name} [${p.label || 'Pièce'}]`, 75, currentY, { maxWidth: 55 });
            
            doc.setFont('helvetica', 'bold');
            if (p.length) {
              doc.text(`${Math.round(p.length)} mm`, 135, currentY);
              doc.setFont('helvetica', 'normal');
              doc.text(cutType, 160, currentY);
              // Visual Cut
              drawCutVisual(doc, 168, currentY - 3, 15, 5, cutType);
            } else {
              doc.text(`1 unité`, 135, currentY);
            }
            
            doc.setFont('helvetica', 'normal');
            doc.text(`x${Math.round(p.qty * item.qty)}`, 188, currentY);
            
            // Calculate height taken by multiline text if any
            const textLines = doc.splitTextToSize(`${p.name} [${p.label || 'Pièce'}]`, 55);
            currentY += Math.max(14, textLines.length * 4 + 2); 
          });
        currentY += 3;
      });

      currentY += 7; // Space between items
    });

    doc.save(`PROD_${type.toUpperCase()}_${activeQuote?.number || 'EXPORT'}.pdf`);
  };

  const generateOpeningPDF = () => generateDetailedProductionPDF('opening');
  const generateShutterPDF = () => generateDetailedProductionPDF('shutter');

  const generatePurchasePDF = () => {
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Liste d'Achat : ${productFilter === 'total' ? 'Tous les produits (Consolidé)' : (quoteItems.find(i => i.id === productFilter)?.label || 'Produit')}`, 15, y);
    y += 15;

    // Profilés
    doc.setFontSize(13);
    doc.setTextColor(139, 92, 246); // purple-500
    doc.text('Profilés Aluminium', 15, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Référence', 15, y);
    doc.text('Finition', 55, y);
    doc.text('Désignation', 95, y);
    doc.text('L.Barre', 160, y);
    doc.text('Qté', 185, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    displayProfiles.forEach(p => {
       const barKey = p._barKey || p.baseId || p.id;
       const bLength = barLengths[barKey] || 6400;
       const ml = p.totalMeasure;
       // Bin Packing Algorithm (1D Nesting / Next Fit Decreasing)
       const pieces = p.pieces ? [...p.pieces].sort((a,b) => b - a) : [];
       let bars = 0;
       
       if (pieces.length > 0) {
         let currentBars = []; // store remaining lengths
         for (let i = 0; i < pieces.length; i++) {
           const piece = pieces[i];
           // Find best fit (Best Fit Decreasing)
           let bestIdx = -1;
           let minLeft = Infinity;
           for (let j = 0; j < currentBars.length; j++) {
             if (currentBars[j] >= piece && currentBars[j] - piece < minLeft) {
               bestIdx = j;
               minLeft = currentBars[j] - piece;
             }
           }
           if (bestIdx !== -1) {
             currentBars[bestIdx] -= piece;
           } else {
             currentBars.push(bLength - piece);
             bars++;
           }
         }
       } else {
         bars = Math.ceil(ml / bLength);
       }

       const ref = p._isGroup ? p.id.split(' + ').map(x => x.split('|')[0]).join(' + ') : p.baseId || p.id.split('|')[0];
       
       doc.text(String(ref).substring(0, 18), 15, y);
       doc.text(String(p._isGroup ? 'Varié' : p.colorName || 'Std').substring(0, 15), 55, y);
       doc.text(String(p.combinedName).substring(0, 30), 95, y);
       doc.text(`${bLength}mm`, 160, y);
       doc.setFont('helvetica', 'bold');
       doc.text(`${bars}`, 185, y);
       doc.setFont('helvetica', 'normal');
       y += 6;
       if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 10;
    if (y > 250) { doc.addPage(); y = 20; }

    // Accessoires
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11); // amber-500
    doc.text('Accessoires & Joints', 15, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(9);
    doc.text('Référence', 15, y);
    doc.text('Finition', 55, y);
    doc.text('Désignation', 95, y);
    doc.text('Long/ML', 160, y);
    doc.text('Qté', 185, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    purchasingAccessories.forEach(a => {
       const isMl = ['M', 'ML', 'JOINT'].includes((a.unit || '').toUpperCase());
       const ref = a.baseId || a.id.split('|')[0];
       
       doc.text(String(ref).substring(0, 18), 15, y);
       doc.text(String(a.colorName || 'Std').substring(0, 15), 55, y);
       doc.text(String(a.combinedName || 'Accessoire').substring(0, 30), 95, y);
       doc.text(isMl ? `${(a.totalMeasure / 1000).toFixed(2)}m` : '-', 160, y);
       doc.setFont('helvetica', 'bold');
       doc.text(!isMl ? `${a.totalQty}` : '-', 185, y);
       doc.setFont('helvetica', 'normal');
       y += 6;
       if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 10;
    if (y > 250) { doc.addPage(); y = 20; }

    // Vitrage
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 182, 212); // cyan-500
    doc.text('Vitrages', 15, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    doc.setFontSize(9);
    doc.text('Référence', 15, y);
    doc.text('Finition', 55, y);
    doc.text('Désignation', 95, y);
    doc.text('Dimensions', 150, y);
    doc.text('Qté', 185, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    purchasingGlass.forEach(g => {
       const ref = g.baseId || g.id;
       doc.text(String(ref).substring(0, 18), 15, y);
       doc.text(String(g.colorName || 'Std').substring(0, 15), 55, y);
       doc.text(String(g.name || '').substring(0, 25), 95, y);
       doc.text(`${g.width} x ${g.height}`, 150, y);
       doc.setFont('helvetica', 'bold');
       doc.text(`${g.count}`, 185, y);
       doc.setFont('helvetica', 'normal');
       y += 6;
       if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.save(`Achat_${productFilter === 'total' ? 'Tous' : productFilter}.pdf`);
  };

  if (!activeQuote) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', background: 'white', padding: '3rem', borderRadius: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
          <CheckCircle size={64} color="#2563eb" style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem' }}>Prêt pour la production</h2>
          <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.6 }}>Sélectionnez une commande lancée pour générer les documents de production avec les dimensions réelles.</p>
          <div style={{ marginTop: '2rem' }}>
            <select value={selectedGlobalQuoteId} onChange={e => setSelectedGlobalQuoteId(e.target.value)} className="input" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem' }}>
              <option value="">Sélectionner une commande...</option>
              {(database.orders || []).map(q => (
                <option key={q.id} value={q.id}>{q.number} - {database.clients?.find(c => c.id === q.clientId)?.nom} [Lancé]</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }
  
  if (activeTab === 'debit' && !bom) return (
     <div style={{ padding: '2rem', color: '#ef4444', background: '#fef2f2', borderRadius: '1rem', border: '1px solid #fee2e2' }}>
       <h3 style={{ margin: '0 0 1rem 0' }}>⚠️ Erreur de Génération</h3>
       Impossible de générer le débit. Vérifiez les formules mathématiques dans l'Administration.
       <br/><br/>
       <strong>Détails techniques :</strong> {bomResult.error}
     </div>
  );

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '5rem' }}>
      {/* --- PREMIUM CONTROL PANEL --- */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', 
        padding: '2.5rem', 
        borderRadius: '1.5rem', 
        marginBottom: '2rem',
        color: 'white',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative circle */}
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
               <span style={{ background: '#3b82f6', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Module Fabrication</span>
               <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>ID: {activeQuote?.id?.slice(-6) || 'MANUAL'}</span>
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.025em' }}>Pilotage Production</h1>
            <p style={{ color: '#cbd5e1', margin: '0.5rem 0 0 0', fontSize: '1.1rem', fontWeight: 500 }}>
               {activeQuote?.number || 'Mode Manuel'} — {database.clients?.find(c => c.id === activeQuote?.clientId)?.nom || 'Projet Actif'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <select 
                value={selectedGlobalQuoteId} 
                onChange={e => { setSelectedGlobalQuoteId(e.target.value); setProductFilter('total'); }}
                className="input"
                style={{ width: '300px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', paddingRight: '2.5rem' }}
              >
                <option value="">Sélectionner une commande lancée...</option>
                {currentQuote?.id && currentQuote.status === 'COMMANDE' && <option value={currentQuote.id}>Commande Actuelle</option>}
                {(database.orders || []).map(q => (
                  <option key={q.id} value={q.id}>{q.number} - {database.clients?.find(c => c.id === q.clientId)?.nom} [Lancé]</option>
                ))}
              </select>
            </div>

            {/* Lot / Batch Selector */}
            {activeQuote?.batches && activeQuote.batches.length > 0 && (
              <div style={{ position: 'relative' }}>
                <select 
                  value={selectedBatchId} 
                  onChange={e => { setSelectedBatchId(e.target.value); setProductFilter('total'); }}
                  className="input"
                  style={{ width: '180px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                >
                  <option value="ALL">📦 Tous les lots</option>
                  {activeQuote.batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name || `Lot #${b.id.slice(-4)}`}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={generateOpeningPDF} className="btn" style={{ background: 'white', color: '#1e293b', fontWeight: 700, padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', borderRadius: '0.75rem' }}>
              <Download size={18} /> Exporter OF
            </button>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem' }}>Matière Totale</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{purchasingProfiles.reduce((s,p) => s + p.totalMeasure, 0).toLocaleString()} <span style={{fontSize:'0.9rem', fontWeight:400, color: '#94a3b8'}}>mm</span></span>
           </div>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem' }}>Kits Fenêtres</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{activeConfigs.length} <span style={{fontSize:'0.9rem', fontWeight:400, color: '#94a3b8'}}>unités</span></span>
           </div>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem' }}>Optimisation Matière</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{chutesData.totalWasteRate.toFixed(1)} <span style={{fontSize:'0.9rem', fontWeight:400, color: '#94a3b8'}}>%</span></span>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.5rem', fontSize: '0.7rem' }}>
                 <span style={{ color: '#14b8a6', display: 'flex', justifyContent: 'space-between' }}>
                   <span>♻️ Réutilisable:</span> 
                   <span style={{ fontWeight: 700 }}>{chutesData.reusableRate.toFixed(1)}%</span>
                 </span>
                 <span style={{ color: '#f87171', display: 'flex', justifyContent: 'space-between' }}>
                   <span>🗑️ Déchets:</span> 
                   <span style={{ fontWeight: 700 }}>{chutesData.scrapRate.toFixed(1)}%</span>
                 </span>
               </div>

           </div>
           <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem' }}>Poids Vitrage</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{(bom?.glass?.weight || 0).toFixed(1)} <span style={{fontSize:'0.9rem', fontWeight:400, color: '#94a3b8'}}>kg</span></span>
           </div>
        </div>
      </div>

      {/* --- SMART STEP NAVIGATION --- */}
      <div style={{ 
        display: 'flex', 
        background: '#f1f5f9', 
        padding: '0.5rem', 
        borderRadius: '1.25rem', 
        marginBottom: '2.5rem',
        gap: '0.5rem',
        boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)'
      }}>
        {[
          { id: 'achat', label: '1. Approvisionnement', icon: ShoppingCart, color: '#8b5cf6' },
          { id: 'debit', label: '2. Liste de Débit', icon: Scissors, color: '#2563eb' },
          { id: 'logistique', label: '3. Logistique & Tri', icon: Layers, color: '#0ea5e9' },
          { id: 'chutes', label: '4. Chutes & Stock', icon: Trash2, color: '#f59e0b' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: '1rem',
              border: 'none',
              background: activeTab === tab.id ? 'white' : 'transparent',
              color: activeTab === tab.id ? tab.color : '#64748b',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: activeTab === tab.id ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: activeTab === tab.id ? 'translateY(-2px)' : 'none'
            }}
          >
            <tab.icon size={20} />
            {tab.label}
          </button>
        ))}
      </div>


      {/* Product Filter and PDF Export - Moved outside to apply to both pages */}
      {quoteItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>📋 Produit à afficher :</span>
            <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="input" style={{ width: 'auto', fontWeight: 600 }}>
              <option value="total">🔢 Tous les produits (Consolidé)</option>
              {activeQuote?.batches && activeQuote.batches.length > 0 ? (
                activeConfigs.map(c => (
                  <option key={c.measureId} value={c.measureId}>📍 {c.label} — {c.config.L}×{c.config.H}mm</option>
                ))
              ) : (
                quoteItems.map(item => (
                  <option key={item.id} value={item.id}>{item.label} — {item.config?.L}×{item.config?.H}mm (Qté: {item.qty})</option>
                ))
              )}
            </select>
          </div>
          {activeTab === 'debit' && (
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                onClick={() => generateDetailedProductionPDF('opening')} 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb' }}
              >
                <FileText size={16} /> Bon Production Ouvertures
              </button>
              <button 
                onClick={() => generateDetailedProductionPDF('shutter')} 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f97316' }}
              >
                <FileText size={16} /> Bon Production Volets
              </button>
              <button onClick={generatePurchasePDF} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #cbd5e1' }}>
                <Download size={16} /> Exporter PDF Achat
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'debit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Left: Cutting List */}
          <div className="glass shadow-md">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <Scissors size={20} color="#2563eb" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Liste de Débit Profilés {productFilter !== 'total' && `- ${(quoteItems.find(i=>i.id===productFilter)?.label)}`}</h2>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Photo</th>
                    <th>Réf.</th>
                    <th>Nom</th>
                    <th>Usage</th>
                    <th>Dimensions</th>
                    <th>Qté</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {bom && bom.profiles && (() => {
                    // Combine window profiles and shutter components that have a length (cutting items)
                    const shutterItems = (bom.shutters || [])
                      .filter(s => s.length && s.length > 0)
                      .map(s => ({
                        ...s,
                        label: s.name, // Ensure label is used for grouping/display
                      }));

                    const allItems = [...bom.profiles, ...shutterItems];

                    const groups = allItems.reduce((acc, p) => {
                      const cat = p.usage || 'AUTRE';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(p);
                      return acc;
                    }, {});

                    const catStyles = {
                      'DORMANT (CADRE)': { bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
                      'FIXE': { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
                      'FENETRE (OUVRANT)': { bg: '#faf5ff', text: '#6b21a8', dot: '#a855f7' },
                      'VOLET ROULANT': { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
                      'ACCESSOIRES / FINITION': { bg: '#f8fafc', text: '#475569', dot: '#94a3b8' }
                    };

                    return Object.entries(groups).sort((a,b) => {
                      const order = ['DORMANT (CADRE)', 'FIXE', 'FENETRE (OUVRANT)', 'VOLET ROULANT', 'ACCESSOIRES / FINITION'];
                      return order.indexOf(a[0]) - order.indexOf(b[0]);
                    }).map(([cat, items]) => (
                      <React.Fragment key={cat}>
                        <tr style={{ background: '#f1f5f9' }}>
                          <td colSpan="6" style={{ padding: '0.5rem 1rem', fontWeight: 800, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: catStyles[cat]?.dot || '#94a3b8' }}></div>
                               {cat} ({items.length} pièces)
                             </div>
                          </td>
                        </tr>
                        {items.map((p, idx) => {
                          const pRef = (database.profiles || []).find(x => x.id === p.id);
                          return (
                            <tr key={`${cat}-${idx}`}>
                              <td style={{ textAlign: 'center' }}>
                                {pRef?.image ? (
                                  <img src={pRef.image} style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e2e8f0' }} alt="" />
                                ) : (
                                  <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '4px', display: 'grid', placeItems: 'center' }}>
                                    <Package size={16} color="#94a3b8" />
                                  </div>
                                )}
                              </td>
                              <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.id}</td>
                              <td style={{ fontWeight: 600 }}>{p.name} <span style={{ fontWeight: 400, color: '#64748b' }}>[{p.label}]</span></td>
                              <td>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  background: catStyles[cat]?.bg || '#f1f5f9',
                                  color: catStyles[cat]?.text || '#475569',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  fontWeight: 700
                                }}>
                                  {cat.replace('FENETRE ', '').replace('KIT ', '')}
                                </span>
                              </td>
                              <td style={{ fontWeight: 800, color: '#2563eb' }}>{Math.round(p.length)} mm</td>
                              <td>x{p.qty}</td>
                              <td style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{p.compositionName || '—'}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Glass & Logistics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass shadow-md" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                <Package size={20} color="#3b82f6" />
                <h3 style={{ fontWeight: 600 }}>Vitrage (Aperçu global)</h3>
              </div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>{bom?.glass?.name || 'Vitre Standard'}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem' }}>
                  <span>Dimensions du cadre :</span>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>{(activeConfigs[0]?.config?.L || currentConfig?.L || 0)} x {(activeConfigs[0]?.config?.H || currentConfig?.H || 0)} mm</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                  <span>Poids total estimé :</span>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>{(bom?.glass?.weight || 0).toFixed(1)} kg</span>
                </div>
              </div>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                <CheckCircle size={20} color="#10b981" />
                <h3 style={{ fontWeight: 600 }}>Statut Fabrication</h3>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                <p>Prêt pour lancement en production.</p>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: '#10b981', border: 'none' }}>
                  Lancer l'OF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'achat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Document Personalization Panel */}
          <div className="glass shadow-md" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1.25rem', padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              {/* Left: My Company */}
              <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                  <Package size={20} color="#3b82f6" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Mon Entreprise (Expéditeur)</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>Nom de la Société</label>
                    <input type="text" className="input" value={companyInfo.name} onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})} style={{ width: '100%', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>Adresse</label>
                    <input type="text" className="input" value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} style={{ width: '100%', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>Téléphone</label>
                    <input type="text" className="input" value={companyInfo.phone} onChange={e => setCompanyInfo({...companyInfo, phone: e.target.value})} style={{ width: '100%', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>Email</label>
                    <input type="text" className="input" value={companyInfo.email} onChange={e => setCompanyInfo({...companyInfo, email: e.target.value})} style={{ width: '100%', fontSize: '0.85rem' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', gridColumn: 'span 2' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>RC</label>
                      <input type="text" className="input" value={companyInfo.rc} onChange={e => setCompanyInfo({...companyInfo, rc: e.target.value})} style={{ width: '100%', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>NIF</label>
                      <input type="text" className="input" value={companyInfo.nif} onChange={e => setCompanyInfo({...companyInfo, nif: e.target.value})} style={{ width: '100%', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>NIS</label>
                      <input type="text" className="input" value={companyInfo.nis} onChange={e => setCompanyInfo({...companyInfo, nis: e.target.value})} style={{ width: '100%', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>AI</label>
                      <input type="text" className="input" value={companyInfo.ai} onChange={e => setCompanyInfo({...companyInfo, ai: e.target.value})} style={{ width: '100%', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} />
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>URL Logo (Optionnel)</label>
                    <input type="text" className="input" placeholder="https://..." value={companyInfo.logo} onChange={e => setCompanyInfo({...companyInfo, logo: e.target.value})} style={{ width: '100%', fontSize: '0.85rem' }} />
                  </div>
                </div>
              </div>

              {/* Right: Supplier & Document Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
                  <ShoppingCart size={20} color="#8b5cf6" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Cible & Document</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>Nom du Fournisseur (Destinataire)</label>
                    <input type="text" className="input" placeholder="Ex: AluGlass France" value={supplierName} onChange={e => setSupplierName(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>Titre du Document</label>
                    <input type="text" className="input" value={docHeader} onChange={e => setDocHeader(e.target.value)} style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table: Achats Profilés */}
          <div className="glass shadow-md" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <ShoppingCart size={20} color="#8b5cf6" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, flex: 1 }}>Besoins d'Achat (Consolidés par Référence)</h2>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button 
                  onClick={() => {
                    const doc = new jsPDF();
                    
                    // --- HEADER: Company Info & Logo ---
                    if (companyInfo.logo) {
                       try { doc.addImage(companyInfo.logo, 'PNG', 10, 10, 30, 30); } catch(e) {}
                    }
                    doc.setFontSize(14);
                    doc.setTextColor(30, 41, 59);
                    doc.text(companyInfo.name.toUpperCase(), 10, companyInfo.logo ? 45 : 20);
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(companyInfo.address, 10, companyInfo.logo ? 50 : 25);
                    doc.text(`${companyInfo.phone} | ${companyInfo.email}`, 10, companyInfo.logo ? 54 : 29);
                    
                    if (companyInfo.rc || companyInfo.nif) {
                       doc.setFontSize(7);
                       doc.text(`RC: ${companyInfo.rc} | NIF: ${companyInfo.nif} | NIS: ${companyInfo.nis} | AI: ${companyInfo.ai}`, 10, companyInfo.logo ? 59 : 34);
                    }

                    // --- DOCUMENT TITLE ---
                    doc.setFontSize(22);
                    doc.setTextColor(30, 41, 59);
                    doc.text(docHeader.toUpperCase(), 105, 75, { align: 'center' });
                    
                    doc.setDrawColor(226, 232, 240);
                    doc.line(10, 80, 200, 80);

                    // --- SUPPLIER INFO (Right side) ---
                    doc.setFontSize(10);
                    doc.setTextColor(100, 116, 139);
                    doc.text("DESTINATAIRE / FOURNISSEUR :", 120, 45);
                    doc.setFontSize(14);
                    doc.setTextColor(30, 41, 59);
                    doc.text(supplierName || "Non spécifié", 120, 52);

                    // --- PROJECT INFO (Left side) ---
                    doc.setFontSize(10);
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Chantier: ${activeQuote?.number || 'Non spécifié'}`, 120, 60);
                    doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, 65);
                    
                    let y = 95;
                    doc.setFontSize(11);
                    doc.setFillColor(30, 41, 59);
                    doc.rect(10, y-6, 190, 8, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.text("Référence", 15, y);
                    doc.text("Désignation", 50, y);
                    doc.text("Finition", 110, y);
                    doc.text("Total ML / Qté", 150, y);
                    doc.text("Unité", 185, y);
                    
                    y += 12;
                    doc.setTextColor(30, 41, 59);
                    const itemsToPrint = [
                      ...displayProfiles.filter(p => proformaSelection.has(p.id)),
                      ...purchasingAccessories.filter(a => proformaSelection.has(a.id))
                    ];

                    if (itemsToPrint.length === 0) {
                      doc.text("Aucun article sélectionné.", 15, y);
                    } else {
                      itemsToPrint.forEach(p => {
                        doc.text(p.id.split('|')[0], 15, y);
                        doc.text((p.name || p.combinedName || '').slice(0, 25) || '—', 50, y);
                        doc.text(p.colorName || '—', 110, y);
                        
                        const isProfile = !!p.pieces;
                        const isMl = isProfile || ['M', 'ML', 'JOINT'].includes((p.unit || '').toUpperCase());
                        const val = isMl ? (p.totalMeasure / 1000).toFixed(2) : p.totalQty;
                        doc.text(val.toString(), 150, y);
                        doc.text(isProfile ? 'ML' : (p.unit || 'U'), 185, y);
                        
                        y += 8;
                        if (y > 270) { doc.addPage(); y = 20; }
                      });
                    }
                    
                    doc.save(`${docHeader}_${activeQuote?.number || 'Chantier'}.pdf`);
                  }}
                  className="btn"
                  style={{ background: '#8b5cf6', color: 'white', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FileText size={15} /> {docHeader} ({displayProfiles.filter(p=>proformaSelection.has(p.id)).length + purchasingAccessories.filter(a=>proformaSelection.has(a.id)).length})
                </button>

                <button 
                  onClick={() => {
                    const doc = new jsPDF();
                    // --- HEADER: Company Info & Logo ---
                    if (companyInfo.logo) {
                       try { doc.addImage(companyInfo.logo, 'PNG', 10, 10, 30, 30); } catch(e) {}
                    }
                    doc.setFontSize(14);
                    doc.setTextColor(30, 41, 59);
                    doc.text(companyInfo.name.toUpperCase(), 10, companyInfo.logo ? 45 : 20);
                    doc.setFontSize(8);
                    doc.setTextColor(100, 116, 139);
                    doc.text(companyInfo.address, 10, companyInfo.logo ? 50 : 25);
                    doc.text(`${companyInfo.phone} | ${companyInfo.email}`, 10, companyInfo.logo ? 54 : 29);
                    
                    if (companyInfo.rc || companyInfo.nif) {
                       doc.setFontSize(7);
                       doc.text(`RC: ${companyInfo.rc} | NIF: ${companyInfo.nif} | NIS: ${companyInfo.nis} | AI: ${companyInfo.ai}`, 10, companyInfo.logo ? 59 : 34);
                    }

                    doc.setFontSize(20);
                    doc.text("BON DE COMMANDE VITRAGE", 105, 75, { align: 'center' });
                    
                    doc.setDrawColor(226, 232, 240);
                    doc.line(10, 80, 200, 80);

                    // --- INFO SIDEBAR ---
                    doc.setFontSize(10);
                    doc.setTextColor(100, 116, 139);
                    doc.text(`Chantier: ${activeQuote?.number || 'Non spécifié'}`, 120, 50);
                    doc.text(`Client Final: ${database.clients?.find(c => c.id === activeQuote?.clientId)?.nom || '—'}`, 120, 55);
                    doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, 60);
                    
                    let y = 95;
                    doc.setFontSize(11);
                    doc.setFillColor(30, 41, 59);
                    doc.rect(10, y-6, 190, 7, 'F');
                    doc.text("Désignation", 15, y);
                    doc.text("Largeur", 80, y);
                    doc.text("Hauteur", 110, y);
                    doc.text("Qté", 140, y);
                    doc.text("Surface (m2)", 160, y);
                    
                    y += 10;
                    purchasingGlass.forEach(g => {
                      doc.text(g.name || 'Vitrage', 15, y);
                      doc.text(`${g.width} mm`, 80, y);
                      doc.text(`${g.height} mm`, 110, y);
                      doc.text(g.count.toString(), 140, y);
                      doc.text((g.area || 0).toFixed(3), 160, y);
                      y += 8;
                      if (y > 270) { doc.addPage(); y = 20; }
                    });
                    
                    doc.save(`Commande_Vitrage_${activeQuote?.number || 'Chantier'}.pdf`);
                  }}
                  className="btn"
                  style={{ background: '#06b6d4', color: 'white', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Layers size={15} /> Bon Vitrage
                </button>

                <button 
                  onClick={() => {
                    let csv = "Reference;Designation;Finition;Quantite;Unite\n";
                    displayProfiles.forEach(p => {
                      const bLength = barLengths[p._barKey || p.baseId || p.id] || 6400;
                      const qty = Math.ceil(p.totalMeasure / bLength);
                      csv += `${p.id.split('|')[0]};${p.name};${p.colorName};${qty};Barres\n`;
                    });
                    purchasingAccessories.forEach(a => {
                      const isMl = ['M', 'ML', 'JOINT'].includes((a.unit || '').toUpperCase());
                      const qty = isMl ? (a.totalMeasure/1000).toFixed(2) : a.totalQty;
                      csv += `${a.id.split('|')[0]};${a.combinedName};${a.colorName};${qty};${a.unit || 'U'}\n`;
                    });
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute("download", `Achat_${activeQuote?.number || 'Chantier'}.csv`);
                    link.click();
                  }}
                  className="btn"
                  style={{ background: '#10b981', color: 'white', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <FileSpreadsheet size={15} /> Excel (CSV)
                </button>
                {!jumelageMode ? (
                  <button
                    onClick={() => { setJumelageMode(true); setJumelageSelection(new Set()); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: '1.5px solid #8b5cf6', background: 'transparent', color: '#8b5cf6', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                  >
                    <Link2 size={15} /> Jumeler des profilés
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleConfirmJumelage}
                      disabled={jumelageSelection.size < 2}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: 'none', background: jumelageSelection.size >= 2 ? '#8b5cf6' : '#e2e8f0', color: jumelageSelection.size >= 2 ? 'white' : '#94a3b8', cursor: jumelageSelection.size >= 2 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.8rem' }}
                    >
                      <Plus size={15} /> Confirmer ({jumelageSelection.size})
                    </button>
                    <button
                      onClick={() => { setJumelageMode(false); setJumelageSelection(new Set()); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: '1.5px solid #94a3b8', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
            {jumelageMode && (
              <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7c3aed' }}>
                ℹ️ Cochez les profilés à jumeler ensemble, puis cliquez sur "Confirmer le jumelage".
              </div>
            )}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                       <input 
                         type="checkbox" 
                         onChange={(e) => {
                           if (e.target.checked) {
                             setProformaSelection(new Set([...displayProfiles.map(p=>p.id), ...purchasingAccessories.map(a=>a.id)]));
                           } else {
                             setProformaSelection(new Set());
                           }
                         }}
                         checked={proformaSelection.size > 0}
                       />
                    </th>
                    {jumelageMode && <th style={{ width: '30px' }}></th>}
                    <th style={{ width: '50px' }}>Photo</th>
                    <th>Référence</th>
                    <th>Finition</th>
                    <th>RAL</th>
                    <th>Désignation</th>
                    <th>Longueur Barre (mm)</th>
                    <th>Quantité (Barres)</th>
                    <th>Stock (Chutes)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayProfiles.map((p, i) => {
                    const barKey = p.id;
                    const bLength = barLengths[barKey] || 6400;
                    const ml = p.totalMeasure;
                    // Bin Packing Algorithm (1D Nesting / Next Fit Decreasing)
                    const pieces = p.pieces ? [...p.pieces].sort((a,b) => b - a) : [];
                    let bars = 0;
                    const unitClean = (p.priceUnit || '').toUpperCase().trim();
                    
                    if ((unitClean === 'BARRE' || !unitClean) && pieces.length > 0) {
                      // --- LEAN SEQUENCING SORT ---
                      const usagePriority = { 'DORMANT': 1, 'OUVRANT': 2, 'VOLET': 3, 'FINITION': 4 };
                      
                      // Sort pieces to keep kits together but optimize within the kit
                      const sortedPieces = [...pieces].sort((a, b) => {
                        const prioA = usagePriority[a.usage] || 9;
                        const prioB = usagePriority[b.usage] || 9;
                        if (prioA !== prioB) return prioA - prioB;
                        if (a.windowIdx !== b.windowIdx) return a.windowIdx - b.windowIdx;
                        return b.length - a.length; // Maximize material use within the window group
                      });

                      // 1. Initialize with manual stock offcuts
                      const currentBars = (manualStockOffcuts[barKey] || []).map((len, idx) => ({
                        remaining: len,
                        pieces: [],
                        id: `STOCK-${barKey}-${idx}`,
                        isStock: true
                      }));

                      // 2. Optimization: BEST FIT into stock then new bars
                      sortedPieces.forEach(pObj => {
                        const piece = pObj.length || pObj;
                        let bestFitIdx = -1;
                        let minRemainder = Infinity;

                        for (let j = 0; j < currentBars.length; j++) {
                          const remainder = currentBars[j].remaining - piece;
                          if (remainder >= 0 && remainder < minRemainder) {
                            minRemainder = remainder;
                            bestFitIdx = j;
                          }
                        }
                        
                        if (bestFitIdx !== -1) {
                          currentBars[bestFitIdx].remaining -= piece;
                          currentBars[bestFitIdx].pieces.push(pObj);
                        } else {
                          currentBars.push({ 
                            remaining: bLength - piece, 
                            pieces: [pObj],
                            id: `BAR-${barKey}-${currentBars.length + 1}`
                          });
                        }
                      });
                      
                      // 3. Count only NEW bars to buy
                      bars = currentBars.filter(b => !b.isStock).length;
                    } else {
                      // No optimization for ML or other units, just straight division
                      bars = Math.ceil(ml / bLength);
                    }
  
                    const isSelected = jumelageSelection.has(p.id);
                    const rowBg = p._isGroup ? '#faf5ff' : isSelected ? '#ede9fe' : 'transparent';
                    return (
                      <tr key={`dp-${i}`} style={{ background: proformaSelection.has(p.id) ? '#f0f9ff' : 'transparent' }}>
                        <td>
                           <input 
                             type="checkbox" 
                             checked={proformaSelection.has(p.id)} 
                             onChange={() => toggleProformaSelection(p.id)} 
                           />
                        </td>
                        {jumelageMode && !p._isGroup && (
                          <td data-label="Sélec.">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleJumelageToggle(p.id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                        )}
                        {jumelageMode && p._isGroup && <td data-label="-"></td>}
                        <td style={{ textAlign: 'center' }}>
                            {p.image ? (
                              <img src={p.image} style={{ width: '35px', height: '35px', objectFit: 'contain', borderRadius: '4px' }} alt="" />
                            ) : (
                              <div style={{ width: '35px', height: '35px', background: '#f8fafc', borderRadius: '4px', display: 'grid', placeItems: 'center' }}>
                                <Package size={14} color="#cbd5e1" />
                              </div>
                            )}
                         </td>
                         <td data-label="Réf." style={{ color: '#64748b', fontSize: '0.75rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {p._isGroup ? p.id.split(' + ').map(x => x.split('|')[0]).join(' + ') : p.baseId || p.id.split('|')[0]}
                         </td>
                         <td data-label="Finition" style={{ fontSize: '0.85rem' }}>{p._isGroup ? 'Multicolore / Varié' : p.colorName || 'Standard'}</td>
                         <td data-label="RAL" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{p._isGroup ? '—' : p.colorId || 'Std'}</td>
                        <td data-label="Nom" style={{ fontWeight: 600 }}>
                          {p._isGroup && <span style={{ fontSize: '0.7rem', background: '#8b5cf6', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '999px', marginRight: '0.4rem' }}>Jumelé</span>}
                          {p.name || '—'}
                          <div style={{ fontSize: '0.85rem', color: '#8b5cf6', marginTop: '0.2rem', fontWeight: 800 }}>
                            Total Chantier: {(ml / 1000).toFixed(2)} ML
                          </div>
                        </td>
                        <td data-label="Lg. Barre">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input 
                              type="number" 
                              className="input" 
                              value={bLength}
                              onChange={(e) => handleBarLengthChange(barKey, e.target.value)}
                              style={{ width: '80px', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                            />
                            <Edit2 size={12} color="#94a3b8" />
                          </div>
                        </td>
                        <td data-label="Barres">
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: bars > 0 ? '#1e293b' : '#10b981' }}>
                            {bars}
                          </div>
                          {bars > 0 && <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Achat nécessaire</div>}
                          {bars === 0 && <div style={{ fontSize: '0.65rem', color: '#10b981' }}>Stock suffisant</div>}
                        </td>
                        <td data-label="Chutes Stock" style={{ minWidth: '180px' }}>
                          {(unitClean === 'BARRE' || !unitClean) ? (
                            <>
                              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
                                <input 
                                  type="number" 
                                  placeholder="Lg. chute"
                                  className="input"
                                  value={offcutInputs[barKey] || ""}
                                  onChange={(e) => setOffcutInputs(prev => ({ ...prev, [barKey]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddStockOffcut(barKey); }}
                                  style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                />
                                <button 
                                  onClick={() => handleAddStockOffcut(barKey)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                                {(manualStockOffcuts[barKey] || []).map((len, sIdx) => (
                                  <span 
                                    key={sIdx}
                                    style={{ 
                                      fontSize: '0.7rem', 
                                      background: '#f1f5f9', 
                                      padding: '0.1rem 0.4rem', 
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                      border: '1px solid #e2e8f0'
                                    }}
                                  >
                                    {len}
                                    <Trash2 
                                      size={10} 
                                      style={{ cursor: 'pointer', color: '#ef4444' }} 
                                      onClick={() => handleRemoveStockOffcut(barKey, sIdx)}
                                    />
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N/A (Unité: {p.priceUnit})</span>
                          )}
                        </td>
                        <td data-label="Action">
                          {p._isGroup && (
                            <button
                              onClick={() => handleDissolveGroup(p._groupIndex)}
                              title="Annuler ce jumelage"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.2rem' }}
                            >
                              <Link2Off size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
  
                  {displayProfiles.length === 0 && <tr><td colSpan="7">Aucun profilé trouvé.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Achats Accessoires & Joints */}
          <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <Package size={20} color="#f59e0b" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Liste d'Achat : Accessoires & Joints</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Référence</th>
                    <th>Finition</th>
                    <th>Désignation</th>
                    <th>Longueur / M.L</th>
                    <th>Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasingAccessories.map((a, i) => {
                    const isMl = ['M', 'ML', 'JOINT'].includes((a.unit || '').toUpperCase());
                    return (
                      <tr key={`aa-${i}`} style={{ background: proformaSelection.has(a.id) ? '#fffbeb' : 'transparent' }}>
                        <td>
                           <input 
                             type="checkbox" 
                             checked={proformaSelection.has(a.id)} 
                             onChange={() => toggleProformaSelection(a.id)} 
                           />
                        </td>
                        <td data-label="Réf." style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{a.baseId || a.id.split('|')[0]}</td>
                        <td data-label="Finition" style={{ fontSize: '0.85rem' }}>{a.colorName || 'Standard'}</td>
                        <td data-label="Nom" style={{ fontWeight: 600 }}>{a.combinedName || 'Accessoire'}</td>
                        <td data-label="Lg/ML">{isMl ? `${(a.totalMeasure / 1000).toFixed(2)} m` : '—'}</td>
                        <td data-label="Qté" style={{ color: '#f59e0b', fontWeight: 700 }}>
                          {!isMl ? a.totalQty : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {purchasingAccessories.length === 0 && <tr><td colSpan="5">Aucun accessoire trouvé.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Détails Vitrage */}
          <div className="glass shadow-md" style={{ borderLeft: '4px solid #06b6d4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <Layers size={20} color="#06b6d4" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Liste d'Achat : Vitrages Détaillés</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Finition</th>
                    <th>Désignation</th>
                    <th>Dimensions (L x H)</th>
                    <th>Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasingGlass.map((g, i) => (
                    <tr key={`ag-${i}`}>
                      <td data-label="Réf." style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{g.baseId || g.id}</td>
                      <td data-label="Finition" style={{ fontSize: '0.85rem' }}>{g.colorName || 'Standard'}</td>
                      <td data-label="Nom" style={{ fontWeight: 600 }}>{g.name}</td>
                      <td data-label="Dim." style={{ fontWeight: 500 }}>{g.width} x {g.height} mm</td>
                      <td data-label="Qté" style={{ color: '#06b6d4', fontWeight: 700 }}>{g.count}u</td>
                    </tr>
                  ))}
                  {purchasingGlass.length === 0 && <tr><td colSpan="5">Aucun vitrage détaillé trouvé.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chutes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'slideUp 0.4s ease-out' }}>
          <div className="flex-header">
             <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Analyse des Chutes de Débit</h2>
                <p style={{ color: '#64748b' }}>Basé sur l'optimisation des profilés configurés en unité "Barre".</p>
             </div>
             <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => exportChutesCSV('reusable')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white' }}>
                   <Download size={18} color="#14b8a6" /> CSV Chutes Réutilisables
                </button>
                <button onClick={() => exportChutesCSV('scraps')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white' }}>
                   <Trash2 size={18} color="#ef4444" /> CSV Déchets
                </button>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Liste des Chutes Réutilisables */}
            <div className="glass shadow-lg" style={{ borderTop: '6px solid #14b8a6', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f0fdfa', padding: '0.6rem', borderRadius: '12px' }}>
                  <CheckCircle size={24} color="#14b8a6" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Chutes Réutilisables</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Pièces {'>'} Seuil de chute</span>
                </div>
                <div style={{ marginLeft: 'auto', background: '#14b8a6', color: 'white', padding: '0.2rem 0.8rem', borderRadius: '20px', fontWeight: 700 }}>
                  {chutesData.reusable.length}
                </div>
              </div>
              
              <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                    <tr>
                      <th>Désignation Profilé</th>
                      <th>Coloris</th>
                      <th style={{ textAlign: 'right' }}>Longueur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chutesData.reusable.map((c, i) => (
                      <tr key={`reu-${i}`}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td><span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>{c.color}</span></td>
                        <td style={{ fontWeight: 800, color: '#0d9488', textAlign: 'right' }}>{c.length} mm</td>
                      </tr>
                    ))}
                    {chutesData.reusable.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '3rem' }}>
                          <div style={{ color: '#94a3b8' }}>
                            <Layers size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p>Aucune chute réutilisable détectée.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Liste des Déchets */}
            <div className="glass shadow-lg" style={{ borderTop: '6px solid #ef4444', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#fef2f2', padding: '0.6rem', borderRadius: '12px' }}>
                  <Trash2 size={24} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Déchets / Chutes Perdues</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Pièces {'<='} Seuil de chute</span>
                </div>
                <div style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', padding: '0.2rem 0.8rem', borderRadius: '20px', fontWeight: 700 }}>
                  {chutesData.scraps.length}
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                    <tr>
                      <th>Désignation Profilé</th>
                      <th>Coloris</th>
                      <th style={{ textAlign: 'right' }}>Longueur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chutesData.scraps.map((c, i) => (
                      <tr key={`scr-${i}`}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td><span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>{c.color}</span></td>
                        <td style={{ fontWeight: 800, color: '#b91c1c', textAlign: 'right' }}>{c.length} mm</td>
                      </tr>
                    ))}
                    {chutesData.scraps.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '3rem' }}>
                          <div style={{ color: '#94a3b8' }}>
                            <Package size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p>Aucun déchet majeur à répertorier.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* LOGISTIQUE ATELIER - Kitting & Sorting                           */}
      {/* ================================================================ */}
      {activeTab === 'logistique' && (() => {
        const totalSlots = kitConfig.trolleys * kitConfig.slotsPerTrolley;
        
        // --- 1. INITIALIZATION ---
        const globalCuts = []; 
        let itemsWithConfig = 0;
        let bomsCalculated = 0;
        let totalPiecesInBoms = 0;
        const requestedCompoIds = new Set();
        const missingCompoIds = new Set();

        const isOrder = database.orders?.some(o => o.id === activeQuote?.id);
        const batches = isOrder ? (activeQuote?.batches || []) : [];
        
        let targetItems = [];
        if (isOrder && selectedBatchId !== 'ALL') {
          const batch = batches.find(b => b.id === selectedBatchId);
          if (batch) {
            batch.items.forEach(bi => {
              (bi.measurements || []).forEach(m => {
                targetItems.push({ 
                  ...bi, 
                  config: { ...bi.config, L: m.L, H: m.H }, 
                  qty: Number(m.qty) || 1,
                  isFromBatch: true 
                });
              });
            });
          }
        } else {
          targetItems = quoteItems.map(i => ({ ...i, qty: Number(i.qty) || 1 }));
        }

        // --- 2. CALCULATION LOOP ---
        targetItems.forEach((item, windowIdx) => {
          if (!item.config) return;
          const cId = item.config.compositionId;
          if (cId) {
             requestedCompoIds.add(cId);
             if (!database.compositions?.find(c => c.id === cId)) missingCompoIds.add(cId);
          }

          itemsWithConfig++;
          try {
            const b = engine.calculateBOM(item.config);
            if (b) {
              bomsCalculated++;
              const qty = Math.max(1, Number(item.qty) || 1);
              
              if (b.profiles && Array.isArray(b.profiles)) {
                b.profiles.forEach(p => {
                  const piecesPerUnit = Math.max(0, Number(p.qty) || 0);
                  const totalPieces = piecesPerUnit * qty;
                  totalPiecesInBoms += totalPieces;
                  
                  const colorInfo = database.colors?.find(c => c.id === item.config.colorId);
                  const colorName = colorInfo?.name || item.config.colorId || 'Standard';
                  const barKey = `${p.id}|${colorName}`;

                  for (let q = 0; q < totalPieces; q++) {
                    globalCuts.push({
                      profileId: p.id,
                      profileName: p.name,
                      label: p.label,
                      length: Math.round(p.length),
                      usage: p.usage || 'FINITION',
                      windowIdx,
                      windowLabel: item.label || item.instanceLabel || `Fenêtre #${windowIdx + 1}`,
                      windowItemId: item.id,
                      isBatch: !!item.isFromBatch,
                      colorName,
                      barKey
                    });
                  }
                });
              }

              if (b.shutters && Array.isArray(b.shutters)) {
                b.shutters.forEach(s => {
                  const unitUpper = (s.priceUnit || '').toUpperCase().trim();
                  const isLinear = ['ML', 'M', 'JOINT'].includes(unitUpper);
                  
                  if (isLinear && s.length > 0 && s.qty > 0) {
                    const piecesPerUnit = Math.max(0, Number(s.qty) || 0);
                    const totalPieces = piecesPerUnit * qty;
                    totalPiecesInBoms += totalPieces;
                    
                    for (let q = 0; q < totalPieces; q++) {
                      globalCuts.push({
                        profileId: s.id,
                        profileName: s.name,
                        label: `[Volet] ${s.name}`,
                        length: Math.round(s.length),
                        usage: 'VOLET',
                        windowIdx,
                        windowLabel: item.label || item.instanceLabel || `Fenêtre #${windowIdx + 1}`,
                        windowItemId: item.id,
                        isShutter: true,
                        isBatch: !!item.isFromBatch
                      });
                    }
                  }
                });
              }
            }
          } catch (err) {
            console.error("Logistics Calculation Error:", err);
          }
        });

        console.log(`Logistique Debug: targetItems=${targetItems.length}, bomsCalculated=${bomsCalculated}, globalCuts=${globalCuts.length}`);

        // --- 3. OPTIMIZATION (BFD) ---
        const profileGroups = {};
        globalCuts.forEach(cut => {
          const key = cut.barKey || cut.profileId;
          if (!profileGroups[key]) profileGroups[key] = { profileName: cut.profileName, colorName: cut.colorName, cuts: [] };
          profileGroups[key].cuts.push(cut);
        });

        // Best-Fit Decreasing per profile group
        const barsResult = {};
        Object.entries(profileGroups).forEach(([barKey, { profileName, colorName, cuts }]) => {
          const profId = barKey.split('|')[0];
          const barLen = barLengths[barKey] || 6400;
          const usagePriority = { 'DORMANT': 1, 'OUVRANT': 2, 'VOLET': 3, 'FINITION': 4 };
          const sorted = [...cuts].sort((a, b) => {
            const prioA = usagePriority[a.usage] || 9;
            const prioB = usagePriority[b.usage] || 9;
            if (prioA !== prioB) return prioA - prioB;
            if (a.windowIdx !== b.windowIdx) return a.windowIdx - b.windowIdx;
            return b.length - a.length;
          });
          
          // 1. Initialize with manual stock offcuts
          const bars = (manualStockOffcuts[barKey] || []).map((len, idx) => ({
            id: `STOCK-${barKey}-${idx}`,
            remaining: Number(len),
            used: 0,
            pieces: [],
            isStock: true,
            barLen: Number(len)
          }));

          const allLengths = cuts.map(c => c.length);
          const minPieceInOrder = Math.min(...allLengths, 300);

          sorted.forEach(cut => {
            let bestBarIdx = -1;
            let minLeft = Infinity;
            // Prefer Stock bars first, then new bars
            bars.forEach((bar, idx) => {
              if (bar.remaining >= cut.length && bar.remaining - cut.length < minLeft) {
                bestBarIdx = idx;
                minLeft = bar.remaining - cut.length;
              }
            });

            if (bestBarIdx !== -1) {
              bars[bestBarIdx].pieces.push({ ...cut, barId: bars[bestBarIdx].id });
              bars[bestBarIdx].used += cut.length;
              bars[bestBarIdx].remaining -= cut.length;
            } else {
              const newBar = { 
                id: `${profId}-BAR${bars.length + 1}`, 
                used: cut.length, 
                remaining: barLen - cut.length, 
                pieces: [],
                barLen: barLen
              };
              newBar.pieces.push({ ...cut, barId: newBar.id });
              bars.push(newBar);
            }
          });

          bars.forEach(bar => {
            bar.isTrash = bar.remaining < minPieceInOrder;
            bar.waste = bar.remaining;
          });
          barsResult[barKey] = { profileName, colorName, bars, barLen };
        });

        // Assign each BAR to a chariot slot based on barsPerSlot
        const barsPerSlot = kitConfig.barsPerSlot || 1;
        const allBarsFlat = [];
        Object.entries(barsResult).forEach(([profId, { profileName, bars, barLen: standardLen }]) => {
          bars.filter(b => b.pieces.length > 0).forEach(bar => {
            allBarsFlat.push({ 
              ...bar, 
              profileName, 
              profId, 
              barLen: bar.barLen || standardLen 
            });
          });
        });
        
        allBarsFlat.forEach((bar, idx) => {
          const slotIdxTotal = Math.floor(idx / barsPerSlot);
          const trolleyIdx = Math.floor(slotIdxTotal / kitConfig.slotsPerTrolley);
          
          bar.trolley = trolleyIdx + 1;
          bar.slot = (slotIdxTotal % kitConfig.slotsPerTrolley) + 1;
          bar.address = `CH${bar.trolley}-C${String(bar.slot).padStart(2, '0')}`;
        });

        const barAddressMap = {};
        allBarsFlat.forEach(b => { barAddressMap[b.id] = b.address; });
        const totalBars = allBarsFlat.length;
        const totalStockBarsUsed = allBarsFlat.filter(b => b.isStock).length;

        // --- 4. KIT SUMMARY (Window status) ---
        const windowSummary = {};
        globalCuts.forEach(cut => {
          if (!windowSummary[cut.windowIdx]) {
            windowSummary[cut.windowIdx] = { 
              label: cut.windowLabel, 
              pieces: [], 
              id: cut.windowItemId,
              trolleys: new Set(),
              slots: new Set()
            };
          }
          // Find where this piece went
          const bar = allBarsFlat.find(b => b.pieces.some(p => p.windowIdx === cut.windowIdx && p.profileId === cut.profileId && p.length === cut.length));
          if (bar) {
            windowSummary[cut.windowIdx].pieces.push({ ...cut, address: bar.address });
            windowSummary[cut.windowIdx].trolleys.add(bar.trolley);
            windowSummary[cut.windowIdx].slots.add(bar.address);
          }
        });

        const generateLabelsPDF = () => {
          const doc = new jsPDF();
          doc.setFontSize(10);
          let x = 10, y = 10;
          const labelW = 60, labelH = 30;

          globalCuts.forEach((cut, i) => {
            const bar = allBarsFlat.find(b => b.pieces.some(p => p.windowIdx === cut.windowIdx && p.profileId === cut.profileId && p.length === cut.length));
            const address = bar ? bar.address : 'N/A';

            doc.rect(x, y, labelW, labelH);
            doc.setFont('helvetica', 'bold');
            doc.text(`${cut.windowLabel}`, x + 2, y + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`${cut.profileName}`, x + 2, y + 10);
            doc.text(`${cut.label}`, x + 2, y + 14);
            doc.setFontSize(10);
            doc.text(`${cut.length} mm`, x + 2, y + 20);
            
            doc.setFillColor(240, 240, 240);
            doc.rect(x + 35, y + 2, 23, 8, 'F');
            doc.text(address, x + 37, y + 8);

            x += labelW + 5;
            if (x > 180) { x = 10; y += labelH + 5; }
            if (y > 260) { doc.addPage(); x = 10; y = 10; }
          });
          doc.save(`Etiquettes_${selectedGlobalQuoteId}.pdf`);
        };

        const generateCuttingOptimizationPDF = () => {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const margin = 15;
          let currentY = 20;

          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text("PLAN DE COUPE OPTIMISÉ (NESTING)", 105, currentY, { align: 'center' });
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`Client: ${activeQuote?.clientNom || '—'}  |  Dossier: ${activeQuote?.number || '—'}  |  Date: ${new Date().toLocaleDateString()}`, 105, currentY + 7, { align: 'center' });
          currentY += 20;

          // 1. Collect ALL cuts from ALL active configs
          const allCutsList = [];
          activeConfigs.forEach(cfg => {
            const b = engine.calculateBOM(cfg.config);
            const combined = [
              ...(b.profiles || []), 
              ...(b.shutters || []).filter(s => ['ML', 'BARRE', 'JOINT'].includes((s.priceUnit || '').toUpperCase().trim()))
            ];
            
            const colorInfo = database.colors?.find(c => c.id === cfg.config.colorId);
            const colorName = colorInfo?.name || cfg.config.colorId || 'Standard';
            
            combined.forEach(p => {
              const barKey = `${p.id}|${colorName}`;
              for (let i = 0; i < cfg.qty; i++) {
                allCutsList.push({
                  ...p,
                  instanceLabel: cfg.allLabels[i] || cfg.label,
                  colorName,
                  barKey
                });
              }
            });
          });

          if (allCutsList.length === 0) {
            doc.text("Aucune coupe à optimiser.", 20, currentY);
            doc.save(`OPTIM_COUPE_${selectedGlobalQuoteId}.pdf`);
            return;
          }

          // 2. Group by Profile + Color
          const groups = {};
          allCutsList.forEach(c => {
            const groupKey = c.barKey || `${c.id}|STD`;
            if (!groups[groupKey]) groups[groupKey] = { id: c.id, colorName: c.colorName, name: c.name, cuts: [], barKey: groupKey };
            groups[groupKey].cuts.push(c);
          });

          // 3. Process each group
          Object.values(groups).forEach(group => {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            
            const pRef = (database.profiles || []).find(p => p.id === group.id);
            const barLen = pRef?.barLength || 6000;
            const threshold = pRef?.scrapThreshold || 500;
            const blade = 4; // 4mm blade width

            doc.setFillColor(30, 41, 59);
            doc.rect(margin, currentY, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${group.name} (${group.id}) - Finition: ${group.colorName || 'Standard'}`, margin + 5, currentY + 5.5);
            currentY += 15;

            // FFD Nesting Algorithm with Stock priority
            const sortedCuts = [...group.cuts].sort((a, b) => b.length - a.length);
            const nestedBars = [];
            
            // 1. Initialize with stock
            (manualStockOffcuts[group.barKey] || []).forEach((len, sIdx) => {
              nestedBars.push({ items: [], remaining: len, isStock: true, originalLen: len });
            });

            sortedCuts.forEach(cut => {
              let placed = false;
              for (let bar of nestedBars) {
                if (bar.remaining >= cut.length + blade) {
                  bar.items.push(cut);
                  bar.remaining -= (cut.length + blade);
                  placed = true;
                  break;
                }
              }
              if (!placed) {
                nestedBars.push({ items: [cut], remaining: barLen - cut.length - blade, originalLen: barLen });
              }
            });

            // 4. Draw Bars
            doc.setTextColor(0, 0, 0);
            nestedBars.forEach((bar, bIdx) => {
              if (currentY > 260) { doc.addPage(); currentY = 20; }
              
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.text(`${bar.isStock ? `[STOCK ${bar.originalLen}mm] ` : ''}Barre #${bIdx + 1}`, margin, currentY - 2);
              
              const barWidth = 170;
              const barHeight = 8;
              const actualBarLen = bar.originalLen || barLen;
              const scale = barWidth / actualBarLen;
              
              doc.setDrawColor(200, 200, 200);
              doc.rect(margin, currentY, barWidth, barHeight);
              
              let currentXPos = margin;
              bar.items.forEach(cut => {
                const w = cut.length * scale;
                doc.setDrawColor(30, 41, 59);
                doc.setFillColor(255, 255, 255);
                doc.rect(currentXPos, currentY, w, barHeight, 'FD');
                
                doc.setFontSize(5);
                doc.setFont('helvetica', 'normal');
                doc.text(`${cut.instanceLabel}`, currentXPos + 1, currentY + barHeight / 2 + 1.5, { maxWidth: w - 2 });
                doc.text(`${Math.round(cut.length)}`, currentXPos + 1, currentY + barHeight + 3);
                
                currentXPos += w;
                doc.setDrawColor(200, 200, 200);
                doc.line(currentXPos, currentY, currentXPos, currentY + barHeight);
                currentXPos += (blade * scale);
              });
              
              const remainingW = bar.remaining * scale;
              if (remainingW > 0) {
                const isReusable = bar.remaining >= threshold;
                doc.setFillColor(isReusable ? 220 : 254, isReusable ? 252 : 226, isReusable ? 231 : 226); 
                doc.setDrawColor(isReusable ? 22 : 185, isReusable ? 163 : 28, isReusable ? 74 : 28);
                doc.rect(currentXPos, currentY, remainingW, barHeight, 'FD');
                
                doc.setFontSize(5);
                doc.setTextColor(isReusable ? 21 : 153, isReusable ? 128 : 27, isReusable ? 61 : 27);
                doc.text(`${Math.round(bar.remaining)}mm`, currentXPos + 1, currentY + barHeight / 2 + 1.5);
                doc.text(isReusable ? "RÉUTIL." : "CHUTE", currentXPos + 1, currentY - 2);
                doc.setTextColor(0, 0, 0);
              }
              
              currentY += 18;
            });
            currentY += 10;
          });

          doc.save(`OPTIM_COUPE_${selectedGlobalQuoteId}.pdf`);
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Config panel */}
            <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap' }}>📋 Devis source :</span>
                <select
                  value={selectedGlobalQuoteId}
                  onChange={e => setSelectedGlobalQuoteId(e.target.value)}
                  className="input"
                  style={{ fontWeight: 600, flex: 1, minWidth: '220px' }}
                >
                  <option value="">— Sélectionner un document —</option>
                  {currentQuote?.id && <option value={currentQuote.id}>⭐ Devis Actif (Écran Commercial)</option>}
                  
                  <optgroup label="🛒 COMMANDES (Payé/Confirmé)">
                    {(database.orders || []).map(o => {
                      const client = database.clients?.find(c => c.id === o.clientId);
                      return <option key={o.id} value={o.id}>📦 {o.number || o.id}{client ? ` — ${client.nom}` : ''}</option>;
                    })}
                  </optgroup>

                  <optgroup label="📋 DEVIS ( Brouillon / Attente )">
                    {(database.quotes || []).map(q => {
                      const client = database.clients?.find(c => c.id === q.clientId);
                      return <option key={q.id} value={q.id}>📄 {q.number}{client ? ` — ${client.nom}` : ''}</option>;
                    })}
                  </optgroup>
                </select>

                {/* Batch Selector (Only for Orders) */}
                {isOrder && batches.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#f5f3ff', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', border: '1px solid #ddd6fe' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#7c3aed', whiteSpace: 'nowrap' }}>📦 Lot de production :</span>
                    <select 
                      value={selectedBatchId} 
                      onChange={e => setSelectedBatchId(e.target.value)}
                      className="input"
                      style={{ border: '1px solid #c4b5fd', fontWeight: 600, fontSize: '0.85rem', padding: '0.2rem 0.4rem', height: '32px' }}
                    >
                      <option value="ALL">Tout le dossier (Théorique)</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name || b.id} (Cotes Réelles)</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', background: '#f1f5f9', color: '#475569', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {quoteItems.length} items
                  </span>
                  <span style={{ fontSize: '0.8rem', background: itemsWithConfig > 0 ? '#d1fae5' : '#fee2e2', color: itemsWithConfig > 0 ? '#065f46' : '#991b1b', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {itemsWithConfig} avec config
                  </span>
                  <span style={{ fontSize: '0.8rem', background: bomsCalculated > 0 ? '#d1fae5' : '#fee2e2', color: bomsCalculated > 0 ? '#065f46' : '#991b1b', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {bomsCalculated} BOMs ok
                  </span>
                  <span style={{ fontSize: '0.8rem', background: globalCuts.length > 0 ? '#d1fae5' : '#fef3c7', color: globalCuts.length > 0 ? '#065f46' : '#92400e', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {globalCuts.length} coupes générées
                  </span>
                  <span style={{ fontSize: '0.8rem', background: '#ede9fe', color: '#5b21b6', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                    {totalBars} barres
                  </span>
                </div>
              </div>
              {missingCompoIds.size > 0 && (
                <div style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, background: '#fee2e2', padding: '0.4rem 0.8rem', borderRadius: '4px' }}>
                   ⚠️ Erreur technique : Composition(s) manquante(s) dans la base actuelle : {[...missingCompoIds].join(', ')}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', gap: '1rem', padding: '0 0.5rem' }}>
               <span>Debug: totalPiecesInBoms={totalPiecesInBoms}</span>
               <span>globalQuoteId={selectedGlobalQuoteId}</span>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <Package size={20} color="#10b981" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Suivi des Kits (Fenêtres)</h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.75rem' }}>Fenêtre</th>
                      <th style={{ padding: '0.75rem' }}>Nb Pièces</th>
                      <th style={{ padding: '0.75rem' }}>Emplacements (Chariot/Case)</th>
                      <th style={{ padding: '0.75rem' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(windowSummary).map((win, i) => {
                      const locations = Array.from(win.slots).sort();
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 700 }}>{win.label}</td>
                          <td style={{ padding: '0.75rem' }}>{win.pieces.length}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {locations.map(loc => (
                                <span key={loc} style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid #e2e8f0' }}>{loc}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ 
                              background: locations.length <= 2 ? '#d1fae5' : '#fef3c7', 
                              color: locations.length <= 2 ? '#065f46' : '#92400e',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              {locations.length <= 2 ? '⚡ Kit Optimisé' : '📦 Kit Dispersé'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <Package size={20} color="#f59e0b" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, flex: 1 }}>Configuration Chariots (Kitting)</h2>
              </div>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Nombre de chariots
                  <input type="number" min={1} max={20} className="input" style={{ marginLeft: '0.5rem', width: '70px' }}
                    value={kitConfig.trolleys} onChange={e => setKitConfig(p => ({ ...p, trolleys: parseInt(e.target.value) || 1 }))} />
                </label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Cases par chariot
                  <input type="number" min={1} max={50} className="input" style={{ marginLeft: '0.5rem', width: '70px' }}
                    value={kitConfig.slotsPerTrolley} onChange={e => setKitConfig(p => ({ ...p, slotsPerTrolley: parseInt(e.target.value) || 1 }))} />
                </label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Barres par case
                  <input type="number" min={1} max={10} className="input" style={{ marginLeft: '0.5rem', width: '70px' }}
                    value={kitConfig.barsPerSlot} onChange={e => setKitConfig(p => ({ ...p, barsPerSlot: parseInt(e.target.value) || 1 }))} />
                </label>
              </div>
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <Layers size={20} color="#8b5cf6" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, flex: 1 }}>
                  Plan des Chariots — {totalBars} barres
                  {totalStockBarsUsed > 0 && (
                    <span style={{ marginLeft: '1rem', fontSize: '0.75rem', background: '#d1fae5', color: '#065f46', padding: '0.2rem 0.6rem', borderRadius: '699px', fontWeight: 700 }}>
                      ♻️ {totalStockBarsUsed} chute(s) de stock utilisée(s)
                    </span>
                  )}
                </h2>
                 <button onClick={generateLabelsPDF} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    🏷️ Générer Étiquettes
                 </button>
                 <button onClick={generateCuttingOptimizationPDF} className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    <RefreshCw size={16} />
                    Plan de Coupe Optimisé (Nesting)
                 </button>
              </div>
              <div style={{ marginTop: '1rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b' }}>
                 <Info size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                 Le plan d'optimisation (Nesting) utilise le <strong>Seuil de Chute</strong> défini dans l'Administration pour marquer les morceaux réutilisables (<span style={{color:'#16a34a', fontWeight:700}}>Vert</span>) ou les chutes perdues (<span style={{color:'#dc2626', fontWeight:700}}>Rouge</span>).
              </div>
              {totalBars === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aucune barre à afficher.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                  {Array.from({ length: kitConfig.trolleys }, (_, ti) => {
                    return (
                      <div key={ti} style={{ flex: '1 1 450px', minWidth: '400px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: 'white', fontWeight: 700, fontSize: '0.95rem', padding: '0.75rem 1rem', borderRadius: '0.5rem 0.5rem 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>🛒 Chariot {ti + 1}</span>
                        </div>
                        <div style={{ border: '2px solid #7c3aed', borderTop: 'none', borderRadius: '0 0 0.5rem 0.5rem', background: '#f8fafc' }}>
                          {Array.from({ length: kitConfig.slotsPerTrolley }, (_, si) => {
                            const slotBars = allBarsFlat.filter(b => b.trolley === ti + 1 && b.slot === si + 1);
                            return (
                              <div key={si} style={{ padding: '0.75rem', borderBottom: '1px solid #ede9fe', background: slotBars.length > 0 ? 'white' : 'transparent' }}>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#7c3aed', background: '#ede9fe', padding: '0.2rem 0.6rem', borderRadius: '4px', alignSelf: 'flex-start', minWidth: '45px', textAlign: 'center' }}>
                                    C{String(si + 1).padStart(2, '0')}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    {slotBars.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {slotBars.map((bar, bi) => (
                                          <div key={bi} style={{ background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: '6px', padding: '0.5rem' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.75rem', color: '#1e293b', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between' }}>
                                              <span>
                                                {bar.isStock && <span style={{ background: '#10b981', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', marginRight: '0.4rem', fontSize: '0.65rem', fontWeight: 700 }}>STOCK {bar.barLen}mm</span>}
                                                {bar.profileName} <span style={{fontWeight:400, color:'#64748b'}}>(L={bar.barLen}mm)</span>
                                              </span>
                                              <span style={{color:'#7c3aed'}}>#{bi+1}</span>
                                            </div>
                                            <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', background: '#e2e8f0', position: 'relative' }}>
                                              {bar.pieces.map((piece, pi) => (
                                                <div key={pi} style={{ 
                                                  flex: `0 0 ${(piece.length / bar.barLen) * 100}%`, 
                                                                                                    background: piece.windowIdx % 2 === 0 
                                                    ? `hsl(30, 85%, ${45 + (piece.windowIdx % 5) * 4}%)` 
                                                    : `hsl(210, 85%, ${45 + (piece.windowIdx % 5) * 4}%)`,
 
                                                  borderRight: '1px solid rgba(255,255,255,0.4)',
                                                  display: 'grid',
                                                  placeItems: 'center',
                                                  color: 'white',
                                                  fontSize: '0.65rem',
                                                  fontWeight: 700,
                                                  position: 'relative',
                                                  overflow: 'hidden'
                                                }}>
                                                  {piece.length >= 400 && <span>{piece.length}</span>}
                                                </div>
                                              ))}
                                              {bar.waste > 0 && (
                                                <div style={{ 
                                                  flex: `0 0 ${(bar.waste / bar.barLen) * 100}%`, 
                                                  background: bar.isTrash ? '#ef4444' : '#22c55e',
                                                  display: 'grid',
                                                  placeItems: 'center',
                                                  fontSize: '0.6rem',
                                                  color: 'white',
                                                  fontWeight: 700
                                                }}>
                                                  {bar.waste >= 300 && <span>{bar.waste}</span>}
                                                </div>
                                              )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                              {bar.pieces.map((p, i) => (
                                                <span key={i} style={{ fontSize: '0.6rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', color: '#475569' }}>
                                                  {p.label} ({p.length}) - {p.windowLabel}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic' }}>— Vide —</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass shadow-md" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <Scissors size={20} color="#10b981" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Détail des Barres</h2>
              </div>
              {Object.entries(barsResult).map(([profId, { profileName, bars, barLen }]) => (
                <div key={profId} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>{profileName} ({bars.length} barres)</div>
                  {bars.map((bar, bi) => (
                    <div key={bi} style={{ fontSize: '0.75rem', padding: '0.3rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, minWidth: '80px' }}>{bar.address}</span>
                      {bar.isStock && <span style={{ background: '#10b981', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700 }}>STOCK</span>}
                      <span style={{ flex: 1 }}>{bar.id}</span>
                      <span>{bar.used}mm utilisé</span>
                      <span style={{ color: bar.isTrash ? '#ef4444' : '#10b981', fontWeight: 700 }}>{bar.waste}mm {bar.isTrash ? 'Déchet' : 'Chute'}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}



    </div>
  );
};

export default ProductionModule;
