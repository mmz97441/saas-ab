import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const MONTH_ORDER = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Export CSV côté serveur.
 *
 * Sécurisé :
 * - Consultant peut exporter les données de n'importe quel client
 * - Client ne peut exporter que ses propres données publiées
 */
export const exportClientCSV = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }

  const { clientId, year } = data;
  const role = context.auth.token.role;

  if (!clientId || typeof clientId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'clientId requis.');
  }

  // Vérification des droits
  if (role === 'client') {
    if (context.auth.token.clientId !== clientId) {
      throw new functions.https.HttpsError('permission-denied', 'Accès non autorisé à ce client.');
    }
  } else if (role !== 'consultant') {
    throw new functions.https.HttpsError('permission-denied', 'Rôle non autorisé.');
  }

  // Récupérer les records
  let query = db.collection('records').where('clientId', '==', clientId);
  if (year) {
    query = query.where('year', '==', year);
  }

  const snap = await query.get();

  if (snap.empty) {
    return { csv: '', filename: 'export_vide.csv' };
  }

  const records = snap.docs
    .map(d => d.data())
    .filter(r => role === 'consultant' || r.isPublished) // Client ne voit que les publiés
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month);
    });

  // Construire le CSV
  const headers = [
    'Année',
    'Mois',
    'CA Total HT',
    'CA Marchandises',
    'CA Services',
    'Objectif CA',
    'Marge Totale',
    'Taux Marge (%)',
    'Masse Salariale',
    'Heures Travaillées',
    'Heures Sup.',
    'Créances Clients',
    'Stocks',
    'Dettes Fournisseurs',
    'Dettes État',
    'Dettes Sociales',
    'BFR Net',
    'Trésorerie Active',
    'Trésorerie Passive',
    'Trésorerie Nette',
    'Volume Carburant (L)',
    'Validé',
    'Publié',
  ];

  const rows = records.map(r => [
    r.year || '',
    r.month || '',
    r.revenue?.total || 0,
    r.revenue?.goods || 0,
    r.revenue?.services || 0,
    r.revenue?.objective || 0,
    r.margin?.total || 0,
    r.margin?.rate?.toFixed(1) || 0,
    r.expenses?.salaries || 0,
    r.expenses?.hoursWorked || 0,
    r.expenses?.overtimeHours || 0,
    r.bfr?.receivables?.clients || 0,
    r.bfr?.stock?.total || 0,
    r.bfr?.debts?.suppliers || 0,
    r.bfr?.debts?.state || 0,
    r.bfr?.debts?.social || 0,
    r.bfr?.total || 0,
    r.cashFlow?.active || 0,
    r.cashFlow?.passive || 0,
    r.cashFlow?.treasury || 0,
    r.fuel?.volume || 0,
    r.isValidated ? 'Oui' : 'Non',
    r.isPublished ? 'Oui' : 'Non',
  ]);

  // BOM UTF-8 pour Excel
  const BOM = '\uFEFF';
  const separator = ';';
  const csvContent = BOM +
    headers.join(separator) + '\n' +
    rows.map(row => row.join(separator)).join('\n');

  // Récupérer le nom du client pour le filename
  let companyName = 'client';
  try {
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (clientDoc.exists) {
      companyName = (clientDoc.data()?.companyName || 'client')
        .replace(/[^a-zA-Z0-9àâäéèêëïôùûüç\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
    }
  } catch (err) {
    // Pas grave, on utilise 'client' par défaut
  }

  const filename = `export_${companyName}_${year || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;

  functions.logger.info('CSV export generated', { clientId, year, rowCount: rows.length });

  return { csv: csvContent, filename };
});
