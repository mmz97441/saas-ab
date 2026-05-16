
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database, Download, CheckCircle, Clock, Edit2, ShieldCheck, Unlock, Eye, EyeOff, Trash2, CheckSquare, Square, FileSpreadsheet, MoreVertical, Lock } from 'lucide-react';
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
    onBulkDelete?: (records: FinancialRecord[]) => void;
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
    onBulkDelete,
    onImportExcel
}) => {
    const [historyYearFilter, setHistoryYearFilter] = useState<number | 'ALL'>('ALL');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const confirm = useConfirmDialog();

    // Close overflow menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

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

    const handleBulkDelete = async () => {
        if (selectedRecords.length === 0) return;
        const ok = await confirm({
            title: `Supprimer ${selectedRecords.length} rapport(s) ?`,
            message: `Cette action est irréversible. Les ${selectedRecords.length} rapports sélectionnés seront définitivement supprimés.`,
            variant: 'danger',
            confirmLabel: 'Tout supprimer',
        });
        if (!ok) return;
        if (onBulkDelete) {
            onBulkDelete(selectedRecords);
        } else {
            for (const r of selectedRecords) onDelete(r);
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
                    {userRole === 'ab_consultant' && onImportExcel && (
                        <button
                            onClick={onImportExcel}
                            title="Importer un fichier Excel multi-feuilles"
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition shadow-sm font-medium"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Import Excel
                        </button>
                    )}
                    <button
                        onClick={onExportCSV}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition shadow-sm font-medium"
                    >
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

            {/* BULK ACTION BAR (sticky) */}
            {userRole === 'ab_consultant' && selectedIds.size > 0 && (
                <div className="sticky top-0 z-20 bg-brand-50 border border-brand-200 rounded-xl shadow-sm p-3 flex items-center justify-between gap-3 mb-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-900 text-sm">
                            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline"
                        >
                            Tout désélectionner
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleBulkValidate}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm"
                        >
                            <ShieldCheck className="w-3.5 h-3.5" /> Valider
                        </button>
                        <button
                            onClick={handleBulkPublish}
                            className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition flex items-center gap-1.5 shadow-sm"
                        >
                            <Eye className="w-3.5 h-3.5" /> Publier
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 hover:border-red-300 transition flex items-center gap-1.5 shadow-sm"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer
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
                                        <span className="text-xs leading-none">{record.year}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{record.month} {record.year}</p>
                                        <p className="text-xs text-slate-400">
                                            {record.isValidated ? 'Validé par le cabinet' : record.isSubmitted ? 'En attente de validation' : 'Brouillon'}
                                            {record.submittedBy && <span className="ml-1">· par {record.submittedBy.split('@')[0]}</span>}
                                        </p>
                                    </div>
                                </div>
                                {record.isValidated ? (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Validé</span>
                                ) : record.isSubmitted ? (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">En attente</span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">Brouillon</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div>
                                    <p className="text-xs text-slate-400 uppercase font-bold">CA</p>
                                    <p className="font-mono font-bold text-slate-700">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.revenue.total)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 uppercase font-bold">Trésorerie</p>
                                    <p className={`font-mono font-bold ${record.cashFlow.treasury > 0 ? 'text-emerald-600' : record.cashFlow.treasury < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.cashFlow.treasury)}
                                    </p>
                                </div>
                            </div>

                            {/* Consultant action row */}
                            {userRole === 'ab_consultant' && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(record); }}
                                        className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition"
                                        title="Modifier"
                                        aria-label="Modifier"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>

                                    {!record.isValidated ? (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const ok = await confirm({
                                                    title: 'Valider ce rapport ?',
                                                    message: 'Il sera verrouillé et visible pour validation.',
                                                    variant: 'success',
                                                    confirmLabel: 'Valider',
                                                });
                                                if (ok) onValidate(record);
                                            }}
                                            className="p-2 rounded-lg transition bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                            title="Valider"
                                            aria-label="Valider"
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const ok = await confirm({
                                                    title: 'Redonner la main au client ?',
                                                    message: `Le rapport de ${record.month} ${record.year} sera déverrouillé. Le client pourra modifier ou compléter sa saisie.\n⚠️ Ce rapport est actuellement validé — il sera aussi dé-validé.`,
                                                    variant: 'default',
                                                    confirmLabel: 'Déverrouiller',
                                                });
                                                if (ok) onLockToggle(record);
                                            }}
                                            className="p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition"
                                            title="Redonner la main au client"
                                            aria-label="Redonner la main au client"
                                        >
                                            <Unlock className="w-4 h-4" />
                                        </button>
                                    )}

                                    <div className="relative inline-block">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `m-${record.id}` ? null : `m-${record.id}`); }}
                                            className="p-2 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 transition"
                                            title="Plus d'actions"
                                            aria-label="Plus d'actions"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {openMenuId === `m-${record.id}` && (
                                            <div ref={menuRef} className="absolute right-0 bottom-full mb-1 z-30 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 animate-in fade-in zoom-in-95 duration-150 text-left">
                                                {record.isValidated && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(null);
                                                            const ok = await confirm({
                                                                title: 'Invalider le rapport ?',
                                                                message: 'Le rapport redeviendra modifiable.',
                                                                variant: 'default',
                                                                confirmLabel: 'Invalider',
                                                            });
                                                            if (ok) onValidate(record);
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                                        Invalider
                                                    </button>
                                                )}

                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(null);
                                                        const ok = await confirm({
                                                            title: record.isPublished ? 'Masquer au client ?' : 'Publier ce rapport ?',
                                                            message: record.isPublished ? 'Le client ne verra plus ce rapport.' : 'Le client pourra consulter ce rapport.',
                                                            variant: 'info',
                                                            confirmLabel: record.isPublished ? 'Masquer' : 'Publier',
                                                        });
                                                        if (ok) onPublish(record);
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                >
                                                    {record.isPublished ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                                    {record.isPublished ? 'Dépublier' : 'Publier'}
                                                </button>

                                                {record.isSubmitted && !record.isValidated && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(null);
                                                            const ok = await confirm({
                                                                title: 'Redonner la main au client ?',
                                                                message: `Le rapport de ${record.month} ${record.year} sera déverrouillé. Le client pourra modifier ou compléter sa saisie.`,
                                                                variant: 'default',
                                                                confirmLabel: 'Déverrouiller',
                                                            });
                                                            if (ok) onLockToggle(record);
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                    >
                                                        <Unlock className="w-3.5 h-3.5 text-slate-400" />
                                                        Déverrouiller
                                                    </button>
                                                )}

                                                {!record.isSubmitted && !record.isValidated && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(null);
                                                            const ok = await confirm({
                                                                title: 'Verrouiller ce rapport ?',
                                                                message: `Le rapport de ${record.month} ${record.year} sera marqué comme transmis et ne sera plus modifiable par le client.`,
                                                                variant: 'default',
                                                                confirmLabel: 'Verrouiller',
                                                            });
                                                            if (ok) onLockToggle(record);
                                                        }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                    >
                                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                                        Verrouiller
                                                    </button>
                                                )}

                                                <div className="border-t border-slate-100 my-1" />

                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(null);
                                                        const ok = await confirm({
                                                            title: 'Supprimer ce rapport ?',
                                                            message: `Le rapport de ${record.month} ${record.year} sera définitivement supprimé. Cette action est irréversible.`,
                                                            variant: 'danger',
                                                            confirmLabel: 'Supprimer définitivement',
                                                        });
                                                        if (ok) onDelete(record);
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                    Supprimer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-10 text-center animate-in fade-in duration-300">
                        <div className="w-14 h-14 mx-auto rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mb-4">
                            <Database className="w-6 h-6 text-brand-500" />
                        </div>
                        <p className="font-semibold text-slate-700 mb-1">Aucun historique pour le moment</p>
                        <p className="text-sm text-slate-500 leading-relaxed">Les saisies mensuelles validées apparaîtront ici.</p>
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
                                                <span className="text-xs leading-none">{record.year}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono font-medium text-slate-700">
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.revenue.total)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className={`font-mono font-bold ${record.cashFlow.treasury > 0 ? 'text-emerald-600' : record.cashFlow.treasury < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(record.cashFlow.treasury)}
                                            </div>
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
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                                        <Eye className="w-3 h-3" /> Visible Client
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end items-center gap-1.5 transition-opacity">
                                                {/* ACTION BUTTONS */}
                                                {userRole === 'ab_consultant' ? (
                                                    <>
                                                        {/* Inline: Edit (always) */}
                                                        <button onClick={() => onEdit(record)} className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-100 transition" title="Modifier">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>

                                                        {/* Inline: state-aware action — Validate if pending, else Unlock if validated */}
                                                        {!record.isValidated ? (
                                                            <button
                                                                onClick={async () => {
                                                                    const ok = await confirm({
                                                                        title: 'Valider ce rapport ?',
                                                                        message: 'Il sera verrouillé et visible pour validation.',
                                                                        variant: 'success',
                                                                        confirmLabel: 'Valider',
                                                                    });
                                                                    if (ok) onValidate(record);
                                                                }}
                                                                className="p-2 rounded-lg transition bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                                                title="Valider"
                                                            >
                                                                <ShieldCheck className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={async () => {
                                                                    const ok = await confirm({
                                                                        title: 'Redonner la main au client ?',
                                                                        message: `Le rapport de ${record.month} ${record.year} sera déverrouillé. Le client pourra modifier ou compléter sa saisie.\n⚠️ Ce rapport est actuellement validé — il sera aussi dé-validé.`,
                                                                        variant: 'default',
                                                                        confirmLabel: 'Déverrouiller',
                                                                    });
                                                                    if (ok) onLockToggle(record);
                                                                }}
                                                                className="p-2 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition"
                                                                title="Redonner la main au client"
                                                            >
                                                                <Unlock className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Overflow menu: Publish/Unpublish, Lock toggle (when applicable), Delete */}
                                                        <div className="relative inline-block">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === record.id ? null : record.id); }}
                                                                className="p-2 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 transition"
                                                                title="Plus d'actions"
                                                                aria-label="Plus d'actions"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>

                                                            {openMenuId === record.id && (
                                                                <div ref={menuRef} className="absolute right-0 top-full mt-1 z-30 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 animate-in fade-in zoom-in-95 duration-150 text-left">
                                                                    {/* Validate / Invalidate when already validated (kept here as secondary action) */}
                                                                    {record.isValidated && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                setOpenMenuId(null);
                                                                                const ok = await confirm({
                                                                                    title: 'Invalider le rapport ?',
                                                                                    message: 'Le rapport redeviendra modifiable.',
                                                                                    variant: 'default',
                                                                                    confirmLabel: 'Invalider',
                                                                                });
                                                                                if (ok) onValidate(record);
                                                                            }}
                                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                                        >
                                                                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                                                            Invalider
                                                                        </button>
                                                                    )}

                                                                    {/* Publish / Unpublish */}
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            setOpenMenuId(null);
                                                                            const ok = await confirm({
                                                                                title: record.isPublished ? 'Masquer au client ?' : 'Publier ce rapport ?',
                                                                                message: record.isPublished ? 'Le client ne verra plus ce rapport.' : 'Le client pourra consulter ce rapport.',
                                                                                variant: 'info',
                                                                                confirmLabel: record.isPublished ? 'Masquer' : 'Publier',
                                                                            });
                                                                            if (ok) onPublish(record);
                                                                        }}
                                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                                    >
                                                                        {record.isPublished ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                                                                        {record.isPublished ? 'Dépublier' : 'Publier'}
                                                                    </button>

                                                                    {/* Lock toggle — only when there's something to unlock (and not already shown inline) */}
                                                                    {record.isSubmitted && !record.isValidated && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                setOpenMenuId(null);
                                                                                const ok = await confirm({
                                                                                    title: 'Redonner la main au client ?',
                                                                                    message: `Le rapport de ${record.month} ${record.year} sera déverrouillé. Le client pourra modifier ou compléter sa saisie.`,
                                                                                    variant: 'default',
                                                                                    confirmLabel: 'Déverrouiller',
                                                                                });
                                                                                if (ok) onLockToggle(record);
                                                                            }}
                                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                                        >
                                                                            <Unlock className="w-3.5 h-3.5 text-slate-400" />
                                                                            Déverrouiller
                                                                        </button>
                                                                    )}

                                                                    {!record.isSubmitted && !record.isValidated && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                setOpenMenuId(null);
                                                                                const ok = await confirm({
                                                                                    title: 'Verrouiller ce rapport ?',
                                                                                    message: `Le rapport de ${record.month} ${record.year} sera marqué comme transmis et ne sera plus modifiable par le client.`,
                                                                                    variant: 'default',
                                                                                    confirmLabel: 'Verrouiller',
                                                                                });
                                                                                if (ok) onLockToggle(record);
                                                                            }}
                                                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition text-left"
                                                                        >
                                                                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                                                                            Verrouiller
                                                                        </button>
                                                                    )}

                                                                    <div className="border-t border-slate-100 my-1" />

                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            setOpenMenuId(null);
                                                                            const ok = await confirm({
                                                                                title: 'Supprimer ce rapport ?',
                                                                                message: `Le rapport de ${record.month} ${record.year} sera définitivement supprimé. Cette action est irréversible.`,
                                                                                variant: 'danger',
                                                                                confirmLabel: 'Supprimer définitivement',
                                                                            });
                                                                            if (ok) onDelete(record);
                                                                        }}
                                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                                        Supprimer
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
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
                                    <td colSpan={userRole === 'ab_consultant' ? 6 : 5} className="p-10 text-center">
                                        <div className="flex flex-col items-center text-slate-500">
                                            <Database className="w-8 h-8 mb-3 text-slate-300" />
                                            <p className="font-semibold text-slate-700 mb-1">Aucun résultat</p>
                                            <p className="text-sm">Ajustez les filtres pour afficher des données.</p>
                                        </div>
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
