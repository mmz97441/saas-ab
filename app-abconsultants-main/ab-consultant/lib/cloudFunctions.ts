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
// SET USER ROLE (Admin)
// =============================================
interface SetRoleParams {
  uid?: string;
  email?: string;
}

interface SetRoleResponse {
  role?: string;
  isAdmin?: boolean;
  permission?: string;
  clientId?: string;
  status?: string;
  message?: string;
}

export async function refreshUserRole(uid?: string): Promise<SetRoleResponse> {
  const fn = httpsCallable<SetRoleParams, SetRoleResponse>(
    getFirebaseFunctions(),
    'setUserRole'
  );

  const result = await fn({ uid });
  return result.data;
}

/**
 * Rafraîchir les Custom Claims d'un consultant par email.
 * Utilisé après modification des permissions dans TeamManagement.
 * Si le consultant n'a pas encore créé son compte, retourne { status: 'pending' }.
 */
export async function refreshConsultantClaims(email: string): Promise<SetRoleResponse> {
  const fn = httpsCallable<SetRoleParams, SetRoleResponse>(
    getFirebaseFunctions(),
    'setUserRole'
  );

  const result = await fn({ email });
  return result.data;
}
