import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * scheduleAppointment — Callable Cloud Function
 *
 * Le consultant programme un RDV avec un client.
 * Génère un token sécurisé, sauvegarde le RDV sur le document client,
 * et envoie un email de convocation avec liens Confirmer / Proposer autre date.
 */
export const scheduleAppointment = functions.https.onCall(async (data, context) => {
  // Vérification auth + rôle consultant
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }
  if (context.auth.token.role !== 'consultant') {
    throw new functions.https.HttpsError('permission-denied', 'Seuls les consultants peuvent programmer un RDV.');
  }

  const { clientId, date, time, location } = data;

  if (!clientId || !date || !time) {
    throw new functions.https.HttpsError('invalid-argument', 'clientId, date et time sont requis.');
  }

  // Valider le format de la date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new functions.https.HttpsError('invalid-argument', 'Format de date invalide (YYYY-MM-DD attendu).');
  }

  // Vérifier que le client existe
  const clientDoc = await db.collection('clients').doc(clientId).get();
  if (!clientDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Client non trouvé.');
  }

  const clientData = clientDoc.data()!;

  try {
    // Générer un token sécurisé
    const token = crypto.randomUUID();

    // Sauvegarder le RDV sur le document client
    const nextAppointment = {
      date,
      time,
      location: location || '',
      status: 'proposed',
      token,
      remindersSent: [],
      createdAt: new Date().toISOString(),
    };

    await db.collection('clients').doc(clientId).update({
      nextAppointment,
    });

    // Sauvegarder le token pour lookup rapide O(1)
    await db.collection('appointmentTokens').doc(token).set({
      clientId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Construire les URLs
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'ab-consultants';
    const region = 'europe-west1';
    const baseUrl = `https://${region}-${projectId}.cloudfunctions.net`;
    const confirmUrl = `${baseUrl}/confirmAppointment?token=${token}`;
    const proposeUrl = `${baseUrl}/proposeNewDate?token=${token}`;

    // Formater la date pour l'affichage
    const dateObj = new Date(date + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateFormatted = dateObj.toLocaleDateString('fr-FR', options);

    // Récupérer le nom du consultant
    const consultantName = context.auth.token.name || 'Votre consultant AB Consultants';

    // Envoyer l'email de convocation (non bloquant : le RDV est déjà sauvé)
    let emailSent = false;
    const ownerEmail = clientData.owner?.email;
    if (ownerEmail) {
      try {
        await db.collection('mail').add({
          to: ownerEmail,
          message: {
            subject: `[AB Consultants] RDV prévu le ${dateFormatted}`,
            html: buildConvocationEmail({
              clientName: clientData.owner?.name || clientData.managerName || 'Madame, Monsieur',
              companyName: clientData.companyName,
              date: dateFormatted,
              time,
              location: location || 'À définir',
              consultantName,
              confirmUrl,
              proposeUrl,
            }),
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        emailSent = true;
      } catch (emailErr: any) {
        functions.logger.error('Failed to queue convocation email', { clientId, error: emailErr?.message });
      }
    }

    functions.logger.info('Appointment scheduled', { clientId, date, time, emailSent, token: token.substring(0, 8) + '...' });

    return { success: true, token, emailSent };
  } catch (err: any) {
    functions.logger.error('Error scheduling appointment', { clientId, error: err?.message });
    throw new functions.https.HttpsError(
      'internal',
      'Erreur lors de la programmation du RDV. Veuillez réessayer.'
    );
  }
});

function buildConvocationEmail(params: {
  clientName: string;
  companyName: string;
  date: string;
  time: string;
  location: string;
  consultantName: string;
  confirmUrl: string;
  proposeUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">AB Consultants</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Votre prochain rendez-vous</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        Bonjour <strong>${params.clientName}</strong>,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        Votre consultant vous propose un rendez-vous pour analyser ensemble les résultats de <strong>${params.companyName}</strong>.
      </p>

      <!-- RDV Card -->
      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40px; vertical-align: top;">📅</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600;">${params.date}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">🕐</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600;">${params.time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">📍</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600;">${params.location}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">👤</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600;">${params.consultantName}</td>
          </tr>
        </table>
      </div>

      <!-- Buttons -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.confirmUrl}" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 0 8px 12px;">
          ✓ Confirmer ce rendez-vous
        </a>
        <br/>
        <a href="${params.proposeUrl}" style="display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 0 8px;">
          📅 Proposer une autre date
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 24px;">
        Pensez à saisir votre tableau de bord avant le rendez-vous afin que nous puissions analyser vos résultats ensemble.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f1f5f9; padding: 16px; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        AB Consultants — Accompagnement de gestion pour TPE/PME
      </p>
    </div>
  </div>
</body>
</html>`;
}
