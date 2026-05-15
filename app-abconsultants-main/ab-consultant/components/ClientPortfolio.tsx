
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Client, FinancialRecord, ProfitCenter } from '../types';
import { getRecordsByClient } from '../services/dataService';
import {
    Users, Plus, Edit2, Search, Briefcase, Archive, X, Loader2,
    ArrowUpDown, ArrowUp, ArrowDown, TrendingDown, CheckCircle,
    Clock, CalendarClock, MoreVertical, Send, Copy, Power,
    PanelRightOpen, Activity, Settings, Mail, LogIn, CheckCheck
} from 'lucide-react';
import ActivityTimeline from './ActivityTimeline';
import QuickConfigPanel from './QuickConfigPanel';
import InfoTip, { getPerfColor } from './ui/InfoTip';
import { callSendClientInvitation } from '../lib/cloudFunctions';

interface ClientPortfolioProps {
    clients: Client[];
    clientViewMode: 'active' | 'inactive';
    clientSearchQuery: string;
    onSetClientViewMode: (mode: 'active' | 'inactive') => void;
    onSetClientSearchQuery: (q: string) => void;
    onSelectClient: (client: Client) => void;
    onEditClient: (client: Client) => void;
    onNewClient: () => void;
    onToggleStatus: (client: Client) => void;
    onSaveClient?: (client: Client) => Promise<void>;
    onUpdateProfitCenters?: (client: Client, pcs: ProfitCenter[]) => void;
    onToggleFuelModule?: (client: Client) => void;
    onToggleCommercialMargin?: (client: Client) => void;
    onUpdateClientStatus?: (client: Client, status: 'active' | 'inactive') => void;
}

interface ClientWithKpis {
    client: Client;
    ytdRevenue: number;
    ytdObjective: number;
    objPerformance: number;
    lastTreasury: number | null;
    treasuryAlert: boolean;
    dataFresh: boolean;
    pendingValidation: boolean;
    lastRecordValidated: boolean;
    lastActivity: string;
}

type SortKey = 'name' | 'revenue' | 'objective' | 'treasury' | 'sector';
type SortDir = 'asc' | 'desc';
type PanelTab = 'timeline' | 'config';

const fmtEur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

// --- CONNECTION STATUS HELPERS ---
type ConnectionStatus = 'active' | 'inactive' | 'never' | 'not_invited';

const getConnectionStatus = (client: Client): ConnectionStatus => {
    const lastLogin = client.owner?.lastLoginAt;
    if (!lastLogin) {
        // Check if invitation was sent
        if (client.invitationStatus?.lastSentAt) return 'never';
        return 'not_invited';
    }
    const daysSince = Math.floor((Date.now() - new Date(lastLogin).getTime()) / 86400000);
    return daysSince <= 7 ? 'active' : 'inactive';
};

const CONNECTION_STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
    active:      { label: 'Actif',            color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500' },
    inactive:    { label: 'Inactif',          color: 'text-amber-700',   bgColor: 'bg-amber-50 border-amber-200',   dotColor: 'bg-amber-500' },
    never:       { label: 'Jamais connecté',  color: 'text-red-700',     bgColor: 'bg-red-50 border-red-200',       dotColor: 'bg-red-500' },
    not_invited: { label: 'Non invité',       color: 'text-slate-500',   bgColor: 'bg-slate-50 border-slate-200',   dotColor: 'bg-slate-400' },
};

const formatRelativeDate = (isoDate?: string): string => {
    if (!isoDate) return '';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 30) return `Il y a ${diffD}j`;
    if (diffD < 365) return `Il y a ${Math.floor(diffD / 30)} mois`;
    return `Il y a ${Math.floor(diffD / 365)} an(s)`;
};

const ClientPortfolio: React.FC<ClientPortfolioProps> = ({
    clients, clientViewMode, clientSearchQuery,
    onSetClientViewMode, onSetClientSearchQuery,
    onSelectClient, onEditClient, onNewClient, onToggleStatus,
    onSaveClient, onUpdateProfitCenters, onToggleFuelModule,
    onToggleCommercialMargin, onUpdateClientStatus
}) => {
    const [clientKpis, setClientKpis] = useState<ClientWithKpis[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
    const [sendingInvite, setSendingInvite] = useState<string | null>(null);
    const [inviteFeedback, setInviteFeedback] = useState<{ id: string; success: boolean } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Side panel state
    const [panelClient, setPanelClient] = useState<Client | null>(null);
    const [panelTab, setPanelTab] = useState<PanelTab>('timeline');
    const panelRef = useRef<HTMLDivElement>(null);

    // Fermer le menu quand on clique ailleurs
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

    // Keep panel client in sync with clients array updates (e.g. after config save)
    useEffect(() => {
        if (panelClient) {
            const updated = clients.find(c => c.id === panelClient.id);
            if (updated) setPanelClient(updated);
        }
    }, [clients]);

    const handleOpenPanel = (client: Client, tab: PanelTab = 'timeline') => {
        if (panelClient?.id === client.id && panelTab === tab) {
            setPanelClient(null);
        } else {
            setPanelClient(client);
            setPanelTab(tab);
        }
    };

    // --- Logique d'invitation ---
    const getInviteMessage = (client: Client) => {
        const url = window.location.origin;
        const manager = client.managerName ? ` ${client.managerName}` : '';
        return `Cher Partenaire${manager},

Dans le cadre de notre mandat d'accompagnement, nous avons le plaisir de vous confirmer l'ouverture de votre accès sécurisé à la Suite de Pilotage Financier AB Consultants.

Ce portail exclusif vous permet désormais de :
• Suivre vos indicateurs stratégiques en temps réel.
• Transmettre vos données mensuelles via un canal chiffré.
• Échanger confidentiellement avec votre consultant référent.

PROCÉDURE D'ACTIVATION SÉCURISÉE :

1. Accédez au portail : ${url}
2. Sélectionnez le portail "Espace Client".
3. Cliquez sur le lien "Première connexion ? Créer mon accès".
4. Saisissez votre identifiant unique : ${client.owner?.email}
5. Définissez votre mot de passe personnel.

Note de sécurité : Cet identifiant est strictement personnel.

Votre consultant référent reste à votre entière disposition pour vous accompagner dans la prise en main de cet outil décisionnel.

Respectueusement,

LA DIRECTION
AB CONSULTANTS
Expertise & Stratégie Financière`;
    };

    const handleSendEmail = (client: Client) => {
        const subject = `CONFIDENTIEL | Activation de votre Portail Stratégique - ${client.companyName}`;
        const body = getInviteMessage(client);
        window.location.href = `mailto:${client.owner?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setOpenMenuId(null);
    };

    const handleCopyInvite = async (client: Client) => {
        try {
            await navigator.clipboard.writeText(getInviteMessage(client));
            setCopyFeedback(client.id);
            setTimeout(() => setCopyFeedback(null), 2000);
            // Mark as manually sent
            callSendClientInvitation({ clientId: client.id, method: 'manual', appUrl: window.location.origin }).catch(() => {});
        } catch { /* ignore */ }
        setOpenMenuId(null);
    };

    const handleSendInvitationEmail = async (client: Client) => {
        setSendingInvite(client.id);
        setOpenMenuId(null);
        try {
            await callSendClientInvitation({ clientId: client.id, method: 'email', appUrl: window.location.origin });
            setInviteFeedback({ id: client.id, success: true });
        } catch {
            setInviteFeedback({ id: client.id, success: false });
        } finally {
            setSendingInvite(null);
            setTimeout(() => setInviteFeedback(null), 3000);
        }
    };

    const currentYear = new Date().getFullYear();
    const monthValues = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

    // Charger les KPIs pour les clients affichés
    useEffect(() => {
        let cancelled = false;

        const loadKpis = async () => {
            setIsLoading(true);
            try {
                const statusFiltered = clients.filter(c =>
                    clientViewMode === 'active' ? (c.status || 'active') === 'active' : c.status === 'inactive'
                );

                const allRecords = await Promise.all(
                    statusFiltered.map(c => getRecordsByClient(c.id))
                );

                if (cancelled) return;

                const results: ClientWithKpis[] = statusFiltered.map((client, i) => {
                    const records = allRecords[i] || [];
                    const lastRecord = records.length > 0 ? records[records.length - 1] : null;

                    const yearRecords = records.filter(r => r.year === currentYear && r.revenue.total > 0);
                    const ytdRevenue = yearRecords.reduce((acc, r) => acc + r.revenue.total, 0);
                    const ytdObjective = yearRecords.reduce((acc, r) => acc + r.revenue.objective, 0);
                    const objPerformance = ytdObjective > 0 ? (ytdRevenue / ytdObjective) * 100 : 0;

                    const lastTreasury = lastRecord ? lastRecord.cashFlow.treasury : null;
                    const treasuryAlert = lastTreasury !== null && lastTreasury < 0;

                    let dataFresh = false;
                    if (lastRecord) {
                        const lastMonthIdx = monthValues.indexOf(lastRecord.month as string);
                        const nowMonthIdx = new Date().getMonth(); // 0-indexed: 0=Jan, 1=Feb, ...
                        // Expected month = M-1 (previous month). A client is "À jour" if they have
                        // a submitted record with real data for M-1 or the current month.
                        const expectedMonthIdx = nowMonthIdx - 1; // -1 in January, handled below
                        const expectedYear = expectedMonthIdx < 0 ? currentYear - 1 : currentYear;
                        const normalizedExpectedMonth = expectedMonthIdx < 0 ? 11 : expectedMonthIdx;

                        // Check if a submitted record with revenue exists for M-1 or current month
                        const hasExpectedData = records.some(r => {
                            if (!r.isSubmitted && r.revenue.total === 0) return false; // Ignore empty drafts
                            const rMonthIdx = monthValues.indexOf(r.month as string);
                            // Match M-1
                            if (r.year === expectedYear && rMonthIdx === normalizedExpectedMonth) return true;
                            // Match current month
                            if (r.year === currentYear && rMonthIdx === nowMonthIdx) return true;
                            return false;
                        });
                        dataFresh = hasExpectedData;
                    }

                    const pendingValidation = !!records.find(r => r.isSubmitted && !r.isValidated);
                    const lastRecordValidated = lastRecord?.isValidated ?? false;
                    const lastActivity = lastRecord ? `${lastRecord.month} ${lastRecord.year}` : 'Aucune';

                    return { client, ytdRevenue, ytdObjective, objPerformance, lastTreasury, treasuryAlert, dataFresh, pendingValidation, lastRecordValidated, lastActivity };
                });

                setClientKpis(results);
            } catch (error) {
                console.error('Erreur chargement KPIs portefeuille:', error);
                // Fallback: show clients without KPI data rather than crashing
                if (!cancelled) {
                    setClientKpis(clients
                        .filter(c => clientViewMode === 'active' ? (c.status || 'active') === 'active' : c.status === 'inactive')
                        .map(client => ({ client, ytdRevenue: 0, ytdObjective: 0, objPerformance: 0, lastTreasury: null, treasuryAlert: false, dataFresh: false, pendingValidation: false, lastRecordValidated: false, lastActivity: 'Aucune' }))
                    );
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        if (clients.length > 0) loadKpis();
        else { setClientKpis([]); setIsLoading(false); }

        return () => { cancelled = true; };
    }, [clients, clientViewMode, currentYear]);

    // Filtrage par recherche
    const filtered = useMemo(() => {
        if (!clientSearchQuery.trim()) return clientKpis;
        const q = clientSearchQuery.toLowerCase();
        return clientKpis.filter(ck =>
            ck.client.companyName.toLowerCase().includes(q) ||
            (ck.client.managerName || '').toLowerCase().includes(q) ||
            (ck.client.city || '').toLowerCase().includes(q) ||
            (ck.client.siret || '').toLowerCase().includes(q) ||
            (ck.client.sector || '').toLowerCase().includes(q)
        );
    }, [clientKpis, clientSearchQuery]);

    // Tri
    const sorted = useMemo(() => {
        const arr = [...filtered];
        const dir = sortDir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            switch (sortKey) {
                case 'name': return dir * a.client.companyName.localeCompare(b.client.companyName, 'fr');
                case 'revenue': return dir * (a.ytdRevenue - b.ytdRevenue);
                case 'objective': return dir * (a.objPerformance - b.objPerformance);
                case 'treasury': return dir * ((a.lastTreasury ?? -Infinity) - (b.lastTreasury ?? -Infinity));
                case 'sector': return dir * (a.client.sector || '').localeCompare(b.client.sector || '', 'fr');
                default: return 0;
            }
        });
        return arr;
    }, [filtered, sortKey, sortDir]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir(key === 'name' || key === 'sector' ? 'asc' : 'desc'); }
    };

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-0.5" />;
        return sortDir === 'asc'
            ? <ArrowUp className="w-3 h-3 text-brand-500 ml-0.5" />
            : <ArrowDown className="w-3 h-3 text-brand-500 ml-0.5" />;
    };

    return (
        <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main content area */}
            <div className={`space-y-6 transition-all duration-300 ${panelClient ? 'flex-1 min-w-0' : 'w-full'}`}>

                {/* Header + Onglets */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-6 h-6 text-brand-500" /> Portefeuille Clients
                            <span className="text-sm font-normal text-slate-400">({filtered.length} dossier{filtered.length !== 1 ? 's' : ''})</span>
                        </h2>
                        <button onClick={onNewClient} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-bold shadow-sm transition">
                            <Plus className="w-4 h-4" /> Nouveau Dossier
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={clientSearchQuery}
                            onChange={(e) => onSetClientSearchQuery(e.target.value)}
                            placeholder="Rechercher par nom, dirigeant, ville, SIRET, secteur..."
                            className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition placeholder-slate-400"
                        />
                        {clientSearchQuery && (
                            <button onClick={() => onSetClientSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                        <button
                            onClick={() => onSetClientViewMode('active')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${clientViewMode === 'active' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Briefcase className="w-4 h-4" /> Dossiers Actifs
                        </button>
                        <button
                            onClick={() => onSetClientViewMode('inactive')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${clientViewMode === 'inactive' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Archive className="w-4 h-4" /> Archives / Veille
                        </button>
                    </div>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-brand-500 bg-white rounded-xl border border-slate-200">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            <span className="text-sm font-medium">Chargement...</span>
                        </div>
                    ) : sorted.length > 0 ? (
                        sorted.map(({ client, ytdRevenue, objPerformance, ytdObjective, lastTreasury, treasuryAlert, dataFresh, pendingValidation, lastRecordValidated, lastActivity }) => {
                            const perfCol = ytdObjective > 0 ? getPerfColor(objPerformance) : null;
                            return (
                                <div key={client.id} onClick={() => onSelectClient(client)} className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 active:bg-slate-50 transition cursor-pointer ${client.status === 'inactive' ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border text-sm shrink-0 ${client.status === 'inactive' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
                                                    {client.companyName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${CONNECTION_STATUS_CONFIG[getConnectionStatus(client)].dotColor}`} title={CONNECTION_STATUS_CONFIG[getConnectionStatus(client)].label} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-800 text-sm truncate">{client.companyName}</div>
                                                <div className="text-xs text-slate-400 truncate">{client.managerName}{client.city ? ` — ${client.city}` : ''}</div>
                                            </div>
                                        </div>
                                        {pendingValidation ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 shrink-0">
                                                <Clock className="w-3 h-3" /> A Valider
                                            </span>
                                        ) : lastRecordValidated ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 shrink-0">
                                                <CheckCircle className="w-3 h-3" /> OK
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold">CA YTD</p>
                                            <p className="font-mono font-bold text-slate-700 text-xs">{ytdRevenue > 0 ? fmtEur(ytdRevenue) : '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold">Objectif</p>
                                            {perfCol ? (
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${perfCol.bg} ${perfCol.text}`}>{objPerformance.toFixed(0)}%</span>
                                            ) : (
                                                <span className="text-slate-300 text-xs">N/A</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold">Tréso.</p>
                                            {lastTreasury !== null ? (
                                                <p className={`font-mono font-bold text-xs ${treasuryAlert ? 'text-red-600' : 'text-emerald-600'}`}>{fmtEur(lastTreasury)}</p>
                                            ) : (
                                                <span className="text-slate-300 text-xs">—</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                            <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                                <Archive className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="font-semibold text-slate-700 mb-1">Aucun dossier dans cette catégorie</p>
                            <p className="text-sm text-slate-500">Essayez une autre catégorie en haut de la liste.</p>
                        </div>
                    )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-brand-500">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            <span className="text-sm font-medium">Chargement des indicateurs...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-xs font-bold text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                        <th className="p-3 pl-4">
                                            <button onClick={() => handleSort('name')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition">
                                                Dossier Client <SortIcon col="name" />
                                            </button>
                                        </th>
                                        <th className="p-3 text-center">
                                            <button onClick={() => handleSort('sector')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition">
                                                Secteur <SortIcon col="sector" />
                                            </button>
                                        </th>
                                        <th className="p-3 text-right">
                                            <button onClick={() => handleSort('revenue')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition ml-auto">
                                                CA YTD <SortIcon col="revenue" />
                                            </button>
                                            <InfoTip text="Chiffre d'affaires HT cumulé depuis le 1er janvier de l'exercice en cours." />
                                        </th>
                                        <th className="p-3 text-center">
                                            <button onClick={() => handleSort('objective')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition">
                                                % Objectif <SortIcon col="objective" />
                                            </button>
                                            <InfoTip text="Ratio CA réalisé / Objectif CA. Vert ≥ 100%, Orange ≥ 85%, Rouge < 85%." />
                                        </th>
                                        <th className="p-3 text-right">
                                            <button onClick={() => handleSort('treasury')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition ml-auto">
                                                Trésorerie <SortIcon col="treasury" />
                                            </button>
                                            <InfoTip text="Dernier solde bancaire connu. Rouge si négatif." />
                                        </th>
                                        <th className="p-3 text-center">Données <InfoTip text={"• À jour (vert) : données reçues pour M-1 ou le mois en cours.\n• Retard (orange) : aucune donnée pour M-1 ni le mois en cours.\n• Aucune (gris) : aucune donnée importée."} /></th>
                                        <th className="p-3 text-center">Statut <InfoTip text={"• À Valider (orange) : rapport soumis, en attente de validation par le cabinet.\n• OK (vert) : dernier rapport validé par le cabinet.\n• En attente (gris) : rapport non encore soumis.\n• Archivé : dossier en veille."} /></th>
                                        <th className="p-3 text-center">Connexion <InfoTip text={"• Actif (vert) : connecté dans les 7 derniers jours.\n• Inactif (orange) : dernière connexion > 7 jours.\n• Jamais connecté (rouge) : invité mais jamais connecté.\n• Non invité (gris) : invitation non envoyée."} /></th>
                                        <th className="p-3 text-right pr-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {sorted.map(({ client, ytdRevenue, ytdObjective, objPerformance, lastTreasury, treasuryAlert, dataFresh, pendingValidation, lastRecordValidated, lastActivity }) => {
                                        const perfCol = ytdObjective > 0 ? getPerfColor(objPerformance) : null;
                                        const isSelectedInPanel = panelClient?.id === client.id;
                                        return (
                                            <tr key={client.id} onClick={() => onSelectClient(client)} className={`hover:bg-brand-50/30 transition-colors cursor-pointer group ${client.status === 'inactive' ? 'opacity-60' : ''} ${isSelectedInPanel ? 'bg-brand-50/50 border-l-2 border-l-brand-500' : ''}`}>
                                                {/* CLIENT */}
                                                <td className="p-3 pl-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border text-sm ${client.status === 'inactive' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
                                                            {client.companyName.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 text-xs truncate max-w-[180px]">{client.companyName}</div>
                                                            <div className="text-xs text-slate-400 truncate max-w-[180px]">
                                                                {client.managerName}
                                                                {client.city ? <span className="text-slate-300"> — {client.city}</span> : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* SECTEUR */}
                                                <td className="p-3 text-center">
                                                    {client.sector ? (
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium text-slate-600">{client.sector}</span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* CA YTD */}
                                                <td className="p-3 text-right">
                                                    {ytdRevenue > 0 ? (
                                                        <span className="font-mono font-bold text-slate-700 text-xs">{fmtEur(ytdRevenue)}</span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* % OBJECTIF */}
                                                <td className="p-3 text-center">
                                                    {perfCol ? (
                                                        <div className="inline-flex flex-col items-center gap-0.5">
                                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${perfCol.bg} ${perfCol.text}`}>
                                                                {objPerformance.toFixed(0)}%
                                                            </span>
                                                            <div className="h-1 w-10 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full" style={{ width: `${Math.min(objPerformance, 100)}%`, backgroundColor: perfCol.bar }} />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">N/A</span>
                                                    )}
                                                </td>

                                                {/* TRESORERIE */}
                                                <td className="p-3 text-right">
                                                    {lastTreasury !== null ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            {treasuryAlert && <TrendingDown className="w-3 h-3 text-red-500" />}
                                                            <span className={`font-mono font-bold text-xs ${treasuryAlert ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                {fmtEur(lastTreasury)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* FRAICHEUR */}
                                                <td className="p-3 text-center">
                                                    {lastActivity === 'Aucune' ? (
                                                        <span className="text-slate-300 text-xs">Aucune</span>
                                                    ) : dataFresh ? (
                                                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                                                            <CheckCircle className="w-3 h-3" /> À jour
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
                                                            <CalendarClock className="w-3 h-3" /> Retard
                                                        </span>
                                                    )}
                                                </td>

                                                {/* STATUT */}
                                                <td className="p-3 text-center">
                                                    {client.status === 'inactive' ? (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Archivé</span>
                                                    ) : pendingValidation ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                            <Clock className="w-3 h-3" /> À Valider
                                                        </span>
                                                    ) : lastRecordValidated ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                            <CheckCircle className="w-3 h-3" /> OK
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-500 text-xs">En attente</span>
                                                    )}
                                                </td>

                                                {/* CONNEXION */}
                                                <td className="p-3 text-center">
                                                    {(() => {
                                                        const connStatus = getConnectionStatus(client);
                                                        const connConfig = CONNECTION_STATUS_CONFIG[connStatus];
                                                        return (
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${connConfig.bgColor} ${connConfig.color}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${connConfig.dotColor}`} />
                                                                    {connConfig.label}
                                                                </span>
                                                                {client.owner?.lastLoginAt && (
                                                                    <span className="text-[10px] text-slate-400">{formatRelativeDate(client.owner.lastLoginAt)}</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* ACTIONS */}
                                                <td className="p-3 text-right pr-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Quick panel button */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenPanel(client, 'timeline'); }}
                                                            className={`p-1.5 rounded-full transition ${isSelectedInPanel && panelTab === 'timeline' ? 'bg-brand-100 text-brand-600' : 'text-slate-300 hover:text-brand-500 hover:bg-brand-50'} opacity-40 group-hover:opacity-100`}
                                                            title="Timeline d'activité"
                                                        >
                                                            <Activity className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenPanel(client, 'config'); }}
                                                            className={`p-1.5 rounded-full transition ${isSelectedInPanel && panelTab === 'config' ? 'bg-brand-100 text-brand-600' : 'text-slate-300 hover:text-brand-500 hover:bg-brand-50'} opacity-40 group-hover:opacity-100`}
                                                            title="Configuration rapide"
                                                        >
                                                            <Settings className="w-3.5 h-3.5" />
                                                        </button>

                                                        <div className="relative inline-block">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === client.id ? null : client.id); }}
                                                                className="p-2 text-slate-400 hover:text-brand-600 bg-white rounded-full shadow-sm border border-slate-100 opacity-40 group-hover:opacity-100 transition"
                                                                title="Actions"
                                                            >
                                                                <MoreVertical className="w-3.5 h-3.5" />
                                                            </button>

                                                            {/* Feedback copié */}
                                                            {copyFeedback === client.id && (
                                                                <span className="absolute -top-8 right-0 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
                                                                    Copié !
                                                                </span>
                                                            )}
                                                            {/* Feedback invitation email */}
                                                            {inviteFeedback?.id === client.id && (
                                                                <span className={`absolute -top-8 right-0 text-white text-xs font-bold px-2 py-1 rounded-lg shadow whitespace-nowrap animate-in fade-in zoom-in-95 duration-200 ${inviteFeedback.success ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                                                    {inviteFeedback.success ? 'Invitation envoyée !' : 'Erreur d\'envoi'}
                                                                </span>
                                                            )}

                                                            {/* Menu dropdown */}
                                                            {openMenuId === client.id && (
                                                                <div ref={menuRef} className="absolute right-0 top-full mt-1 z-40 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1 animate-in fade-in zoom-in-95 duration-150">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onEditClient(client); }}
                                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition text-left"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                                                        Modifier le dossier
                                                                    </button>

                                                                    {client.owner?.email && (
                                                                        <>
                                                                            <div className="border-t border-slate-100 my-1" />
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleSendInvitationEmail(client); }}
                                                                                disabled={sendingInvite === client.id}
                                                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition text-left disabled:opacity-50"
                                                                            >
                                                                                {sendingInvite === client.id ? (
                                                                                    <Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin" />
                                                                                ) : (
                                                                                    <Mail className="w-3.5 h-3.5 text-brand-400" />
                                                                                )}
                                                                                Envoyer par email
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleCopyInvite(client); }}
                                                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition text-left"
                                                                            >
                                                                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                                                                Copier l'invitation
                                                                            </button>
                                                                            {client.invitationStatus?.lastSentAt && (
                                                                                <p className="px-4 py-1 text-[10px] text-slate-400">
                                                                                    Dernière invitation : {formatRelativeDate(client.invitationStatus.lastSentAt)}
                                                                                    {client.invitationStatus.sentCount > 1 && ` (${client.invitationStatus.sentCount}x)`}
                                                                                </p>
                                                                            )}
                                                                        </>
                                                                    )}

                                                                    <div className="border-t border-slate-100 my-1" />
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onToggleStatus(client); }}
                                                                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition text-left ${client.status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                                                    >
                                                                        {client.status === 'active' ? (
                                                                            <><Archive className="w-3.5 h-3.5" /> Archiver le dossier</>
                                                                        ) : (
                                                                            <><Power className="w-3.5 h-3.5" /> Réactiver le dossier</>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!isLoading && sorted.length === 0 && (
                        <div className="p-12 text-center text-slate-400">
                            <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                                <Archive className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="font-semibold text-slate-700 mb-1">Aucun dossier dans cette catégorie</p>
                            <p className="text-sm text-slate-500">Essayez une autre catégorie en haut de la liste.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* === SIDE PANEL (Timeline + Config Rapide) === */}
            {panelClient && (
                <div
                    ref={panelRef}
                    className="w-[380px] shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-right-4 duration-300 self-start sticky top-4"
                >
                    {/* Panel Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${panelClient.status === 'inactive' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
                                    {panelClient.companyName.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-slate-800 truncate">{panelClient.companyName}</h3>
                                    <p className="text-xs text-slate-400 truncate">{panelClient.managerName} {panelClient.city ? `— ${panelClient.city}` : ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPanelClient(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-1 bg-slate-200/60 p-0.5 rounded-lg">
                            <button
                                onClick={() => setPanelTab('timeline')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition ${panelTab === 'timeline' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Activity className="w-3 h-3" /> Timeline
                            </button>
                            <button
                                onClick={() => setPanelTab('config')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition ${panelTab === 'config' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Settings className="w-3 h-3" /> Config Rapide
                            </button>
                        </div>
                    </div>

                    {/* Panel Body */}
                    <div className="p-4 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
                        {panelTab === 'timeline' ? (
                            <ActivityTimeline clientId={panelClient.id} clientName={panelClient.companyName} />
                        ) : (
                            onSaveClient && onUpdateProfitCenters && onToggleFuelModule && onToggleCommercialMargin && onUpdateClientStatus ? (
                                <QuickConfigPanel
                                    client={panelClient}
                                    onSaveClient={onSaveClient}
                                    onUpdateProfitCenters={(pcs) => onUpdateProfitCenters(panelClient, pcs)}
                                    onToggleFuelModule={() => onToggleFuelModule(panelClient)}
                                    onToggleCommercialMargin={() => onToggleCommercialMargin(panelClient)}
                                    onUpdateClientStatus={onUpdateClientStatus}
                                />
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    Configuration non disponible.
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientPortfolio;
