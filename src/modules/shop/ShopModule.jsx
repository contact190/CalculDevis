import React, { useState, useEffect } from 'react';
import { Store, Plus, Edit2, Trash2, FileText, Search, Save, X, ExternalLink, Printer, Pin, PinOff } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const compressImage = (base64Str, callback) => {
  const img = new Image();
  img.src = base64Str;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const MAX_WIDTH = 200;
    const MAX_HEIGHT = 200;
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
    } else {
      if (height > MAX_HEIGHT) {
        width = Math.round((width * MAX_HEIGHT) / height);
        height = MAX_HEIGHT;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    callback(canvas.toDataURL('image/jpeg', 0.8));
  };
};

const ShopModule = ({ database, setDatabase, quoteSettings, selectedQuote, onClearSelectedQuote }) => {
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'quotes', or 'viewQuote'
  const [editingProduct, setEditingProduct] = useState(null);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [viewingQuote, setViewingQuote] = useState(null);
  
  // Quote Creation State
  const [quoteClient, setQuoteClient] = useState('');
  const [quoteItems, setQuoteItems] = useState([]);
  const [currentCategory, setCurrentCategory] = useState('');
  const [quoteValidity, setQuoteValidity] = useState(quoteSettings.validityDays || 30);
  const [quoteTva, setQuoteTva] = useState(quoteSettings.tvaRate || 9);
  const [quoteRemise, setQuoteRemise] = useState(0);
  
  let counter = quoteSettings.quoteCounter || 1;
  if (database && database.quotes) {
    const prefix = quoteSettings.quotePrefix || 'DEV-';
    for (const q of database.quotes) {
      if (q.number && q.number.startsWith(prefix)) {
        const numPart = q.number.substring(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed >= counter) {
          counter = parsed + 1;
        }
      }
    }
  }
  const currentQuoteNumber = `${quoteSettings.quotePrefix || 'DEV-'}${String(counter).padStart(3, '0')}`;

  // Add item form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [customH, setCustomH] = useState('');
  const [customL, setCustomL] = useState('');
  const [customM2, setCustomM2] = useState('');
  const [isM2Direct, setIsM2Direct] = useState(false);
  const [selectedGlassId, setSelectedGlassId] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('');
  const [isHEnabled, setIsHEnabled] = useState(false);
  const [isLEnabled, setIsLEnabled] = useState(false);

  useEffect(() => {
    const p = (database.shopProducts || []).find(x => x.id === selectedProductId);
    if (p) {
      if (p.unit === 'm2') {
        setIsHEnabled(true);
        setIsLEnabled(true);
        setIsM2Direct(false);
      } else if (p.unit === 'm') {
        setIsHEnabled(true);
        setIsLEnabled(true);
        setIsM2Direct(false);
      } else {
        setIsHEnabled(false);
        setIsLEnabled(false);
        setIsM2Direct(false);
      }
      setCustomH('');
      setCustomL('');
      setCustomM2('');
    }
  }, [selectedProductId]);

  const shopProducts = database.shopProducts || [];
  const categories = [...new Set(shopProducts.map(p => p.categorie).filter(Boolean))];

  // When a quote is selected from Clients module, switch to detail view
  useEffect(() => {
    if (selectedQuote && selectedQuote.type === 'shop') {
      setViewingQuote(selectedQuote);
      setActiveTab('viewQuote');
    }
  }, [selectedQuote]);

  const handleAddProduct = () => {
    setIsNewCategory(false);
    setEditingProduct({
      id: `PROD-${Date.now()}`,
      nom: '',
      designation: '',
      image: '',
      categorie: '',
      driveLink: '',
      prix: 0,
      hasGlazing: false,
      glazingFormula: '',
      hasColor: false,
      unit: 'unité' // 'unité', 'm2', 'm'
    });
  };

  const handleSaveProduct = () => {
    if (!editingProduct.nom || !editingProduct.categorie) {
      alert("Le nom et la catégorie sont obligatoires.");
      return;
    }
    
    setDatabase(prev => {
      const prods = prev.shopProducts || [];
      const exists = prods.find(p => p.id === editingProduct.id);
      let newProds;
      if (exists) {
        newProds = prods.map(p => p.id === editingProduct.id ? editingProduct : p);
      } else {
        newProds = [...prods, editingProduct];
      }
      return { ...prev, shopProducts: newProds };
    });
    setEditingProduct(null);
  };

  const handleDeleteProduct = (id) => {
    if (window.confirm('Supprimer ce produit ?')) {
      setDatabase(prev => ({
        ...prev,
        shopProducts: (prev.shopProducts || []).filter(p => p.id !== id)
      }));
    }
  };

  const calculateItemPrice = (product, h, l, q, glassId, colorId, m2) => {
    let basePrice = Number(product.prix) || 0;
    
    // Unité multiplier
    let quantityMultiplier = 1;
    let actualArea = 0;
    if (product.unit === 'm2') {
      actualArea = (m2 !== undefined && m2 !== null) ? Number(m2) : (((Number(h)||0) / 1000) * ((Number(l)||0) / 1000));
      quantityMultiplier = actualArea * Number(q);
    } else if (product.unit === 'm') {
      const length = (Number(l) || Number(h) || 0) / 1000;
      quantityMultiplier = length * Number(q);
    } else {
      quantityMultiplier = Number(q);
    }
    
    let totalBase = basePrice * quantityMultiplier;

    // Vitrage addition
    if (product.hasGlazing && glassId) {
      const glass = (database.glass || []).find(g => g.id === glassId);
      if (glass) {
        let glassArea = 0;
        try {
          if (product.glazingFormula) {
            const formula = product.glazingFormula.replace(/H/g, h).replace(/L/g, l);
            // eslint-disable-next-line no-new-func
            const fn = new Function('return (' + formula + ')');
            glassArea = fn() / 1000000; // convert mm2 to m2
          } else {
             glassArea = product.unit === 'm2' ? actualArea : (((Number(h)||0) / 1000) * ((Number(l)||0) / 1000));
          }
        } catch (e) {
          console.warn("Erreur formule vitrage", e);
        }
        totalBase += (glass.pricePerM2 || 0) * glassArea * Number(q);
      }
    }

    // Color multiplier (factor)
    if (product.hasColor && colorId) {
      const color = (database.colors || []).find(c => c.id === colorId);
      if (color && color.factor) {
        totalBase *= Number(color.factor);
      }
    }

    return totalBase;
  };

  const handleAddItemToQuote = () => {
    const product = shopProducts.find(p => p.id === selectedProductId);
    if (!product) return;
    
    const h = isHEnabled ? (Number(customH) || 0) : 0;
    const l = isLEnabled ? (Number(customL) || 0) : 0;
    const q = Number(qty) || 1;
    const m2Val = isM2Direct ? (Number(customM2) || 0) : null;
    
    const price = calculateItemPrice(product, h, l, q, selectedGlassId, selectedColorId, m2Val);
    
    const newItem = {
      id: `QUOTE-ITEM-${Date.now()}`,
      productId: product.id,
      nom: product.nom,
      designation: product.designation,
      unit: product.unit,
      h, l, qty: q,
      m2: m2Val,
      glassId: selectedGlassId,
      colorId: selectedColorId,
      totalHT: price,
      image: product.image
    };
    
    setQuoteItems([...quoteItems, newItem]);
    
    // Reset form
    setSelectedProductId('');
    setQty(1);
    setCustomH('');
    setCustomL('');
    setCustomM2('');
    setSelectedGlassId('');
    setSelectedColorId('');
  };

  const removeQuoteItem = (id) => {
    setQuoteItems(items => items.filter(i => i.id !== id));
  };

  const generatePDF = (quoteNumber, client, items, totalHT, tva, totalTTC, tvaRate, totalHTBrut = 0, remiseAmount = 0) => {
    const doc = new jsPDF({ format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Helper for reliable number formatting
    const formatPrice = (val) => Number(val || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    // ----- HEADER SECTION -----
    // Left: Logo
    if (quoteSettings?.logoBase64) {
      try {
        const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
        const maxW = 60;
        const maxH = 25;
        const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
        doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
      } catch (e) {
        try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 60, 25, '', 'FAST'); } catch(e2) {}
      }
    }
    
    // Top Right: Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('DEVIS ESTIMATIF', pw - 15, y + 15, { align: 'right' });
    
    // Gauche: Devis number and date
    y += 35;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const quoteYear = new Date().getFullYear().toString().slice(-2);
    doc.text(`Devis N° : ${quoteNumber} / ${quoteYear}`, 15, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 15, y + 5);
    
    y += 8;
    
    const boxY = y;
    const boxWidth = (pw - 35) / 2; // 15 margin L/R, 5 gap = 35
    
    const companyNameLines = doc.splitTextToSize(quoteSettings?.companyName || 'Mon Entreprise', boxWidth - 6);
    const clientNameLines = doc.splitTextToSize(client?.nom || 'Client', boxWidth - 6);

    let tempCyLeft = boxY + 6 + (companyNameLines.length * 4) + 1;
    if (quoteSettings?.companyAddress) {
      tempCyLeft += doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6).length * 4;
    }
    const phone = quoteSettings?.companyPhone || '';
    const email = quoteSettings?.companyEmail || '';
    if (phone || email) tempCyLeft += 5;
    if (quoteSettings?.companyRC) tempCyLeft += 4;
    if (quoteSettings?.companyIMP) tempCyLeft += 4;
    if (quoteSettings?.companyMF) tempCyLeft += 4;

    let tempCyRight = boxY + 11 + (clientNameLines.length * 4) + 1;
    if (client?.adresse) {
      tempCyRight += doc.splitTextToSize(client.adresse, boxWidth - 6).length * 4;
    }
    if (client?.telephone) tempCyRight += 4;
    if (client?.email) tempCyRight += 5;
    if (client?.rc) tempCyRight += 4;
    if (client?.nif) tempCyRight += 4;
    if (client?.nis) tempCyRight += 4;
    if (client?.ai) tempCyRight += 4;

    const boxHeight = Math.max(tempCyLeft - boxY + 4, tempCyRight - boxY + 4, 42);

    // Company box (Left)
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.roundedRect(15, boxY, boxWidth, boxHeight, 2, 2);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(companyNameLines, 18, boxY + 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cy = boxY + 6 + (companyNameLines.length * 4) + 1;
    if (quoteSettings?.companyAddress) {
      const addressLines = doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6);
      doc.text(addressLines, 18, cy);
      cy += addressLines.length * 4;
    }
    if (phone || email) {
      doc.text(`${phone} ${email ? ' - ' + email : ''}`, 18, cy);
      cy += 5;
    }
    doc.setTextColor(80, 80, 80);
    if (quoteSettings?.companyRC) { doc.text(`RC N°: ${quoteSettings.companyRC}`, 18, cy); cy += 4; }
    if (quoteSettings?.companyIMP) { doc.text(`AI N°: ${quoteSettings.companyIMP}`, 18, cy); cy += 4; }
    if (quoteSettings?.companyMF) { doc.text(`NIF N°: ${quoteSettings.companyMF}`, 18, cy); cy += 4; }
    doc.setTextColor(0, 0, 0);

    // Client box (Right)
    const rightBoxXHeader = 15 + boxWidth + 5;
    doc.roundedRect(rightBoxXHeader, boxY, boxWidth, boxHeight, 2, 2);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Destinataire :', rightBoxXHeader + 3, boxY + 6);
    doc.setFontSize(10);
    doc.text(clientNameLines, rightBoxXHeader + 3, boxY + 11);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cly = boxY + 11 + (clientNameLines.length * 4) + 1;
    if (client?.adresse) {
      const addrLines = doc.splitTextToSize(client.adresse, boxWidth - 6);
      doc.text(addrLines, rightBoxXHeader + 3, cly);
      cly += addrLines.length * 4;
    }
    if (client?.telephone) {
      doc.text(`Tél : ${client.telephone}`, rightBoxXHeader + 3, cly);
      cly += 4;
    }
    if (client?.email) {
      doc.text(`Email : ${client.email}`, rightBoxXHeader + 3, cly);
      cly += 5;
    }
    doc.setTextColor(80, 80, 80);
    if (client?.rc) { doc.text(`RC : ${client.rc}`, rightBoxXHeader + 3, cly); cly += 4; }
    if (client?.nif) { doc.text(`NIF : ${client.nif}`, rightBoxXHeader + 3, cly); cly += 4; }
    if (client?.nis) { doc.text(`NIS : ${client.nis}`, rightBoxXHeader + 3, cly); cly += 4; }
    if (client?.ai) { doc.text(`AI : ${client.ai}`, rightBoxXHeader + 3, cly); cly += 4; }
    doc.setTextColor(0, 0, 0);

    y = boxY + boxHeight + 6;

    // --- TABLEAU ---
    const tableColumn = ["Image", "Désignation", "Dim. / Options", "Quantité (m²/ml)", "Pièces", "P.U. HT", "Total HT"];
    const tableRows = [];

    items.forEach(item => {
      const dims = (item.m2 !== undefined && item.m2 !== null) ? `${item.m2} m²` : ((item.l || item.h) ? `${item.l} x ${item.h} mm` : '');
      let optStr = '';
      if (item.glassId) {
        const g = (database.glass||[]).find(x=>x.id===item.glassId);
        if(g) optStr += g.name + ' ';
      }
      if (item.colorId) {
        const c = (database.colors||[]).find(x=>x.id===item.colorId);
        if(c) optStr += c.name;
      }
      const descLine2 = [dims, optStr].filter(Boolean).join(' | ');
      
      let totalMeasurementQty = item.qty;
      let measureUnit = item.unit === 'unité' ? 'U' : item.unit;
      
      if (item.unit === 'm2') {
         totalMeasurementQty = (item.m2 !== undefined && item.m2 !== null) ? (item.m2 * item.qty) : (((item.h || 0) / 1000) * ((item.l || 0) / 1000) * item.qty);
      } else if (item.unit === 'm') {
         totalMeasurementQty = ((item.l || item.h || 0) / 1000) * item.qty;
      }
      
      const puHT = (totalMeasurementQty > 0) ? (item.totalHT / totalMeasurementQty) : item.totalHT;
      
      const rowData = [
        "", // Image placeholder
        `${item.nom}\n${item.designation || ''}`,
        descLine2 || '-',
        item.unit === 'unité' ? '-' : `${totalMeasurementQty.toFixed(2)} ${measureUnit}`,
        `${item.qty} pces`,
        `${formatPrice(puHT)} DZD`,
        `${formatPrice(item.totalHT)} DZD`
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      startY: y,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0], minCellHeight: 18 },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 45 },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const item = items[data.row.index];
          const prod = (database.shopProducts || []).find(p => p.id === item?.productId);
          const imageToShow = item?.image || prod?.image;
          if (imageToShow) {
            try {
              const match = imageToShow.match(/^data:image\/([a-zA-Z+]+);base64,/);
              let format = match ? match[1].toUpperCase() : 'JPEG';
              if (format === 'JPG') format = 'JPEG';
              
              const x = data.cell.x + 2;
              const yPos = data.cell.y + 2;
              const w = data.cell.width - 4;
              const h = data.cell.height - 4;
              data.doc.addImage(imageToShow, format, x, yPos, w, h);
            } catch (e) {
              console.warn('Could not draw image in shop quote PDF:', e);
            }
          }
        }
      }
    });

    let finalY = (doc.lastAutoTable?.finalY || doc.previousAutoTable?.finalY || y + 20) + 10;
    if (finalY > 220) {
      doc.addPage();
      finalY = 20;
    }

    // ----- TOTALS & FOOTER -----
    // Left Box: Signatures
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, finalY, 90, 30, 3, 3);
    doc.line(60, finalY, 60, finalY+30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Commercial', 37, finalY + 6, { align: 'center' });
    doc.text('Client', 82, finalY + 6, { align: 'center' });

    // Right Box: Totals
    const rightBoxX = 110;
    let totalsBoxHeight = 22;
    if (remiseAmount > 0) totalsBoxHeight += 14;

    doc.roundedRect(rightBoxX, finalY, pw - 15 - rightBoxX, totalsBoxHeight, 3, 3);
    const effectiveTvaRate = tvaRate !== undefined ? tvaRate : (quoteSettings?.tvaRate ?? 9);
    
    let currentTotalY = finalY + 9;
    if (remiseAmount > 0) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('MONTANT BRUT', rightBoxX + 5, currentTotalY);
      doc.text(`${formatPrice(totalHTBrut)} DZD`, pw - 20, currentTotalY, { align: 'right' });
      
      currentTotalY += 7;
      doc.text('REMISE', rightBoxX + 5, currentTotalY);
      doc.text(`- ${formatPrice(remiseAmount)} DZD`, pw - 20, currentTotalY, { align: 'right' });

      currentTotalY += 7;
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('MONTANT TOTAL HT', rightBoxX + 5, currentTotalY);
    doc.text(`${formatPrice(totalHT)} DZD`, pw - 20, currentTotalY, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`TVA ${effectiveTvaRate}% :`, rightBoxX + 5, currentTotalY + 7);
    doc.text(`${formatPrice(tva)} DZD`, pw - 20, currentTotalY + 7, { align: 'right' });

    finalY += totalsBoxHeight + 15;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`NET À PAYER TTC : ${formatPrice(totalTTC)} DZD`, pw - 15, finalY, { align: 'right' });

    finalY += 15;
    
    // Amount text in words
    const numberToFrenchWords = (num) => {
      if (!num || num === 0) return 'Zéro dinars';
      const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
      const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
      const convertLT1000 = (n) => {
        if (n === 0) return '';
        let res = '';
        if (n >= 100) {
            const h = Math.floor(n / 100);
            res += (h === 1 ? 'cent' : units[h] + ' cent') + (n % 100 === 0 && h > 1 ? 's' : '') + ' ';
            n %= 100;
        }
        if (n > 0) {
            if (n < 20) {
                res += units[n] + ' ';
            } else {
                const t = Math.floor(n / 10);
                const u = n % 10;
                if (t === 7 || t === 9) {
                    res += tens[t - 1] + (u===1 ? '-et-' : '-') + units[10 + u] + ' ';
                } else {
                    res += tens[t] + (u===1 && t<8 ? '-et-un' : (u>0 ? '-' + units[u] : '')) + ' ';
                }
            }
        }
        return res;
      };
      const convert = (n) => {
        if (n === 0) return 'zéro';
        let res = '';
        if (n >= 1000000) {
            const m = Math.floor(n / 1000000);
            res += convertLT1000(m) + 'million' + (m > 1 ? 's ' : ' ');
            n %= 1000000;
        }
        if (n >= 1000) {
            const th = Math.floor(n / 1000);
            res += (th === 1 ? 'mille ' : convertLT1000(th) + 'mille ');
            n %= 1000;
        }
        if (n > 0) res += convertLT1000(n);
        return res.trim();
      };
      const intPart = Math.floor(num);
      const decPart = Math.round((num - intPart) * 100);
      let text = convert(intPart) + ' dinars';
      if (decPart > 0) text += ' et ' + convert(decPart) + ' centimes';
      return text.charAt(0).toUpperCase() + text.slice(1);
    };

    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const totalAmountText = `Arrêté le présent devis à la somme de : ${numberToFrenchWords(totalTTC)}.`;
    const totalAmountLines = doc.splitTextToSize(totalAmountText, pw - 30);
    doc.text(totalAmountLines, 15, finalY);
    
    finalY += totalAmountLines.length * 5 + 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Validité de l'offre : ${quoteValidity || 30} jours`, 15, finalY);

    // --- PIED DE PAGE ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.text(quoteSettings?.footerText || '', pw / 2, footerY, { align: "center" });

    doc.save(`Devis_Shop_${quoteNumber}.pdf`);
  };

  const handleSaveQuote = () => {
    if (!quoteClient || quoteItems.length === 0) {
      alert("Veuillez sélectionner un client et ajouter au moins un produit.");
      return;
    }
    
    const client = (database.clients || []).find(c => c.id === quoteClient);
    const quoteNumber = currentQuoteNumber;
    
    const tvaRateNum = Number(quoteTva);
    const totalHTBrut = quoteItems.reduce((sum, item) => sum + item.totalHT, 0);
    const remiseAmount = Number(quoteRemise) || 0;
    const totalHT = Math.max(0, totalHTBrut - remiseAmount);
    const tva = totalHT * (tvaRateNum / 100);
    const totalTTC = totalHT + tva;
    
    const newQuote = {
      id: `QUOTE-SHOP-${Date.now()}`,
      number: quoteNumber,
      clientId: quoteClient,
      createdAt: new Date().toISOString(),
      type: 'shop',
      items: quoteItems.map(item => ({
        ...item,
      })),
      totals: {
        htBrut: totalHTBrut,
        remise: remiseAmount,
        ht: totalHT,
        tva: tva,
        ttc: totalTTC
      },
      tvaRate: tvaRateNum,
      status: 'Brouillon'
    };

    setDatabase(prev => ({
      ...prev,
      quotes: [...(prev.quotes || []), newQuote]
    }));
    
    // Optionally update quote settings counter here, though usually done globally.
    
    alert(`Devis Shop ${quoteNumber} enregistré avec succès !`);
    
    setQuoteClient('');
    setQuoteItems([]);
    setQuoteRemise(0);
  };

  const handleExportPDF = () => {
    if (!quoteClient || quoteItems.length === 0) {
      alert("Veuillez sélectionner un client et ajouter au moins un produit.");
      return;
    }
    const client = (database.clients || []).find(c => c.id === quoteClient);
    const tvaRateNum = Number(quoteTva);
    const totalHTBrut = quoteItems.reduce((sum, item) => sum + item.totalHT, 0);
    const remiseAmount = Number(quoteRemise) || 0;
    const totalHT = Math.max(0, totalHTBrut - remiseAmount);
    const tva = totalHT * (tvaRateNum / 100);
    const totalTTC = totalHT + tva;
    
    generatePDF(currentQuoteNumber, client, quoteItems, totalHT, tva, totalTTC, tvaRateNum, totalHTBrut, remiseAmount);
  };

  const handleExportExistingQuotePDF = (quote) => {
    if (!quote) return;
    const client = (database.clients || []).find(c => c.id === quote.clientId);
    if (!client) {
      alert("Client introuvable.");
      return;
    }
    const totalHTBrut = quote.totals?.htBrut || quote.totals?.ht || 0;
    const remiseAmount = quote.totals?.remise || 0;
    const totalHT = quote.totals?.ht || 0;
    const tva = quote.totals?.tva || 0;
    const totalTTC = quote.totals?.ttc || 0;
    const tvaRateToUse = quote.tvaRate !== undefined ? quote.tvaRate : (quoteSettings?.tvaRate ?? 9);
    generatePDF(quote.number, client, quote.items || [], totalHT, tva, totalTTC, tvaRateToUse, totalHTBrut, remiseAmount);
  };


  return (
    <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <header className="flex-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Store size={28} color="#3b82f6" />
            Boutique & Produits
          </h1>
          <p style={{ color: '#64748b' }}>Gérez vos produits annexes et créez des devis rapides.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '0.75rem' }}>
          <button 
            className={`btn ${activeTab === 'products' ? 'btn-primary' : ''}`}
            onClick={() => { setActiveTab('products'); setViewingQuote(null); if(onClearSelectedQuote) onClearSelectedQuote(); }}
            style={{ padding: '0.5rem 1rem', border: 'none', background: activeTab === 'products' ? '#3b82f6' : 'transparent', color: activeTab === 'products' ? 'white' : '#64748b', fontWeight: 600, boxShadow: activeTab === 'products' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none' }}
          >
            Produits
          </button>
          <button 
            className={`btn ${activeTab === 'quotes' ? 'btn-primary' : ''}`}
            onClick={() => { setActiveTab('quotes'); setViewingQuote(null); if(onClearSelectedQuote) onClearSelectedQuote(); }}
            style={{ padding: '0.5rem 1rem', border: 'none', background: activeTab === 'quotes' ? '#3b82f6' : 'transparent', color: activeTab === 'quotes' ? 'white' : '#64748b', fontWeight: 600, boxShadow: activeTab === 'quotes' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none' }}
          >
            Créer Devis
          </button>
          {viewingQuote && (
            <button 
              className={`btn ${activeTab === 'viewQuote' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('viewQuote')}
              style={{ padding: '0.5rem 1rem', border: 'none', background: activeTab === 'viewQuote' ? '#3b82f6' : 'transparent', color: activeTab === 'viewQuote' ? 'white' : '#64748b', fontWeight: 600, boxShadow: activeTab === 'viewQuote' ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)' : 'none' }}
            >
              Détails Devis
            </button>
          )}
        </div>
      </header>

      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button className="btn btn-primary" onClick={handleAddProduct} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Nouveau Produit
            </button>
          </div>

          {editingProduct && (
            <div className="glass shadow-lg" style={{ marginBottom: '2rem', padding: '1.5rem', border: '2px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{editingProduct.nom ? 'Modifier le Produit' : 'Nouveau Produit'}</h2>
                <button className="btn" onClick={() => setEditingProduct(null)}><X size={18} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                     <label className="label">Nom du produit *</label>
                     <input className="input" value={editingProduct.nom} onChange={e => setEditingProduct({...editingProduct, nom: e.target.value})} />
                  </div>
                  <div className="form-group">
                     <label className="label">Catégorie *</label>
                     {!isNewCategory ? (
                       <select 
                         className="input" 
                         value={categories.includes(editingProduct.categorie) ? editingProduct.categorie : (editingProduct.categorie ? '__NEW__' : '')} 
                         onChange={e => {
                           if (e.target.value === '__NEW__') {
                             setIsNewCategory(true);
                             setEditingProduct({...editingProduct, categorie: ''});
                           } else {
                             setEditingProduct({...editingProduct, categorie: e.target.value});
                           }
                         }}
                       >
                         <option value="">-- Sélectionner --</option>
                         {categories.map(c => <option key={c} value={c}>{c}</option>)}
                         <option value="__NEW__" style={{ fontWeight: 'bold', color: '#3b82f6' }}>+ Nouvelle Catégorie...</option>
                       </select>
                     ) : (
                       <div style={{ display: 'flex', gap: '0.5rem' }}>
                         <input 
                           className="input" 
                           placeholder="Nom de la nouvelle catégorie" 
                           value={editingProduct.categorie} 
                           onChange={e => setEditingProduct({...editingProduct, categorie: e.target.value})} 
                           autoFocus
                         />
                         <button 
                           className="btn" 
                           type="button" 
                           onClick={() => {
                             setIsNewCategory(false);
                             setEditingProduct({...editingProduct, categorie: ''});
                           }}
                           title="Annuler"
                         >
                           <X size={16} />
                         </button>
                       </div>
                     )}
                  </div>
                  <div className="form-group">
                     <label className="label">Image</label>
                     <input 
                       type="file" 
                       accept="image/*"
                       className="input" 
                       onChange={e => {
                         const file = e.target.files[0];
                         if (file) {
                           const reader = new FileReader();
                           reader.onload = (event) => {
                             compressImage(event.target.result, (compressed) => {
                               setEditingProduct({...editingProduct, image: compressed});
                             });
                           };
                           reader.readAsDataURL(file);
                         }
                       }} 
                     />
                     {editingProduct.image && (
                       <div style={{ marginTop: '0.5rem' }}>
                         <img src={editingProduct.image} alt="Aperçu" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                       </div>
                     )}
                  </div>
                  <div className="form-group">
                     <label className="label">Désignation (description sur le devis)</label>
                     <textarea className="input" rows={2} value={editingProduct.designation} onChange={e => setEditingProduct({...editingProduct, designation: e.target.value})} />
                  </div>
                  <div className="form-group">
                     <label className="label">Lien Drive Fiche Technique</label>
                     <input className="input" value={editingProduct.driveLink} onChange={e => setEditingProduct({...editingProduct, driveLink: e.target.value})} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                       <label className="label">Prix de base (DZD)</label>
                       <input type="number" className="input" value={editingProduct.prix} onChange={e => setEditingProduct({...editingProduct, prix: Number(e.target.value)})} />
                    </div>
                    <div className="form-group">
                       <label className="label">Unité de vente</label>
                       <select className="input" value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})}>
                         <option value="unité">Pièce / Unité</option>
                         <option value="m2">Mètre Carré (m²)</option>
                         <option value="m">Mètre Linéaire (ml)</option>
                       </select>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569', margin: 0 }}>Options Paramétrables (Devis)</h3>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <input type="checkbox" checked={editingProduct.hasColor} onChange={e => setEditingProduct({...editingProduct, hasColor: e.target.checked})} />
                      Activer le choix de couleur (applique le facteur multiplicateur de la couleur)
                    </label>

                    <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        <input type="checkbox" checked={editingProduct.hasGlazing} onChange={e => setEditingProduct({...editingProduct, hasGlazing: e.target.checked})} />
                        Activer le calcul de vitrage
                      </label>
                      {editingProduct.hasGlazing && (
                        <div className="form-group">
                          <label className="label">Formule de surface de vitrage (mm²) - <i>Optionnel</i></label>
                          <input className="input" placeholder="ex: (H - 120) * (L - 80)" value={editingProduct.glazingFormula} onChange={e => setEditingProduct({...editingProduct, glazingFormula: e.target.value})} />
                          <small style={{ color: '#64748b', marginTop: '0.25rem' }}>Laisser vide pour utiliser simplement H × L.</small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <button className="btn" onClick={() => setEditingProduct(null)}>Annuler</button>
                <button className="btn btn-primary" onClick={handleSaveProduct} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981' }}>
                  <Save size={16} /> Enregistrer Produit
                </button>
              </div>
            </div>
          )}

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Nom du Produit</th>
                  <th>Catégorie</th>
                  <th>Prix de base</th>
                  <th>Unité</th>
                  <th>Options activées</th>
                  <th>Drive</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shopProducts.map(prod => (
                  <tr key={prod.id}>
                    <td data-label="Image">
                      {prod.image ? <img src={prod.image} alt={prod.nom} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px' }} /> : <div style={{ width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#94a3b8' }}>N/A</div>}
                    </td>
                    <td data-label="Nom" style={{ fontWeight: 600 }}>{prod.nom}</td>
                    <td data-label="Catégorie">{prod.categorie}</td>
                    <td data-label="Prix" style={{ fontWeight: 600, color: '#3b82f6' }}>{prod.prix} DZD</td>
                    <td data-label="Unité">{prod.unit}</td>
                    <td data-label="Options">
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {prod.hasColor && <span style={{ padding: '0.2rem 0.4rem', background: '#fdf4ff', color: '#c026d3', fontSize: '0.7rem', borderRadius: '4px', fontWeight: 600 }}>Couleur</span>}
                        {prod.hasGlazing && <span style={{ padding: '0.2rem 0.4rem', background: '#f0fdf4', color: '#16a34a', fontSize: '0.7rem', borderRadius: '4px', fontWeight: 600 }}>Vitrage</span>}
                        {!prod.hasColor && !prod.hasGlazing && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Aucune</span>}
                      </div>
                    </td>
                    <td data-label="Drive">
                      {prod.driveLink ? <a href={prod.driveLink} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}><ExternalLink size={16} /></a> : '-'}
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button className="btn" style={{ padding: '0.4rem' }} onClick={() => { setEditingProduct(prod); setIsNewCategory(false); }}><Edit2 size={16} /></button>
                        <button className="btn" style={{ padding: '0.4rem', color: '#ef4444' }} onClick={() => handleDeleteProduct(prod.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shopProducts.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Aucun produit configuré. Créez-en un nouveau !
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'quotes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
          
          {/* Panneau latéral : Configuration du devis */}
          <div className="glass shadow-lg" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Nouveau Devis</h2>
            
            <div className="form-group">
              <label className="label">Client *</label>
              <select className="input" value={quoteClient} onChange={e => setQuoteClient(e.target.value)}>
                <option value="">-- Sélectionner --</option>
                {(database.clients || []).map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Durée de validité (jours)</label>
              <input type="number" className="input" value={quoteValidity} onChange={e => setQuoteValidity(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="label">TVA (%)</label>
              <select className="input" value={quoteTva} onChange={e => setQuoteTva(e.target.value)}>
                <option value="0">0%</option>
                <option value="9">9%</option>
                <option value="19">19%</option>
              </select>
            </div>

            <div className="form-group">
              <label className="label">Remise (DZD)</label>
              <input type="number" min="0" className="input" value={quoteRemise} onChange={e => setQuoteRemise(e.target.value)} placeholder="0" />
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#3b82f6', marginBottom: '1rem' }}>Ajouter un Produit</h3>
              
              <div className="form-group">
                <label className="label">Catégorie</label>
                <select className="input" value={currentCategory} onChange={e => { setCurrentCategory(e.target.value); setSelectedProductId(''); }}>
                  <option value="">Toutes les catégories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Produit *</label>
                <select className="input" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                  <option value="">-- Sélectionner Produit --</option>
                  {shopProducts.filter(p => !currentCategory || p.categorie === currentCategory).map(p => (
                    <option key={p.id} value={p.id}>{p.nom} ({p.prix} DZD)</option>
                  ))}
                </select>
              </div>

              {selectedProductId && (() => {
                const p = shopProducts.find(x => x.id === selectedProductId);
                if(!p) return null;
                return (
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {p.unit === 'm2' && (
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input type="radio" checked={!isM2Direct} onChange={() => setIsM2Direct(false)} />
                          Saisir H et L (mm)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input type="radio" checked={isM2Direct} onChange={() => setIsM2Direct(true)} />
                          Saisir la surface (m²)
                        </label>
                      </div>
                    )}

                    {!isM2Direct ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ opacity: isHEnabled ? 1 : 0.6 }}>
                          <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Hauteur (H) mm
                            <button 
                              type="button" 
                              onClick={() => {
                                if (p.unit === 'm2') { alert("La hauteur est indispensable pour le calcul au m²."); return; }
                                if (p.unit === 'm' && isHEnabled && !isLEnabled) { alert("Pour l'unité mètre linéaire, au moins H ou L doit être activé."); return; }
                                setIsHEnabled(!isHEnabled);
                                if (isHEnabled) setCustomH('');
                              }}
                              title={isHEnabled ? "Désactiver la hauteur" : "Activer la hauteur"}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isHEnabled ? '#3b82f6' : '#94a3b8', padding: '0.2rem' }}
                            >
                              {isHEnabled ? <Pin size={16} /> : <PinOff size={16} />}
                            </button>
                          </label>
                          <input type="number" className="input" placeholder="ex: 1200" value={customH} onChange={e => setCustomH(e.target.value)} disabled={!isHEnabled} />
                        </div>
                        <div className="form-group" style={{ opacity: isLEnabled ? 1 : 0.6 }}>
                          <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Largeur (L) mm
                            <button 
                              type="button" 
                              onClick={() => {
                                if (p.unit === 'm2') { alert("La largeur est indispensable pour le calcul au m²."); return; }
                                if (p.unit === 'm' && isLEnabled && !isHEnabled) { alert("Pour l'unité mètre linéaire, au moins H ou L doit être activé."); return; }
                                setIsLEnabled(!isLEnabled);
                                if (isLEnabled) setCustomL('');
                              }}
                              title={isLEnabled ? "Désactiver la largeur" : "Activer la largeur"}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLEnabled ? '#3b82f6' : '#94a3b8', padding: '0.2rem' }}
                            >
                              {isLEnabled ? <Pin size={16} /> : <PinOff size={16} />}
                            </button>
                          </label>
                          <input type="number" className="input" placeholder="ex: 1000" value={customL} onChange={e => setCustomL(e.target.value)} disabled={!isLEnabled} />
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="label">Surface (m²)</label>
                        <input type="number" className="input" placeholder="ex: 2.5" value={customM2} onChange={e => setCustomM2(e.target.value)} />
                      </div>
                    )}

                    {p.hasGlazing && (
                      <div className="form-group">
                        <label className="label">Choix du Vitrage</label>
                        <select className="input" value={selectedGlassId} onChange={e => setSelectedGlassId(e.target.value)}>
                           <option value="">-- Aucun --</option>
                           {(database.glass || []).map(g => (
                             <option key={g.id} value={g.id}>{g.name} ({g.pricePerM2} DZD/m²)</option>
                           ))}
                        </select>
                      </div>
                    )}
                    
                    {p.hasColor && (
                      <div className="form-group">
                        <label className="label">Choix de la Couleur</label>
                        <select className="input" value={selectedColorId} onChange={e => setSelectedColorId(e.target.value)}>
                           <option value="">-- Standard --</option>
                           {(database.colors || []).map(c => (
                             <option key={c.id} value={c.id}>{c.name} (Facteur: {c.factor})</option>
                           ))}
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="label">Quantité (Nbr de pièces)</label>
                      <input type="number" min="1" className="input" value={qty} onChange={e => setQty(e.target.value)} />
                    </div>

                    <button className="btn btn-primary" onClick={handleAddItemToQuote} style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Plus size={16} /> Ajouter au devis
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Panneau Central : Contenu du Devis */}
          <div className="glass shadow-lg" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Aperçu du Devis : {currentQuoteNumber}</h2>
                <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>Client : {(database.clients || []).find(c => c.id === quoteClient)?.nom || 'Non sélectionné'}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn" 
                  onClick={handleExportPDF}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.75rem 1.5rem', fontSize: '1rem', opacity: (quoteItems.length === 0 || !quoteClient) ? 0.6 : 1 }}
                >
                  <FileText size={18} /> Exporter PDF
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSaveQuote}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', padding: '0.75rem 1.5rem', fontSize: '1rem', opacity: (quoteItems.length === 0 || !quoteClient) ? 0.6 : 1 }}
                >
                  <Save size={18} /> Sauvegarder
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Dim. (LxH)</th>
                    <th>Options (Vitrage/Couleur)</th>
                    <th>Quantité</th>
                    <th>Total HT</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map((item, idx) => (
                    <tr key={item.id}>
                      <td data-label="Article">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {(() => {
                            const prod = (database.shopProducts || []).find(p => p.id === item.productId);
                            const img = item.image || prod?.image;
                            return img ? (
                              <img src={img} alt={item.nom} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>N/A</div>
                            );
                          })()}
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.nom}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.designation}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Dimensions">{item.l || item.h ? `${item.l} x ${item.h} mm` : '-'}</td>
                      <td data-label="Options">
                         <div style={{ fontSize: '0.85rem' }}>
                           {item.glassId && <div>{(database.glass||[]).find(g=>g.id===item.glassId)?.name}</div>}
                           {item.colorId && <div>{(database.colors||[]).find(c=>c.id===item.colorId)?.name}</div>}
                           {!item.glassId && !item.colorId && '-'}
                         </div>
                      </td>
                      <td data-label="Qté" style={{ fontWeight: 600 }}>{item.qty} {item.unit === 'unité' ? 'U' : 'pces'}</td>
                      <td data-label="Total HT" style={{ fontWeight: 700, color: '#3b82f6' }}>
                        {item.totalHT.toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn" style={{ padding: '0.3rem', color: '#ef4444' }} onClick={() => removeQuoteItem(item.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {quoteItems.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        Le devis est vide. Ajoutez des produits via le panneau latéral.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {quoteItems.length > 0 && (
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '300px', background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                   {Number(quoteRemise) > 0 && (
                     <>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                         <span style={{ color: '#64748b' }}>Total Brut</span>
                         <span style={{ fontWeight: 600 }}>{quoteItems.reduce((s,i) => s + i.totalHT, 0).toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#ef4444' }}>
                         <span>Remise</span>
                         <span style={{ fontWeight: 600 }}>- {Number(quoteRemise).toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                       </div>
                     </>
                   )}
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                     <span style={{ color: '#64748b' }}>Total HT</span>
                     <span style={{ fontWeight: 600 }}>{Math.max(0, quoteItems.reduce((s,i) => s + i.totalHT, 0) - Number(quoteRemise)).toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.95rem' }}>
                     <span style={{ color: '#64748b' }}>TVA ({quoteTva}%)</span>
                     <span style={{ fontWeight: 600 }}>{(Math.max(0, quoteItems.reduce((s,i) => s + i.totalHT, 0) - Number(quoteRemise)) * (Number(quoteTva)/100)).toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                   </div>
                   <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem' }}>
                     <span style={{ fontWeight: 800, color: '#1e293b' }}>Total TTC</span>
                     <span style={{ fontWeight: 800, color: '#16a34a' }}>
                       {(Math.max(0, quoteItems.reduce((s,i) => s + i.totalHT, 0) - Number(quoteRemise)) * (1 + Number(quoteTva)/100)).toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD
                     </span>
                   </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {activeTab === 'viewQuote' && viewingQuote && (() => {
        const vq = viewingQuote;
        const client = (database.clients || []).find(c => c.id === vq.clientId);
        const items = vq.items || [];
        const totalHT = vq.totals?.ht || 0;
        const tva = vq.totals?.tva || 0;
        const totalTTC = vq.totals?.ttc || 0;
        return (
          <div className="glass shadow-lg" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Devis {vq.number}</h2>
                <p style={{ color: '#64748b', margin: '0.25rem 0 0 0' }}>
                  Client : {client?.nom || 'Inconnu'} — Créé le {new Date(vq.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {vq.status === 'Validé' && (
                  <>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (!window.confirm("Générer une facture pour ce devis validé ?")) return;
                        // Generate a simple Invoice PDF for the shop quote
                        const currentCounter = database.invoiceCounter || 1;
                        const invoiceNumber = String(currentCounter).padStart(2, '0');
                        const tvaRateToUse = vq.tvaRate !== undefined ? vq.tvaRate : (quoteSettings?.tvaRate ?? 9);
                        
                        const doc = new jsPDF({ format: 'a4' });
                        const pw = doc.internal.pageSize.getWidth();
                        let y = 15;
                        const formatPrice = (val) => Number(val || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                    
                        if (quoteSettings?.logoBase64) {
                          try {
                            const imgProps = doc.getImageProperties(quoteSettings.logoBase64);
                            const maxW = 60; const maxH = 25;
                            const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
                            doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, imgProps.width * ratio, imgProps.height * ratio, '', 'FAST');
                          } catch (e) {
                            try { doc.addImage(quoteSettings.logoBase64, 'PNG', 15, y, 60, 25, '', 'FAST'); } catch(e2) {}
                          }
                        }
                        
                        doc.setFontSize(22);
                        doc.setFont('helvetica', 'bold');
                        doc.text('FACTURE', pw - 15, y + 15, { align: 'right' });
                        
                        y += 35;
                        doc.setFontSize(11);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`Facture N° : ${invoiceNumber}`, 15, y);
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 15, y + 5);
                        
                        y += 8;
                        const boxY = y;
                        const boxWidth = (pw - 35) / 2;
                        
                        const companyNameLines = doc.splitTextToSize(quoteSettings?.companyName || 'Mon Entreprise', boxWidth - 6);
                        const clientNameLines = doc.splitTextToSize(client?.nom || 'Client', boxWidth - 6);
                    
                        let tempCyLeft = boxY + 6 + (companyNameLines.length * 4) + 1;
                        if (quoteSettings?.companyAddress) {
                          tempCyLeft += doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6).length * 4;
                        }
                        const phone = quoteSettings?.companyPhone || '';
                        const email = quoteSettings?.companyEmail || '';
                        if (phone || email) tempCyLeft += 5;
                        if (quoteSettings?.companyRC) tempCyLeft += 4;
                        if (quoteSettings?.companyIMP) tempCyLeft += 4;
                        if (quoteSettings?.companyMF) tempCyLeft += 4;
                    
                        let tempCyRight = boxY + 11 + (clientNameLines.length * 4) + 1;
                        if (client?.adresse) {
                          tempCyRight += doc.splitTextToSize(client.adresse, boxWidth - 6).length * 4;
                        }
                        if (client?.telephone) tempCyRight += 4;
                        if (client?.email) tempCyRight += 5;
                        if (client?.rc) tempCyRight += 4;
                        if (client?.nif) tempCyRight += 4;
                        if (client?.nis) tempCyRight += 4;
                        if (client?.ai) tempCyRight += 4;
                    
                        const boxHeight = Math.max(tempCyLeft - boxY + 4, tempCyRight - boxY + 4, 42);
  
                        // Company box (Left)
                        doc.setDrawColor(150, 150, 150);
                        doc.setLineWidth(0.3);
                        doc.roundedRect(15, boxY, boxWidth, boxHeight, 2, 2);
                        
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        doc.text(companyNameLines, 18, boxY + 6);
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        let cy = boxY + 6 + (companyNameLines.length * 4) + 1;
                        if (quoteSettings?.companyAddress) {
                          const addressLines = doc.splitTextToSize(quoteSettings.companyAddress, boxWidth - 6);
                          doc.text(addressLines, 18, cy);
                          cy += addressLines.length * 4;
                        }
                        if (phone || email) {
                          doc.text(`${phone} ${email ? ' - ' + email : ''}`, 18, cy);
                          cy += 5;
                        }
                        doc.setTextColor(80, 80, 80);
                        if (quoteSettings?.companyRC) { doc.text(`RC N°: ${quoteSettings.companyRC}`, 18, cy); cy += 4; }
                        if (quoteSettings?.companyIMP) { doc.text(`AI N°: ${quoteSettings.companyIMP}`, 18, cy); cy += 4; }
                        if (quoteSettings?.companyMF) { doc.text(`NIF N°: ${quoteSettings.companyMF}`, 18, cy); cy += 4; }
                        doc.setTextColor(0, 0, 0);
                    
                        // Client box (Right)
                        const rightBoxXHeader = 15 + boxWidth + 5;
                        doc.roundedRect(rightBoxXHeader, boxY, boxWidth, boxHeight, 2, 2);
                        
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'bold');
                        doc.text('Destinataire :', rightBoxXHeader + 3, boxY + 6);
                        doc.setFontSize(10);
                        doc.text(clientNameLines, rightBoxXHeader + 3, boxY + 11);
                        
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        let cly = boxY + 11 + (clientNameLines.length * 4) + 1;
                        if (client?.adresse) {
                          const addrLines = doc.splitTextToSize(client.adresse, boxWidth - 6);
                          doc.text(addrLines, rightBoxXHeader + 3, cly);
                          cly += addrLines.length * 4;
                        }
                        if (client?.telephone) {
                          doc.text(`Tél : ${client.telephone}`, rightBoxXHeader + 3, cly);
                          cly += 4;
                        }
                        if (client?.email) {
                          doc.text(`Email : ${client.email}`, rightBoxXHeader + 3, cly);
                          cly += 5;
                        }
                        doc.setTextColor(80, 80, 80);
                        if (client?.rc) { doc.text(`RC : ${client.rc}`, rightBoxXHeader + 3, cly); cly += 4; }
                        if (client?.nif) { doc.text(`NIF : ${client.nif}`, rightBoxXHeader + 3, cly); cly += 4; }
                        if (client?.nis) { doc.text(`NIS : ${client.nis}`, rightBoxXHeader + 3, cly); cly += 4; }
                        if (client?.ai) { doc.text(`AI : ${client.ai}`, rightBoxXHeader + 3, cly); cly += 4; }
                        doc.setTextColor(0, 0, 0);
                    
                        y = boxY + boxHeight + 6;
                    
                        const tableColumn = ["Désignation", "Dim. / Options", "Quantité (m²/ml)", "Pièces", "P.U. HT", "Total HT"];
                        const tableRows = [];
                    
                        items.forEach(item => {
                          const dims = (item.l || item.h) ? `${item.l} x ${item.h} mm` : '';
                          let optStr = '';
                          if (item.glassId) {
                            const g = (database.glass||[]).find(x=>x.id===item.glassId);
                            if(g) optStr += g.name + ' ';
                          }
                          if (item.colorId) {
                            const c = (database.colors||[]).find(x=>x.id===item.colorId);
                            if(c) optStr += c.name;
                          }
                          const descLine2 = [dims, optStr].filter(Boolean).join(' | ');
                          
                          let totalMeasurementQty = item.qty;
                          let measureUnit = item.unit === 'unité' ? 'U' : item.unit;
                          
                          if (item.unit === 'm2') {
                             totalMeasurementQty = (item.m2 !== undefined && item.m2 !== null) ? (item.m2 * item.qty) : (((item.h || 0) / 1000) * ((item.l || 0) / 1000) * item.qty);
                          } else if (item.unit === 'm') {
                             totalMeasurementQty = ((item.l || item.h || 0) / 1000) * item.qty;
                          }
                          
                          const puHT = (totalMeasurementQty > 0) ? (item.totalHT / totalMeasurementQty) : item.totalHT;
                          
                          const rowData = [
                            `${item.nom}\n${item.designation || ''}`,
                            descLine2 || '-',
                            item.unit === 'unité' ? '-' : `${totalMeasurementQty.toFixed(2)} ${measureUnit}`,
                            `${item.qty} pces`,
                            `${formatPrice(puHT)} DZD`,
                            `${formatPrice(item.totalHT)} DZD`
                          ];
                          tableRows.push(rowData);
                        });
                    
                        autoTable(doc, {
                          startY: y,
                          head: [tableColumn],
                          body: tableRows,
                          theme: 'grid',
                          headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
                          styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
                          columnStyles: { 0: { cellWidth: 50 }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } }
                        });
                    
                        let finalY = (doc.lastAutoTable?.finalY || doc.previousAutoTable?.finalY || y + 20) + 10;
                        if (finalY > 220) { doc.addPage(); finalY = 20; }
                    
                        const rightBoxX = 110;
                        let boxHeightBottom = 22;
                        if (vq.totals?.remise > 0) boxHeightBottom += 14;
   
                        doc.setDrawColor(150, 150, 150);
                        doc.setLineWidth(0.5);
                        doc.roundedRect(rightBoxX, finalY, pw - 15 - rightBoxX, boxHeightBottom, 3, 3);
                        
                        let currentTotalY = finalY + 9;
                        if (vq.totals?.remise > 0) {
                          doc.setFontSize(8.5);
                          doc.setFont('helvetica', 'normal');
                          doc.text('MONTANT BRUT', rightBoxX + 5, currentTotalY);
                          doc.text(`${formatPrice(vq.totals.htBrut || totalHT)} DZD`, pw - 20, currentTotalY, { align: 'right' });
                          
                          currentTotalY += 7;
                          doc.text('REMISE', rightBoxX + 5, currentTotalY);
                          doc.text(`- ${formatPrice(vq.totals.remise)} DZD`, pw - 20, currentTotalY, { align: 'right' });
   
                          currentTotalY += 7;
                        }
   
                        doc.setFontSize(9.5);
                        doc.setFont('helvetica', 'bold');
                        doc.text('MONTANT TOTAL HT', rightBoxX + 5, currentTotalY);
                        doc.text(`${formatPrice(totalHT)} DZD`, pw - 20, currentTotalY, { align: 'right' });
                        
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8.5);
                        doc.text(`TVA ${tvaRateToUse}% :`, rightBoxX + 5, currentTotalY + 7);
                        doc.text(`${formatPrice(tva)} DZD`, pw - 20, currentTotalY + 7, { align: 'right' });
                    
                        finalY += boxHeightBottom + 15;
                        
                        doc.setFontSize(14);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`NET À PAYER TTC : ${formatPrice(totalTTC)} DZD`, pw - 15, finalY, { align: 'right' });
                    
                        if (quoteSettings?.cachetBase64) {
                          try { doc.addImage(quoteSettings.cachetBase64, 'PNG', 25, finalY, 35, 35); } catch (e) {}
                        }
                    
                        doc.save(`Facture_${invoiceNumber}.pdf`);
                        
                        setDatabase(prev => {
                          let newCounter = prev.invoiceCounter || 1;
                          if (currentCounter >= newCounter) {
                             newCounter = currentCounter + 1;
                          }
                          return { ...prev, invoiceCounter: newCounter };
                        });
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem', background: '#8b5cf6', border: 'none', color: 'white' }}
                    >
                      <Printer size={18} /> Générer Facture
                    </button>
                    <button
                      className="btn"
                      onClick={() => {
                        if (window.confirm("Réinitialiser le compteur de facture à 01 ?")) {
                          setDatabase(prev => ({ ...prev, invoiceCounter: 1 }));
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem', background: '#ef4444', border: 'none', color: 'white' }}
                      title="Réinitialiser l'ordre des factures à 01"
                    >
                      Réinitialiser l'ordre
                    </button>
                  </>
                )}
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleExportExistingQuotePDF(vq)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                >
                  <FileText size={18} /> Exporter PDF
                </button>
                <button 
                  className="btn" 
                  onClick={() => { setViewingQuote(null); setActiveTab('products'); if(onClearSelectedQuote) onClearSelectedQuote(); }}
                  style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                >
                  <X size={18} /> Fermer
                </button>
              </div>
            </div>

            {/* Infos client */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem' }}>Informations Client</h3>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Nom :</strong> {client?.nom || '-'}</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Adresse :</strong> {client?.adresse || '-'}</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Tél :</strong> {client?.telephone || '-'}</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>NIF :</strong> {client?.nif || '-'}</p>
              </div>
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem' }}>Informations Devis</h3>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>N° :</strong> {vq.number}</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Date :</strong> {new Date(vq.createdAt).toLocaleDateString('fr-FR')}</p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>Statut :</strong>
                  {vq.status !== 'Validé' ? (
                    <select 
                      value={vq.status || 'Brouillon'} 
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        const updated = { ...vq, status: newStatus, validatedAt: newStatus === 'Validé' ? new Date().toISOString() : vq.validatedAt };
                        setDatabase(prev => ({ ...prev, quotes: prev.quotes.map(quote => quote.id === vq.id ? updated : quote) }));
                        setViewingQuote(updated);
                      }}
                      className="input" style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', height: 'auto', width: 'auto' }}
                    >
                      <option value="Brouillon">Brouillon</option>
                      <option value="Validé">Validé</option>
                    </select>
                  ) : (
                    <span style={{ padding: '0.15rem 0.4rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: '#dcfce3', color: '#16a34a' }}>Validé</span>
                  )}
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}><strong>Articles :</strong> {items.length}</p>
              </div>
            </div>

            {/* Tableau des articles */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Dim. (LxH)</th>
                    <th>Options (Vitrage/Couleur)</th>
                    <th>Quantité</th>
                    <th>Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td data-label="Article">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {(() => {
                            const prod = (database.shopProducts || []).find(p => p.id === item.productId);
                            const img = item.image || prod?.image;
                            return img ? (
                              <img src={img} alt={item.nom} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>N/A</div>
                            );
                          })()}
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.nom}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.designation}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Dimensions">{item.l || item.h ? `${item.l} x ${item.h} mm` : '-'}</td>
                      <td data-label="Options">
                        <div style={{ fontSize: '0.85rem' }}>
                          {item.glassId && <div>{(database.glass||[]).find(g=>g.id===item.glassId)?.name || item.glassId}</div>}
                          {item.colorId && <div>{(database.colors||[]).find(c=>c.id===item.colorId)?.name || item.colorId}</div>}
                          {!item.glassId && !item.colorId && '-'}
                        </div>
                      </td>
                      <td data-label="Qté" style={{ fontWeight: 600 }}>{item.qty} {item.unit}</td>
                      <td data-label="Total HT" style={{ fontWeight: 700, color: '#3b82f6' }}>
                        {(item.totalHT || 0).toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        Aucun article dans ce devis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totaux */}
            {items.length > 0 && (
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '300px', background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                  {vq.totals?.remise > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748b' }}>Total Brut</span>
                        <span style={{ fontWeight: 600 }}>{(vq.totals.htBrut || totalHT).toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem', color: '#ef4444' }}>
                        <span>Remise</span>
                        <span style={{ fontWeight: 600 }}>- {vq.totals.remise.toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                    <span style={{ color: '#64748b' }}>Total HT</span>
                    <span style={{ fontWeight: 600 }}>{totalHT.toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.95rem' }}>
                    <span style={{ color: '#64748b' }}>TVA ({quoteSettings.tvaRate || 19}%)</span>
                    <span style={{ fontWeight: 600 }}>{tva.toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD</span>
                  </div>
                  <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem' }}>
                    <span style={{ fontWeight: 800, color: '#1e293b' }}>Total TTC</span>
                    <span style={{ fontWeight: 800, color: '#16a34a' }}>
                      {totalTTC.toLocaleString('fr-FR', {minimumFractionDigits:2})} DZD
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default ShopModule;
