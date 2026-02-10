import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin SDK (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

const SUPER_ADMIN_EMAIL = functions.config().app?.super_admin_email || 'admin@ab-consultants.fr';

/**
 * Trigger: Quand un utilisateur Firebase Auth est créé.
 *
 * Logique :
 * 1. Vérifier si l'email existe dans la collection `consultants`
 *    → Custom Claim: { role: 'consultant', isAdmin: true/false }
 * 2. Sinon, vérifier si l'email existe dans la collection `clients` (whitelist owner.email)
 *    → Custom Claim: { role: 'client', clientId: '...' }
 * 3. Sinon → Supprimer le compte (non autorisé)
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const email = user.email?.toLowerCase().trim();
  if (!email) {
    functions.logger.warn('User created without email, deleting.', { uid: user.uid });
    await auth.deleteUser(user.uid);
    return;
  }

  functions.logger.info('New user signup detected', { email, uid: user.uid });

  // --- CHECK 1: Is this a consultant? ---
  try {
    const consultantsSnap = await db
      .collection('consultants')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!consultantsSnap.empty) {
      const consultantDoc = consultantsSnap.docs[0];
      const isAdmin = email === SUPER_ADMIN_EMAIL || consultantDoc.data().role === 'admin';

      await auth.setCustomUserClaims(user.uid, {
        role: 'consultant',
        isAdmin,
      });

      functions.logger.info('Custom claims set: consultant', { email, isAdmin });
      return;
    }
  } catch (err) {
    functions.logger.error('Error checking consultants collection', err);
  }

  // --- CHECK 2: Is this a whitelisted client? ---
  try {
    const clientsSnap = await db
      .collection('clients')
      .where('owner.email', '==', email)
      .limit(1)
      .get();

    if (!clientsSnap.empty) {
      const clientDoc = clientsSnap.docs[0];

      await auth.setCustomUserClaims(user.uid, {
        role: 'client',
        clientId: clientDoc.id,
      });

      functions.logger.info('Custom claims set: client', { email, clientId: clientDoc.id });
      return;
    }
  } catch (err) {
    functions.logger.error('Error checking clients collection', err);
  }

  // --- CHECK 3: Unauthorized → delete the account ---
  functions.logger.warn('Unauthorized signup attempt, deleting user.', { email, uid: user.uid });
  await auth.deleteUser(user.uid);
});
