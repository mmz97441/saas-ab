
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
    const sortedRecords = [...records].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return 0;
    });
    const lastRecord = sortedRecords[sortedRecords.length - 1];

    const contextData = {
      profile: { 
          entreprise: client.companyName, 
          dirigeant: client.managerName, 
          secteur: client.sector || "Non spécifié",
          forme_juridique: client.legalForm || "Non spécifié"
      },
      situation_actuelle: lastRecord ? {
          tresorerie_nette: lastRecord.cashFlow.treasury,
          ca_mensuel: lastRecord.revenue.total,
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

    DONNÉES CLIENT : ${JSON.stringify(contextData)}

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
