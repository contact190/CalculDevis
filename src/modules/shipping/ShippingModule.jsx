import React, { useState, useMemo } from 'react';
import { Truck, Package, QrCode, CheckCircle, AlertTriangle, XCircle, Download, Search, Plus, Trash2, ArrowLeft, ClipboardCheck, UserCheck, ShieldCheck, Layers, Wrench, FileText, MapPin, Share2, Camera, RefreshCw, MessageSquare, Trash } from 'lucide-react';
import { syncDatabase, invokeFunction } from '../../utils/supabaseClient';
import jsPDF from 'jspdf';
import QRScanner from './QRScanner';

// Module version: 1.0.1 - Logistic & Installation Tracking
const ShippingModule = ({ data, setData, refetchData }) => {
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
  const [senderEmail, setSenderEmail] = useState('contact@entreprise.com');
  const [companyName, setCompanyName] = useState('ALU DESIGN'); // Nom par défaut
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendByEmail, setSendByEmail] = useState(false);
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
  const shippableOrders = useMemo(() => {
    return (data.orders || []).filter(order => order.batches && order.batches.length > 0);
  }, [data.orders]);

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
    const units = [];
    (selectedOrder.batches || []).forEach(batch => {
      if (selectedBatchIds.size > 0 && !selectedBatchIds.has(batch.id)) return;
      (batch.items || []).forEach(item => {
        (item.measurements || []).forEach(m => {
          for (let i = 0; i < m.qty; i++) {
            const unitId = `${selectedOrder.id}-${batch.id}-${item.id}-${m.id}-${i}`;
            const name = m.instanceNames?.[i] || `${item.label} #${i + 1}`;
            const floor = m.instanceFloors?.[i] || '';
            const dualStatus = selectedOrder.unitStatusesDual?.[unitId] || { alu: 'Produit', vitrage: 'Produit' };
            const storageZoneId = selectedOrder.unitStorageZones?.[unitId];
            const zone = storageZones.find(z => z.id === storageZoneId);

            // Determine if this specific instance has a shutter and its details
            let hasShutter = false;
            let shutterInfo = 'SANS VOLET';
            let offset = 0;
            const shutterOverridden = (m.shutterList || []).length > 0;
            
            if (shutterOverridden) {
              (m.shutterList || []).forEach(sh => {
                const sQty = Number(sh.qty) || 0;
                if (i >= offset && i < offset + sQty) {
                  hasShutter = true;
                  const caisson = sh.overrides?.caissonId || item.config.shutterConfig?.caissonId;
                  const kit = sh.overrides?.kitId || item.config.shutterConfig?.kitId;
                  
                  const caissonName = data.shutterComponents?.caissons?.find(c => c.id === caisson)?.name || caisson || '';
                  const kitName = data.shutterComponents?.kits?.find(k => k.id === kit)?.name || kit || '';
                  
                  shutterInfo = `${caissonName} ${kitName}`.trim() || 'AVEC VOLET';
                }
                offset += sQty;
              });
            } else if (item.config.hasShutter) {
              hasShutter = true;
              const caisson = item.config.shutterConfig?.caissonId;
              const kit = item.config.shutterConfig?.kitId;
              
              const caissonName = data.shutterComponents?.caissons?.find(c => c.id === caisson)?.name || caisson || '';
              const kitName = data.shutterComponents?.kits?.find(k => k.id === kit)?.name || kit || '';
              
              shutterInfo = `${caissonName} ${kitName}`.trim() || 'AVEC VOLET';
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
              label: item.label,
              dimensions: `${m.L} x ${m.H}`,
              statusAlu: dualStatus.alu,
              statusVitrage: dualStatus.vitrage,
              hasShutter: hasShutter,
              shutterInfo: shutterInfo,
              storageZoneId: storageZoneId,
              storageZone: zone?.name || ''
            });
          }
        });
      });
    });
    return units;
  }, [selectedOrder, selectedBatchIds]);

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
      const current = dualStatuses[unitId] || { alu: 'Produit', vitrage: 'Produit' };
      
      const event = {
        date: new Date().toISOString(),
        user: userName,
        component: component,
        status: newStatus,
        action: actionType,
        issue: issueType
      };

      if (actionType === 'finish') {
        if (component === 'both') {
          current.alu = newStatus;
          current.vitrage = newStatus;
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
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`;
      });
    };

    for (let idx = 0; idx < allUnits.length; idx++) {
      const unit = allUnits[idx];
      if (idx > 0) doc.addPage([100, 150], 'portrait');
      
      // Bordure extérieure
      doc.setLineWidth(0.8);
      doc.rect(2, 2, 96, 146);
      
      // Header - Titre Bordereau
      doc.setFillColor(0, 0, 0);
      doc.rect(2, 2, 96, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('BORDEREAU D\'EXPÉDITION', 50, 10, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      
      // Section 1 : Info Commande
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('CLIENT :', 5, 22);
      const cName = (selectedOrder.clientName).toUpperCase();
      doc.setFontSize(16); doc.text(cName, 5, 29);
      
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`CMD N° : ${selectedOrder.id}`, 5, 38);
      doc.text(`LOT : ${unit.batchId}`, 40, 38);
      doc.setTextColor(37, 99, 235); doc.setFont('helvetica', 'bold');
      doc.text(`ÉTAGE : ${unit.floor || '---'}`, 72, 38);
      doc.setTextColor(0, 0, 0);
      
      doc.setLineWidth(0.3);
      doc.line(5, 42, 95, 42);
      
      // Section 2 : REPERE (Très Gros)
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('REPÈRE / EMPLACEMENT :', 5, 50);
      doc.setFontSize(26);
      doc.text(unit.name, 50, 64, { align: 'center' });
      
      // Nouvelle Section : ZONE DE STOCKAGE
      doc.setFillColor(241, 245, 249);
      doc.rect(5, 69, 90, 8, 'F');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`ZONE DE STOCKAGE : ${unit.storageZone || 'À ASSIGNER'}`, 50, 75, { align: 'center' });
      
      doc.setLineWidth(0.3);
      doc.line(5, 80, 95, 80);
      
      // Section 3 : Détails Techniques
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(0,0,0);
      doc.text(`Type : ${unit.label}`, 5, 87);
      doc.text(`Cotes : ${unit.dimensions} mm`, 5, 93);
      if (unit.hasShutter) {
        doc.text(`Volet : ${unit.shutterInfo}`, 5, 99);
      }
      
      // Section 4 : QR CODE (VRAI CODE SCANNABLE)
      doc.setLineWidth(0.4);
      doc.rect(25, 108, 50, 34); // Cadre pour le scan
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text('SCANNEZ POUR VALIDER (CHARGEMENT/LIVRAISON)', 50, 106, { align: 'center' });
      
      const qrDataUrl = await getQrDataUrl(unit.id);
      doc.addImage(qrDataUrl, 'PNG', 35, 110, 30, 30);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text(unit.id, 50, 146, { align: 'center', charSpace: 0.5 });
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
    
    // Page de Garde
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pw, ph, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.setFont('helvetica', 'bold');
    doc.text('ÉTAT D\'AVANCEMENT CHANTIER', pw / 2, ph / 3, { align: 'center' });
    doc.setFontSize(14); doc.setFont('helvetica', 'normal');
    doc.text(`COMMANDE : ${selectedOrder.id}`, pw / 2, ph / 3 + 15, { align: 'center' });
    doc.text(`CLIENT : ${selectedOrder.clientName}`, pw / 2, ph / 3 + 25, { align: 'center' });
    doc.text(`Rapport généré le : ${new Date().toLocaleDateString('fr-FR')}`, pw / 2, ph / 3 + 35, { align: 'center' });
    
    if (globalRemark) {
      doc.addPage(); doc.setTextColor(30, 41, 59);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text('Remarques Générales du Chantier', 15, 30);
      doc.setDrawColor(226, 232, 240); doc.line(15, 35, 60, 35);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
      const splitRemark = doc.splitTextToSize(globalRemark, pw - 30);
      doc.text(splitRemark, 15, 45);
    }

    doc.addPage();
    let y = 20; 
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
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pw, 70, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24); doc.setFont('helvetica', 'bold');
    doc.text('AUDIT DE PERFORMANCE CHANTIER', 15, 30);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`PROJET : ${selectedOrder.id} | CLIENT : ${selectedOrder.clientName}`, 15, 40);
    doc.text(`GÉNÉRÉ LE : ${new Date().toLocaleString('fr-FR')}`, 15, 45);

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
    drawBox(bx, 80, bw, 30, 'Unités Totales', `${stats.total}`, [30, 41, 59]);
    drawBox(bx + bw + 3.3, 80, bw, 30, 'Taux Pose', `${((stats.done/stats.total)*100 || 0).toFixed(1)}%`, [139, 92, 246]);
    drawBox(bx + (bw + 3.3)*2, 80, bw, 30, 'Taux Finition', `${((stats.vitDone/stats.total)*100 || 0).toFixed(1)}%`, [16, 185, 129]);
    drawBox(bx + (bw + 3.3)*3, 80, bw, 30, 'Litiges SAV', `${stats.sav}`, [239, 68, 68]);

    // Visual Chart: Workload distribution
    doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('DISTRIBUTION DE LA CHARGE DE TRAVAIL', 15, 125);
    let chartY = 135;
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

  const generatePVReception = () => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Filter units: Selected Floors AND (Alu Fini + Vitrage Fini)
    const filteredUnits = allUnits.filter(u => 
      pvSelectedFloors.has(u.floor || 'N/A') && 
      (u.statusAlu === 'Posé' || u.statusAlu === 'Fini') && 
      u.statusVitrage === 'Fini'
    );

    if (filteredUnits.length === 0) {
      alert("Aucune unité terminée (Alu + Vitrage) n'a été trouvée pour les étages sélectionnés.");
      return;
    }

    // Header
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pw, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('PROCÈS-VERBAL DE RÉCEPTION', 15, 25);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`CHANTIER : ${selectedOrder.id} | CLIENT : ${selectedOrder.clientName}`, 15, 35);
    doc.text(`DATE : ${new Date().toLocaleDateString('fr-FR')} | ÉTAGES : ${Array.from(pvSelectedFloors).join(', ')}`, 15, 40);

    let y = 65;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('LISTE DES OUVRAGES RÉCEPTIONNÉS', 15, y);
    doc.line(15, y + 2, 45, y + 2);
    y += 15;

    // Table Header
    doc.setFillColor(241, 245, 249); doc.rect(15, y - 7, pw - 30, 10, 'F');
    doc.setFontSize(9); doc.text('UNITÉ', 20, y);
    doc.text('TYPE / DIMENSIONS', 60, y);
    doc.text('ÉTAGE', 130, y);
    doc.text('STATUT', 165, y);
    y += 10;

    filteredUnits.forEach(u => {
      doc.setFont('helvetica', 'normal');
      doc.text(u.name, 20, y);
      doc.text(`${u.label} (${u.dimensions}mm)`, 60, y);
      doc.text(u.floor || 'N/A', 130, y);
      doc.setTextColor(16, 185, 129); doc.setFont('helvetica', 'bold');
      doc.text('TERMINÉ', 165, y);
      doc.setTextColor(30, 41, 59);
      doc.setDrawColor(241, 245, 249); doc.line(15, y + 4, pw - 15, y + 4);
      y += 12;
      if (y > ph - 80) { doc.addPage(); y = 30; }
    });

    // Signature Area
    y = Math.max(y + 20, ph - 60);
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, y, 85, 40, 'S');
    doc.rect(pw - 100, y, 85, 40, 'S');
    
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('POUR L\'ENTREPRISE', 20, y + 8);
    doc.text('POUR LE CLIENT (BON POUR ACCORD)', pw - 95, y + 8);
    
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text('Fait à ....................................... le .........................', 20, y + 35);
    doc.text('Signature et cachet', 20, y + 20);
    doc.text('Signature du client', pw - 95, y + 20);

    doc.save(`PV_RECEPTION_${selectedOrder.id}_${new Date().getTime()}.pdf`);
    
    // Automatic Email Sending (API Call to Supabase Function)
    if (sendByEmail) {
      if (!recipientEmail || !recipientEmail.includes('@')) {
        alert("Veuillez entrer une adresse email client valide.");
        return;
      }
      
      const sendEmail = async () => {
        try {
          console.log(`[Email Service] Envoi du PV à ${recipientEmail}...`);
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
          
          alert(`📧 PV de Réception envoyé avec succès à ${recipientEmail}`);
        } catch (error) {
          console.error("Erreur envoi email:", error);
          alert("Erreur lors de l'envoi de l'email. Vérifiez la configuration de la fonction Supabase.");
        }
      };

      sendEmail();
    }

    setShowPVModal(false);
  };

  const generateDeliveryNote = (type = 'ALU') => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text(`BON DE LIVRAISON : ${type}`, pw / 2, 20, { align: 'center' });
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, 35);
    doc.text(`Commande N°: ${selectedOrder.id}`, 15, 42);
    doc.text(`Client: ${selectedOrder.clientName || '---'}`, 15, 49);
    doc.line(15, 55, pw - 15, 55);
    let y = 65;
    doc.setFont('helvetica', 'bold');
    doc.text('Qté', 15, y); doc.text('Produit', 30, y); doc.text('Repère', 120, y); doc.text('Statut', 180, y);
    y += 5; doc.line(15, y, pw - 15, y); y += 8;
    doc.setFont('helvetica', 'normal');
    allUnits.forEach(u => {
      const status = type === 'ALU' ? u.statusAlu : u.statusVitrage;
      doc.text('1', 15, y); doc.text(u.label.substring(0, 35), 30, y); doc.text(u.name, 120, y);
      doc.text(status !== 'Produit' ? 'LIVRÉ' : '---', 180, y);
      y += 8; if (y > 270) { doc.addPage(); y = 20; }
    });

    setData(prev => {
      const orders = [...(prev.orders || [])];
      const oIdx = orders.findIndex(o => o.id === selectedOrderId);
      if (oIdx === -1) return prev;
      const order = { ...orders[oIdx] };
      const blDates = { ...(order.blDates || {}) };
      blDates[type] = new Date().toISOString();
      order.blDates = blDates;
      orders[oIdx] = order;
      return { ...prev, orders };
    });

    doc.save(`BL_${type}_${selectedOrder.id}.pdf`);
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
                 <button onClick={() => generateDeliveryNote('ALU')} className="btn btn-primary" style={{ background: '#1e293b' }} disabled={allUnits.length === 0}>BL Alu</button>
                 <button onClick={() => generateDeliveryNote('VITRAGE')} className="btn btn-primary" style={{ background: '#3b82f6' }} disabled={allUnits.length === 0}>BL Vitrage</button>
               </div>
          </div>
        </header>

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

        <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', background: '#f8fafc' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}><Layers size={14} /> SÉLECTION DES LOTS :</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(selectedOrder.batches || []).map(batch => {
              const isActive = selectedBatchIds.has(batch.id);
              return (
                <button key={batch.id} onClick={() => toggleBatchSelection(batch.id)} className="btn" style={{ background: isActive ? '#3b82f6' : 'white', color: isActive ? 'white' : '#64748b', borderColor: isActive ? '#3b82f6' : '#e2e8f0', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isActive ? <CheckCircle size={14} /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #cbd5e1' }} />} Lot : {batch.id}
                </button>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#eff6ff', padding: '0.4rem 1rem', borderRadius: '0.75rem', border: '1px solid #bfdbfe' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>{selectedUnitIds.size} sélectionné(s) :</span>
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
                          <button 
                            onClick={() => setViewingShutter(unit)}
                            className="btn" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', fontWeight: 800 }}
                          >
                            OUI
                          </button>
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
                           <span style={{ padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, background: unit.statusAlu === 'Produit' ? '#f1f5f9' : '#dcfce7', color: unit.statusAlu === 'Produit' ? '#64748b' : '#166534' }}>ALU: {unit.statusAlu}</span>
                           <span style={{ padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, background: unit.statusVitrage === 'Produit' ? '#f1f5f9' : '#dbeafe', color: unit.statusVitrage === 'Produit' ? '#64748b' : '#1e40af' }}>VIT: {unit.statusVitrage}</span>
                         </div>
                       </td>
                       <td>
                         <div style={{ display: 'flex', gap: '0.3rem' }}>
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
                  disabled={pvSelectedFloors.size === 0}
                  className="btn btn-primary" style={{ flex: 2, padding: '1rem', background: '#b45309', border: 'none', boxShadow: '0 4px 12px rgba(180, 83, 9, 0.2)' }}
                >
                  Générer le PDF
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {shippableOrders.map(order => {
          const stats = (order.batches || []).reduce((acc, b) => {
            (b.items || []).forEach(i => acc.total += (i.measurements || []).reduce((s, m) => s + m.qty, 0));
            return acc;
          }, { total: 0 });
          
          const aluDone = Object.values(order.unitStatusesDual || {}).filter(s => s.alu === 'Posé' || s.alu === 'Fini').length;
          const vitDone = Object.values(order.unitStatusesDual || {}).filter(s => s.vitrage === 'Fini').length;
          
          const progressAlu = stats.total > 0 ? (aluDone / stats.total) * 100 : 0;
          const progressVit = stats.total > 0 ? (vitDone / stats.total) * 100 : 0;
          const globalProgress = (progressAlu + progressVit) / 2;

          return (
            <div key={order.id} className="glass shadow-md card-hover" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => { setSelectedOrderId(order.id); setActiveView('details'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', background: '#eff6ff', color: '#3b82f6', borderRadius: '12px', display: 'grid', placeItems: 'center' }}><Truck size={24} /></div>
                <span style={{ padding: '0.3rem 0.75rem', background: globalProgress === 100 ? '#d1fae5' : '#fef3c7', color: globalProgress === 100 ? '#065f46' : '#92400e', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{globalProgress === 100 ? 'PRÊT' : 'EN COURS'}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{order.id} - {order.clientName}</h3>
              
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>
                    <span>POSE ALU</span>
                    <span>{progressAlu.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressAlu}%`, height: '100%', background: '#8b5cf6', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.25rem' }}>
                    <span>VITRAGE / FINI</span>
                    <span>{progressVit.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressVit}%`, height: '100%', background: '#10b981', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
