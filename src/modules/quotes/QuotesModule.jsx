import React, { useState, useMemo } from 'react';
import { 
  FileText, Plus, Search, Filter, Calendar, ArrowUpDown, ArrowUp, ArrowDown, 
  Users, CheckCircle, Clock, ShoppingBag, Copy, Trash2, ExternalLink, 
  Layers, Store, ChevronRight, RefreshCw, AlertCircle
} from 'lucide-react';
import { getQuoteTotals } from '../../utils/quoteUtils';

const formatMoney = (amount) => {
  return (Number(amount) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generateNextQuoteNumber = (settings, db) => {
  let counter = settings?.quoteCounter || 1;
  const prefix = settings?.quotePrefix || 'DEV-';
  const quotes = db?.quotes || [];
  for (const q of quotes) {
    if (q && q.number && q.number.startsWith(prefix)) {
      const numPart = q.number.substring(prefix.length).split('-')[0].split(' ')[0];
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed >= counter) {
        counter = parsed + 1;
      }
    }
  }
  return `${prefix}${String(counter).padStart(3, '0')}`;
};

const QuotesModule = ({ data, setData, quoteSettings, onOpenQuote, onNewQuote }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Brouillon' | 'Validé' | 'Confirmé'
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'menuiserie' | 'shop'
  const [sortOrder, setSortOrder] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

  // Clients Map for instant lookups
  const clientsMap = useMemo(() => {
    const map = new Map();
    (data.clients || []).forEach(c => {
      map.set(c.id, c);
    });
    return map;
  }, [data.clients]);

  // Clients with quote counts
  const clientsWithCount = useMemo(() => {
    const counts = {};
    (data.quotes || []).forEach(q => {
      if (q && !q._deleted) {
        const cId = q.clientId || 'NO_CLIENT';
        counts[cId] = (counts[cId] || 0) + 1;
      }
    });

    return (data.clients || [])
      .filter(c => !c._deleted)
      .map(c => ({
        ...c,
        quoteCount: counts[c.id] || 0
      }))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [data.clients, data.quotes]);

  // Active Quotes filtered and sorted chronologically
  const filteredQuotes = useMemo(() => {
    let list = (data.quotes || []).filter(q => q && !q._deleted);

    // 1. Client filter
    if (selectedClientId !== 'ALL') {
      if (selectedClientId === 'NO_CLIENT') {
        list = list.filter(q => !q.clientId);
      } else {
        list = list.filter(q => q.clientId === selectedClientId);
      }
    }

    // 2. Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'Brouillon') {
        list = list.filter(q => !q.status || q.status === 'Brouillon');
      } else {
        list = list.filter(q => q.status === statusFilter);
      }
    }

    // 3. Type filter
    if (typeFilter !== 'ALL') {
      if (typeFilter === 'shop') {
        list = list.filter(q => q.type === 'shop');
      } else {
        list = list.filter(q => q.type !== 'shop');
      }
    }

    // 4. Search input
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(q => {
        const num = (q.number || '').toLowerCase();
        const client = clientsMap.get(q.clientId);
        const clientNom = (client?.nom || q.clientName || '').toLowerCase();
        const clientTel = (client?.telephone || '').toLowerCase();
        const itemsLabels = (q.items || []).map(i => i.label || '').join(' ').toLowerCase();
        return num.includes(term) || clientNom.includes(term) || clientTel.includes(term) || itemsLabels.includes(term);
      });
    }

    // 5. Chronological and custom sorting
    return list.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      const totalsA = getQuoteTotals(a, quoteSettings);
      const totalsB = getQuoteTotals(b, quoteSettings);
      const amountA = totalsA.ttc;
      const amountB = totalsB.ttc;

      switch (sortOrder) {
        case 'date_asc':
          return dateA - dateB;
        case 'amount_desc':
          return amountB - amountA;
        case 'amount_asc':
          return amountA - amountB;
        case 'date_desc':
        default:
          return dateB - dateA;
      }
    });
  }, [data.quotes, selectedClientId, statusFilter, typeFilter, searchTerm, sortOrder, clientsMap, quoteSettings]);

  // Overall Statistics
  const stats = useMemo(() => {
    const all = (data.quotes || []).filter(q => q && !q._deleted);
    let totalTTC = 0;
    let totalHT = 0;
    let countValide = 0;
    let countConfirme = 0;
    let countBrouillon = 0;

    all.forEach(q => {
      const qTotals = getQuoteTotals(q, quoteSettings);
      totalTTC += qTotals.ttc;
      totalHT += qTotals.ht;

      if (q.status === 'Confirmé') countConfirme++;
      else if (q.status === 'Validé') countValide++;
      else countBrouillon++;
    });

    return {
      totalCount: all.length,
      totalTTC,
      totalHT,
      countValide,
      countConfirme,
      countBrouillon,
      averageTTC: all.length > 0 ? totalTTC / all.length : 0
    };
  }, [data.quotes, quoteSettings]);

  // Actions
  const handleConvertToOrder = (quote) => {
    if (!window.confirm(`Voulez-vous transformer le devis ${quote.number} en commande active ?`)) return;
    
    setData(prev => {
      const orders = prev.orders || [];
      const existingOrder = orders.find(o => o.quoteId === quote.id);
      let orderId = existingOrder ? existingOrder.id : null;
      if (!orderId) {
        const ids = orders
          .map(o => o.id)
          .filter(id => id && id.startsWith('CMD-'))
          .map(id => parseInt(id.split('-')[1], 10))
          .filter(num => !isNaN(num));
        let candidate = 1;
        while (ids.includes(candidate)) {
          candidate++;
        }
        orderId = `CMD-${String(candidate).padStart(2, '0')}`;
      }

      const newOrder = {
        ...quote,
        id: orderId,
        quoteId: quote.id,
        quoteNumber: quote.number,
        createdAt: new Date().toISOString(),
        status: 'Confirmé',
        batches: [],
        items: (quote.items || []).map(item => {
          const existingItem = existingOrder?.items?.find(i => i.id === item.id);
          return {
            ...item,
            siteMeasurements: existingItem ? (existingItem.siteMeasurements || []) : []
          };
        })
      };

      const quotes = (prev.quotes || []).map(q => q.id === quote.id ? { ...q, status: 'Confirmé', _lastModified: new Date().toISOString() } : q);
      const orderExists = orders.some(o => o.id === orderId);
      
      let finalOrders;
      if (orderExists) {
        finalOrders = orders.map(o => {
          if (o.id === orderId) {
            const updated = { ...o, ...newOrder, batches: o.batches || [], _lastModified: new Date().toISOString() };
            delete updated._deleted;
            return updated;
          }
          return o;
        });
      } else {
        finalOrders = [...orders, newOrder];
      }

      const updatedIds = finalOrders
        .map(o => o.id)
        .filter(id => id && id.startsWith('CMD-'))
        .map(id => parseInt(id.split('-')[1], 10))
        .filter(num => !isNaN(num));
      let nextOrderCounter = 1;
      while (updatedIds.includes(nextOrderCounter)) {
        nextOrderCounter++;
      }

      setTimeout(() => {
        alert(`Commande ${orderId} créée avec succès ! Retrouvez-la dans l'onglet "Commandes".`);
      }, 50);

      return {
        ...prev,
        quotes,
        orders: finalOrders,
        orderCounter: nextOrderCounter
      };
    });
  };

  const handleDuplicateQuote = (quote) => {
    const newId = `QUOTE-${Date.now()}`;
    const nextNumber = generateNextQuoteNumber(quoteSettings, data);
    const deepClone = JSON.parse(JSON.stringify(quote));
    const calculatedTotals = getQuoteTotals(deepClone, quoteSettings);
    const newQuote = {
      ...deepClone,
      id: newId,
      number: nextNumber,
      status: 'Brouillon',
      createdAt: new Date().toISOString(),
      validatedAt: null,
      totals: calculatedTotals,
      items: (deepClone.items || []).map(item => ({
        ...item,
        id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      }))
    };
    
    setData(prev => ({
      ...prev,
      quotes: [...(prev.quotes || []), newQuote]
    }));
    alert(`Devis ${quote.number} dupliqué avec succès sous le nouveau numéro ${nextNumber}.`);
  };

  const handleDeleteQuote = (quote) => {
    if (window.confirm(`Voulez-vous vraiment supprimer le devis ${quote.number} ? Cette action est irréversible.`)) {
      setData(prev => {
        const list = (prev.quotes || []).map(q => q.id === quote.id ? { ...q, _deleted: true, _lastModified: new Date().toISOString() } : q);
        return { ...prev, quotes: list };
      });
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '0.5rem 0' }}>
      {/* Header */}
      <header className="flex-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'grid', placeItems: 'center', color: 'white', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)' }}>
              <FileText size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.025em' }}>
                Gestion des Devis
              </h1>
              <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
                Historique chronologique et suivi commercial de tous vos chiffrages.
              </p>
            </div>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={onNewQuote}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '0.6rem', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}
        >
          <Plus size={18} /> Nouveau Devis
        </button>
      </header>

      {/* KPI Cards Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass shadow-sm" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Devis</span>
            <FileText size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e293b' }}>
            {stats.totalCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            Tous types confondus
          </div>
        </div>

        <div className="glass shadow-sm" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Volume Total TTC</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#059669' }}>DZD</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669' }}>
            {formatMoney(stats.totalTTC)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            HT: {formatMoney(stats.totalHT)} DZD
          </div>
        </div>

        <div className="glass shadow-sm" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Confirmés / Commandes</span>
            <ShoppingBag size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#2563eb' }}>
            {stats.countConfirme}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            {stats.countValide} validés supplémentaires
          </div>
        </div>

        <div className="glass shadow-sm" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>Brouillons / En cours</span>
            <Clock size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706' }}>
            {stats.countBrouillon}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            En attente de finalisation
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="glass shadow-sm" style={{ padding: '1.25rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', background: 'white', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Search Input */}
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              className="input"
              placeholder="Rechercher par N° Devis, Client, Produit..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%', fontSize: '0.875rem' }}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontWeight: 700 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Client Filter Selector */}
          <div style={{ flex: '1 1 220px', minWidth: '200px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
              <Users size={14} color="#3b82f6" /> FILTRER PAR CLIENT :
            </label>
            <select
              className="input"
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              style={{ width: '100%', fontSize: '0.875rem', fontWeight: 600 }}
            >
              <option value="ALL">👤 Tous les clients ({data.quotes?.length || 0})</option>
              <option value="NO_CLIENT">Sans client assigné</option>
              {clientsWithCount.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nom} ({c.quoteCount})
                </option>
              ))}
            </select>
          </div>

          {/* Chronological Sorting */}
          <div style={{ flex: '0 1 190px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
              <ArrowUpDown size={14} color="#3b82f6" /> TRI CHRONOLOGIQUE :
            </label>
            <select
              className="input"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              style={{ width: '100%', fontSize: '0.875rem', fontWeight: 600 }}
            >
              <option value="date_desc">📅 Plus récent d'abord</option>
              <option value="date_asc">📅 Plus ancien d'abord</option>
              <option value="amount_desc">💰 Montant le plus élevé</option>
              <option value="amount_asc">💰 Montant le plus faible</option>
            </select>
          </div>
        </div>

        {/* Second Row: Pills for Status and Type */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Status Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: '0.3rem' }}>Statut :</span>
            {[
              { id: 'ALL', label: 'Tous' },
              { id: 'Brouillon', label: 'Brouillons' },
              { id: 'Validé', label: 'Validés' },
              { id: 'Confirmé', label: 'Confirmés' },
            ].map(tab => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    background: active ? '#eff6ff' : 'white',
                    color: active ? '#1d4ed8' : '#64748b',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Type Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: '0.3rem' }}>Module :</span>
            {[
              { id: 'ALL', label: 'Tous' },
              { id: 'menuiserie', label: 'Menuiserie' },
              { id: 'shop', label: 'Shop' },
            ].map(tab => {
              const active = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTypeFilter(tab.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? '1.5px solid #0f766e' : '1px solid #e2e8f0',
                    background: active ? '#f0fdfa' : 'white',
                    color: active ? '#0f766e' : '#64748b',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', padding: '0 0.5rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
          {filteredQuotes.length} devis trouvé{filteredQuotes.length > 1 ? 's' : ''}
          {selectedClientId !== 'ALL' && (
            <span style={{ color: '#2563eb', marginLeft: '0.4rem' }}>
              pour {clientsMap.get(selectedClientId)?.nom || 'Client'}
            </span>
          )}
        </span>

        {(selectedClientId !== 'ALL' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedClientId('ALL');
              setStatusFilter('ALL');
              setTypeFilter('ALL');
              setSearchTerm('');
              setSortOrder('date_desc');
            }}
            style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <RefreshCw size={12} /> Réinitialiser les filtres
          </button>
        )}
      </div>

      {/* Quotes Table */}
      {filteredQuotes.length === 0 ? (
        <div className="glass shadow-sm" style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
          <FileText size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
            Aucun devis trouvé
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
            {searchTerm || selectedClientId !== 'ALL' || statusFilter !== 'ALL'
              ? "Aucun résultat ne correspond à vos filtres actuels. Essayez de réinitialiser vos critères de recherche."
              : "Vous n'avez pas encore de devis enregistré. Créez votre premier chiffrage dès maintenant."}
          </p>
          <button 
            className="btn btn-primary" 
            onClick={onNewQuote}
            style={{ padding: '0.6rem 1.25rem', fontWeight: 700 }}
          >
            <Plus size={16} /> Créer un Devis
          </button>
        </div>
      ) : (
        <div className="table-responsive glass shadow-sm" style={{ borderRadius: '0.85rem', overflow: 'hidden', background: 'white', border: '1px solid #e2e8f0' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>N° Devis</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Client</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Statut</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Type / Articles</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Montant HT</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Montant TTC</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => {
                const client = clientsMap.get(q.clientId);
                const clientName = client?.nom || q.clientName || 'Sans Client';
                const createdDate = q.createdAt ? new Date(q.createdAt) : null;
                const isShop = q.type === 'shop';
                const quoteTotals = getQuoteTotals(q, quoteSettings);
                const totalHT = quoteTotals.ht;
                const totalTTC = quoteTotals.ttc;
                const itemsCount = (q.items || []).length;

                return (
                  <tr 
                    key={q.id} 
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                    className="hover-row"
                  >
                    {/* N° Devis */}
                    <td data-label="N° Devis" style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: q.status === 'Confirmé' ? '#2563eb' : (q.status === 'Validé' ? '#16a34a' : '#f59e0b') 
                        }} />
                        <strong style={{ fontSize: '0.92rem', color: '#1e293b', letterSpacing: '-0.01em' }}>
                          {q.number || q.id}
                        </strong>
                      </div>
                    </td>

                    {/* Date */}
                    <td data-label="Date" style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                        {createdDate ? createdDate.toLocaleDateString('fr-FR') : '-'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {createdDate ? createdDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>

                    {/* Client */}
                    <td data-label="Client" style={{ padding: '0.85rem 1rem' }}>
                      <div 
                        onClick={() => {
                          if (q.clientId) setSelectedClientId(q.clientId);
                        }}
                        style={{ 
                          fontSize: '0.88rem', 
                          fontWeight: 700, 
                          color: q.clientId ? '#2563eb' : '#64748b', 
                          cursor: q.clientId ? 'pointer' : 'default',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                        title={q.clientId ? "Cliquer pour filtrer uniquement ce client" : ""}
                      >
                        {clientName}
                      </div>
                      {client?.telephone && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          📞 {client.telephone}
                        </div>
                      )}
                    </td>

                    {/* Statut */}
                    <td data-label="Statut" style={{ padding: '0.85rem 1rem' }}>
                      {isShop ? (
                        <select
                          value={q.status || 'Brouillon'}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            const updated = { 
                              ...q, 
                              status: newStatus, 
                              validatedAt: newStatus === 'Validé' ? (q.validatedAt || new Date().toISOString()) : q.validatedAt,
                              _lastModified: new Date().toISOString()
                            };
                            setData(prev => ({ 
                              ...prev, 
                              quotes: (prev.quotes || []).map(quote => quote.id === q.id ? updated : quote) 
                            }));
                          }}
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none',
                            border: q.status === 'Confirmé' 
                              ? '1.5px solid #93c5fd' 
                              : (q.status === 'Validé' ? '1.5px solid #86efac' : '1.5px solid #fde68a'),
                            background: q.status === 'Confirmé' 
                              ? '#eff6ff' 
                              : (q.status === 'Validé' ? '#f0fdf4' : '#fffbeb'),
                            color: q.status === 'Confirmé' 
                              ? '#1d4ed8' 
                              : (q.status === 'Validé' ? '#15803d' : '#b45309')
                          }}
                          title="Modifier le statut du devis Shop"
                        >
                          <option value="Brouillon">⏳ Brouillon</option>
                          <option value="Validé">✅ Validé</option>
                          <option value="Confirmé">📦 Confirmé</option>
                        </select>
                      ) : (
                        <span style={{ 
                          padding: '0.25rem 0.65rem', 
                          borderRadius: '999px', 
                          fontSize: '0.75rem', 
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: q.status === 'Confirmé' 
                            ? '#dbeafe' 
                            : (q.status === 'Validé' ? '#dcfce7' : '#fef3c7'),
                          color: q.status === 'Confirmé' 
                            ? '#1d4ed8' 
                            : (q.status === 'Validé' ? '#15803d' : '#b45309')
                        }}>
                          {q.status === 'Confirmé' && <CheckCircle size={12} />}
                          {q.status === 'Validé' && <CheckCircle size={12} />}
                          {(!q.status || q.status === 'Brouillon') && <Clock size={12} />}
                          {q.status || 'Brouillon'}
                        </span>
                      )}
                    </td>

                    {/* Type / Articles */}
                    <td data-label="Type / Articles" style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                        <span style={{ 
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '999px', 
                          fontSize: '0.68rem', 
                          fontWeight: 800, 
                          background: isShop ? '#ede9fe' : '#e0f2fe', 
                          color: isShop ? '#7c3aed' : '#0369a1' 
                        }}>
                          {isShop ? 'Shop' : 'Menuiserie'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                          {itemsCount} article{itemsCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>

                    {/* Montant HT */}
                    <td data-label="Montant HT" style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>
                        {formatMoney(totalHT)}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '0.25rem' }}>DZD</span>
                    </td>

                    {/* Montant TTC */}
                    <td data-label="Montant TTC" style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <strong style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f766e' }}>
                        {formatMoney(totalTTC)}
                      </strong>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f766e', marginLeft: '0.25rem' }}>DZD</span>
                    </td>

                    {/* Actions */}
                    <td data-label="Actions" style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                        {/* Ouvrir */}
                        <button
                          onClick={() => {
                            if (onOpenQuote) onOpenQuote(q);
                          }}
                          className="btn"
                          style={{ 
                            padding: '0.4rem 0.75rem', 
                            fontSize: '0.8rem', 
                            fontWeight: 700, 
                            color: '#2563eb', 
                            borderColor: '#bfdbfe', 
                            background: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                          title="Ouvrir dans l'éditeur de chiffrage"
                        >
                          <ExternalLink size={13} /> Ouvrir
                        </button>

                        {/* Dupliquer */}
                        <button
                          onClick={() => handleDuplicateQuote(q)}
                          className="btn"
                          style={{ 
                            padding: '0.4rem', 
                            fontSize: '0.8rem', 
                            color: '#6366f1', 
                            borderColor: '#e0e7ff', 
                            background: '#eef2ff' 
                          }}
                          title="Dupliquer le devis"
                        >
                          <Copy size={14} />
                        </button>

                        {/* Transformer en Commande */}
                        {q.status !== 'Confirmé' && (
                          <button
                            onClick={() => handleConvertToOrder(q)}
                            className="btn btn-primary"
                            style={{ 
                              padding: '0.4rem 0.65rem', 
                              fontSize: '0.78rem', 
                              fontWeight: 700, 
                              background: '#10b981', 
                              borderColor: '#10b981',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="Transformer en commande"
                          >
                            <ShoppingBag size={13} /> Commande
                          </button>
                        )}

                        {/* Supprimer */}
                        {(!q.status || q.status === 'Brouillon') && (
                          <button
                            onClick={() => handleDeleteQuote(q)}
                            className="btn"
                            style={{ 
                              padding: '0.4rem', 
                              fontSize: '0.8rem', 
                              color: '#ef4444', 
                              borderColor: '#fee2e2', 
                              background: '#fef2f2' 
                            }}
                            title="Supprimer le devis"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QuotesModule;
