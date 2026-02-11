
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
  Messages = 'messages',
  Profile = 'profile',
  CRM = 'crm',
  ClientMessages = 'clientMessages'
}

export interface ProfitCenter {
  id: string;
  name: string;          
  defaultMargin?: number; 
  type: 'goods' | 'services'; 
}

export type ConsultantPermission = 'admin' | 'senior' | 'junior' | 'readonly';

export interface Consultant {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'consultant';
  permission?: ConsultantPermission;
  addedAt: string;
}

// CRM Types
export interface CRMNote {
  id: string;
  clientId: string;
  authorEmail: string;
  authorName: string;
  text: string;
  createdAt: any;
  type: 'note' | 'rdv' | 'call' | 'email' | 'task';
  dueDate?: string;
  isDone?: boolean;
}

// Workflow Types
export type WorkflowStatus = 'draft' | 'submitted' | 'reviewing' | 'validated' | 'published';

// Expert Comment with history
export interface ExpertComment {
  id: string;
  text: string;
  authorEmail: string;
  authorName: string;
  createdAt: any;
  month: string;
  year: number;
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
  };
  assignedConsultantEmail?: string; 
  status: 'active' | 'inactive';
  joinedDate: string;
  sector?: string;
  settings?: {
    showCommercialMargin: boolean;
    showFuelTracking?: boolean;
    fuelObjectives?: { 
        gasoil: number;
        sansPlomb: number;
        gnr: number;
    };
  };
  profitCenters?: ProfitCenter[]; 
  
  // CHAT META DATA
  hasUnreadMessages?: boolean; 
  lastMessageTime?: any;
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

export interface FinancialRecord {
  id: string;
  clientId: string; 
  year: number;
  month: Month;
  isValidated: boolean; 
  isPublished?: boolean; 
  isSubmitted?: boolean; 
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
