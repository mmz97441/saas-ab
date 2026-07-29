import React from 'react';
import {
  X, DollarSign, Percent, Landmark, Briefcase,
  TrendingUp, Info, AlertTriangle, AlertOctagon,
} from 'lucide-react';
import { FinancialRecord } from '../types';
import {
  KpiData, KpiInsight, InsightSeverity,
  revenueInsights, marginInsights, treasuryInsights, bfrInsights,
  eur, pct, jours,
} from '../lib/kpiInsights';

export type KpiType = 'revenue' | 'margin' | 'treasury' | 'bfr';

interface KpiDetailModalProps {
  kpiType: KpiType;
  kpis: KpiData;
  snapshotRecord: FinancialRecord | null;
  onClose: () => void;
  /** Mode présentation TV : polices et espacements agrandis pour lecture à distance. */
  isPresentationMode?: boolean;
}

const SEVERITY: Record<InsightSeverity, { wrap: string; title: string; icon: React.ReactNode }> = {
  positive: { wrap: 'bg-emerald-50 border-emerald-200', title: 'text-emerald-800', icon: <TrendingUp className="w-4 h-4 text-emerald-600" /> },
  info: { wrap: 'bg-brand-50 border-brand-100', title: 'text-brand-800', icon: <Info className="w-4 h-4 text-brand-500" /> },
  warn: { wrap: 'bg-amber-50 border-amber-200', title: 'text-amber-800', icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
  critical: { wrap: 'bg-red-50 border-red-200', title: 'text-red-800', icon: <AlertOctagon className="w-4 h-4 text-red-600" /> },
};

const CONFIG: Record<KpiType, { label: string; icon: React.ReactNode; accent: string }> = {
  revenue: { label: "Chiffre d'Affaires", icon: <DollarSign className="w-5 h-5" />, accent: 'text-brand-600 bg-brand-50' },
  margin: { label: 'Taux de Marge', icon: <Percent className="w-5 h-5" />, accent: 'text-purple-600 bg-purple-50' },
  treasury: { label: 'Trésorerie Nette', icon: <Landmark className="w-5 h-5" />, accent: 'text-emerald-600 bg-emerald-50' },
  bfr: { label: 'Besoin en Fonds de Roulement', icon: <Briefcase className="w-5 h-5" />, accent: 'text-cyan-600 bg-cyan-50' },
};

const KpiDetailModal: React.FC<KpiDetailModalProps> = ({ kpiType, kpis, snapshotRecord, onClose, isPresentationMode }) => {
  const cfg = CONFIG[kpiType];
  const pm = !!isPresentationMode;

  // Jeu de tailles adaptatif : "bureau" vs "présentation TV" (lecture à distance).
  const sz = {
    body: pm ? 'text-xl' : 'text-sm',
    rowLabel: pm ? 'text-xl' : 'text-sm',
    rowValue: pm ? 'text-xl' : 'text-sm',
    headline: pm ? 'text-5xl' : 'text-2xl',
    title: pm ? 'text-3xl' : 'text-xl',
    eyebrow: pm ? 'text-sm tracking-widest' : 'eyebrow',
    pad: pm ? 'p-7' : 'p-5',
    maxW: pm ? 'max-w-3xl' : 'max-w-lg',
  };

  const Row: React.FC<{ label: string; value: string; strong?: boolean; danger?: boolean }> = ({ label, value, strong, danger }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-paper-100 last:border-0">
      <span className={`${sz.rowLabel} text-paper-600`}>{label}</span>
      <span className={`${sz.rowValue} font-mono tabular-nums ${danger ? 'text-red-700 font-bold' : strong ? 'text-paper-900 font-bold' : 'text-paper-800'}`}>{value}</span>
    </div>
  );

  let headline = '';
  let insights: KpiInsight[] = [];
  let breakdown: React.ReactNode = null;

  if (kpiType === 'revenue') {
    headline = eur(kpis.revenue);
    insights = revenueInsights(kpis);
    breakdown = kpis.topActivities.length > 0 ? (
      <div>
        <p className={`${sz.eyebrow} text-paper-500 mb-2`}>Répartition par activité</p>
        <div className="space-y-0.5">
          {kpis.topActivities.map((a) => (
            <div key={a.id} className="py-1.5 border-b border-paper-100 last:border-0">
              <div className="flex items-center justify-between">
                <span className={`${sz.rowLabel} font-medium text-paper-800 truncate pr-2`}>{a.name}</span>
                <span className={`${sz.rowValue} font-mono tabular-nums text-paper-800`}>{eur(a.val)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className={`${pm ? 'h-2.5' : 'h-1.5'} flex-1 bg-paper-100 rounded-full overflow-hidden`}>
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(a.percent, 100)}%` }} />
                </div>
                <span className={`${pm ? 'text-base w-40' : 'text-xs w-24'} text-paper-500 text-right`}>
                  {pct(a.percent)}{a.marginRate > 0 ? ` · marge ${pct(a.marginRate)}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <p className={`${sz.body} text-paper-500`}>Aucune ventilation d'activité saisie sur la période.</p>
    );
  } else if (kpiType === 'margin') {
    headline = kpis.marginUnset ? 'Non renseigné' : pct(kpis.globalMarginRate);
    insights = marginInsights(kpis);
    breakdown = kpis.marginUnset ? null : (
      <div>
        <p className={`${sz.eyebrow} text-paper-500 mb-2`}>Décomposition</p>
        <Row label="Taux de marge global" value={pct(kpis.globalMarginRate)} strong />
        {kpis.marginVariation !== null && (
          <Row label="Variation vs N-1" value={`${kpis.marginVariation >= 0 ? '+' : ''}${kpis.marginVariation.toFixed(1)} pts`} danger={kpis.marginVariation < 0} />
        )}
        <Row label="Masse salariale / CA" value={pct(kpis.masseSalarialeRate)} />
        <Row label="CA par heure travaillée" value={eur(kpis.caPerHour)} />
        <Row label="Coût salarial par heure" value={eur(kpis.costPerHour)} />
      </div>
    );
  } else if (kpiType === 'treasury') {
    headline = eur(kpis.treasury);
    insights = treasuryInsights(kpis, snapshotRecord);
    const cf = snapshotRecord?.cashFlow;
    const recv = snapshotRecord?.bfr.receivables;
    breakdown = (
      <div>
        <p className={`${sz.eyebrow} text-paper-500 mb-2`}>Composition (dernier mois)</p>
        {cf ? (
          <>
            <Row label="Disponibilités (actif)" value={eur(cf.active)} />
            <Row label="Découverts / dettes bancaires (passif)" value={eur(cf.passive)} />
            <Row label="Trésorerie nette" value={eur(cf.treasury)} strong danger={cf.treasury < 0} />
          </>
        ) : (
          <p className={`${sz.body} text-paper-500`}>Pas de détail de trésorerie sur la période.</p>
        )}
        {recv && <Row label="dont créances clients à encaisser" value={eur(recv.clients)} />}
        <Row label="Délai moyen de paiement clients (DSO)" value={jours(kpis.dso)} />
      </div>
    );
  } else {
    headline = eur(kpis.bfr);
    insights = bfrInsights(kpis);
    const b = snapshotRecord?.bfr;
    breakdown = (
      <div>
        <p className={`${sz.eyebrow} text-paper-500 mb-2`}>Composantes (dernier mois)</p>
        {b ? (
          <>
            <Row label="Créances (clients, état, social…)" value={eur(b.receivables.total)} />
            <Row label="Stock" value={eur(b.stock.total)} />
            <Row label="Dettes courantes (fournisseurs, fisc., soc.)" value={`− ${eur(b.debts.total)}`} />
            <Row label="BFR" value={eur(b.total)} strong />
          </>
        ) : (
          <p className={`${sz.body} text-paper-500`}>Pas de détail BFR sur la période.</p>
        )}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { l: 'DSO', v: jours(kpis.dso), s: 'clients' },
            { l: 'DPO', v: jours(kpis.dpo), s: 'fourn.' },
            { l: 'DIO', v: jours(kpis.dio), s: 'stock' },
            { l: 'BFR', v: jours(kpis.bfrDays), s: 'jours CA' },
          ].map((x) => (
            <div key={x.l} className="flex flex-col items-center p-2 rounded-lg bg-paper-50 border border-paper-200">
              <span className={`${pm ? 'text-sm' : 'text-xs'} font-bold uppercase tracking-wider text-paper-400`}>{x.l}</span>
              <span className={`font-display ${pm ? 'text-3xl' : 'text-lg'} font-semibold tabular-nums text-paper-800`}>{x.v}</span>
              <span className={`${pm ? 'text-sm' : 'text-xs'} text-paper-400`}>{x.s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Détail ${cfg.label}`}
        className={`bg-white rounded-2xl shadow-paper-xl w-full ${sz.maxW} overflow-hidden border border-paper-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in duration-300`}
      >
        {/* Header */}
        <div className={`bg-paper-50 ${sz.pad} border-b border-paper-200 flex justify-between items-start shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cfg.accent}`}>{cfg.icon}</div>
            <div>
              <p className={`${sz.eyebrow} text-paper-500`}>Analyse détaillée</p>
              <h2 className={`font-display ${sz.title} font-semibold text-paper-900`}>{cfg.label}</h2>
              <p className={`font-display ${sz.headline} font-semibold text-paper-900 tabular-nums mt-0.5`}>{headline}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" title="Fermer" className="p-2 bg-white rounded-full text-paper-500 hover:text-brand-900 hover:bg-paper-100 transition">
            <X className={pm ? 'w-7 h-7' : 'w-5 h-5'} />
          </button>
        </div>

        {/* Body */}
        <div className={`${sz.pad} overflow-y-auto space-y-5`}>
          {breakdown}

          {/* Analyses croisées */}
          <div>
            <p className={`${sz.eyebrow} text-paper-500 mb-2`}>Analyses croisées</p>
            {insights.length === 0 ? (
              <p className={`${sz.body} text-paper-500`}>Rien à signaler sur cet indicateur pour la période sélectionnée.</p>
            ) : (
              <div className="space-y-2">
                {insights.map((ins, i) => {
                  const s = SEVERITY[ins.severity];
                  return (
                    <div key={i} className={`flex items-start gap-2.5 ${pm ? 'p-4' : 'p-3'} rounded-lg border ${s.wrap}`}>
                      <span className="shrink-0 mt-0.5">{s.icon}</span>
                      <div>
                        <p className={`${pm ? 'text-xl' : 'text-sm'} font-bold ${s.title}`}>{ins.title}</p>
                        <p className={`${sz.body} text-paper-700 leading-snug mt-0.5`}>{ins.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiDetailModal;
