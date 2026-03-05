import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendMail } from '../email/emailService';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * sendDashboardReminders — Scheduled Cloud Function (CRON)
 *
 * S'exécute tous les matins à 8h (heure Réunion).
 * Pour chaque client avec un RDV à venir :
 * - Vérifie que la saisie est possible (après le 1er du mois)
 * - Vérifie si le client a déjà soumis ses données
 * - Envoie un rappel adapté selon le nombre de jours restants
 * - Arrête les rappels si saisie faite (isSubmitted)
 */
export const sendDashboardReminders = functions.region('europe-west1').pubsub
  .schedule('0 8 * * *')
  .timeZone('Indian/Reunion')
  .onRun(async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // On ne peut saisir qu'à partir du 1er du mois
    // Les données de M-1 sont saisies pendant le mois M
    const currentDay = today.getDate();
    if (currentDay < 1) return; // Sécurité (toujours >= 1 en réalité)

    // Mois de données à saisir = mois précédent
    const dataMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1; // 0-indexed
    const dataYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const dataMonthName = MONTH_NAMES[dataMonth];

    functions.logger.info('Running dashboard reminders', { todayStr, dataMonthName, dataYear });

    // Récupérer tous les clients actifs avec un RDV à venir
    const clientsSnap = await db.collection('clients')
      .where('status', '==', 'active')
      .get();

    let remindersSent = 0;
    let skipped = 0;

    for (const clientDoc of clientsSnap.docs) {
      const client = clientDoc.data();
      const clientId = clientDoc.id;
      const appointment = client.nextAppointment;

      // Pas de RDV programmé
      if (!appointment || !appointment.date) {
        skipped++;
        continue;
      }

      // RDV en attente de modification → pas de rappel
      if (appointment.status === 'pending_change') {
        skipped++;
        continue;
      }

      // Calculer les jours restants
      const rdvDate = new Date(appointment.date + 'T00:00:00');
      const diffMs = rdvDate.getTime() - today.getTime();
      const daysUntilRdv = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // RDV passé → ignorer
      if (daysUntilRdv < 0) {
        skipped++;
        continue;
      }

      // Vérifier si le client a déjà soumis pour le mois concerné
      const isSubmitted = await checkIfSubmitted(clientId, dataYear, dataMonthName);
      if (isSubmitted) {
        skipped++;
        continue;
      }

      // Déterminer si on doit envoyer un rappel aujourd'hui
      const reminderDay = getReminderDay(daysUntilRdv);
      if (reminderDay === null) {
        continue; // Pas un jour de rappel
      }

      // Vérifier qu'on n'a pas déjà envoyé ce rappel
      const alreadySent = (appointment.remindersSent || []).includes(reminderDay);
      if (alreadySent) {
        continue;
      }

      // Envoyer le rappel
      const ownerEmail = client.owner?.email;
      if (!ownerEmail) {
        functions.logger.warn('Client without owner email', { clientId });
        continue;
      }

      const rdvDateFormatted = formatDate(appointment.date);
      const level = getReminderLevel(daysUntilRdv);

      await sendMail({
        to: ownerEmail,
        subject: buildReminderSubject(level, dataMonthName),
        html: buildReminderEmail({
          clientName: client.owner?.name || client.managerName || 'Madame, Monsieur',
          companyName: client.companyName,
          dataMonthName,
          dataYear,
          rdvDate: rdvDateFormatted,
          rdvTime: appointment.time,
          daysUntilRdv,
          level,
        }),
      });

      // Marquer le rappel comme envoyé
      const updatedReminders = [...(appointment.remindersSent || []), reminderDay];
      await db.collection('clients').doc(clientId).update({
        'nextAppointment.remindersSent': updatedReminders,
      });

      remindersSent++;

      // J-1 : CC le consultant si toujours pas soumis
      if (daysUntilRdv <= 1) {
        const consultantEmail = client.assignedConsultantEmail || 'admin@ab-consultants.fr';
        await sendMail({
          to: consultantEmail,
          subject: `[AB Consultants] ⚠️ Saisie non faite — ${client.companyName} — RDV demain`,
          html: `<p><strong>${client.companyName}</strong> n'a toujours pas saisi son tableau de bord de <strong>${dataMonthName} ${dataYear}</strong>.</p>
<p>Le rendez-vous est prévu <strong>${rdvDateFormatted} à ${appointment.time}</strong>.</p>`,
        });
      }
    }

    functions.logger.info('Reminders complete', { remindersSent, skipped });
  });

async function checkIfSubmitted(clientId: string, year: number, monthName: string): Promise<boolean> {
  const snap = await db.collection('records')
    .where('clientId', '==', clientId)
    .where('year', '==', year)
    .where('month', '==', monthName)
    .limit(1)
    .get();

  if (snap.empty) return false;
  return !!snap.docs[0].data().isSubmitted;
}

/**
 * Détermine si aujourd'hui est un jour de rappel en fonction des jours restants.
 * Adaptatif selon l'écart disponible entre le 1er du mois et le RDV.
 */
function getReminderDay(daysUntilRdv: number): number | null {
  // Rappels possibles : J-20, J-14, J-7, J-3, J-1
  const reminderDays = [20, 14, 7, 3, 1];
  for (const d of reminderDays) {
    if (daysUntilRdv === d) return d;
  }
  return null;
}

type ReminderLevel = 'gentle' | 'moderate' | 'firm' | 'urgent';

function getReminderLevel(daysUntilRdv: number): ReminderLevel {
  if (daysUntilRdv > 14) return 'gentle';
  if (daysUntilRdv > 7) return 'moderate';
  if (daysUntilRdv > 1) return 'firm';
  return 'urgent';
}

function buildReminderSubject(level: ReminderLevel, monthName: string): string {
  switch (level) {
    case 'gentle':
      return `[AB Consultants] Votre tableau de bord ${monthName} est disponible`;
    case 'moderate':
      return `[AB Consultants] Pensez à saisir votre tableau de bord ${monthName}`;
    case 'firm':
      return `[AB Consultants] ⏰ Votre RDV approche — saisie ${monthName} en attente`;
    case 'urgent':
      return `[AB Consultants] ⚠️ RDV demain — saisie ${monthName} requise`;
  }
}

function buildReminderEmail(params: {
  clientName: string;
  companyName: string;
  dataMonthName: string;
  dataYear: number;
  rdvDate: string;
  rdvTime: string;
  daysUntilRdv: number;
  level: ReminderLevel;
}): string {
  const levelConfig = {
    gentle: {
      color: '#3b82f6',
      title: 'Votre tableau de bord est disponible',
      intro: `Les données de <strong>${params.dataMonthName} ${params.dataYear}</strong> sont prêtes à être saisies pour <strong>${params.companyName}</strong>.`,
      cta: 'Vous pouvez dès maintenant compléter votre saisie mensuelle.',
    },
    moderate: {
      color: '#f59e0b',
      title: 'Pensez à votre saisie mensuelle',
      intro: `Votre rendez-vous approche. Pensez à saisir les données de <strong>${params.dataMonthName} ${params.dataYear}</strong> pour <strong>${params.companyName}</strong>.`,
      cta: 'Complétez votre saisie pour que nous puissions préparer votre analyse.',
    },
    firm: {
      color: '#f97316',
      title: 'Votre rendez-vous approche',
      intro: `Il reste <strong>${params.daysUntilRdv} jours</strong> avant votre rendez-vous. La saisie de <strong>${params.dataMonthName} ${params.dataYear}</strong> pour <strong>${params.companyName}</strong> n'a pas encore été effectuée.`,
      cta: 'Merci de compléter votre saisie dès que possible.',
    },
    urgent: {
      color: '#dc2626',
      title: 'Rendez-vous demain — saisie requise',
      intro: `Votre rendez-vous est <strong>demain</strong>. La saisie de <strong>${params.dataMonthName} ${params.dataYear}</strong> pour <strong>${params.companyName}</strong> n'a pas encore été effectuée.`,
      cta: 'Merci de compléter votre saisie aujourd\'hui afin que votre consultant puisse préparer l\'analyse.',
    },
  };

  const cfg = levelConfig[params.level];

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">AB Consultants</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Rappel saisie mensuelle</p>
    </div>
    <div style="padding: 30px;">
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        Bonjour <strong>${params.clientName}</strong>,
      </p>

      <div style="background: ${cfg.color}15; border-left: 4px solid ${cfg.color}; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h2 style="color: ${cfg.color}; margin: 0 0 8px; font-size: 17px;">${cfg.title}</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">${cfg.intro}</p>
      </div>

      <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #1e293b; font-size: 14px;">
          <strong>📅 Prochain RDV :</strong> ${params.rdvDate} à ${params.rdvTime}
        </p>
      </div>

      <p style="color: #475569; font-size: 15px; line-height: 1.6;">
        ${cfg.cta}
      </p>

      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
        Connectez-vous à votre espace AB Consultants pour effectuer votre saisie.
      </p>
    </div>
    <div style="background: #f1f5f9; padding: 16px; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        AB Consultants — Accompagnement de gestion pour TPE/PME
      </p>
    </div>
  </div>
</body>
</html>`;
}

function formatDate(isoDate: string): string {
  const dateObj = new Date(isoDate + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return dateObj.toLocaleDateString('fr-FR', options);
}
