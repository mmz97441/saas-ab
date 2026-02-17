
import React, { useState, useEffect } from 'react';
import {
    Settings, Building, ShoppingBag, Droplets, PieChart, Save,
    Plus, Trash2, Percent, Power, Archive, ChevronDown, ChevronUp,
    Phone, MapPin, User, Mail, ShieldCheck
} from 'lucide-react';
import { Client, ProfitCenter } from '../types';

interface QuickConfigPanelProps {
    client: Client;
    onSaveClient: (client: Client) => Promise<void>;
    onUpdateProfitCenters: (pcs: ProfitCenter[]) => void;
    onToggleFuelModule: () => void;
    onToggleCommercialMargin: () => void;
    onUpdateClientStatus: (client: Client, status: 'active' | 'inactive') => void;
}

const QuickConfigPanel: React.FC<QuickConfigPanelProps> = ({
    client,
    onSaveClient,
    onUpdateProfitCenters,
    onToggleFuelModule,
    onToggleCommercialMargin,
    onUpdateClientStatus
}) => {
    const [expandedSection, setExpandedSection] = useState<string | null>('identity');
    const [editableClient, setEditableClient] = useState<Client>(client);
    const [profitCenters, setProfitCenters] = useState<ProfitCenter[]>(client.profitCenters || []);
    const [isSaving, setIsSaving] = useState(false);
    const [savedFeedback, setSavedFeedback] = useState(false);

    useEffect(() => {
        setEditableClient(client);
        setProfitCenters(client.profitCenters || []);
    }, [client]);

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const handleSaveIdentity = async () => {
        setIsSaving(true);
        await onSaveClient(editableClient);
        setIsSaving(false);
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
    };

    const handleSaveProfitCenters = () => {
        onUpdateProfitCenters(profitCenters);
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
    };

    const SectionHeader: React.FC<{
        id: string;
        icon: React.ReactNode;
        title: string;
        subtitle?: string;
        iconBg: string;
    }> = ({ id, icon, title, subtitle, iconBg }) => (
        <button
            onClick={() => toggleSection(id)}
            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg transition group"
        >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
                {icon}
            </div>
            <div className="flex-1 text-left">
                <h4 className="text-xs font-bold text-slate-700">{title}</h4>
                {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
            </div>
            {expandedSection === id
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
        </button>
    );

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-700">Configuration Rapide</h3>
            </div>

            {/* Feedback */}
            {savedFeedback && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-2 rounded-lg animate-in fade-in duration-200 text-center">
                    Modifications enregistrées
                </div>
            )}

            {/* === IDENTITÉ === */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <SectionHeader
                    id="identity"
                    icon={<Building className="w-4 h-4 text-brand-600" />}
                    title="Identité & Coordonnées"
                    subtitle={editableClient.companyName}
                    iconBg="bg-brand-50"
                />
                {expandedSection === 'identity' && (
                    <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Raison Sociale</label>
                                <input
                                    value={editableClient.companyName}
                                    onChange={e => setEditableClient({ ...editableClient, companyName: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg font-bold text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">SIRET</label>
                                <input
                                    value={editableClient.siret || ''}
                                    onChange={e => setEditableClient({ ...editableClient, siret: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Ville</label>
                                <input
                                    value={editableClient.city || ''}
                                    onChange={e => setEditableClient({ ...editableClient, city: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Dirigeant</label>
                                <input
                                    value={editableClient.managerName || ''}
                                    onChange={e => setEditableClient({ ...editableClient, managerName: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile</label>
                                <input
                                    value={editableClient.managerPhone || ''}
                                    onChange={e => setEditableClient({ ...editableClient, managerPhone: e.target.value })}
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 focus:ring-1 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> Email Client
                                </label>
                                <input
                                    value={editableClient.owner?.email || ''}
                                    disabled
                                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-400 bg-slate-50 cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSaveIdentity}
                            disabled={isSaving}
                            className="w-full py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <Save className="w-3 h-3" /> {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                )}
            </div>

            {/* === MODULES === */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <SectionHeader
                    id="modules"
                    icon={<PieChart className="w-4 h-4 text-purple-600" />}
                    title="Modules Actifs"
                    subtitle={`${[client.settings?.showCommercialMargin && 'Marge', client.settings?.showFuelTracking && 'Carburant'].filter(Boolean).join(', ') || 'Aucun'}`}
                    iconBg="bg-purple-50"
                />
                {expandedSection === 'modules' && (
                    <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                        {/* Marge Toggle */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50/50">
                            <div className="flex items-center gap-2">
                                <PieChart className="w-3.5 h-3.5 text-purple-600" />
                                <span className="text-xs font-bold text-slate-700">Marge Commerciale</span>
                            </div>
                            <button
                                onClick={onToggleCommercialMargin}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${client.settings?.showCommercialMargin ? 'bg-purple-600' : 'bg-slate-200'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${client.settings?.showCommercialMargin ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                            </button>
                        </div>

                        {/* Carburant Toggle */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50">
                            <div className="flex items-center gap-2">
                                <Droplets className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-xs font-bold text-slate-700">Suivi Carburant</span>
                            </div>
                            <button
                                onClick={onToggleFuelModule}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${client.settings?.showFuelTracking ? 'bg-blue-600' : 'bg-slate-200'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${client.settings?.showFuelTracking ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* === CENTRES DE PROFIT === */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <SectionHeader
                    id="profitCenters"
                    icon={<ShoppingBag className="w-4 h-4 text-indigo-600" />}
                    title="Ventilation Analytique"
                    subtitle={`${profitCenters.length} activité${profitCenters.length !== 1 ? 's' : ''}`}
                    iconBg="bg-indigo-50"
                />
                {expandedSection === 'profitCenters' && (
                    <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                        {profitCenters.map(pc => (
                            <div key={pc.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                                <input
                                    value={pc.name}
                                    onChange={e => setProfitCenters(prev => prev.map(p => p.id === pc.id ? { ...p, name: e.target.value } : p))}
                                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                                <select
                                    value={pc.type}
                                    onChange={e => setProfitCenters(prev => prev.map(p => p.id === pc.id ? { ...p, type: e.target.value as 'goods' | 'services' } : p))}
                                    className="px-1 py-1 text-[10px] border border-slate-200 rounded text-slate-600 bg-white"
                                >
                                    <option value="goods">March.</option>
                                    <option value="services">Serv.</option>
                                </select>
                                <button
                                    onClick={() => setProfitCenters(prev => prev.filter(p => p.id !== pc.id))}
                                    className="p-1 text-slate-300 hover:text-red-500 transition"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={() => setProfitCenters([...profitCenters, { id: `pc_${Date.now()}`, name: 'Nouvelle Activité', type: 'goods', defaultMargin: 0 }])}
                            className="w-full py-1.5 border border-dashed border-indigo-200 text-indigo-600 text-[10px] font-bold rounded-lg hover:bg-indigo-50 transition flex items-center justify-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Ajouter
                        </button>

                        <button
                            onClick={handleSaveProfitCenters}
                            className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-1.5"
                        >
                            <Save className="w-3 h-3" /> Enregistrer la structure
                        </button>
                    </div>
                )}
            </div>

            {/* === STATUT === */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <SectionHeader
                    id="status"
                    icon={<Power className="w-4 h-4 text-amber-600" />}
                    title="Statut Dossier"
                    subtitle={client.status === 'active' ? 'Actif (En production)' : 'Archivé (En veille)'}
                    iconBg="bg-amber-50"
                />
                {expandedSection === 'status' && (
                    <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
                        <button
                            onClick={() => onUpdateClientStatus(client, client.status === 'active' ? 'inactive' : 'active')}
                            className={`w-full py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                                client.status === 'active'
                                    ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            }`}
                        >
                            {client.status === 'active' ? (
                                <><Archive className="w-3 h-3" /> Mettre en veille</>
                            ) : (
                                <><Power className="w-3 h-3" /> Réactiver le dossier</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickConfigPanel;
