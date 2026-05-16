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
        temperature: 0.35,
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

  const hasYearlyData = context.syntheseAnnuelle
    && Array.isArray(context.syntheseAnnuelle)
    && context.syntheseAnnuelle.length > 0;

  if (hasYearlyData) {
    financialBlock = `
DONNÉES FINANCIÈRES COMPLÈTES (issues de la base de données — vérité absolue) :
${JSON.stringify(context.syntheseAnnuelle, null, 2)}

SITUATION ACTUELLE :
${context.situationActuelle ? JSON.stringify(context.situationActuelle) : 'Pas de données récentes.'}

═══════════════════════════════════════════════════════════════════
🚨 RÈGLE ABSOLUE SUR LES DONNÉES — CONTRAINTE DURE 🚨
═══════════════════════════════════════════════════════════════════
Le JSON ci-dessus est la VÉRITÉ. Toutes les années et tous les mois listés EXISTENT vraiment et ont été saisis.

- Quand on te demande un chiffre annuel (ex: "CA 2025"), CALCULE le total à partir du détail mensuel fourni dans le JSON. Le champ "ca_total" est déjà calculé pour toi, utilise-le directement.
- Quand on te demande une évolution N vs N-1, compare les synthèses annuelles disponibles.
- Cite les chiffres précis issus des données, pas des approximations.
- Ne dis JAMAIS "je n'ai pas accès aux données" ou "nos outils n'ont pas encore de données" tant qu'il y a au moins un mois dans le JSON. Si une année spécifique manque, dis-le précisément (ex: "Pour 2024, je n'ai que les mois de Janvier et Février sur 12") au lieu de prétendre n'avoir aucune donnée.
- L'année courante est ${new Date().getFullYear()}. Si le client demande l'année courante, c'est l'année en cours, pas du prévisionnel.
═══════════════════════════════════════════════════════════════════
`;
  } else if (context.companyName) {
    // No financial records at all — be honest, don't fabricate
    financialBlock = `
DONNÉES FINANCIÈRES :
⚠️ AUCUN RECORD FINANCIER N'EST ENREGISTRÉ pour ce dossier.

RÈGLE :
- Ne fabrique AUCUN chiffre. Si on te demande un montant, dis honnêtement que rien n'est encore saisi dans le système.
- Propose au client de saisir ses premières données mensuelles (menu "Saisie Mensuelle") ou de contacter son consultant pour démarrer le dossier.
- Tu peux toujours répondre à des questions générales sur la gestion d'entreprise, la fiscalité, la RH — mais sans données spécifiques.
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
- Question technique avec données → Réponse directe et chiffrée, complète et autonome. NE termine PAS par "[ALERT_HUMAN]" (voir règle stricte ci-dessous).

═══════════════════════════════════════════════════════════════════
🚨 QUAND DÉCLENCHER [ALERT_HUMAN] — CONTRAINTE DURE (RARE, RÉSERVE ABSOLUE) 🚨
═══════════════════════════════════════════════════════════════════

CECI EST UNE CONTRAINTE DURE. RELIS-LA AVANT CHAQUE RÉPONSE.

❌ NE DÉCLENCHE JAMAIS [ALERT_HUMAN] sur :
- Toute question technique courante (ex: "quel est mon CA ?", "explique mon BFR", "ma marge évolue comment ?")
- Toute analyse chiffrée standard, même si elle est complexe
- Toute question qui entre dans tes 4 piliers d'expertise (Finance, RH, Fiscalité, Restructuring)
- Une simple demande de conseil, de validation d'idée, ou de seconde lecture

✅ DÉCLENCHE [ALERT_HUMAN] UNIQUEMENT dans CES 4 cas précis :
1. **Demande explicite du client** : il dit "je veux parler à un humain", "appelez-moi", "je préfère mon consultant", "je veux un rendez-vous".
2. **Urgence financière critique** : trésorerie négative ET non-paiement imminent (URSSAF, fournisseur stratégique, salaires).
3. **Suspicion de fraude ou conflit grave** : litige client/fournisseur > 50 k€, contrôle fiscal annoncé, plainte RH, transmission/cession en cours.
4. **Décision irréversible imminente** : licenciement, rupture conventionnelle collective, dépôt de bilan envisagé, opération de haut de bilan.

DANS TOUS LES AUTRES CAS, ne mentionne PAS "[ALERT_HUMAN]" — ni au début, ni au milieu, ni à la fin de ta réponse. Réponds normalement, complètement, en autonomie.

RAPPEL FINAL (à relire) : "[ALERT_HUMAN]" est un signal d'escalade RARE. Par défaut, tu réponds seul. Si tu hésites, NE le déclenche PAS.
═══════════════════════════════════════════════════════════════════

STYLE : Direct, Percutant, Professionnel. Utilise le Markdown. Max 300 mots. Réponds en français.
- Pour comparer plusieurs périodes ou postes : utilise un tableau Markdown (les colonnes s'affichent correctement chez le client).
- Pour structurer une analyse longue : utilise des sous-titres \`###\` (sous-section).
- Pour les chiffres clés : mets-les en **gras** pour qu'ils ressortent.
`;
}
