import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Trigger: when a record is published (isPublished goes from false to true),
 * send an email notification to the client.
 */
export const onRecordPublish = functions.firestore
  .document('records/{recordId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger when isPublished changes from false to true
    if (before.isPublished || !after.isPublished) return;

    const clientId = after.clientId;
    if (!clientId) return;

    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (!clientDoc.exists) return;

      const client = clientDoc.data()!;
      const ownerEmail = client.owner?.email;
      if (!ownerEmail) return;

      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const companyName = escHtml(client.companyName || 'Votre entreprise');
      const month = escHtml(String(after.month || ''));
      const year = String(after.year || '');

      // Use Firebase Mail Extension (collection-based trigger)
      await db.collection('mail').add({
        to: ownerEmail,
        message: {
          subject: `[AB Consultants] Nouvelles données publiées - ${month} ${year}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: #0f172a; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 20px;">AB CONSULTANTS</h1>
                <p style="margin: 4px 0 0; opacity: 0.7; font-size: 12px;">Suite Financière</p>
              </div>
              <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <h2 style="color: #0f172a; margin-top: 0;">Bonjour,</h2>
                <p style="color: #475569; line-height: 1.6;">
                  De nouvelles données ont été publiées pour <strong>${companyName}</strong>
                  pour la période de <strong>${month} ${year}</strong>.
                </p>
                <p style="color: #475569; line-height: 1.6;">
                  Connectez-vous à votre espace pour consulter votre tableau de bord mis à jour.
                </p>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="https://app-ab-consultant.web.app"
                     style="display: inline-block; background: #0f172a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                    Voir mon tableau de bord
                  </a>
                </div>
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
                  Cordialement,<br>L'équipe AB Consultants
                </p>
              </div>
            </div>
          `
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      functions.logger.info('Publication email sent', { clientId, ownerEmail, month, year });
    } catch (err) {
      functions.logger.error('Failed to send publication email', { clientId, error: err });
    }
  });

/**
 * Trigger: when a consultant sends a message, notify the client by email.
 */
export const onConsultantMessage = functions.firestore
  .document('conversations/{clientId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    if (message.sender !== 'consultant') return;
    if (message.isSystemSummary) return;

    const clientId = context.params.clientId;

    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (!clientDoc.exists) return;

      const client = clientDoc.data()!;
      const ownerEmail = client.owner?.email;
      if (!ownerEmail) return;

      await db.collection('mail').add({
        to: ownerEmail,
        message: {
          subject: `[AB Consultants] Nouveau message de votre consultant`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: #0f172a; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 20px;">AB CONSULTANTS</h1>
              </div>
              <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <h2 style="color: #0f172a; margin-top: 0;">Vous avez un nouveau message</h2>
                <div style="background: #f8fafc; border-left: 4px solid #0f172a; padding: 16px; border-radius: 0 8px 8px 0; margin: 16px 0;">
                  <p style="color: #334155; margin: 0; line-height: 1.6;">${((message.text || '').substring(0, 200)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}${(message.text || '').length > 200 ? '...' : ''}</p>
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="https://app-ab-consultant.web.app"
                     style="display: inline-block; background: #0f172a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Répondre
                  </a>
                </div>
              </div>
            </div>
          `
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      functions.logger.error('Failed to send message notification', { clientId, error: err });
    }
  });
