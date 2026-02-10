import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Trigger Firestore : quand un record est créé/modifié/supprimé.
 *
 * Met à jour les statistiques pré-calculées sur le document client.
 * Cela évite le N+1 queries dans le ConsultantDashboard :
 * au lieu de faire 1 query par client pour récupérer le dernier record,
 * on lit simplement le champ `_stats` du client.
 */
export const onRecordWrite = functions.firestore
  .document('records/{recordId}')
  .onWrite(async (change, context) => {
    const recordAfter = change.after.exists ? change.after.data() : null;
    const recordBefore = change.before.exists ? change.before.data() : null;

    const clientId = recordAfter?.clientId || recordBefore?.clientId;
    if (!clientId) {
      functions.logger.warn('Record without clientId', { recordId: context.params.recordId });
      return;
    }

    try {
      // Récupérer tous les records de ce client pour calculer les stats
      const recordsSnap = await db
        .collection('records')
        .where('clientId', '==', clientId)
        .get();

      const records = recordsSnap.docs.map(d => d.data());

      // Trouver le record le plus récent (par année puis mois)
      const MONTH_ORDER = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];

      const sorted = records.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return MONTH_ORDER.indexOf(b.month) - MONTH_ORDER.indexOf(a.month);
      });

      const latest = sorted[0] || null;
      const hasPendingValidation = records.some(r => r.isSubmitted && !r.isValidated);
      const treasuryValue = latest?.cashFlow?.treasury ?? null;
      const totalRecords = records.length;

      // Mise à jour atomique des stats sur le document client
      await db.collection('clients').doc(clientId).update({
        '_stats': {
          lastRecordMonth: latest?.month || null,
          lastRecordYear: latest?.year || null,
          lastTreasury: treasuryValue,
          lastRevenue: latest?.revenue?.total || null,
          hasPendingValidation,
          treasuryAlert: treasuryValue !== null && treasuryValue < 0,
          totalRecords,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }
      });

      functions.logger.info('Client stats updated', {
        clientId,
        totalRecords,
        treasury: treasuryValue,
        hasPending: hasPendingValidation,
      });
    } catch (err) {
      functions.logger.error('Failed to update client stats', { clientId, error: err });
    }
  });
