/**
 * Client-side wrappers pour les Cloud Functions.
 *
 * Ces fonctions appellent le backend sécurisé au lieu des APIs directement.
 * - Gemini AI : via le proxy (clé cachée serveur)
 * - Export CSV : via la Cloud Function (vérification des droits serveur)
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp, getApp } from 'firebase/app';

let functions: ReturnType<typeof getFunctions>;

function getFirebaseFunctions() {
  if (!functions) {
    try {
      const app = getApp();
      functions = getFunctions(app, 'europe-west1'); // Région France
    } catch {
      const app = getApp();
      functions = getFunctions(app);
    }
  }
  return functions;
}

// =============================================
// GEMINI AI PROXY
// =============================================
interface AskAdvisorParams {
  query: string;
  financialContext?: {
    companyName?: string;
    revenue?: number;
    margin?: number;
    marginRate?: number;
    salaries?: number;
    bfr?: number;
    treasury?: number;
    month?: string;
    year?: number;
  };
  history?: Array<{ role: 'user' | 'model'; text: string }>;
}

interface AskAdvisorResponse {
  text: string;
  remaining: number;
}

export async function askFinancialAdvisor(params: AskAdvisorParams): Promise<AskAdvisorResponse> {
  const fn = httpsCallable<AskAdvisorParams, AskAdvisorResponse>(
    getFirebaseFunctions(),
    'askFinancialAdvisor'
  );

  const result = await fn(params);
  return result.data;
}

// =============================================
// EXPORT CSV
// =============================================
interface ExportCSVParams {
  clientId: string;
  year?: number;
}

interface ExportCSVResponse {
  csv: string;
  filename: string;
}

export async function exportClientCSV(params: ExportCSVParams): Promise<void> {
  const fn = httpsCallable<ExportCSVParams, ExportCSVResponse>(
    getFirebaseFunctions(),
    'exportClientCSV'
  );

  const result = await fn(params);
  const { csv, filename } = result.data;

  if (!csv) {
    throw new Error('Aucune donnée à exporter.');
  }

  // Déclencher le téléchargement côté navigateur
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================
// SCHEDULE APPOINTMENT
// =============================================
interface ScheduleAppointmentParams {
  clientId: string;
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
  location: string;
}

interface ScheduleAppointmentResponse {
  success: boolean;
  token: string;
}

export async function scheduleAppointment(params: ScheduleAppointmentParams): Promise<ScheduleAppointmentResponse> {
  const fn = httpsCallable<ScheduleAppointmentParams, ScheduleAppointmentResponse>(
    getFirebaseFunctions(),
    'scheduleAppointment'
  );

  const result = await fn(params);
  return result.data;
}

// =============================================
// SET USER ROLE (Admin)
// =============================================
interface SetRoleParams {
  uid?: string;
}

interface SetRoleResponse {
  role: string;
  isAdmin?: boolean;
  clientId?: string;
}

export async function refreshUserRole(uid?: string): Promise<SetRoleResponse> {
  const fn = httpsCallable<SetRoleParams, SetRoleResponse>(
    getFirebaseFunctions(),
    'setUserRole'
  );

  const result = await fn({ uid });
  return result.data;
}
