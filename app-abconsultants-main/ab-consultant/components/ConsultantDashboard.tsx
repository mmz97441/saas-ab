
import React, { useEffect, useState, useMemo } from 'react';
import { Client, FinancialRecord } from '../types';
import { getRecordsByClient } from '../services/dataService';
import {
    AlertTriangle, Clock, CheckCircle, TrendingDown, TrendingUp, MessageSquare,
    ArrowRight, Briefcase, Loader2, Filter, Shield, Search, X,
    DollarSign, Percent, Landmark, Target, Activity, CalendarClock
} from 'lucide-react';

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
    // KPI annuels par client
    ytdRevenue: number;
    ytdObjective: number;
    ytdMargin: number;
    ytdMarginRate: number;
    objPerformance: number; // % atteinte objectif
    dataFresh: boolean; // données récentes (< 2 mois)
}

const fmtEur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

const ConsultantDashboard: React.FC<ConsultantDashboardProps> = ({ clients, onSelectClient, onNavigateToMessages }) => {
    const [summaries, setSummaries] = useState<ClientSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'ALERT' | 'PENDING' | 'STALE'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

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

                // Year-to-date pour l'année en cours
                const yearRecords = records.filter(r => r.year === currentYear && r.revenue.total > 0);
                const ytdRevenue = yearRecords.reduce((acc, r) => acc + r.revenue.total, 0);
                const ytdObjective = yearRecords.reduce((acc, r) => acc + r.revenue.objective, 0);
                const ytdMargin = yearRecords.reduce((acc, r) => acc + (r.margin?.total || 0), 0);
                const ytdMarginRate = ytdRevenue > 0 ? (ytdMargin / ytdRevenue) * 100 : 0;
                const objPerformance = ytdObjective > 0 ? (ytdRevenue / ytdObjective) * 100 : 0;

                // Fraîcheur : le dernier record est-il récent ? (≤ 2 mois d'écart)
                let dataFresh = false;
                if (lastRecord) {
                    const lastMonthIdx = monthValues.indexOf(lastRecord.month as string);
                    const nowMonthIdx = new Date().getMonth(); // 0-based
                    if (lastRecord.year === currentYear && lastMonthIdx >= nowMonthIdx - 2) {
                        dataFresh = true;
                    } else if (lastRecord.year === currentYear - 1 && nowMonthIdx <= 1 && lastMonthIdx >= 10) {
                        dataFresh = true; // janvier/février qui réfère à nov/déc N-1
                    }
                }

                return {
                    client,
                    lastRecord,
                    records,
                    pendingValidation,
                    treasuryAlert: lastRecord ? lastRecord.cashFlow.treasury < 0 : false,
                    lastActivity: lastRecord ? `${lastRecord.month} ${lastRecord.year}` : 'Aucune',
                    ytdRevenue,
                    ytdObjective,
                    ytdMargin,
                    ytdMarginRate,
                    objPerformance,
                    dataFresh,
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

        // Clients avec objectif défini
        const clientsWithObj = summaries.filter(s => s.ytdObjective > 0);
        const clientsOnTarget = clientsWithObj.filter(s => s.objPerformance >= 100).length;
        const onTargetRate = clientsWithObj.length > 0 ? (clientsOnTarget / clientsWithObj.length) * 100 : 0;

        // Fraîcheur données
        const clientsWithData = summaries.filter(s => s.lastRecord);
        const freshCount = summaries.filter(s => s.dataFresh).length;
        const freshRate = clientsWithData.length > 0 ? (freshCount / clientsWithData.length) * 100 : 0;

        // Score santé : trésorerie positive + objectif ≥ 85% + données fraîches
        const healthyCount = summaries.filter(s =>
            !s.treasuryAlert && s.dataFresh && (s.ytdObjective === 0 || s.objPerformance >= 85)
        ).length;
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

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-brand-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Analyse du portefeuille en cours...</p>
        </div>
    );

    const healthCol = getHealthColor(portfolioKpis.healthScore);

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
                <div className="p-4 rounded-xl border bg-white border-brand-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600"><DollarSign className="w-4 h-4" /></div>
                        {portfolioKpis.totalObj > 0 && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${getPerfColor(portfolioKpis.objPerformance).bg} ${getPerfColor(portfolioKpis.objPerformance).text}`}>
                                {portfolioKpis.objPerformance.toFixed(0)}%
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">CA Portefeuille</p>
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
                </div>

                {/* MARGE MOYENNE */}
                <div className="p-4 rounded-xl border bg-white border-brand-100 shadow-sm">
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 w-fit mb-2"><Percent className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Marge Moyenne</p>
                    <div className="text-lg font-bold text-slate-800">{portfolioKpis.avgMarginRate.toFixed(1)}%</div>
                    <p className="text-[9px] text-slate-400 mt-1">Marge brute : {fmtEur(portfolioKpis.totalMargin)}</p>
                </div>

                {/* TRESORERIE GLOBALE */}
                <div className={`p-4 rounded-xl border shadow-sm ${portfolioKpis.totalTreasury < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-brand-100'}`}>
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 w-fit mb-2"><Landmark className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Trésorerie Globale</p>
                    <div className={`text-lg font-bold ${portfolioKpis.totalTreasury >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fmtEur(portfolioKpis.totalTreasury)}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">{totalAlerts} client{totalAlerts > 1 ? 's' : ''} en négatif</p>
                </div>

                {/* TAUX ATTEINTE OBJECTIFS */}
                <div className="p-4 rounded-xl border bg-white border-brand-100 shadow-sm">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 w-fit mb-2"><Target className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Objectifs Atteints</p>
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
                </div>

                {/* FRAICHEUR DONNEES */}
                <button
                    onClick={() => setFilter(filter === 'STALE' ? 'ALL' : 'STALE')}
                    className={`text-left p-4 rounded-xl border shadow-sm transition-all hover:shadow-md ${filter === 'STALE' ? 'ring-2 ring-orange-400' : ''} ${portfolioKpis.staleCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-brand-100'}`}
                >
                    <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 w-fit mb-2"><CalendarClock className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Données à Jour</p>
                    <div className="text-lg font-bold text-slate-800">
                        {portfolioKpis.freshRate.toFixed(0)}%
                    </div>
                    {portfolioKpis.staleCount > 0 && (
                        <p className="text-[9px] font-bold text-orange-600 mt-1">{portfolioKpis.staleCount} dossier{portfolioKpis.staleCount > 1 ? 's' : ''} en retard</p>
                    )}
                </button>

                {/* SCORE SANTE */}
                <div className={`p-4 rounded-xl border shadow-sm ${healthCol.bg}`}>
                    <div className={`p-1.5 rounded-lg bg-white/60 ${healthCol.icon} w-fit mb-2`}><Activity className="w-4 h-4" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Santé Portefeuille</p>
                    <div className={`text-lg font-bold ${healthCol.text}`}>
                        {portfolioKpis.healthScore.toFixed(0)}%
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1">{portfolioKpis.healthyCount}/{summaries.length} dossiers sains</p>
                </div>
            </div>

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
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Messages en attente</div>
                </div>

                {/* VALIDATIONS */}
                <button
                    onClick={() => setFilter(filter === 'PENDING' ? 'ALL' : 'PENDING')}
                    className={`text-left p-4 rounded-xl border transition-all hover:shadow-md ${filter === 'PENDING' ? 'ring-2 ring-amber-400' : ''} ${totalPending > 0 ? 'bg-white border-amber-200' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded-lg ${totalPending > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 mb-1">{totalPending}</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Rapports à Valider</div>
                </button>

                {/* ALERTS */}
                <button
                    onClick={() => setFilter(filter === 'ALERT' ? 'ALL' : 'ALERT')}
                    className={`text-left p-4 rounded-xl border transition-all hover:shadow-md ${filter === 'ALERT' ? 'ring-2 ring-red-400' : ''} ${totalAlerts > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 rounded-lg ${totalAlerts > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-red-700 mb-1">{totalAlerts}</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Trésoreries Négatives</div>
                </button>
            </div>

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
                            <button onClick={() => setFilter('ALL')} className="text-xs font-bold text-slate-500 bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1">
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
                                <th className="p-3 text-right">CA YTD</th>
                                <th className="p-3 text-center">% Objectif</th>
                                <th className="p-3 text-right">Marge</th>
                                <th className="p-3 text-right">Trésorerie</th>
                                <th className="p-3 text-center">Données</th>
                                <th className="p-3 text-center">Statut</th>
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
