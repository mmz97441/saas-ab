
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Client, FinancialRecord, ProfitCenter } from '../types';
import { getRecordsByClient } from '../services/dataService';
import {
    Users, Plus, Edit2, Search, Briefcase, Archive, X, Loader2,
    ArrowUpDown, ArrowUp, ArrowDown, TrendingDown, CheckCircle,
    Clock, MoreVertical, Copy, Power,
    Activity, Settings, Mail,
    Rows3, AlertTriangle, MinusCircle
} from 'lucide-react';
import ActivityTimeline from './ActivityTimeline';
import QuickConfigPanel from './QuickConfigPanel';
import InfoTip, { getPerfColor } from './ui/InfoTip';
import { callSendClientInvitation } from '../lib/cloudFunctions';
import { useConfirmDialog } from '../contexts/ConfirmContext';

const DENSE_VIEW_STORAGE_KEY = 'ab.clientPortfolio.denseView';

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

// --- DOSSIER HEALTH (composite indicator) ---
type HealthLevel = 'critical' | 'attention' | 'ok' | 'idle';

interface DossierHealthKpi {
    treasuryAlert: boolean;
    dataFresh: boolean;
    pendingValidation: boolean;
    lastRecordValidated: boolean;
    lastActivity: string;
}

interface DossierHealth {
    level: HealthLevel;
    label: string;
    icon: React.ReactNode;
    reasons: string[];
    primaryAction?: 'validate' | 'invite' | 'remind';
    // styling helpers
    pillClass: string;
    dotClass: string;
}

const HEALTH_STYLES: Record<HealthLevel, { pillClass: string; dotClass: string; tipTitle: string }> = {
    critical:  { pillClass: 'bg-red-50 text-red-700 border-red-200',         dotClass: 'bg-red-500',     tipTitle: 'Action urgente requise' },
    attention: { pillClass: 'bg-amber-50 text-amber-700 border-amber-200',   dotClass: 'bg-amber-500',   tipTitle: 'À surveiller' },
    ok:        { pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotClass: 'bg-emerald-500', tipTitle: 'Dossier sain' },
    idle:      { pillClass: 'bg-slate-50 text-slate-600 border-slate-200',   dotClass: 'bg-slate-400',   tipTitle: 'En attente' },
};

const getDossierHealth = (
    client: Client,
    kpi: DossierHealthKpi,
    connectionStatus: ConnectionStatus
): DossierHealth => {
    const reasons: string[] = [];
    const invitedAt = client.invitationStatus?.lastSentAt;
    const daysSinceInvite = invitedAt
        ? Math.floor((Date.now() - new Date(invitedAt).getTime()) / 86400000)
        : null;

    // Approximate "data > 7d old": dataFresh is false AND there is some data history
    const dataStale = !kpi.dataFresh && kpi.lastActivity !== 'Aucune';

    // ---- CRITICAL ----
    if (kpi.treasuryAlert || (kpi.pendingValidation && dataStale)) {
        if (kpi.treasuryAlert) reasons.push('Trésorerie négative');
        if (kpi.pendingValidation && dataStale) reasons.push('Validation requise sur données anciennes');
        if (!kpi.dataFresh && kpi.lastActivity !== 'Aucune') reasons.push('Données en retard');
        return {
            level: 'critical',
            label: 'À traiter',
            icon: <AlertTriangle className="w-3 h-3" />,
            reasons,
            primaryAction: kpi.pendingValidation ? 'validate' : 'remind',
            pillClass: HEALTH_STYLES.critical.pillClass,
            dotClass: HEALTH_STYLES.critical.dotClass,
        };
    }

    // ---- ATTENTION ----
    const inactiveSinceInvite = connectionStatus === 'never' && daysSinceInvite !== null && daysSinceInvite > 7;
    if (kpi.pendingValidation || (!kpi.dataFresh && kpi.lastActivity !== 'Aucune') || inactiveSinceInvite) {
        if (kpi.pendingValidation) reasons.push('Validation en attente');
        if (!kpi.dataFresh && kpi.lastActivity !== 'Aucune') reasons.push('Données en retard');
        if (inactiveSinceInvite) reasons.push(`Invité il y a ${daysSinceInvite}j, jamais connecté`);
        return {
            level: 'attention',
            label: 'En attente',
            icon: <Clock className="w-3 h-3" />,
            reasons,
            primaryAction: kpi.pendingValidation ? 'validate' : (inactiveSinceInvite ? 'remind' : 'remind'),
            pillClass: HEALTH_STYLES.attention.pillClass,
            dotClass: HEALTH_STYLES.attention.dotClass,
        };
    }

    // ---- IDLE ----
    // Not yet invited, or brand-new dossier with no data at all
    if (connectionStatus === 'not_invited' || (kpi.lastActivity === 'Aucune' && !kpi.dataFresh)) {
        if (connectionStatus === 'not_invited') reasons.push('Invitation non envoyée');
        if (kpi.lastActivity === 'Aucune') reasons.push('Aucune donnée importée');
        return {
            level: 'idle',
            label: connectionStatus === 'not_invited' ? 'Non invité' : 'Nouveau',
            icon: <MinusCircle className="w-3 h-3" />,
            reasons,
            primaryAction: connectionStatus === 'not_invited' ? 'invite' : undefined,
            pillClass: HEALTH_STYLES.idle.pillClass,
            dotClass: HEALTH_STYLES.idle.dotClass,
        };
    }

    // ---- OK ----
    reasons.push('Données à jour');
    if (kpi.lastRecordValidated) reasons.push('Dernier rapport validé');
    if (connectionStatus === 'active') reasons.push('Client actif (< 7j)');
    return {
        level: 'ok',
        label: 'À jour',
        icon: <CheckCircle className="w-3 h-3" />,
        reasons,
        pillClass: HEALTH_STYLES.ok.pillClass,
        dotClass: HEALTH_STYLES.ok.dotClass,
    };
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
    const confirm = useConfirmDialog();

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkActionLabel, setBulkActionLabel] = useState<string | null>(null);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    // Dense view (persisted in localStorage)
    const [denseView, setDenseView] = useState<boolean>(() => {
        try { return localStorage.getItem(DENSE_VIEW_STORAGE_KEY) === '1'; } catch { return false; }
    });
    useEffect(() => {
        try { localStorage.setItem(DENSE_VIEW_STORAGE_KEY, denseView ? '1' : '0'); } catch { /* ignore */ }
    }, [denseView]);

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

    // --- Bulk selection helpers ---
    const toggleSelected = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    // Reset selection whenever filters/search/view change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [clientSearchQuery, clientViewMode]);

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

    // --- Master checkbox state (over visible/sorted rows) ---
    const visibleIds = useMemo(() => sorted.map(s => s.client.id), [sorted]);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    const someVisibleSelected = visibleIds.some(id => selectedIds.has(id));
    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            // Clear only visible
            setSelectedIds(prev => {
                const next = new Set(prev);
                visibleIds.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                visibleIds.forEach(id => next.add(id));
                return next;
            });
        }
    };

    // --- Bulk actions ---
    const selectedClients = useMemo(
        () => sorted.filter(s => selectedIds.has(s.client.id)).map(s => s.client),
        [sorted, selectedIds]
    );

    // A dossier "needs invite" when health is idle (not yet invited) or when the
    // user was invited but never logged in (re-invite reminder). Both map to the
    // composite health states 'idle' / 'attention' surfaced in the row pill.
    const invitableSelected = useMemo(() => {
        return selectedClients.filter(c => {
            if (!c.owner?.email) return false;
            const st = getConnectionStatus(c);
            return st === 'not_invited' || st === 'never';
        });
    }, [selectedClients]);

    const handleBulkInvite = async () => {
        if (invitableSelected.length === 0) {
            await confirm({
                title: 'Aucun dossier à inviter',
                message: 'Les dossiers sélectionnés ont déjà été invités ou n\'ont pas d\'email associé.',
                variant: 'info',
                showCancel: false,
                confirmLabel: 'OK'
            });
            return;
        }
        const ok = await confirm({
            title: `Envoyer ${invitableSelected.length} invitation${invitableSelected.length > 1 ? 's' : ''} ?`,
            message: `Un email d'invitation sera envoyé aux ${invitableSelected.length} dossier${invitableSelected.length > 1 ? 's' : ''} non encore connecté${invitableSelected.length > 1 ? 's' : ''}.`,
            confirmLabel: 'Envoyer',
        });
        if (!ok) return;

        setIsBulkProcessing(true);
        let successCount = 0;
        for (let i = 0; i < invitableSelected.length; i++) {
            const c = invitableSelected[i];
            setBulkActionLabel(`${i + 1}/${invitableSelected.length} invités`);
            try {
                await callSendClientInvitation({ clientId: c.id, method: 'email', appUrl: window.location.origin });
                successCount++;
            } catch {
                // continue on failure
            }
        }
        setIsBulkProcessing(false);
        setBulkActionLabel(null);
        clearSelection();
        await confirm({
            title: 'Invitations envoyées',
            message: `${successCount} invitation${successCount > 1 ? 's' : ''} envoyée${successCount > 1 ? 's' : ''} sur ${invitableSelected.length}.`,
            variant: successCount === invitableSelected.length ? 'success' : 'info',
            showCancel: false,
            confirmLabel: 'OK',
        });
    };

    const handleBulkToggleStatus = async () => {
        if (selectedClients.length === 0) return;
        const isArchiveMode = clientViewMode === 'active';
        const verb = isArchiveMode ? 'Archiver' : 'Réactiver';
        const ok = await confirm({
            title: `${verb} ${selectedClients.length} dossier${selectedClients.length > 1 ? 's' : ''} ?`,
            message: isArchiveMode
                ? `${selectedClients.length} dossier${selectedClients.length > 1 ? 's seront déplacés' : ' sera déplacé'} vers les archives.`
                : `${selectedClients.length} dossier${selectedClients.length > 1 ? 's seront réactivés' : ' sera réactivé'}.`,
            confirmLabel: verb,
            variant: isArchiveMode ? 'danger' : 'default',
        });
        if (!ok) return;

        setIsBulkProcessing(true);
        for (let i = 0; i < selectedClients.length; i++) {
            setBulkActionLabel(`${i + 1}/${selectedClients.length} ${isArchiveMode ? 'archivés' : 'réactivés'}`);
            try {
                await onToggleStatus(selectedClients[i]);
            } catch { /* continue */ }
        }
        setIsBulkProcessing(false);
        setBulkActionLabel(null);
        clearSelection();
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

                    {/* Tabs + Dense toggle */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
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
                        <button
                            onClick={() => setDenseView(d => !d)}
                            className="hidden md:inline-flex text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 items-center gap-1.5 text-slate-600"
                            title={denseView ? 'Vue confortable' : 'Vue dense'}
                        >
                            <Rows3 className="w-3.5 h-3.5" />
                            {denseView ? 'Vue confortable' : 'Vue dense'}
                        </button>
                    </div>
                </div>

                {/* Bulk action toolbar (sticky) */}
                {selectedIds.size > 0 && (
                    <div className="sticky top-2 z-20 bg-brand-50 border border-brand-200 rounded-xl shadow-sm p-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-brand-900 text-sm">
                                {selectedIds.size} dossier{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                            </span>
                            <button
                                onClick={clearSelection}
                                disabled={isBulkProcessing}
                                className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline disabled:opacity-50"
                            >
                                Désélectionner
                            </button>
                            {bulkActionLabel && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-white px-2 py-1 rounded-md border border-brand-200">
                                    <Loader2 className="w-3 h-3 animate-spin" /> {bulkActionLabel}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {invitableSelected.length > 0 && (
                                <button
                                    onClick={handleBulkInvite}
                                    disabled={isBulkProcessing}
                                    className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-bold px-3 py-1.5 rounded-md hover:bg-brand-700 shadow-sm transition disabled:opacity-50"
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    Inviter ({invitableSelected.length})
                                </button>
                            )}
                            <button
                                onClick={handleBulkToggleStatus}
                                disabled={isBulkProcessing}
                                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border transition disabled:opacity-50 ${
                                    clientViewMode === 'active'
                                        ? 'border-amber-300 text-amber-700 bg-white hover:bg-amber-50'
                                        : 'border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50'
                                }`}
                            >
                                {clientViewMode === 'active' ? (
                                    <><Archive className="w-3.5 h-3.5" /> Archiver</>
                                ) : (
                                    <><Power className="w-3.5 h-3.5" /> Réactiver</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

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
                            const isChecked = selectedIds.has(client.id);
                            return (
                                <div key={client.id} onClick={() => onSelectClient(client)} className={`bg-white rounded-xl shadow-sm border ${isChecked ? 'border-brand-400 ring-1 ring-brand-200' : 'border-slate-200'} p-4 active:bg-slate-50 transition cursor-pointer ${client.status === 'inactive' ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleSelected(client.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                                aria-label={`Sélectionner ${client.companyName}`}
                                            />
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
                                        {(() => {
                                            const connStatus = getConnectionStatus(client);
                                            const connConfig = CONNECTION_STATUS_CONFIG[connStatus];
                                            if (client.status === 'inactive') {
                                                return (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                        <Archive className="w-3 h-3" /> Archivé
                                                    </span>
                                                );
                                            }
                                            const health = getDossierHealth(
                                                client,
                                                { treasuryAlert, dataFresh, pendingValidation, lastRecordValidated, lastActivity },
                                                connStatus
                                            );
                                            const dataLabel = lastActivity === 'Aucune' ? 'Aucune' : (dataFresh ? 'À jour' : 'Retard');
                                            const statutLabel = pendingValidation ? 'À Valider' : (lastRecordValidated ? 'OK' : 'En attente');
                                            const connDetail = client.owner?.lastLoginAt ? ` (${formatRelativeDate(client.owner.lastLoginAt)})` : '';
                                            const tooltip = [
                                                ...health.reasons,
                                                '———',
                                                `Données : ${dataLabel}`,
                                                `Statut : ${statutLabel}`,
                                                `Connexion : ${connConfig.label}${connDetail}`,
                                            ].join('\n');
                                            return (
                                                <span
                                                    title={tooltip}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${health.pillClass}`}
                                                >
                                                    {health.icon}
                                                    {health.label}
                                                </span>
                                            );
                                        })()}
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
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'} pl-4 w-8`}>
                                            <input
                                                type="checkbox"
                                                checked={allVisibleSelected}
                                                ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                                                onChange={toggleSelectAllVisible}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer align-middle"
                                                aria-label="Tout sélectionner"
                                                title={allVisibleSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                            />
                                        </th>
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'}`}>
                                            <button onClick={() => handleSort('name')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition">
                                                Dossier Client <SortIcon col="name" />
                                            </button>
                                        </th>
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'} text-center`}>
                                            <button onClick={() => handleSort('sector')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition">
                                                Secteur <SortIcon col="sector" />
                                            </button>
                                        </th>
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'} text-right`}>
                                            <button onClick={() => handleSort('revenue')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition ml-auto">
                                                CA YTD <SortIcon col="revenue" />
                                            </button>
                                            <InfoTip text="Chiffre d'affaires HT cumulé depuis le 1er janvier de l'exercice en cours." />
                                        </th>
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'} text-center`}>
                                            <button onClick={() => handleSort('objective')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition">
                                                % Objectif <SortIcon col="objective" />
                                            </button>
                                            <InfoTip text="Ratio CA réalisé / Objectif CA. Vert ≥ 100%, Orange ≥ 85%, Rouge < 85%." />
                                        </th>
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'} text-right`}>
                                            <button onClick={() => handleSort('treasury')} className="inline-flex items-center gap-0.5 hover:text-slate-600 transition ml-auto">
                                                Trésorerie <SortIcon col="treasury" />
                                            </button>
                                            <InfoTip text="Dernier solde bancaire connu. Rouge si négatif." />
                                        </th>
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'} text-center`}>Santé <InfoTip text={"Santé globale du dossier (composite).\n• À jour (vert) : données fraîches, dernier rapport validé, client connecté récemment.\n• En attente (orange) : validation en attente, données en retard ou inactivité.\n• À traiter (rouge) : trésorerie négative ou validation requise sur données anciennes.\n• Non invité / Nouveau (gris) : dossier non activé ou sans données."} /></th>
                                        <th className={`${denseView ? 'p-1.5' : 'p-3'} text-right pr-4`}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {sorted.map(({ client, ytdRevenue, ytdObjective, objPerformance, lastTreasury, treasuryAlert, dataFresh, pendingValidation, lastRecordValidated, lastActivity }) => {
                                        const perfCol = ytdObjective > 0 ? getPerfColor(objPerformance) : null;
                                        const isSelectedInPanel = panelClient?.id === client.id;
                                        const isChecked = selectedIds.has(client.id);
                                        const rowPad = denseView ? 'p-1.5' : 'p-3';
                                        const avatarSize = denseView ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm';
                                        return (
                                            <tr
                                                key={client.id}
                                                onClick={() => onSelectClient(client)}
                                                className={`hover:bg-brand-50/30 transition-colors cursor-pointer group ${client.status === 'inactive' ? 'opacity-60' : ''} ${isSelectedInPanel ? 'bg-brand-50/50 border-l-2 border-l-brand-500' : ''} ${isChecked ? 'bg-brand-50/40' : ''}`}
                                            >
                                                {/* CHECKBOX */}
                                                <td className={`${rowPad} pl-4`} onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => toggleSelected(client.id)}
                                                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer align-middle"
                                                        aria-label={`Sélectionner ${client.companyName}`}
                                                    />
                                                </td>

                                                {/* CLIENT */}
                                                <td className={rowPad}>
                                                    <div className={`flex items-center ${denseView ? 'gap-2' : 'gap-3'}`}>
                                                        <div className={`${avatarSize} rounded-full flex items-center justify-center font-bold border ${client.status === 'inactive' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
                                                            {client.companyName.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 text-xs truncate max-w-[180px]">{client.companyName}</div>
                                                            {!denseView && (
                                                                <div className="text-xs text-slate-400 truncate max-w-[180px]">
                                                                    {client.managerName}
                                                                    {client.city ? <span className="text-slate-300"> — {client.city}</span> : null}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* SECTEUR */}
                                                <td className={`${rowPad} text-center`}>
                                                    {client.sector ? (
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium text-slate-600">{client.sector}</span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* CA YTD */}
                                                <td className={`${rowPad} text-right`}>
                                                    {ytdRevenue > 0 ? (
                                                        <span className="font-mono font-bold text-slate-700 text-xs">{fmtEur(ytdRevenue)}</span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* % OBJECTIF */}
                                                <td className={`${rowPad} text-center`}>
                                                    {perfCol ? (
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${perfCol.bg} ${perfCol.text}`}>
                                                            {objPerformance.toFixed(0)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">N/A</span>
                                                    )}
                                                </td>

                                                {/* TRESORERIE */}
                                                <td className={`${rowPad} text-right`}>
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

                                                {/* SANTÉ (composite indicator) */}
                                                <td className={`${rowPad} text-center`}>
                                                    {(() => {
                                                        const connStatus = getConnectionStatus(client);
                                                        const connConfig = CONNECTION_STATUS_CONFIG[connStatus];
                                                        if (client.status === 'inactive') {
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                    <Archive className="w-3 h-3" /> Archivé
                                                                </span>
                                                            );
                                                        }
                                                        const health = getDossierHealth(
                                                            client,
                                                            { treasuryAlert, dataFresh, pendingValidation, lastRecordValidated, lastActivity },
                                                            connStatus
                                                        );
                                                        const dataLabel = lastActivity === 'Aucune' ? 'Aucune' : (dataFresh ? 'À jour' : 'Retard');
                                                        const statutLabel = pendingValidation ? 'À Valider' : (lastRecordValidated ? 'OK' : 'En attente');
                                                        const connDetail = client.owner?.lastLoginAt ? ` (${formatRelativeDate(client.owner.lastLoginAt)})` : '';
                                                        const tooltip = [
                                                            ...health.reasons,
                                                            '———',
                                                            `Données : ${dataLabel}`,
                                                            `Statut : ${statutLabel}`,
                                                            `Connexion : ${connConfig.label}${connDetail}`,
                                                        ].join('\n');
                                                        return (
                                                            <span
                                                                title={tooltip}
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${health.pillClass} cursor-help`}
                                                            >
                                                                {health.icon}
                                                                {health.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>

                                                {/* ACTIONS */}
                                                <td className={`${rowPad} text-right pr-4`}>
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
                                                                                <p className="px-4 py-1 text-xs text-slate-400">
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
