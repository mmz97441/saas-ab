import React, { useState, useRef } from 'react';
import { FileText, Download, Loader2, X, Printer } from 'lucide-react';
import { Client, FinancialRecord, Month } from '../types';

interface ReportGeneratorProps {
  client: Client;
  data: FinancialRecord[];
  isOpen: boolean;
  onClose: () => void;
}

const MONTH_ORDER = Object.values(Month);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ client, data, isOpen, onClose }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const yearData = data
    .filter(d => d.year === selectedYear)
    .sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));

  const totalCA = yearData.reduce((s, r) => s + r.revenue.total, 0);
  const totalObjective = yearData.reduce((s, r) => s + r.revenue.objective, 0);
  const avgMargin = yearData.length > 0
    ? yearData.reduce((s, r) => s + (r.margin?.rate || 0), 0) / yearData.length
    : 0;
  const lastTreasury = yearData.length > 0 ? yearData[yearData.length - 1].cashFlow.treasury : 0;
  const avgBfr = yearData.length > 0
    ? yearData.reduce((s, r) => s + r.bfr.total, 0) / yearData.length
    : 0;

  const handlePrint = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow || !reportRef.current) {
        setIsGenerating(false);
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Rapport ${client.companyName} - ${selectedYear}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            h2 { font-size: 16px; color: #475569; margin-bottom: 24px; }
            h3 { font-size: 14px; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
            .header { background: #0f172a; color: white; padding: 32px; border-radius: 12px; margin-bottom: 32px; }
            .header h1 { color: white; }
            .header p { color: #94a3b8; font-size: 12px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
            .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
            .kpi-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
            .kpi-value { font-size: 22px; font-weight: 800; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 10px; text-transform: uppercase; color: #64748b; }
            td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
            td.num { text-align: right; font-variant-numeric: tabular-nums; }
            .negative { color: #dc2626; }
            .positive { color: #059669; }
            .section { margin-bottom: 28px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
            @media print { body { padding: 20px; } @page { size: A4; margin: 15mm; } }
          </style>
        </head>
        <body>
          ${reportRef.current.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        setIsGenerating(false);
      }, 500);
    }, 100);
  };

  const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => b - a);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-800">Rapport Mensuel</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={handlePrint}
              disabled={isGenerating || yearData.length === 0}
              className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-brand-700 transition disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Générer PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Report Preview */}
        <div className="overflow-y-auto max-h-[75vh] p-6">
          <div ref={reportRef}>
            {/* Report Header */}
            <div className="header">
              <h1>AB CONSULTANTS</h1>
              <p style={{ marginTop: '4px' }}>Rapport de Pilotage Financier</p>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>{client.companyName}</p>
                  <p>{client.managerName} {client.siret ? `• SIRET: ${client.siret}` : ''}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: 'white', fontWeight: 'bold' }}>Exercice {selectedYear}</p>
                  <p>Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
            </div>

            {/* KPI Summary */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Chiffre d'Affaires</div>
                <div className="kpi-value" style={{ color: '#0f172a' }}>{formatCurrency(totalCA)}</div>
                {totalObjective > 0 && <div className="kpi-label" style={{ marginTop: '4px' }}>{((totalCA / totalObjective) * 100).toFixed(1)}% de l'objectif</div>}
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Taux de Marge</div>
                <div className="kpi-value" style={{ color: '#0f172a' }}>{avgMargin.toFixed(1)}%</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Trésorerie Nette</div>
                <div className="kpi-value" style={{ color: lastTreasury >= 0 ? '#059669' : '#dc2626' }}>{formatCurrency(lastTreasury)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">BFR Moyen</div>
                <div className="kpi-value" style={{ color: '#0f172a' }}>{formatCurrency(avgBfr)}</div>
              </div>
            </div>

            {/* Monthly Detail Table */}
            <div className="section">
              <h3>Détail Mensuel</h3>
              {yearData.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>Aucune donnée pour {selectedYear}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Mois</th>
                      <th style={{ textAlign: 'right' }}>CA HT</th>
                      <th style={{ textAlign: 'right' }}>Objectif</th>
                      <th style={{ textAlign: 'right' }}>Marge %</th>
                      <th style={{ textAlign: 'right' }}>Trésorerie</th>
                      <th style={{ textAlign: 'right' }}>BFR</th>
                      <th style={{ textAlign: 'right' }}>Masse Salariale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearData.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.month}</td>
                        <td className="num">{formatCurrency(r.revenue.total)}</td>
                        <td className="num">{formatCurrency(r.revenue.objective)}</td>
                        <td className="num">{(r.margin?.rate || 0).toFixed(1)}%</td>
                        <td className={`num ${r.cashFlow.treasury < 0 ? 'negative' : 'positive'}`}>{formatCurrency(r.cashFlow.treasury)}</td>
                        <td className="num">{formatCurrency(r.bfr.total)}</td>
                        <td className="num">{formatCurrency(r.expenses.salaries)}</td>
                      </tr>
                    ))}
                    {/* Totals */}
                    <tr style={{ fontWeight: 800, borderTop: '2px solid #0f172a' }}>
                      <td>TOTAL / MOY.</td>
                      <td className="num">{formatCurrency(totalCA)}</td>
                      <td className="num">{formatCurrency(totalObjective)}</td>
                      <td className="num">{avgMargin.toFixed(1)}%</td>
                      <td className="num">{formatCurrency(lastTreasury)}</td>
                      <td className="num">{formatCurrency(avgBfr)}</td>
                      <td className="num">{formatCurrency(yearData.reduce((s, r) => s + r.expenses.salaries, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Expert Comments */}
            {yearData.some(r => r.expertComment) && (
              <div className="section">
                <h3>Analyses du Consultant</h3>
                {yearData.filter(r => r.expertComment).map(r => (
                  <div key={r.id} style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #0f172a' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{r.month} {r.year}</div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{r.expertComment}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="footer">
              <p>Ce rapport a été généré automatiquement par la plateforme AB Consultants.</p>
              <p>Pour toute question, contactez votre consultant : contact@ab-consultants.fr</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
