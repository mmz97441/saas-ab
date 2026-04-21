
// VERSION GLOBALE DE L'APPLICATION
export const APP_VERSION = '1.2.0'; 

export enum Month {
  Jan = 'Janvier',
  Feb = 'Février',
  Mar = 'Mars',
  Apr = 'Avril',
  May = 'Mai',
  Jun = 'Juin',
  Jul = 'Juillet',
  Aug = 'Août',
  Sep = 'Septembre',
  Oct = 'Octobre',
  Nov = 'Novembre',
  Dec = 'Décembre'
}

export enum View {
  Dashboard = 'dashboard',
  Entry = 'entry',
  History = 'history',
  Settings = 'settings',
  Clients = 'clients',
  Team = 'team',
  Messages = 'messages'
}

export interface ProfitCenter {
  id: string;
  name: string;          
  defaultMargin?: number; 
  type: 'goods' | 'services'; 
}

export interface Consultant {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'consultant';
  addedAt: string;
}

// --- COLLABORATOR TYPES ---
export type CollaboratorRole = 'owner' | 'manager' | 'viewer';
export type CollaboratorStatus = 'pending' | 'active' | 'revoked';

export interface ClientCollaborator {
  email: string;
  name: string;
  role: CollaboratorRole;
  invitedAt: string;
  invitedBy: string;
  acceptedAt?: string;
  lastLoginAt?: string;
  status: CollaboratorStatus;
}

export interface Client {
  id: string;
  companyName: string; 
  siret?: string; 
  legalForm?: string; 
  fiscalYearEnd?: string; 
  address?: string;
  zipCode?: string;
  city?: string;
  managerName?: string;
  managerPhone?: string;
  companyPhone?: string;
  owner: {
    name: string;
    email: string;
    phone?: string;
    registeredAt?: string;
    lastLoginAt?: string;
    loginCount?: number;
    loginHistory?: Array<{
      timestamp: string;
      userAgent?: string;
    }>;
  };

  // INVITATION TRACKING
  invitationStatus?: {
    lastSentAt?: string;
    sentCount: number;
    sentBy?: string;
    method?: 'email' | 'manual';
  };
  assignedConsultantEmail?: string; 
  status: 'active' | 'inactive';
  joinedDate: string;
  sector?: string;
  settings?: {
    showCommercialMargin: boolean;
    showFuelTracking?: boolean;
    revenueObjective?: number;
    fuelObjectives?: {
        gasoil: number;
        sansPlomb: number;
        gnr: number;
    };
  };
  profitCenters?: ProfitCenter[];

  // COLLABORATORS (multi-user access per client)
  collaborators?: ClientCollaborator[];

  // CHAT META DATA
  hasUnreadMessages?: boolean;
  lastMessageTime?: any;

  // RENDEZ-VOUS
  nextAppointment?: NextAppointment;
}

// --- APPOINTMENT TYPES ---
export type AppointmentStatus = 'proposed' | 'confirmed' | 'pending_change';

export interface NextAppointment {
  date: string;              // ISO date (YYYY-MM-DD)
  time: string;              // "09:00"
  location: string;          // "Sainte-Clotilde", "Visio", etc.
  status: AppointmentStatus;
  proposedDate?: string;     // Date proposée par le client (ISO)
  proposedTime?: string;     // Heure proposée par le client
  token: string;             // Token sécurisé pour les liens email
  remindersSent: number[];   // Jours avant RDV déjà rappelés : [20, 14, 7, 1]
  createdAt: string;         // ISO timestamp
}

// --- CHAT TYPES ---
export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'consultant'; 
  timestamp: any; 
  isExpertHandoff?: boolean; 
  isSystemSummary?: boolean; 
}

// --- ACTIVITY TIMELINE TYPES ---
export type ActivityEventType =
  | 'client_created'
  | 'data_submitted'
  | 'data_validated'
  | 'data_published'
  | 'appointment_scheduled'
  | 'appointment_confirmed'
  | 'email_sent'
  | 'message_received'
  | 'config_updated'
  | 'status_changed'
  | 'invitation_sent'
  | 'collaborator_added'
  | 'collaborator_revoked'
  | 'owner_first_login'
  | 'owner_login'
  | 'invitation_email_sent'
  | 'record_unlocked';

export interface ActivityEvent {
  id: string;
  clientId: string;
  type: ActivityEventType;
  description: string;
  actorEmail?: string;
  timestamp: any;
  metadata?: Record<string, any>;
}

export interface FinancialRecord {
  id: string;
  clientId: string;
  year: number;
  month: Month;
  isValidated: boolean;
  isPublished?: boolean;
  isSubmitted?: boolean;
  submittedBy?: string;
  expertComment?: string;
  revenue: {
    goods: number;
    services: number;
    total: number;
    objective: number;
    breakdown?: Record<string, number>; 
  };
  fuel?: {
    volume: number; 
    objective: number; 
    details?: {
      gasoil: { volume: number; objective: number };
      sansPlomb: { volume: number; objective: number };
      gnr: { volume: number; objective: number };
    }
  };
  margin?: {
    rate: number; 
    total: number; 
    theoretical?: number; 
    breakdown?: Record<string, number>; 
  };
  expenses: {
    salaries: number; 
    hoursWorked: number;
    overtimeHours: number; 
  };
  bfr: {
    receivables: {
      clients: number;
      state: number; 
      social: number; 
      other: number; 
      total: number; 
    };
    stock: {
      goods: number; 
      floating: number; 
      total: number; 
    };
    debts: {
      suppliers: number; 
      state: number; 
      social: number; 
      salaries: number; 
      other: number; 
      total: number; 
    };
    total: number; 
  };
  cashFlow: {
    active: number; 
    passive: number; 
    treasury: number; 
  };
}
