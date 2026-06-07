import React, { useState } from 'react';
import { TrendingUp, FileText, CreditCard, Receipt } from 'lucide-react';
import ContractGenerator from './ContractGenerator';
import FinancialTracker from './FinancialTracker';
import InvoiceGenerator from './InvoiceGenerator';

const FinanceModule = ({ data, setData, quoteSettings }) => {
  const [activeTab, setActiveTab] = useState('contracts');

  const tabs = [
    { id: 'contracts', label: 'Contrats', icon: FileText },
    { id: 'tracker', label: 'Suivi Financier', icon: CreditCard },
    { id: 'invoices', label: 'Factures', icon: Receipt },
  ];

  return (
    <div className="animate-fade-in">
      <header className="flex-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #0f4c75, #1b6ca8)', borderRadius: '10px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <TrendingUp size={20} color="white" />
            </div>
            Module Finance
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Contrats, suivi des paiements et génération de factures.</p>
        </div>
      </header>

      {/* Sub-nav tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', borderRadius: '0.75rem', padding: '0.25rem', marginBottom: '1.5rem', width: 'fit-content' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                background: isActive ? 'white' : 'transparent',
                color: isActive ? '#0f4c75' : '#64748b',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'contracts' && (
        <ContractGenerator data={data} setData={setData} quoteSettings={quoteSettings} />
      )}
      {activeTab === 'tracker' && (
        <FinancialTracker data={data} setData={setData} quoteSettings={quoteSettings} />
      )}
      {activeTab === 'invoices' && (
        <InvoiceGenerator data={data} setData={setData} quoteSettings={quoteSettings} />
      )}
    </div>
  );
};

export default FinanceModule;
