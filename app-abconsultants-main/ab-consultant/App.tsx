
import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { Menu, X, UserCircle, CheckCircle, Eye, EyeOff, Users, Plus, Edit2, Trash2, Search, Briefcase, Phone, Mail, MapPin, Archive, Send, Power, Loader2, UserPlus, Crown, ShieldCheck, ChevronRight, Home, Bell } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import { useConfirmDialog } from './contexts/ConfirmContext';

const Dashboard = lazy(() => import('./components/Dashboard'));
const EntryForm = lazy(() => import('./components/EntryForm'));
const AIChatWidget = lazy(() => import('./components/AIChatWidget'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const ConsultantMessaging = lazy(() => import('./components/ConsultantMessaging'));
const ConsultantDashboard = lazy(() => import('./components/ConsultantDashboard'));
const ClientPortfolio = lazy(() => import('./components/ClientPortfolio'));
const ClientModal = lazy(() => import('./components/ClientModal'));
const TeamManagement = lazy(() => import('./components/TeamManagement'));
const ExcelImportModal = lazy(() => import('./components/ExcelImportModal'));
const AppointmentPanel = lazy(() => import('./components/AppointmentPanel'));

import { FinancialRecord, Client, Month, ProfitCenter, Consultant, View } from './types';
import { getClients, saveClient, updateClientStatus, getRecordsByClient, resetDatabase, MONTH_ORDER, toShortMonth, getConsultants, addConsultant, deleteConsultant, deleteRecord, checkConsultantEmailExists, checkClientEmailExists, saveRecord, logActivity } from './services/dataService';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

type UserRole = 'ab_consultant' | 'client';

const App: React.FC = () => {
  const [isAuthCheckLoading, setIsAuthCheckLoading] = useState(true);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [data, setData] = useState<FinancialRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('client');
  const [simulatedUserEmail, setSimulatedUserEmail] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null); 

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientViewMode, setClientViewMode] = useState<'active' | 'inactive'>('active');
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  const [statusModal, setStatusModal] = useState<{isOpen: boolean, client: Client | null}>({ isOpen: false, client: null });
  
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [newDataBanner, setNewDataBanner] = useState(false);

  const SUPER_ADMIN_EMAIL = 'nice.guillaume@gmail.com';
  const confirm = useConfirmDialog();

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const timeout = setTimeout(() => setAuthTimeout(true), 15000);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        clearTimeout(timeout);
        setIsAuthCheckLoading(true);
        if (user) {
            const email = user.email?.toLowerCase() || '';
            setCurrentUserEmail(email);
            
            let isAuthorizedConsultant = false;
            try { isAuthorizedConsultant = await checkConsultantEmailExists(email); } catch (e) { console.error(e); }

            const isAdmin = (email === SUPER_ADMIN_EMAIL) || isAuthorizedConsultant;

            if (isAdmin) {
                setUserRole('ab_consultant');
                setIsSuperAdmin(email === SUPER_ADMIN_EMAIL);
                setIsAuthenticated(true);
                // Au login consultant, on charge les clients MAIS on ne sélectionne personne par défaut pour afficher le Dashboard Global
                try { await refreshClients('ab_consultant', email); setSelectedClient(null); } catch (error) { console.error(error); }

            } else {
                let isValidClient = false;
                try { isValidClient = await checkClientEmailExists(email); } catch (e) { console.error(e); }

                if (isValidClient) {
                     setUserRole('client');
                     setIsSuperAdmin(false);
                     setSimulatedUserEmail(email);
                     setIsAuthenticated(true);
                     try { await refreshClients('client', email); } catch (error) { console.error(error); }
                } else {
                    await auth.signOut();
                    setIsAuthenticated(false);
                }
            }
        } else {
            setIsAuthenticated(false);
            setClients([]);
            setData([]);
            setSelectedClient(null);
        }
        setIsAuthCheckLoading(false);
    });
    return () => { unsubscribe(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    refreshRecords();
  }, [selectedClient]);

  useEffect(() => {
    if (clients.length === 0) return;
    if (userRole === 'client') {
        if (!simulatedUserEmail) return;
        // La liste clients est déjà filtrée par getClients(), donc on prend le premier
        // Sécurité supplémentaire : on vérifie quand même côté client
        const userCompanies = clients.filter(c => c.owner.email.toLowerCase() === simulatedUserEmail.toLowerCase());
        if (userCompanies.length > 0) {
            const isCurrentValid = selectedClient && userCompanies.find(c => c.id === selectedClient.id);
            if (!isCurrentValid) setSelectedClient(userCompanies[0]);
        }
        if ([View.Settings, View.Clients, View.Team, View.Messages].includes(currentView)) {
            setCurrentView(View.Dashboard);
        }
    } else {
        // Sync selectedClient with fresh data from clients list after refreshClients()
        // This ensures the UI always reflects the latest saved data (name, settings, etc.)
        if (selectedClient) {
            const fresh = clients.find(c => c.id === selectedClient.id);
            if (fresh && fresh !== selectedClient) {
                setSelectedClient(fresh);
            }
        }
    }
  }, [userRole, simulatedUserEmail, clients, selectedClient, currentView]);

  const refreshClients = async (roleOverride?: UserRole, emailOverride?: string) => {
      setIsLoadingData(true);
      const role = roleOverride || userRole;
      const email = emailOverride || currentUserEmail || simulatedUserEmail;
      
      // SÉCURITÉ : Si c'est un client, on passe son email pour filtrer CÔTÉ SERVEUR
      // Si c'est un consultant, on passe null pour tout récupérer
      const filterEmail = role === 'client' ? email : null;
      
      const list = await getClients(filterEmail);
      setClients(list);
      setIsLoadingData(false);
  };

  const handleLoginSuccess = () => refreshClients();
  const handleLogout = () => auth.signOut();
  
  const handleNewRecord = () => {
      if (userRole === 'client' && selectedClient?.status === 'inactive') {
          showNotification("Dossier en veille.", 'error');
          return;
      }
      setEditingRecord(null);
      setCurrentView(View.Entry);
  };

  const handleEditRecord = (record: FinancialRecord) => {
      setEditingRecord(record);
      setCurrentView(View.Entry);
  };

  const handleSaveRecord = async (record: FinancialRecord) => {
    if (!selectedClient) return;
    const recordWithClient = { 
        ...record, 
        clientId: selectedClient.id,
        isSubmitted: userRole === 'client' ? true : record.isSubmitted 
    };
    await saveRecord(recordWithClient);
    await logActivity(selectedClient.id, 'data_submitted', `Données ${record.month} ${record.year} enregistrées`, { month: record.month, year: record.year });
    await refreshRecords();

    if (userRole === 'client') {
        showNotification("Saisie enregistrée.", 'success');
        setEditingRecord(recordWithClient);
    } else {
        showNotification("Données enregistrées.", 'success');
        setEditingRecord(null);
        if (currentView !== View.Dashboard && currentView !== View.History) setCurrentView(View.Dashboard);
    }
  };

  const refreshRecords = async () => {
    if (selectedClient) {
        setIsLoadingData(true);
        const records = await getRecordsByClient(selectedClient.id);
        setData(records);
        setIsLoadingData(false);
    } else { setData([]); }
  };

  const handleDeleteRecord = async (record: FinancialRecord) => {
      if (userRole !== 'ab_consultant') return;
      const ok = await confirm({ title: 'Supprimer ce rapport ?', message: 'Cette action est irréversible. Les données seront définitivement perdues.', variant: 'danger', confirmLabel: 'Supprimer' });
      if (!ok) return;
      await deleteRecord(record.id);
      await refreshRecords();
      showNotification("Rapport supprimé.", 'success');
  };

  const handleBulkDelete = async (records: FinancialRecord[]) => {
      if (userRole !== 'ab_consultant') return;
      for (const record of records) {
          await deleteRecord(record.id);
      }
      await refreshRecords();
      showNotification(`${records.length} rapport(s) supprimé(s).`, 'success');
  };

  const handleBulkValidate = async (records: FinancialRecord[]) => {
      if (userRole !== 'ab_consultant') return;
      for (const record of records) {
          await saveRecord({ ...record, isValidated: true });
          if (selectedClient) await logActivity(selectedClient.id, 'data_validated', `${record.month} ${record.year} validé`, { month: record.month, year: record.year });
      }
      await refreshRecords();
      showNotification(`${records.length} rapport(s) validé(s).`, 'success');
  };

  const handleBulkPublish = async (records: FinancialRecord[]) => {
      if (userRole !== 'ab_consultant') return;
      for (const record of records) {
          await saveRecord({ ...record, isPublished: true });
          if (selectedClient) await logActivity(selectedClient.id, 'data_published', `${record.month} ${record.year} publié`, { month: record.month, year: record.year });
      }
      await refreshRecords();
      showNotification(`${records.length} rapport(s) publié(s).`, 'success');
  };

  const toggleValidation = async (record: FinancialRecord) => {
      if (userRole !== 'ab_consultant') return;
      await saveRecord({ ...record, isValidated: !record.isValidated });
      if (selectedClient) await logActivity(selectedClient.id, 'data_validated', `${record.month} ${record.year} ${!record.isValidated ? 'validé' : 'dé-validé'}`, { month: record.month, year: record.year });
      await refreshRecords();
  };

  const togglePublication = async (record: FinancialRecord) => {
      if (userRole !== 'ab_consultant') return;
      await saveRecord({ ...record, isPublished: !record.isPublished });
      if (selectedClient) await logActivity(selectedClient.id, 'data_published', `${record.month} ${record.year} ${!record.isPublished ? 'publié' : 'dé-publié'}`, { month: record.month, year: record.year });
      await refreshRecords();
  };

  const toggleClientLock = async (record: FinancialRecord) => {
      if (userRole !== 'ab_consultant') return;
      await saveRecord({ ...record, isSubmitted: !record.isSubmitted });
      await refreshRecords();
  };

  // --- GESTION CLIENTS ---
  const handleSaveClient = async (clientData: Partial<Client>) => {
      if (!clientData.companyName) return;
      
      const newClient: Client = {
          ...clientData,
          id: clientData.id || `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          companyName: clientData.companyName!,
          owner: {
              name: clientData.owner?.name || 'Gérant',
              email: clientData.owner?.email || ''
          },
          status: clientData.status || 'active',
          joinedDate: clientData.joinedDate || new Date().toISOString(),
          settings: clientData.settings || { showCommercialMargin: true, showFuelTracking: false }
      } as Client;

      await saveClient(newClient);
      await logActivity(newClient.id, clientData.id ? 'config_updated' : 'client_created', clientData.id ? `Dossier ${newClient.companyName} modifié` : `Dossier ${newClient.companyName} créé`);
      await refreshClients();
      // On garde la modale ouverte si c'était une création pour l'étape d'invitation (gérée dans ClientModal)
      if (clientData.id) setIsClientModalOpen(false);
      showNotification(clientData.id ? "Dossier modifié." : "Dossier créé avec succès.", 'success');
  };

  const handleUpdateClientSettings = async (fields: { companyName: string; siret: string; companyPhone: string; legalForm: string; fiscalYearEnd: string; address: string; zipCode: string; city: string; managerName: string; managerPhone: string }) => {
      if (userRole !== 'ab_consultant' || !selectedClient) return;
      const updatedClient: Client = { ...selectedClient, ...fields };
      await saveClient(updatedClient);
      setSelectedClient(updatedClient);
      await refreshClients();
      showNotification("Dossier mis à jour.", 'success');
  };

  const handleUpdateProfitCenters = async (pcs: ProfitCenter[]) => {
      if (userRole !== 'ab_consultant' || !selectedClient) return;
      const updated = { ...selectedClient, profitCenters: pcs };
      await saveClient(updated);
      setSelectedClient(updated);
      await refreshClients();
      showNotification("Activités mises à jour.", 'success');
  };

  const handleExcelImport = async (records: FinancialRecord[], newProfitCenters: ProfitCenter[], allProfitCenters: ProfitCenter[]) => {
    if (!selectedClient) return;
    try {
      // Step 1: If there are new profit centers, update the client first
      if (newProfitCenters.length > 0) {
        await saveClient({ ...selectedClient, profitCenters: allProfitCenters });
        await refreshClients();
      }

      // Step 2: Save all records
      for (const record of records) {
        await saveRecord({ ...record, clientId: selectedClient.id });
      }

      await refreshRecords();
      setIsExcelImportOpen(false);

      const parts = [`${records.length} mois importés`];
      if (newProfitCenters.length > 0) {
        parts.push(`${newProfitCenters.length} familles créées`);
      }
      showNotification(`Import Excel réussi : ${parts.join(', ')}.`, 'success');
    } catch (err: any) {
      console.error('Excel import error:', err);
      showNotification(err?.message || 'Erreur lors de l\'import Excel.', 'error');
    }
  };

  const handleUpdateFuelObjectives = async (objs: any) => {
      if (userRole !== 'ab_consultant' || !selectedClient) return;
      const updated = { ...selectedClient, settings: { ...selectedClient.settings!, fuelObjectives: objs }};
      await saveClient(updated);
      setSelectedClient(updated);
      await refreshClients();
  };

  const handleUpdateClientStatus = async (client: Client, newStatus: 'active' | 'inactive') => {
      if (userRole !== 'ab_consultant') return;
      if (statusModal.isOpen) setStatusModal({ isOpen: false, client: null });
      await updateClientStatus(client.id, newStatus);
      await logActivity(client.id, 'status_changed', `Dossier ${newStatus === 'active' ? 'réactivé' : 'archivé'}`);
      await refreshClients();
      showNotification(`Dossier ${newStatus}.`, 'success');
  };

  const handleResetDatabase = async () => {
      if (!isSuperAdmin) return;
      const ok = await confirm({ title: 'Réinitialiser la base ?', message: 'ATTENTION : Toutes les données (clients, rapports, messages) seront supprimées définitivement.\n\nCette action est IRRÉVERSIBLE.', variant: 'danger', confirmLabel: 'Tout supprimer' });
      if (!ok) return;
      await resetDatabase();
      await refreshClients();
      setSelectedClient(null);
  };

  const handleToggleFuelModule = async () => {
    if (userRole !== 'ab_consultant' || !selectedClient) return;
    const updated = { ...selectedClient, settings: { ...selectedClient.settings!, showFuelTracking: !selectedClient.settings?.showFuelTracking }};
    await saveClient(updated);
    setSelectedClient(updated);
    await refreshClients();
  };

  const handleToggleCommercialMargin = async () => {
    if (userRole !== 'ab_consultant' || !selectedClient) return;
    const updated = { ...selectedClient, settings: { ...selectedClient.settings!, showCommercialMargin: !selectedClient.settings?.showCommercialMargin }};
    await saveClient(updated);
    setSelectedClient(updated);
    await refreshClients();
    showNotification(updated.settings?.showCommercialMargin ? "Module Marge activé." : "Module Marge désactivé.", 'info');
  };

  // --- UI UPDATES (LOCAL) ---
  const handleClientRead = (clientId: string) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, hasUnreadMessages: false } : c));
  };

  const dashboardData = useMemo(() => userRole === 'client' ? data.filter(r => r.isPublished) : data, [data, userRole]);

  // Track new published data for client
  const prevPublishedCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (userRole !== 'client') return;
    const publishedCount = data.filter(r => r.isPublished).length;
    if (prevPublishedCountRef.current !== null && publishedCount > prevPublishedCountRef.current) {
      setNewDataBanner(true);
      setTimeout(() => setNewDataBanner(false), 10000);
    }
    prevPublishedCountRef.current = publishedCount;
  }, [data, userRole]);
  const accessibleCompanies = useMemo(() => {
    if (userRole !== 'client' || !simulatedUserEmail) return [];
    return clients.filter(c => c.owner.email.toLowerCase() === simulatedUserEmail.toLowerCase());
  }, [clients, simulatedUserEmail, userRole]);

  // FILTRE POUR LA VUE LISTE CLIENTS
  const displayedClientsList = useMemo(() => {
      const statusFiltered = clients.filter(c => clientViewMode === 'active' ? (c.status || 'active') === 'active' : c.status === 'inactive');
      if (!clientSearchQuery.trim()) return statusFiltered;
      const q = clientSearchQuery.toLowerCase();
      return statusFiltered.filter(c =>
        c.companyName.toLowerCase().includes(q) ||
        (c.managerName || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.siret || '').toLowerCase().includes(q)
      );
  }, [clients, clientViewMode, clientSearchQuery]);

  if (isAuthCheckLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-50 gap-4">
      <img src="/logo.svg" alt="AB Consultants" className="h-10 mb-2 opacity-80" />
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      <p className="text-sm text-brand-500 font-medium">Connexion en cours...</p>
      {authTimeout && (
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">La connexion prend plus de temps que prévu.</p>
          <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 transition">
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
  if (!isAuthenticated) return <LoginScreen onLogin={handleLoginSuccess} />;

  return (
    <div className="min-h-screen flex bg-brand-50 relative">
      {notification && (
          <div role="alert" className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-xl border animate-in slide-in-from-right-10 flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
              {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
              {notification.type === 'error' && <X className="w-5 h-5 text-red-500 shrink-0" />}
              {notification.type === 'info' && <Bell className="w-5 h-5 text-blue-500 shrink-0" />}
              <p className="font-medium text-sm">{notification.message}</p>
          </div>
      )}

      {/* NEW DATA PUBLISHED BANNER (client only) */}
      {newDataBanner && userRole === 'client' && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-600 text-white rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
              <Bell className="w-5 h-5 shrink-0" />
              <div>
                  <p className="font-bold text-sm">Nouvelles données disponibles</p>
                  <p className="text-xs text-emerald-100">Votre consultant a publié de nouvelles analyses.</p>
              </div>
              <button onClick={() => { setNewDataBanner(false); setCurrentView(View.Dashboard); }} className="ml-4 px-3 py-1 bg-white/20 rounded-lg text-xs font-bold hover:bg-white/30 transition">
                  Voir
              </button>
              <button onClick={() => setNewDataBanner(false)} className="text-white/60 hover:text-white transition">
                  <X className="w-4 h-4" />
              </button>
          </div>
      )}

      {/* CHAT WIDGET */}
      {selectedClient && (userRole === 'client' || (userRole === 'ab_consultant' && simulatedUserEmail)) && (
          <AIChatWidget client={selectedClient} data={dashboardData} />
      )}

      {/* MODAL CREATION CLIENT */}
      <ClientModal 
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          onSave={handleSaveClient}
          initialData={editingClient}
      />

      {!isPresentationMode && (
        <button className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-brand-900 text-white rounded-md print:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      )}

      {/* Overlay mobile : empêche l'interaction avec le contenu sous la sidebar */}
      {isSidebarOpen && !isPresentationMode && (
        <div
          className="fixed inset-0 z-30 bg-brand-900/40 backdrop-blur-sm lg:hidden print:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {!isPresentationMode && <Sidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          userRole={userRole}
          currentView={currentView}
          selectedClient={selectedClient}
          clients={clients}
          simulatedUserEmail={simulatedUserEmail}
          accessibleCompanies={accessibleCompanies}
          isSuperAdmin={isSuperAdmin}
          onNavigate={(view) => {
              if (view !== View.Entry) setEditingRecord(null);
              setCurrentView(view);
              if (window.innerWidth < 1024) setIsSidebarOpen(false);
          }}
          onClientSelect={setSelectedClient}
          onToggleSimulation={async () => {
              if (userRole === 'ab_consultant') {
                  if (selectedClient) {
                      setSimulatedUserEmail(selectedClient.owner.email);
                      setUserRole('client');
                      await refreshClients('client', selectedClient.owner.email);
                  } else showNotification("Sélectionnez un client", 'error');
              } else {
                  setUserRole('ab_consultant');
                  setSimulatedUserEmail(null);
                  await refreshClients('ab_consultant', currentUserEmail || undefined);
              }
          }}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={handleLogout}
      />}

      <main className="flex-1 overflow-x-hidden overflow-y-auto h-screen relative">
         <div className="lg:hidden h-16 bg-white shadow-sm mb-4 flex items-center justify-end px-4">
            <span className="font-bold text-brand-900">{selectedClient?.companyName || 'AB Consultants'}</span>
         </div>
         
         <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
           <Suspense fallback={<div className="flex items-center justify-center h-[40vh]"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>}>

            {/* BREADCRUMB NAVIGATION */}
            {!isPresentationMode && (
              <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-4 print:hidden">
                <button
                  onClick={() => { setSelectedClient(null); setCurrentView(View.Dashboard); }}
                  className="hover:text-brand-600 transition flex items-center gap-1"
                >
                  <Home className="w-3 h-3" /> Accueil
                </button>
                {selectedClient && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <button
                      onClick={() => setCurrentView(View.Dashboard)}
                      className="hover:text-brand-600 transition font-medium text-slate-500"
                    >
                      {selectedClient.companyName}
                    </button>
                  </>
                )}
                {currentView !== View.Dashboard && (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    <span className="font-bold text-slate-600">
                      {currentView === View.Entry ? (editingRecord ? 'Modification' : 'Nouvelle saisie') :
                       currentView === View.History ? 'Historique' :
                       currentView === View.Settings ? 'Paramètres' :
                       currentView === View.Messages ? 'Messagerie' :
                       currentView === View.Team ? 'Équipe' :
                       currentView === View.Clients ? 'Clients' : ''}
                    </span>
                  </>
                )}
              </nav>
            )}

            {/* WELCOME MESSAGE FOR CLIENTS WITH NO DATA */}
            {userRole === 'client' && selectedClient && dashboardData.length === 0 && currentView === View.Dashboard && (
                <div className="mb-6 bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-200 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <h2 className="text-xl font-bold text-brand-900 mb-2">Bienvenue sur votre espace, {selectedClient.managerName || 'cher client'} !</h2>
                    <p className="text-sm text-brand-700 mb-4">
                        Votre espace de pilotage financier est prêt. Commencez par saisir vos données du mois en cours.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setCurrentView(View.Entry)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 transition shadow-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Saisir mes données
                        </button>
                    </div>
                </div>
            )}

            {/* PANNEAU RDV (consultant uniquement, client sélectionné) */}
            {currentView === View.Dashboard && selectedClient && userRole === 'ab_consultant' && (
                <div className="mb-6">
                  <AppointmentPanel
                    client={selectedClient}
                    onAppointmentScheduled={refreshClients}
                    showNotification={showNotification}
                    allClients={clients}
                  />
                </div>
            )}

            {/* VUE 1 : DASHBOARD CLIENT INDIVIDUEL */}
            {currentView === View.Dashboard && selectedClient && (
                <div key={`dash-${selectedClient.id}`} className="animate-in fade-in duration-200">
                <Dashboard data={dashboardData} client={selectedClient} userRole={userRole} onSaveComment={handleSaveRecord} isPresentationMode={isPresentationMode} onTogglePresentation={() => setIsPresentationMode(p => !p)}/>
                </div>
            )}

            {/* VUE 2 : DASHBOARD GLOBAL CONSULTANT */}
            {currentView === View.Dashboard && !selectedClient && userRole === 'ab_consultant' && (
                <div key="consultant-dash" className="animate-in fade-in duration-200">
                <ConsultantDashboard
                    clients={clients}
                    onSelectClient={(client) => setSelectedClient(client)}
                    onNavigateToMessages={() => setCurrentView(View.Messages)}
                />
                </div>
            )}

            {currentView === View.Entry && selectedClient && (
                <div key="entry" className="animate-in fade-in duration-200">
                <EntryForm clientId={selectedClient.id} initialData={editingRecord} existingRecords={data} profitCenters={selectedClient.profitCenters || []} showCommercialMargin={selectedClient.settings?.showCommercialMargin ?? true} showFuelTracking={selectedClient.settings?.showFuelTracking ?? false} onSave={handleSaveRecord} onCancel={() => { setEditingRecord(null); setCurrentView(View.History); }} userRole={userRole} defaultFuelObjectives={selectedClient.settings?.fuelObjectives} clientStatus={selectedClient.status} onImportExcel={() => setIsExcelImportOpen(true)}/>
                </div>
            )}

            {currentView === View.History && selectedClient && (
                <div key="history" className="animate-in fade-in duration-200">
                <HistoryView data={userRole === 'client' ? dashboardData : data} userRole={userRole} onNewRecord={handleNewRecord} onExportCSV={async () => {
                    if (!selectedClient) return;
                    try {
                        const { exportClientCSV } = await import('./lib/cloudFunctions');
                        await exportClientCSV({ clientId: selectedClient.id });
                        showNotification('Export CSV téléchargé.', 'success');
                    } catch (err: any) {
                        console.error('Export CSV error:', err);
                        showNotification(err?.message || 'Erreur lors de l\'export CSV.', 'error');
                    }
                }} onEdit={handleEditRecord} onDelete={handleDeleteRecord} onValidate={toggleValidation} onPublish={togglePublication} onLockToggle={toggleClientLock} onBulkValidate={handleBulkValidate} onBulkPublish={handleBulkPublish} onBulkDelete={handleBulkDelete} onImportExcel={() => setIsExcelImportOpen(true)}/>
                </div>
            )}

            {currentView === View.Settings && userRole === 'ab_consultant' && selectedClient && (
                <div key="settings" className="animate-in fade-in duration-200">
                <SettingsView client={selectedClient} onUpdateClientSettings={handleUpdateClientSettings} onUpdateProfitCenters={handleUpdateProfitCenters} onUpdateFuelObjectives={handleUpdateFuelObjectives} onUpdateClientStatus={(c, s) => { setStatusModal({isOpen: true, client: c}); }} onResetDatabase={handleResetDatabase} onToggleFuelModule={handleToggleFuelModule} onToggleCommercialMargin={handleToggleCommercialMargin} />
                </div>
            )}
            
            {/* VUE MESSAGERIE CONSULTANT */}
            {currentView === View.Messages && userRole === 'ab_consultant' && (
                <div key="messages" className="animate-in fade-in duration-200">
                <ConsultantMessaging clients={clients} onMarkAsRead={handleClientRead} />
                </div>
            )}

            {/* VUE EQUIPE (TEAM) */}
            {currentView === View.Team && userRole === 'ab_consultant' && (
                <div key="team" className="animate-in fade-in duration-200">
                <TeamManagement currentUserEmail={currentUserEmail} />
                </div>
            )}

            {/* VUE LISTE CLIENTS */}
            {currentView === View.Clients && userRole === 'ab_consultant' && (
                <div key="clients" className="animate-in fade-in duration-200">
                <ClientPortfolio
                    clients={clients}
                    clientViewMode={clientViewMode}
                    clientSearchQuery={clientSearchQuery}
                    onSetClientViewMode={setClientViewMode}
                    onSetClientSearchQuery={setClientSearchQuery}
                    onSelectClient={(client) => { setSelectedClient(client); setCurrentView(View.Dashboard); }}
                    onEditClient={(client) => { setEditingClient(client); setIsClientModalOpen(true); }}
                    onNewClient={() => { setEditingClient(null); setIsClientModalOpen(true); }}
                    onToggleStatus={async (client) => {
                        const newStatus = client.status === 'active' ? 'inactive' : 'active';
                        const ok = await confirm({
                            title: client.status === 'active' ? 'Archiver ce dossier ?' : 'Réactiver ce dossier ?',
                            message: client.status === 'active'
                                ? `Le dossier "${client.companyName}" sera placé en veille. Le client ne pourra plus soumettre de données.`
                                : `Le dossier "${client.companyName}" sera remis en production.`,
                            confirmLabel: client.status === 'active' ? 'Archiver' : 'Réactiver',
                            variant: client.status === 'active' ? 'danger' : 'default'
                        });
                        if (ok) await handleUpdateClientStatus(client, newStatus);
                    }}
                    onSaveClient={async (client) => {
                        await saveClient(client);
                        await logActivity(client.id, 'config_updated', `Fiche administrative mise à jour`);
                        await refreshClients();
                        showNotification("Dossier mis à jour.", 'success');
                    }}
                    onUpdateProfitCenters={async (client, pcs) => {
                        await saveClient({ ...client, profitCenters: pcs });
                        await logActivity(client.id, 'config_updated', `Structure analytique modifiée (${pcs.length} activités)`);
                        await refreshClients();
                        showNotification("Activités mises à jour.", 'success');
                    }}
                    onToggleFuelModule={async (client) => {
                        const updated = { ...client, settings: { ...client.settings!, showFuelTracking: !client.settings?.showFuelTracking }};
                        await saveClient(updated);
                        await logActivity(updated.id, 'config_updated', `Module carburant ${updated.settings?.showFuelTracking ? 'activé' : 'désactivé'}`);
                        await refreshClients();
                    }}
                    onToggleCommercialMargin={async (client) => {
                        const updated = { ...client, settings: { ...client.settings!, showCommercialMargin: !client.settings?.showCommercialMargin }};
                        await saveClient(updated);
                        await logActivity(updated.id, 'config_updated', `Module marge ${updated.settings?.showCommercialMargin ? 'activé' : 'désactivé'}`);
                        await refreshClients();
                        showNotification(updated.settings?.showCommercialMargin ? "Module Marge activé." : "Module Marge désactivé.", 'info');
                    }}
                    onUpdateClientStatus={handleUpdateClientStatus}
                />
                </div>
            )}
           </Suspense>
         </div>
      </main>
      
      {selectedClient && (
        <ExcelImportModal
          isOpen={isExcelImportOpen}
          onClose={() => setIsExcelImportOpen(false)}
          onImport={handleExcelImport}
          clientId={selectedClient.id}
          existingRecords={data}
          existingProfitCenters={selectedClient.profitCenters || []}
          year={new Date().getFullYear()}
        />
      )}

      {statusModal.isOpen && statusModal.client && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
                    <h3 className="text-xl font-bold mb-2">Changer statut ?</h3>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setStatusModal({isOpen: false, client: null})} className="flex-1 py-2 border rounded-lg">Annuler</button>
                        <button onClick={() => handleUpdateClientStatus(statusModal.client!, statusModal.client!.status === 'inactive' ? 'active' : 'inactive')} className="flex-1 py-2 bg-brand-600 text-white rounded-lg">Confirmer</button>
                    </div>
                </div>
          </div>
      )}
    </div>
  );
};

export default App;
