
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Menu, X, UserCircle, CheckCircle, Eye, EyeOff, Users, Plus, Edit2, Trash2, Search, Briefcase, Phone, Mail, MapPin, Archive, Send, Power, Loader2, UserPlus, Crown, ShieldCheck, ChevronRight, Home, Bell } from 'lucide-react';
import Dashboard from './components/Dashboard';
import EntryForm from './components/EntryForm';
import LoginScreen from './components/LoginScreen'; 
import AIChatWidget from './components/AIChatWidget';
import Sidebar from './components/Sidebar';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import ConsultantMessaging from './components/ConsultantMessaging'; 
import ConsultantDashboard from './components/ConsultantDashboard'; // Import Nouveau
import ClientModal from './components/ClientModal';
import TeamManagement from './components/TeamManagement';
import ProfileView from './components/ProfileView';
import ClientMessaging from './components/ClientMessaging';
import CRMView from './components/CRMView';
import GlossaryPanel from './components/GlossaryTooltip';
import OnboardingTour from './components/OnboardingTour';
import ReportGenerator from './components/ReportGenerator';
import HelpView from './components/HelpView';
import { useConfirmDialog } from './contexts/ConfirmContext';

import { FinancialRecord, Client, Month, ProfitCenter, Consultant, View } from './types';
import { getClients, saveClient, updateClientStatus, getRecordsByClient, resetDatabase, MONTH_ORDER, toShortMonth, getConsultants, addConsultant, deleteConsultant, deleteRecord, checkConsultantEmailExists, checkClientEmailExists, saveRecord } from './services/dataService';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { SUPER_ADMIN_EMAIL } from './config';

type UserRole = 'ab_consultant' | 'client';

const App: React.FC = () => {
  const [isAuthCheckLoading, setIsAuthCheckLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [data, setData] = useState<FinancialRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [newDataBanner, setNewDataBanner] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('ab-onboarding-done'));
  const [showReportGenerator, setShowReportGenerator] = useState(false);

  const confirm = useConfirmDialog();

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
    return () => unsubscribe();
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
            if (!isCurrentValid) {
                setSelectedClient(userCompanies[0]);
            } else if (selectedClient) {
                // Sync data changes for client role too
                const updated = userCompanies.find(c => c.id === selectedClient.id);
                if (updated && JSON.stringify(updated) !== JSON.stringify(selectedClient)) {
                    setSelectedClient(updated);
                }
            }
        }
        if ([View.Settings, View.Clients, View.Team, View.Messages, View.CRM].includes(currentView)) {
            setCurrentView(View.Dashboard);
        }
    } else {
        // En mode consultant : synchroniser selectedClient avec les données fraîches
        if (selectedClient) {
            const updated = clients.find(c => c.id === selectedClient.id);
            if (updated && JSON.stringify(updated) !== JSON.stringify(selectedClient)) {
                setSelectedClient(updated);
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

  const toggleValidation = async (record: FinancialRecord) => {
      if (userRole !== 'ab_consultant') return;
      await saveRecord({ ...record, isValidated: !record.isValidated });
      await refreshRecords();
  };

  const togglePublication = async (record: FinancialRecord) => {
      if (userRole !== 'ab_consultant') return;
      await saveRecord({ ...record, isPublished: !record.isPublished });
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
      await refreshClients();
      // On garde la modale ouverte si c'était une création pour l'étape d'invitation (gérée dans ClientModal)
      if (clientData.id) setIsClientModalOpen(false); 
      showNotification(clientData.id ? "Dossier modifié." : "Dossier créé avec succès.", 'success');
  };

  const handleUpdateClientSettings = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (userRole !== 'ab_consultant' || !selectedClient) return;
      const formData = new FormData(e.currentTarget);
      const updatedClient: Client = {
          ...selectedClient,
          companyName: formData.get('companyName') as string,
          siret: formData.get('siret') as string,
          companyPhone: formData.get('companyPhone') as string,
          legalForm: formData.get('legalForm') as string,
          fiscalYearEnd: formData.get('fiscalYearEnd') as string,
          address: formData.get('address') as string,
          zipCode: formData.get('zipCode') as string,
          city: formData.get('city') as string,
          managerName: formData.get('managerName') as string,
          managerPhone: formData.get('managerPhone') as string,
      };
      await saveClient(updatedClient);
      await refreshClients();
      showNotification("Dossier mis à jour.", 'success');
  };

  const handleUpdateProfitCenters = async (pcs: ProfitCenter[]) => {
      if (userRole !== 'ab_consultant' || !selectedClient) return;
      await saveClient({ ...selectedClient, profitCenters: pcs });
      await refreshClients();
      showNotification("Activités mises à jour.", 'success');
  };

  const handleUpdateFuelObjectives = async (objs: any) => {
      if (userRole !== 'ab_consultant' || !selectedClient) return;
      await saveClient({ ...selectedClient, settings: { ...selectedClient.settings!, fuelObjectives: objs }});
      await refreshClients();
  };

  const handleUpdateClientStatus = async (client: Client, newStatus: 'active' | 'inactive') => {
      if (userRole !== 'ab_consultant') return;
      if (statusModal.isOpen) setStatusModal({ isOpen: false, client: null }); 
      await updateClientStatus(client.id, newStatus);
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
    const wasActive = selectedClient.settings?.showFuelTracking;
    await saveClient({ ...selectedClient, settings: { ...selectedClient.settings!, showFuelTracking: !wasActive }});
    await refreshClients();
    showNotification(wasActive ? "Module Carburant désactivé." : "Module Carburant activé.", 'info');
  };

  const handleToggleCommercialMargin = async () => {
    if (userRole !== 'ab_consultant' || !selectedClient) return;
    await saveClient({ ...selectedClient, settings: { ...selectedClient.settings!, showCommercialMargin: !selectedClient.settings?.showCommercialMargin }});
    await refreshClients();
    showNotification(selectedClient.settings?.showCommercialMargin ? "Module Marge désactivé." : "Module Marge activé.", 'info');
  };

  // --- UI UPDATES (LOCAL) ---
  const handleClientRead = (clientId: string) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, hasUnreadMessages: false } : c));
  };

  const dashboardData = useMemo(() => userRole === 'client' ? data.filter(r => r.isPublished) : data, [data, userRole]);

  // Track new published data for client (only after initial load)
  const prevPublishedCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (userRole !== 'client' || data.length === 0) return;

    const publishedCount = data.filter(r => r.isPublished).length;

    // First real data load — record baseline count, no banner
    if (prevPublishedCountRef.current === null) {
      prevPublishedCountRef.current = publishedCount;
      return;
    }

    if (publishedCount > prevPublishedCountRef.current) {
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

  if (isAuthCheckLoading) return <div className="min-h-screen flex items-center justify-center bg-brand-50"><Loader2 className="w-8 h-8 animate-spin text-brand-600"/></div>;
  if (!isAuthenticated) return <LoginScreen onLogin={handleLoginSuccess} />;

  return (
    <div className="min-h-screen flex bg-brand-50 relative">
      {notification && (
          <div className="fixed top-4 right-4 z-50 px-6 py-4 bg-white rounded-lg shadow-xl border border-brand-200 animate-in slide-in-from-right-10">
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

      {!isPresentationMode && <Sidebar
          isOpen={isSidebarOpen}
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
          onLogout={handleLogout}
      />}

      <main className="flex-1 overflow-x-hidden overflow-y-auto h-screen relative">
         <div className="lg:hidden h-16 bg-white shadow-sm mb-4 flex items-center justify-end px-4">
            <span className="font-bold text-brand-900">{selectedClient?.companyName || 'AB Consultants'}</span>
         </div>
         
         <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">

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
                       currentView === View.Clients ? 'Clients' :
                       currentView === View.Profile ? 'Mon Profil' :
                       currentView === View.Help ? 'Aide & Guide' :
                       currentView === View.CRM ? 'CRM' :
                       currentView === View.ClientMessages ? 'Ma Messagerie' : ''}
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

            {/* VUE 1 : DASHBOARD CLIENT INDIVIDUEL */}
            {currentView === View.Dashboard && selectedClient && (
                <Dashboard data={dashboardData} client={selectedClient} userRole={userRole} onSaveComment={handleSaveRecord} isPresentationMode={isPresentationMode} onTogglePresentation={() => setIsPresentationMode(p => !p)} onGenerateReport={() => setShowReportGenerator(true)}/>
            )}

            {/* VUE 2 : DASHBOARD GLOBAL CONSULTANT */}
            {currentView === View.Dashboard && !selectedClient && userRole === 'ab_consultant' && (
                <ConsultantDashboard 
                    clients={clients} 
                    onSelectClient={(client) => setSelectedClient(client)}
                    onNavigateToMessages={() => setCurrentView(View.Messages)}
                />
            )}

            {currentView === View.Entry && selectedClient && (
                <EntryForm clientId={selectedClient.id} initialData={editingRecord} existingRecords={data} profitCenters={selectedClient.profitCenters || []} showCommercialMargin={selectedClient.settings?.showCommercialMargin ?? true} showFuelTracking={selectedClient.settings?.showFuelTracking ?? false} onSave={handleSaveRecord} onCancel={() => { setEditingRecord(null); setCurrentView(View.History); }} userRole={userRole} defaultFuelObjectives={selectedClient.settings?.fuelObjectives} clientStatus={selectedClient.status}/>
            )}

            {currentView === View.History && selectedClient && (
                <HistoryView data={data} userRole={userRole} onNewRecord={handleNewRecord} onExportCSV={async () => {
                    if (!selectedClient) return;
                    try {
                        const { exportClientCSV } = await import('./lib/cloudFunctions');
                        await exportClientCSV({ clientId: selectedClient.id });
                        showNotification('Export CSV téléchargé.', 'success');
                    } catch (err: any) {
                        console.error('Export CSV error:', err);
                        showNotification(err?.message || 'Erreur lors de l\'export CSV.', 'error');
                    }
                }} onEdit={handleEditRecord} onDelete={handleDeleteRecord} onValidate={toggleValidation} onPublish={togglePublication} onLockToggle={toggleClientLock}/>
            )}

            {currentView === View.Settings && userRole === 'ab_consultant' && selectedClient && (
                <SettingsView client={selectedClient} onUpdateClientSettings={handleUpdateClientSettings} onUpdateProfitCenters={handleUpdateProfitCenters} onUpdateFuelObjectives={handleUpdateFuelObjectives} onUpdateClientStatus={(c, s) => { setStatusModal({isOpen: true, client: c}); }} onResetDatabase={handleResetDatabase} onToggleFuelModule={handleToggleFuelModule} onToggleCommercialMargin={handleToggleCommercialMargin} />
            )}
            
            {/* VUE MESSAGERIE CONSULTANT */}
            {currentView === View.Messages && userRole === 'ab_consultant' && (
                <ConsultantMessaging clients={clients} onMarkAsRead={handleClientRead} />
            )}

            {/* VUE EQUIPE (TEAM) */}
            {currentView === View.Team && userRole === 'ab_consultant' && (
                <TeamManagement currentUserEmail={currentUserEmail} />
            )}

            {/* VUE PROFIL */}
            {currentView === View.Profile && (
                <ProfileView currentUserEmail={currentUserEmail} userRole={userRole} clientName={selectedClient?.companyName} />
            )}

            {/* VUE AIDE */}
            {currentView === View.Help && (
                <HelpView
                  userRole={userRole}
                  onRestartTour={() => {
                    localStorage.removeItem('ab-onboarding-done');
                    setShowOnboarding(true);
                  }}
                />
            )}

            {/* VUE MESSAGERIE CLIENT */}
            {currentView === View.ClientMessages && userRole === 'client' && selectedClient && (
                <ClientMessaging client={selectedClient} data={dashboardData} />
            )}

            {/* VUE CRM (Consultant) */}
            {currentView === View.CRM && userRole === 'ab_consultant' && selectedClient && (
                <CRMView client={selectedClient} currentUserEmail={currentUserEmail || ''} currentUserName="Consultant" />
            )}

            {/* VUE LISTE CLIENTS */}
            {currentView === View.Clients && userRole === 'ab_consultant' && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Header avec Onglets */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <Users className="w-6 h-6 text-brand-500" /> Portefeuille Clients
                            </h2>
                            <button onClick={() => { setEditingClient(null); setIsClientModalOpen(true); }} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-bold shadow-sm transition">
                                <Plus className="w-4 h-4" /> Nouveau Dossier
                            </button>
                        </div>
                        
                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={clientSearchQuery}
                                onChange={(e) => setClientSearchQuery(e.target.value)}
                                placeholder="Rechercher par nom, dirigeant, ville, SIRET..."
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition placeholder-slate-400"
                            />
                            {clientSearchQuery && (
                                <button onClick={() => setClientSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Onglets Actifs / Archives */}
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                            <button 
                                onClick={() => setClientViewMode('active')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${clientViewMode === 'active' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Briefcase className="w-4 h-4" /> Dossiers Actifs
                            </button>
                            <button 
                                onClick={() => setClientViewMode('inactive')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${clientViewMode === 'inactive' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Archive className="w-4 h-4" /> Archives / Veille
                            </button>
                        </div>
                    </div>

                    {/* Grid Clients */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedClientsList.length > 0 ? (
                            displayedClientsList.map(client => (
                                <div key={client.id} className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition cursor-pointer group relative ${client.status === 'inactive' ? 'opacity-75 grayscale-[0.3]' : ''}`} onClick={() => { setSelectedClient(client); setCurrentView(View.Dashboard); }}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${client.status === 'inactive' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700'}`}>
                                            {client.companyName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{client.companyName}</h3>
                                            <p className="text-sm text-slate-400">{client.managerName}</p>
                                        </div>
                                    </div>
                                    
                                    {client.status === 'inactive' && (
                                        <div className="absolute top-4 right-12 px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full">Archivé</div>
                                    )}

                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setEditingClient(client); setIsClientModalOpen(true); }} 
                                            className="p-2 text-slate-400 hover:text-brand-600 bg-white rounded-full shadow-sm border border-slate-100"
                                            title="Modifier / Restaurer"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                                <Archive className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="font-medium">Aucun dossier dans cette catégorie.</p>
                            </div>
                        )}
                    </div>
                 </div>
            )}
         </div>
      </main>
      
      {/* REPORT GENERATOR */}
      {selectedClient && (
        <ReportGenerator client={selectedClient} data={data} isOpen={showReportGenerator} onClose={() => setShowReportGenerator(false)} />
      )}

      {/* GLOSSAIRE FINANCIER */}
      <GlossaryPanel isOpen={showGlossary} onClose={() => setShowGlossary(false)} />

      {/* ONBOARDING TOUR */}
      {showOnboarding && isAuthenticated && (
        <OnboardingTour userRole={userRole} onComplete={() => setShowOnboarding(false)} />
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
