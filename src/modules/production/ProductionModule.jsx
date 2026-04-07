import React, { useMemo } from 'react';
import { Package, Scissors, Ruler, Download, CheckCircle, Barcode } from 'lucide-react';
import { FormulaEngine } from '../../engine/formula-engine';
import { DEFAULT_DATA } from '../../data/default-data';
import jsPDF from 'jspdf';

const ProductionModule = ({ currentConfig, database }) => {
  const engine = useMemo(() => new FormulaEngine(database), [database]);

  const bom = useMemo(() => {
    if (!currentConfig) return null;
    return engine.calculateBOM(currentConfig);
  }, [currentConfig, engine]);

  const generatePDF = () => {
    const doc = jsPDF();
    doc.setFontSize(20);
    doc.text('ORDRE DE FABRICATION (OF)', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    const composition = database.compositions.find(c => c.id === currentConfig.compositionId);
    doc.text(`Modèle: ${composition?.name} (${currentConfig.compositionId}) | Dimensions: ${currentConfig.L} x ${currentConfig.H} mm`, 20, 30);
    
    let y = 45;
    doc.setFontSize(12);
    doc.text('LISTE DE DÉBIT PROFILÉS', 20, y);
    y += 10;
    
    doc.setFontSize(10);
    bom.profiles.forEach((p, i) => {
      doc.text(`${p.label}: ${p.length} mm | Coupe: ${p.cutAngle}° | ${p.name}`, 20, y);
      y += 7;
    });

    y += 10;
    doc.text('VITRAGES', 20, y);
    y += 7;
    doc.text(`${bom.glass.name}: ${currentConfig.L} x ${currentConfig.H} mm (Poids: ${bom.glass.weight.toFixed(1)} kg)`, 20, y);

    doc.save(`OF_${currentConfig.compositionId}_${Date.now()}.pdf`);
  };

  if (!currentConfig) return <div>Aucune configuration active.</div>;

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b' }}>Module Production</h1>
          <p style={{ color: '#64748b' }}>Explosion de la recette et préparation de l'atelier.</p>
        </div>
        <button onClick={generatePDF} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={18} />
          Télécharger la Fiche de Débit (PDF)
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Left: Cutting List */}
        <div className="glass shadow-md">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <Scissors size={20} color="#2563eb" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Liste de Débit Profilés</h2>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Repère</th>
                <th>Désignation</th>
                <th>Longueur</th>
                <th>Angles</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bom.profiles.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{p.label}</td>
                  <td style={{ fontSize: '0.875rem', color: '#64748b' }}>{p.name}</td>
                  <td style={{ color: '#2563eb', fontWeight: 700 }}>{p.length} mm</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{p.cutAngle}°</span>
                      <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{p.cutAngle}°</span>
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Imprimer Code-Barre">
                      <Barcode size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: Glass & Logistics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass shadow-md" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
              <Package size={20} color="#3b82f6" />
              <h3 style={{ fontWeight: 600 }}>Vitrage & Verre</h3>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>{bom.glass.name}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem' }}>
                <span>Dimensions :</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{currentConfig.L - 60} x {currentConfig.H - 60} mm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.875rem', marginTop: '0.4rem' }}>
                <span>Poids estimé :</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{bom.glass.weight.toFixed(1)} kg</span>
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
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', background: '#10b981' }}>
                Lancer l'OF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionModule;
