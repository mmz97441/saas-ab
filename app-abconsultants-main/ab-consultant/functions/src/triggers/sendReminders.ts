import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Scheduled function: runs daily at 8:00 AM (Europe/Paris).
 * On the 2nd, 5th, 10th, and 15th of each month, checks which clients
 * haven't submitted their data for the previous month and sends reminders.
 *
 * Schedule: "every day 08:00" (only acts on specific days)
 *
 * Reminder schedule:
 * - Day 2: Gentle "Le mois est ouvert, pensez à saisir vos données"
 * - Day 5: Reminder "N'oubliez pas de compléter votre saisie"
 * - Day 10: Firm "Il reste 5 jours pour saisir vos données"
 * - Day 15: Urgent "Dernier jour ! Votre consultant attend vos données"
 */
export const sendDataReminders = functions.pubsub
  .schedule('every day 08:00')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const now = new Date();
    const dayOfMonth = now.getDate();

    // Only send on specific days
    const reminderDays = [2, 5, 10, 15];
    if (!reminderDays.includes(dayOfMonth)) {
      functions.logger.info('Not a reminder day, skipping', { dayOfMonth });
      return;
    }

    // Determine which month's data we're checking for
    // On the 2nd-15th of month M, we remind about month M-1
    const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const targetMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const targetMonth = MONTH_NAMES[targetMonthIndex];

    // Get reminder message based on day
    let urgency: 'gentle' | 'reminder' | 'firm' | 'urgent';
    let subject: string;
    let emoji: string;

    switch (dayOfMonth) {
      case 2:
        urgency = 'gentle';
        subject = `Saisie ${targetMonth} — C'est parti !`;
        emoji = '📊';
        break;
      case 5:
        urgency = 'reminder';
        subject = `Rappel — Saisie ${targetMonth}`;
        emoji = '📝';
        break;
      case 10:
        urgency = 'firm';
        subject = `Saisie ${targetMonth} — Plus que 5 jours`;
        emoji = '⏰';
        break;
      case 15:
        urgency = 'urgent';
        subject = `URGENT — Dernier jour de saisie ${targetMonth}`;
        emoji = '🚨';
        break;
      default:
        return;
    }

    try {
      // Get all active clients
      const clientsSnap = await db.collection('clients')
        .where('status', '==', 'active')
        .get();

      let sentCount = 0;

      for (const clientDoc of clientsSnap.docs) {
        const client = clientDoc.data();
        const ownerEmail = client.owner?.email;
        if (!ownerEmail) continue;

        // Check if client already submitted data for target month
        const recordsSnap = await db.collection('records')
          .where('clientId', '==', clientDoc.id)
          .where('year', '==', targetYear)
          .where('month', '==', targetMonth)
          .where('isSubmitted', '==', true)
          .get();

        if (!recordsSnap.empty) continue; // Already submitted, skip

        const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const companyName = escHtml(client.companyName || 'Votre entreprise');
        const managerName = escHtml(client.managerName || '');

        const messages: Record<string, string> = {
          gentle: `Le mois de ${targetMonth} est ouvert. Pensez à saisir vos données mensuelles pour que votre consultant puisse préparer votre analyse.`,
          reminder: `N'oubliez pas de compléter votre saisie mensuelle pour ${targetMonth}. Votre consultant attend vos données pour vous fournir une analyse personnalisée.`,
          firm: `Il reste <strong>5 jours</strong> pour saisir vos données de ${targetMonth}. Prenez quelques minutes pour compléter votre tableau de bord.`,
          urgent: `<strong>Dernier jour !</strong> C'est le dernier jour pour saisir vos données de ${targetMonth}. Votre consultant a besoin de ces informations pour finaliser votre analyse.`
        };

        await db.collection('mail').add({
          to: ownerEmail,
          message: {
            subject: `[AB Consultants] ${emoji} ${subject}`,
            html: `
              <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <div style="background: #0f172a; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 20px;">AB CONSULTANTS</h1>
                </div>
                <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                  <h2 style="color: #0f172a; margin-top: 0;">Bonjour${managerName ? ' ' + managerName : ''},</h2>
                  <p style="color: #475569; line-height: 1.6;">${messages[urgency]}</p>
                  <div style="background: ${urgency === 'urgent' ? '#fef2f2' : '#f0f9ff'}; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                    <p style="margin: 0; font-weight: bold; color: ${urgency === 'urgent' ? '#dc2626' : '#0f172a'};">
                      ${companyName} — ${targetMonth} ${targetYear}
                    </p>
                  </div>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="https://app-ab-consultant.web.app"
                       style="display: inline-block; background: #0f172a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      Saisir mes données
                    </a>
                  </div>
                  <p style="color: #94a3b8; font-size: 12px;">Cordialement,<br>L'équipe AB Consultants</p>
                </div>
              </div>
            `
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        sentCount++;
      }

      functions.logger.info('Reminders sent', { dayOfMonth, targetMonth, targetYear, sentCount, urgency });
    } catch (err) {
      functions.logger.error('Failed to send reminders', { error: err });
    }
  });
