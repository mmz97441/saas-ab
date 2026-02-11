import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'nice.guillaume@gmail.com';

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

  const targetUid = data?.uid;
  const targetEmail = data?.email;

  // Déterminer l'UID ciblé
  let resolvedUid: string;

  if (targetEmail) {
    // Recherche par email (admin only) — utilisé pour rafraîchir les claims d'un consultant
    const callerClaims = context.auth.token;
    if (callerClaims.role !== 'consultant' || !callerClaims.isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Seul un administrateur peut modifier les rôles.');
    }
    try {
      const userRecord = await auth.getUserByEmail(targetEmail.toLowerCase().trim());
      resolvedUid = userRecord.uid;
    } catch (err) {
      // L'utilisateur n'a pas encore créé son compte Firebase Auth — c'est normal
      return { status: 'pending', message: 'Utilisateur non inscrit. Les claims seront définis à la première connexion.' };
    }
  } else if (targetUid) {
    resolvedUid = targetUid;
    if (targetUid !== context.auth.uid) {
      const callerClaims = context.auth.token;
      if (callerClaims.role !== 'consultant' || !callerClaims.isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Seul un administrateur peut modifier les rôles.');
      }
    }
  } else {
    resolvedUid = context.auth.uid;
  }

  // Récupérer les infos du user ciblé
  let targetUser;
  try {
    targetUser = await auth.getUser(resolvedUid);
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
    const consultantData = consultantsSnap.docs[0].data();
    const permission = consultantData.permission || 'senior';
    const isAdmin = email === SUPER_ADMIN_EMAIL || consultantData.role === 'admin' || permission === 'admin';

    await auth.setCustomUserClaims(resolvedUid, { role: 'consultant', isAdmin, permission });
    return { role: 'consultant', isAdmin, permission };
  }

  const clientsSnap = await db
    .collection('clients')
    .where('owner.email', '==', email)
    .limit(1)
    .get();

  if (!clientsSnap.empty) {
    const doc = clientsSnap.docs[0];
    await auth.setCustomUserClaims(resolvedUid, { role: 'client', clientId: doc.id });
    return { role: 'client', clientId: doc.id };
  }

  // Pas de rôle trouvé
  await auth.setCustomUserClaims(resolvedUid, {});
  throw new functions.https.HttpsError('permission-denied', 'Email non autorisé dans le système.');
});
