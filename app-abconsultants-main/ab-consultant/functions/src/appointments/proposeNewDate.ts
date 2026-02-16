import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendMail } from '../email/emailService';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * proposeNewDate — HTTP Cloud Function
 *
 * GET : Affiche une page HTML avec un formulaire date/heure
 * POST : Sauvegarde la proposition du client et notifie le consultant
 */
export const proposeNewDate = functions.https.onRequest(async (req, res) => {
  const token = req.query.token as string || req.body?.token;

  if (!token) {
    res.status(400).send(buildResultPage('Erreur', 'Lien invalide. Aucun token fourni.', 'error'));
    return;
  }

  try {
    // Lookup du token
    const tokenDoc = await db.collection('appointmentTokens').doc(token).get();
    if (!tokenDoc.exists) {
      res.status(404).send(buildResultPage('Lien expiré', 'Ce lien n\'est plus valide. Contactez votre consultant.', 'error'));
      return;
    }

    const { clientId } = tokenDoc.data()!;
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      res.status(404).send(buildResultPage('Erreur', 'Client non trouvé.', 'error'));
      return;
    }

    const clientData = clientDoc.data()!;
    const appointment = clientData.nextAppointment;

    if (!appointment || appointment.token !== token) {
      res.status(400).send(buildResultPage('RDV modifié', 'Ce rendez-vous a été modifié. Vérifiez vos derniers emails.', 'warning'));
      return;
    }

    // GET → Afficher le formulaire
    if (req.method === 'GET') {
      const dateFormatted = formatDate(appointment.date);
      res.status(200).send(buildFormPage(token, dateFormatted, appointment.time, appointment.location));
      return;
    }

    // POST → Traiter la proposition
    if (req.method === 'POST') {
      const proposedDate = req.body?.proposedDate;
      const proposedTime = req.body?.proposedTime;

      if (!proposedDate || !proposedTime) {
        res.status(400).send(buildResultPage('Erreur', 'Veuillez renseigner une date et une heure.', 'error'));
        return;
      }

      // Sauvegarder la proposition
      await db.collection('clients').doc(clientId).update({
        'nextAppointment.status': 'pending_change',
        'nextAppointment.proposedDate': proposedDate,
        'nextAppointment.proposedTime': proposedTime,
      });

      // Notifier le consultant via SMTP
      const consultantEmail = clientData.assignedConsultantEmail || 'admin@ab-consultants.fr';
      const proposedDateFormatted = formatDate(proposedDate);
      await sendMail({
        to: consultantEmail,
        subject: `[AB Consultants] Demande de changement de RDV — ${clientData.companyName}`,
        html: `
<p><strong>${clientData.owner?.name || clientData.managerName || 'Le client'}</strong> (${clientData.companyName}) souhaite modifier son rendez-vous.</p>
<p><strong>Date actuelle :</strong> ${formatDate(appointment.date)} à ${appointment.time}</p>
<p><strong>Date proposée :</strong> ${proposedDateFormatted} à ${proposedTime}</p>
<p>Connectez-vous à l'application pour accepter ou proposer une alternative.</p>`,
      });

      functions.logger.info('New date proposed', { clientId, proposedDate, proposedTime });

      res.status(200).send(buildResultPage(
        'Proposition envoyée !',
        `Votre consultant a été informé de votre souhait de rendez-vous le <strong>${proposedDateFormatted} à ${proposedTime}</strong>.<br/><br/>Il reviendra vers vous pour confirmer.`,
        'success'
      ));
      return;
    }

    res.status(405).send('Méthode non autorisée');
  } catch (error) {
    functions.logger.error('Error in proposeNewDate', { error });
    res.status(500).send(buildResultPage('Erreur', 'Une erreur est survenue. Réessayez ou contactez votre consultant.', 'error'));
  }
});

function formatDate(isoDate: string): string {
  const dateObj = new Date(isoDate + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return dateObj.toLocaleDateString('fr-FR', options);
}

function buildFormPage(token: string, currentDate: string, currentTime: string, currentLocation: string): string {
  // Date minimum = demain
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposer une nouvelle date — AB Consultants</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
  <div style="max-width: 500px; width: 100%; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px; text-align: center;">
      <h2 style="color: white; margin: 0; font-size: 18px;">AB Consultants</h2>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 13px;">Proposer une autre date</p>
    </div>

    <!-- Current RDV info -->
    <div style="padding: 24px 30px 0;">
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          <strong>RDV actuel :</strong> ${currentDate} à ${currentTime}<br/>
          📍 ${currentLocation || 'Lieu à définir'}
        </p>
      </div>
    </div>

    <!-- Form -->
    <form method="POST" style="padding: 24px 30px 30px;">
      <input type="hidden" name="token" value="${token}" />

      <div style="margin-bottom: 20px;">
        <label style="display: block; color: #334155; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
          Date souhaitée
        </label>
        <input type="date" name="proposedDate" min="${minDate}" required
          style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; color: #334155; box-sizing: border-box; outline: none;"
          onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'"
        />
      </div>

      <div style="margin-bottom: 24px;">
        <label style="display: block; color: #334155; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
          Heure souhaitée
        </label>
        <input type="time" name="proposedTime" required value="09:00"
          style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 15px; color: #334155; box-sizing: border-box; outline: none;"
          onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'"
        />
      </div>

      <button type="submit"
        style="width: 100%; background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
        Envoyer ma proposition
      </button>
    </form>

    <!-- Footer -->
    <div style="background: #f1f5f9; padding: 16px; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        Votre consultant sera notifié et reviendra vers vous.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildResultPage(title: string, message: string, type: 'success' | 'error' | 'warning'): string {
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
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
      <div style="font-size: 48px; margin-bottom: 16px;">${icons[type]}</div>
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
