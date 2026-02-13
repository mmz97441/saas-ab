
import React, { useMemo, useState } from 'react';
import { Database, Plus, Download, CheckCircle, Clock, Edit2, ShieldCheck, Unlock, Eye, EyeOff, Trash2, CheckSquare, Square, FileSpreadsheet } from 'lucide-react';
import { FinancialRecord, Month } from '../types';
import { toShortMonth, MONTH_ORDER } from '../services/dataService';
import { useConfirmDialog } from '../contexts/ConfirmContext';

interface HistoryViewProps {
    data: FinancialRecord[];
    userRole: 'ab_consultant' | 'client';
    onNewRecord: () => void;
    onExportCSV: () => void;
    onEdit: (record: FinancialRecord) => void;
    onDelete: (record: FinancialRecord) => void;
    onValidate: (record: FinancialRecord) => void;
    onPublish: (record: FinancialRecord) => void;
    onLockToggle: (record: FinancialRecord) => void;
    onBulkValidate?: (records: FinancialRecord[]) => void;
    onBulkPublish?: (records: FinancialRecord[]) => void;
    onImportExcel?: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({
    data,
    userRole,
    onNewRecord,
    onExportCSV,
    onEdit,
    onDelete,
    onValidate,
    onPublish,
    onLockToggle,
    onBulkValidate,
    onBulkPublish,
    onImportExcel
}) => {
    const [historyYearFilter, setHistoryYearFilter] = useState<number | 'ALL'>('ALL');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const confirm = useConfirmDialog();

    // 1. Get Available Years
    const historyAvailableYears = useMemo(() => {
        const years = new Set(data.map(r => r.year));
        return Array.from(years).sort((a: number, b: number) => b - a);
    }, [data]);

    // 2. Filter & Sort Data
    const filteredHistoryData = useMemo(() => {
        let filtered = data;
        if (historyYearFilter !== 'ALL') {
            filtered = filtered.filter(r => r.year === historyYearFilter);
        }
        return [...filtered].sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            return MONTH_ORDER.indexOf(b.month) - MONTH_ORDER.indexOf(a.month);
        });
    }, [data, historyYearFilter]);

    // --- BULK SELECTION ---
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredHistoryData.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredHistoryData.map(r => r.id)));
        }
    };

    const selectedRecords = useMemo(() => filteredHistoryData.filter(r => selectedIds.has(r.id)), [filteredHistoryData, selectedIds]);

    const handleBulkValidate = async () => {
        const toValidate = selectedRecords.filter(r => !r.isValidated);
        if (toValidate.length === 0) return;
        const ok = await confirm({
            title: `Valider ${toValidate.length} rapport(s) ?`,
            message: 'Les rapports sélectionnés seront marqués comme validés.',
            variant: 'success',
            confirmLabel: 'Tout valider',
        });
        if (!ok) return;
        if (onBulkValidate) {
            onBulkValidate(toValidate);
        } else {
            for (const r of toValidate) onValidate(r);
        }
        setSelectedIds(new Set());
    };

    const handleBulkPublish = async () => {
        const toPublish = selectedRecords.filter(r => !r.isPublished);
        if (toPublish.length === 0) return;
        const ok = await confirm({
            title: `Publier ${toPublish.length} rapport(s) ?`,
            message: 'Les rapports sélectionnés seront visibles pour le client.',
            variant: 'info',
            confirmLabel: 'Tout publier',
        });
        if (!ok) return;
        if (onBulkPublish) {
            onBulkPublish(toPublish);
        } else {
            for (const r of toPublish) onPublish(r);
        }
        setSelectedIds(new Set());
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-6 h-6 text-brand-500" />
                        Historique & Rapports
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Consultez, modifiez ou exportez les données passées.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {userRole === 'ab_consultant' && (
                        <>
                            <button onClick={onNewRecord} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm font-medium">
                                <Plus className="w-4 h-4" /> Saisie Manuelle
                            </button>
                            {onImportExcel && (
                                <button onClick={onImportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm font-medium">
                                    <FileSpreadsheet className="w-4 h-4" /> Import Excel
                                </button>
                            )}
                        </>
                    )}
                    <button onClick={onExportCSV} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* HISTORY FILTERS */}
            <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-lg w-fit">
                <span className="text-xs font-bold text-slate-500 px-2 uppercase">Filtrer par année :</span>
                <button
                    onClick={() => setHistoryYearFilter('ALL')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyYearFilter === 'ALL' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    TOUT
                </button>
                {historyAvailableYears.map(year => (
                    <button
                        key={year}
                        onClick={() => setHistoryYearFilter(year)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${historyYearFilter === year ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {year}
                    </button>
                ))}
            </div>

            {/* BULK ACTION BAR */}
            {userRole === 'ab_consultant' && selectedIds.size > 0 && (
                <div className="bg-brand-900 text-white p-3 rounded-xl flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200">
                    <span className="text-sm font-bold">{selectedIds.size} rapport(s) sélectionné(s)</span>
                    <div className="flex gap-2">
                        <button onClick={handleBulkValidate} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Valider tout
                        </button>
                        <button onClick={handleBulkPublish} className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Publier tout
                        </button>
                        <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 bg-white/20 text-white text-xs font-bold rounded-lg hover:bg-white/30 transition">
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* MOBILE CARD VIEW */}
            <div className="md:hidden space-y-3">
                {filteredHistoryData.length > 0 ? (
                    filteredHistoryData.map(record => (
                        <div key={record.id} onClick={() => onEdit(record)} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 active:bg-slate-50 transition cursor-pointer">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex flex-col items-center justify-center border border-brand-100">
                                        <span className="text-xs font-bold leading-none">{toShortMonth(record.month)}</span>
                                        <span className="text-[10px] leading-none">{record.year}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{record.month} {record.year}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {record.isValidated ? 'Validé par le cabinet' : record.isSubmitted ? 'En attente de validation' : 'Brouillon'}
                                        </p>
                                    </div>
                                </div>
                                {record.isValidated ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Validé</span>
                                ) : record.isSubmitted ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">En attente</span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Brouillon</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">CA</p>
                                    <p className="font-mono font-bold text-slate-700">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.revenue.total)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Trésorerie</p>
                                    <p className={`font-mono font-bold ${record.cashFlow.treasury >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.cashFlow.treasury)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 italic">
                        Aucune donnée disponible.
                    </div>
                )}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                                {userRole === 'ab_consultant' && (
                                    <th className="p-4 w-10">
                                        <button onClick={toggleSelectAll} className="text-slate-400 hover:text-brand-600 transition">
                                            {selectedIds.size === filteredHistoryData.length && filteredHistoryData.length > 0
                                                ? <CheckSquare className="w-4 h-4 text-brand-600" />
                                                : <Square className="w-4 h-4" />
                                            }
                                        </button>
                                    </th>
                                )}
                                <th className="p-4">Période</th>
                                <th className="p-4 text-right">Chiffre d'Affaires</th>
                                <th className="p-4 text-right">Résultat / Trésorerie</th>
                                <th className="p-4 text-center">Statut</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredHistoryData.length > 0 ? (
                                filteredHistoryData.map((record) => (
                                    <tr key={record.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors group ${selectedIds.has(record.id) ? 'bg-brand-50/50' : ''}`}>
                                        {userRole === 'ab_consultant' && (
                                            <td className="p-4 w-10">
                                                <button onClick={() => toggleSelect(record.id)} className="text-slate-300 hover:text-brand-600 transition">
                                                    {selectedIds.has(record.id)
                                                        ? <CheckSquare className="w-4 h-4 text-brand-600" />
                                                        : <Square className="w-4 h-4" />
                                                    }
                                                </button>
                                            </td>
                                        )}
                                        <td className="p-4 font-medium text-slate-900 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex flex-col items-center justify-center border border-brand-100">
                                                <span className="text-xs font-bold leading-none">{toShortMonth(record.month)}</span>
                                                <span className="text-[10px] leading-none">{record.year}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono font-medium text-slate-700">
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.revenue.total)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className={`font-mono font-bold ${record.cashFlow.treasury >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.cashFlow.treasury)}
                                            </div>
                                            <div className="text-[10px] text-slate-400">Trésorerie Nette</div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {record.isValidated ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700" title="Rapport audité et validé par le cabinet">
                                                        <CheckCircle className="w-3 h-3" /> Validé
                                                    </span>
                                                ) : (
                                                    record.isSubmitted ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700" title="Données transmises, en attente de validation par le consultant">
                                                            <Clock className="w-3 h-3" /> En attente
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600" title="Brouillon modifiable, non encore transmis">
                                                            <Edit2 className="w-3 h-3" /> Brouillon
                                                        </span>
                                                    )
                                                )}
                                                {/* PUBLICATION STATUS BADGE */}
                                                {userRole === 'ab_consultant' && record.isPublished && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                                        <Eye className="w-3 h-3" /> Visible Client
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                                {/* ACTION BUTTONS */}
                                                {userRole === 'ab_consultant' ? (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                const ok = await confirm({
                                                                    title: record.isValidated ? 'Invalider le rapport ?' : 'Valider ce rapport ?',
                                                                    message: record.isValidated ? 'Le rapport redeviendra modifiable.' : 'Il sera verrouillé et visible pour validation.',
                                                                    variant: record.isValidated ? 'default' : 'success',
                                                                    confirmLabel: record.isValidated ? 'Invalider' : 'Valider',
                                                                });
                                                                if (ok) onValidate(record);
                                                            }}
                                                            className={`p-2 rounded-lg transition ${record.isValidated ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                                            title={record.isValidated ? "Invalider" : "Valider"}
                                                        >
                                                            <ShieldCheck className="w-4 h-4" />
                                                        </button>

                                                        {/* CLIENT UNLOCK BUTTON */}
                                                        {record.isSubmitted && !record.isValidated && (
                                                            <button
                                                                onClick={async () => {
                                                                    const ok = await confirm({
                                                                        title: 'Déverrouiller le rapport ?',
                                                                        message: 'Le client pourra modifier sa saisie.',
                                                                        variant: 'default',
                                                                        confirmLabel: 'Déverrouiller',
                                                                    });
                                                                    if (ok) onLockToggle(record);
                                                                }}
                                                                className="p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition"
                                                                title="Déverrouiller pour le client"
                                                            >
                                                                <Unlock className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={async () => {
                                                                const ok = await confirm({
                                                                    title: record.isPublished ? 'Masquer au client ?' : 'Publier ce rapport ?',
                                                                    message: record.isPublished ? 'Le client ne verra plus ce rapport.' : 'Le client pourra consulter ce rapport.',
                                                                    variant: 'info',
                                                                    confirmLabel: record.isPublished ? 'Masquer' : 'Publier',
                                                                });
                                                                if (ok) onPublish(record);
                                                            }}
                                                            className={`p-2 rounded-lg transition ${record.isPublished ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600'}`}
                                                            title={record.isPublished ? "Masquer au client" : "Publier au client"}
                                                        >
                                                            {record.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                        </button>

                                                        <button onClick={() => onEdit(record)} className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition" title="Modifier">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>

                                                        <button onClick={() => onDelete(record)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Supprimer">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => onEdit(record)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-xs font-bold shadow-sm flex items-center gap-1">
                                                        <Eye className="w-3 h-3" /> Voir le détail
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={userRole === 'ab_consultant' ? 6 : 5} className="p-8 text-center text-slate-400 italic">
                                        Aucune donnée disponible pour les filtres sélectionnés.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HistoryView;
