import React, { useState } from 'react';
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
  }
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-sm text-brand-900">{entry.title}</h4>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-brand-50">
          <h2 className="text-lg font-bold text-brand-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand-500" /> Glossaire Financier
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-brand-100 rounded-lg transition">
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
