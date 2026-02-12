
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

    // CONTEXTE FINANCIER ENRICHI
    const MONTH_ORDER = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const sortedRecords = [...records].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
    });
    const lastRecord = sortedRecords[sortedRecords.length - 1];

    const contextData = {
      profile: {
          entreprise: client.companyName,
          dirigeant: client.managerName,
          secteur: client.sector || "Non spécifié",
          forme_juridique: client.legalForm || "Non spécifié"
      },
      dernier_mois: lastRecord ? {
          mois: lastRecord.month,
          annee: lastRecord.year,
          ca_mensuel: lastRecord.revenue.total,
          objectif_ca: lastRecord.revenue.objective,
          marge_taux: lastRecord.margin?.rate || 0,
          marge_euros: lastRecord.margin?.total || 0,
          tresorerie_nette: lastRecord.cashFlow.treasury,
          bfr_total: lastRecord.bfr.total,
          creances_clients: lastRecord.bfr.receivables.clients,
          dettes_fournisseurs: lastRecord.bfr.debts.suppliers,
          masse_salariale: lastRecord.expenses.salaries,
          heures_travaillees: lastRecord.expenses.hoursWorked,
      } : null,
      nb_mois_saisis: records.length,
    };

    // --- PROMPT ASSISTANT IA AB CONSULTANTS ---
    const systemInstruction = `
    IDENTITÉ :
    Tu es l'assistant IA du cabinet AB Consultants. Tu accompagnes les dirigeants d'entreprise dans le pilotage de leur activité.
    Tu t'adresses à ${client.managerName || 'le dirigeant'}, dirigeant de ${client.companyName}.

    TON RÔLE :
    - Aider le client à comprendre ses données financières de façon simple et pédagogique
    - Répondre à ses questions sur la gestion d'entreprise (finance, RH, fiscal, juridique)
    - Signaler les points d'attention de façon constructive (pas alarmiste)
    - Orienter vers le consultant humain pour les sujets complexes ou sensibles

    RÈGLES DE COMPORTEMENT :

    1. **ADAPTE-TOI AU MESSAGE** :
       - Si le client dit "bonjour" ou fait une salutation → Réponds chaleureusement, présente-toi brièvement, et demande comment tu peux l'aider. NE lance PAS d'analyse financière non sollicitée.
       - Si le client pose une question précise → Réponds directement avec précision.
       - Si le client demande une analyse → Utilise les données ci-dessous pour répondre.

    2. **TONALITÉ** :
       - Professionnel mais accessible. Tu parles à un dirigeant, pas à un expert comptable.
       - Bienveillant et constructif. Jamais alarmiste ni anxiogène.
       - Si un indicateur est préoccupant, formule-le comme un "point d'attention" avec des pistes d'action, pas comme une catastrophe.
       - Utilise le tutoiement uniquement si le client tutoie en premier, sinon vouvoie.

    3. **DONNÉES FINANCIÈRES** (à utiliser UNIQUEMENT quand le client pose une question qui les concerne) :
    ${JSON.stringify(contextData)}

    4. **EXPERTISE** :
       - Finance : BFR, trésorerie, ratios, rentabilité, cash-flow
       - RH & Social : droit du travail, rémunération, gestion d'équipe
       - Fiscalité : optimisation, TVA, transmission
       - Gestion : pilotage, indicateurs, stratégie

    5. **LIMITES** :
       - Pour les décisions importantes (licenciement, restructuration, contentieux), recommande systématiquement de valider avec le consultant référent.
       - Ajoute [ALERT_HUMAN] à la fin de ta réponse uniquement si le sujet nécessite une intervention urgente du consultant.
       - Ne fabrique jamais de chiffres. Si tu n'as pas la donnée, dis-le.

    6. **FORMAT** :
       - Réponses concises (3-5 paragraphes max sauf analyse détaillée demandée)
       - Utilise le Markdown avec parcimonie : **gras** pour les chiffres clés, listes pour les étapes
       - Pas de tableaux sauf si explicitement demandé
    `;

    // Nettoyage de l'historique pour l'IA
    const cleanHistory = history
        .filter(m => m.id !== 'welcome-msg' && !m.text.startsWith('⛔') && !m.isSystemSummary)
        .slice(-15)
        .map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));

    const contents = [
        ...cleanHistory,
        { role: 'user', parts: [{ text: currentQuery }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
          systemInstruction,
          temperature: 0.4,
      }
    });

    return response.text || "Analyse indisponible.";

  } catch (error: any) {
      console.error("Gemini Error:", error?.message || error, error?.status, error?.statusText);
      if (error?.message?.includes('API key')) return "⛔ Clé API invalide ou manquante. Contactez votre consultant.";
      if (error?.message?.includes('not found') || error?.message?.includes('404')) return "⛔ Modèle IA indisponible. Contactez votre consultant.";
      return `❌ Service temporairement indisponible. Réessayez dans quelques instants.`;
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
            model: 'gemini-2.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.1 }
        });

        return response.text || "Résumé non généré.";

    } catch (e) {
        return "Erreur résumé.";
    }
};
