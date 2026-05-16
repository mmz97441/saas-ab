
import React, { useState, useMemo } from 'react';
import { LayoutDashboard, PenLine, Settings, ClipboardList, Users, Briefcase, Eye, EyeOff, LogOut, ChevronRight, ShieldCheck, UserCircle, ChevronDown, ChevronUp, MessageSquare, PieChart, Search, HelpCircle, X, BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { View, Client, APP_VERSION } from '../types';

interface SidebarProps {
    isOpen: boolean;
    isCollapsed: boolean;
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
    onToggleCollapse: () => void;
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
            <label className="text-xs font-bold text-brand-300 uppercase mb-1 block">Sélectionner un dossier</label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-brand-800 text-white text-sm font-bold px-3 py-2.5 rounded-lg border border-brand-600 hover:bg-brand-700 transition-colors"
            >
                <span className="truncate">{current?.companyName || 'Sélectionner'}</span>
                <ChevronDown className={`w-4 h-4 text-brand-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-brand-800 border border-brand-600 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
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

// ─── PANNEAU D'AIDE AVEC GLOSSAIRE ───
const HelpPanel: React.FC<{ userRole: 'ab_consultant' | 'client' }> = ({ userRole }) => {
    const [isOpen, setIsOpen] = useState(false);

    const glossaryConsultant = [
        { term: 'CA Portefeuille', def: "Chiffre d'affaires HT cumulé de tous vos clients depuis le 1er janvier de l'année en cours (Year-to-Date)." },
        { term: 'Marge Moyenne', def: "Taux de marge commerciale brute pondéré par le CA. Calcul : (Ventes - Achats consommés) / CA total." },
        { term: 'Trésorerie Globale', def: "Somme des soldes bancaires (créditeurs - débiteurs) de chaque client, basée sur la dernière situation connue." },
        { term: 'Objectifs Atteints', def: "Nombre de clients dont le CA YTD dépasse 100% de l'objectif défini. Seuls les clients avec objectif paramétré sont comptés." },
        { term: 'Données à Jour', def: "Pourcentage de dossiers ayant soumis des données réelles (CA > 0) pour le mois précédent (M-1) ou le mois en cours. Cliquez sur la carte pour filtrer les retardataires." },
        { term: 'Santé Portefeuille', def: "Score composite : un dossier est 'sain' s'il a une trésorerie positive, des données récentes ET un objectif ≥ 85%." },
        { term: '% Objectif', def: "Ratio CA réalisé / CA objectif sur la même période. Vert ≥ 100%, Orange ≥ 85%, Rouge < 85%." },
        { term: 'CA YTD', def: "Chiffre d'affaires HT cumulé d'un client sur l'exercice en cours." },
        { term: 'Statut Rapport', def: "'À Valider' = soumis par le client, en attente. 'OK' = validé par le cabinet. 'En attente' = pas encore soumis." },
    ];

    const glossaryClient = [
        { term: "Chiffre d'Affaires", def: "CA Hors Taxe facturé sur la période sélectionnée." },
        { term: 'Marge Commerciale', def: "Marge brute = Ventes - Achats consommés. Le taux est exprimé en % du CA." },
        { term: 'BFR', def: "Besoin en Fonds de Roulement : (Créances Clients + Stocks) - Dettes Fournisseurs/Fiscales/Sociales." },
        { term: 'Trésorerie', def: "Soldes bancaires créditeurs (actif) - Soldes débiteurs et découverts (passif)." },
        { term: 'Objectif CA', def: "Objectif de chiffre d'affaires fixé par votre consultant pour la période." },
    ];

    const glossary = userRole === 'ab_consultant' ? glossaryConsultant : glossaryClient;

    return (
        <div className="mt-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-brand-300 hover:bg-brand-800 hover:text-white transition-all duration-200"
            >
                <HelpCircle className="w-5 h-5" />
                <span className="font-medium text-sm">Aide & Glossaire</span>
                {isOpen ? <ChevronUp className="w-4 h-4 ml-auto text-brand-400" /> : <ChevronDown className="w-4 h-4 ml-auto text-brand-400" />}
            </button>

            {isOpen && (
                <div className="mt-2 mx-1 bg-brand-800/60 rounded-xl border border-brand-700/50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    {/* GLOSSAIRE */}
                    <div className="p-3 border-b border-brand-700/40">
                        <p className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                            <BookOpen className="w-3 h-3" /> Glossaire des indicateurs
                        </p>
                        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                            {glossary.map((item) => (
                                <div key={item.term}>
                                    <p className="text-xs font-bold text-accent-400">{item.term}</p>
                                    <p className="text-xs text-brand-300 leading-relaxed">{item.def}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CONTACT */}
                    <div className="p-3">
                        <p className="text-xs font-bold text-brand-300 uppercase tracking-wider mb-2">Contact</p>
                        <p className="text-xs text-brand-300 leading-relaxed">
                            Un doute ou une question ? Contactez-nous :
                        </p>
                        <button
                            onClick={() => window.open(`mailto:contact@ab-consultants.fr?subject=Aide - ${userRole === 'client' ? 'Client' : 'Consultant'}`, '_blank')}
                            className="mt-2 w-full text-center text-xs font-bold bg-brand-700 hover:bg-brand-600 text-white py-1.5 rounded-lg transition-colors"
                        >
                            contact@ab-consultants.fr
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    isCollapsed,
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
    onToggleCollapse,
    onLogout
}) => {

    // Calcul des notifications
    const unreadCount = clients.filter(c => c.hasUnreadMessages).length;

    const NavItem = ({ view, icon: Icon, label, badge, tooltip }: { view: View, icon: any, label: string, badge?: number, tooltip?: string }) => (
        <button
            onClick={() => onNavigate(view)}
            title={tooltip || label}
            aria-label={isCollapsed ? label : undefined}
            aria-current={currentView === view ? 'page' : undefined}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all duration-200 group ${currentView === view
                ? (userRole === 'ab_consultant' ? 'bg-brand-700 text-white shadow-md ring-1 ring-white/10' : 'bg-brand-600 text-white shadow-md')
                : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                }`}
        >
            <div className="relative flex-shrink-0">
                <Icon className={`w-5 h-5 ${currentView === view ? 'text-accent-500' : 'text-brand-400 group-hover:text-accent-500'}`} />
                {badge && badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full border border-brand-900 animate-pulse">
                        {badge}
                    </span>
                )}
            </div>
            {!isCollapsed && <span className="font-medium text-sm">{label}</span>}
            {!isCollapsed && currentView === view && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
        </button>
    );

    return (
        <aside className={`
            fixed lg:static inset-y-0 left-0 z-40 bg-brand-900 text-white transform transition-all duration-300 ease-in-out flex flex-col shadow-2xl
            ${isCollapsed ? 'lg:w-[68px] w-72' : 'w-72'}
            ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
            {/* Header Branding */}
            <div className={`${isCollapsed ? 'p-3' : 'p-6'} relative overflow-hidden`}>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} relative z-10`}>
                    {userRole === 'ab_consultant' ? (
                        isCollapsed
                            ? <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-brand-700 to-brand-950 border border-brand-700 shadow-lg">
                                <span className="font-extrabold text-white text-sm">AB</span>
                              </div>
                            : <img src="/logo.svg" alt="AB Consultants" className="h-9 w-auto" />
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-brand-700 to-brand-950 border border-brand-700 flex-shrink-0">
                                <span className="font-extrabold text-white text-xl">{selectedClient ? selectedClient.companyName.substring(0, 2).toUpperCase() : 'C'}</span>
                            </div>
                            {!isCollapsed && (
                                <div>
                                    <h1 className="text-lg font-bold tracking-tight leading-none mb-1 text-white">
                                        {selectedClient ? selectedClient.companyName : 'Espace Client'}
                                    </h1>
                                    <p className="text-xs text-brand-300 uppercase tracking-widest font-semibold flex items-center gap-1">
                                        Espace Client
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} pb-4 space-y-6 overflow-y-auto custom-scrollbar`}>

                {/* SECTION 1: ADMIN - Visible only to Consultant */}
                {userRole === 'ab_consultant' && (
                    <div className="animate-in slide-in-from-left-2">
                        {!isCollapsed && <h3 className="text-xs font-bold text-brand-200 uppercase tracking-wider mb-3 px-2">Pilotage Cabinet</h3>}

                        {/* BOUTON VUE D'ENSEMBLE (Nouveau) */}
                         <button
                            onClick={() => { onClientSelect(null); onNavigate(View.Dashboard); }}
                            title="Synthèse globale du portefeuille"
                            aria-label={isCollapsed ? "Vue d'ensemble" : undefined}
                            aria-current={!selectedClient && currentView === View.Dashboard ? 'page' : undefined}
                            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg transition-all duration-200 group mb-2 ${!selectedClient && currentView === View.Dashboard
                                ? 'bg-brand-700 text-white shadow-md ring-1 ring-white/10'
                                : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                            }`}
                        >
                            <PieChart className={`w-5 h-5 flex-shrink-0 ${!selectedClient && currentView === View.Dashboard ? 'text-accent-500' : 'text-brand-400'}`} />
                            {!isCollapsed && <span className="font-medium text-sm">Vue d'ensemble</span>}
                        </button>

                        <NavItem view={View.Clients} icon={Users} label="Portefeuille Clients" tooltip="Gérer tous les dossiers clients" />
                        <NavItem view={View.Messages} icon={MessageSquare} label="Messagerie" badge={unreadCount} tooltip="Messagerie interne avec les clients" />
                        {isSuperAdmin && (
                            <div className="mt-1">
                                <NavItem view={View.Team} icon={Briefcase} label="Mon Équipe" tooltip="Gestion des collaborateurs du cabinet" />
                            </div>
                        )}
                    </div>
                )}

                {/* SECTION 2: CLIENT CONTEXT */}
                {(selectedClient || userRole === 'client') && (
                    <div className="animate-in slide-in-from-left-2 duration-300">
                        {userRole === 'ab_consultant' && !isCollapsed && (
                            <div className="mb-3 mt-2 mx-1 px-3 py-2 bg-accent-500/10 rounded-lg border border-accent-500/20">
                                <h3 className="text-xs font-bold text-accent-400 uppercase tracking-wider">Dossier actif</h3>
                            </div>
                        )}
                        {isCollapsed && selectedClient && (
                            <div className="flex justify-center my-2">
                                <div className="w-8 h-8 rounded-full bg-white text-brand-900 flex items-center justify-center font-bold text-xs shadow-sm" title={selectedClient.companyName}>
                                    {selectedClient.companyName.substring(0, 2).toUpperCase()}
                                </div>
                            </div>
                        )}

                        {/* Client Card / Multi-Company Selector */}
                        {selectedClient && (
                            <div className={`${isCollapsed ? '' : 'rounded-xl p-4 border border-brand-700/30 mb-3 shadow-inner'} ${!isCollapsed && userRole === 'ab_consultant' ? 'bg-brand-800/20' : !isCollapsed ? 'bg-transparent border-0 p-0' : ''}`}>

                                {/* Consultant View: Static Info */}
                                {userRole === 'ab_consultant' && !isCollapsed && (
                                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-brand-700/30">
                                        <div className="w-10 h-10 rounded-full bg-white text-brand-900 flex items-center justify-center font-bold text-lg shadow-sm">
                                            {selectedClient.companyName.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h4 className="text-sm font-bold text-white truncate">{selectedClient.companyName}</h4>
                                            <p className="text-xs text-brand-300 truncate">{selectedClient.managerName}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Client View: Multi-Company Selector */}
                                {userRole === 'client' && !isCollapsed && accessibleCompanies.length > 1 && (
                                    <ClientCompanySelector
                                        companies={accessibleCompanies}
                                        selectedId={selectedClient.id}
                                        onSelect={(c) => onClientSelect(c)}
                                    />
                                )}

                                {/* Navigation Links */}
                                <div className="space-y-1">
                                    <NavItem view={View.Dashboard} icon={LayoutDashboard} label="Tableau de Bord" tooltip="Indicateurs clés et graphiques du dossier" />
                                    <NavItem view={View.Entry} icon={PenLine} label="Saisie Mensuelle" tooltip="Saisir ou modifier les données du mois" />
                                    <NavItem view={View.History} icon={ClipboardList} label="Historique & Export" tooltip="Consulter l'historique et exporter les données" />
                                    {userRole === 'ab_consultant' && (
                                        <NavItem view={View.Settings} icon={Settings} label="Paramétrage Dossier" tooltip="Configurer les paramètres administratifs et analytiques" />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* SECTION 3: SYSTEM */}
                <div className="mt-4 pt-4 border-t border-brand-800/50 animate-in slide-in-from-left-2">
                    {userRole === 'ab_consultant' && (
                        <button
                            onClick={onToggleSimulation}
                            title="Voir l'interface telle que le client la voit"
                            aria-label={isCollapsed ? 'Aperçu Mode Client' : undefined}
                            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-brand-300 hover:bg-brand-800 hover:text-white transition-all duration-200 mt-2`}
                        >
                            <Eye className="w-5 h-5 flex-shrink-0" />
                            {!isCollapsed && <span className="font-medium text-sm">Aperçu Mode Client</span>}
                        </button>
                    )}

                    {userRole === 'client' && isSuperAdmin && (
                        <button
                            onClick={onToggleSimulation}
                            title="Revenir à l'interface consultant"
                            aria-label={isCollapsed ? "Quitter l'aperçu" : undefined}
                            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-accent-400 hover:bg-brand-800 hover:text-accent-300 transition-all duration-200 mt-2 font-bold bg-brand-950/30`}
                        >
                            <EyeOff className="w-5 h-5 flex-shrink-0" />
                            {!isCollapsed && <span className="font-medium text-sm">Quitter l'aperçu</span>}
                        </button>
                    )}

                    {/* HELP PANEL (all users) */}
                    {!isCollapsed && <HelpPanel userRole={userRole} />}

                    <button
                        onClick={onLogout}
                        title="Se déconnecter de l'application"
                        aria-label={isCollapsed ? 'Déconnexion' : undefined}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-red-300 hover:bg-red-900/30 hover:text-red-200 transition-all duration-200 mt-4`}
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium text-sm">Déconnexion</span>}
                    </button>
                </div>

            </nav>

            {/* COLLAPSE TOGGLE (desktop only) + VERSION */}
            <div className={`${isCollapsed ? 'p-2' : 'p-4'} text-center border-t border-brand-800/30`}>
                <button
                    onClick={onToggleCollapse}
                    title={isCollapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
                    className="hidden lg:flex w-full items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-brand-400 hover:bg-brand-800 hover:text-white transition-all duration-200 mb-2"
                >
                    {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                    {!isCollapsed && <span className="text-xs font-medium">Réduire</span>}
                </button>
                {!isCollapsed && <p className="text-xs text-brand-300 font-mono">v{APP_VERSION}</p>}
            </div>
        </aside>
    );
};

export default Sidebar;
