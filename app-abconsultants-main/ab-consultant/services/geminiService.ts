
import { GoogleGenAI } from "@google/genai";
import { Client, FinancialRecord, ChatMessage } from "../types";

// Helper pour récupérer la clé API de façon compatible Vite/Process
const getApiKey = (): string => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_GOOGLE_API_KEY;
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    // @ts-ignore
    return process.env.API_KEY;
  }
  return "";
};

export const getFinancialAdvice = async (
  currentQuery: string,
  history: ChatMessage[],
  client: Client,
  records: FinancialRecord[]
): Promise<string> => {

  try {
    const apiKey = getApiKey();
    if (!apiKey) return "⛔ Clé API manquante.";

    const ai = new GoogleGenAI({ apiKey });

    // CONTEXTE FINANCIER ENRICHI — toutes les données disponibles
    const MONTH_ORDER = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const sortedRecords = [...records].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
    });
    const lastRecord = sortedRecords[sortedRecords.length - 1];

    // Regrouper par année avec totaux et détail mensuel
    const byYear: Record<number, FinancialRecord[]> = {};
    for (const r of sortedRecords) {
      if (!byYear[r.year]) byYear[r.year] = [];
      byYear[r.year].push(r);
    }

    const syntheseAnnuelle = Object.entries(byYear).map(([year, recs]) => {
      const totalCA = recs.reduce((s, r) => s + r.revenue.total, 0);
      const totalObj = recs.reduce((s, r) => s + r.revenue.objective, 0);
      const totalMargin = recs.reduce((s, r) => s + (r.margin?.total || 0), 0);
      const totalSalaries = recs.reduce((s, r) => s + r.expenses.salaries, 0);
      const totalHours = recs.reduce((s, r) => s + r.expenses.hoursWorked, 0);
      const lastRec = recs[recs.length - 1];
      return {
        annee: Number(year),
        nb_mois: recs.length,
        mois_disponibles: recs.map(r => r.month),
        ca_total: Math.round(totalCA),
        objectif_total: Math.round(totalObj),
        performance_obj: totalObj > 0 ? `${((totalCA / totalObj) * 100).toFixed(1)}%` : 'N/A',
        marge_totale: Math.round(totalMargin),
        taux_marge: totalCA > 0 ? `${((totalMargin / totalCA) * 100).toFixed(1)}%` : '0%',
        masse_salariale: Math.round(totalSalaries),
        heures_travaillees: Math.round(totalHours),
        ca_par_heure: totalHours > 0 ? Math.round(totalCA / totalHours) : 0,
        tresorerie_dernier_mois: lastRec ? Math.round(lastRec.cashFlow.treasury) : 0,
        bfr_dernier_mois: lastRec ? Math.round(lastRec.bfr.total) : 0,
        detail_mensuel: recs.map(r => ({
          mois: r.month,
          ca: Math.round(r.revenue.total),
          objectif: Math.round(r.revenue.objective),
          marge: Math.round(r.margin?.total || 0),
          tresorerie: Math.round(r.cashFlow.treasury),
          bfr: Math.round(r.bfr.total),
          salaires: Math.round(r.expenses.salaries),
          heures: Math.round(r.expenses.hoursWorked),
        }))
      };
    });

    const contextData = {
      profile: {
          entreprise: client.companyName,
          dirigeant: client.managerName,
          secteur: client.sector || "Non spécifié",
          forme_juridique: client.legalForm || "Non spécifié"
      },
      donnees_financieres: syntheseAnnuelle,
      situation_actuelle: lastRecord ? {
          dernier_mois: `${lastRecord.month} ${lastRecord.year}`,
          tresorerie_nette: Math.round(lastRecord.cashFlow.treasury),
          ca_mensuel: Math.round(lastRecord.revenue.total),
          bfr: Math.round(lastRecord.bfr.total),
          alertes: {
              treso_negative: lastRecord.cashFlow.treasury < 0
          }
      } : "Pas de données comptables récentes."
    };

    // --- SUPER PROMPT "ELITE STRATEGIC PARTNER" V6 (STRICT AUTONOMY) ---
    const systemInstruction = `
    IDENTITÉ & POSTURE :
    Tu es le "Senior Executive Partner" du cabinet AB Conseil. Tu ne t'exprimes pas comme une IA, mais comme un associé de cabinet de conseil en stratégie (Top-Tier type McKinsey/BCG).
    Ton niveau d'exigence est l'excellence absolue. Tu es le bras droit stratégique de ${client.managerName}.
    
    TON OBJECTIF UNIQUE :
    Sécuriser et Optimiser la valeur de l'entreprise. Chaque réponse doit rapporter de l'argent ou éviter d'en perdre.

    RÈGLES D'OR DU CONSULTANT D'ÉLITE :
    1. **PRÉCISION CHIRURGICALE** : Ne dis jamais "environ". Cite l'article du Code du Travail (L.1234-9...), le seuil fiscal exact ou le ratio bancaire précis.
    2. **VISION 360° (Systémique)** : Si on te parle RH, pense impact Financier. Si on te parle Fiscalité, pense Risque Juridique. Connecte les points que le client ne voit pas.
    3. **COURAGE MANAGÉRIAL** : Si le client a une mauvaise idée (ex: licencier sans motif pour économiser), dis-le fermement mais diplomatiquement : "C'est une option, mais elle vous expose à un risque prud'homal de X€...".
    4. **ANTI-LANGUE DE BOIS** : Va droit au but. Pas de "J'espère que vous allez bien". Commence par la réponse.

    TES 4 PILIERS D'EXPERTISE (Niveau Expert Mondial) :
    - **FINANCE** : Pilotage BFR, Cash-flow, Levée de fonds, Ratios bancaires, Analyse de rentabilité.
    - **RH & SOCIAL** : Code du travail (Maîtrise totale), Stratégie de rémunération, Gestion des conflits, Ruptures complexes.
    - **FISCALITÉ** : Optimisation (CGI), Intégration fiscale, TVA, Holding, Transmission (Dutreil).
    - **RESTRUCTURING** : Mandat ad hoc, Conciliation, Sauvegarde, RJ/LJ. (Ton : Protecteur et Lucide).

    DONNÉES CLIENT (COMPLÈTES — tu as accès à TOUTES les données financières mois par mois) :
    ${JSON.stringify(contextData)}

    RÈGLE ABSOLUE SUR LES DONNÉES :
    - Tu disposes des données financières COMPLÈTES ci-dessus : CA, marge, trésorerie, BFR, salaires, heures pour CHAQUE mois de CHAQUE année.
    - Quand on te demande un chiffre annuel (ex: "CA 2025"), CALCULE le total à partir du détail mensuel fourni. Ne dis JAMAIS que tu n'as pas la donnée si elle est dans le contexte.
    - Quand on te demande une évolution N vs N-1, compare les synthèses annuelles.
    - Cite les chiffres précis issus des données, pas des approximations.

    MÉTHODOLOGIE D'INTERACTION "DIAGNOSTIC & ACTION" :

    CAS 1 : LA QUESTION FLOUE (ex: "Je veux licencier", "Optimiser ma tréso")
    -> **REFUSE DE RÉPONDRE À L'AVEUGLE.**
    -> Pose immédiatement 2 à 3 questions de qualification *vitales* (Ancienneté ? Motif ? Montant des dettes ?).
    -> *Phrase type : "Pour sécuriser cette opération et vous donner la bonne stratégie, j'ai besoin de préciser : 1... 2..."*

    CAS 2 : LA QUESTION TECHNIQUE AVEC DONNÉES (ex: "Coût rupture pour 2500€ brut et 10 ans ancienneté")
    -> **RÉPONSE DIRECTE ET CHIFFRÉE.**
    -> Fais le calcul (Indemnité légale + Forfait social en vigueur).
    -> Ajoute la "Plus-Value Stratégique" (ex: "Attention au délai d'homologation de 15 jours qui reporte la sortie des effectifs").
    -> Conclus par : "[ALERT_HUMAN]" pour validation finale.

    STYLE D'ÉCRITURE :
    - Direct, Percutant, Professionnel.
    - Utilise le Markdown pour la lisibilité (Gras pour les chiffres clés, Listes pour les étapes).
    `;

    // Nettoyage de l'historique pour l'IA
    const cleanHistory = history
        .filter(m => m.id !== 'welcome-msg' && !m.text.startsWith('⛔') && !m.isSystemSummary)
        .slice(-15) // Garde les 15 derniers échanges pertinents
        .map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));

    const contents = [
        ...cleanHistory,
        { role: 'user', parts: [{ text: currentQuery }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: contents,
      config: { 
          systemInstruction, 
          temperature: 0.1, // Très faible pour éviter les hallucinations ou la politesse excessive
          thinkingConfig: { thinkingBudget: 2048 } 
      }
    });

    return response.text || "Analyse indisponible.";

  } catch (error: any) {
      console.error("Gemini Error:", error);
      return `❌ Service Indisponible (Erreur API).`;
  }
};

// --- FONCTION : BRIEFING CONSULTANT ---
export const generateConversationSummary = async (history: ChatMessage[], clientName: string): Promise<string> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) return "Résumé indisponible.";
        
        const ai = new GoogleGenAI({ apiKey });
        
        const transcript = history.slice(-20).map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');

        const prompt = `
        Synthétise cette conversation pour le Consultant Senior.
        CLIENT : ${clientName}
        FORMAT : Markdown court. Points clés uniquement.
        TRANSCRIPT : ${transcript}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.1 }
        });

        return response.text || "Résumé non généré.";

    } catch (e) {
        return "Erreur résumé.";
    }
};
