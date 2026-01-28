
import React from 'react';
import { LayoutDashboard, FilePlus, Settings, Database, Users, Briefcase, Eye, EyeOff, LogOut, ChevronRight, ShieldCheck, UserCircle, ChevronDown, MessageSquare, PieChart } from 'lucide-react';
import { View, Client, APP_VERSION } from '../types';

interface SidebarProps {
    isOpen: boolean;
    userRole: 'ab_consultant' | 'client';
    currentView: View;
    selectedClient: Client | null;
    clients: Client[];
    simulatedUserEmail: string | null;
    accessibleCompanies: Client[];
    isSuperAdmin: boolean;
    onNavigate: (view: View) => void;
    onClientSelect: (client: Client | null) => void; // Update type to allow null
    onToggleSimulation: () => void;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    userRole,
    currentView,
    selectedClient,
    clients,
    simulatedUserEmail,
    accessibleCompanies,
    isSuperAdmin,
    onNavigate,
    onClientSelect,
    onToggleSimulation,
    onLogout
}) => {

    // Calcul des notifications
    const unreadCount = clients.filter(c => c.hasUnreadMessages).length;

    const NavItem = ({ view, icon: Icon, label, badge }: { view: View, icon: any, label: string, badge?: number }) => (
        <button
            onClick={() => onNavigate(view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${currentView === view
                ? (userRole === 'ab_consultant' ? 'bg-brand-700 text-white shadow-md ring-1 ring-white/10' : 'bg-brand-600 text-white shadow-md')
                : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                }`}
        >
            <div className="relative">
                <Icon className={`w-5 h-5 ${currentView === view ? 'text-accent-500' : 'text-brand-400 group-hover:text-accent-500'}`} />
                {badge && badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-brand-900 animate-pulse">
                        {badge}
                    </span>
                )}
            </div>
            <span className="font-medium text-sm">{label}</span>
            {currentView === view && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
        </button>
    );

    return (
        <aside className={`
            fixed lg:static inset-y-0 left-0 z-40 w-72 bg-brand-900 text-white transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl
            ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
            {/* Header Branding */}
            <div className="p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-brand-800 rounded-full opacity-50 blur-2xl"></div>

                <div className="flex items-center gap-3 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-brand-700 to-brand-950 border border-brand-700`}>
                        <span className="font-extrabold text-white text-xl">{userRole === 'ab_consultant' ? 'AB' : (selectedClient ? selectedClient.companyName.substring(0, 2).toUpperCase() : 'C')}</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight leading-none mb-1 text-white">
                            {userRole === 'ab_consultant' ? 'AB CONSULTANTS' : (selectedClient ? selectedClient.companyName : 'Espace Client')}
                        </h1>
                        <p className="text-[10px] text-brand-300 uppercase tracking-widest font-semibold flex items-center gap-1">
                            {userRole === 'ab_consultant' ? <ShieldCheck className="w-3 h-3 text-accent-500" /> : null}
                            {userRole === 'ab_consultant' ? 'Suite Financière' : 'Portail Consultant'}
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-4 pb-4 space-y-6 overflow-y-auto custom-scrollbar">

                {/* SECTION 1: ADMIN - Visible only to Consultant */}
                {userRole === 'ab_consultant' && (
                    <div className="animate-in slide-in-from-left-2">
                        <h3 className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-3 px-2">Pilotage Cabinet</h3>
                        
                        {/* BOUTON VUE D'ENSEMBLE (Nouveau) */}
                         <button
                            onClick={() => { onClientSelect(null); onNavigate(View.Dashboard); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group mb-2 ${!selectedClient && currentView === View.Dashboard
                                ? 'bg-brand-700 text-white shadow-md ring-1 ring-white/10'
                                : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                            }`}
                        >
                            <PieChart className={`w-5 h-5 ${!selectedClient && currentView === View.Dashboard ? 'text-accent-500' : 'text-brand-400'}`} />
                            <span className="font-medium text-sm">Vue d'ensemble</span>
                        </button>

                        <NavItem view={View.Clients} icon={Users} label="Portefeuille Clients" />
                        <NavItem view={View.Messages} icon={MessageSquare} label="Messagerie" badge={unreadCount} />
                        {isSuperAdmin && (
                            <div className="mt-1">
                                <NavItem view={View.Team} icon={Briefcase} label="Mon Équipe" />
                            </div>
                        )}
                    </div>
                )}

                {/* SECTION 2: CLIENT CONTEXT */}
                {(selectedClient || userRole === 'client') && (
                    <div className="animate-in slide-in-from-left-2 duration-300">
                        {userRole === 'ab_consultant' && (
                            <div className="flex items-center justify-between px-2 mb-3 mt-2">
                                <h3 className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Espace Dossier</h3>
                                {selectedClient && <span className="text-[10px] bg-brand-800 text-brand-300 px-1.5 py-0.5 rounded border border-brand-700">{selectedClient.id}</span>}
                            </div>
                        )}

                        {/* Client Card / Multi-Company Selector */}
                        {selectedClient && (
                            <div className={`rounded-xl p-4 border border-brand-700/30 mb-3 shadow-inner ${userRole === 'ab_consultant' ? 'bg-brand-800/20' : 'bg-transparent border-0 p-0'}`}>

                                {/* Consultant View: Static Info */}
                                {userRole === 'ab_consultant' && (
                                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-brand-700/30">
                                        <div className="w-10 h-10 rounded-full bg-white text-brand-900 flex items-center justify-center font-bold text-lg shadow-sm">
                                            {selectedClient.companyName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h4 className="text-sm font-bold text-white truncate">{selectedClient.companyName}</h4>
                                            <p className="text-[10px] text-brand-300 truncate">{selectedClient.managerName}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Client View: Multi-Company Dropdown */}
                                {userRole === 'client' && accessibleCompanies.length > 1 && (
                                    <div className="mb-4 relative">
                                        <label className="text-[10px] font-bold text-brand-400 uppercase mb-1 block">Sélectionner un dossier</label>
                                        <div className="relative group">
                                            <select
                                                value={selectedClient.id}
                                                onChange={(e) => {
                                                    const nextClient = accessibleCompanies.find(c => c.id === e.target.value);
                                                    if (nextClient) onClientSelect(nextClient);
                                                }}
                                                className="w-full appearance-none bg-brand-800 text-white text-sm font-bold pl-3 pr-8 py-2.5 rounded-lg border border-brand-600 focus:ring-2 focus:ring-accent-500 cursor-pointer shadow-sm hover:bg-brand-700 transition-colors"
                                            >
                                                {accessibleCompanies.map(c => (
                                                    <option key={c.id} value={c.id}>{c.companyName}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-brand-400 pointer-events-none group-hover:text-white" />
                                        </div>
                                    </div>
                                )}

                                {/* Navigation Links */}
                                <div className="space-y-1">
                                    <NavItem view={View.Dashboard} icon={LayoutDashboard} label="Tableau de Bord" />
                                    <NavItem view={View.Entry} icon={FilePlus} label="Saisie Mensuelle" />
                                    <NavItem view={View.History} icon={Database} label="Historique & Export" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SECTION 3: SYSTEM */}
                <div className="mt-4 pt-4 border-t border-brand-800/50 animate-in slide-in-from-left-2">
                    {userRole === 'ab_consultant' && selectedClient && (
                        <NavItem view={View.Settings} icon={Settings} label="Configuration Dossier" />
                    )}

                    {userRole === 'ab_consultant' && (
                        <button
                            onClick={onToggleSimulation}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-brand-300 hover:bg-brand-800 hover:text-white transition-all duration-200 mt-2"
                        >
                            <Eye className="w-5 h-5" />
                            <span className="font-medium text-sm">Aperçu Mode Client</span>
                        </button>
                    )}

                    {userRole === 'client' && isSuperAdmin && (
                        <button
                            onClick={onToggleSimulation}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-accent-400 hover:bg-brand-800 hover:text-accent-300 transition-all duration-200 mt-2 font-bold bg-brand-950/30"
                        >
                            <EyeOff className="w-5 h-5" />
                            <span className="font-medium text-sm">Quitter l'aperçu</span>
                        </button>
                    )}

                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-300 hover:bg-red-900/30 hover:text-red-200 transition-all duration-200 mt-4"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium text-sm">Déconnexion</span>
                    </button>
                </div>

            </nav>
            
            {/* FOOTER VERSION */}
            <div className="p-4 text-center border-t border-brand-800/30">
                <p className="text-[10px] text-brand-500 font-mono opacity-60">v{APP_VERSION}</p>
            </div>
        </aside>
    );
};

export default Sidebar;
