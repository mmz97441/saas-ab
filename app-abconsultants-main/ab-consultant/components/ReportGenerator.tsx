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

// Sanitize HTML to prevent XSS from Firestore data
const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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
  const totalMargin = yearData.reduce((s, r) => s + (r.margin?.total || 0), 0);
  const avgMargin = yearData.length > 0
    ? yearData.reduce((s, r) => s + (r.margin?.rate || 0), 0) / yearData.length
    : 0;
  const lastTreasury = yearData.length > 0 ? yearData[yearData.length - 1].cashFlow.treasury : 0;
  const avgBfr = yearData.length > 0
    ? yearData.reduce((s, r) => s + r.bfr.total, 0) / yearData.length
    : 0;
  const totalSalaries = yearData.reduce((s, r) => s + r.expenses.salaries, 0);
  const totalHours = yearData.reduce((s, r) => s + r.expenses.hoursWorked, 0);

  // Financial Ratios (based on last month of the year)
  const lastRecord = yearData.length > 0 ? yearData[yearData.length - 1] : null;
  const reportRatios = lastRecord ? (() => {
    const ca = lastRecord.revenue.total;
    const margin = lastRecord.margin?.total || 0;
    const achats = Math.max(ca - margin, 0);
    return {
      dso: ca > 0 ? (lastRecord.bfr.receivables.clients / ca) * 30 : 0,
      dpo: achats > 0 ? (lastRecord.bfr.debts.suppliers / achats) * 30 : 0,
      dio: achats > 0 ? (lastRecord.bfr.stock.total / achats) * 30 : 0,
      bfrDays: ca > 0 ? ((lastRecord.bfr.receivables.clients / ca) * 30) + (achats > 0 ? (lastRecord.bfr.stock.total / achats) * 30 : 0) - (achats > 0 ? (lastRecord.bfr.debts.suppliers / achats) * 30 : 0) : 0,
      salaryRatio: ca > 0 ? (lastRecord.expenses.salaries / ca) * 100 : 0,
      productivityPerHour: lastRecord.expenses.hoursWorked > 0 ? ca / lastRecord.expenses.hoursWorked : 0,
      costPerHour: lastRecord.expenses.hoursWorked > 0 ? lastRecord.expenses.salaries / lastRecord.expenses.hoursWorked : 0,
    };
  })() : null;

  const handlePrint = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow || !reportRef.current) {
        setIsGenerating(false);
        return;
      }

      const safeTitle = escapeHtml(client.companyName || 'Rapport');
      const styles = `
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
      `;
      // Sécurité : cloner le DOM React au lieu d'injecter innerHTML brut
      // Les scripts éventuels ne sont pas exécutés car on utilise cloneNode
      const cloned = reportRef.current.cloneNode(true) as HTMLElement;
      // Supprimer tout script/event handler potentiel injecté
      cloned.querySelectorAll('script').forEach(s => s.remove());
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Rapport ${safeTitle} - ${selectedYear}</title><style>${styles}</style></head><body></body></html>`);
      printWindow.document.body.appendChild(cloned);
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
      <div role="dialog" aria-modal="true" aria-labelledby="report-modal-title" className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-brand-600" />
            <h2 id="report-modal-title" className="text-lg font-bold text-slate-800">Rapport Mensuel</h2>
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
            <button onClick={onClose} aria-label="Fermer" className="p-2 hover:bg-slate-100 rounded-lg transition">
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

            {/* Financial Ratios Section */}
            {reportRatios && (
              <div className="section">
                <h3>Ratios Financiers <span style={{ fontSize: '11px', fontWeight: 400, color: '#94a3b8' }}>({lastRecord?.month} {selectedYear})</span></h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div className="kpi-card">
                    <div className="kpi-label">DSO</div>
                    <div className="kpi-value" style={{ color: '#0891b2', fontSize: '18px' }}>{reportRatios.dso.toFixed(0)} j</div>
                    <div className="kpi-label" style={{ marginTop: '2px' }}>Délai encaissement</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">DPO</div>
                    <div className="kpi-value" style={{ color: '#be123c', fontSize: '18px' }}>{reportRatios.dpo.toFixed(0)} j</div>
                    <div className="kpi-label" style={{ marginTop: '2px' }}>Délai paiement</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">DIO</div>
                    <div className="kpi-value" style={{ color: '#d97706', fontSize: '18px' }}>{reportRatios.dio.toFixed(0)} j</div>
                    <div className="kpi-label" style={{ marginTop: '2px' }}>Rotation stocks</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">BFR en jours</div>
                    <div className="kpi-value" style={{ color: reportRatios.bfrDays > 60 ? '#dc2626' : '#0f172a', fontSize: '18px' }}>{reportRatios.bfrDays.toFixed(0)} j</div>
                    <div className="kpi-label" style={{ marginTop: '2px' }}>de CA</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                  <div className="kpi-card">
                    <div className="kpi-label">Masse Salariale</div>
                    <div className="kpi-value" style={{ color: reportRatios.salaryRatio > 50 ? '#dc2626' : '#7c3aed', fontSize: '18px' }}>{reportRatios.salaryRatio.toFixed(1)}%</div>
                    <div className="kpi-label" style={{ marginTop: '2px' }}>du CA</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">CA / Heure</div>
                    <div className="kpi-value" style={{ color: '#059669', fontSize: '18px' }}>{reportRatios.productivityPerHour.toFixed(0)} €</div>
                    <div className="kpi-label" style={{ marginTop: '2px' }}>Productivité</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Coût / Heure</div>
                    <div className="kpi-value" style={{ color: '#ea580c', fontSize: '18px' }}>{reportRatios.costPerHour.toFixed(0)} €</div>
                    <div className="kpi-label" style={{ marginTop: '2px' }}>Masse salariale</div>
                  </div>
                </div>
              </div>
            )}

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
                      <th style={{ textAlign: 'right' }}>Perf.</th>
                      <th style={{ textAlign: 'right' }}>Marge %</th>
                      <th style={{ textAlign: 'right' }}>Trésorerie</th>
                      <th style={{ textAlign: 'right' }}>BFR</th>
                      <th style={{ textAlign: 'right' }}>Masse Sal.</th>
                      <th style={{ textAlign: 'right' }}>Heures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearData.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.month}</td>
                        <td className="num">{formatCurrency(r.revenue.total)}</td>
                        <td className="num">{formatCurrency(r.revenue.objective)}</td>
                        <td className={`num ${r.revenue.objective > 0 && r.revenue.total >= r.revenue.objective ? 'positive' : ''}`}>
                          {r.revenue.objective > 0 ? ((r.revenue.total / r.revenue.objective) * 100).toFixed(0) + '%' : '-'}
                        </td>
                        <td className="num">{(r.margin?.rate || 0).toFixed(1)}%</td>
                        <td className={`num ${r.cashFlow.treasury < 0 ? 'negative' : 'positive'}`}>{formatCurrency(r.cashFlow.treasury)}</td>
                        <td className="num">{formatCurrency(r.bfr.total)}</td>
                        <td className="num">{formatCurrency(r.expenses.salaries)}</td>
                        <td className="num">{r.expenses.hoursWorked.toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                    {/* Totals */}
                    <tr style={{ fontWeight: 800, borderTop: '2px solid #0f172a' }}>
                      <td>TOTAL / MOY.</td>
                      <td className="num">{formatCurrency(totalCA)}</td>
                      <td className="num">{formatCurrency(totalObjective)}</td>
                      <td className="num">{totalObjective > 0 ? ((totalCA / totalObjective) * 100).toFixed(0) + '%' : '-'}</td>
                      <td className="num">{avgMargin.toFixed(1)}%</td>
                      <td className={`num ${lastTreasury < 0 ? 'negative' : 'positive'}`}>{formatCurrency(lastTreasury)}</td>
                      <td className="num">{formatCurrency(avgBfr)}</td>
                      <td className="num">{formatCurrency(totalSalaries)}</td>
                      <td className="num">{totalHours.toLocaleString('fr-FR')}</td>
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
