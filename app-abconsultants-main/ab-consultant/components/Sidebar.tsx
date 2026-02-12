
import React, { useState, useMemo } from 'react';
import { LayoutDashboard, FilePlus, Settings, Database, Users, Briefcase, Eye, EyeOff, LogOut, ChevronRight, ShieldCheck, ChevronDown, MessageSquare, PieChart, Search, HelpCircle, Moon, Sun, User, FileText } from 'lucide-react';
import { View, Client, APP_VERSION } from '../types';
import { useTheme } from '../contexts/ThemeContext';

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
    onClientSelect: (client: Client | null) => void;
    onToggleSimulation: () => void;
    onLogout: () => void;
}

// Searchable company selector for multi-company clients
const ClientCompanySelector: React.FC<{ companies: Client[], selectedId: string, onSelect: (c: Client) => void }> = ({ companies, selectedId, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        if (!search.trim()) return companies;
        const q = search.toLowerCase();
        return companies.filter(c => c.companyName.toLowerCase().includes(q));
    }, [companies, search]);
    const current = companies.find(c => c.id === selectedId);

    return (
        <div className="mb-4 relative">
            <label className="text-[10px] font-bold text-brand-400 uppercase mb-1 block">Sélectionner un dossier</label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-brand-800 text-white text-sm font-bold px-3 py-2.5 rounded-lg border border-brand-600 hover:bg-brand-700 transition-colors"
            >
                <span className="truncate">{current?.companyName || 'Sélectionner'}</span>
                <ChevronDown className={`w-4 h-4 text-brand-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-brand-800 border border-brand-600 rounded-lg shadow-xl z-50 overflow-hidden">
                    {companies.length >= 5 && (
                        <div className="p-2 border-b border-brand-700">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-brand-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Rechercher..."
                                    className="w-full pl-8 pr-3 py-1.5 bg-brand-900 text-white text-xs rounded border border-brand-600 placeholder-brand-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map(c => (
                            <button
                                key={c.id}
                                onClick={() => { onSelect(c); setIsOpen(false); setSearch(''); }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-700 transition-colors ${c.id === selectedId ? 'bg-brand-700 text-accent-400 font-bold' : 'text-brand-200'}`}
                            >
                                {c.companyName}
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="px-3 py-2 text-xs text-brand-500 italic">Aucun résultat</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

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

    const { theme, toggleTheme } = useTheme();

    // Calcul des notifications (only count > 0)
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
                {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-brand-900 animate-pulse">
                        {badge}
                    </span>
                )}
            </div>
            <span className="font-medium text-sm">{label}</span>
            {currentView === view && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
        </button>
    );

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <h3 className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-3 px-2">{children}</h3>
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
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-brand-700 to-brand-950 border border-brand-700">
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

            {/* Main scrollable nav */}
            <nav className="flex-1 px-4 pb-2 space-y-1 overflow-y-auto custom-scrollbar">

                {/* ══════════════════════════════════════════
                    SECTION 1: PILOTAGE CABINET (Consultant only)
                   ══════════════════════════════════════════ */}
                {userRole === 'ab_consultant' && (
                    <div className="animate-in slide-in-from-left-2 mb-4">
                        <SectionTitle>Pilotage Cabinet</SectionTitle>

                        <button
                            onClick={() => { onClientSelect(null); onNavigate(View.Dashboard); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group mb-1 ${!selectedClient && currentView === View.Dashboard
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

                {/* ══════════════════════════════════════════
                    SECTION 2: DOSSIER CLIENT
                   ══════════════════════════════════════════ */}
                {(selectedClient || userRole === 'client') && (
                    <div className="animate-in slide-in-from-left-2 duration-300 mb-4">
                        {userRole === 'ab_consultant' && (
                            <SectionTitle>Dossier Client</SectionTitle>
                        )}

                        {selectedClient && (
                            <div className={`rounded-xl border border-brand-700/30 mb-1 shadow-inner ${userRole === 'ab_consultant' ? 'bg-brand-800/20 p-4' : 'bg-transparent border-0 p-0'}`}>

                                {/* Consultant View: Client Card */}
                                {userRole === 'ab_consultant' && (
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-700/30">
                                        <div className="w-10 h-10 rounded-full bg-white text-brand-900 flex items-center justify-center font-bold text-lg shadow-sm">
                                            {selectedClient.companyName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h4 className="text-sm font-bold text-white truncate">{selectedClient.companyName}</h4>
                                            <p className="text-[10px] text-brand-300 truncate">{selectedClient.managerName}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Client View: Multi-Company Selector */}
                                {userRole === 'client' && accessibleCompanies.length > 1 && (
                                    <ClientCompanySelector
                                        companies={accessibleCompanies}
                                        selectedId={selectedClient.id}
                                        onSelect={(c) => onClientSelect(c)}
                                    />
                                )}

                                {/* Dossier Navigation Links */}
                                <div className="space-y-1">
                                    <NavItem view={View.Dashboard} icon={LayoutDashboard} label="Tableau de Bord" />
                                    <NavItem view={View.Entry} icon={FilePlus} label="Saisie Mensuelle" />
                                    <NavItem view={View.History} icon={Database} label="Historique & Export" />
                                    {userRole === 'client' && (
                                        <NavItem view={View.ClientMessages} icon={MessageSquare} label="Ma Messagerie" />
                                    )}
                                    {userRole === 'ab_consultant' && (
                                        <NavItem view={View.CRM} icon={FileText} label="CRM / Suivi" />
                                    )}
                                    {userRole === 'ab_consultant' && (
                                        <NavItem view={View.Settings} icon={Settings} label="Configuration" />
                                    )}
                                </div>

                                {/* Aperçu Mode Client — inside dossier context */}
                                {userRole === 'ab_consultant' && (
                                    <button
                                        onClick={onToggleSimulation}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-brand-400 hover:bg-brand-700/50 hover:text-white transition-all duration-200 mt-2 text-xs"
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span className="font-medium">Aperçu mode client</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Quitter l'aperçu — visible in simulation mode */}
                {userRole === 'client' && isSuperAdmin && (
                    <div className="mb-4">
                        <button
                            onClick={onToggleSimulation}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-accent-400 hover:bg-brand-800 hover:text-accent-300 transition-all duration-200 font-bold bg-brand-950/30"
                        >
                            <EyeOff className="w-5 h-5" />
                            <span className="font-medium text-sm">Quitter l'aperçu</span>
                        </button>
                    </div>
                )}
            </nav>

            {/* ══════════════════════════════════════════
                SECTION 3: MON COMPTE (pinned bottom)
               ══════════════════════════════════════════ */}
            <div className="px-4 pt-3 pb-2 border-t border-brand-800/50 shrink-0">
                <h3 className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2 px-2">Mon Compte</h3>

                <NavItem view={View.Profile} icon={User} label="Mon Profil" />
                <NavItem view={View.Help} icon={HelpCircle} label="Aide & Guide" />

                {/* Dark mode — compact inline toggle */}
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-brand-300 hover:bg-brand-800 hover:text-white transition-all duration-200 group"
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-brand-400 group-hover:text-accent-500" />}
                    <span className="font-medium text-sm">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
                    {/* Toggle switch visual */}
                    <div className={`ml-auto w-8 h-4.5 rounded-full flex items-center px-0.5 transition-colors ${theme === 'dark' ? 'bg-accent-500' : 'bg-brand-700'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-3.5' : 'translate-x-0'}`}></div>
                    </div>
                </button>

                {/* Déconnexion */}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400/70 hover:bg-red-900/20 hover:text-red-300 transition-all duration-200 mt-1"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium text-sm">Déconnexion</span>
                </button>
            </div>

            {/* FOOTER VERSION */}
            <div className="p-3 text-center border-t border-brand-800/30 shrink-0">
                <p className="text-[10px] text-brand-500 font-mono opacity-60">v{APP_VERSION}</p>
            </div>
        </aside>
    );
};

export default Sidebar;
