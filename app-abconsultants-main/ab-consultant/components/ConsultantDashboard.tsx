
import React, { useEffect, useState } from 'react';
import { Client, FinancialRecord } from '../types';
import { getRecordsByClient } from '../services/dataService';
import { AlertTriangle, Clock, CheckCircle, TrendingDown, MessageSquare, ArrowRight, Briefcase, Loader2, Filter, Shield } from 'lucide-react';

interface ConsultantDashboardProps {
    clients: Client[];
    onSelectClient: (client: Client) => void;
    onNavigateToMessages: () => void;
}

// Structure pour le résumé d'un client
interface ClientSummary {
    client: Client;
    lastRecord: FinancialRecord | null;
    pendingValidation: boolean;
    treasuryAlert: boolean;
    lastActivity: string;
}

const ConsultantDashboard: React.FC<ConsultantDashboardProps> = ({ clients, onSelectClient, onNavigateToMessages }) => {
    const [summaries, setSummaries] = useState<ClientSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'ALERT' | 'PENDING'>('ALL');

    useEffect(() => {
        const loadGlobalData = async () => {
            setIsLoading(true);
            const results: ClientSummary[] = [];

            // Pour chaque client, on récupère le dernier record pour analyser la santé
            // Note: En production avec beaucoup de clients, on optimiserait cela côté backend/firestore
            for (const client of clients) {
                if (client.status === 'inactive') continue;

                const records = await getRecordsByClient(client.id);
                // On prend le dernier record saisi (le plus récent en année/mois)
                const lastRecord = records.length > 0 ? records[records.length - 1] : null;
                
                // Détection validation en attente (Soumis mais pas validé)
                const pendingValidation = !!records.find(r => r.isSubmitted && !r.isValidated);

                results.push({
                    client,
                    lastRecord,
                    pendingValidation,
                    treasuryAlert: lastRecord ? lastRecord.cashFlow.treasury < 0 : false,
                    lastActivity: lastRecord ? `${lastRecord.month} ${lastRecord.year}` : 'Aucune'
                });
            }

            // Tri : Ceux qui ont besoin d'attention en premier
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
    }, [clients]);

    // STATS GLOBALES
    const totalUnread = clients.filter(c => c.hasUnreadMessages).length;
    const totalPending = summaries.filter(s => s.pendingValidation).length;
    const totalAlerts = summaries.filter(s => s.treasuryAlert).length;

    const filteredSummaries = summaries.filter(s => {
        if (filter === 'ALERT') return s.treasuryAlert;
        if (filter === 'PENDING') return s.pendingValidation;
        return true;
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-brand-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Analyse du portefeuille en cours...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* HEADER WELCOME */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-brand-600" />
                        Cockpit de Pilotage
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Vue d'ensemble de vos <strong>{summaries.length}</strong> dossiers actifs.
                    </p>
                </div>
                <div className="flex gap-2">
                     <div className="text-right hidden md:block">
                         <p className="text-xs font-bold text-slate-400 uppercase">Date</p>
                         <p className="font-bold text-slate-700">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                     </div>
                </div>
            </div>

            {/* ACTION CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* MESSAGES */}
                <div 
                    onClick={onNavigateToMessages}
                    className={`p-5 rounded-xl border cursor-pointer transition-all hover:shadow-md ${totalUnread > 0 ? 'bg-white border-red-200 shadow-red-100' : 'bg-white border-slate-200'}`}
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
                    className={`text-left p-5 rounded-xl border transition-all hover:shadow-md ${filter === 'PENDING' ? 'ring-2 ring-amber-400' : ''} ${totalPending > 0 ? 'bg-white border-amber-200' : 'bg-white border-slate-200'}`}
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
                    className={`text-left p-5 rounded-xl border transition-all hover:shadow-md ${filter === 'ALERT' ? 'ring-2 ring-red-400' : ''} ${totalAlerts > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}
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

            {/* CLIENT GRID / TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Briefcase className="w-4 h-4" /> État du Portefeuille
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
                            <tr className="text-xs font-bold text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                                <th className="p-4">Dossier Client</th>
                                <th className="p-4 text-center">Dernière Situation</th>
                                <th className="p-4 text-right">Trésorerie</th>
                                <th className="p-4 text-center">Statut</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {filteredSummaries.map((item) => (
                                <tr key={item.client.id} className="hover:bg-brand-50/30 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold border border-slate-200">
                                                    {item.client.companyName.substring(0, 2).toUpperCase()}
                                                </div>
                                                {item.client.hasUnreadMessages && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{item.client.companyName}</div>
                                                <div className="text-xs text-slate-400">{item.client.managerName}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.lastRecord ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-300 italic'}`}>
                                            {item.lastActivity}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {item.lastRecord ? (
                                            <div className="flex items-center justify-end gap-1">
                                                {item.treasuryAlert && <TrendingDown className="w-4 h-4 text-red-500" />}
                                                <span className={`font-mono font-bold ${item.treasuryAlert ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(item.lastRecord.cashFlow.treasury)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        {item.pendingValidation ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                <Clock className="w-3 h-3" /> À Valider
                                            </span>
                                        ) : (
                                            item.lastRecord?.isValidated ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 opacity-70">
                                                    <CheckCircle className="w-3 h-3" /> OK
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">En attente</span>
                                            )
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => onSelectClient(item.client)}
                                            className="px-3 py-1.5 bg-white border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-600 hover:text-white transition shadow-sm font-bold text-xs inline-flex items-center gap-1"
                                        >
                                            Ouvrir <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
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
