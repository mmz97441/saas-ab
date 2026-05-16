/**
 * Client-side wrappers pour les Cloud Functions.
 *
 * Ces fonctions appellent le backend sécurisé au lieu des APIs directement.
 * - Gemini AI : via le proxy (clé cachée serveur)
 * - Export CSV : via la Cloud Function (vérification des droits serveur)
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp, getApp } from 'firebase/app';
import { auth } from '../firebase';

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
  mode?: 'chat' | 'summary';
  financialContext?: Record<string, any>;
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
// GEMINI AI — STREAMING (SSE)
// =============================================
// Streaming version of askFinancialAdvisor — uses HTTP SSE instead of callable.
export interface StreamingChunk {
  text?: string;
  done?: boolean;
  remaining?: number;
  error?: string;
}

export async function askFinancialAdvisorStream(
  body: { query: string; financialContext: any; history?: any[]; attachments?: any[]; },
  onChunk: (chunk: StreamingChunk) => void,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Non authentifié');
  const idToken = await user.getIdToken();

  const url = 'https://europe-west1-app-ab-consultant.cloudfunctions.net/askFinancialAdvisorStream';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }

  if (!res.body) throw new Error('Pas de body de réponse');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Process SSE frames separated by \n\n
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (!frame.startsWith('data: ')) continue;
      const dataStr = frame.slice(6);
      try {
        const data = JSON.parse(dataStr) as StreamingChunk;
        onChunk(data);
        if (data.done || data.error) return;
      } catch (e) {
        // Malformed chunk — ignore
      }
    }
  }
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
  emailSent?: boolean;
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

// =============================================
// SEND CLIENT INVITATION
// =============================================
interface SendInvitationParams {
  clientId: string;
  method: 'email' | 'manual';
  appUrl?: string;
}

interface SendInvitationResponse {
  success: boolean;
  method: string;
}

export async function callSendClientInvitation(params: SendInvitationParams): Promise<SendInvitationResponse> {
  const fn = httpsCallable<SendInvitationParams, SendInvitationResponse>(
    getFirebaseFunctions(),
    'sendClientInvitation'
  );

  const result = await fn(params);
  return result.data;
}
