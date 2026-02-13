import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

const GLOSSARY: Record<string, { title: string; definition: string; formula?: string }> = {
  ca: {
    title: "Chiffre d'Affaires (CA)",
    definition: "Total des ventes de marchandises et prestations de services hors taxes sur une période donnée. C'est le premier indicateur de l'activité de votre entreprise.",
    formula: "CA = Ventes marchandises HT + Prestations services HT"
  },
  marge: {
    title: "Taux de Marge Commerciale",
    definition: "Différence entre le prix de vente et le coût d'achat des marchandises vendues, exprimée en pourcentage du CA. Indique la rentabilité brute de votre activité commerciale.",
    formula: "Marge (%) = (CA - Achats) / CA × 100"
  },
  bfr: {
    title: "Besoin en Fonds de Roulement (BFR)",
    definition: "Somme d'argent nécessaire pour financer le décalage entre les encaissements clients et les décaissements fournisseurs. Un BFR élevé signifie que vous avez besoin de plus de trésorerie pour fonctionner.",
    formula: "BFR = (Créances + Stocks) - Dettes courantes"
  },
  tresorerie: {
    title: "Trésorerie Nette",
    definition: "Argent disponible immédiatement sur vos comptes bancaires. C'est la différence entre vos soldes créditeurs (placements, comptes positifs) et vos soldes débiteurs (découverts, crédits court terme).",
    formula: "Trésorerie = Soldes créditeurs - Soldes débiteurs"
  },
  creances: {
    title: "Créances",
    definition: "Montants que vos clients ou l'État vous doivent. Cela inclut les factures émises non encore payées, les remboursements de TVA en attente, etc.",
  },
  dettes: {
    title: "Dettes Courantes",
    definition: "Montants que vous devez à vos fournisseurs, à l'État (impôts, TVA), aux organismes sociaux (URSSAF, retraites) et à vos salariés.",
  },
  productivite: {
    title: "Productivité (CA/Heure)",
    definition: "Chiffre d'affaires généré par heure travaillée. Permet de mesurer l'efficacité opérationnelle de votre entreprise.",
    formula: "Productivité = CA Total / Heures travaillées"
  },
  objectif: {
    title: "Objectif de CA",
    definition: "Cible de chiffre d'affaires définie en début d'exercice avec votre consultant. Sert de repère pour mesurer votre avancement mensuel et annuel.",
  },
  n1: {
    title: "N-1 (Année Précédente)",
    definition: "Données de la même période l'année dernière. La comparaison N-1 permet de mesurer votre évolution d'une année sur l'autre et d'identifier les tendances.",
  },
  exercice: {
    title: "Exercice Fiscal",
    definition: "Période comptable de 12 mois qui ne correspond pas forcément à l'année civile. Par exemple, un exercice du 01/04 au 31/03 signifie que votre année financière va d'avril à mars.",
  },
  masse_salariale: {
    title: "Masse Salariale Chargée",
    definition: "Total des salaires bruts + charges patronales + intérim sur le mois. Représente le coût total du personnel pour l'entreprise.",
    formula: "Masse Sal. = Salaires bruts + Charges patronales + Intérim"
  },
  heures: {
    title: "Heures Travaillées",
    definition: "Nombre total d'heures de travail sur le mois (heures normales + heures supplémentaires). Sert à calculer la productivité et le coût horaire.",
  },
  ratio_salarial: {
    title: "Ratio Salarial / CA",
    definition: "Pourcentage du chiffre d'affaires consacré à la masse salariale. Au-delà de 40%, ce ratio mérite attention. Varie selon le secteur d'activité.",
    formula: "Ratio = (Masse Salariale / CA) × 100"
  },
  creances_clients: {
    title: "Créances Clients",
    definition: "Factures émises à vos clients, non encore encaissées. Un montant élevé peut indiquer des délais de paiement trop longs ou des impayés.",
  },
  stocks: {
    title: "Stocks Marchandises",
    definition: "Valeur des marchandises en stock à la fin du mois. Un stock trop important immobilise de la trésorerie.",
  },
  fournisseurs: {
    title: "Dettes Fournisseurs",
    definition: "Factures de vos fournisseurs non encore payées. Des délais de paiement plus longs améliorent votre BFR mais doivent rester raisonnables.",
  },
  dettes_fiscales: {
    title: "Dettes Fiscales (État)",
    definition: "TVA à reverser, impôts et taxes dus à l'État. Inclut la TVA collectée diminuée de la TVA déductible, l'IS, la CFE, etc.",
  },
  dettes_sociales: {
    title: "Dettes Sociales (URSSAF...)",
    definition: "Cotisations sociales dues aux organismes (URSSAF, caisses de retraite, mutuelle, prévoyance). Généralement payées le mois suivant.",
  },
  soldes_crediteurs: {
    title: "Soldes Créditeurs",
    definition: "Comptes courants créditeurs, caisse espèces, livrets et placements disponibles. C'est l'argent immédiatement mobilisable.",
  },
  soldes_debiteurs: {
    title: "Soldes Débiteurs",
    definition: "Découverts autorisés ou non, facilités de caisse, emprunts court terme. Représente l'endettement bancaire à court terme.",
  },
  ventilation: {
    title: "Ventilation Analytique",
    definition: "Répartition du chiffre d'affaires par famille d'activité (centres de profit). Permet d'identifier les activités les plus rentables.",
  },
  marge_commerciale: {
    title: "Suivi Marge Commerciale",
    definition: "Module permettant de calculer et suivre la marge brute (CA - Achats). Activez-le pour analyser la rentabilité par activité.",
    formula: "Marge = Prix de vente HT - Coût d'achat HT"
  },
  carburant: {
    title: "Suivi Carburant",
    definition: "Module optionnel pour suivre la consommation de carburant (Gasoil, Sans Plomb, GNR) en litres par rapport aux objectifs mensuels.",
  },
  dso: {
    title: "DSO - Délai Encaissement",
    definition: "Nombre moyen de jours pour encaisser les factures clients. Plus ce délai est court, meilleure est votre trésorerie.",
    formula: "DSO = (Créances Clients / CA) × 30 jours"
  },
  dpo: {
    title: "DPO - Délai Paiement",
    definition: "Nombre moyen de jours pour payer vos fournisseurs. Un DPO élevé améliore votre trésorerie mais doit respecter les délais légaux (60 jours max).",
    formula: "DPO = (Dettes Fournisseurs / Achats) × 30 jours"
  },
  dio: {
    title: "DIO - Rotation Stock",
    definition: "Nombre moyen de jours de stock. Un DIO faible indique une bonne rotation des marchandises.",
    formula: "DIO = (Stocks / Achats) × 30 jours"
  },
  bfr_jours: {
    title: "BFR en Jours de CA",
    definition: "Nombre de jours de chiffre d'affaires nécessaires pour financer le cycle d'exploitation. Plus ce chiffre est bas, moins votre activité mobilise de trésorerie.",
    formula: "BFR jours = DSO + DIO - DPO"
  },
};

// --- LIGHTWEIGHT HOVER TOOLTIP ("?" icon) ---
// Use this for inline help indicators next to labels/fields
export const InfoTooltip: React.FC<{ text: string; position?: 'top' | 'bottom' }> = ({ text, position = 'top' }) => {
  const [show, setShow] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Auto-adjust position if tooltip would overflow viewport
  useEffect(() => {
    if (show && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (position === 'top' && rect.top < 120) {
        setAdjustedPosition('bottom');
      } else if (position === 'bottom' && rect.bottom > window.innerHeight - 120) {
        setAdjustedPosition('top');
      } else {
        setAdjustedPosition(position);
      }
    }
  }, [show, position]);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center print:hidden"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="cursor-help p-0.5">
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-brand-500 transition-colors" />
      </span>
      {show && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-64 px-3 py-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg shadow-lg leading-relaxed pointer-events-none animate-in fade-in zoom-in-95 duration-100 ${
            adjustedPosition === 'top'
              ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
        >
          {text}
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-slate-200 rotate-45 ${
            adjustedPosition === 'top'
              ? 'bottom-[-5px] border-b border-r'
              : 'top-[-5px] border-t border-l'
          }`} />
        </div>
      )}
    </span>
  );
};

// Shortcut: InfoTooltip from glossary key
export const GlossaryTooltip: React.FC<{ term: string; position?: 'top' | 'bottom' }> = ({ term, position }) => {
  const entry = GLOSSARY[term];
  if (!entry) return null;
  const text = entry.formula ? `${entry.definition} (${entry.formula})` : entry.definition;
  return <InfoTooltip text={text} position={position} />;
};

// Inline glossary icon that triggers a popup
export const GlossaryTerm: React.FC<{ term: keyof typeof GLOSSARY; children?: React.ReactNode }> = ({ term, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const entry = GLOSSARY[term];
  if (!entry) return <>{children}</>;

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="text-brand-400 hover:text-brand-600 transition print:hidden"
        title={`Qu'est-ce que ${entry.title} ?`}
      >
        <HelpCircle className="w-3 h-3" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" role="presentation" aria-hidden="true" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-sm text-brand-900">{entry.title}</h4>
              <button onClick={() => setIsOpen(false)} aria-label="Fermer" className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{entry.definition}</p>
            {entry.formula && (
              <div className="mt-2 px-2 py-1.5 bg-brand-50 rounded text-[10px] font-mono text-brand-700 border border-brand-100">
                {entry.formula}
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
};

// Full glossary panel
const GlossaryPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/50 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="glossary-panel-title" className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-brand-50">
          <h2 id="glossary-panel-title" className="text-lg font-bold text-brand-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand-500" /> Glossaire Financier
          </h2>
          <button onClick={onClose} aria-label="Fermer le glossaire" className="p-1.5 hover:bg-brand-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4 max-h-[60vh]">
          {Object.entries(GLOSSARY).map(([key, entry]) => (
            <div key={key} className="pb-4 border-b border-slate-100 last:border-0">
              <h3 className="font-bold text-sm text-brand-900 mb-1">{entry.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{entry.definition}</p>
              {entry.formula && (
                <div className="mt-1.5 px-2 py-1 bg-slate-50 rounded text-[10px] font-mono text-brand-700 inline-block">
                  {entry.formula}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlossaryPanel;
