import React, { useState } from 'react';
import { HelpCircle, BookOpen, BarChart3, FileText, MessageSquare, ChevronDown, ChevronRight, Calculator, ArrowRight, RefreshCw, Mail, Phone } from 'lucide-react';

interface HelpViewProps {
  userRole: 'ab_consultant' | 'client';
  onRestartTour?: () => void;
}

// ─── FAQ DATA ──────────────────────────────────────────────
const CLIENT_FAQ: { q: string; a: string }[] = [
  {
    q: "Quand dois-je saisir mes données mensuelles ?",
    a: "Idéalement dans les 10 premiers jours du mois suivant. Par exemple, saisissez les données de janvier avant le 10 février. Cela permet à votre consultant de préparer le rendez-vous mensuel avec des données à jour."
  },
  {
    q: "Où trouver les chiffres à saisir ?",
    a: "La plupart des données se trouvent dans votre logiciel comptable ou votre balance mensuelle :\n• CA et marge : journal de ventes ou balance des comptes 70x\n• Créances clients : solde du compte 411\n• Dettes fournisseurs : solde du compte 401\n• Stock : inventaire ou estimation mensuelle\n• Trésorerie : relevés bancaires (soldes créditeurs et débiteurs)\n• Masse salariale : journal de paie ou total brut chargé\n• Heures : pointage ou planning"
  },
  {
    q: "Je me suis trompé dans une saisie, comment corriger ?",
    a: "Tant que vos données n'ont pas été validées par votre consultant, vous pouvez les modifier en retournant dans la page de saisie et en sélectionnant le mois concerné. Si la saisie est déjà validée, contactez votre consultant pour demander un déblocage."
  },
  {
    q: "Quelle est la différence entre Brouillon, Soumis et Validé ?",
    a: "• Brouillon : vous avez commencé la saisie mais ne l'avez pas finalisée. Vous pouvez y revenir à tout moment.\n• Soumis : vous avez cliqué sur 'Soumettre', les données sont envoyées à votre consultant pour vérification.\n• Validé : votre consultant a vérifié et approuvé les données. Elles sont désormais figées.\n• Publié : les données apparaissent dans votre dashboard avec le commentaire expert."
  },
  {
    q: "Que signifient les alertes rouges sur mon dashboard ?",
    a: "Les indicateurs rouges signalent des points de vigilance :\n• Trésorerie négative : votre entreprise est en découvert, action urgente nécessaire.\n• BFR > 60 jours : votre besoin de financement est élevé, il faut analyser les causes.\n• Masse salariale > 50% du CA : les charges de personnel pèsent fortement sur votre rentabilité.\n• Objectif non atteint : le CA est inférieur à la cible fixée avec votre consultant."
  },
  {
    q: "À quoi sert l'assistant IA (chatbot) ?",
    a: "L'assistant IA est disponible 24h/24 pour répondre à vos questions sur vos données financières, expliquer un indicateur, ou vous donner des conseils généraux. Pour les questions stratégiques ou complexes, il peut transférer la conversation à votre consultant."
  },
  {
    q: "Comment lire les ratios financiers (DSO, DPO, DIO) ?",
    a: "Ces ratios expriment votre BFR en nombre de jours :\n• DSO (Days Sales Outstanding) : nombre de jours moyen pour encaisser vos clients. Plus c'est bas, mieux c'est.\n• DPO (Days Payable Outstanding) : nombre de jours moyen pour payer vos fournisseurs. Plus c'est haut, plus vous gardez votre trésorerie.\n• DIO (Days Inventory Outstanding) : nombre de jours de stock. Plus c'est bas, plus votre stock tourne vite.\n• BFR en jours = DSO + DIO - DPO. Objectif : le réduire au maximum."
  },
];

const CONSULTANT_FAQ: { q: string; a: string }[] = [
  {
    q: "Comment ajouter un nouveau client ?",
    a: "Allez dans la section 'Clients' et cliquez sur '+ Nouveau client'. Renseignez les informations de l'entreprise, configurez les modules (marge commerciale, carburant) et les centres de profit. Le client recevra un email d'invitation pour créer son compte."
  },
  {
    q: "Comment configurer les centres de profit d'un client ?",
    a: "Dans les Paramètres du client (icône engrenage), section 'Centres de Profit', vous pouvez ajouter des activités (ex: Vente, Services, Formation). Chaque centre peut être de type 'Marchandises' ou 'Services' avec une marge théorique par défaut."
  },
  {
    q: "Comment valider et publier une saisie client ?",
    a: "1. Le client soumet ses données (statut 'Soumis')\n2. Accédez au dashboard du client et vérifiez les données\n3. Cliquez sur 'Valider' pour approuver\n4. Ajoutez votre commentaire d'expert mensuel\n5. Cliquez sur 'Publier' pour rendre visible au client"
  },
  {
    q: "Comment gérer les permissions de mon équipe ?",
    a: "Dans la section 'Équipe', vous pouvez attribuer des niveaux de permission :\n• Admin : accès complet, gestion de l'équipe\n• Senior : peut valider et publier les saisies\n• Junior : peut consulter et saisir, mais pas valider\n• Lecture seule : consultation uniquement"
  },
  {
    q: "Comment interpréter les ratios financiers ?",
    a: "Les ratios du dashboard sont calculés automatiquement :\n• DSO = (Créances Clients / CA) × 30 jours\n• DPO = (Dettes Fournisseurs / Achats) × 30 jours\n• DIO = (Stock / Achats) × 30 jours\n• BFR en jours = DSO + DIO - DPO\n• Achats est estimé comme CA - Marge brute\n\nSeuils d'alerte : BFR > 60j (rouge), Masse salariale > 50% (rouge)"
  },
];

// ─── DIDACTICIEL OFFICIEL AB CONSULTANTS ─────────────────
const SAISIE_GUIDE = [
  {
    section: "Activité",
    partie: "PARTIE 1",
    icon: "💰",
    fields: [
      {
        name: "Chiffre d'Affaires (CA)",
        source: "Balance comptable — comptes 70x",
        tip: "Le chiffre d'affaires correspond au montant des ventes hors taxes réalisées auprès des tiers, dans le cadre de l'activité de l'entreprise. Ce montant est net de tous rabais, remises et ristournes accordées."
      },
    ]
  },
  {
    section: "Trésorerie",
    partie: "PARTIE 2",
    icon: "🏦",
    fields: [
      {
        name: "Situation de trésorerie",
        source: "Relevés bancaires + caisse",
        tip: "La situation de trésorerie est représentée par la différence entre la trésorerie positive (soldes créditeurs de banque, caisse, placements...) et la trésorerie négative (découvert bancaire, avance sur marchandises, etc.)."
      },
    ]
  },
  {
    section: "BFR — Créances (Combien vous doivent vos partenaires ?)",
    partie: "PARTIE 3A",
    icon: "📥",
    intro: "Il s'agit du total des CRÉANCES de l'entreprise au dernier jour de la période concernée.",
    fields: [
      {
        name: "Créances clients",
        source: "Balance âgée — solde du compte 411",
        tip: "Les créances clients correspondent aux créances commerciales, y compris les effets à recevoir, les créances recouvrables, les clients douteux ainsi que les chèques à encaisser quelle que soit la date d'encaissement. En d'autres termes, ce sont les créances à moins d'un an."
      },
      {
        name: "Créances État",
        source: "Compte 44567 (TVA à récupérer) + acomptes IS",
        tip: "Les créances vis-à-vis de l'État concernent principalement des remboursements d'impôts, de TVA et de taxes diverses."
      },
      {
        name: "Créances organismes sociaux",
        source: "Comptes 43x (CGSS, URSSAF, Pôle Emploi...)",
        tip: "Ce poste comprend les créances vis-à-vis des organismes sociaux (CGSS, Pôle Emploi, AGIRC-ARRCO et prévoyance, Retraite complémentaire, Caisse congés payés du bâtiment, URSSAF, RSI...)."
      },
      {
        name: "Créances salariés",
        source: "Comptes 425 (avances et acomptes)",
        tip: "Il s'agit du montant des sommes dues par les salariés à l'entreprise, notamment les avances sur salaires."
      },
      {
        name: "Autres créances (Associés, etc.)",
        source: "Comptes 46x, avances et acomptes",
        tip: "Ce poste comprend les sommes dues par des tiers à la société (hors État, fournisseurs et salariés). Il peut s'agir, notamment, de « prêts » consentis par la société."
      },
    ]
  },
  {
    section: "BFR — Dettes (Combien devez-vous à vos partenaires ?)",
    partie: "PARTIE 3B",
    icon: "📤",
    intro: "Il s'agit du total des DETTES de l'entreprise au dernier jour de la période concernée.",
    fields: [
      {
        name: "Dettes fournisseurs",
        source: "Balance âgée — solde du compte 401",
        tip: "Les dettes fournisseurs correspondent aux sommes dues à tous les fournisseurs de l'entreprise (frais généraux, marchandises et/ou matières premières, transitaires, sous-traitants, etc.). Elles ne tiennent pas compte, en revanche, des dettes vis-à-vis des fournisseurs d'immobilisations (investissements)."
      },
      {
        name: "Dettes État",
        source: "Compte 4455 (TVA à payer) + IS à payer",
        tip: "Les dettes vis-à-vis de l'État concernent principalement les dettes relatives aux impôts (IS, contribution économique territoriale, CVAE) ou encore la TVA.\n\nATTENTION : ce poste doit être calculé au prorata lorsque le règlement de la TVA est effectué trimestriellement. Basez-vous sur le montant de votre TVA du trimestre précédent divisé par 3."
      },
      {
        name: "Dettes organismes sociaux",
        source: "Comptes 43x côté créditeur (CGSS, URSSAF...)",
        tip: "Ce poste comprend les dettes auprès des organismes sociaux (CGSS, Pôle Emploi, AGIRC-ARRCO et prévoyance, Retraite complémentaire, Caisse congés payés du bâtiment, URSSAF, RSI).\n\nATTENTION : ce poste doit être calculé au prorata. Basez-vous sur le montant de vos cotisations sociales du trimestre précédent divisé par 3."
      },
      {
        name: "Dettes salariés",
        source: "Salaires nets à payer — compte 421",
        tip: "Il s'agit du montant des sommes dues aux salariés de l'entreprise, notamment le dernier mois de salaire, quand celui-ci est réglé au début du mois suivant."
      },
    ]
  },
  {
    section: "BFR — Stocks",
    partie: "PARTIE 3C",
    icon: "📦",
    fields: [
      {
        name: "Valeur du stock",
        source: "Inventaire physique ou estimation",
        tip: "Il s'agit de la valeur du stock sous réserve d'un inventaire précis (stock réel et stock flottant)."
      },
    ]
  },
  {
    section: "Charges de Personnel",
    partie: "COMPLÉMENT",
    icon: "👥",
    fields: [
      {
        name: "Masse salariale",
        source: "Journal de paie — total brut chargé (charges patronales incluses)",
        tip: "Incluez toutes les charges sociales patronales."
      },
      {
        name: "Heures travaillées",
        source: "Planning / pointeuse / logiciel RH",
        tip: "Total des heures pour l'ensemble des salariés."
      },
    ]
  },
];

// ─── GLOSSAIRE ÉTENDU ──────────────────────────────────────
const GLOSSARY_EXTENDED: { term: string; definition: string; formula?: string }[] = [
  { term: "Chiffre d'Affaires (CA)", definition: "Total des ventes HT sur la période. Premier indicateur de l'activité.", formula: "CA = Ventes marchandises + Prestations services" },
  { term: "Marge Commerciale", definition: "Différence entre le prix de vente et le coût d'achat. Mesure la rentabilité brute.", formula: "Marge = CA - Achats consommés" },
  { term: "Taux de Marge", definition: "Marge exprimée en pourcentage du CA.", formula: "Taux = (Marge / CA) × 100" },
  { term: "BFR (Besoin en Fonds de Roulement)", definition: "Montant nécessaire pour financer le décalage entre encaissements et décaissements.", formula: "BFR = Créances + Stocks - Dettes courantes" },
  { term: "Trésorerie Nette", definition: "Argent disponible immédiatement = soldes bancaires créditeurs - découverts.", formula: "Trésorerie = Actif de trésorerie - Passif de trésorerie" },
  { term: "DSO (Days Sales Outstanding)", definition: "Délai moyen d'encaissement des créances clients, en jours. Plus le DSO est bas, plus vous encaissez vite.", formula: "DSO = (Créances Clients / CA) × 30 jours" },
  { term: "DPO (Days Payable Outstanding)", definition: "Délai moyen de paiement de vos fournisseurs, en jours. Un DPO élevé préserve votre trésorerie.", formula: "DPO = (Dettes Fournisseurs / Achats) × 30 jours" },
  { term: "DIO (Days Inventory Outstanding)", definition: "Durée moyenne de rotation des stocks, en jours. Plus le DIO est bas, plus vos stocks tournent vite.", formula: "DIO = (Stock / Achats) × 30 jours" },
  { term: "BFR en jours", definition: "Expression du BFR en nombre de jours de CA. Permet de comparer entre entreprises de tailles différentes.", formula: "BFR jours = DSO + DIO - DPO" },
  { term: "Ratio Masse Salariale", definition: "Part des charges de personnel dans le CA. Au-delà de 50%, signal d'alerte.", formula: "Ratio = (Masse salariale / CA) × 100" },
  { term: "Productivité (CA/h)", definition: "Chiffre d'affaires généré par heure de travail. Indicateur d'efficacité opérationnelle.", formula: "Productivité = CA / Heures travaillées" },
  { term: "Coût horaire", definition: "Coût salarial par heure de travail.", formula: "Coût/h = Masse salariale / Heures travaillées" },
  { term: "N-1", definition: "Données de la même période l'année précédente. Permet de mesurer l'évolution annuelle." },
  { term: "Objectif", definition: "Cible de CA définie avec votre consultant en début d'exercice pour piloter votre activité." },
];

// ─── COMPONENT ─────────────────────────────────────────────
const HelpView: React.FC<HelpViewProps> = ({ userRole, onRestartTour }) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'saisie' | 'dashboard' | 'glossaire'>('faq');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);

  const faqData = userRole === 'client' ? CLIENT_FAQ : CONSULTANT_FAQ;

  const tabs = userRole === 'client'
    ? [
        { id: 'faq' as const, label: 'Questions fréquentes', icon: HelpCircle },
        { id: 'saisie' as const, label: 'Guide de saisie', icon: FileText },
        { id: 'dashboard' as const, label: 'Comprendre le dashboard', icon: BarChart3 },
        { id: 'glossaire' as const, label: 'Glossaire', icon: BookOpen },
      ]
    : [
        { id: 'faq' as const, label: 'Questions fréquentes', icon: HelpCircle },
        { id: 'glossaire' as const, label: 'Glossaire & Ratios', icon: BookOpen },
      ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-brand-500" /> Aide & Guide
        </h2>
        {onRestartTour && (
          <button
            onClick={onRestartTour}
            className="flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-bold hover:bg-brand-100 transition"
          >
            <RefreshCw className="w-4 h-4" /> Revoir le guide de démarrage
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── FAQ TAB ────────────────────────────────────── */}
      {activeTab === 'faq' && (
        <div className="space-y-2">
          {faqData.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition"
              >
                <span className="font-bold text-sm text-slate-800 pr-4">{item.q}</span>
                {expandedFaq === idx ? (
                  <ChevronDown className="w-4 h-4 text-brand-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>
              {expandedFaq === idx && (
                <div className="px-4 pb-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-100 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── GUIDE DE SAISIE (DIDACTICIEL OFFICIEL) TAB ── */}
      {activeTab === 'saisie' && (
        <div className="space-y-3">
          {/* Header didacticiel */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
            <h3 className="font-bold text-brand-900 text-base mb-1">Didacticiel du Tableau de Bord</h3>
            <p className="text-sm text-brand-700">Mission Conseil au Chef d'Entreprise</p>
            <p className="text-xs text-brand-600 mt-2 leading-relaxed">
              Le tableau de bord constitue un outil essentiel du suivi de votre activit&eacute;. Afin de pr&eacute;parer votre rendez-vous mensuel dans des conditions optimales, ce guide vous accompagne pas &agrave; pas pour compl&eacute;ter chaque rubrique.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Conseil :</strong> Pr&eacute;parez votre balance comptable mensuelle et vos relev&eacute;s bancaires avant de commencer la saisie.
          </div>

          {SAISIE_GUIDE.map((section, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setExpandedGuide(expandedGuide === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">{section.icon}</span>
                  <div>
                    <span className="font-bold text-sm text-slate-800">{section.section}</span>
                    {'partie' in section && section.partie && (
                      <span className="ml-2 text-[10px] font-bold text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">{section.partie}</span>
                    )}
                  </div>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{section.fields.length} {section.fields.length > 1 ? 'champs' : 'champ'}</span>
                  {expandedGuide === idx ? (
                    <ChevronDown className="w-4 h-4 text-brand-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>
              {expandedGuide === idx && (
                <div className="border-t border-slate-100">
                  {/* Intro text if present */}
                  {'intro' in section && section.intro && (
                    <div className="px-4 py-3 bg-slate-50 text-sm text-slate-600 italic border-b border-slate-100">
                      {section.intro}
                    </div>
                  )}
                  {section.fields.map((field, fIdx) => (
                    <div key={fIdx} className={`px-4 py-4 ${fIdx > 0 ? 'border-t border-slate-100' : ''}`}>
                      <div className="flex items-start gap-3">
                        <ArrowRight className="w-3.5 h-3.5 text-brand-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-sm text-slate-800">{field.name}</p>
                          <p className="text-xs text-slate-500 mt-1"><span className="font-medium text-slate-600">Source :</span> {field.source}</p>
                          <p className="text-xs text-slate-700 mt-2 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">{field.tip}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Attribution propriété intellectuelle */}
          <div className="text-[10px] text-slate-400 text-center leading-relaxed mt-4 px-4">
            Le pr&eacute;sent didacticiel du tableau de bord de la mission Conseil au Chef d'Entreprise est la propri&eacute;t&eacute; exclusive de la Sarl AB CONSULTANTS qui entend faire valoir ses droits de propri&eacute;t&eacute; intellectuelle conform&eacute;ment aux dispositions des articles L 111-1 et L 123-1 du Code de la Propri&eacute;t&eacute; Intellectuelle.
          </div>
        </div>
      )}

      {/* ─── COMPRENDRE LE DASHBOARD TAB ────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Calculator className="w-4 h-4 text-brand-500" /> Les 4 indicateurs clés (KPIs)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">CA (Chiffre d'Affaires)</p>
                <p className="text-xs text-slate-500 mt-1">Total de vos ventes sur la période sélectionnée. Comparez avec l'objectif et le N-1 pour mesurer votre performance.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">Taux de Marge</p>
                <p className="text-xs text-slate-500 mt-1">Rentabilité brute de votre activité. Si ce taux baisse, vérifiez vos prix de vente et vos coûts d'achat.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">Trésorerie Nette</p>
                <p className="text-xs text-slate-500 mt-1">L'argent disponible sur vos comptes. En rouge = découvert, action urgente. Suivez la tendance mois par mois.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">BFR</p>
                <p className="text-xs text-slate-500 mt-1">Besoin de financement court terme. S'il augmente, vous avez besoin de plus de trésorerie pour fonctionner.</p>
              </div>
            </div>
          </div>

          {/* Ratios */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Les Ratios Financiers</h3>
            <p className="text-sm text-slate-600 mb-3">Ces ratios traduisent votre BFR en nombre de jours, ce qui le rend plus facile à comprendre et à comparer.</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3 p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                <span className="font-bold text-cyan-700 min-w-[40px]">DSO</span>
                <p className="text-slate-600">En combien de jours vos clients vous paient. <strong>Objectif : le réduire.</strong> DSO de 45j = vos clients mettent 45 jours en moyenne pour payer.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
                <span className="font-bold text-rose-700 min-w-[40px]">DPO</span>
                <p className="text-slate-600">En combien de jours vous payez vos fournisseurs. <strong>Objectif : le maintenir raisonnable.</strong> Un DPO trop haut peut dégrader vos relations fournisseurs.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <span className="font-bold text-amber-700 min-w-[40px]">DIO</span>
                <p className="text-slate-600">Durée pendant laquelle vos marchandises restent en stock. <strong>Objectif : le réduire.</strong> Moins de stock dormant = moins d'argent immobilisé.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-brand-50 rounded-lg border border-brand-100">
                <span className="font-bold text-brand-700 min-w-[60px]">BFR (j)</span>
                <p className="text-slate-600">DSO + DIO - DPO. <strong>C'est l'indicateur clé.</strong> Un BFR de 30 jours signifie que vous devez financer 30 jours de CA. Au-delà de 60 jours, c'est une alerte.</p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" /> Les Graphiques</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">CA vs Objectif</p>
                <p className="text-xs text-slate-500 mt-1">Barres bleues = votre CA réel. Ligne = objectif. Cliquez sur un mois pour voir le détail complet.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">Trésorerie</p>
                <p className="text-xs text-slate-500 mt-1">Courbe de votre trésorerie nette mois par mois. Les zones rouges signalent des périodes de découvert.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">CA Cumulé</p>
                <p className="text-xs text-slate-500 mt-1">Evolution de votre CA cumulé vs objectif cumulé vs N-1 cumulé. Permet de visualiser votre trajectoire annuelle.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">Évolution BFR</p>
                <p className="text-xs text-slate-500 mt-1">3 courbes (Créances, Stocks, Dettes) pour comprendre ce qui fait varier votre BFR.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">Tendances par Activité</p>
                <p className="text-xs text-slate-500 mt-1">Si vos centres de profit sont configurés, ce graphique montre l'évolution du CA de chaque activité.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-bold text-slate-700">Évolution des Ratios</p>
                <p className="text-xs text-slate-500 mt-1">DSO, DPO, DIO sous forme de barres + BFR en jours en courbe. Permet de suivre la tendance de vos délais.</p>
              </div>
            </div>
          </div>

          {/* Astuce filtrage */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-brand-800">
            <strong>Astuce :</strong> Cliquez sur un mois dans n'importe quel graphique pour afficher la fiche mensuelle complète avec tous les détails (activité, charges, trésorerie, ratios) et la comparaison N-1.
          </div>
        </div>
      )}

      {/* ─── GLOSSAIRE TAB ──────────────────────────────── */}
      {activeTab === 'glossaire' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {GLOSSARY_EXTENDED.map((entry, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50 transition">
                <h4 className="font-bold text-sm text-brand-900">{entry.term}</h4>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">{entry.definition}</p>
                {entry.formula && (
                  <div className="mt-1.5 px-2 py-1 bg-brand-50 rounded text-[10px] font-mono text-brand-700 inline-block border border-brand-100">
                    {entry.formula}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-500" /> Besoin d'aide supplémentaire ?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="mailto:contact@ab-consultants.fr"
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-brand-50 transition group"
          >
            <Mail className="w-5 h-5 text-brand-500 group-hover:text-brand-600" />
            <div>
              <p className="font-bold text-sm text-slate-700">Email</p>
              <p className="text-xs text-slate-500">contact@ab-consultants.fr</p>
            </div>
          </a>
          <a
            href="tel:+33000000000"
            className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-brand-50 transition group"
          >
            <Phone className="w-5 h-5 text-brand-500 group-hover:text-brand-600" />
            <div>
              <p className="font-bold text-sm text-slate-700">Téléphone</p>
              <p className="text-xs text-slate-500">Contactez votre consultant</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default HelpView;
