import React, { useState, useMemo } from 'react';
import { Truck, Package, QrCode, CheckCircle, AlertTriangle, XCircle, Download, Search, Plus, Trash2, ArrowLeft, ClipboardCheck, UserCheck, ShieldCheck, Layers, Wrench, FileText, MapPin, Share2, Camera, RefreshCw, MessageSquare, Trash, Clock, Factory, Play } from 'lucide-react';
import { syncDatabase, invokeFunction } from '../../utils/supabaseClient';
import jsPDF from 'jspdf';
import QRScanner from './QRScanner';
import { FormulaEngine } from '../../engine/formula-engine';
import { drawDocumentHeader } from '../../utils/pdfDocumentUtils';

// Module version: 1.0.1 - Logistic & Installation Tracking
const ShippingModule = ({ data, setData, refetchData, quoteSettings, setQuoteSettings }) => {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState(new Set());
  const [activeView, setActiveView] = useState('list'); // 'list' | 'details' | 'scanner' | 'zones'
  const [scanningMode, setScanningMode] = useState(null); // 'loading' | 'unloading' | 'installing'
  const [newZoneName, setNewZoneName] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [viewingShutter, setViewingShutter] = useState(null); // unit object
  const [showInstallerQr, setShowInstallerQr] = useState(null); // orderId or null
  const [showScanner, setShowScanner] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [newInstallerName, setNewInstallerName] = useState('');
  const [globalRemark, setGlobalRemark] = useState('');
  const [unitRemarks, setUnitRemarks] = useState({});
  const [showPVModal, setShowPVModal] = useState(false);
  const [pvSelectedFloors, setPvSelectedFloors] = useState(new Set());
  const [isFinalPV, setIsFinalPV] = useState(false);
  const [pvTeamMember, setPvTeamMember] = useState('');
  const [pvCustomName, setPvCustomName] = useState('');
  const [pvCustomRole, setPvCustomRole] = useState('');
  const [senderEmail, setSenderEmail] = useState('contact@entreprise.com');
  const [companyName, setCompanyName] = useState(quoteSettings?.companyName || 'ALU DESIGN'); // Nom depuis config ou par défaut
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendByEmail, setSendByEmail] = useState(false);
  const [blModalType, setBlModalType] = useState(null); // 'ALU' | 'VITRAGE' | 'VOLET' | 'CAISSON_TUNNEL' | null
  const [blSelectedUnitIds, setBlSelectedUnitIds] = useState(new Set());
  const [blSelectedGlassPanes, setBlSelectedGlassPanes] = useState({}); // { [unitId]: { [paneKey]: boolean } }
  const [expandedUnits, setExpandedUnits] = useState(new Set()); // Set of unitIds
  const [listTab, setListTab] = useState('ongoing'); // 'ongoing' | 'history'
  const [caissonTunnelComponents, setCaissonTunnelComponents] = useState({ axe: true, moteur: true, kit: true });


  React.useEffect(() => {
    if (quoteSettings?.companyName) {
      setCompanyName(quoteSettings.companyName);
    }
  }, [quoteSettings?.companyName]);
  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      if (refetchData) {
        await refetchData();
      } else {
        const freshData = await syncDatabase.load();
        if (freshData) setData(freshData);
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };
  
  const storageZones = data.storageZones || [];
  const shippableOrdersWithStats = useMemo(() => {
    return (data.orders || []).filter(order => order.batches && order.batches.length > 0).map(order => {
        const client = (data.clients || []).find(c => c.id === order.clientId);
        
        const stats = (order.batches || []).reduce((acc, b) => {
            (b.items || []).forEach(i => acc.total += (i.measurements || []).reduce((s, m) => s + m.qty, 0));
            return acc;
        }, { total: 0 });
        
        const aluDone = Object.values(order.unitStatusesDual || {}).filter(s => s.alu === 'Posé' || s.alu === 'Fini').length;
        const vitDone = Object.values(order.unitStatusesDual || {}).filter(s => s.vitrage === 'Fini').length;
        
        const progressAlu = stats.total > 0 ? (aluDone / stats.total) * 100 : 0;
        const progressVit = stats.total > 0 ? (vitDone / stats.total) * 100 : 0;
        const globalProgress = (progressAlu + progressVit) / 2;

        return {
          ...order,
          clientName: order.clientName || client?.nom || 'CLIENT INCONNU',
          stats,
          progressAlu,
          progressVit,
          globalProgress
        };
    });
  }, [data.orders, data.clients]);

  const displayedOrders = useMemo(() => {
    if (listTab === 'history') {
      return shippableOrdersWithStats.filter(o => o.globalProgress === 100);
    }
    return shippableOrdersWithStats.filter(o => o.globalProgress < 100);
  }, [shippableOrdersWithStats, listTab]);

  const selectedOrder = useMemo(() => {
    const order = (data.orders || []).find(o => o.id === selectedOrderId);
    if (!order) return null;
    const client = (data.clients || []).find(c => c.id === order.clientId);
    return { ...order, clientName: order.clientName || client?.nom || 'CLIENT INCONNU' };
  }, [data.orders, data.clients, selectedOrderId]);

  // Sync remarks when selectedOrder changes or data updates
  React.useEffect(() => {
    if (selectedOrder) {
      setGlobalRemark(selectedOrder.globalRemark || '');
      setUnitRemarks(selectedOrder.unitRemarks || {});
    }
  }, [selectedOrder?.id, selectedOrder?.globalRemark, selectedOrder?.unitRemarks]);

  const allUnits = useMemo(() => {
    if (!selectedOrder) return [];
    const engine = new FormulaEngine(data || {});
    const units = [];

    // Find active site plan
    const client = data?.clients?.find(c => c.id === selectedOrder.clientId);
    const plans = client?.sitePlans || [];
    let activeSitePlan = null;
    if (selectedOrder.sitePlanId) {
      activeSitePlan = plans.find(p => p.id === selectedOrder.sitePlanId);
    }
    if (!activeSitePlan) {
      for (const plan of plans) {
         for (const floor of (plan.floors || [])) {
            for (const apt of (floor.apartments || [])) {
               for (const voidItem of (apt.voids || [])) {
                  if (selectedOrder.items?.some(i => i.id === voidItem.itemId)) {
                     activeSitePlan = plan;
                     break;
                  }
               }
               if (activeSitePlan) break;
            }
            if (activeSitePlan) break;
         }
         if (activeSitePlan) break;
      }
    }
    if (!activeSitePlan && plans.length > 0) {
      activeSitePlan = plans[0];
    }

    (selectedOrder.batches || []).forEach(batch => {
      if (selectedBatchIds.size > 0 && !selectedBatchIds.has(batch.id)) return;
      (batch.items || []).forEach(item => {
        (item.measurements || []).forEach(m => {
          for (let i = 0; i < m.qty; i++) {
            const unitId = `${selectedOrder.id}-${batch.id}-${item.id}-${m.id}-${i}`;
            
            // Look up from activeSitePlan if possible
            let activeFloor = null;
            let activeApt = null;
            let voidIndex = -1;
            if (activeSitePlan?.floors) {
              // Try finding by measurement ID
              for (const f of activeSitePlan.floors) {
                for (const a of (f.apartments || [])) {
                  const idx = (a.voids || []).findIndex(v => v.id === m.id);
                  if (idx !== -1) {
                    activeFloor = f;
                    activeApt = a;
                    voidIndex = idx;
                    break;
                  }
                }
                if (activeFloor) break;
              }
              
              // If not found by ID, try parsing from the label matching site plan
              if (!activeFloor && m.label && m.label.includes(' - ')) {
                const parts = m.label.split(' - ');
                if (parts.length >= 3) {
                  const fName = parts[0].trim();
                  const aName = parts[1].trim();
                  const vName = parts[2].trim();
                  
                  const f = activeSitePlan.floors.find(fl => fl.name === fName);
                  if (f) {
                    const a = (f.apartments || []).find(ap => ap.name === aName);
                    if (a) {
                      const idx = (a.voids || []).findIndex(v => v.name === vName);
                      if (idx !== -1) {
                        activeFloor = f;
                        activeApt = a;
                        voidIndex = idx;
                      }
                    }
                  }
                }
              }
            }

            let name = m.instanceNames?.[i] || `${item.label} #${i + 1}`;
            let floor = m.instanceFloors?.[i] || '';
            let aptName = '';

            if (activeFloor && activeApt && voidIndex !== -1) {
              name = `${activeFloor.name}${activeApt.name}${voidIndex + 1}`;
              floor = activeFloor.name;
              aptName = activeApt.name;
            } else if (m.label && m.label.includes(' - ')) {
              const parts = m.label.split(' - ');
              if (parts.length >= 3) {
                const fName = parts[0].trim();
                const aName = parts[1].trim();
                const vName = parts[2].trim();
                const voidNumMatch = vName.match(/\d+/);
                const voidNum = voidNumMatch ? voidNumMatch[0] : '1';
                name = `${fName}${aName}${voidNum}`;
                floor = fName;
                aptName = aName;
              }
            }

            if (!aptName && name) {
              // Try extracting apartment from name (e.g. "1A1" -> apt "A")
              const match = name.match(/^(.*?[^A-Za-z])?([A-Za-z])(\d+)$/);
              if (match) {
                if (!floor) floor = (match[1] || '').trim().replace(/[-_]$/, '');
                aptName = match[2];
              } else {
                 const simpleMatch = name.match(/^([0-9]+)([A-Za-z])([0-9]+)$/);
                 if (simpleMatch) {
                    if (!floor) floor = simpleMatch[1];
                    aptName = simpleMatch[2];
                 }
              }
            }


            const dualStatus = selectedOrder.unitStatusesDual?.[unitId] || { alu: 'En production', vitrage: 'En production', volet: 'En production', caisson_tunnel: 'En production', glissiere: 'En production' };
            const storageZoneId = selectedOrder.unitStorageZones?.[unitId];
            const zone = storageZones.find(z => z.id === storageZoneId);

            // Determine if this specific instance has a shutter and its details
            let hasShutter = false;
            let shutterInfo = 'SANS VOLET';
            let isExtrudedLame = false;
            let isCaissonTunnel = false;
            let caissonSizeVal = 0;
            let glissiereNameVal = '';
            let offset = 0;
            const shutterOverridden = (m.shutterList || []).length > 0;

            const itemComp = (data.compositions || []).find(c => c.id === item.config?.compositionId);
            const itemRange = itemComp ? (data.ranges || []).find(r => r.id === itemComp.rangeId) : null;
            let gammeName = itemRange?.name || itemComp?.rangeId || '—';
            
            if (item.config?.compoundType && item.config.compoundType !== 'none' && item.config.compoundConfig?.parts) {
               const parts = item.config.compoundConfig.parts;
               const ouvrantCompId = parts.find(p => p.type === 'opening')?.compositionId;
               const fixeCompId = parts.find(p => p.type === 'fixe')?.compositionId;
               const ouvrantComp = (data.compositions || []).find(c => c.id === ouvrantCompId);
               const fixeComp = (data.compositions || []).find(c => c.id === fixeCompId);
               const ouvrantRange = ouvrantComp ? (data.ranges || []).find(r => r.id === ouvrantComp.rangeId)?.name : '';
               const fixeRange = fixeComp ? (data.ranges || []).find(r => r.id === fixeComp.rangeId)?.name : '';
               if (ouvrantRange && fixeRange && ouvrantRange !== fixeRange) {
                  gammeName = `${ouvrantRange} + ${fixeRange}`;
               } else if (ouvrantRange || fixeRange) {
                  gammeName = ouvrantRange || fixeRange;
               }
            }
            
            let instanceConfig = {
              ...item.config,
              L: m.L,
              H: m.H,
              wallDepth: m.wallDepth,
              handleHeight: m.handleHeight,
              partOverrides: m.partOverrides
            };

            let shutterAxe = '';
            let shutterMoteur = '';
            let shutterKit = '';

            if (shutterOverridden) {
              (m.shutterList || []).forEach(sh => {
                const sQty = Number(sh.qty) || 0;
                if (i >= offset && i < offset + sQty) {
                  hasShutter = true;
                  const caisson = sh.overrides?.caissonId || item.config.shutterConfig?.caissonId;
                  const kit = sh.overrides?.kitId || item.config.shutterConfig?.kitId;
                  const lameId = sh.overrides?.lameId || item.config.shutterConfig?.lameId;
                  const glissiereId = sh.overrides?.glissiereId || item.config.shutterConfig?.glissiereId;
                  
                  const lameObj = data.shutterComponents?.lames?.find(l => l.id === lameId);
                  if (lameObj && lameObj.hasBaguette) isExtrudedLame = true;
                  
                  const caissonObj = data.shutterComponents?.caissons?.find(c => c.id === caisson);
                  const caissonName = caissonObj?.name || caisson || '';
                  const caissonSize = parseFloat(caissonObj?.height) || parseFloat(caissonObj?.size) || parseFloat(caissonObj?.thickness) || 0;
                  caissonSizeVal = caissonSize;
                  if (caissonSize === 300 || caissonSize === 0) isCaissonTunnel = true;
                  
                  const kitName = data.shutterComponents?.kits?.find(k => k.id === kit)?.name || kit || '';
                  const lameName = lameObj?.name || lameId || '';
                  
                  const glissiereObj = data.shutterComponents?.glissieres?.find(g => g.id === glissiereId);
                  const glissiereName = glissiereObj?.name || glissiereId || '';
                  glissiereNameVal = glissiereName;
                  
                  shutterInfo = `${caissonName} ${lameName} ${kitName}`.trim() || 'AVEC VOLET';

                  const axeId = sh.overrides?.axeId || item.config.shutterConfig?.axeId;
                  shutterAxe = data.shutterComponents?.axes?.find(a => a.id === axeId)?.name || axeId || '';
                  
                  const moteurId = sh.overrides?.moteurId || item.config.shutterConfig?.moteurId;
                  shutterMoteur = data.shutterComponents?.moteurs?.find(m => m.id === moteurId)?.name || moteurId || '';
                  
                  shutterKit = kitName;

                  instanceConfig.hasShutter = true;
                  instanceConfig.shutterConfig = {
                    ...(item.config?.shutterConfig || {}),
                    ...(sh.overrides || {})
                  };
                  instanceConfig.shutterOverrides = { ...(sh.overrides || {}), customLV: sh.customLV };
                }
                offset += sQty;
              });
            } else if (item.config.hasShutter) {
              hasShutter = true;
              const caisson = item.config.shutterConfig?.caissonId;
              const kit = item.config.shutterConfig?.kitId;
              const lameId = item.config.shutterConfig?.lameId;
              const glissiereId = item.config.shutterConfig?.glissiereId;
              
              const lameObj = data.shutterComponents?.lames?.find(l => l.id === lameId);
              if (lameObj && lameObj.hasBaguette) isExtrudedLame = true;
              
              const caissonObj = data.shutterComponents?.caissons?.find(c => c.id === caisson);
              const caissonName = caissonObj?.name || caisson || '';
              const caissonSize = parseFloat(caissonObj?.height) || parseFloat(caissonObj?.size) || parseFloat(caissonObj?.thickness) || 0;
              caissonSizeVal = caissonSize;
              if (caissonSize === 300 || caissonSize === 0) isCaissonTunnel = true;
              
              const kitName = data.shutterComponents?.kits?.find(k => k.id === kit)?.name || kit || '';
              const lameName = lameObj?.name || lameId || '';
              
              const glissiereObj = data.shutterComponents?.glissieres?.find(g => g.id === glissiereId);
              const glissiereName = glissiereObj?.name || glissiereId || '';
              glissiereNameVal = glissiereName;
              
              shutterInfo = `${caissonName} ${lameName} ${kitName}`.trim() || 'AVEC VOLET';

              const axeId = item.config.shutterConfig?.axeId;
              shutterAxe = data.shutterComponents?.axes?.find(a => a.id === axeId)?.name || axeId || '';
              
              const moteurId = item.config.shutterConfig?.moteurId;
              shutterMoteur = data.shutterComponents?.moteurs?.find(m => m.id === moteurId)?.name || moteurId || '';
              
              shutterKit = kitName;
            }

            let glassPanes = [];
            try {
              const bomResult = engine.calculateBOM(instanceConfig, []);
              if (bomResult && bomResult.glassDetails) {
                let paneIndex = 0;
                bomResult.glassDetails.forEach(g => {
                  const qty = g.qty || 1;
                  for (let q = 0; q < qty; q++) {
                    glassPanes.push({
                      id: `${g.id || 'glass'}_${paneIndex++}`,
                      name: g.name || 'Vitrage',
                      width: Math.round(g.width || 0),
                      height: Math.round(g.height || 0),
                      qty: 1
                    });
                  }
                });
              }
            } catch (e) {
              console.warn("Glass calculation failed for unit", e);
            }

            let openingType = itemComp?.openingType || 'Fixe';
            if (item.config?.compoundType && item.config.compoundType !== 'none' && item.config.compoundConfig?.parts) {
               const parts = item.config.compoundConfig.parts;
               const hasCoulissant = parts.some(p => {
                 const comp = (data.compositions || []).find(c => c.id === p.compositionId);
                 return comp?.openingType === 'Coulissant';
               });
               if (hasCoulissant) {
                 openingType = 'Coulissant';
               }
            }

            units.push({
              id: unitId,
              orderId: selectedOrder.id,
              batchId: batch.id,
              itemId: item.id,
              mId: m.id,
              index: i,
              name: name,
              floor: floor,
              aptName: aptName,
              label: item.label,
              gammeName: gammeName,
              dimensions: `${m.L} x ${m.H}`,
              statusAlu: dualStatus.alu,
              statusVitrage: dualStatus.vitrage,
              statusVolet: dualStatus.volet || 'En production',
              statusCaissonTunnel: dualStatus.caisson_tunnel || 'En production',
              statusGlissiere: dualStatus.glissiere || 'En production',
              hasShutter: hasShutter,
              isExtrudedLame: isExtrudedLame,
              isCaissonTunnel: isCaissonTunnel,
              caissonSize: caissonSizeVal,
              glissiereName: glissiereNameVal,
              shutterInfo: shutterInfo,
              shutterAxe: shutterAxe,
              shutterMoteur: shutterMoteur,
              shutterKit: shutterKit,
              storageZoneId: storageZoneId,
              storageZone: zone?.name || '',
              glassPanes: glassPanes,
              openingType: openingType
            });
          }
        });
      });
    });
    return units;
  }, [selectedOrder, selectedBatchIds]);

  const remainingBLUnits = useMemo(() => {
    if (!blModalType) return [];
    return allUnits.filter(u => {
      if (blModalType === 'ALU') {
        return u.statusAlu !== 'Livré' && u.statusAlu !== 'Posé' && u.statusAlu !== 'Fini';
      } else if (blModalType === 'VITRAGE') {
        if (u.statusVitrage === 'Livré' || u.statusVitrage === 'Fini') return false;
        const panes = u.glassPanes || [];
        if (panes.length === 0) return true;
        const delivered = selectedOrder.deliveredGlassPanes?.[u.id] || {};
        const remainingPanes = panes.filter(g => {
          const paneKey = `${g.id || g.name}_${g.width}_${g.height}`;
          const deliveredQty = delivered[paneKey] || 0;
          return deliveredQty < g.qty;
        });
        return remainingPanes.length > 0;
      } else if (blModalType === 'VOLET') {
        return (u.isExtrudedLame || u.isCaissonTunnel) && u.statusVolet !== 'Livré' && u.statusVolet !== 'Fini' && u.statusVolet !== 'Posé';
      } else if (blModalType === 'GLISSIERE') {
        return u.hasShutter && u.caissonSize === 0 && u.statusGlissiere !== 'Livré' && u.statusGlissiere !== 'Fini' && u.statusGlissiere !== 'Posé';
      } else if (blModalType === 'CAISSON_TUNNEL') {
        if (u.statusCaissonTunnel === 'Livré' || u.statusCaissonTunnel === 'Fini' || u.statusCaissonTunnel === 'Posé') return false;
        if (!u.isCaissonTunnel) return false;
        const hasComponents = !!u.shutterAxe || !!u.shutterMoteur || !!u.shutterKit;
        if (!hasComponents) return true;
        const delivered = selectedOrder.deliveredCaissonTunnel?.[u.id] || { axe: false, moteur: false, kit: false };
        const needsAxe = !!u.shutterAxe && !delivered.axe;
        const needsMoteur = !!u.shutterMoteur && !delivered.moteur;
        const needsKit = !!u.shutterKit && !delivered.kit;
        return needsAxe || needsMoteur || needsKit;
      }
      return false;
    });
  }, [allUnits, blModalType, selectedOrder]);

  const groupedRemainingBLUnits = useMemo(() => {
    const grouped = {};
    remainingBLUnits.forEach(u => {
      const fl = u.floor || 'Sans étage';
      const apt = u.aptName || 'Général';
      if (!grouped[fl]) grouped[fl] = {};
      if (!grouped[fl][apt]) grouped[fl][apt] = [];
      grouped[fl][apt].push(u);
    });
    return grouped;
  }, [remainingBLUnits]);

  React.useEffect(() => {
    if (blModalType === 'VITRAGE') {
      const initialPanes = {};
      remainingBLUnits.forEach(u => {
        const uPanes = {};
        const delivered = selectedOrder.deliveredGlassPanes?.[u.id] || {};
        (u.glassPanes || []).forEach(g => {
          const paneKey = `${g.id || g.name}_${g.width}_${g.height}`;
          if ((delivered[paneKey] || 0) < g.qty) {
            uPanes[paneKey] = true;
          }
        });
        initialPanes[u.id] = uPanes;
      });
      setBlSelectedGlassPanes(initialPanes);
      setExpandedUnits(new Set());
    } else {
      setBlSelectedGlassPanes({});
      setExpandedUnits(new Set());
    }
  }, [blModalType, remainingBLUnits, selectedOrder]);

  const handleUpdateUnitRemark = (unitId, remark) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const o = { ...orders[oIdx] };
      const remarks = { ...(o.unitRemarks || {}) };
      remarks[unitId] = remark;
      o.unitRemarks = remarks;
      orders[oIdx] = o;
      setUnitRemarks(remarks);
      return { ...prev, orders };
    });
  };

  const handleUpdateUnitStatusDual = (unitId, component, newStatus, userName = 'ADMIN', actionType = 'finish', issueType = null) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const dualStatuses = { ...(order.unitStatusesDual || {}) };
      const current = dualStatuses[unitId] || { alu: 'En production', vitrage: 'En production', volet: 'En production', caisson_tunnel: 'En production', glissiere: 'En production' };
      
      const event = {
        date: new Date().toISOString(),
        user: userName,
        component: component,
        status: newStatus,
        action: actionType,
        issue: issueType
      };

      if (actionType !== 'issue') {
        if (component === 'both') {
          current.alu = newStatus;
          current.vitrage = newStatus;
          current.volet = newStatus;
          current.caisson_tunnel = newStatus;
          current.glissiere = newStatus;
        } else {
          current[component] = newStatus;
        }
      }
      
      const timeline = { ...(order.unitTimeline || {}) };
      if (!timeline[unitId]) timeline[unitId] = [];
      timeline[unitId].push(event);

      dualStatuses[unitId] = { ...current };
      order.unitStatusesDual = dualStatuses;
      order.unitTimeline = timeline;
      orders[oIdx] = order;
      return { ...prev, orders };
    });
  };

  const handleBulkUpdateStatusDual = (component, newStatus, actionType = 'finish') => {
    if (selectedUnitIds.size === 0) return;
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const dualStatuses = { ...(order.unitStatusesDual || {}) };
      const timeline = { ...(order.unitTimeline || {}) };
      const userName = 'ADMIN';

      selectedUnitIds.forEach(unitId => {
        const current = { ...(dualStatuses[unitId] || { alu: 'En production', vitrage: 'En production', volet: 'En production', caisson_tunnel: 'En production', glissiere: 'En production' }) };
        if (component === 'both') {
          current.alu = newStatus;
          current.vitrage = newStatus;
          current.volet = newStatus;
          current.caisson_tunnel = newStatus;
          current.glissiere = newStatus;
        } else {
          current[component] = newStatus;
        }
        dualStatuses[unitId] = { ...current };

        const event = {
          date: new Date().toISOString(),
          user: userName,
          component: component,
          status: newStatus,
          action: actionType,
          issue: null
        };
        if (!timeline[unitId]) timeline[unitId] = [];
        timeline[unitId].push(event);
      });

      order.unitStatusesDual = dualStatuses;
      order.unitTimeline = timeline;
      orders[oIdx] = order;
      return { ...prev, orders };
    });
    setSelectedUnitIds(new Set());
  };

  const handleBatchUpdateStatus = (batchId, newStatus, actionType = 'finish') => {
    // Get all units for this order and batch
    if (!selectedOrder) return;
    const batchUnitIds = [];
    (selectedOrder.batches || []).forEach(b => {
      if (b.id !== batchId) return;
      (b.items || []).forEach(item => {
        (item.measurements || []).forEach(m => {
          for (let i = 0; i < (m.qty || 1); i++) {
            batchUnitIds.push(`${selectedOrder.id}-${b.id}-${item.id}-${m.id}-${i}`);
          }
        });
      });
    });

    if (batchUnitIds.length === 0) return;

    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const dualStatuses = { ...(order.unitStatusesDual || {}) };
      const timeline = { ...(order.unitTimeline || {}) };
      const userName = 'ADMIN';

      batchUnitIds.forEach(unitId => {
        const current = { ...(dualStatuses[unitId] || { alu: 'En production', vitrage: 'En production', volet: 'En production', caisson_tunnel: 'En production', glissiere: 'En production' }) };
        current.alu = newStatus;
        current.vitrage = newStatus;
        current.volet = newStatus;
        current.caisson_tunnel = newStatus;
        current.glissiere = newStatus;
        
        dualStatuses[unitId] = { ...current };

        const event = {
          date: new Date().toISOString(),
          user: userName,
          component: 'both',
          status: newStatus,
          action: actionType,
          issue: null
        };
        if (!timeline[unitId]) timeline[unitId] = [];
        timeline[unitId] = [...timeline[unitId], event];
      });

      order.unitStatusesDual = dualStatuses;
      order.unitTimeline = timeline;
      orders[oIdx] = order;
      return { ...prev, orders };
    });
  };

  const handleUpdateTeam = (name, action = 'add') => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const team = [...(order.installers || [])];
      
      if (action === 'add' && name && !team.includes(name)) team.push(name);
      if (action === 'remove') {
        const idx = team.indexOf(name);
        if (idx > -1) team.splice(idx, 1);
      }
      
      order.installers = team;
      orders[oIdx] = order;
      return { ...prev, orders };
    });
  };

  const handleUpdateUnitZone = (unitId, zoneId) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const zones = { ...(order.unitStorageZones || {}) };
      if (!zoneId) delete zones[unitId];
      else zones[unitId] = zoneId;
      order.unitStorageZones = zones;
      orders[oIdx] = order;
      return { ...prev, orders };
    });
  };

  const handleBulkUpdateZone = (zoneId) => {
    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const zones = { ...(order.unitStorageZones || {}) };
      
      selectedUnitIds.forEach(unitId => {
        if (!zoneId) delete zones[unitId];
        else zones[unitId] = zoneId;
      });
      
      order.unitStorageZones = zones;
      orders[oIdx] = order;
      return { ...prev, orders };
    });
    setSelectedUnitIds(new Set());
  };

  const toggleUnitSelection = (id) => {
    setSelectedUnitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

   const handleScanUnit = (id, component = 'alu') => {
    const unit = allUnits.find(u => u.id === id);
    if (!unit) {
      alert("ERREUR : Code inconnu ou lot non sélectionné !");
      return 'error';
    }
    const targetStatus = scanningMode === 'loading' ? 'Chargé' : (scanningMode === 'unloading' ? 'Livré' : 'Posé');
    handleUpdateUnitStatusDual(id, component, targetStatus);
    return 'success';
  };

  const generatePackingLabels = async () => {
    // Format 100mm x 150mm (Standard Bordereau Logistique)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
    
    // Helper function to get DataURL from URL
    const getQrDataUrl = (data) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          resolve(null); // Return null on error to avoid blocking
        };
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`;
      });
    };

    // Pre-fetch all QR code data URLs in parallel batches of 15 to bypass API rate-limiting and maximize speed
    const qrDataUrls = new Array(allUnits.length);
    const batchSize = 15;
    for (let i = 0; i < allUnits.length; i += batchSize) {
      const batch = allUnits.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(unit => getQrDataUrl(unit.id)));
      for (let j = 0; j < results.length; j++) {
        qrDataUrls[i + j] = results[j];
      }
    }

    for (let idx = 0; idx < allUnits.length; idx++) {
      const unit = allUnits[idx];
      if (idx > 0) doc.addPage([100, 150], 'portrait');
      
      // Bordure extérieure
      doc.setLineWidth(0.8);
      doc.setDrawColor(15, 23, 42);
      doc.rect(2, 2, 96, 146);
      
      // Header - Fond sombre (Hauteur 16mm)
      doc.setFillColor(15, 23, 42);
      doc.rect(2, 2, 96, 16, 'F');
      
      let titleX = 50;
      let titleAlign = 'center';

      // Affichage du Logo Spécifique Bordereau si présent (Conserve les proportions)
      const bordereauLogo = quoteSettings?.bordereauLogoBase64 || quoteSettings?.logoBase64;
      if (bordereauLogo) {
        try {
          const imgProps = doc.getImageProperties(bordereauLogo);
          const maxLogoW = 32; // Largeur max 32mm
          const maxLogoH = 12; // Hauteur max 12mm
          const ratio = Math.min(maxLogoW / imgProps.width, maxLogoH / imgProps.height);
          const logoW = imgProps.width * ratio;
          const logoH = imgProps.height * ratio;
          const logoY = 2 + (16 - logoH) / 2; // Centré verticalement dans le header

          const fmt = bordereauLogo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(bordereauLogo, fmt, 4, logoY, logoW, logoH, '', 'FAST');

          titleX = 4 + logoW + 2 + (96 - (4 + logoW + 2)) / 2;
        } catch (e) {
          console.warn("Logo draw error on bordereau:", e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('BORDEREAU D\'EXPÉDITION', titleX, 11.5, { align: titleAlign });
      
      doc.setTextColor(0, 0, 0);
      
      // Section 1 : Info Commande (y = 20 à 41)
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text('CLIENT :', 5, 22);
      
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      const cName = (selectedOrder.clientName || 'CLIENT').toUpperCase();
      const splitClientName = doc.splitTextToSize(cName, 88);
      doc.text(splitClientName[0], 5, 27.5); // Limité à 1 ligne sans chevauchement
      
      // Ligne : CMD, LOT, ÉTAGE (Espacements fixes et calculés)
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
      doc.text(`CMD : ${selectedOrder.id}`, 5, 36);
      doc.text(`LOT : ${unit.batchId}`, 42, 36);
      doc.setTextColor(37, 99, 235); doc.setFont('helvetica', 'bold');
      doc.text(`ÉTAGE : ${unit.floor || '---'}`, 72, 36);
      doc.setTextColor(0, 0, 0);
      
      doc.setLineWidth(0.3); doc.setDrawColor(226, 232, 240);
      doc.line(5, 40, 95, 40);
      
      // Section 2 : REPÈRE / EMPLACEMENT (y = 42 à 65)
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text('REPÈRE / EMPLACEMENT :', 5, 46);
      
      // Taille de police dynamique pour éviter tout débordement sur les noms longs (ex: 8A1 vs Noms à rallonge)
      const uName = String(unit.name || '');
      let repereFontSize = 24;
      if (uName.length > 14) repereFontSize = 14;
      else if (uName.length > 9) repereFontSize = 18;
      else if (uName.length > 6) repereFontSize = 21;

      doc.setFontSize(repereFontSize); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text(uName, 50, 59, { align: 'center' });
      
      // Section 3 : ZONE DE STOCKAGE (y = 66 à 75)
      doc.setFillColor(241, 245, 249);
      doc.rect(5, 65, 90, 8, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`ZONE DE STOCKAGE : ${unit.storageZone || 'À ASSIGNER'}`, 50, 70.5, { align: 'center' });
      
      doc.setLineWidth(0.3); doc.setDrawColor(226, 232, 240);
      doc.line(5, 76, 95, 76);
      
      // Section 4 : Détails Techniques (y = 77 à 101)
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
      
      const labelText = doc.splitTextToSize(`Type : ${unit.label}`, 88);
      doc.text(labelText[0], 5, 82);
      
      doc.text(`Cotes : ${unit.dimensions} mm`, 5, 87.5);
      
      if (unit.hasShutter) {
        doc.setFontSize(8);
        const shutterText = doc.splitTextToSize(`Volet : ${unit.shutterInfo}`, 88);
        doc.text(shutterText[0], 5, 93);
      }
      
      // Section 5 : QR CODE (VRAI CODE SCANNABLE) (y = 100 à 144)
      doc.setLineWidth(0.4); doc.setDrawColor(51, 65, 85);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 85);
      doc.text('SCANNEZ POUR VALIDER (LIVRAISON / POSE)', 50, 101, { align: 'center' });
      
      doc.rect(34, 103, 32, 32); // Cadre propre 32x32mm
      const qrDataUrl = qrDataUrls[idx];
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', 35, 104, 30, 30);
      }
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
      doc.text(unit.id, 50, 143, { align: 'center' });
    }
    
    doc.save(`Bordereaux_Logistique_${selectedOrder.id}.pdf`);
  };


  const generateStatusReport = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const photos = selectedOrder.unitInstallationPhotos || {};
    const timeline = selectedOrder.unitTimeline || {};

    const getImgFormat = (dataUrl) => {
      if (!dataUrl) return 'JPEG';
      if (dataUrl.startsWith('data:image/png')) return 'PNG';
      if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
      return 'JPEG';
    };
    
    const client = (data.clients || []).find(c => c.id === selectedOrder.clientId) || { nom: selectedOrder.clientName };
    let y = drawDocumentHeader(doc, quoteSettings, client, {
      title: "ÉTAT D'AVANCEMENT CHANTIER",
      docLabel: 'Commande N°',
      docValue: selectedOrder.id,
      docDate: new Date().toLocaleDateString('fr-FR'),
      showClientBox: true
    });
    
    if (globalRemark) {
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('Remarques Générales du Chantier', 15, y);
      doc.setDrawColor(226, 232, 240); doc.line(15, y + 5, 60, y + 5);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
      const splitRemark = doc.splitTextToSize(globalRemark, pw - 30);
      doc.text(splitRemark, 15, y + 15);
      y += 15 + splitRemark.length * 5 + 10;
    }

    doc.setTextColor(30, 41, 59); doc.setFontSize(18); doc.setFont('helvetica', 'bold'); 
    doc.text('Détails des Produits & Suivi Site', 15, y);
    doc.setDrawColor(59, 130, 246); doc.setLineWidth(1); doc.line(15, y + 2, 40, y + 2);
    y += 15;

    allUnits.forEach((unit) => {
      // Normalize ID lookup
      const normalizedId = unit.id.trim();
      const photo = photos[normalizedId] || photos[unit.id];
      const events = timeline[normalizedId] || timeline[unit.id] || [];
      const remark = unitRemarks[normalizedId] || unitRemarks[unit.id];
      
      const findDate = (status) => {
        let ev = [...events].reverse().find(e => e.status === status);
        // Fallback: If status is Fini but no Fini event, use the latest event as date
        if (!ev && status === 'Fini' && (unit.statusAlu === 'Fini' || unit.statusAlu === 'Posé')) {
          ev = events[events.length - 1];
        }
        return ev ? new Date(ev.date).toLocaleDateString('fr-FR') : '---';
      };

      // Layout calculations
      const photoH = photo ? 75 : 0;
      const infoH = 45; // Base height for text info
      const remarkH = remark ? (doc.splitTextToSize(remark, pw - 40).length * 5) + 5 : 0;
      const boxH = infoH + remarkH + photoH;

      if (y + boxH > ph - 20) { doc.addPage(); y = 20; }

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.1);
      doc.roundedRect(15, y, pw - 30, boxH, 2, 2, 'FD');
      
      // Header: Unit Name & Dimensions
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
      doc.text(`${unit.name} — ${unit.label}`, 20, y + 10);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(`Dimensions: ${unit.dimensions} mm  |  Étage: ${unit.floor || 'N/A'}`, 20, y + 16);

      // Status Badges
      const isFini = unit.statusAlu === 'Fini' && unit.statusVitrage === 'Fini';
      const statusColor = isFini ? '#10b981' : (unit.statusAlu === 'Posé' ? '#8b5cf6' : '#3b82f6');
      doc.setFillColor(statusColor);
      doc.roundedRect(20, y + 20, 30, 6, 1, 1, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text(`ALU: ${unit.statusAlu}`, 35, y + 24.5, { align: 'center' });
      
      doc.setFillColor(unit.statusVitrage === 'Fini' ? '#10b981' : '#3b82f6');
      doc.roundedRect(55, y + 20, 30, 6, 1, 1, 'F');
      doc.text(`VIT: ${unit.statusVitrage}`, 70, y + 24.5, { align: 'center' });

      // Shutter Info
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
      doc.text(`Volet: ${unit.shutterInfo}`, 95, y + 24.5);

      // Timeline Dates
      doc.setFontSize(8); doc.setTextColor(71, 85, 105);
      doc.text(`• Livraison: ${findDate('Livré')}`, 20, y + 33);
      doc.text(`• Manutention: ${findDate('Manutention')}`, 70, y + 33);
      doc.text(`• Finition: ${findDate('Fini')}`, 120, y + 33);

      let contentY = y + 42;

      // Remark
      if (remark) {
        doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 116, 139);
        const splitRemark = doc.splitTextToSize(`Note terrain: ${remark}`, pw - 40);
        doc.text(splitRemark, 20, contentY);
        contentY += (splitRemark.length * 5) + 2;
      }

      // Photo
      if (photo) {
        try {
          const fmt = getImgFormat(photo);
          doc.addImage(photo, fmt, 20, contentY, 80, 65);
        } catch (e) {
          console.error('jsPDF addImage error:', e);
          doc.setFont('helvetica', 'italic'); doc.setTextColor(239, 68, 68);
          doc.text('[Erreur affichage photo]', 20, contentY + 5);
        }
      }

      doc.setTextColor(30, 41, 59);
      y += boxH + 8;
    });
    doc.save(`Rapport_Etat_Chantier_${selectedOrder.id}.pdf`);
  };

  const generatePerformanceReport = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const timeline = selectedOrder.unitTimeline || {};
    const photos = selectedOrder.unitInstallationPhotos || {};

    const getImgFormat = (dataUrl) => {
      if (!dataUrl) return 'JPEG';
      if (dataUrl.startsWith('data:image/png')) return 'PNG';
      if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
      return 'JPEG';
    };

    // --- PAGE 1: EXECUTIVE DASHBOARD ---
    const client = (data.clients || []).find(c => c.id === selectedOrder.clientId) || { nom: selectedOrder.clientName };
    let y = drawDocumentHeader(doc, quoteSettings, client, {
      title: "AUDIT PERFORMANCE",
      docLabel: 'Projet N°',
      docValue: selectedOrder.id,
      docDate: new Date().toLocaleDateString('fr-FR'),
      showClientBox: true
    });

    // KPI Calc
    const stats = {
      total: allUnits.length,
      done: allUnits.filter(u => u.statusAlu === 'Posé' || u.statusAlu === 'Fini').length,
      vitDone: allUnits.filter(u => u.statusVitrage === 'Fini').length,
      sav: 0,
      totalTime: 0,
      timeCount: 0
    };

    const installerMap = {};
    const issues = [];

    allUnits.forEach(u => {
      const events = [...(timeline[u.id] || [])].sort((a,b) => new Date(a.date) - new Date(b.date));
      
      events.forEach((ev, idx) => {
        if (!installerMap[ev.user]) installerMap[ev.user] = { manut: 0, pose: 0, finit: 0, sav: 0, times: [] };
        
        if (ev.status === 'Manutention') installerMap[ev.user].manut++;
        if (ev.status === 'Posé') installerMap[ev.user].pose++;
        if (ev.status === 'Fini') installerMap[ev.user].finit++;
        
        if (ev.issue) {
          stats.sav++;
          installerMap[ev.user].sav++;
          issues.push({ unit: u.name, user: ev.user, issue: ev.issue, date: ev.date });
        }

        // Duration based on previous event end time
        if (idx > 0) {
          const prevEv = events[idx - 1];
          const diff = (new Date(ev.date) - new Date(prevEv.date)) / 60000;
          if (diff > 0 && diff < 1440) { // Max 24h
            installerMap[ev.user].times.push(diff);
          }
        }
      });
    });

    // Drawing KPI Boxes
    const drawBox = (x, y, w, h, label, value, color) => {
      doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240); doc.rect(x, y, w, h, 'S');
      doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.text(label.toUpperCase(), x + 5, y + 8);
      doc.setTextColor(color[0], color[1], color[2]); doc.setFontSize(16); doc.text(value, x + 5, y + 20);
    };

    let bx = 15;
    const bw = (pw - 40) / 4;
    const boxY = y + 10;
    drawBox(bx, boxY, bw, 30, 'Unités Totales', `${stats.total}`, [30, 41, 59]);
    drawBox(bx + bw + 3.3, boxY, bw, 30, 'Taux Pose', `${((stats.done/stats.total)*100 || 0).toFixed(1)}%`, [139, 92, 246]);
    drawBox(bx + (bw + 3.3)*2, boxY, bw, 30, 'Taux Finition', `${((stats.vitDone/stats.total)*100 || 0).toFixed(1)}%`, [16, 185, 129]);
    drawBox(bx + (bw + 3.3)*3, boxY, bw, 30, 'Litiges SAV', `${stats.sav}`, [239, 68, 68]);

    // Visual Chart: Workload distribution
    doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('DISTRIBUTION DE LA CHARGE DE TRAVAIL', 15, boxY + 45);
    let chartY = boxY + 55;
    Object.entries(installerMap).forEach(([name, data]) => {
      const totalActions = data.manut + data.pose + data.finit;
      if (totalActions === 0) return;
      doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text(name, 15, chartY + 5);
      const fullW = pw - 60;
      const mWS = (data.manut / stats.total) * fullW;
      const pWS = (data.pose / stats.total) * fullW;
      const fWS = (data.finit / stats.total) * fullW;
      
      doc.setFillColor(59, 130, 246, 0.2); doc.rect(45, chartY, mWS, 6, 'F'); // Manut
      doc.setFillColor(139, 92, 246, 0.2); doc.rect(45 + mWS, chartY, pWS, 6, 'F'); // Pose
      doc.setFillColor(16, 185, 129, 0.2); doc.rect(45 + mWS + pWS, chartY, fWS, 6, 'F'); // Finit
      chartY += 10;
    });

    // --- PAGE 2: INSTALLER ANALYSIS ---
    doc.addPage();
    doc.setTextColor(30, 41, 59); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('ANALYSE DÉTAILLÉE PAR INTERVENANT', 15, 25);
    doc.setDrawColor(30, 41, 59); doc.line(15, 28, 40, 28);

    let ty = 45;
    doc.setFontSize(8); doc.setFillColor(241, 245, 249); doc.rect(15, ty - 7, pw - 30, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('NOM DU POSEUR', 18, ty);
    doc.text('MANUT.', 65, ty);
    doc.text('POSE ALU', 85, ty);
    doc.text('FINITION', 110, ty);
    doc.text('T. MOYEN', 135, ty);
    doc.text('SAV', 160, ty);
    doc.text('SCORE Q.', 180, ty);

    ty += 12;
    Object.entries(installerMap).forEach(([name, data]) => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(name, 18, ty);
      doc.text(`${data.manut}`, 65, ty);
      doc.text(`${data.pose}`, 85, ty);
      doc.text(`${data.finit}`, 110, ty);
      const avg = data.times.length > 0 ? (data.times.reduce((a,b)=>a+b,0)/data.times.length).toFixed(1) + 'm' : '---';
      doc.text(avg, 135, ty);
      doc.text(`${data.sav}`, 160, ty);
      const score = Math.max(0, 100 - (data.sav * 10)).toFixed(0) + '%';
      doc.setTextColor(data.sav > 2 ? 220 : 0, data.sav > 2 ? 0 : 150, 0);
      doc.text(score, 180, ty);
      doc.setTextColor(30, 41, 59);
      doc.setDrawColor(241, 245, 249); doc.line(15, ty + 4, pw - 15, ty + 4);
      ty += 12;
      if (ty > ph - 20) { doc.addPage(); ty = 30; }
    });

    if (issues.length > 0) {
      doc.addPage();
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('REGISTRE DES NON-CONFORMITÉS', 15, 25);
      let iy = 45;
      issues.forEach(iss => {
        doc.setFillColor(254, 242, 242); doc.roundedRect(15, iy, pw - 30, 15, 1, 1, 'F');
        doc.setFontSize(9); doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold');
        doc.text(`${iss.unit} : ${iss.issue}`, 20, iy + 6);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(153, 27, 27);
        doc.text(`Signalé par ${iss.user} le ${new Date(iss.date).toLocaleString()}`, 20, iy + 11);
        iy += 18;
        if (iy > ph - 20) { doc.addPage(); iy = 25; }
      });
    }

    // --- PAGE 3+: UNIT DRILL-DOWN ---
    doc.addPage();
    let uy = 20;
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('AUDIT DÉTAILLÉ PAR PRODUIT', 15, uy);
    doc.line(15, uy + 2, 40, uy + 2);
    uy += 20;

    allUnits.forEach((unit) => {
      const events = timeline[unit.id] || [];
      const photo = photos[unit.id];
      const boxH = Math.max(60, 25 + (events.length * 6) + (photo ? 50 : 0));

      if (uy + boxH > ph - 20) { doc.addPage(); uy = 20; }

      // Card Container
      doc.setDrawColor(226, 232, 240); doc.setFillColor(255, 255, 255);
      doc.roundedRect(15, uy, pw - 30, boxH, 2, 2, 'FD');

      // Left Info Bar
      doc.setFillColor(30, 41, 59); doc.rect(15, uy, 2, boxH, 'F');

      // Header
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
      doc.text(`${unit.name} | ${unit.label}`, 22, uy + 10);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(`${unit.dimensions} mm | Étage: ${unit.floor || 'N/A'} | Zone: ${unit.zoneName || 'Non zoné'}`, 22, uy + 15);

      // Specs callout
      if (unit.shutterInfo) {
        doc.setFillColor(239, 246, 255); doc.roundedRect(pw - 85, uy + 5, 65, 12, 1, 1, 'F');
        doc.setTextColor(30, 64, 175); doc.setFontSize(7); doc.text('CONFIG VOLET', pw - 80, uy + 9);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text(unit.shutterInfo, pw - 80, uy + 14);
      }

      // Timeline Visual
      let ey = uy + 25;
      doc.setFontSize(7.5); doc.setTextColor(51, 65, 85);
      const sortedEvents = [...events].sort((a,b) => new Date(a.date) - new Date(b.date));
      sortedEvents.forEach((ev, idx) => {
        doc.setDrawColor(203, 213, 225);
        if (idx < sortedEvents.length - 1) doc.line(25, ey + 2, 25, ey + 6);
        doc.setFillColor(idx === sortedEvents.length - 1 ? 59 : 203, idx === sortedEvents.length - 1 ? 130 : 213, idx === sortedEvents.length - 1 ? 246 : 225);
        doc.circle(25, ey, 1, 'F');
        
        let durStr = "";
        if (idx > 0) {
          const diff = (new Date(ev.date) - new Date(sortedEvents[idx-1].date)) / 60000;
          if (diff > 0 && diff < 1440) durStr = ` (+${diff.toFixed(0)} min)`;
        }
        
        const typeTag = ev.action === 'start' ? ' [DÉBUT]' : ev.action === 'finish' ? ' [FIN]' : ev.action === 'issue' ? ' [SAV]' : '';
        doc.setFont('helvetica', idx === sortedEvents.length - 1 ? 'bold' : 'normal');
        doc.text(`${new Date(ev.date).toLocaleTimeString('fr-FR')} - ${ev.status}${typeTag}${durStr} — par ${ev.user}`, 30, ey + 1);
        ey += 6;
      });

      // Photo
      if (photo) {
        try {
          const fmt = getImgFormat(photo);
          doc.addImage(photo, fmt, 22, ey + 5, 55, 40);
        } catch (e) {}
      }

      uy += boxH + 10;
    });

    doc.save(`RAPPORT_AUDIT_V3_${selectedOrder.id}.pdf`);
  };

  const generateProductionReport = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const timeline = selectedOrder.unitTimeline || {};

    const client = (data.clients || []).find(c => c.id === selectedOrder.clientId) || { nom: selectedOrder.clientName };
    let y = drawDocumentHeader(doc, quoteSettings, client, {
      title: "RAPPORT DE PRODUCTION & DÉLAIS",
      docLabel: 'Commande N°',
      docValue: selectedOrder.id,
      docDate: new Date().toLocaleDateString('fr-FR'),
      showClientBox: true
    });

    const formatDuration = (ms) => {
      if (!ms || ms <= 0) return '—';
      const totalMinutes = Math.floor(ms / (1000 * 60));
      const days = Math.floor(totalMinutes / (24 * 60));
      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
      const minutes = totalMinutes % 60;
      
      const parts = [];
      if (days > 0) parts.push(`${days}j`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
      return parts.join(' ');
    };

    // Calculate production metrics for units
    let totalUnits = allUnits.length;
    let unitsInProduction = 0;
    let unitsProduced = 0;
    let totalProdDurationMs = 0;
    let producedCountForAverage = 0;

    const unitProdDetails = allUnits.map(unit => {
      const events = timeline[unit.id] || [];
      const orderCreatedDate = selectedOrder.createdAt ? new Date(selectedOrder.createdAt) : null;
      
      // Find start event (En production or earliest event)
      let startEvent = events.find(e => e.status === 'En production' || e.action === 'start_production');
      let startDate = startEvent ? new Date(startEvent.date) : (events[0] ? new Date(events[0].date) : orderCreatedDate);

      // Find finish production event (status === 'Produit' or 'finish_production' or 'Chargé'/'Livré'/'Posé'/'Fini')
      let finishEvent = events.find(e => e.status === 'Produit' || e.action === 'finish_production' || e.status === 'Chargé' || e.status === 'Livré' || e.status === 'Posé' || e.status === 'Fini');
      let finishDate = finishEvent ? new Date(finishEvent.date) : null;

      const isProduced = unit.statusAlu !== 'En production' || finishDate !== null;
      if (isProduced) {
        unitsProduced++;
      } else {
        unitsInProduction++;
      }

      let durationMs = 0;
      if (startDate) {
        const endDate = finishDate || new Date();
        durationMs = Math.max(0, endDate - startDate);
      }

      if (isProduced && durationMs > 0) {
        totalProdDurationMs += durationMs;
        producedCountForAverage++;
      }

      return {
        ...unit,
        startDate: startDate ? startDate.toLocaleDateString('fr-FR') + ' ' + startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
        finishDate: finishDate ? finishDate.toLocaleDateString('fr-FR') + ' ' + finishDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : (isProduced ? 'Produit' : 'En cours'),
        durationMs: durationMs,
        durationStr: formatDuration(durationMs),
        isProduced: isProduced
      };
    });

    const avgProdDurationMs = producedCountForAverage > 0 ? (totalProdDurationMs / producedCountForAverage) : 0;

    // --- KPI BOXES ---
    const drawBox = (x, y, w, h, label, value, color) => {
      doc.setFillColor(248, 250, 252); doc.roundedRect(x, y, w, h, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240); doc.rect(x, y, w, h, 'S');
      doc.setTextColor(100, 116, 139); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text(label.toUpperCase(), x + 4, y + 7);
      doc.setTextColor(color[0], color[1], color[2]); doc.setFontSize(14); doc.text(value, x + 4, y + 19);
    };

    let bx = 15;
    const bw = (pw - 30 - 9) / 4;
    const boxY = y + 4;
    drawBox(bx, boxY, bw, 24, 'Total Châssis', `${totalUnits}`, [30, 41, 59]);
    drawBox(bx + bw + 3, boxY, bw, 24, 'En Production', `${unitsInProduction}`, [217, 119, 6]);
    drawBox(bx + (bw + 3)*2, boxY, bw, 24, 'Fabriqués', `${unitsProduced}`, [16, 185, 129]);
    drawBox(bx + (bw + 3)*3, boxY, bw, 24, 'Durée Moyenne', `${formatDuration(avgProdDurationMs)}`, [99, 102, 241]);

    y = boxY + 32;

    // --- TABLE OF UNITS PRODUCTION DETAILS ---
    doc.setTextColor(30, 41, 59); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('DÉTAILS DES DURÉES DE PRODUCTION PAR UNITÉ', 15, y);
    doc.setDrawColor(99, 102, 241); doc.setLineWidth(0.8); doc.line(15, y + 2, 45, y + 2);
    y += 8;

    const checkPageOverflow = (neededSpace) => {
      if (y + neededSpace > ph - 20) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // Table Headers
    const colW = [25, 45, 25, 25, 30, 30]; // total 180mm
    const tableX = 15;
    
    const drawTableHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.rect(tableX, y, pw - 30, 8, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 65, 85);
      
      let cx = tableX + 3;
      doc.text('REPÈRE', cx, y + 5.5); cx += colW[0];
      doc.text('PRODUIT / DÉSIGNATION', cx, y + 5.5); cx += colW[1];
      doc.text('DIMENSIONS', cx, y + 5.5); cx += colW[2];
      doc.text('STATUT', cx, y + 5.5); cx += colW[3];
      doc.text('DÉBUT PROD.', cx, y + 5.5); cx += colW[4];
      doc.text('DURÉE PROD.', cx, y + 5.5);
      y += 8;
    };

    drawTableHeader();

    unitProdDetails.forEach((unit, idx) => {
      checkPageOverflow(10);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(tableX, y, pw - 30, 7, 'F');
      }
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);

      let cx = tableX + 3;
      doc.setFont('helvetica', 'bold');
      doc.text(unit.name.substring(0, 14), cx, y + 4.5); cx += colW[0];
      doc.setFont('helvetica', 'normal');
      doc.text(unit.label.substring(0, 26), cx, y + 4.5); cx += colW[1];
      doc.text(`${unit.dimensions} mm`, cx, y + 4.5); cx += colW[2];

      const statusStr = unit.statusAlu === 'En production' ? 'En Production' : (unit.statusAlu === 'Produit' ? 'Produit' : unit.statusAlu);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(unit.statusAlu === 'En production' ? 217 : 16, unit.statusAlu === 'En production' ? 119 : 185, unit.statusAlu === 'En production' ? 6 : 129);
      doc.text(statusStr.substring(0, 14), cx, y + 4.5); cx += colW[3];

      doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
      doc.text(unit.startDate, cx, y + 4.5); cx += colW[4];
      doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
      doc.text(unit.durationStr, cx, y + 4.5);

      y += 7;
      doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.1);
      doc.line(tableX, y, pw - 15, y);
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} / ${pageCount}`, pw - 15, ph - 10, { align: 'right' });
    }

    doc.save(`Rapport_Production_${selectedOrder.id}.pdf`);
  };

  const generatePVReception = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    const unitPVs = selectedOrder.unitPVs || {};

    // Filter units: Selected Floors AND (Alu Fini + Vitrage Fini)
    const filteredUnits = allUnits.filter(u => {
      const floorMatch = isFinalPV ? true : pvSelectedFloors.has(u.floor || 'N/A');
      const isFini = (u.statusAlu === 'Posé' || u.statusAlu === 'Fini') && u.statusVitrage === 'Fini';
      const notAlreadyInPV = isFinalPV ? true : !unitPVs[u.id];
      return floorMatch && isFini && notAlreadyInPV;
    });

    if (filteredUnits.length === 0) {
      alert(isFinalPV 
        ? "Aucune unité terminée n'a été trouvée pour le PV final." 
        : "Aucune NOUVELLE unité terminée (non incluse dans un PV précédent) n'a été trouvée pour les étages sélectionnés.");
      return;
    }

    // ─── NOUVEAU FORMAT DU PV DE RÉCEPTION ──────────────────────────────────────────
    const client = (data.clients || []).find(c => c.id === selectedOrder.clientId) || { nom: selectedOrder.clientName };
    const title = isFinalPV ? 'PV DE RECEPTION FINAL' : 'PV DE RECEPTION PROVISOIRE';
    const projName = selectedOrder.clientName || selectedOrder.id;
    
    let isFirstPage = true;
    let y = 15;

    // Grouping by Apartment from plan chantier names
    // Plan chantier names follow the pattern: [floor][apt][voidIndex], e.g. "1A1", "1A2", "2B3"
    // We extract the apartment part (e.g. "A" or "B") to group units together
    const zonesMap = {};
    filteredUnits.forEach(u => {
      const aptKey = u.aptName || u.storageZone || (u.floor ? `Etage ${u.floor}` : 'Général');
      if (!zonesMap[aptKey]) zonesMap[aptKey] = [];
      zonesMap[aptKey].push(u);
    });
    const groupedZones = Object.keys(zonesMap).map(z => ({
      zoneName: z,
      units: zonesMap[z]
    }));

    const col1W = (pw-30)*0.45;
    const col2W = (pw-30)*0.275;
    const col3W = (pw-30)*0.275;

    const drawPageHeader = () => {
        if (isFirstPage) {
          y = drawDocumentHeader(doc, quoteSettings, client, {
            title: title,
            docLabel: 'Projet',
            docValue: projName,
            docDate: new Date().toLocaleDateString('fr-FR'),
            showClientBox: true
          });
          doc.setFontSize(10); doc.setFont('helvetica', 'bold');
          const floorsStr = isFinalPV ? 'Tous' : Array.from(pvSelectedFloors).join(', ');
          doc.text(`Projet : ${projName} ;`, 15, y);
          doc.text(`Etage : ${floorsStr} ;`, 15 + (pw-30)*0.6, y);

          y += 4;
          doc.rect(15, y, pw - 30, 8); 
          doc.text('RECEPTION DES TRAVAUX', pw / 2, y + 5.5, { align: 'center' });
          y += 8;
        } else {
          y = 15;
        }

        doc.rect(15, y, col1W, 8);
        doc.rect(15 + col1W, y, col2W, 16); 
        doc.rect(15 + col1W + col2W, y, col3W, 16);

        doc.rect(18, y + 2, 4, 4);

        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('Conforme', 25, y + 5.5);
        doc.text('Représentant', 15 + col1W + col2W/2, y + 6.5, { align: 'center' });
        doc.text(companyName || 'Fournisseur', 15 + col1W + col2W/2, y + 11.5, { align: 'center' });
        doc.text('Client', 15 + col1W + col2W + col3W/2, y + 9, { align: 'center' });

        doc.rect(15, y + 8, col1W, 8);
        doc.rect(18, y + 10, 4, 4); 
        doc.text('Avec Réserves (*)', 25, y + 13.5);
        
        return y + 16;
    };

    let tableStartY = drawPageHeader();
    let currentY = tableStartY;

    const drawPageFooter = () => {
        const minHeight = 110;
        if (currentY - tableStartY < minHeight) {
            currentY = tableStartY + minHeight;
        }

        doc.rect(15, tableStartY, col1W, currentY - tableStartY);
        doc.rect(15 + col1W, tableStartY, col2W, currentY - tableStartY);
        doc.rect(15 + col1W + col2W, tableStartY, col3W, currentY - tableStartY);

        const repName = pvTeamMember === 'Autre' ? pvCustomName : pvTeamMember;
        const repRole = pvTeamMember === 'Autre' ? pvCustomRole : (pvTeamMember ? 'Technicien de pose' : '');

        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text('Nom et prénom :', 15 + col1W + 5, tableStartY + 8);
        if (repName) {
           doc.setFont('helvetica', 'normal');
           doc.text(repName, 15 + col1W + 25, tableStartY + 13);
        }
        doc.setFont('helvetica', 'bold');
        doc.text('Nom et prénom :', 15 + col1W + col2W + 5, tableStartY + 8);
        
        doc.line(15 + col1W, tableStartY + 18, 15 + col1W + col2W + col3W, tableStartY + 18);
        
        doc.text('Fonction :', 15 + col1W + 5, tableStartY + 24);
        if (repRole) {
           doc.setFont('helvetica', 'normal');
           doc.text(repRole, 15 + col1W + 25, tableStartY + 29);
        }
        doc.setFont('helvetica', 'bold');
        doc.text('Fonction :', 15 + col1W + col2W + 5, tableStartY + 24);
        
        doc.line(15 + col1W, tableStartY + 34, 15 + col1W + col2W + col3W, tableStartY + 34);
        
        doc.text('Date et Visas', 15 + col1W + 5, tableStartY + 50);
        doc.text('Date et Visas', 15 + col1W + col2W + 5, tableStartY + 50);

        doc.setFont('helvetica', 'normal');
        doc.text('....... / ....... / .......', 15 + col1W + 15, tableStartY + 100);
        doc.text('....... / ....... / .......', 15 + col1W + col2W + 15, tableStartY + 100);
    };

    groupedZones.forEach(group => {
        // Build positions list line-by-line: "1A1 : H36 2OV"
        const positionLines = group.units.map(u => `${u.name} : ${u.gammeName || u.label}`);
        const positionsText = positionLines.join('\n');
        const splitPos = doc.splitTextToSize(positionsText, col1W - 10);
        let linesHeight = splitPos.length * 3.5;
        const requiredSpace = 20 + linesHeight;

        if (currentY + requiredSpace > ph - 20) {
            drawPageFooter();
            doc.addPage();
            isFirstPage = false;
            y = 15;
            tableStartY = drawPageHeader();
            currentY = tableStartY;
        }

        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(`(*) Détail réserves Appartement ${group.zoneName}`, 18, currentY + 5);
        
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
        doc.text(splitPos, 20, currentY + 10);

        const contentBottom = currentY + 12 + linesHeight;

        doc.setDrawColor(150, 150, 150); doc.setLineDash([1, 1], 0); doc.setLineWidth(0.2);
        doc.line(20, contentBottom + 2, 15 + col1W - 5, contentBottom + 2);
        doc.line(20, contentBottom + 8, 15 + col1W - 5, contentBottom + 8);
        doc.line(20, contentBottom + 14, 15 + col1W - 5, contentBottom + 14);
        
        doc.setDrawColor(0, 0, 0); doc.setLineDash([], 0); doc.setLineWidth(0.3);
        doc.setTextColor(0, 0, 0);
        
        currentY = contentBottom + 18;
        doc.line(15, currentY, 15 + col1W, currentY);
    });

    drawPageFooter();

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${pageCount}`, pw - 20, ph - 10, { align: 'right' });
    }

    doc.save(`PV_RECEPTION_${selectedOrder.id}_${new Date().getTime()}.pdf`);

    // ─── Stocker le PV sur la commande + créer versement bloqué ──────────────
    const pvId = isFinalPV ? `PVF-${Date.now().toString().slice(-6)}` : `PV-${Date.now().toString().slice(-6)}`;
    const pvFloors = isFinalPV ? uniqueFloors : Array.from(pvSelectedFloors);

    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrder.id);
      
      let montantVersement = 0;
      if (oIdx !== -1) {
        const order = { ...orders[oIdx] };
        const updatedUnitPVs = { ...(order.unitPVs || {}) };

        if (!isFinalPV) {
          (order.batches || []).forEach(batch => {
            (batch.items || []).forEach(item => {
              const originalItem = order.items?.find(i => i.id === item.id) || {};
              const itemPriceHT = originalItem.unitPriceHT || originalItem.priceData?.priceHT || 0;
              (item.measurements || []).forEach(m => {
                for (let i = 0; i < (m.qty || 1); i++) {
                  const floor = m.instanceFloors?.[i] || 'N/A';
                  if (!pvFloors.includes(floor)) continue;
                  const unitId = `${order.id}-${batch.id}-${item.id}-${m.id}-${i}`;
                  const ds = order.unitStatusesDual?.[unitId] || {};
                  const isFini = (ds.alu === 'Fini' || ds.alu === 'Pos\u00e9') && ds.vitrage === 'Fini';
                  if (isFini && !updatedUnitPVs[unitId]) {
                    montantVersement += itemPriceHT;
                    updatedUnitPVs[unitId] = pvId;
                  }
                }
              });
            });
          });
          order.unitPVs = updatedUnitPVs;
        }

        order.pvList = [...(order.pvList || []), {
          id: pvId,
          pvStatus: 'En attente',
          etages: pvFloors,
          montant: montantVersement,
          isFinal: isFinalPV,
          createdAt: new Date().toISOString(),
          validatedAt: null,
          attachment: null,
        }];
        orders[oIdx] = order;
      }

      const trackers = [...(prev.financialTrackers || [])];
      if (!isFinalPV && montantVersement > 0) {
        const tIdx = trackers.findIndex(t => t.orderId === selectedOrder.id);
        if (tIdx !== -1) {
          const tracker = { ...trackers[tIdx] };
          const contract = (prev.contracts || []).find(c => c.id === tracker.contractId);
          const delaiJours = contract?.delaiPaiementJours || 30;
          const dateEcheance = new Date();
          dateEcheance.setDate(dateEcheance.getDate() + delaiJours);
          tracker.versements = [...(tracker.versements || []), {
            id: `VRS-${Date.now().toString().slice(-5)}`,
            pvId,
            pvStatus: 'En attente',   // 'En attente' | 'Validé'
            montant: montantVersement,
            statut: 'En attente',     // statut paiement, débloqué après validation PV
            dateEcheance: dateEcheance.toISOString(),
            datePaiement: null,
            attachment: null,
            etages: pvFloors,
            createdAt: new Date().toISOString(),
          }];
          trackers[tIdx] = tracker;
        }
      }

      return { ...prev, orders, financialTrackers: trackers };
    });

    // Automatic Email Sending (API Call to Supabase Function)
    if (sendByEmail) {
      if (!recipientEmail || !recipientEmail.includes('@')) {
        alert('Veuillez entrer une adresse email client valide.');
        return;
      }
      const sendEmail = async () => {
        try {
          console.log(`[Email Service] Envoi du PV \u00e0 ${recipientEmail}...`);
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          const floorsStr = Array.from(pvSelectedFloors).join(', ');
          await invokeFunction('send-pv-email', {
            sender: senderEmail,
            recipient: recipientEmail,
            companyName: companyName,
            clientName: selectedOrder.clientName,
            floors: floorsStr,
            orderId: selectedOrder.id,
            pdfBase64: pdfBase64
          });
          alert(`\ud83d\udce7 PV de R\u00e9ception envoy\u00e9 avec succ\u00e8s \u00e0 ${recipientEmail}`);
        } catch (error) {
          console.error('Erreur envoi email:', error);
          alert("Erreur lors de l'envoi de l'email. V\u00e9rifiez la configuration de la fonction Supabase.");
        }
      };
      sendEmail();
    }

    setShowPVModal(false);
  };

  const handleDownloadOldPV = (pv) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    const filteredUnits = allUnits.filter(u => {
      if (pv.isFinal) {
        return (u.statusAlu === 'Posé' || u.statusAlu === 'Fini') && u.statusVitrage === 'Fini';
      } else {
        return selectedOrder.unitPVs && selectedOrder.unitPVs[u.id] === pv.id;
      }
    });

    if (filteredUnits.length === 0) {
      alert("Impossible de retrouver les unités de ce PV.");
      return;
    }

    const client = (data.clients || []).find(c => c.id === selectedOrder.clientId) || { nom: selectedOrder.clientName };
    const title = pv.isFinal ? 'PV DE RECEPTION FINAL' : 'PV DE RECEPTION PROVISOIRE';
    const projName = selectedOrder.clientName || selectedOrder.id;
    
    let isFirstPage = true;
    let y = 15;

    const zonesMap = {};
    filteredUnits.forEach(u => {
      const aptKey = u.aptName || u.storageZone || (u.floor ? `Etage ${u.floor}` : 'Général');
      if (!zonesMap[aptKey]) zonesMap[aptKey] = [];
      zonesMap[aptKey].push(u);
    });
    const groupedZones = Object.keys(zonesMap).map(z => ({ zoneName: z, units: zonesMap[z] }));

    const col1W = (pw-30)*0.45;
    const col2W = (pw-30)*0.275;
    const col3W = (pw-30)*0.275;

    const drawPageHeader = () => {
        if (isFirstPage) {
          y = drawDocumentHeader(doc, quoteSettings, client, {
            title: title,
            docLabel: 'Projet',
            docValue: projName,
            docDate: new Date(pv.createdAt).toLocaleDateString('fr-FR'),
            showClientBox: true
          });
          doc.setFontSize(10); doc.setFont('helvetica', 'bold');
          const floorsStr = pv.isFinal ? 'Tous' : (pv.etages || []).join(', ');
          doc.text(`Projet : ${projName} ;`, 15, y);
          doc.text(`Etage : ${floorsStr} ;`, 15 + (pw-30)*0.6, y);

          y += 4;
          doc.rect(15, y, pw - 30, 8); 
          doc.text('RECEPTION DES TRAVAUX', pw / 2, y + 5.5, { align: 'center' });
          y += 8;
        } else {
          y = 15;
        }

        doc.rect(15, y, col1W, 8);
        doc.rect(15 + col1W, y, col2W, 16); 
        doc.rect(15 + col1W + col2W, y, col3W, 16);
        doc.rect(18, y + 2, 4, 4);

        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('Conforme', 25, y + 5.5);
        doc.text('Représentant', 15 + col1W + col2W/2, y + 6.5, { align: 'center' });
        doc.text(companyName || 'Fournisseur', 15 + col1W + col2W/2, y + 11.5, { align: 'center' });
        doc.text('Client', 15 + col1W + col2W + col3W/2, y + 9, { align: 'center' });

        doc.rect(15, y + 8, col1W, 8);
        doc.rect(18, y + 10, 4, 4); 
        doc.text('Avec Réserves (*)', 25, y + 13.5);
        
        return y + 16;
    };

    let tableStartY = drawPageHeader();
    let currentY = tableStartY;

    const drawPageFooter = () => {
        const minHeight = 110;
        if (currentY - tableStartY < minHeight) {
            currentY = tableStartY + minHeight;
        }

        doc.rect(15, tableStartY, col1W, currentY - tableStartY);
        doc.rect(15 + col1W, tableStartY, col2W, currentY - tableStartY);
        doc.rect(15 + col1W + col2W, tableStartY, col3W, currentY - tableStartY);

        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text('Nom et prénom :', 15 + col1W + 5, tableStartY + 8);
        doc.text('Nom et prénom :', 15 + col1W + col2W + 5, tableStartY + 8);
        
        doc.line(15 + col1W, tableStartY + 18, 15 + col1W + col2W + col3W, tableStartY + 18);
        
        doc.text('Fonction :', 15 + col1W + 5, tableStartY + 24);
        doc.text('Fonction :', 15 + col1W + col2W + 5, tableStartY + 24);
        
        doc.line(15 + col1W, tableStartY + 34, 15 + col1W + col2W + col3W, tableStartY + 34);
        
        doc.text('Date et Visas', 15 + col1W + 5, tableStartY + 50);
        doc.text('Date et Visas', 15 + col1W + col2W + 5, tableStartY + 50);

        doc.setFont('helvetica', 'normal');
        doc.text('....... / ....... / .......', 15 + col1W + 15, tableStartY + 100);
        doc.text('....... / ....... / .......', 15 + col1W + col2W + 15, tableStartY + 100);
    };

    groupedZones.forEach(group => {
        const positionLines = group.units.map(u => `${u.name} : ${u.gammeName || u.label}`);
        const positionsText = positionLines.join('\n');
        const splitPos = doc.splitTextToSize(positionsText, col1W - 10);
        let linesHeight = splitPos.length * 3.5;
        const requiredSpace = 20 + linesHeight;

        if (currentY + requiredSpace > ph - 20) {
            drawPageFooter();
            doc.addPage();
            isFirstPage = false;
            y = 15;
            tableStartY = drawPageHeader();
            currentY = tableStartY;
        }

        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(`(*) Détail réserves Appartement ${group.zoneName}`, 18, currentY + 5);
        
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
        doc.text(splitPos, 20, currentY + 10);

        const contentBottom = currentY + 12 + linesHeight;

        doc.setDrawColor(150, 150, 150); doc.setLineDash([1, 1], 0); doc.setLineWidth(0.2);
        doc.line(20, contentBottom + 2, 15 + col1W - 5, contentBottom + 2);
        doc.line(20, contentBottom + 8, 15 + col1W - 5, contentBottom + 8);
        doc.line(20, contentBottom + 14, 15 + col1W - 5, contentBottom + 14);
        
        doc.setDrawColor(0, 0, 0); doc.setLineDash([], 0); doc.setLineWidth(0.3);
        doc.setTextColor(0, 0, 0);
        
        currentY = contentBottom + 18;
        doc.line(15, currentY, 15 + col1W, currentY);
    });

    drawPageFooter();

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${pageCount}`, pw - 20, ph - 10, { align: 'right' });
    }

    doc.save(`${pv.id}_${selectedOrder.id}.pdf`);
  };

  const generateDeliveryNote = (type = 'ALU', unitsToDeliver = [], isRedownload = false) => {
    if (unitsToDeliver.length === 0) {
      alert("Aucun produit sélectionné pour la livraison !");
      return;
    }

    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const client = (data.clients || []).find(c => c.id === selectedOrder.clientId) || { nom: selectedOrder.clientName };
    
    const firstDateStr = selectedOrder.blDates?.[type];
    const displayDate = (isRedownload && firstDateStr) ? new Date(firstDateStr).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');

    let titleText = `BON DE LIVRAISON : ${type === 'CAISSON_TUNNEL' ? 'CAISSON TUNNEL' : type}`;
    if (type === 'VITRAGE_OUVRANT_FIX') {
      titleText = 'BON DE LIVRAISON : VITRAGE OUVRANT & FIXE';
    } else if (type === 'VITRAGE_COULISSANT') {
      titleText = 'BON DE LIVRAISON : VITRAGE COULISSANT';
    }

    let y = drawDocumentHeader(doc, quoteSettings, client, {
      title: titleText,
      docLabel: 'Commande N°',
      docValue: selectedOrder.id,
      docDate: displayDate,
      showClientBox: true
    });
    
    y += 10;

    // Helper to check page overflow and add a page
    const checkPageOverflow = (neededSpace) => {
      if (y + neededSpace > 275) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // Group units by floor
    const unitsByFloor = {};
    unitsToDeliver.forEach(u => {
      const fl = u.floor || 'Sans étage';
      if (!unitsByFloor[fl]) unitsByFloor[fl] = [];
      unitsByFloor[fl].push(u);
    });

    const sortedFloors = Object.keys(unitsByFloor).sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, ''), 10);
      const bNum = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });

    // Write the list of units grouped by floor
    sortedFloors.forEach(floor => {
      checkPageOverflow(25);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Étage : ${floor}`, 15, y);
      y += 5;
      doc.line(15, y, pw - 15, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      if (type === 'ALU' || type === 'VOLET' || type === 'CAISSON_TUNNEL') {
        doc.text('Qté', 15, y); doc.text('Produit', 30, y); doc.text('Dim. Réelle', 95, y); doc.text('Repère', 135, y); doc.text('Statut', 180, y);
      } else {
        doc.text('Qté', 15, y); doc.text('Produit', 30, y); doc.text('Repère', 120, y); doc.text('Statut', 180, y);
      }
      y += 4; 
      doc.setDrawColor(200, 200, 200);
      doc.line(15, y, pw - 15, y); 
      y += 6;
      doc.setDrawColor(0, 0, 0);

      doc.setFont('helvetica', 'normal');
      const floorUnits = unitsByFloor[floor];
      floorUnits.forEach(u => {
        const status = 'LIVRÉ';
        
        if (type.startsWith('VITRAGE')) {
          const panes = u.glassPanes && u.glassPanes.length > 0 ? u.glassPanes : [{ name: 'Vitrage Standard', width: '—', height: '—', qty: 1 }];
          panes.forEach(g => {
            const paneKey = `${g.id || g.name}_${g.width}_${g.height}`;
            const isPaneChecked = isRedownload || blSelectedGlassPanes[u.id]?.[paneKey] !== false;
            
            const deliveredQty = selectedOrder.deliveredGlassPanes?.[u.id]?.[paneKey] || 0;
            const remainingQty = g.qty - deliveredQty;
            const printQty = isRedownload ? (deliveredQty > 0 ? deliveredQty : g.qty) : remainingQty;
            
            if (printQty <= 0 || (!isRedownload && !isPaneChecked)) {
              return; // skip this pane if not checked or already delivered
            }

            checkPageOverflow(10);
            
            // Show glazing composition and dimensions
            const glassText = `${g.name} (${g.width} x ${g.height} mm)`;
            
            doc.text(String(printQty), 15, y); 
            doc.text(glassText.substring(0, 42), 30, y); 
            doc.text(u.name, 120, y);
            doc.text(status, 180, y);
            y += 8;
          });
        } else if (type === 'CAISSON_TUNNEL') {
          checkPageOverflow(10);
          const delivered = selectedOrder.deliveredCaissonTunnel?.[u.id] || { axe: false, moteur: false, kit: false };
          const detailsParts = [];
          if (isRedownload) {
            if (u.shutterAxe && delivered.axe) detailsParts.push(`Axe: ${u.shutterAxe}`);
            if (u.shutterMoteur && delivered.moteur) detailsParts.push(`Moteur: ${u.shutterMoteur}`);
            if (u.shutterKit && delivered.kit) detailsParts.push(`Kit: ${u.shutterKit}`);
            if (detailsParts.length === 0) {
              if (u.shutterAxe) detailsParts.push(`Axe: ${u.shutterAxe}`);
              if (u.shutterMoteur) detailsParts.push(`Moteur: ${u.shutterMoteur}`);
              if (u.shutterKit) detailsParts.push(`Kit: ${u.shutterKit}`);
            }
          } else {
            if (caissonTunnelComponents.axe && u.shutterAxe && !delivered.axe) detailsParts.push(`Axe: ${u.shutterAxe}`);
            if (caissonTunnelComponents.moteur && u.shutterMoteur && !delivered.moteur) detailsParts.push(`Moteur: ${u.shutterMoteur}`);
            if (caissonTunnelComponents.kit && u.shutterKit && !delivered.kit) detailsParts.push(`Kit: ${u.shutterKit}`);
          }
          const detailsText = detailsParts.length > 0 ? ` (${detailsParts.join(', ')})` : '';
          const labelText = `${u.label}${detailsText}`;
          const splitLabel = doc.splitTextToSize(labelText, 60);
          const repereText = u.name;
          const splitRepere = doc.splitTextToSize(repereText, 40);
          
          doc.text('1', 15, y); 
          doc.text(splitLabel, 30, y); 
          doc.text(u.dimensions ? `${u.dimensions} mm` : '—', 95, y);
          doc.text(splitRepere, 135, y);
          doc.text(status, 180, y);
          y += (Math.max(splitLabel.length, splitRepere.length) * 4) + 4;
        } else {
          checkPageOverflow(10);
          let labelText = u.hasShutter ? `${u.label} (${u.shutterInfo})` : u.label;
          if (type === 'GLISSIERE') {
            labelText = u.hasShutter ? `${u.label} (Glissière: ${u.glissiereName || '—'})` : u.label;
          }
          const splitLabel = doc.splitTextToSize(labelText, 60);
          
          doc.text('1', 15, y); 
          doc.text(splitLabel, 30, y); 
          doc.text(u.dimensions ? `${u.dimensions} mm` : '—', 95, y);
          doc.text(u.name, 135, y);
          doc.text(status, 180, y);
          y += (splitLabel.length * 4) + 4;
        }
      });

      // Total count per floor
      checkPageOverflow(15);
      y += 2;
      doc.setFont('helvetica', 'bold');
      if (type.startsWith('VITRAGE')) {
        let totalGlassQty = 0;
        floorUnits.forEach(u => {
          const panes = u.glassPanes && u.glassPanes.length > 0 ? u.glassPanes : [{ name: 'Vitrage Standard', width: '—', height: '—', qty: 1 }];
          panes.forEach(g => {
            const paneKey = `${g.id || g.name}_${g.width}_${g.height}`;
            const isPaneChecked = isRedownload || blSelectedGlassPanes[u.id]?.[paneKey] !== false;
            const deliveredQty = selectedOrder.deliveredGlassPanes?.[u.id]?.[paneKey] || 0;
            const remainingQty = g.qty - deliveredQty;
            const printQty = isRedownload ? (deliveredQty > 0 ? deliveredQty : g.qty) : remainingQty;
            
            if (printQty > 0 && (isRedownload || isPaneChecked)) {
              totalGlassQty += printQty;
            }
          });
        });
        doc.text(`Nombre total de châssis : ${floorUnits.length} ; Total vitrages : ${totalGlassQty}`, 15, y);
      } else {
        doc.text(`Nombre total pour l'étage ${floor} : ${floorUnits.length}`, 15, y);
      }
      y += 12;
      doc.setFont('helvetica', 'normal');
    });

    // At the end, a table containing the total quantity by Designation (according to the estimate/devis)
    checkPageOverflow(40);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Récapitulatif des Quantités Totales par Désignation (Devis)', 15, y);
    y += 6;
    doc.line(15, y, pw - 15, y);
    y += 6;

    // Build map of quantity by designation
    const qtyByDesign = {};
    unitsToDeliver.forEach(u => {
      const origItem = selectedOrder.items?.find(item => item.id === u.itemId);
      const design = origItem?.label || u.label || 'Produit';
      const gamme = u.gammeName || '—';
      const key = `${design} (${gamme})`;
      if (!qtyByDesign[key]) {
        qtyByDesign[key] = { qty: 0, design: design, gamme: gamme };
      }
      qtyByDesign[key].qty += 1;
    });

    // Calculate total glazing gasket if type starts with VITRAGE
    let totalGasketQty = 0;
    if (type.startsWith('VITRAGE')) {
      const engine = new FormulaEngine(data || {});
      unitsToDeliver.forEach(u => {
        const batch = selectedOrder.batches?.find(b => b.id === u.batchId);
        let origItem = batch?.items?.find(item => item.id === u.itemId);
        if (!origItem) {
          origItem = selectedOrder.items?.find(item => item.id === u.itemId);
        }
        if (origItem) {
          const m = origItem.measurements?.find(meas => meas.id === u.mId);
          if (m) {
            const instanceConfig = {
              ...origItem.config,
              L: m.L,
              H: m.H,
              wallDepth: m.wallDepth,
              handleHeight: m.handleHeight,
              partOverrides: m.partOverrides
            };
            const shutterOverridden = (m.shutterList || []).length > 0;
            if (shutterOverridden) {
              let offset = 0;
              (m.shutterList || []).forEach(sh => {
                const sQty = Number(sh.qty) || 0;
                if (u.index >= offset && u.index < offset + sQty) {
                  instanceConfig.hasShutter = true;
                  instanceConfig.shutterConfig = {
                    ...(origItem.config?.shutterConfig || {}),
                    ...(sh.overrides || {})
                  };
                  instanceConfig.shutterOverrides = { ...(sh.overrides || {}), customLV: sh.customLV };
                }
                offset += sQty;
              });
            } else if (origItem.config?.hasShutter) {
              instanceConfig.hasShutter = true;
            }
            try {
              const bomResult = engine.calculateBOM(instanceConfig);
              if (bomResult && bomResult.accessories) {
                bomResult.accessories.forEach(acc => {
                  if (acc.isGlassGasket || (acc.label && acc.label.toLowerCase().includes('joint de vitrage'))) {
                    totalGasketQty += acc.qty || 0;
                  }
                });
              }
            } catch (e) {
              console.warn("Gasket calculation failed for unit in recap", e);
            }
          }
        }
      });
    }

    // Table Header
    doc.setFontSize(10);
    doc.text('Désignation', 15, y);
    doc.text('Gamme', 120, y);
    doc.text('Quantité Totale', 165, y);
    y += 4;
    doc.line(15, y, pw - 15, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    Object.values(qtyByDesign).forEach(info => {
      checkPageOverflow(10);
      doc.text(info.design.substring(0, 50), 15, y);
      doc.text(info.gamme, 120, y);
      doc.text(String(info.qty), 165, y);
      y += 8;
    });

    if (type.startsWith('VITRAGE') && totalGasketQty > 0) {
      checkPageOverflow(10);
      doc.text('Joint de Vitrage', 15, y);
      doc.text('—', 120, y);
      doc.text(`${totalGasketQty.toFixed(2)} ml`, 165, y);
      y += 8;
    }

    if (!isRedownload) {
      setData(prev => {
        const orders = [...(prev.orders || [])];
        const oIdx = orders.findIndex(o => o.id === selectedOrderId);
        if (oIdx === -1) return prev;
        const order = { ...orders[oIdx] };
        
        const blDates = { ...(order.blDates || {}) };
        if (!blDates[type]) {
          blDates[type] = new Date().toISOString();
        }
        order.blDates = blDates;

        const dualStatuses = { ...(order.unitStatusesDual || {}) };
        const timeline = { ...(order.unitTimeline || {}) };
        const deliveredGlass = { ...(order.deliveredGlassPanes || {}) };
        const component = type.startsWith('VITRAGE') ? 'vitrage' : (type === 'ALU' ? 'alu' : (type === 'VOLET' ? 'volet' : (type === 'GLISSIERE' ? 'glissiere' : 'caisson_tunnel')));
        const userName = 'ADMIN';

        const deliveredCaisson = { ...(order.deliveredCaissonTunnel || {}) };

        unitsToDeliver.forEach(u => {
          const current = { ...(dualStatuses[u.id] || { alu: 'Produit', vitrage: 'Produit', volet: 'Produit', caisson_tunnel: 'Produit' }) };
          
          if (type.startsWith('VITRAGE')) {
            const uDelivered = { ...(deliveredGlass[u.id] || {}) };
            const panes = u.glassPanes || [];
            panes.forEach(g => {
              const paneKey = `${g.id || g.name}_${g.width}_${g.height}`;
              const isPaneChecked = blSelectedGlassPanes[u.id]?.[paneKey] !== false;
              if (isPaneChecked) {
                uDelivered[paneKey] = g.qty;
              }
            });
            deliveredGlass[u.id] = uDelivered;

            const allDelivered = panes.every(g => {
              const paneKey = `${g.id || g.name}_${g.width}_${g.height}`;
              return (uDelivered[paneKey] || 0) >= g.qty;
            });

            if (allDelivered) {
              current.vitrage = 'Livré';
            } else {
              current.vitrage = 'Produit';
            }
          } else if (type === 'CAISSON_TUNNEL') {
            const uDelivered = { ...(deliveredCaisson[u.id] || { axe: false, moteur: false, kit: false }) };
            if (caissonTunnelComponents.axe && u.shutterAxe) uDelivered.axe = true;
            if (caissonTunnelComponents.moteur && u.shutterMoteur) uDelivered.moteur = true;
            if (caissonTunnelComponents.kit && u.shutterKit) uDelivered.kit = true;
            deliveredCaisson[u.id] = uDelivered;

            const needsAxe = !!u.shutterAxe && !uDelivered.axe;
            const needsMoteur = !!u.shutterMoteur && !uDelivered.moteur;
            const needsKit = !!u.shutterKit && !uDelivered.kit;
            
            if (!needsAxe && !needsMoteur && !needsKit) {
              current.caisson_tunnel = 'Livré';
            } else {
              current.caisson_tunnel = 'Produit';
            }
          } else {
            current[component] = 'Livré';
          }
          dualStatuses[u.id] = current;

          const event = {
            date: new Date().toISOString(),
            user: userName,
            component: component,
            status: current[component] === 'Livré' ? 'Livré' : (type === 'CAISSON_TUNNEL' ? 'Livraison Partielle Caisson' : 'Livraison Partielle Vitrage'),
            action: 'finish',
            issue: null
          };
          if (!timeline[u.id]) timeline[u.id] = [];
          timeline[u.id] = [...timeline[u.id], event];
        });

        order.unitStatusesDual = dualStatuses;
        order.unitTimeline = timeline;
        order.deliveredGlassPanes = deliveredGlass;
        order.deliveredCaissonTunnel = deliveredCaisson;
        orders[oIdx] = order;
        return { ...prev, orders };
      });
    }

    doc.save(`BL_${type}_${selectedOrder.id}${isRedownload ? '_copie' : ''}.pdf`);
  };

  if (selectedOrderId && activeView !== 'list') {
     const stats = {
       total: allUnits.length,
       alu: {
         livré: allUnits.filter(u => u.statusAlu === 'Livré').length,
         posé: allUnits.filter(u => u.statusAlu === 'Posé').length,
         fini: allUnits.filter(u => u.statusAlu === 'Fini').length
       },
       vit: {
         livré: allUnits.filter(u => u.statusVitrage === 'Livré').length,
         fini: allUnits.filter(u => u.statusVitrage === 'Fini').length
       }
     };

    const toggleBatchSelection = (id) => {
      setSelectedBatchIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    const uniqueFloors = Array.from(new Set(allUnits.map(u => u.floor || 'N/A'))).sort();

    return (
      <div className="animate-fade-in">
        <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => { setSelectedOrderId(null); setSelectedBatchIds(new Set()); setActiveView('list'); }} className="btn" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Suivi Logistique : {selectedOrder.id}</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Chargement, Livraison et Pose</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowPVModal(true)}
                className="btn btn-secondary"
                style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}
              >
                <ClipboardCheck size={16} /> PV Réception
              </button>
              <button 
                onClick={handleRefresh} 
                className={`btn ${isSyncing ? 'animate-spin' : ''}`} 
                style={{ padding: '0.5rem', background: '#f8fafc', color: '#64748b' }}
                title="Actualiser les données du terrain"
              >
                <RefreshCw size={18} />
              </button>
              <button onClick={generatePackingLabels} className="btn btn-secondary" disabled={allUnits.length === 0}><QrCode size={16} /> Étiquettes</button>
              <label 
                className="btn btn-secondary" 
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#0f172a', borderColor: '#cbd5e1', background: quoteSettings?.bordereauLogoBase64 ? '#f0fdf4' : 'white' }}
                title="Téléverser le logo spécifique aux bordereaux d'expédition"
              >
                <Camera size={16} /> {quoteSettings?.bordereauLogoBase64 ? 'Logo Bordereau ✓' : 'Logo Bordereau'}
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          let w = img.width;
                          let h = img.height;
                          const max = 400;
                          if (w > max || h > max) {
                            if (w > h) { h = Math.round((h * max) / w); w = max; }
                            else { w = Math.round((w * max) / h); h = max; }
                          }
                          canvas.width = w;
                          canvas.height = h;
                          const ctx = canvas.getContext('2d');
                          ctx.drawImage(img, 0, 0, w, h);
                          const base64 = canvas.toDataURL('image/png');
                          if (setQuoteSettings) {
                            setQuoteSettings(prev => ({ ...prev, bordereauLogoBase64: base64 }));
                            alert('✅ Logo spécifique aux bordereaux enregistré !');
                          }
                        };
                        img.src = ev.target.result;
                      };
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
              </label>
              <button onClick={generateProductionReport} className="btn btn-secondary" style={{ color: '#d97706', borderColor: '#fde68a' }} disabled={allUnits.length === 0}><Clock size={16} /> Rapport Production</button>
              <button onClick={generateStatusReport} className="btn btn-secondary" style={{ color: '#10b981', borderColor: '#a7f3d0' }} disabled={allUnits.length === 0}><Camera size={16} /> Rapport d'État</button>
              <button onClick={generatePerformanceReport} className="btn btn-secondary" style={{ color: '#f59e0b', borderColor: '#fef3c7' }} disabled={allUnits.length === 0}><FileText size={16} /> Rapport Performance</button>
              <button onClick={() => {
                   const url = `${window.location.origin}${window.location.pathname}?mode=installer&orderId=${selectedOrder.id}`;
                   setShowInstallerQr(url);
                   navigator.clipboard.writeText(url);
                 }}
                 className="btn btn-secondary"
                 style={{ color: '#8b5cf6', borderColor: '#ddd6fe' }}
               >
                 <Share2 size={16} /> Lien Poseur
               </button>
               <button onClick={() => setShowTeamManager(true)} className="btn btn-secondary" style={{ color: '#0ea5e9', borderColor: '#bae6fd' }}><UserCheck size={16} /> Équipe</button>
               <div style={{ borderLeft: '1px solid #e2e8f0', marginLeft: '0.5rem', paddingLeft: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { setBlModalType('ALU'); setBlSelectedUnitIds(new Set()); }} className="btn btn-primary" style={{ background: '#1e293b' }} disabled={allUnits.length === 0}>BL Alu</button>
                  <button onClick={() => { setBlModalType('VITRAGE'); setBlSelectedUnitIds(new Set()); }} className="btn btn-primary" style={{ background: '#3b82f6' }} disabled={allUnits.length === 0}>BL Vitrage</button>
                  <button onClick={() => { setBlModalType('VOLET'); setBlSelectedUnitIds(new Set()); }} className="btn btn-primary" style={{ background: '#b45309' }} disabled={allUnits.length === 0}>BL Volet</button>
                  <button onClick={() => { setBlModalType('GLISSIERE'); setBlSelectedUnitIds(new Set()); }} className="btn btn-primary" style={{ background: '#7c2d12' }} disabled={allUnits.length === 0}>BL Glissière</button>
                  <button onClick={() => { setBlModalType('CAISSON_TUNNEL'); setBlSelectedUnitIds(new Set()); }} className="btn btn-primary" style={{ background: '#059669' }} disabled={allUnits.length === 0}>BL Caisson Tunnel</button>
                </div>
          </div>
        </header>

        {/* ── Panneau PV de Réception ─────────────────────────────────────────── */}
        {(selectedOrder.pvList || []).length > 0 && (
          <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <ClipboardCheck size={18} color="#d97706" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                PV de Réception — Suivi des validations
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>
                {(selectedOrder.pvList || []).length} PV généré(s)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(selectedOrder.pvList || []).map((pv, idx) => {
                const isValide = pv.pvStatus === 'Validé';
                return (
                  <div key={pv.id} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                    padding: '0.85rem 1rem',
                    borderRadius: '0.65rem',
                    background: isValide ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${isValide ? '#a7f3d0' : '#fde68a'}`,
                  }}>
                    {/* Statut badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px' }}>
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: isValide ? '#10b981' : '#f59e0b',
                        flexShrink: 0,
                        boxShadow: isValide ? '0 0 0 3px #d1fae5' : '0 0 0 3px #fef3c7',
                      }} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isValide ? '#065f46' : '#92400e' }}>
                        {isValide ? '✅ Validé' : '⏳ En attente de validation'}
                      </span>
                    </div>

                    {/* Infos PV */}
                    <div style={{ flex: 1, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                      <span><strong>{pv.id}</strong> {pv.isFinal && <span style={{ color: '#b45309', fontWeight: 'bold' }}>(FINAL)</span>}</span>
                      <span>Généré le : {new Date(pv.createdAt).toLocaleDateString('fr-FR')}</span>
                      {!pv.isFinal && <span>Étages : <strong>{(pv.etages || []).join(', ') || '—'}</strong></span>}
                      {pv.isFinal && <span><strong>TOUS LES ÉTAGES</strong></span>}
                      <span>Montant : <strong>{(pv.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</strong></span>
                      {isValide && pv.validatedAt && (
                        <span style={{ color: '#059669' }}>Validé le : {new Date(pv.validatedAt).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>

                    {/* Pièce jointe */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleDownloadOldPV(pv)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: '#0369a1', fontWeight: 600 }}
                      >
                        <Download size={13} /> PDF
                      </button>
                      {pv.attachment ? (
                        pv.attachment.type === 'drive' ? (
                          <a href={pv.attachment.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#1e88e5' }}>
                            <FileText size={13} /> Drive
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <FileText size={13} /> {pv.attachment.name}
                          </span>
                        )
                      ) : !isValide && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b' }}>
                            <FileText size={12} /> Fichier
                            <input type="file" style={{ display: 'none' }} onChange={e => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => {
                                setData(prev => {
                                  const orders = [...(prev.orders || [])];
                                  const oIdx = orders.findIndex(o => o.id === selectedOrder.id);
                                  if (oIdx === -1) return prev;
                                  const order = { ...orders[oIdx] };
                                  order.pvList = (order.pvList || []).map(p =>
                                    p.id === pv.id ? { ...p, attachment: { type: 'file', name: file.name, data: ev.target.result } } : p
                                  );
                                  orders[oIdx] = order;
                                  return { ...prev, orders };
                                });
                              };
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                          <button onClick={() => {
                            const url = window.prompt('Lien Google Drive :');
                            if (!url) return;
                            setData(prev => {
                              const orders = [...(prev.orders || [])];
                              const oIdx = orders.findIndex(o => o.id === selectedOrder.id);
                              if (oIdx === -1) return prev;
                              const order = { ...orders[oIdx] };
                              order.pvList = (order.pvList || []).map(p =>
                                p.id === pv.id ? { ...p, attachment: { type: 'drive', url } } : p
                              );
                              orders[oIdx] = order;
                              return { ...prev, orders };
                            });
                          }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b' }}>
                            🔗 Drive
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bouton Valider */}
                    {!isValide && (
                      <button
                        onClick={() => {
                          if (!window.confirm(`Valider le PV ${pv.id} ? Cette action va débloquer le versement correspondant en Finance.`)) return;
                          setData(prev => {
                            // 1. Valider le PV sur la commande
                            const orders = [...(prev.orders || [])];
                            const oIdx = orders.findIndex(o => o.id === selectedOrder.id);
                            if (oIdx !== -1) {
                              const order = { ...orders[oIdx] };
                              order.pvList = (order.pvList || []).map(p =>
                                p.id === pv.id ? { ...p, pvStatus: 'Validé', validatedAt: new Date().toISOString() } : p
                              );
                              orders[oIdx] = order;
                            }

                            // 2. Débloquer le versement Finance lié
                            const trackers = [...(prev.financialTrackers || [])];
                            const tIdx = trackers.findIndex(t => t.orderId === selectedOrder.id);
                            if (tIdx !== -1) {
                              const tracker = { ...trackers[tIdx] };
                              tracker.versements = (tracker.versements || []).map(v =>
                                v.pvId === pv.id
                                  ? { ...v, pvStatus: 'Validé', statut: 'En attente' }
                                  : v
                              );
                              trackers[tIdx] = tracker;
                            }
                            return { ...prev, orders, financialTrackers: trackers };
                          });
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 1.1rem',
                          background: 'linear-gradient(135deg, #059669, #047857)',
                          border: 'none', borderRadius: '0.5rem',
                          color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <CheckCircle size={15} /> Valider le PV
                      </button>
                    )}
                    {isValide && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#059669', fontWeight: 700, padding: '0.4rem 0.8rem', background: '#dcfce7', borderRadius: '0.5rem' }}>
                        <CheckCircle size={14} /> Versement débloqué
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Panneau Bons de Livraison générés ─────────────────────────────────── */}
        {selectedOrder.blDates && Object.keys(selectedOrder.blDates).length > 0 && (
          <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Truck size={18} color="#3b82f6" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                Bons de Livraison — Historique des BL générés
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>
                {Object.keys(selectedOrder.blDates).length} BL généré(s)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(selectedOrder.blDates).map(([blType, blDateStr]) => {
                return (
                  <div key={blType} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                    padding: '0.85rem 1rem',
                    borderRadius: '0.65rem',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                  }}>
                    {/* Badge type */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e40af' }}>
                        📦 BL {blType === 'CAISSON_TUNNEL' ? 'Caisson Tunnel' : (blType === 'VITRAGE_OUVRANT_FIX' ? 'Vitrage Ouvrant & Fixe' : (blType === 'VITRAGE_COULISSANT' ? 'Vitrage Coulissant' : (blType === 'GLISSIERE' ? 'Glissière' : blType)))}
                      </span>
                    </div>

                    {/* Infos BL */}
                    <div style={{ flex: 1, display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                      <span>Généré le : <strong>{new Date(blDateStr).toLocaleDateString('fr-FR')}</strong></span>
                    </div>

                    {/* Exporter */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        onClick={() => {
                          let deliveredUnits = [];
                          if (blType === 'ALU') {
                            deliveredUnits = allUnits.filter(u => u.statusAlu === 'Livré' || u.statusAlu === 'Posé' || u.statusAlu === 'Fini');
                          } else if (blType === 'VITRAGE') {
                            deliveredUnits = allUnits.filter(u => u.statusVitrage === 'Livré' || u.statusVitrage === 'Fini');
                          } else if (blType === 'VITRAGE_OUVRANT_FIX') {
                            deliveredUnits = allUnits.filter(u => u.openingType !== 'Coulissant' && (u.statusVitrage === 'Livré' || u.statusVitrage === 'Fini' || Object.values(selectedOrder.deliveredGlassPanes?.[u.id] || {}).some(qty => qty > 0)));
                          } else if (blType === 'VITRAGE_COULISSANT') {
                            deliveredUnits = allUnits.filter(u => u.openingType === 'Coulissant' && (u.statusVitrage === 'Livré' || u.statusVitrage === 'Fini' || Object.values(selectedOrder.deliveredGlassPanes?.[u.id] || {}).some(qty => qty > 0)));
                          } else if (blType === 'VOLET') {
                            deliveredUnits = allUnits.filter(u => (u.isExtrudedLame || u.isCaissonTunnel) && (u.statusVolet === 'Livré' || u.statusVolet === 'Fini' || u.statusVolet === 'Posé'));
                          } else if (blType === 'GLISSIERE') {
                            deliveredUnits = allUnits.filter(u => u.hasShutter && u.caissonSize === 0 && (u.statusGlissiere === 'Livré' || u.statusGlissiere === 'Fini' || u.statusGlissiere === 'Posé'));
                          } else if (blType === 'CAISSON_TUNNEL') {
                            deliveredUnits = allUnits.filter(u => u.isCaissonTunnel && (u.statusCaissonTunnel === 'Livré' || u.statusCaissonTunnel === 'Fini' || u.statusCaissonTunnel === 'Posé' || Object.values(selectedOrder.deliveredCaissonTunnel?.[u.id] || {}).some(val => val === true)));
                          }

                          if (deliveredUnits.length === 0) {
                            alert(`Aucun produit n'a été livré pour ${blType}`);
                            return;
                          }
                          generateDeliveryNote(blType, deliveredUnits, true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}
                      >
                        <Download size={13} /> Télécharger le PDF (Date originale)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', background: '#f8fafc', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700 }}>REMARQUES GÉNÉRALES POUR LE CLIENT</p>
              <textarea 
                className="input" 
                placeholder="Écrivez ici vos remarques globales sur l'avancement du chantier..."
                value={globalRemark}
                onChange={e => setGlobalRemark(e.target.value)}
                style={{ width: '100%', height: '60px', fontSize: '0.85rem' }}
              />
            </div>
            <div style={{ width: '200px', fontSize: '0.75rem', color: '#64748b' }}>
              <p>Ces remarques apparaîtront sur la première page du Rapport d'État Client.</p>
              <p style={{ marginTop: '0.5rem' }}>Astuce: Utilisez les "Notes" par unité dans le tableau ci-dessous pour des précisions spécifiques.</p>
            </div>
         </div>

        <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#f8fafc', borderLeft: '4px solid #3b82f6' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={16} color="#3b82f6" /> SÉLECTION & GESTION DE PRODUCTION PAR LOT :
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {(selectedOrder.batches || []).map(batch => {
              const isActive = selectedBatchIds.has(batch.id);
              return (
                <div key={batch.id} style={{ 
                  display: 'flex', alignItems: 'center', background: 'white', borderRadius: '0.75rem', 
                  border: `2px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`, padding: '0.4rem 0.75rem', gap: '0.6rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                }}>
                  <button 
                    onClick={() => toggleBatchSelection(batch.id)} 
                    className="btn" 
                    style={{ border: 'none', background: 'transparent', padding: 0, color: isActive ? '#1e40af' : '#64748b', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    title="Cliquer pour afficher/masquer ce lot dans le tableau"
                  >
                    {isActive ? <CheckCircle size={16} color="#2563eb" /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #cbd5e1' }} />} Lot : {batch.id}
                  </button>
                  <div style={{ borderLeft: '1px solid #cbd5e1', height: '20px', margin: '0 0.1rem' }} />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBatchUpdateStatus(batch.id, 'En production', 'start_production');
                    }} 
                    className="btn" 
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title="Lancer la production de TOUT ce lot"
                  >
                    <Play size={12} /> Lancer Lot
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBatchUpdateStatus(batch.id, 'Produit', 'finish_production');
                    }} 
                    className="btn" 
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', background: '#f0fdf4', color: '#15803d', border: '1px solid #a7f3d0', fontWeight: 800, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title="Déclarer TOUT ce lot comme produit (fabriqué)"
                  >
                    <Factory size={12} /> Lot Produit
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {allUnits.length === 0 ? (
          <div className="glass" style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
            <Layers size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
            <p>Sélectionnez un lot pour commencer le suivi.</p>
          </div>
        ) : (
          <>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
               {[
                 { label: 'Total', val: stats.total, color: '#1e293b', icon: Package },
                 { label: 'Alu Livrés', val: stats.alu.livré, color: '#1e293b', icon: Truck },
                 { label: 'Vit. Livrés', val: stats.vit.livré, color: '#3b82f6', icon: Truck },
                 { label: 'Alu Posés', val: stats.alu.posé, color: '#8b5cf6', icon: Wrench },
                 { label: 'Fini (Total)', val: stats.alu.fini, color: '#10b981', icon: CheckCircle },
               ].map((s, i) => (
                 <div key={i} className="glass" style={{ padding: '1rem', borderBottom: `4px solid ${s.color}` }}>
                   <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{s.label}</p>
                   <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.val}</p>
                 </div>
               ))}
             </div>

            <div className="glass shadow-md" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 700 }}>Contrôle par Scanner</h3>
                  {selectedUnitIds.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.4rem 1rem', borderRadius: '0.75rem', border: '1px solid #bfdbfe', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>{selectedUnitIds.size} sélectionné(s) :</span>
                      <button 
                        onClick={() => handleBulkUpdateStatusDual('both', 'En production', 'start_production')} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#fffbeb', color: '#b45309', borderColor: '#fde68a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Play size={12} /> Lancer Prod.
                      </button>
                      <button 
                        onClick={() => handleBulkUpdateStatusDual('both', 'Produit', 'finish_production')} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#f0fdf4', color: '#15803d', borderColor: '#a7f3d0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Factory size={12} /> Marquer Produit
                      </button>
                      <select 
                        className="input" 
                        style={{ padding: '0.2rem', fontSize: '0.8rem', width: 'auto', minWidth: '150px' }}
                        onChange={(e) => handleBulkUpdateZone(e.target.value)}
                        value=""
                      >
                        <option value="" disabled>Assigner à une Zone...</option>
                        {storageZones.map(z => (
                          <option key={z.id} value={z.id}>{z.name}</option>
                        ))}
                        <option value="none">-- Retirer Zone --</option>
                      </select>
                      <button onClick={() => setSelectedUnitIds(new Set())} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Annuler</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button onClick={() => { setScanningMode('loading'); setActiveView('scanner'); }} className="btn btn-secondary" style={{ background: scanningMode === 'loading' ? '#3b82f6' : 'white', color: scanningMode === 'loading' ? 'white' : 'inherit' }}><Truck size={14} /> Chargement</button>
                   <button onClick={() => { setScanningMode('unloading'); setActiveView('scanner'); }} className="btn btn-secondary" style={{ background: scanningMode === 'unloading' ? '#10b981' : 'white', color: scanningMode === 'unloading' ? 'white' : 'inherit' }}><UserCheck size={14} /> Livraison</button>
                   <button onClick={() => { setScanningMode('installing'); setActiveView('scanner'); }} className="btn btn-secondary" style={{ background: scanningMode === 'installing' ? '#8b5cf6' : 'white', color: scanningMode === 'installing' ? 'white' : 'inherit' }}><Wrench size={14} /> Pose</button>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedUnitIds.size === allUnits.length && allUnits.length > 0} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUnitIds(new Set(allUnits.map(u => u.id)));
                          else setSelectedUnitIds(new Set());
                        }}
                      />
                    </th>
                    <th>Unité</th><th>Repère</th><th>Étage</th><th>Volet</th><th>Produit</th><th>Remarques</th><th>Zone Stockage</th><th>Statut Actuel</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUnits.map(unit => (
                    <tr key={unit.id} style={{ background: selectedUnitIds.has(unit.id) ? '#f0f9ff' : 'transparent' }}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedUnitIds.has(unit.id)} 
                          onChange={() => toggleUnitSelection(unit.id)}
                        />
                      </td>
                      <td style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{unit.id.split('-').pop()}</td>
                      <td 
                        style={{ fontWeight: 700, cursor: 'pointer', color: '#1e40af' }} 
                        onClick={() => {
                          const samePosteIds = allUnits.filter(u => u.name === unit.name).map(u => u.id);
                          setSelectedUnitIds(prev => {
                            const next = new Set(prev);
                            const allAlreadySelected = samePosteIds.every(id => next.has(id));
                            if (allAlreadySelected) samePosteIds.forEach(id => next.delete(id));
                            else samePosteIds.forEach(id => next.add(id));
                            return next;
                          });
                        }}
                        title="Sélectionner tous les éléments de ce repère"
                      >
                        {unit.name}
                      </td>
                      <td 
                        style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }}
                        onClick={() => {
                          if (!unit.floor) return;
                          const sameFloorIds = allUnits.filter(u => u.floor === unit.floor).map(u => u.id);
                          setSelectedUnitIds(prev => {
                            const next = new Set(prev);
                            const allAlreadySelected = sameFloorIds.every(id => next.has(id));
                            if (allAlreadySelected) sameFloorIds.forEach(id => next.delete(id));
                            else sameFloorIds.forEach(id => next.add(id));
                            return next;
                          });
                        }}
                        title="Sélectionner tout cet étage"
                      >
                        {unit.floor || '---'}
                      </td>
                      <td>
                        {unit.hasShutter ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <button 
                              onClick={() => setViewingShutter(unit)}
                              className="btn" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', fontWeight: 800 }}
                            >
                              OUI
                            </button>
                            {unit.isExtrudedLame && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                <span style={{ color: '#8b5cf6' }}>Volet: {unit.statusVolet}</span>
                                {unit.caissonSize === 0 && <span style={{ color: '#0369a1' }}>Glissière: {unit.statusGlissiere}</span>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>NON</span>
                        )}
                      </td>
                      <td>{unit.label}</td>
                      <td>
                        <input 
                          className="input" 
                          style={{ padding: '0.2rem', fontSize: '0.75rem', width: '120px' }}
                          placeholder="Note..."
                          value={unitRemarks[unit.id] || ''}
                          onChange={(e) => handleUpdateUnitRemark(unit.id, e.target.value)}
                        />
                      </td>
                      <td>
                        <select 
                          className="input" 
                          style={{ padding: '0.2rem', fontSize: '0.75rem', width: 'auto' }}
                          value={unit.storageZoneId || ''}
                          onChange={(e) => handleUpdateUnitZone(unit.id, e.target.value)}
                        >
                          <option value="">-- Non assignée --</option>
                          {storageZones.map(z => (
                            <option key={z.id} value={z.id}>{z.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                           <span style={{ 
                             padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, 
                             background: unit.statusAlu === 'En production' ? '#fffbeb' : (unit.statusAlu === 'Produit' ? '#f0fdf4' : '#dcfce7'), 
                             color: unit.statusAlu === 'En production' ? '#b45309' : (unit.statusAlu === 'Produit' ? '#15803d' : '#166534'),
                             border: `1px solid ${unit.statusAlu === 'En production' ? '#fde68a' : (unit.statusAlu === 'Produit' ? '#a7f3d0' : 'transparent')}`
                           }}>
                             ALU: {unit.statusAlu}
                           </span>
                           <span style={{ 
                             padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, 
                             background: unit.statusVitrage === 'En production' ? '#fffbeb' : (unit.statusVitrage === 'Produit' ? '#f0fdf4' : '#dbeafe'), 
                             color: unit.statusVitrage === 'En production' ? '#b45309' : (unit.statusVitrage === 'Produit' ? '#15803d' : '#1e40af'),
                             border: `1px solid ${unit.statusVitrage === 'En production' ? '#fde68a' : (unit.statusVitrage === 'Produit' ? '#a7f3d0' : 'transparent')}`
                           }}>
                             VIT: {unit.statusVitrage}
                           </span>
                           {selectedOrder.unitPVs?.[unit.id] && (
                             <span style={{ padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                               <CheckCircle size={10} /> Réceptionné
                             </span>
                           )}
                         </div>
                       </td>
                       <td>
                         <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                           <button onClick={() => handleUpdateUnitStatusDual(unit.id, 'both', 'En production', 'ADMIN', 'start_production')} className="btn btn-secondary" style={{ padding: '0.2rem', color: '#b45309' }} title="Lancer Production"><Play size={12} /></button>
                           <button onClick={() => handleUpdateUnitStatusDual(unit.id, 'both', 'Produit', 'ADMIN', 'finish_production')} className="btn btn-secondary" style={{ padding: '0.2rem', color: '#16a34a' }} title="Marquer Produit (Fabriqué)"><Factory size={12} /></button>
                           <button onClick={() => handleUpdateUnitStatusDual(unit.id, 'alu', 'Livré')} className="btn btn-secondary" style={{ padding: '0.2rem' }} title="Livrer Alu"><Truck size={12} /></button>
                           <button onClick={() => handleUpdateUnitStatusDual(unit.id, 'vitrage', 'Livré')} className="btn btn-secondary" style={{ padding: '0.2rem', color: '#3b82f6' }} title="Livrer Vitrage"><Truck size={12} /></button>
                           <button onClick={() => handleUpdateUnitStatusDual(unit.id, 'alu', 'Posé')} className="btn btn-secondary" style={{ padding: '0.2rem' }} title="Poser Alu"><Wrench size={12} /></button>
                           <button onClick={() => handleUpdateUnitStatusDual(unit.id, 'both', 'Fini')} className="btn btn-secondary" style={{ padding: '0.2rem', color: '#10b981' }} title="Terminer"><CheckCircle size={12} /></button>
                         </div>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* JOURNAL DE CHANTIER - Messages temps réel poseurs */}
        <div className="glass shadow-md" style={{ padding: '1.5rem', marginTop: '2rem', borderTop: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MessageSquare size={20} color="#f59e0b" />
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem' }}>Journal de Chantier (Terrain)</h3>
              {(selectedOrder.fieldNotes || []).length > 0 && (
                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 800 }}>
                  {(selectedOrder.fieldNotes || []).length} message(s)
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Envoyé par les poseurs sur le terrain</span>
          </div>

          {(selectedOrder.fieldNotes || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', opacity: 0.4 }}>
              <MessageSquare size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ fontWeight: 600 }}>Aucun message terrain pour l&apos;instant</p>
              <p style={{ fontSize: '0.8rem' }}>Les poseurs peuvent envoyer des rapports via l&apos;interface Poseur</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {[...(selectedOrder.fieldNotes || [])].reverse().map(note => (
                <div key={note.id} style={{ background: '#fffbeb', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #fde68a', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 32, height: 32, background: '#f59e0b', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                        {(note.author || 'E').charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>{note.author}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(note.date).toLocaleString('fr-FR')}</span>
                      <button
                        onClick={() => {
                          if (!confirm('Supprimer ce message ?')) return;
                          setData(prev => {
                            const orders = [...(prev.orders || [])];
                            const oIdx = orders.findIndex(o => o.id === selectedOrderId);
                            if (oIdx === -1) return prev;
                            const o = { ...orders[oIdx] };
                            o.fieldNotes = (o.fieldNotes || []).filter(n => n.id !== note.id);
                            orders[oIdx] = o;
                            return { ...prev, orders };
                          });
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', opacity: 0.6 }}
                        title="Supprimer"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                  {note.text && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', lineHeight: '1.5', color: '#1e293b' }}>{note.text}</p>}
                  {note.image && (
                    <img
                      src={note.image}
                      alt="Photo chantier"
                      style={{ width: '100%', maxWidth: '400px', borderRadius: '0.75rem', maxHeight: '300px', objectFit: 'cover', cursor: 'pointer' }}
                      onClick={() => window.open(note.image, '_blank')}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {activeView === 'scanner' && (
           <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
             <div className="glass" style={{ background: 'white', padding: '3rem', borderRadius: '2rem', textAlign: 'center', maxWidth: '500px', width: '90%' }}>
                <div style={{ width: '80px', height: '80px', background: scanningMode === 'loading' ? '#3b82f6' : (scanningMode === 'unloading' ? '#10b981' : '#8b5cf6'), color: 'white', borderRadius: '20px', display: 'grid', placeItems: 'center', margin: '0 auto 1.5rem' }}><QrCode size={40} /></div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Scanner : {scanningMode === 'loading' ? 'Chargement' : (scanningMode === 'unloading' ? 'Livraison' : 'Pose On-Site')}</h2>
                <input autoFocus placeholder="Scanner le code..." className="input" style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 700, padding: '1rem' }} onKeyDown={(e) => { if (e.key === 'Enter') { handleScanUnit(e.target.value); e.target.value = ''; } }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
                  <button onClick={() => setActiveView('details')} className="btn btn-secondary">Terminer</button>
                  <button onClick={() => setShowScanner(true)} className="btn btn-primary">Ouvrir Caméra</button>
                </div>
             </div>
             {showScanner && (
               <QRScanner 
                 onScan={(text) => {
                   handleScanUnit(text);
                   setShowScanner(false);
                 }}
                 onClose={() => setShowScanner(false)}
               />
             )}
           </div>
        )}

        {/* SHUTTER DETAILS POPUP */}
        {viewingShutter && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="glass shadow-2xl" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', width: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Détails du Volet</h3>
                <button onClick={() => setViewingShutter(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="glass" style={{ padding: '1rem', background: '#f8fafc' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Produit / Emplacement</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{viewingShutter.name} ({viewingShutter.label})</p>
                </div>
                <div className="glass" style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fef3c7' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>Configuration Volet</p>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#92400e' }}>{viewingShutter.shutterInfo}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingShutter(null)}
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
              Fermer
            </button>
          </div>
        </div>
      )}

        {/* INSTALLER QR MODAL */}
        {showInstallerQr && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <div className="glass shadow-2xl" style={{ background: 'white', padding: '2.5rem', borderRadius: '1.5rem', width: '400px', textAlign: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Accès Portail Poseur</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Scannez ce code avec un téléphone pour ouvrir l'interface de suivi de pose.</p>
              
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px dashed #cbd5e1', marginBottom: '1.5rem', display: 'grid', placeItems: 'center' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(showInstallerQr)}`} 
                  alt="QR Code Poseur"
                  style={{ width: '250px', height: '250px', borderRadius: '8px' }}
                />
              </div>
              
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.5rem' }}>Lien également copié dans le presse-papier.</p>
              
              <button 
                onClick={() => setShowInstallerQr(null)}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {showTeamManager && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass shadow-2xl" style={{ background: 'white', padding: '2rem', borderRadius: '1.5rem', width: '450px' }}>
              <h3 style={{ fontWeight: 800, marginBottom: '1.5rem' }}>Gérer l'Équipe de Pose</h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input className="input" placeholder="Nom du poseur..." value={newInstallerName} onChange={e => setNewInstallerName(e.target.value)} />
                <button className="btn btn-primary" onClick={() => { handleUpdateTeam(newInstallerName, 'add'); setNewInstallerName(''); }}>Ajouter</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {(selectedOrder.installers || []).map(name => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.75rem' }}>
                    <span style={{ fontWeight: 700 }}>{name}</span>
                    <button onClick={() => handleUpdateTeam(name, 'remove')} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowTeamManager(false)} className="btn btn-secondary" style={{ width: '100%', marginTop: '1.5rem' }}>Fermer</button>
            </div>
          </div>
        )}

        {/* PV RECEPTION MODAL */}
        {showPVModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
            <div className="glass shadow-2xl animate-scale-up" style={{ background: 'white', padding: '2.5rem', borderRadius: '2rem', width: '450px' }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ width: '60px', height: '60px', background: '#fffbeb', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}>
                  <ClipboardCheck size={32} color="#b45309" />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>Générer PV de Réception</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>Sélectionnez les étages à inclure dans le procès-verbal.</p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Choix des Étages</label>
                  <button 
                    onClick={() => {
                      if (pvSelectedFloors.size === uniqueFloors.length) setPvSelectedFloors(new Set());
                      else setPvSelectedFloors(new Set(uniqueFloors));
                    }}
                    className="btn" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#f1f5f9' }}
                  >
                    {pvSelectedFloors.size === uniqueFloors.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                  {uniqueFloors.map(floor => (
                    <label key={floor} style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', 
                      background: pvSelectedFloors.has(floor) ? '#fffbeb' : '#f8fafc', 
                      borderRadius: '0.75rem', border: `2px solid ${pvSelectedFloors.has(floor) ? '#fde68a' : 'transparent'}`,
                      cursor: 'pointer', transition: 'all 0.2s ease'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={pvSelectedFloors.has(floor)} 
                        onChange={() => setPvSelectedFloors(prev => {
                          const next = new Set(prev);
                          if (next.has(floor)) next.delete(floor); else next.add(floor);
                          return next;
                        })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: pvSelectedFloors.has(floor) ? '#92400e' : '#475569' }}>
                        {floor === '' || floor === 'N/A' ? 'Non spécifié' : `Étage ${floor}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isFinalPV} onChange={e => setIsFinalPV(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>PV de Réception Final (Aucun versement financier)</span>
                </label>
              </div>

              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Représentant Fournisseur</label>
                <select 
                  className="input" 
                  value={pvTeamMember} 
                  onChange={e => setPvTeamMember(e.target.value)}
                  style={{ width: '100%', marginBottom: pvTeamMember === 'Autre' ? '0.75rem' : '0' }}
                >
                  <option value="">Sélectionnez un membre de l'équipe...</option>
                  {(selectedOrder.installers || []).map(inst => (
                    <option key={inst} value={inst}>{inst} (Technicien de pose)</option>
                  ))}
                  <option value="Autre">Autre (Saisie manuelle)</option>
                </select>
                {pvTeamMember === 'Autre' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input type="text" className="input" placeholder="Nom et prénom" value={pvCustomName} onChange={e => setPvCustomName(e.target.value)} />
                    <input type="text" className="input" placeholder="Fonction" value={pvCustomRole} onChange={e => setPvCustomRole(e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '1rem' }}>
                  <input type="checkbox" checked={sendByEmail} onChange={e => setSendByEmail(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Envoyer automatiquement par email</span>
                </label>
                
                {sendByEmail && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>EMAIL D'ENVOI (LE VÔTRE)</label>
                      <input className="input" type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>NOM DE VOTRE ENTREPRISE</label>
                      <input className="input" type="text" placeholder="Ex: ALU DESIGN" value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>EMAIL DU CLIENT (DESTINATAIRE)</label>
                      <input className="input" type="email" placeholder="client@email.com" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => setShowPVModal(false)}
                  className="btn btn-secondary" style={{ flex: 1, padding: '1rem' }}
                >
                  Annuler
                </button>
                <button 
                  onClick={generatePVReception}
                  disabled={!isFinalPV && pvSelectedFloors.size === 0}
                  className="btn btn-primary" style={{ flex: 2, padding: '1rem', background: '#b45309', border: 'none', boxShadow: '0 4px 12px rgba(180, 83, 9, 0.2)' }}
                >
                  Générer le PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Selection Modal for BL ─────────────────────────────────────────── */}
        {blModalType && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
            <div className="glass shadow-2xl animate-scale-up" style={{ background: 'white', padding: '2.5rem', borderRadius: '2rem', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
                <div style={{ width: '60px', height: '60px', background: '#eff6ff', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}>
                  <Truck size={32} color="#2563eb" />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>Livraison : Produits restants ({blModalType === 'CAISSON_TUNNEL' ? 'CAISSON TUNNEL' : (blModalType === 'GLISSIERE' ? 'GLISSIÈRE' : blModalType)})</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>Sélectionnez les châssis à livrer pour ce bon de livraison.</p>
                {selectedOrder.blDates?.[blModalType] && (
                  <button 
                    onClick={() => {
                      let deliveredUnits = [];
                      if (blModalType === 'ALU') {
                        deliveredUnits = allUnits.filter(u => u.statusAlu === 'Livré' || u.statusAlu === 'Posé' || u.statusAlu === 'Fini');
                      } else if (blModalType === 'VITRAGE') {
                        deliveredUnits = allUnits.filter(u => u.statusVitrage === 'Livré' || u.statusVitrage === 'Fini');
                      } else if (blModalType === 'VOLET') {
                        deliveredUnits = allUnits.filter(u => (u.isExtrudedLame || u.isCaissonTunnel) && (u.statusVolet === 'Livré' || u.statusVolet === 'Fini' || u.statusVolet === 'Posé'));
                      } else if (blModalType === 'GLISSIERE') {
                        deliveredUnits = allUnits.filter(u => u.hasShutter && u.caissonSize === 0 && (u.statusGlissiere === 'Livré' || u.statusGlissiere === 'Fini' || u.statusGlissiere === 'Posé'));
                      } else if (blModalType === 'CAISSON_TUNNEL') {
                        deliveredUnits = allUnits.filter(u => u.isCaissonTunnel && (u.statusCaissonTunnel === 'Livré' || u.statusCaissonTunnel === 'Fini' || u.statusCaissonTunnel === 'Posé' || Object.values(selectedOrder.deliveredCaissonTunnel?.[u.id] || {}).some(val => val === true)));
                      }

                      if (deliveredUnits.length === 0) {
                        alert(`Aucun produit n'a été livré pour ${blModalType}`);
                        return;
                      }
                      generateDeliveryNote(blModalType, deliveredUnits, true);
                    }}
                    className="btn btn-secondary" 
                    style={{ marginTop: '1rem', color: '#0369a1', borderColor: '#bae6fd', fontWeight: 'bold' }}
                  >
                    <Download size={16} /> Re-télécharger le BL (généré le {new Date(selectedOrder.blDates[blModalType]).toLocaleDateString('fr-FR')})
                  </button>
                )}
              </div>

              {remainingBLUnits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', flex: 1 }}>
                  <CheckCircle size={40} color="#10b981" style={{ margin: '0 auto 1rem', display: 'block' }} />
                  <p style={{ fontWeight: 'bold' }}>Tous les produits sont déjà livrés !</p>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.5rem' }}>
                  {blModalType === 'CAISSON_TUNNEL' && (
                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '1.5rem', background: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: '1rem', border: '1px solid #bbf7d0', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#166534' }}>Inclure dans le BL :</span>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
                        <input type="checkbox" checked={caissonTunnelComponents.axe} onChange={e => setCaissonTunnelComponents(prev => ({ ...prev, axe: e.target.checked }))} />
                        Axe
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
                        <input type="checkbox" checked={caissonTunnelComponents.moteur} onChange={e => setCaissonTunnelComponents(prev => ({ ...prev, moteur: e.target.checked }))} />
                        Moteur
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>
                        <input type="checkbox" checked={caissonTunnelComponents.kit} onChange={e => setCaissonTunnelComponents(prev => ({ ...prev, kit: e.target.checked }))} />
                        Kit
                      </label>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                      {blSelectedUnitIds.size} / {remainingBLUnits.length} sélectionné(s)
                    </span>
                    <button 
                      onClick={() => {
                        if (blSelectedUnitIds.size === remainingBLUnits.length) {
                          setBlSelectedUnitIds(new Set());
                        } else {
                          setBlSelectedUnitIds(new Set(remainingBLUnits.map(u => u.id)));
                        }
                      }}
                      className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    >
                      {blSelectedUnitIds.size === remainingBLUnits.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  </div>

                  {Object.keys(groupedRemainingBLUnits).sort().map(floor => {
                    const floorApts = groupedRemainingBLUnits[floor];
                    const floorUnitsCount = Object.values(floorApts).flat().length;
                    const floorSelectedCount = Object.values(floorApts).flat().filter(u => blSelectedUnitIds.has(u.id)).length;
                    const isFloorAllSelected = floorSelectedCount === floorUnitsCount;

                    return (
                      <div key={floor} style={{ marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem' }}>
                        {/* Floor Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>
                            Étage : {floor === '' || floor === 'N/A' ? 'Non spécifié' : floor}
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                            <input 
                              type="checkbox"
                              checked={isFloorAllSelected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setBlSelectedUnitIds(prev => {
                                  const next = new Set(prev);
                                  Object.values(floorApts).flat().forEach(u => {
                                    if (checked) next.add(u.id);
                                    else next.delete(u.id);
                                  });
                                  return next;
                                });
                              }}
                            />
                            Tout l'étage
                          </label>
                        </div>

                        {/* Apartments */}
                        {Object.keys(floorApts).sort().map(apt => {
                          const aptUnits = floorApts[apt];
                          const aptSelectedCount = aptUnits.filter(u => blSelectedUnitIds.has(u.id)).length;
                          const isAptAllSelected = aptSelectedCount === aptUnits.length;

                          return (
                            <div key={apt} style={{ marginLeft: '1rem', marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>
                                  Appartement : {apt}
                                </span>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                  <input 
                                    type="checkbox"
                                    checked={isAptAllSelected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setBlSelectedUnitIds(prev => {
                                        const next = new Set(prev);
                                        aptUnits.forEach(u => {
                                          if (checked) next.add(u.id);
                                          else next.delete(u.id);
                                        });
                                        return next;
                                      });
                                    }}
                                  />
                                  Tout l'appart
                                </label>
                              </div>

                              {/* Unit list */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginLeft: '0.75rem' }}>
                                {aptUnits.map(unit => {
                                  const isSelected = blSelectedUnitIds.has(unit.id);
                                  const hasGlass = blModalType === 'VITRAGE' && unit.glassPanes && unit.glassPanes.length > 0;
                                  const isExpanded = expandedUnits.has(unit.id);
                                  
                                  const toggleExpand = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedUnits(prev => {
                                      const next = new Set(prev);
                                      if (next.has(unit.id)) next.delete(unit.id);
                                      else next.add(unit.id);
                                      return next;
                                    });
                                  };

                                  return (
                                    <div key={unit.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.4rem', borderRadius: '0.5rem', background: isSelected ? '#f0f9ff' : 'transparent', border: isSelected ? '1px solid #bae6fd' : '1px solid transparent' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={() => {
                                            setBlSelectedUnitIds(prev => {
                                              const next = new Set(prev);
                                              if (next.has(unit.id)) next.delete(unit.id);
                                              else next.add(unit.id);
                                              return next;
                                            });
                                          }}
                                        />
                                        <div style={{ fontSize: '0.85rem', flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontWeight: 600 }}>
                                            {unit.name} <span style={{ fontWeight: 400, color: '#64748b' }}>({unit.label})</span>
                                            {unit.openingType && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: unit.openingType === 'Coulissant' ? '#e8f5e9' : '#e3f2fd', color: unit.openingType === 'Coulissant' ? '#2e7d32' : '#1565c0' }}>{unit.openingType}</span>}
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{unit.dimensions}</span>
                                            {hasGlass && isSelected && (
                                              <button 
                                                onClick={toggleExpand}
                                                style={{ border: 'none', background: '#e2e8f0', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#475569' }}
                                              >
                                                Vitrages {isExpanded ? '▲' : '▼'}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </label>

                                      {hasGlass && isExpanded && isSelected && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.5rem 0.5rem 0.5rem 1.5rem', background: 'white', borderRadius: '0.35rem', marginTop: '0.25rem', borderLeft: '3px solid #3b82f6' }}>
                                          {unit.glassPanes.map(g => {
                                            const paneKey = `${g.id || g.name}_${g.width}_${g.height}`;
                                            const deliveredQty = selectedOrder.deliveredGlassPanes?.[unit.id]?.[paneKey] || 0;
                                            const remainingQty = g.qty - deliveredQty;
                                            if (remainingQty <= 0) return null;

                                            const isPaneChecked = blSelectedGlassPanes[unit.id]?.[paneKey] !== false;

                                            return (
                                              <label key={paneKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                                <input 
                                                  type="checkbox"
                                                  checked={isPaneChecked}
                                                  onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setBlSelectedGlassPanes(prev => ({
                                                      ...prev,
                                                      [unit.id]: {
                                                        ...(prev[unit.id] || {}),
                                                        [paneKey]: checked
                                                      }
                                                    }));
                                                  }}
                                                />
                                                <span style={{ color: isPaneChecked ? '#0f172a' : '#94a3b8' }}>
                                                  {g.name} ({g.width} x {g.height} mm) — <strong style={{ color: '#2563eb' }}>Qté: {remainingQty}</strong> {deliveredQty > 0 && <span style={{ color: '#10b981', fontSize: '0.7rem' }}>({deliveredQty} déjà livré(s))</span>}
                                                </span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
                <button 
                  onClick={() => setBlModalType(null)}
                  className="btn btn-secondary" style={{ flex: 1, padding: '0.8rem' }}
                >
                  Annuler
                </button>
                 <button 
                   onClick={() => {
                     const unitsToDeliver = remainingBLUnits.filter(u => blSelectedUnitIds.has(u.id));
                     if (blModalType === 'VITRAGE') {
                       const coulissantUnits = unitsToDeliver.filter(u => u.openingType === 'Coulissant');
                       const ouvrantFixUnits = unitsToDeliver.filter(u => u.openingType !== 'Coulissant');
                       
                       if (coulissantUnits.length > 0) {
                         generateDeliveryNote('VITRAGE_COULISSANT', coulissantUnits);
                       }
                       if (ouvrantFixUnits.length > 0) {
                         generateDeliveryNote('VITRAGE_OUVRANT_FIX', ouvrantFixUnits);
                       }
                     } else {
                       generateDeliveryNote(blModalType, unitsToDeliver);
                     }
                     setBlModalType(null);
                   }}
                   disabled={blSelectedUnitIds.size === 0}
                   className="btn btn-primary" style={{ flex: 2, padding: '0.8rem', background: '#2563eb', border: 'none', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
                 >
                   Générer le BL ({blSelectedUnitIds.size})
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeView === 'zones') {
    return (
      <div className="animate-fade-in">
        <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => setActiveView('list')} className="btn" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Gestion des Zones de Stockage</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Configurez les emplacements dans l'atelier pour les fenêtres finies</p>
          </div>
        </header>
        
        <div className="glass shadow-md" style={{ padding: '2rem', maxWidth: '600px' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Nom de la nouvelle zone (ex: Rack A, Zone 1...)"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              style={{ flex: 1 }}
            />
            <button 
              className="btn btn-primary"
              onClick={() => {
                if (!newZoneName.trim()) return;
                const newZone = { id: `Z-${Date.now()}`, name: newZoneName.trim() };
                setData(prev => ({ ...prev, storageZones: [...(prev.storageZones || []), newZone] }));
                setNewZoneName('');
              }}
            >
              <Plus size={18} /> Ajouter
            </button>
          </div>

          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Zones Existantes</h3>
            {storageZones.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aucune zone configurée.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {storageZones.map(zone => (
                  <li key={zone.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <MapPin size={18} color="#3b82f6" />
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{zone.name}</span>
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem', color: '#ef4444' }}
                      onClick={() => {
                        if (confirm(`Supprimer la zone "${zone.name}" ?`)) {
                          setData(prev => ({ ...prev, storageZones: (prev.storageZones || []).filter(z => z.id !== zone.id) }));
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Suivi Expédition & Pose</h1>
          <p style={{ color: '#64748b' }}>Traçabilité totale de l'atelier jusqu'à la fixation finale.</p>
        </div>
        <button onClick={() => setActiveView('zones')} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={18} />
          Zones de Stockage
        </button>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button 
          className={`btn ${listTab === 'ongoing' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setListTab('ongoing')}
          style={listTab === 'ongoing' ? { background: '#3b82f6', color: 'white', border: 'none' } : {}}
        >
          En cours
        </button>
        <button 
          className={`btn ${listTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setListTab('history')}
          style={listTab === 'history' ? { background: '#3b82f6', color: 'white', border: 'none' } : {}}
        >
          Historique (Prêt)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {displayedOrders.map(order => {
          return (
            <div key={order.id} className="glass shadow-md card-hover" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => { setSelectedOrderId(order.id); setActiveView('details'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', background: '#eff6ff', color: '#3b82f6', borderRadius: '12px', display: 'grid', placeItems: 'center' }}><Truck size={24} /></div>
                <span style={{ padding: '0.3rem 0.75rem', background: order.globalProgress === 100 ? '#d1fae5' : '#fef3c7', color: order.globalProgress === 100 ? '#065f46' : '#92400e', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{order.globalProgress === 100 ? 'PRÊT' : 'EN COURS'}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{order.id} - {order.clientName}</h3>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>
                    <span>POSE ALU</span>
                    <span>{order.progressAlu.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${order.progressAlu}%`, height: '100%', background: '#8b5cf6', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>
                    <span>VITRAGE / FINI</span>
                    <span>{order.progressVit.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${order.progressVit}%`, height: '100%', background: '#10b981', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {displayedOrders.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p>Aucune commande dans cet onglet.</p>
          </div>
        )}
      </div>
      {/* SHUTTER DETAILS POPUP */}
      {viewingShutter && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass shadow-2xl" style={{ background: 'white', padding: '2rem', borderRadius: '1rem', width: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Détails du Volet</h3>
              <button onClick={() => setViewingShutter(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><XCircle size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="glass" style={{ padding: '1rem', background: '#f8fafc' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Produit / Emplacement</p>
                <p style={{ margin: 0, fontWeight: 700 }}>{viewingShutter.name} ({viewingShutter.label})</p>
              </div>
              <div className="glass" style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fef3c7' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>Configuration Volet</p>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#92400e' }}>{viewingShutter.shutterInfo}</p>
              </div>
            </div>
            <button 
              onClick={() => setViewingShutter(null)}
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1.5rem' }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
      {/* Debug Inspector */}
      <details style={{ marginTop: '4rem', fontSize: '0.65rem', opacity: 0.3, padding: '1rem', borderTop: '1px dashed #e2e8f0' }}>
        <summary style={{ cursor: 'pointer' }}>Données de Diagnostic (Debug)</summary>
        <pre style={{ maxHeight: '200px', overflow: 'auto', marginTop: '1rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem' }}>
          {JSON.stringify({ 
            ordersCount: data.orders?.length,
            selectedOrder: selectedOrder ? {
              id: selectedOrder.id,
              timelineUnits: Object.keys(selectedOrder.unitTimeline || {}).length,
              photoUnits: Object.keys(selectedOrder.unitInstallationPhotos || {}).length,
              dualStatusCount: Object.keys(selectedOrder.unitStatusesDual || {}).length
            } : 'None'
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default ShippingModule;
