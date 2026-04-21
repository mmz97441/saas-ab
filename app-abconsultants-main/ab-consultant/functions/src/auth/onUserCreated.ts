import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin SDK (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'nice.guillaume@gmail.com';

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
export const onUserCreated = functions.region('europe-west1').auth.user().onCreate(async (user) => {
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

  // --- CHECK 2: Is this a whitelisted client (owner)? ---
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

      // Track owner first login
      const now = new Date().toISOString();
      const ownerData = clientDoc.data().owner || {};
      await clientDoc.ref.update({
        'owner.registeredAt': ownerData.registeredAt || now,
        'owner.lastLoginAt': now,
        'owner.loginCount': 1,
        'owner.loginHistory': [{ timestamp: now, userAgent: 'signup' }],
      });

      // Log activity
      await db.collection('activities').add({
        clientId: clientDoc.id,
        type: 'owner_first_login',
        description: `${ownerData.name || email} s'est connecté pour la première fois.`,
        actorEmail: email,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {},
      });

      functions.logger.info('Custom claims set: client (owner)', { email, clientId: clientDoc.id });
      return;
    }
  } catch (err) {
    functions.logger.error('Error checking clients collection (owner)', err);
  }

  // --- CHECK 3: Is this a collaborator on a client? ---
  try {
    // Firestore doesn't support array-contains on nested object fields,
    // so we scan all clients and check collaborators in code.
    const allClientsSnap = await db.collection('clients').get();

    for (const clientDoc of allClientsSnap.docs) {
      const data = clientDoc.data();
      const collaborators: any[] = data.collaborators || [];
      const match = collaborators.find(
        (c: any) => c.email?.toLowerCase() === email && c.status === 'active'
      );

      if (match) {
        await auth.setCustomUserClaims(user.uid, {
          role: 'client',
          clientId: clientDoc.id,
          collaboratorRole: match.role || 'viewer',
        });

        // Update collaborator's acceptedAt timestamp
        const updatedCollaborators = collaborators.map((c: any) =>
          c.email?.toLowerCase() === email
            ? { ...c, acceptedAt: c.acceptedAt || new Date().toISOString(), lastLoginAt: new Date().toISOString() }
            : c
        );
        // Maintain denormalized collaboratorEmails for Firestore rules (required by audit fix).
        const collaboratorEmails = updatedCollaborators
          .filter((c: any) => c.status === 'active' && c.email)
          .map((c: any) => c.email.toLowerCase().trim());
        await clientDoc.ref.update({
          collaborators: updatedCollaborators,
          collaboratorEmails,
        });

        functions.logger.info('Custom claims set: client (collaborator)', {
          email,
          clientId: clientDoc.id,
          collaboratorRole: match.role,
        });
        return;
      }
    }
  } catch (err) {
    functions.logger.error('Error checking collaborators', err);
  }

  // --- CHECK 4: Unauthorized → delete the account ---
  functions.logger.warn('Unauthorized signup attempt, deleting user.', { email, uid: user.uid });
  await auth.deleteUser(user.uid);
});
