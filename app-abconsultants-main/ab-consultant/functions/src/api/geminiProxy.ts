import * as functions from 'firebase-functions';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit } from '../middleware/rateLimiter';

/**
 * Proxy sécurisé pour l'API Gemini.
 *
 * Avantages :
 * - La clé API n'est JAMAIS exposée côté client
 * - Rate limiting par utilisateur (30 req/heure)
 * - Validation des entrées
 * - Logs serveur pour audit
 */
export const askFinancialAdvisor = functions.https.onCall(async (data, context) => {
  // --- AUTH CHECK ---
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }

  const uid = context.auth.uid;
  const role = context.auth.token.role;

  if (!role) {
    throw new functions.https.HttpsError('permission-denied', 'Rôle non défini.');
  }

  // --- RATE LIMITING ---
  const rateCheck = checkRateLimit(uid, 30, 60 * 60 * 1000);
  if (!rateCheck.allowed) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Limite de requêtes atteinte (30/heure). Réessayez dans ${Math.ceil((rateCheck.resetAt - Date.now()) / 60000)} minutes.`
    );
  }

  // --- INPUT VALIDATION ---
  const { query, financialContext, history } = data;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'La question est vide.');
  }

  if (query.length > 5000) {
    throw new functions.https.HttpsError('invalid-argument', 'Question trop longue (max 5000 caractères).');
  }

  // --- GEMINI API CALL ---
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    functions.logger.error('GEMINI_API_KEY not configured. Add GEMINI_API_KEY to functions/.env');
    throw new functions.https.HttpsError('internal', 'Service IA non configuré.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemPrompt = buildSystemPrompt(financialContext || {});

  // Construire l'historique de conversation pour Gemini
  const contents = [];

  if (Array.isArray(history)) {
    for (const msg of history.slice(-20)) { // Max 20 messages de contexte
      if (msg.role && msg.text) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }
  }

  // Ajouter la question courante
  contents.push({
    role: 'user',
    parts: [{ text: query }],
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text || 'Pas de réponse générée.';

    functions.logger.info('Gemini response generated', {
      uid,
      queryLength: query.length,
      responseLength: text.length,
      remaining: rateCheck.remaining,
    });

    return { text, remaining: rateCheck.remaining };
  } catch (err: any) {
    functions.logger.error('Gemini API error', { uid, error: err.message });
    throw new functions.https.HttpsError('internal', 'Erreur du service IA. Réessayez.');
  }
});

function buildSystemPrompt(context: Record<string, any>): string {
  const contextData = {
    profile: {
      entreprise: context.companyName || 'Non renseigné',
      dirigeant: context.managerName || 'Non renseigné',
      secteur: context.sector || 'Non spécifié',
      forme_juridique: context.legalForm || 'Non spécifié'
    },
    situation_actuelle: context.revenue ? {
      tresorerie_nette: context.treasury ?? 'Non renseigné',
      ca_mensuel: context.revenue ?? 'Non renseigné',
      marge: context.margin ?? 'Non renseigné',
      taux_marge: context.marginRate ?? 'Non renseigné',
      masse_salariale: context.salaries ?? 'Non renseigné',
      bfr: context.bfr ?? 'Non renseigné',
      periode: `${context.month ?? '?'} ${context.year ?? '?'}`
    } : 'Pas de données comptables récentes.'
  };

  const managerName = context.managerName || 'Monsieur/Madame';

  return `IDENTITÉ & POSTURE :
Tu es le "Senior Executive Partner" du cabinet AB Conseil. Tu ne t'exprimes pas comme une IA, mais comme un associé de cabinet de conseil en stratégie (Top-Tier type McKinsey/BCG).
Ton niveau d'exigence est l'excellence absolue. Tu es le bras droit stratégique de ${managerName}.

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
- Réponds en français.
`;
}
