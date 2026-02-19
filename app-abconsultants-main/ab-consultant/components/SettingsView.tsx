
import React, { useState, useEffect } from 'react';
import { Settings, Building, Lock, ShoppingBag, Plus, Trash2, Save, Droplets, AlertTriangle, Power, MapPin, Phone, Percent, PieChart, ChevronDown, Calendar } from 'lucide-react';
import { Client, ProfitCenter } from '../types';
import { useConfirmDialog } from '../contexts/ConfirmContext';

const LEGAL_FORMS = [
    '', 'SAS', 'SASU', 'SARL', 'EURL', 'SA', 'SNC', 'SCI', 'SCOP',
    'Auto-entrepreneur', 'Micro-entreprise', 'EI', 'EIRL', 'Association', 'Autre'
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = [
    { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' }, { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' }, { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' }, { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

export interface ClientAdminFields {
    companyName: string;
    siret: string;
    companyPhone: string;
    legalForm: string;
    fiscalYearEnd: string;
    address: string;
    zipCode: string;
    city: string;
    managerName: string;
    managerPhone: string;
}

interface SettingsViewProps {
    client: Client;
    onUpdateClientSettings: (fields: ClientAdminFields) => void;
    onUpdateProfitCenters: (pcs: ProfitCenter[]) => void;
    onUpdateFuelObjectives: (objectives: { gasoil: number, sansPlomb: number, gnr: number }) => void;
    onUpdateClientStatus: (client: Client, newStatus: 'active' | 'inactive') => void;
    onResetDatabase: () => void;
    onToggleFuelModule: () => void;
    onToggleCommercialMargin: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    client,
    onUpdateClientSettings,
    onUpdateProfitCenters,
    onUpdateFuelObjectives,
    onUpdateClientStatus,
    onResetDatabase,
    onToggleFuelModule,
    onToggleCommercialMargin
}) => {
    const confirm = useConfirmDialog();
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [settingsProfitCenters, setSettingsProfitCenters] = useState<ProfitCenter[]>(client.profitCenters || []);
    const [settingsFuelObjectives, setSettingsFuelObjectives] = useState(client.settings?.fuelObjectives || { gasoil: 0, sansPlomb: 0, gnr: 0 });

    // Controlled form state for admin fields
    const buildFormValues = (c: Client): ClientAdminFields => ({
        companyName: c.companyName || '',
        siret: c.siret || '',
        companyPhone: c.companyPhone || '',
        legalForm: c.legalForm || '',
        fiscalYearEnd: c.fiscalYearEnd || '',
        address: c.address || '',
        zipCode: c.zipCode || '',
        city: c.city || '',
        managerName: c.managerName || '',
        managerPhone: c.managerPhone || '',
    });
    const [formValues, setFormValues] = useState<ClientAdminFields>(buildFormValues(client));

    // Sync ALL local state when client changes (navigation or after save)
    useEffect(() => {
        setSettingsProfitCenters(client.profitCenters || []);
        setSettingsFuelObjectives(client.settings?.fuelObjectives || { gasoil: 0, sansPlomb: 0, gnr: 0 });
        setFormValues(buildFormValues(client));
        setIsEditingSettings(false);
    }, [client]);

    // Profit Center Handlers
    const handleAddProfitCenter = () => {
        const newId = `pc_${Date.now()}`;
        setSettingsProfitCenters([...settingsProfitCenters, { id: newId, name: 'Nouvelle Activité', type: 'goods', defaultMargin: 0 }]);
    };

    const handleUpdateProfitCenter = (id: string, field: keyof ProfitCenter, value: any) => {
        setSettingsProfitCenters(prev => prev.map(pc => pc.id === id ? { ...pc, [field]: value } : pc));
    };

    const handleRemoveProfitCenter = async (id: string) => {
        const ok = await confirm({ title: 'Supprimer cette activité ?', message: 'Elle sera retirée de la ventilation analytique.', variant: 'danger', confirmLabel: 'Supprimer' });
        if (!ok) return;
        setSettingsProfitCenters(prev => prev.filter(pc => pc.id !== id));
    };

    // Form field change handler
    const handleFieldChange = (field: keyof ClientAdminFields, value: string) => {
        setFormValues(prev => ({ ...prev, [field]: value }));
    };

    // Handler Wrappers
    const handleSaveClientForm = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const snapshot = { ...formValues };
        const ok = await confirm({ title: 'Modifier les informations ?', message: 'Les informations administratives du dossier seront mises à jour.', confirmLabel: 'Enregistrer' });
        if (!ok) return;
        onUpdateClientSettings(snapshot);
        setIsEditingSettings(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="w-6 h-6 text-brand-500" />
                        Configuration Dossier
                    </h2>
                    <p className="text-slate-500">Paramètres administratifs et analytiques de {client.companyName}</p>
                </div>
            </div>

            {/* 1. FICHE ADMINISTRATIVE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Building className="w-4 h-4" /> Identité & Coordonnées
                    </h3>
                    <button
                        onClick={() => setIsEditingSettings(!isEditingSettings)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${isEditingSettings ? 'bg-slate-200 text-slate-600' : 'bg-brand-100 text-brand-700'}`}
                    >
                        {isEditingSettings ? 'Annuler' : 'Modifier'}
                    </button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSaveClientForm}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* Company Info */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Société</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Raison Sociale</label>
                                    <input value={formValues.companyName} onChange={(e) => handleFieldChange('companyName', e.target.value)} disabled={!isEditingSettings} className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SIRET</label>
                                    <input value={formValues.siret} onChange={(e) => handleFieldChange('siret', e.target.value)} disabled={!isEditingSettings} className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone Standard</label>
                                    <div className="relative">
                                        <Phone className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
                                        <input value={formValues.companyPhone} onChange={(e) => handleFieldChange('companyPhone', e.target.value)} disabled={!isEditingSettings} className="w-full pl-8 p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forme Juridique</label>
                                        <div className="relative">
                                            <select
                                                value={formValues.legalForm}
                                                onChange={(e) => handleFieldChange('legalForm', e.target.value)}
                                                disabled={!isEditingSettings}
                                                className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500 appearance-none pr-8"
                                            >
                                                <option value="">-- Choisir --</option>
                                                {LEGAL_FORMS.filter(f => f !== '').map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clôture Exercice</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <select
                                                    value={formValues.fiscalYearEnd.split('/')[0] || ''}
                                                    onChange={(e) => {
                                                        const month = formValues.fiscalYearEnd.split('/')[1] || '';
                                                        handleFieldChange('fiscalYearEnd', e.target.value && month ? `${e.target.value}/${month}` : e.target.value ? `${e.target.value}/` : '');
                                                    }}
                                                    disabled={!isEditingSettings}
                                                    className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500 appearance-none pr-8"
                                                >
                                                    <option value="">Jour</option>
                                                    {DAYS.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                                <Calendar className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                            <div className="relative flex-[2]">
                                                <select
                                                    value={formValues.fiscalYearEnd.split('/')[1] || ''}
                                                    onChange={(e) => {
                                                        const day = formValues.fiscalYearEnd.split('/')[0] || '';
                                                        handleFieldChange('fiscalYearEnd', day && e.target.value ? `${day}/${e.target.value}` : e.target.value ? `/${e.target.value}` : day ? `${day}/` : '');
                                                    }}
                                                    disabled={!isEditingSettings}
                                                    className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500 appearance-none pr-8"
                                                >
                                                    <option value="">Mois</option>
                                                    {MONTHS.map(m => (
                                                        <option key={m.value} value={m.value}>{m.label}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Info & Address */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Coordonnées</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adresse Complète</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
                                        <input value={formValues.address} onChange={(e) => handleFieldChange('address', e.target.value)} disabled={!isEditingSettings} placeholder="Rue, ZI..." className="w-full pl-8 p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code Postal</label>
                                        <input value={formValues.zipCode} onChange={(e) => handleFieldChange('zipCode', e.target.value)} disabled={!isEditingSettings} className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ville</label>
                                        <input value={formValues.city} onChange={(e) => handleFieldChange('city', e.target.value)} disabled={!isEditingSettings} className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                    </div>
                                </div>

                                <div className="pt-2"></div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-1">Dirigeant</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Dirigeant</label>
                                    <input value={formValues.managerName} onChange={(e) => handleFieldChange('managerName', e.target.value)} disabled={!isEditingSettings} className="w-full p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile</label>
                                    <div className="relative">
                                        <Phone className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
                                        <input value={formValues.managerPhone} onChange={(e) => handleFieldChange('managerPhone', e.target.value)} disabled={!isEditingSettings} className="w-full pl-8 p-2 border rounded bg-slate-50 disabled:text-slate-500" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {isEditingSettings && (
                            <div className="mt-6 flex justify-end">
                                <button type="submit" className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-bold shadow-sm transition">
                                    Enregistrer les modifications
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* 2.5 MODULE MARGE CONFIG */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                    <h3 className="font-bold text-purple-900 flex items-center gap-2">
                        <PieChart className="w-4 h-4" /> Suivi Marge Commerciale
                    </h3>
                    <button
                        onClick={async () => {
                            const ok = await confirm({ title: client.settings?.showCommercialMargin ? 'Désactiver la marge ?' : 'Activer la marge ?', message: client.settings?.showCommercialMargin ? 'Le suivi de la marge commerciale sera désactivé.' : 'La marge commerciale sera calculée et analysée dans les rapports.', variant: 'info', confirmLabel: client.settings?.showCommercialMargin ? 'Désactiver' : 'Activer' });
                            if (ok) onToggleCommercialMargin();
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${client.settings?.showCommercialMargin ? 'bg-purple-600' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${client.settings?.showCommercialMargin ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                {client.settings?.showCommercialMargin && (
                    <div className="p-6 text-sm text-slate-500">
                         Ce module est actif. La marge commerciale sera calculée (CA - Achats) et analysée dans les rapports.
                    </div>
                )}
                 {!client.settings?.showCommercialMargin && (
                    <div className="p-6 text-sm text-slate-400 italic">
                         Module désactivé. Seul le Chiffre d'Affaires sera suivi.
                    </div>
                )}
            </div>

            {/* 2. CENTRES DE PROFIT CONFIG */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" /> Ventilation Analytique
                    </h3>
                    <button
                        onClick={handleAddProfitCenter}
                        className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 font-bold transition flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" /> Ajouter une activité
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-500 mb-4">
                        Définissez les familles (centres de profit) pour ventiler le Chiffre d'Affaires
                        {client.settings?.showCommercialMargin && " et la Marge"}.
                    </p>

                    <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-slate-400 px-2">
                            <div className="col-span-5">Nom de l'Activité</div>
                            <div className="col-span-3">Type</div>
                            <div className="col-span-3">Marge Théorique (%)</div>
                            <div className="col-span-1">Action</div>
                        </div>

                        {settingsProfitCenters.length > 0 ? (
                            settingsProfitCenters.map((pc) => (
                                <div key={pc.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="col-span-5">
                                        <input
                                            value={pc.name}
                                            onChange={(e) => handleUpdateProfitCenter(pc.id, 'name', e.target.value)}
                                            placeholder="Ex: Transport Frigo"
                                            className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm font-bold text-slate-700"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <select
                                            value={pc.type}
                                            onChange={(e) => handleUpdateProfitCenter(pc.id, 'type', e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-700"
                                        >
                                            <option value="goods">Marchandise</option>
                                            <option value="services">Service</option>
                                        </select>
                                    </div>
                                    <div className="col-span-3 relative">
                                        <input
                                            type="number"
                                            value={pc.defaultMargin || 0}
                                            onChange={(e) => handleUpdateProfitCenter(pc.id, 'defaultMargin', parseFloat(e.target.value))}
                                            placeholder="0"
                                            disabled={!client.settings?.showCommercialMargin}
                                            className="w-full bg-white border border-slate-300 rounded pl-2 pr-6 py-1.5 text-sm font-bold text-purple-700 disabled:text-slate-400 disabled:bg-slate-100"
                                        />
                                        <Percent className="w-3 h-3 text-slate-400 absolute right-2 top-2.5" />
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <button
                                            onClick={() => handleRemoveProfitCenter(pc.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 transition hover:bg-red-50 rounded"
                                            title="Supprimer cette activité"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                                Aucune activité configurée. Le CA sera saisi globalement sans ventilation.
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={async () => {
                                const ok = await confirm({ title: 'Enregistrer la structure ?', message: 'La ventilation analytique sera mise à jour pour ce dossier.', variant: 'success', confirmLabel: 'Enregistrer' });
                                if (ok) onUpdateProfitCenters(settingsProfitCenters);
                            }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold shadow-sm transition flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Enregistrer la structure analytique
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. MODULE CARBURANT CONFIG */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                        <Droplets className="w-4 h-4" /> Suivi Carburant
                    </h3>
                    <button
                        onClick={async () => {
                            const ok = await confirm({ title: client.settings?.showFuelTracking ? 'Désactiver le carburant ?' : 'Activer le carburant ?', message: client.settings?.showFuelTracking ? 'Le module de suivi carburant sera désactivé.' : 'Le suivi de consommation carburant sera activé pour ce dossier.', variant: 'info', confirmLabel: client.settings?.showFuelTracking ? 'Désactiver' : 'Activer' });
                            if (ok) onToggleFuelModule();
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${client.settings?.showFuelTracking ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${client.settings?.showFuelTracking ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                {client.settings?.showFuelTracking && (
                    <div className="p-6">
                        <p className="text-sm text-slate-500 mb-4">
                            Définissez les objectifs mensuels de consommation (en Litres) pour ce client.
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Obj. Gasoil (L)</label>
                                <input
                                    type="number"
                                    value={settingsFuelObjectives.gasoil}
                                    onChange={(e) => setSettingsFuelObjectives({ ...settingsFuelObjectives, gasoil: parseFloat(e.target.value) || 0 })}
                                    className="w-full p-2 border border-slate-300 rounded font-bold text-blue-900"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Obj. SP (L)</label>
                                <input
                                    type="number"
                                    value={settingsFuelObjectives.sansPlomb}
                                    onChange={(e) => setSettingsFuelObjectives({ ...settingsFuelObjectives, sansPlomb: parseFloat(e.target.value) || 0 })}
                                    className="w-full p-2 border border-slate-300 rounded font-bold text-blue-900"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1">Obj. GNR (L)</label>
                                <input
                                    type="number"
                                    value={settingsFuelObjectives.gnr}
                                    onChange={(e) => setSettingsFuelObjectives({ ...settingsFuelObjectives, gnr: parseFloat(e.target.value) || 0 })}
                                    className="w-full p-2 border border-slate-300 rounded font-bold text-blue-900"
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={async () => {
                                    const ok = await confirm({ title: 'Mettre à jour les objectifs ?', message: 'Les objectifs mensuels de consommation seront modifiés.', confirmLabel: 'Mettre à jour' });
                                    if (ok) onUpdateFuelObjectives(settingsFuelObjectives);
                                }}
                                className="text-xs font-bold text-blue-700 hover:bg-blue-50 px-3 py-2 rounded transition border border-transparent hover:border-blue-100"
                            >
                                Mettre à jour les objectifs
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* DANGER ZONE */}
            <div className="pt-8 mt-8 border-t border-slate-200">
                <h4 className="text-sm font-bold text-red-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Zone de danger
                </h4>

                <div className="flex gap-4">
                    {/* STATUS TOGGLE BUTTON */}
                    <button
                        onClick={() => {
                            // La confirmation est gérée par la Modale dans App.tsx, c'est OK.
                            const newStatus = client.status === 'inactive' ? 'active' : 'inactive';
                            onUpdateClientStatus(client, newStatus);
                        }}
                        className={`px-4 py-2 border rounded-lg text-sm font-bold transition flex items-center gap-2 ${client.status === 'inactive'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                    >
                        <Power className="w-4 h-4" />
                        {client.status === 'inactive' ? 'Réactiver le dossier' : 'Mettre en veille (Archiver)'}
                    </button>

                    {/* RESET DB BUTTON */}
                    <button
                        onClick={onResetDatabase}
                        className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-bold transition flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" /> Réinitialiser TOUTE la base
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
