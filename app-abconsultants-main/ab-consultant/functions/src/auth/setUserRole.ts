import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

const SUPER_ADMIN_EMAIL = functions.config().app?.super_admin_email || 'nice.guillaume@gmail.com';

/**
 * Callable Function: Rafraîchir les Custom Claims d'un utilisateur.
 *
 * Utile quand :
 * - Un consultant est ajouté à la collection après que le user auth existe déjà
 * - Un client est assigné à un nouveau dossier
 * - Le rôle admin est modifié
 *
 * Seul un admin peut appeler cette fonction pour un autre utilisateur.
 * Un utilisateur peut appeler cette fonction pour lui-même (refresh).
 */
export const setUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }

  // L'UID ciblé : soit celui passé en paramètre (admin only), soit l'appelant
  const targetUid = data?.uid || context.auth.uid;

  // Si on cible un autre utilisateur, vérifier que l'appelant est admin
  if (targetUid !== context.auth.uid) {
    const callerClaims = context.auth.token;
    if (callerClaims.role !== 'consultant' || !callerClaims.isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Seul un administrateur peut modifier les rôles.');
    }
  }

  // Récupérer les infos du user ciblé
  let targetUser;
  try {
    targetUser = await auth.getUser(targetUid);
  } catch (err) {
    throw new functions.https.HttpsError('not-found', 'Utilisateur introuvable.');
  }

  const email = targetUser.email?.toLowerCase().trim();
  if (!email) {
    throw new functions.https.HttpsError('failed-precondition', 'Utilisateur sans email.');
  }

  // Même logique que onUserCreated
  const consultantsSnap = await db
    .collection('consultants')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!consultantsSnap.empty) {
    const doc = consultantsSnap.docs[0];
    const isAdmin = email === SUPER_ADMIN_EMAIL || doc.data().role === 'admin';

    await auth.setCustomUserClaims(targetUid, { role: 'consultant', isAdmin });
    return { role: 'consultant', isAdmin };
  }

  const clientsSnap = await db
    .collection('clients')
    .where('owner.email', '==', email)
    .limit(1)
    .get();

  if (!clientsSnap.empty) {
    const doc = clientsSnap.docs[0];
    await auth.setCustomUserClaims(targetUid, { role: 'client', clientId: doc.id });
    return { role: 'client', clientId: doc.id };
  }

  // Pas de rôle trouvé
  await auth.setCustomUserClaims(targetUid, {});
  throw new functions.https.HttpsError('permission-denied', 'Email non autorisé dans le système.');
});
