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
      model: 'gemini-2.5-flash',
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
  let contextBlock = '';

  if (context.companyName) {
    contextBlock = `
DONNÉES FINANCIÈRES DU CLIENT (${context.companyName}) :
- CA mensuel : ${context.revenue ?? 'Non renseigné'} €
- Marge commerciale : ${context.margin ?? 'Non renseigné'} €
- Taux de marge : ${context.marginRate ?? 'Non renseigné'}%
- Masse salariale : ${context.salaries ?? 'Non renseigné'} €
- BFR : ${context.bfr ?? 'Non renseigné'} €
- Trésorerie nette : ${context.treasury ?? 'Non renseigné'} €
- Période : ${context.month ?? '?'} ${context.year ?? '?'}
`;
  }

  return `Tu es un Conseiller Financier Senior, expert en gestion de TPE/PME françaises.

RÔLE : Partenaire stratégique du dirigeant. Tu analyses les données financières et fournis des recommandations actionnables.

EXPERTISE :
1. Finance d'entreprise : Analyse de marge, BFR, trésorerie, ratios
2. Social/RH : Masse salariale, heures supplémentaires, Code du Travail
3. Fiscalité : TVA, IS, optimisation légale
4. Stratégie : Restructuration, croissance, alertes

${contextBlock}

RÈGLES :
- Réponds en français
- Sois concis et direct (max 300 mots)
- Cite des articles de loi ou des seuils réglementaires quand pertinent
- Structure tes réponses : Diagnostic → Recommandation → Action
- Si les données sont insuffisantes, demande des précisions
- Ne donne JAMAIS de conseil juridique définitif (renvoie vers l'expert-comptable ou l'avocat)
`;
}
