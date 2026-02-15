import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * confirmAppointment — HTTP Cloud Function
 *
 * Le client clique sur le lien dans l'email de convocation.
 * Le token est vérifié, le statut du RDV passe à 'confirmed'.
 * Retourne une page HTML de confirmation.
 */
export const confirmAppointment = functions.https.onRequest(async (req, res) => {
  const token = req.query.token as string;

  if (!token) {
    res.status(400).send(buildHtmlPage('Erreur', 'Lien invalide. Aucun token fourni.', 'error'));
    return;
  }

  try {
    // Lookup du token
    const tokenDoc = await db.collection('appointmentTokens').doc(token).get();
    if (!tokenDoc.exists) {
      res.status(404).send(buildHtmlPage('Lien expiré', 'Ce lien n\'est plus valide. Contactez votre consultant.', 'error'));
      return;
    }

    const { clientId } = tokenDoc.data()!;

    // Vérifier que le client existe et a bien ce RDV
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      res.status(404).send(buildHtmlPage('Erreur', 'Client non trouvé.', 'error'));
      return;
    }

    const clientData = clientDoc.data()!;
    const appointment = clientData.nextAppointment;

    if (!appointment || appointment.token !== token) {
      res.status(400).send(buildHtmlPage('RDV modifié', 'Ce rendez-vous a été modifié. Vérifiez vos derniers emails.', 'warning'));
      return;
    }

    if (appointment.status === 'confirmed') {
      // Déjà confirmé — page amicale
      const dateFormatted = formatDate(appointment.date);
      res.status(200).send(buildHtmlPage(
        'Déjà confirmé !',
        `Votre rendez-vous du <strong>${dateFormatted} à ${appointment.time}</strong> est bien confirmé.<br/>Pensez à saisir votre tableau de bord avant.`,
        'success'
      ));
      return;
    }

    // Confirmer le RDV
    await db.collection('clients').doc(clientId).update({
      'nextAppointment.status': 'confirmed',
    });

    // Notifier le consultant
    const consultantEmail = clientData.assignedConsultantEmail || 'admin@ab-consultants.fr';
    const dateFormatted = formatDate(appointment.date);
    await db.collection('mail').add({
      to: consultantEmail,
      message: {
        subject: `[AB Consultants] RDV confirmé — ${clientData.companyName}`,
        html: `<p><strong>${clientData.owner?.name || clientData.managerName || 'Le client'}</strong> (${clientData.companyName}) a confirmé le RDV du <strong>${dateFormatted} à ${appointment.time}</strong>.</p>`,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Appointment confirmed', { clientId, date: appointment.date });

    res.status(200).send(buildHtmlPage(
      'Rendez-vous confirmé !',
      `Votre rendez-vous du <strong>${dateFormatted} à ${appointment.time}</strong> est confirmé.<br/><br/>📍 ${appointment.location || 'Lieu à confirmer'}<br/><br/>Pensez à saisir votre tableau de bord avant le rendez-vous.`,
      'success'
    ));

  } catch (error) {
    functions.logger.error('Error confirming appointment', { error });
    res.status(500).send(buildHtmlPage('Erreur', 'Une erreur est survenue. Réessayez ou contactez votre consultant.', 'error'));
  }
});

function formatDate(isoDate: string): string {
  const dateObj = new Date(isoDate + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return dateObj.toLocaleDateString('fr-FR', options);
}

function buildHtmlPage(title: string, message: string, type: 'success' | 'error' | 'warning'): string {
  const colors = {
    success: { bg: '#f0fdf4', border: '#16a34a', icon: '✅', headerBg: '#16a34a' },
    error: { bg: '#fef2f2', border: '#dc2626', icon: '❌', headerBg: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️', headerBg: '#f59e0b' },
  };
  const c = colors[type];

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — AB Consultants</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
  <div style="max-width: 500px; width: 100%; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center;">
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px;">
      <h2 style="color: white; margin: 0; font-size: 18px;">AB Consultants</h2>
    </div>
    <div style="padding: 40px 30px;">
      <div style="font-size: 48px; margin-bottom: 16px;">${c.icon}</div>
      <h1 style="color: #1e293b; font-size: 24px; margin: 0 0 16px;">${title}</h1>
      <p style="color: #475569; font-size: 15px; line-height: 1.8;">${message}</p>
    </div>
    <div style="background: #f1f5f9; padding: 16px;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">Vous pouvez fermer cette page.</p>
    </div>
  </div>
</body>
</html>`;
}
