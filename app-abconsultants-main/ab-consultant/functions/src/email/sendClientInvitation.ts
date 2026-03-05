import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendMail } from './emailService';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * sendClientInvitation — Callable Cloud Function
 *
 * Envoie une invitation par email au propriétaire d'un dossier client
 * pour qu'il crée son compte sur la plateforme AB Consultants.
 *
 * Paramètres :
 * - clientId: string — ID du document client
 * - method: 'email' | 'manual' — Méthode d'envoi
 * - appUrl?: string — URL de l'application (pour le lien dans l'email)
 */
export const sendClientInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }
  if (context.auth.token.role !== 'consultant') {
    throw new functions.https.HttpsError('permission-denied', 'Seuls les consultants peuvent envoyer des invitations.');
  }

  const { clientId, method, appUrl } = data;

  if (!clientId) {
    throw new functions.https.HttpsError('invalid-argument', 'clientId est requis.');
  }

  const clientRef = db.collection('clients').doc(clientId);
  const clientSnap = await clientRef.get();

  if (!clientSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Client introuvable.');
  }

  const clientData = clientSnap.data()!;
  const ownerEmail = clientData.owner?.email;
  const ownerName = clientData.owner?.name || '';
  const companyName = clientData.companyName || '';
  const managerName = clientData.managerName || '';
  const callerEmail = context.auth.token.email || '';

  if (!ownerEmail) {
    throw new functions.https.HttpsError('failed-precondition', 'Le client n\'a pas d\'email propriétaire.');
  }

  const now = new Date().toISOString();
  const currentStatus = clientData.invitationStatus || { sentCount: 0 };

  // Update invitation status
  await clientRef.update({
    invitationStatus: {
      lastSentAt: now,
      sentCount: (currentStatus.sentCount || 0) + 1,
      sentBy: callerEmail,
      method: method || 'email',
    },
  });

  // If email method, send the actual email
  if (method === 'email') {
    const portalUrl = appUrl || 'https://app.ab-consultants.fr';
    const managerGreeting = managerName ? ` ${managerName}` : '';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);margin-top:24px;margin-bottom:24px;">

    <!-- Header -->
    <div style="background:#243b53;padding:32px 40px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">AB CONSULTANTS</h1>
      <p style="color:#9fb3c8;margin:8px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:2px;">Expertise & Stratégie Financière</p>
    </div>

    <!-- Content -->
    <div style="padding:40px;">
      <p style="color:#334e68;font-size:16px;line-height:1.6;margin-top:0;">
        Cher Partenaire${managerGreeting},
      </p>

      <p style="color:#486581;font-size:14px;line-height:1.7;">
        Dans le cadre de notre mandat d'accompagnement, nous avons le plaisir de vous confirmer l'ouverture de votre accès sécurisé à la <strong style="color:#243b53;">Suite de Pilotage Financier</strong>.
      </p>

      <div style="background:#f0f4f8;border-radius:8px;padding:24px;margin:24px 0;border-left:4px solid #486581;">
        <p style="color:#243b53;font-weight:700;margin:0 0 12px;font-size:14px;">Ce portail exclusif vous permet de :</p>
        <ul style="color:#486581;font-size:13px;line-height:2;margin:0;padding-left:16px;">
          <li>Suivre vos indicateurs stratégiques en temps réel</li>
          <li>Transmettre vos données mensuelles via un canal sécurisé</li>
          <li>Échanger confidentiellement avec votre consultant référent</li>
        </ul>
      </div>

      <div style="background:#243b53;border-radius:8px;padding:24px;margin:24px 0;color:#ffffff;">
        <p style="font-weight:700;margin:0 0 16px;font-size:14px;">PROCÉDURE D'ACTIVATION :</p>
        <ol style="font-size:13px;line-height:2.2;margin:0;padding-left:16px;color:#d9e2ec;">
          <li>Accédez au portail : <a href="${portalUrl}" style="color:#f0b429;text-decoration:none;font-weight:600;">${portalUrl}</a></li>
          <li>Sélectionnez <strong style="color:#ffffff;">"Espace Client"</strong></li>
          <li>Cliquez sur <strong style="color:#ffffff;">"Première connexion ? Créer mon accès"</strong></li>
          <li>Saisissez votre identifiant : <strong style="color:#f0b429;">${ownerEmail}</strong></li>
          <li>Définissez votre mot de passe personnel</li>
        </ol>
      </div>

      <p style="color:#829ab1;font-size:12px;line-height:1.6;margin-top:24px;">
        <strong>Note de sécurité :</strong> Cet identifiant est strictement personnel. Votre consultant référent reste à votre entière disposition pour vous accompagner.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f0f4f8;padding:20px 40px;text-align:center;border-top:1px solid #d9e2ec;">
      <p style="color:#829ab1;font-size:11px;margin:0;">
        © ${new Date().getFullYear()} AB Consultants — Cet email est confidentiel.
      </p>
    </div>
  </div>
</body>
</html>`;

    const emailSent = await sendMail({
      to: ownerEmail,
      subject: `CONFIDENTIEL | Activation de votre Portail Stratégique - ${companyName}`,
      html,
    });

    if (!emailSent) {
      functions.logger.error('Failed to send invitation email', { clientId, ownerEmail });
      // Don't throw — the invitation status is still tracked
    }
  }

  // Log activity
  const activityType = method === 'email' ? 'invitation_email_sent' : 'invitation_sent';
  const activityDesc = method === 'email'
    ? `Invitation envoyée par email à ${ownerEmail}.`
    : `Invitation marquée comme envoyée manuellement à ${ownerEmail}.`;

  await db.collection('activities').add({
    clientId,
    type: activityType,
    description: activityDesc,
    actorEmail: callerEmail,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    metadata: { method, ownerEmail },
  });

  functions.logger.info('Invitation sent', { clientId, method, ownerEmail });

  return { success: true, method };
});
