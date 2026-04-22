import * as functions from 'firebase-functions';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit } from '../middleware/rateLimiter';

export const askFinancialAdvisor = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }

  const uid = context.auth.uid;
  const role = context.auth.token.role;

  if (!role) {
    throw new functions.https.HttpsError('permission-denied', 'Rôle non défini.');
  }

  const rateCheck = checkRateLimit(uid, 30, 60 * 60 * 1000);
  if (!rateCheck.allowed) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Limite de requêtes atteinte (30/heure). Réessayez dans ${Math.ceil((rateCheck.resetAt - Date.now()) / 60000)} minutes.`
    );
  }

  const { query, financialContext, history, mode } = data;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'La question est vide.');
  }

  if (query.length > 10000) {
    throw new functions.https.HttpsError('invalid-argument', 'Question trop longue.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    functions.logger.error('GEMINI_API_KEY not configured.');
    throw new functions.https.HttpsError('internal', 'Service IA non configuré.');
  }

  const ai = new GoogleGenAI({ apiKey });

  if (mode === 'summary') {
    return handleSummary(ai, query, financialContext, uid, rateCheck);
  }

  const systemPrompt = buildSystemPrompt(financialContext || {});

  const contents = [];
  if (Array.isArray(history)) {
    for (const msg of history.slice(-20)) {
      if (msg.role && msg.text) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }
  }

  contents.push({ role: 'user', parts: [{ text: query }] });

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
      uid, queryLength: query.length, responseLength: text.length, remaining: rateCheck.remaining,
    });

    return { text, remaining: rateCheck.remaining };
  } catch (err: any) {
    functions.logger.error('Gemini API error', { uid, error: err.message });
    throw new functions.https.HttpsError('internal', 'Erreur du service IA. Réessayez.');
  }
});

async function handleSummary(
  ai: GoogleGenAI,
  transcript: string,
  context: Record<string, any>,
  uid: string,
  rateCheck: { remaining: number }
) {
  const clientName = context?.companyName || 'Client';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `
Synthétise cette conversation pour le Consultant Senior.
CLIENT : ${clientName}
FORMAT : Markdown court. Points clés uniquement.
TRANSCRIPT : ${transcript}
      ` }] }],
      config: { temperature: 0.1, maxOutputTokens: 1024 },
    });

    return { text: response.text || 'Résumé non généré.', remaining: rateCheck.remaining };
  } catch (err: any) {
    functions.logger.error('Gemini summary error', { uid, error: err.message });
    return { text: 'Erreur résumé.', remaining: rateCheck.remaining };
  }
}

function buildSystemPrompt(context: Record<string, any>): string {
  const companyName = context.companyName || 'l\'entreprise';
  const managerName = context.managerName || 'le dirigeant';
  const sector = context.sector || 'Non spécifié';
  const legalForm = context.legalForm || 'Non spécifié';

  let financialBlock = '';

  if (context.syntheseAnnuelle && Array.isArray(context.syntheseAnnuelle)) {
    financialBlock = `
DONNÉES FINANCIÈRES COMPLÈTES :
${JSON.stringify(context.syntheseAnnuelle, null, 2)}

SITUATION ACTUELLE :
${context.situationActuelle ? JSON.stringify(context.situationActuelle) : 'Pas de données récentes.'}

RÈGLE ABSOLUE SUR LES DONNÉES :
- Tu disposes des données financières COMPLÈTES ci-dessus : CA, marge, trésorerie, BFR, salaires, heures pour CHAQUE mois de CHAQUE année.
- Quand on te demande un chiffre annuel (ex: "CA 2025"), CALCULE le total à partir du détail mensuel fourni. Ne dis JAMAIS que tu n'as pas la donnée si elle est dans le contexte.
- Quand on te demande une évolution N vs N-1, compare les synthèses annuelles.
- Cite les chiffres précis issus des données, pas des approximations.
`;
  } else if (context.companyName) {
    financialBlock = `
DONNÉES FINANCIÈRES :
- CA mensuel : ${context.revenue ?? 'Non renseigné'} €
- Marge commerciale : ${context.margin ?? 'Non renseigné'} €
- Trésorerie nette : ${context.treasury ?? 'Non renseigné'} €
- Période : ${context.month ?? '?'} ${context.year ?? '?'}
`;
  }

  return `IDENTITÉ & POSTURE :
Tu es le "Senior Executive Partner" du cabinet AB Conseil. Tu ne t'exprimes pas comme une IA, mais comme un associé de cabinet de conseil en stratégie.
Ton niveau d'exigence est l'excellence absolue. Tu es le bras droit stratégique de ${managerName}.

TON OBJECTIF UNIQUE :
Sécuriser et Optimiser la valeur de l'entreprise **${companyName}** (${sector}, ${legalForm}).

═══════════════════════════════════════════════════════════════════
🚫 PÉRIMÈTRE STRICT — RÈGLE N°1 ABSOLUE (PRIORITÉ MAXIMALE) 🚫
═══════════════════════════════════════════════════════════════════

Tu es EXCLUSIVEMENT dédié à l'entreprise **${companyName}**.
Tu ne traites QUE les sujets en lien DIRECT avec la gestion, la stratégie, les finances, le social, la fiscalité et les opérations de CETTE entreprise.

❌ REFUS IMMÉDIAT — sujets personnels ou sans lien avec l'entreprise :
- Recettes de cuisine, loisirs, sport, culture générale
- Achats personnels (voiture, maison, vacances…)
- Financement personnel, questions médicales, sentimentales
- Questions sur une AUTRE entreprise
- Programmation, code, jeux vidéo, politique, religion
→ Réponds : "Je suis exclusivement dédié à la gestion de **${companyName}**. Cette question sort de mon périmètre. Comment puis-je vous aider sur un sujet lié à votre entreprise ?"
→ Ne fournis AUCUN élément de réponse sur le sujet hors-périmètre.

⚠️ ZONE DE DOUTE (le sujet pourrait concerner l'entreprise) :
→ Pose UNE question de clarification avant de répondre.

✅ DANS LE PÉRIMÈTRE : finances, comptabilité, trésorerie, RH, fiscalité, investissements professionnels, stratégie commerciale, juridique lié à l'activité.
═══════════════════════════════════════════════════════════════════

${financialBlock}

RÈGLES D'OR :
1. **PRÉCISION CHIRURGICALE** : Cite les articles de loi, seuils fiscaux, ratios bancaires exacts.
2. **VISION 360°** : Si on parle RH, pense impact financier. Si on parle Fiscalité, pense Risque Juridique.
3. **COURAGE MANAGÉRIAL** : Si le client a une mauvaise idée, dis-le fermement mais diplomatiquement.
4. **ANTI-LANGUE DE BOIS** : Va droit au but. Commence par la réponse.

TES 4 PILIERS D'EXPERTISE :
- **FINANCE** : Pilotage BFR, Cash-flow, Ratios bancaires, Analyse de rentabilité.
- **RH & SOCIAL** : Code du travail, Masse salariale, Gestion des conflits.
- **FISCALITÉ** : Optimisation légale, TVA, IS, Holding, Transmission.
- **RESTRUCTURING** : Mandat ad hoc, Sauvegarde, RJ/LJ.

MÉTHODOLOGIE :
- Question floue → Pose 2-3 questions de qualification avant de répondre.
- Question technique avec données → Réponse directe et chiffrée + conclus par "[ALERT_HUMAN]" pour validation.

STYLE : Direct, Percutant, Professionnel. Utilise le Markdown. Max 300 mots. Réponds en français.
`;
}
