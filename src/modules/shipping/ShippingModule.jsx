import React, { useState, useMemo } from 'react';
import { Truck, Package, QrCode, CheckCircle, AlertTriangle, XCircle, Download, Search, Plus, Trash2, ArrowLeft, ClipboardCheck, UserCheck, ShieldCheck, Layers, Wrench, FileText, MapPin, Share2, Camera, RefreshCw, MessageSquare, Trash } from 'lucide-react';
import { syncDatabase } from '../../utils/supabaseClient';
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

  const handleUpdateUnitStatusDual = (unitId, component, newStatus, userName = 'ADMIN') => {
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
        status: newStatus
      };

      if (component === 'both') {
        current.alu = newStatus;
        current.vitrage = newStatus;
      } else {
        current[component] = newStatus;
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
      if (unit.shutter === 'Oui') {
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
    
    console.log('[PDF Debug] Order:', selectedOrder.id);
    console.log('[PDF Debug] Timeline Keys:', Object.keys(timeline));
    console.log('[PDF Debug] Photo Keys:', Object.keys(photos));

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
    
    doc.setFillColor(30, 41, 59); doc.rect(0, 0, pw, ph, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.setFont('helvetica', 'bold');
    doc.text('ANALYSE DE PERFORMANCE POSE', pw / 2, ph / 3, { align: 'center' });
    
    const totalUnits = allUnits.length;
    const finishedUnits = allUnits.filter(u => u.statusAlu === 'Fini' && u.statusVitrage === 'Fini').length;
    const progress = totalUnits > 0 ? (finishedUnits / totalUnits) * 100 : 0;
    
    doc.setFontSize(14);
    doc.text(`Avancement : ${progress.toFixed(1)}% | Unités : ${finishedUnits}/${totalUnits}`, pw / 2, ph / 3 + 20, { align: 'center' });
    if (selectedOrder.blDates?.ALU) doc.text(`Date BL Alu : ${new Date(selectedOrder.blDates.ALU).toLocaleDateString()}`, pw/2, ph/3 + 35, {align: 'center'});

    doc.addPage(); doc.setTextColor(30, 41, 59);
    let y = 20; doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('Traçabilité Détaillée A-Z', 15, y);
    doc.setDrawColor(30, 41, 59); doc.line(15, y + 2, 40, y + 2);
    y += 15;

    allUnits.forEach((unit) => {
      const events = timeline[unit.id] || [];
      const photo = photos[unit.id];

      const photoH = photo ? 55 : 0;
      const eventsH = (events.length * 5) + 10;
      const boxH = 15 + eventsH + photoH;

      if (y + boxH > ph - 20) { doc.addPage(); y = 20; }

      doc.setDrawColor(226, 232, 240); 
      doc.setFillColor(252, 253, 255);
      doc.roundedRect(15, y, pw - 30, boxH, 1, 1, 'FD');
      
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
      doc.text(`${unit.name} — ${unit.label}`, 20, y + 8);
      
      let evY = y + 15;
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
      events.forEach(ev => {
        doc.text(`[${new Date(ev.date).toLocaleString('fr-FR')}] ${ev.status} (${ev.component}) — Opérateur: ${ev.user}`, 22, evY);
        evY += 5;
      });

      if (photo) {
        try {
          const fmt = getImgFormat(photo);
          doc.addImage(photo, fmt, 22, evY + 2, 60, 45);
        } catch (e) {
          console.error('jsPDF Performance Report Image Error:', e);
        }
      }
      
      y += boxH + 8;
    });

    doc.save(`Rapport_Performance_${selectedOrder.id}.pdf`);
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
          const loaded = Object.values(order.unitStatuses || {}).filter(s => s === 'Chargé' || s === 'Livré' || s === 'Posé').length;
          const progress = stats.total > 0 ? (loaded / stats.total) * 100 : 0;
          return (
            <div key={order.id} className="glass shadow-md card-hover" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => { setSelectedOrderId(order.id); setActiveView('details'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', background: '#eff6ff', color: '#3b82f6', borderRadius: '12px', display: 'grid', placeItems: 'center' }}><Truck size={24} /></div>
                <span style={{ padding: '0.3rem 0.75rem', background: progress === 100 ? '#d1fae5' : '#fef3c7', color: progress === 100 ? '#065f46' : '#92400e', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{progress === 100 ? 'PRÊT' : 'EN COURS'}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{order.id} - {order.clientName}</h3>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginTop: '1rem' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#10b981' : '#3b82f6', transition: 'width 0.4s ease' }}></div>
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
