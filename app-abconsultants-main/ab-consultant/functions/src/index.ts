/**
 * AB Consultants - Cloud Functions
 *
 * Backend sécurisé pour :
 * - Custom Claims (rôles gravés dans le token Firebase)
 * - Proxy Gemini AI (clé cachée côté serveur + rate limiting)
 * - Export CSV (génération côté serveur)
 * - Triggers Firestore (stats pré-calculées)
 * - Gestion des RDV (programmation, confirmation, rappels)
 */

export { onUserCreated } from './auth/onUserCreated';
export { setUserRole } from './auth/setUserRole';
export { askFinancialAdvisor } from './api/geminiProxy';
export { exportClientCSV } from './api/exportCSV';
export { onRecordWrite } from './triggers/onRecordWrite';

// --- APPOINTMENTS ---
export { scheduleAppointment } from './appointments/scheduleAppointment';
export { confirmAppointment } from './appointments/confirmAppointment';
export { proposeNewDate } from './appointments/proposeNewDate';
export { sendDashboardReminders } from './appointments/sendDashboardReminders';
