import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, LayoutDashboard, FilePlus, MessageSquare, BarChart3, CheckCircle } from 'lucide-react';

interface OnboardingTourProps {
  onComplete: () => void;
  userRole: 'ab_consultant' | 'client';
}

const CLIENT_STEPS = [
  {
    icon: LayoutDashboard,
    title: "Votre Tableau de Bord",
    description: "Visualisez vos indicateurs financiers clés : chiffre d'affaires, trésorerie, BFR et marge. Les graphiques interactifs vous permettent de suivre votre performance mois par mois.",
    tip: "Cliquez sur un mois dans le graphique pour filtrer les données."
  },
  {
    icon: FilePlus,
    title: "Saisie Mensuelle",
    description: "Chaque mois, saisissez vos données d'exploitation : CA, charges, trésorerie, BFR. Vous pouvez sauvegarder un brouillon et soumettre quand vous êtes prêt.",
    tip: "Le bouton 'Sauvegarder' enregistre sans verrouiller. 'Soumettre' envoie au consultant."
  },
  {
    icon: BarChart3,
    title: "Historique & Export",
    description: "Retrouvez l'ensemble de vos saisies passées, leur statut de validation, et exportez vos données au format CSV pour votre comptable.",
    tip: "Les données 'En attente' sont en cours de vérification par votre consultant."
  },
  {
    icon: MessageSquare,
    title: "Échangez avec votre Consultant",
    description: "Utilisez la messagerie intégrée pour poser vos questions directement à votre consultant. Vous pouvez aussi utiliser l'assistant IA pour des réponses instantanées.",
    tip: "L'assistant IA est disponible 24h/24, votre consultant répond aux heures ouvrées."
  },
];

const CONSULTANT_STEPS = [
  {
    icon: LayoutDashboard,
    title: "Cockpit de Pilotage",
    description: "Vue d'ensemble de votre portefeuille clients avec les alertes prioritaires : trésoreries négatives, rapports en attente de validation, messages non lus.",
    tip: "Les clients sont triés par urgence. Ceux qui nécessitent une action apparaissent en premier."
  },
  {
    icon: FilePlus,
    title: "Gestion des Dossiers",
    description: "Créez et configurez les dossiers clients, définissez les centres de profit, activez les modules (marge commerciale, carburant) et paramétrez les objectifs.",
    tip: "Chaque client peut avoir des modules différents activés selon son secteur d'activité."
  },
  {
    icon: MessageSquare,
    title: "Messagerie Centralisée",
    description: "Accédez à toutes les conversations clients depuis un seul écran. Utilisez les réponses rapides pour gagner du temps.",
    tip: "Vos réponses apparaissent directement dans le chat du client."
  },
  {
    icon: BarChart3,
    title: "Validation & Publication",
    description: "Vérifiez les saisies clients, validez-les puis publiez pour rendre les données visibles. Ajoutez votre commentaire d'expert mensuel.",
    tip: "Les données ne sont visibles par le client qu'après publication."
  },
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, userRole }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = userRole === 'client' ? CLIENT_STEPS : CONSULTANT_STEPS;
  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  const handleComplete = () => {
    localStorage.setItem('ab-onboarding-done', 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Progress */}
        <div className="flex gap-1 p-3 bg-brand-50">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= currentStep ? 'bg-brand-600' : 'bg-brand-200'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-brand-50 flex items-center justify-center">
            <Icon className="w-8 h-8 text-brand-600" />
          </div>
          <h2 className="text-xl font-bold text-brand-900 mb-3">{step.title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">{step.description}</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Astuce :</strong> {step.tip}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <button
            onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : handleComplete()}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            {currentStep > 0 ? <><ArrowLeft className="w-4 h-4" /> Précédent</> : 'Passer'}
          </button>
          <button
            onClick={() => isLast ? handleComplete() : setCurrentStep(currentStep + 1)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 transition shadow-sm"
          >
            {isLast ? <><CheckCircle className="w-4 h-4" /> C'est parti !</> : <>Suivant <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>

        {/* Skip */}
        <div className="text-center pb-4">
          <button onClick={handleComplete} className="text-[10px] text-slate-400 hover:text-slate-600 transition">
            Ne plus afficher ce guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
