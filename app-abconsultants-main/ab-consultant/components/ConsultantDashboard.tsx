
import React, { useEffect, useState, useMemo } from 'react';
import { Client, FinancialRecord } from '../types';
import { getRecordsByClient } from '../services/dataService';
import {
    AlertTriangle, Clock, CheckCircle, TrendingDown, TrendingUp, MessageSquare,
    ArrowRight, Briefcase, Loader2, Filter, Shield, Search, X, ChevronDown,
    DollarSign, Percent, Landmark, Target, Activity, CalendarClock, HelpCircle
} from 'lucide-react';

// Tooltip d'aide sur hover — petit "?" discret avec bulle explicative
const InfoTip: React.FC<{ text: string; position?: 'top' | 'bottom' }> = ({ text, position = 'bottom' }) => (
    <span className="relative group/tip inline-flex ml-1 cursor-help" onClick={(e) => e.stopPropagation()}>
        <HelpCircle className="w-3 h-3 text-slate-300 hover:text-brand-500 transition-colors" />
        <span className={`
            pointer-events-none absolute z-50 left-1/2 -translate-x-1/2
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            w-52 px-3 py-2 rounded-lg bg-slate-800 text-white text-[10px] leading-relaxed font-normal normal-case tracking-normal shadow-xl
            opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200
        `}>
            {text}
            <span className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 ${position === 'top' ? 'top-full -mt-1' : 'bottom-full mb-0 -mb-1'}`} />
        </span>
    </span>
);

interface ConsultantDashboardProps {
    clients: Client[];
    onSelectClient: (client: Client) => void;
    onNavigateToMessages: () => void;
}

interface ClientSummary {
    client: Client;
    lastRecord: FinancialRecord | null;
    records: FinancialRecord[];
    pendingValidation: boolean;
    treasuryAlert: boolean;
    lastActivity: string;
    ytdRevenue: number;
    ytdObjective: number;
    ytdMargin: number;
    ytdMarginRate: number;
    objPerformance: number;
    dataFresh: boolean;
    isHealthy: boolean;
}

type PanelType = 'CA' | 'MARGE' | 'TRESORERIE' | 'OBJECTIF' | 'FRAICHEUR' | 'SANTE' | 'PENDING' | 'ALERT' | null;

const fmtEur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

// Couleur dynamique basée sur un pourcentage (higher = better)
const getPerfColor = (p: number) => {
    if (p >= 110) return { text: 'text-emerald-700', bg: 'bg-emerald-100', bar: '#059669' };
    if (p >= 100) return { text: 'text-lime-700', bg: 'bg-lime-100', bar: '#65a30d' };
    if (p >= 95) return { text: 'text-amber-600', bg: 'bg-amber-100', bar: '#d97706' };
    if (p >= 85) return { text: 'text-orange-600', bg: 'bg-orange-100', bar: '#ea580c' };
    return { text: 'text-red-600', bg: 'bg-red-100', bar: '#dc2626' };
};

const getHealthColor = (score: number) => {
    if (score >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-600' };
    if (score >= 60) return { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-600' };
    return { text: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: 'text-red-600' };
};

// ─── Panneau Détail KPI ────────────────────────────────────────────
interface DetailPanelProps {
    panel: PanelType;
    summaries: ClientSummary[];
    portfolioKpis: any;
    onSelectClient: (client: Client) => void;
    onClose: () => void;
}

const PANEL_CONFIG: Record<Exclude<PanelType, null>, { title: string; color: string; border: string }> = {
    CA:         { title: 'Détail CA par client', color: 'bg-brand-50', border: 'border-brand-200' },
    MARGE:      { title: 'Détail Marge par client', color: 'bg-purple-50', border: 'border-purple-200' },
    TRESORERIE: { title: 'Détail Trésorerie par client', color: 'bg-emerald-50', border: 'border-emerald-200' },
    OBJECTIF:   { title: 'Détail Objectifs par client', color: 'bg-blue-50', border: 'border-blue-200' },
    FRAICHEUR:  { title: 'Dossiers en retard', color: 'bg-orange-50', border: 'border-orange-200' },
    SANTE:      { title: 'Dossiers en difficulté', color: 'bg-red-50', border: 'border-red-200' },
    PENDING:    { title: 'Rapports en attente de validation', color: 'bg-amber-50', border: 'border-amber-200' },
    ALERT:      { title: 'Trésoreries négatives', color: 'bg-red-50', border: 'border-red-200' },
};

const DetailPanel: React.FC<DetailPanelProps> = ({ panel, summaries, portfolioKpis, onSelectClient, onClose }) => {
    if (!panel) return null;
    const config = PANEL_CONFIG[panel];

    // Filtrer et trier selon le type de panneau
    const items = useMemo(() => {
        let list = [...summaries];
        switch (panel) {
            case 'CA':
                return list.filter(s => s.ytdRevenue > 0).sort((a, b) => b.ytdRevenue - a.ytdRevenue);
            case 'MARGE':
                return list.filter(s => s.ytdMarginRate > 0).sort((a, b) => b.ytdMarginRate - a.ytdMarginRate);
            case 'TRESORERIE':
                return list.filter(s => s.lastRecord).sort((a, b) => (a.lastRecord?.cashFlow.treasury || 0) - (b.lastRecord?.cashFlow.treasury || 0));
            case 'OBJECTIF':
                return list.filter(s => s.ytdObjective > 0).sort((a, b) => a.objPerformance - b.objPerformance);
            case 'FRAICHEUR':
                return list.filter(s => !s.dataFresh && s.lastRecord).sort((a, b) => a.client.companyName.localeCompare(b.client.companyName, 'fr'));
            case 'SANTE':
                return list.filter(s => !s.isHealthy).sort((a, b) => {
                    const scoreA = (a.treasuryAlert ? 3 : 0) + (!a.dataFresh ? 2 : 0) + (a.ytdObjective > 0 && a.objPerformance < 85 ? 1 : 0);
                    const scoreB = (b.treasuryAlert ? 3 : 0) + (!b.dataFresh ? 2 : 0) + (b.ytdObjective > 0 && b.objPerformance < 85 ? 1 : 0);
                    return scoreB - scoreA;
                });
            case 'PENDING':
                return list.filter(s => s.pendingValidation);
            case 'ALERT':
                return list.filter(s => s.treasuryAlert).sort((a, b) => (a.lastRecord?.cashFlow.treasury || 0) - (b.lastRecord?.cashFlow.treasury || 0));
            default: return list;
        }
    }, [panel, summaries]);

    const renderRow = (item: ClientSummary) => {
        const perf = item.objPerformance;
        const perfCol = item.ytdObjective > 0 ? getPerfColor(perf) : null;

        return (
            <tr key={item.client.id} onClick={() => onSelectClient(item.client)} className="hover:bg-white/80 transition-colors cursor-pointer group">
                {/* Client */}
                <td className="p-2.5 pl-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-white text-slate-600 flex items-center justify-center font-bold border border-slate-200 text-[10px] shrink-0">
                            {item.client.companyName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-xs truncate max-w-[160px]">{item.client.companyName}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{item.client.managerName}</div>
                        </div>
                    </div>
                </td>

                {/* Colonnes dynamiques selon le panneau */}
                {(panel === 'CA' || panel === 'SANTE') && (
                    <td className="p-2.5 text-right">
                        <span className="font-mono font-bold text-xs text-slate-700">{fmtEur(item.ytdRevenue)}</span>
                        {panel === 'CA' && portfolioKpis.totalCA > 0 && (
                            <div className="text-[9px] text-slate-400">{((item.ytdRevenue / portfolioKpis.totalCA) * 100).toFixed(1)}% du total</div>
                        )}
                    </td>
                )}

                {(panel === 'MARGE') && (
                    <>
                        <td className="p-2.5 text-right">
                            <span className="font-mono font-bold text-xs text-purple-600">{item.ytdMarginRate.toFixed(1)}%</span>
                        </td>
                        <td className="p-2.5 text-right">
                            <span className="font-mono text-xs text-slate-500">{fmtEur(item.ytdMargin)}</span>
                        </td>
                    </>
                )}

                {(panel === 'TRESORERIE' || panel === 'ALERT') && (
                    <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                            {item.treasuryAlert && <TrendingDown className="w-3 h-3 text-red-500" />}
                            <span className={`font-mono font-bold text-xs ${item.treasuryAlert ? 'text-red-600' : 'text-emerald-600'}`}>
                                {fmtEur(item.lastRecord?.cashFlow.treasury || 0)}
                            </span>
                        </div>
                    </td>
                )}

                {(panel === 'OBJECTIF') && (
                    <>
                        <td className="p-2.5 text-right">
                            <span className="font-mono text-xs text-slate-600">{fmtEur(item.ytdRevenue)}</span>
                        </td>
                        <td className="p-2.5 text-right">
                            <span className="font-mono text-xs text-slate-400">{fmtEur(item.ytdObjective)}</span>
                        </td>
                        <td className="p-2.5 text-center">
                            <div className="inline-flex flex-col items-center gap-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${perfCol!.bg} ${perfCol!.text}`}>
                                    {perf.toFixed(0)}%
                                </span>
                                <div className="h-1 w-10 bg-white/60 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(perf, 100)}%`, backgroundColor: perfCol!.bar }} />
                                </div>
                            </div>
                        </td>
                    </>
                )}

                {(panel === 'FRAICHEUR') && (
                    <td className="p-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600">
                            <CalendarClock className="w-3 h-3" /> {item.lastActivity}
                        </span>
                    </td>
                )}

                {(panel === 'SANTE') && (
                    <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                            {item.treasuryAlert && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">Tréso &lt; 0</span>}
                            {!item.dataFresh && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700">Données</span>}
                            {item.ytdObjective > 0 && item.objPerformance < 85 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">Obj &lt; 85%</span>}
                        </div>
                    </td>
                )}

                {(panel === 'PENDING') && (
                    <td className="p-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                            <Clock className="w-3 h-3" /> À Valider
                        </span>
                    </td>
                )}

                {/* Ouvrir */}
                <td className="p-2.5 text-right pr-4">
                    <span className="text-[10px] font-bold text-brand-500 opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-0.5">
                        Ouvrir <ArrowRight className="w-3 h-3" />
                    </span>
                </td>
            </tr>
        );
    };

    const renderHeader = () => {
        switch (panel) {
            case 'CA':
            case 'SANTE':
                return (
                    <>
                        <th className="p-2.5 pl-4 text-left">Client</th>
                        <th className="p-2.5 text-right">CA YTD</th>
                        {panel === 'SANTE' && <th className="p-2.5 text-left">Problèmes</th>}
                        <th className="p-2.5 text-right pr-4"></th>
                    </>
                );
            case 'MARGE':
                return (
                    <>
                        <th className="p-2.5 pl-4 text-left">Client</th>
                        <th className="p-2.5 text-right">Taux marge</th>
                        <th className="p-2.5 text-right">Marge brute</th>
                        <th className="p-2.5 text-right pr-4"></th>
                    </>
                );
            case 'TRESORERIE':
            case 'ALERT':
                return (
                    <>
                        <th className="p-2.5 pl-4 text-left">Client</th>
                        <th className="p-2.5 text-right">Solde bancaire</th>
                        <th className="p-2.5 text-right pr-4"></th>
                    </>
                );
            case 'OBJECTIF':
                return (
                    <>
                        <th className="p-2.5 pl-4 text-left">Client</th>
                        <th className="p-2.5 text-right">CA réalisé</th>
                        <th className="p-2.5 text-right">Objectif</th>
                        <th className="p-2.5 text-center">Atteinte</th>
                        <th className="p-2.5 text-right pr-4"></th>
                    </>
                );
            case 'FRAICHEUR':
                return (
                    <>
                        <th className="p-2.5 pl-4 text-left">Client</th>
                        <th className="p-2.5 text-center">Dernière activité</th>
                        <th className="p-2.5 text-right pr-4"></th>
                    </>
                );
            case 'PENDING':
                return (
                    <>
                        <th className="p-2.5 pl-4 text-left">Client</th>
                        <th className="p-2.5 text-center">Statut</th>
                        <th className="p-2.5 text-right pr-4"></th>
                    </>
                );
            default: return null;
        }
    };

    return (
        <div className={`rounded-xl border ${config.border} ${config.color} overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2 duration-300`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/40">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <ChevronDown className="w-3.5 h-3.5" />
                    {config.title}
                    <span className="text-slate-400 font-normal">({items.length} client{items.length !== 1 ? 's' : ''})</span>
                </h4>
                <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition rounded-full hover:bg-white/60">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            {items.length > 0 ? (
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-white/40">
                                {renderHeader()}
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/30">
                            {items.map(renderRow)}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    Aucun dossier dans cette catégorie
                </div>
            )}
        </div>
    );
};

// ─── Composant Principal ───────────────────────────────────────────
const ConsultantDashboard: React.FC<ConsultantDashboardProps> = ({ clients, onSelectClient, onNavigateToMessages }) => {
    const [summaries, setSummaries] = useState<ClientSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'ALERT' | 'PENDING' | 'STALE'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [activePanel, setActivePanel] = useState<PanelType>(null);

    const currentYear = new Date().getFullYear();

    useEffect(() => {
        const loadGlobalData = async () => {
            setIsLoading(true);

            const activeClients = clients.filter(c => c.status !== 'inactive');

            const allRecords = await Promise.all(
                activeClients.map(client => getRecordsByClient(client.id))
            );

            const monthValues = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

            const results: ClientSummary[] = activeClients.map((client, i) => {
                const records = allRecords[i];
                const lastRecord = records.length > 0 ? records[records.length - 1] : null;
                const pendingValidation = !!records.find(r => r.isSubmitted && !r.isValidated);

                const yearRecords = records.filter(r => r.year === currentYear && r.revenue.total > 0);
                const ytdRevenue = yearRecords.reduce((acc, r) => acc + r.revenue.total, 0);
                const ytdObjective = yearRecords.reduce((acc, r) => acc + r.revenue.objective, 0);
                const ytdMargin = yearRecords.reduce((acc, r) => acc + (r.margin?.total || 0), 0);
                const ytdMarginRate = ytdRevenue > 0 ? (ytdMargin / ytdRevenue) * 100 : 0;
                const objPerformance = ytdObjective > 0 ? (ytdRevenue / ytdObjective) * 100 : 0;

                let dataFresh = false;
                if (lastRecord) {
                    const lastMonthIdx = monthValues.indexOf(lastRecord.month as string);
                    const nowMonthIdx = new Date().getMonth();
                    if (lastRecord.year === currentYear && lastMonthIdx >= nowMonthIdx - 2) {
                        dataFresh = true;
                    } else if (lastRecord.year === currentYear - 1 && nowMonthIdx <= 1 && lastMonthIdx >= 10) {
                        dataFresh = true;
                    }
                }

                const treasuryAlert = lastRecord ? lastRecord.cashFlow.treasury < 0 : false;
                const isHealthy = !treasuryAlert && dataFresh && (ytdObjective === 0 || objPerformance >= 85);

                return {
                    client, lastRecord, records, pendingValidation, treasuryAlert,
                    lastActivity: lastRecord ? `${lastRecord.month} ${lastRecord.year}` : 'Aucune',
                    ytdRevenue, ytdObjective, ytdMargin, ytdMarginRate, objPerformance, dataFresh, isHealthy,
                };
            });

            results.sort((a, b) => {
                const scoreA = (a.treasuryAlert ? 2 : 0) + (a.pendingValidation ? 1 : 0) + (a.client.hasUnreadMessages ? 1 : 0);
                const scoreB = (b.treasuryAlert ? 2 : 0) + (b.pendingValidation ? 1 : 0) + (b.client.hasUnreadMessages ? 1 : 0);
                return scoreB - scoreA;
            });

            setSummaries(results);
            setIsLoading(false);
        };

        if (clients.length > 0) {
            loadGlobalData();
        } else {
            setIsLoading(false);
        }
    }, [clients, currentYear]);

    // --- KPI GLOBAUX PORTEFEUILLE ---
    const totalUnread = clients.filter(c => c.hasUnreadMessages).length;
    const totalPending = summaries.filter(s => s.pendingValidation).length;
    const totalAlerts = summaries.filter(s => s.treasuryAlert).length;

    const portfolioKpis = useMemo(() => {
        const totalCA = summaries.reduce((acc, s) => acc + s.ytdRevenue, 0);
        const totalObj = summaries.reduce((acc, s) => acc + s.ytdObjective, 0);
        const totalMargin = summaries.reduce((acc, s) => acc + s.ytdMargin, 0);
        const avgMarginRate = totalCA > 0 ? (totalMargin / totalCA) * 100 : 0;
        const totalTreasury = summaries.reduce((acc, s) => acc + (s.lastRecord?.cashFlow.treasury || 0), 0);
        const objPerformance = totalObj > 0 ? (totalCA / totalObj) * 100 : 0;

        const clientsWithObj = summaries.filter(s => s.ytdObjective > 0);
        const clientsOnTarget = clientsWithObj.filter(s => s.objPerformance >= 100).length;
        const onTargetRate = clientsWithObj.length > 0 ? (clientsOnTarget / clientsWithObj.length) * 100 : 0;

        const clientsWithData = summaries.filter(s => s.lastRecord);
        const freshCount = summaries.filter(s => s.dataFresh).length;
        const freshRate = clientsWithData.length > 0 ? (freshCount / clientsWithData.length) * 100 : 0;

        const healthyCount = summaries.filter(s => s.isHealthy).length;
        const healthScore = summaries.length > 0 ? (healthyCount / summaries.length) * 100 : 0;

        return {
            totalCA, totalObj, totalMargin, avgMarginRate, totalTreasury,
            objPerformance, clientsOnTarget, clientsWithObj: clientsWithObj.length,
            onTargetRate, freshRate, freshCount, staleCount: clientsWithData.length - freshCount,
            healthScore, healthyCount,
        };
    }, [summaries]);

    const filteredSummaries = useMemo(() => {
        let result = summaries;
        if (filter === 'ALERT') result = result.filter(s => s.treasuryAlert);
        if (filter === 'PENDING') result = result.filter(s => s.pendingValidation);
        if (filter === 'STALE') result = result.filter(s => !s.dataFresh && s.lastRecord);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.client.companyName.toLowerCase().includes(q) ||
                (s.client.managerName || '').toLowerCase().includes(q) ||
                (s.client.city || '').toLowerCase().includes(q) ||
                (s.client.sector || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [summaries, filter, searchQuery]);

    const togglePanel = (p: PanelType) => setActivePanel(prev => prev === p ? null : p);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-brand-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Analyse du portefeuille en cours...</p>
        </div>
    );

    const healthCol = getHealthColor(portfolioKpis.healthScore);

    // Helper pour style de carte cliquable
    const kpiCardClass = (panelKey: PanelType, baseClasses: string) =>
        `text-left cursor-pointer transition-all hover:shadow-md ${baseClasses} ${activePanel === panelKey ? 'ring-2 ring-brand-400 shadow-md scale-[1.02]' : ''}`;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-brand-600" />
                        Cockpit de Pilotage
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Vue d'ensemble de vos <strong>{summaries.length}</strong> dossiers actifs — Exercice <strong>{currentYear}</strong>
                    </p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-xs font-bold text-slate-400 uppercase">Date</p>
                    <p className="font-bold text-slate-700">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
            </div>

            {/* ═══ KPI FINANCIERS DU PORTEFEUILLE ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* CA TOTAL */}
                <button onClick={() => togglePanel('CA')} className={kpiCardClass('CA', 'p-4 rounded-xl border bg-white border-brand-100 shadow-sm')}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600"><DollarSign className="w-4 h-4" /></div>
                        {portfolioKpis.totalObj > 0 && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getPerfColor(portfolioKpis.objPerformance).bg} ${getPerfColor(portfolioKpis.objPerformance).text}`}>
                                {portfolioKpis.objPerformance.toFixed(0)}%
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">CA Portefeuille <InfoTip text="Chiffre d'affaires HT cumulé de tous vos clients depuis le 1er janvier de l'année en cours (Year-to-Date). Cliquez pour voir le détail par client." /></p>
                    <div className="text-lg font-bold text-slate-800">{fmtEur(portfolioKpis.totalCA)}</div>
                    {portfolioKpis.totalObj > 0 && (
                        <div className="mt-2">
                            <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                                <span>Obj: {fmtEur(portfolioKpis.totalObj)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(portfolioKpis.objPerformance, 100)}%`, backgroundColor: getPerfColor(portfolioKpis.objPerformance).bar }} />
                            </div>
                        </div>
                    )}
                </button>

                {/* MARGE MOYENNE */}
                <button onClick={() => togglePanel('MARGE')} className={kpiCardClass('MARGE', 'p-4 rounded-xl border bg-white border-brand-100 shadow-sm')}>
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 w-fit mb-2"><Percent className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Marge Moyenne <InfoTip text="Taux de marge commerciale brute pondéré par le CA. Cliquez pour voir le détail par client." /></p>
                    <div className="text-lg font-bold text-slate-800">{portfolioKpis.avgMarginRate.toFixed(1)}%</div>
                    <p className="text-[9px] text-slate-400 mt-1">Marge brute : {fmtEur(portfolioKpis.totalMargin)}</p>
                </button>

                {/* TRESORERIE GLOBALE */}
                <button onClick={() => togglePanel('TRESORERIE')} className={kpiCardClass('TRESORERIE', `p-4 rounded-xl border shadow-sm ${portfolioKpis.totalTreasury < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-brand-100'}`)}>
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 w-fit mb-2"><Landmark className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Trésorerie Globale <InfoTip text="Somme des soldes bancaires. Cliquez pour voir le classement par client." /></p>
                    <div className={`text-lg font-bold ${portfolioKpis.totalTreasury >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtEur(portfolioKpis.totalTreasury)}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">{totalAlerts} client{totalAlerts > 1 ? 's' : ''} en négatif</p>
                </button>

                {/* TAUX ATTEINTE OBJECTIFS */}
                <button onClick={() => togglePanel('OBJECTIF')} className={kpiCardClass('OBJECTIF', 'p-4 rounded-xl border bg-white border-brand-100 shadow-sm')}>
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 w-fit mb-2"><Target className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Objectifs Atteints <InfoTip text="Cliquez pour voir l'atteinte par client." /></p>
                    <div className="text-lg font-bold text-slate-800">
                        {portfolioKpis.clientsOnTarget}<span className="text-sm text-slate-400 font-normal">/{portfolioKpis.clientsWithObj}</span>
                    </div>
                    {portfolioKpis.clientsWithObj > 0 && (
                        <div className="mt-1.5">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${portfolioKpis.onTargetRate}%`, backgroundColor: getPerfColor(portfolioKpis.onTargetRate).bar }} />
                            </div>
                            <p className={`text-[9px] font-bold mt-0.5 ${getPerfColor(portfolioKpis.onTargetRate).text}`}>{portfolioKpis.onTargetRate.toFixed(0)}% du portefeuille</p>
                        </div>
                    )}
                </button>

                {/* FRAICHEUR DONNEES */}
                <button
                    onClick={() => { togglePanel('FRAICHEUR'); setFilter(activePanel === 'FRAICHEUR' ? 'ALL' : 'STALE'); }}
                    className={kpiCardClass('FRAICHEUR', `p-4 rounded-xl border shadow-sm ${portfolioKpis.staleCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-brand-100'}`)}
                >
                    <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 w-fit mb-2"><CalendarClock className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Données à Jour <InfoTip text="Cliquez pour voir les dossiers en retard." /></p>
                    <div className="text-lg font-bold text-slate-800">
                        {portfolioKpis.freshRate.toFixed(0)}%
                    </div>
                    {portfolioKpis.staleCount > 0 && (
                        <p className="text-[9px] font-bold text-orange-600 mt-1">{portfolioKpis.staleCount} dossier{portfolioKpis.staleCount > 1 ? 's' : ''} en retard</p>
                    )}
                </button>

                {/* SCORE SANTE */}
                <button onClick={() => togglePanel('SANTE')} className={kpiCardClass('SANTE', `p-4 rounded-xl border shadow-sm ${healthCol.bg}`)}>
                    <div className={`p-1.5 rounded-lg bg-white/60 ${healthCol.icon} w-fit mb-2`}><Activity className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Santé Portefeuille <InfoTip text="Cliquez pour voir les dossiers en difficulté." /></p>
                    <div className={`text-lg font-bold ${healthCol.text}`}>
                        {portfolioKpis.healthScore.toFixed(0)}%
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1">{portfolioKpis.healthyCount}/{summaries.length} dossiers sains</p>
                </button>
            </div>

            {/* ═══ PANNEAU DETAIL KPI FINANCIERS ═══ */}
            {activePanel && ['CA', 'MARGE', 'TRESORERIE', 'OBJECTIF', 'FRAICHEUR', 'SANTE'].includes(activePanel) && (
                <DetailPanel
                    panel={activePanel}
                    summaries={summaries}
                    portfolioKpis={portfolioKpis}
                    onSelectClient={onSelectClient}
                    onClose={() => setActivePanel(null)}
                />
            )}

            {/* ═══ CARTES D'ACTIONS (Messages / Validations / Alertes) ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* MESSAGES */}
                <div
                    onClick={onNavigateToMessages}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${totalUnread > 0 ? 'bg-white border-red-200 shadow-red-100' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded-lg ${totalUnread > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        {totalUnread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{totalUnread} Nouveaux</span>}
                    </div>
                    <div className="text-2xl font-bold text-slate-800 mb-1">{totalUnread}</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Messages en attente <InfoTip text="Nombre de clients ayant des messages non lus dans la messagerie. Cliquez pour accéder à la messagerie." /></div>
                </div>

                {/* VALIDATIONS */}
                <button
                    onClick={() => { togglePanel('PENDING'); setFilter(activePanel === 'PENDING' ? 'ALL' : 'PENDING'); }}
                    className={`text-left p-4 rounded-xl border transition-all hover:shadow-md ${activePanel === 'PENDING' ? 'ring-2 ring-amber-400 shadow-md' : ''} ${totalPending > 0 ? 'bg-white border-amber-200' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded-lg ${totalPending > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 mb-1">{totalPending}</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rapports à Valider <InfoTip text="Cliquez pour voir les clients avec rapports en attente." /></div>
                </button>

                {/* ALERTS */}
                <button
                    onClick={() => { togglePanel('ALERT'); setFilter(activePanel === 'ALERT' ? 'ALL' : 'ALERT'); }}
                    className={`text-left p-4 rounded-xl border transition-all hover:shadow-md ${activePanel === 'ALERT' ? 'ring-2 ring-red-400 shadow-md' : ''} ${totalAlerts > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded-lg ${totalAlerts > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-red-700 mb-1">{totalAlerts}</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Trésoreries Négatives <InfoTip text="Cliquez pour voir les clients en découvert." /></div>
                </button>
            </div>

            {/* ═══ PANNEAU DETAIL CARTES D'ACTIONS ═══ */}
            {activePanel && ['PENDING', 'ALERT'].includes(activePanel) && (
                <DetailPanel
                    panel={activePanel}
                    summaries={summaries}
                    portfolioKpis={portfolioKpis}
                    onSelectClient={onSelectClient}
                    onClose={() => { setActivePanel(null); setFilter('ALL'); }}
                />
            )}

            {/* SEARCH BAR */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un client par nom, dirigeant, ville ou secteur..."
                    className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition placeholder-slate-400 shadow-sm"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* ═══ TABLEAU CLIENTS ENRICHI ═══ */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Briefcase className="w-4 h-4" /> État du Portefeuille
                        <span className="text-xs font-normal text-slate-400">({filteredSummaries.length} dossier{filteredSummaries.length > 1 ? 's' : ''})</span>
                    </h3>
                    <div className="flex gap-2">
                        {filter !== 'ALL' && (
                            <button onClick={() => { setFilter('ALL'); setActivePanel(null); }} className="text-xs font-bold text-slate-500 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1">
                                <Filter className="w-3 h-3" /> Effacer filtres
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                                <th className="p-3 pl-4">Dossier Client</th>
                                <th className="p-3 text-right">CA YTD <InfoTip text="Chiffre d'affaires HT cumulé depuis le 1er janvier de l'exercice en cours." position="top" /></th>
                                <th className="p-3 text-center">% Objectif <InfoTip text="Ratio CA réalisé / Objectif CA sur la même période. Vert ≥ 100%, Orange ≥ 85%, Rouge &lt; 85%." position="top" /></th>
                                <th className="p-3 text-right">Marge <InfoTip text="Taux de marge commerciale brute : (CA - Achats consommés) / CA, calculé sur l'exercice en cours." position="top" /></th>
                                <th className="p-3 text-right">Trésorerie <InfoTip text="Dernier solde bancaire connu (actifs - passifs). Rouge si négatif." position="top" /></th>
                                <th className="p-3 text-center">Données <InfoTip text="Indique si le client a transmis des données dans les 2 derniers mois. 'Retard' = données manquantes." position="top" /></th>
                                <th className="p-3 text-center">Statut <InfoTip text="'À Valider' = rapport soumis en attente de validation. 'OK' = validé par le cabinet." position="top" /></th>
                                <th className="p-3 text-right pr-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {filteredSummaries.map((item) => {
                                const perf = item.objPerformance;
                                const perfCol = item.ytdObjective > 0 ? getPerfColor(perf) : null;
                                return (
                                <tr key={item.client.id} className="hover:bg-brand-50/30 transition-colors group">
                                    {/* CLIENT */}
                                    <td className="p-3 pl-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200 text-xs">
                                                    {item.client.companyName.substring(0, 2).toUpperCase()}
                                                </div>
                                                {item.client.hasUnreadMessages && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-800 text-xs truncate max-w-[150px]">{item.client.companyName}</div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                                    {item.client.sector ? <span className="bg-slate-100 px-1 py-0.5 rounded text-[9px] mr-1">{item.client.sector}</span> : null}
                                                    {item.client.managerName}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* CA YTD */}
                                    <td className="p-3 text-right">
                                        {item.ytdRevenue > 0 ? (
                                            <span className="font-mono font-bold text-slate-700 text-xs">{fmtEur(item.ytdRevenue)}</span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </td>

                                    {/* % OBJECTIF */}
                                    <td className="p-3 text-center">
                                        {item.ytdObjective > 0 ? (
                                            <div className="inline-flex flex-col items-center gap-0.5">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${perfCol!.bg} ${perfCol!.text}`}>
                                                    {perf.toFixed(0)}%
                                                </span>
                                                <div className="h-1 w-10 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${Math.min(perf, 100)}%`, backgroundColor: perfCol!.bar }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-[10px]">N/A</span>
                                        )}
                                    </td>

                                    {/* MARGE */}
                                    <td className="p-3 text-right">
                                        {item.ytdMarginRate > 0 ? (
                                            <span className="font-mono font-bold text-xs text-purple-600">{item.ytdMarginRate.toFixed(1)}%</span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </td>

                                    {/* TRESORERIE */}
                                    <td className="p-3 text-right">
                                        {item.lastRecord ? (
                                            <div className="flex items-center justify-end gap-1">
                                                {item.treasuryAlert && <TrendingDown className="w-3 h-3 text-red-500" />}
                                                <span className={`font-mono font-bold text-xs ${item.treasuryAlert ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {fmtEur(item.lastRecord.cashFlow.treasury)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </td>

                                    {/* FRAICHEUR DONNEES */}
                                    <td className="p-3 text-center">
                                        {item.lastRecord ? (
                                            item.dataFresh ? (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                                                    <CheckCircle className="w-3 h-3" /> À jour
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-600">
                                                    <CalendarClock className="w-3 h-3" /> Retard
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-slate-300 text-[10px]">Aucune</span>
                                        )}
                                    </td>

                                    {/* STATUT */}
                                    <td className="p-3 text-center">
                                        {item.pendingValidation ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                                <Clock className="w-3 h-3" /> À Valider
                                            </span>
                                        ) : (
                                            item.lastRecord?.isValidated ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 opacity-70">
                                                    <CheckCircle className="w-3 h-3" /> OK
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-[10px]">En attente</span>
                                            )
                                        )}
                                    </td>

                                    {/* ACTION */}
                                    <td className="p-3 text-right pr-4">
                                        <button
                                            onClick={() => onSelectClient(item.client)}
                                            className="px-3 py-1.5 bg-white border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-600 hover:text-white transition shadow-sm font-bold text-[10px] inline-flex items-center gap-1"
                                        >
                                            Ouvrir <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredSummaries.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Tout est calme. Aucun dossier ne correspond à vos filtres.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsultantDashboard;
