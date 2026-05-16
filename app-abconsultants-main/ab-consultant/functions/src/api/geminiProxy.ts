import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit } from '../middleware/rateLimiter';

if (!admin.apps.length) {
  admin.initializeApp();
}

// Allowed mime types for vision attachments (F-15)
const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
]);
const MAX_ATTACHMENTS = 4;
const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB decoded
const ALLOWED_ORIGINS = new Set([
  'https://app-ab-consultant.web.app',
  'https://app-ab-consultant.firebaseapp.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

interface Attachment {
  mimeType: string;
  data: string;
  name?: string;
}

interface ValidatedAttachments {
  valid: boolean;
  error?: string;
  attachments: Attachment[];
}

function validateAttachments(raw: unknown): ValidatedAttachments {
  if (raw === undefined || raw === null) {
    return { valid: true, attachments: [] };
  }
  if (!Array.isArray(raw)) {
    return { valid: false, error: 'attachments doit être un tableau.', attachments: [] };
  }
  if (raw.length > MAX_ATTACHMENTS) {
    return {
      valid: false,
      error: `Trop de pièces jointes (max ${MAX_ATTACHMENTS}).`,
      attachments: [],
    };
  }

  const out: Attachment[] = [];
  let totalBytes = 0;

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as any;
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Pièce jointe ${i + 1} invalide.`, attachments: [] };
    }
    const mimeType = typeof item.mimeType === 'string' ? item.mimeType.toLowerCase() : '';
    const data = typeof item.data === 'string' ? item.data : '';
    if (!mimeType || !ALLOWED_ATTACHMENT_MIMES.has(mimeType)) {
      return {
        valid: false,
        error: `Type de fichier non supporté: ${mimeType || '(inconnu)'}.`,
        attachments: [],
      };
    }
    if (!data) {
      return { valid: false, error: `Pièce jointe ${i + 1} vide.`, attachments: [] };
    }
    // base64 decoded size = ~ length * 3/4 (minus padding)
    const padding = (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
    const decodedSize = Math.floor((data.length * 3) / 4) - padding;
    totalBytes += decodedSize;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return {
        valid: false,
        error: 'Pièces jointes trop volumineuses (max 10MB au total).',
        attachments: [],
      };
    }
    out.push({
      mimeType,
      data,
      name: typeof item.name === 'string' ? item.name : undefined,
    });
  }

  return { valid: true, attachments: out };
}

function buildContents(
  history: unknown,
  query: string,
  attachments: Attachment[]
): Array<{ role: string; parts: any[] }> {
  const contents: Array<{ role: string; parts: any[] }> = [];

  if (Array.isArray(history)) {
    for (const msg of (history as any[]).slice(-20)) {
      if (msg && msg.role && msg.text) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.text) }],
        });
      }
    }
  }

  // Current user turn: attachments first (inlineData), text last (Gemini convention).
  const parts: any[] = [];
  for (const att of attachments) {
    parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
  }
  parts.push({ text: query });
  contents.push({ role: 'user', parts });

  return contents;
}

function setCorsHeaders(req: functions.https.Request, res: functions.Response) {
  const origin = req.get('origin') || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    // Public app, endpoint still requires Bearer token. Allow any origin for safety.
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '3600');
}

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

  const { query, financialContext, history, mode, attachments } = data;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'La question est vide.');
  }

  if (query.length > 10000) {
    throw new functions.https.HttpsError('invalid-argument', 'Question trop longue.');
  }

  const attCheck = validateAttachments(attachments);
  if (!attCheck.valid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      attCheck.error || 'Pièces jointes invalides.'
    );
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

  const contents = buildContents(history, query, attCheck.attachments);

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

/**
 * Streaming HTTP endpoint for the financial advisor (SSE).
 *
 * Contract:
 *   POST https://europe-west1-app-ab-consultant.cloudfunctions.net/askFinancialAdvisorStream
 *   Headers:
 *     Authorization: Bearer <Firebase ID token>
 *     Content-Type: application/json
 *   Body: { query, financialContext, history?, attachments? }
 *   Response: text/event-stream
 *     data: {"text": "..."}\n\n     (incremental tokens)
 *     data: {"done": true, "remaining": N}\n\n
 *     data: {"error": "..."}\n\n    (mid-stream error)
 *   Pre-stream errors: HTTP 4xx/5xx with JSON { error }.
 */
export const askFinancialAdvisorStream = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée. POST attendu.' });
      return;
    }

    // ----- Auth -----
    const authHeader = req.get('authorization') || req.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Authentification requise (Bearer token manquant).' });
      return;
    }
    const idToken = match[1].trim();

    let uid: string;
    let role: string | undefined;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
      role = (decoded as any).role;
    } catch (err: any) {
      functions.logger.warn('askFinancialAdvisorStream: invalid token', { error: err?.message });
      res.status(401).json({ error: 'Token invalide ou expiré.' });
      return;
    }

    if (!role) {
      res.status(403).json({ error: 'Rôle non défini.' });
      return;
    }

    // ----- Rate limit -----
    const rateCheck = checkRateLimit(uid, 30, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil((rateCheck.resetAt - Date.now()) / 60000);
      res.status(429).json({
        error: `Limite de requêtes atteinte (30/heure). Réessayez dans ${minutes} minutes.`,
      });
      return;
    }

    // ----- Body validation -----
    const body = req.body || {};
    const query = typeof body.query === 'string' ? body.query : '';
    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: 'La question est vide.' });
      return;
    }
    if (query.length > 10000) {
      res.status(400).json({ error: 'Question trop longue (max 10000 caractères).' });
      return;
    }

    const attCheck = validateAttachments(body.attachments);
    if (!attCheck.valid) {
      res.status(400).json({ error: attCheck.error || 'Pièces jointes invalides.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      functions.logger.error('GEMINI_API_KEY not configured (stream).');
      res.status(500).json({ error: 'Service IA non configuré.' });
      return;
    }

    // ----- Build request -----
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(body.financialContext || {});
    const contents = buildContents(body.history, query, attCheck.attachments);

    // ----- Start SSE response -----
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    functions.logger.info('askFinancialAdvisorStream: start', {
      uid,
      queryLength: query.length,
      attachmentsCount: attCheck.attachments.length,
      historyLength: Array.isArray(body.history) ? body.history.length : 0,
      remaining: rateCheck.remaining,
    });

    let aborted = false;
    req.on('close', () => {
      aborted = true;
    });

    let totalChars = 0;
    try {
      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.35,
          maxOutputTokens: 2048,
        },
      });

      for await (const chunk of stream) {
        if (aborted) break;
        const text = (chunk as any)?.text;
        if (typeof text === 'string' && text.length > 0) {
          totalChars += text.length;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      if (!aborted) {
        res.write(
          `data: ${JSON.stringify({ done: true, remaining: rateCheck.remaining })}\n\n`
        );
      }

      functions.logger.info('askFinancialAdvisorStream: end', {
        uid,
        totalChars,
        aborted,
      });
    } catch (err: any) {
      functions.logger.error('askFinancialAdvisorStream: Gemini error', {
        uid,
        error: err?.message,
      });
      try {
        res.write(`data: ${JSON.stringify({ error: 'Erreur du service IA.' })}\n\n`);
      } catch {
        // socket may be dead — ignore
      }
    } finally {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
  });

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
