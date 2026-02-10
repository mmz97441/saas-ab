
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FinancialRecord, Month, ProfitCenter } from '../types';
import { Save, Lock, Calendar, HelpCircle, ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, Landmark, ShoppingBag, Target, PieChart, Droplets, Users, Clock, Calculator, Scale, Briefcase, ArrowRight, Truck, Percent, Sigma, CheckCircle, History, AlertTriangle, ShieldAlert, Upload, FileText } from 'lucide-react';
import { MONTH_ORDER } from '../services/dataService';

const DEFINITIONS = {
  revenue: "Chiffre d'Affaires Hors Taxe facturé sur la période.",
  margin: "Marge commerciale brute (Ventes - Achats consommés).",
  salaries: "Salaires bruts + Charges patronales + Intérim.",
  bfr: "Besoin en Fonds de Roulement : (Créances Clients + Stocks) - Dettes Fournisseurs/Fiscales/Sociales.",
  treasuryPositive: "Soldes créditeurs bancaires + placements disponibles.",
  treasuryNegative: "Soldes débiteurs bancaires + découverts + concours bancaires.",
  fuel: "Litrage total consommé sur la période (Gasoil + SP + GNR)."
};

// --- HELPERS ---
const formatForDisplay = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0';
    // Format français : espace pour milliers, max 2 décimales
    return new Intl.NumberFormat('fr-FR', { 
        maximumFractionDigits: 2,
        minimumFractionDigits: 0 
    }).format(val);
};

// --- SMART INPUT COMPONENTS ---
// (Les composants SmartNumberInput, SmartBigInput, etc. restent inchangés ici, je les inclus pour le contexte mais ils sont identiques)
const SmartNumberInput = ({ 
    label, 
    value, 
    onChange, 
    className = "", 
    disabled = false, 
    definition,
    prefix,
    suffix = "€",
    placeholder = "0",
    n1Value,
    icon: Icon
}: any) => {
    const [isFocused, setIsFocused] = useState(false);

    // Calculate variation
    let variation = null;
    let varColor = "text-slate-400";
    if (n1Value !== undefined && n1Value !== null && n1Value !== 0) {
        const val = value || 0;
        variation = ((val - n1Value) / n1Value) * 100;
        if (variation > 0) varColor = "text-emerald-600";
        if (variation < 0) varColor = "text-red-500";
    }

    return (
        <div className={`flex flex-col gap-1.5 ${disabled ? 'opacity-90' : ''}`}>
            <div className="flex justify-between items-end">
                <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5 truncate max-w-full">
                    {Icon && <Icon className="w-3 h-3 text-slate-400" />}
                    {label}
                    {definition && (
                        <div className="group relative">
                            <div title={definition} className="cursor-help">
                                 <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-brand-600 transition-colors" />
                            </div>
                        </div>
                    )}
                </label>
            </div>
            
            <div className="flex items-stretch gap-0 border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all bg-white shadow-sm hover:border-brand-300">
                {/* Main Input */}
                <div className="relative flex-1 group">
                    {prefix && <div className="absolute left-3 top-2.5 pointer-events-none font-bold text-slate-600">{prefix}</div>}
                    <input
                        type={isFocused ? "number" : "text"}
                        value={isFocused ? (value === 0 ? '' : value) : formatForDisplay(value)}
                        onChange={(e) => {
                            // Only parse if focused (raw input), otherwise ignore (it's display)
                            const rawValue = e.target.value.replace(',', '.'); // Allow comma as decimal separator
                            const val = rawValue === '' ? 0 : parseFloat(rawValue);
                            if (!isNaN(val)) onChange(val);
                        }}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        disabled={disabled}
                        placeholder={placeholder}
                        className={`w-full h-full bg-white text-sm font-bold text-slate-900 py-2.5 px-3 outline-none disabled:bg-slate-50 disabled:text-slate-600 ${className} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''}`}
                    />
                    {suffix && <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold pointer-events-none">{suffix}</span>}
                </div>

                {/* N-1 Comparison Column */}
                {n1Value !== undefined && (
                    <div className="flex flex-col justify-center px-3 border-l border-slate-100 bg-slate-50 min-w-[80px] text-right" title={`Valeur N-1 : ${formatForDisplay(n1Value)}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">N-1</span>
                        <div className="text-xs font-bold text-slate-600">
                            {formatForDisplay(n1Value)}
                        </div>
                        {variation !== null && (
                            <span className={`text-[9px] font-bold ${varColor}`}>
                                {variation > 0 ? '+' : ''}{variation.toFixed(0)}%
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// 2. Big Header Input (For CA Global & Margin Global)
const SmartBigInput = ({ value, onChange, disabled, placeholder = "0 €", colorClass = "text-brand-700", borderColorClass = "border-brand-200" }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    
    return (
        <input 
            type={isFocused ? "number" : "text"}
            value={isFocused ? (value === 0 ? '' : value) : formatForDisplay(value)}
            onChange={(e) => {
                const rawValue = e.target.value.replace(',', '.');
                const val = rawValue === '' ? 0 : parseFloat(rawValue);
                if (!isNaN(val)) onChange(val);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            className={`text-2xl font-bold ${colorClass} bg-transparent text-center border-b-2 ${borderColorClass} focus:border-brand-500 focus:outline-none w-36 placeholder-slate-300 transition-all`}
            placeholder={placeholder}
        />
    );
};

// 3. Table Row Input (For Profit Centers)
const SmartTableInput = ({ value, onChange, disabled, placeholder = "0", align = "right" }: any) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <input 
            type={isFocused ? "number" : "text"}
            value={isFocused ? (value === 0 ? '' : value) : formatForDisplay(value)}
            onChange={(e) => {
                const rawValue = e.target.value.replace(',', '.');
                const val = rawValue === '' ? 0 : parseFloat(rawValue);
                if (!isNaN(val)) onChange(val);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-full text-sm font-bold text-${align} py-2 px-2 focus:ring-2 focus:ring-brand-500 outline-none text-slate-700 disabled:bg-slate-50 bg-transparent border-transparent hover:border-slate-200 border rounded transition-all`}
        />
    );
};


// Reusable Layout Components
const SectionCard = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:p-8 transition-all hover:shadow-md ${className}`}>
        {children}
    </div>
);

const SectionHeader = ({ number, title, icon: Icon, colorClass = "text-brand-700", bgClass = "bg-brand-100" }: any) => (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className={`w-8 h-8 rounded-lg ${bgClass} ${colorClass} flex items-center justify-center text-sm font-bold shadow-sm`}>
            {number}
        </div>
        <h3 className={`text-lg font-bold ${colorClass} flex items-center gap-2`}>
            <Icon className="w-5 h-5 opacity-80" />
            {title}
        </h3>
    </div>
);

const ResultCard = ({ label, value, subtext, icon: Icon, colorClass, bgClass }: any) => (
    <div className={`relative p-5 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center text-center h-full ${bgClass} ${colorClass} border-current border-opacity-30`}>
        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center mb-3 shadow-sm backdrop-blur-sm">
            <Icon className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-90">{label}</span>
        <div className="text-2xl font-extrabold tracking-tight mb-1">
            {value}
        </div>
        {subtext && <div className="text-[11px] font-semibold opacity-80">{subtext}</div>}
    </div>
);

interface EntryFormProps {
  clientId: string;
  initialData: FinancialRecord | null;
  existingRecords: FinancialRecord[];
  profitCenters?: ProfitCenter[];
  onSave: (record: FinancialRecord) => void;
  onCancel: () => void;
  showCommercialMargin: boolean;
  showFuelTracking: boolean;
  userRole: 'ab_consultant' | 'client';
  defaultFuelObjectives?: { gasoil: number; sansPlomb: number; gnr: number };
  clientStatus?: 'active' | 'inactive';
}

const EntryForm: React.FC<EntryFormProps> = ({
  clientId,
  initialData,
  existingRecords,
  profitCenters = [],
  onSave,
  onCancel,
  showCommercialMargin,
  showFuelTracking,
  userRole,
  defaultFuelObjectives,
  clientStatus = 'active'
}) => {
    
    // --- STATE INITIALIZATION ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<FinancialRecord>(() => {
        if (initialData) return JSON.parse(JSON.stringify(initialData));
        
        const now = new Date();
        let mIndex = now.getMonth() - 1;
        let year = now.getFullYear();
        if (mIndex < 0) {
            mIndex = 11;
            year = year - 1;
        }
        
        const defaultMonth = Object.values(Month)[mIndex] as Month;
        const fuelObjs = defaultFuelObjectives || { gasoil: 0, sansPlomb: 0, gnr: 0 };
        const totalFuelObj = (fuelObjs.gasoil || 0) + (fuelObjs.sansPlomb || 0) + (fuelObjs.gnr || 0);

        return {
            id: `${clientId}-${year}-${defaultMonth}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            clientId,
            year,
            month: defaultMonth,
            isValidated: false,
            isPublished: false,
            revenue: { goods: 0, services: 0, total: 0, objective: 0, breakdown: {} },
            fuel: { 
                volume: 0, 
                objective: totalFuelObj, 
                details: { 
                    gasoil: { volume: 0, objective: fuelObjs.gasoil || 0 }, 
                    sansPlomb: { volume: 0, objective: fuelObjs.sansPlomb || 0 }, 
                    gnr: { volume: 0, objective: fuelObjs.gnr || 0 } 
                } 
            },
            margin: { rate: 0, total: 0, breakdown: {} },
            expenses: { salaries: 0, hoursWorked: 0, overtimeHours: 0 },
            bfr: {
                receivables: { clients: 0, state: 0, social: 0, other: 0, total: 0 },
                stock: { goods: 0, floating: 0, total: 0 },
                debts: { suppliers: 0, state: 0, social: 0, salaries: 0, other: 0, total: 0 },
                total: 0
            },
            cashFlow: { active: 0, passive: 0, treasury: 0 }
        };
    });

    // --- AUTO-LOAD DATA LOGIC ---
    useEffect(() => {
        const match = existingRecords.find(r => r.year === formData.year && r.month === formData.month);
        
        if (match) {
            setFormData(prev => ({
                ...JSON.parse(JSON.stringify(match))
            }));
        } else {
            const fuelObjs = defaultFuelObjectives || { gasoil: 0, sansPlomb: 0, gnr: 0 };
            const totalFuelObj = (fuelObjs.gasoil || 0) + (fuelObjs.sansPlomb || 0) + (fuelObjs.gnr || 0);

            setFormData(prev => ({
                id: `${clientId}-${prev.year}-${prev.month}-${Date.now()}`,
                clientId,
                year: prev.year,
                month: prev.month,
                isValidated: false,
                isPublished: false,
                isSubmitted: false,
                revenue: { goods: 0, services: 0, total: 0, objective: 0, breakdown: {} },
                fuel: { 
                    volume: 0, 
                    objective: totalFuelObj, 
                    details: { 
                        gasoil: { volume: 0, objective: fuelObjs.gasoil || 0 }, 
                        sansPlomb: { volume: 0, objective: fuelObjs.sansPlomb || 0 }, 
                        gnr: { volume: 0, objective: fuelObjs.gnr || 0 } 
                    } 
                },
                margin: { rate: 0, total: 0, breakdown: {} },
                expenses: { salaries: 0, hoursWorked: 0, overtimeHours: 0 },
                bfr: {
                    receivables: { clients: 0, state: 0, social: 0, other: 0, total: 0 },
                    stock: { goods: 0, floating: 0, total: 0 },
                    debts: { suppliers: 0, state: 0, social: 0, salaries: 0, other: 0, total: 0 },
                    total: 0
                },
                cashFlow: { active: 0, passive: 0, treasury: 0 }
            }));
        }
    }, [formData.year, formData.month, existingRecords, clientId, defaultFuelObjectives]);

    // CHECK IF CLIENT IS INACTIVE
    const isClientInactive = clientStatus === 'inactive';
    const isLocked = userRole === 'client' && (formData.isValidated || formData.isSubmitted || isClientInactive);
    const isAdminOverride = userRole === 'ab_consultant' && (formData.isValidated || formData.isSubmitted || isClientInactive);

    const comparisonRecord = useMemo(() => {
        return existingRecords.find(r => r.year === formData.year - 1 && r.month === formData.month);
    }, [existingRecords, formData.year, formData.month]);

    const detailTotals = useMemo(() => {
        let totalCA = 0;
        let totalMargin = 0;

        profitCenters.forEach(pc => {
            totalCA += (formData.revenue.breakdown?.[pc.id] || 0);
            totalMargin += (formData.margin?.breakdown?.[pc.id] || 0);
        });

        return {
            ca: totalCA,
            margin: totalMargin,
            rate: totalCA > 0 ? (totalMargin / totalCA) * 100 : 0
        };
    }, [formData.revenue.breakdown, formData.margin?.breakdown, profitCenters]);

    // --- IMPORT CSV HANDLER ---
    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n');
            let matched = false;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(';');
                if (cols.length < 3) continue;

                const csvYear = parseInt(cols[0]);
                const rawMonth = cols[1];
                let csvMonth: Month | undefined;

                if (!isNaN(parseInt(rawMonth))) {
                    const monthIndex = parseInt(rawMonth) - 1;
                    csvMonth = Object.values(Month)[monthIndex];
                } else {
                    csvMonth = Object.values(Month).find(m => m.toLowerCase() === rawMonth.toLowerCase().trim());
                }

                if (csvYear === formData.year && csvMonth === formData.month) {
                    const caTotal = parseFloat(cols[2]) || 0;
                    const salaires = parseFloat(cols[3]) || 0;
                    const bfrTotal = parseFloat(cols[4]) || 0;
                    const tresorerie = parseFloat(cols[5]) || 0;

                    setFormData(prev => ({
                        ...prev,
                        revenue: {
                            ...prev.revenue,
                            total: caTotal,
                            services: caTotal,
                            goods: 0,
                        },
                        expenses: {
                            ...prev.expenses,
                            salaries: salaires,
                        },
                        bfr: {
                            ...prev.bfr,
                            receivables: {
                                ...prev.bfr.receivables,
                                clients: bfrTotal,
                            },
                            total: bfrTotal,
                        },
                        cashFlow: {
                            active: tresorerie >= 0 ? tresorerie : 0,
                            passive: tresorerie < 0 ? Math.abs(tresorerie) : 0,
                            treasury: tresorerie,
                        },
                    }));
                    
                    matched = true;
                    alert(`Données importées pour ${csvMonth} ${csvYear} !`);
                    break;
                }
            }

            if (!matched) {
                alert(`Aucune donnée trouvée dans le fichier pour ${formData.month} ${formData.year}.`);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const handleChange = (section: keyof FinancialRecord, field: string, value: any, subField?: string) => {
        setFormData(prev => {
            const newData = { ...prev };
            if (section === 'expenses' || section === 'cashFlow') {
                 // @ts-ignore
                 newData[section] = { ...newData[section], [field]: value };
            } else if (section === 'bfr') {
                 // @ts-ignore
                 newData[section] = { ...newData[section], [field]: { ...newData[section][field], [subField!]: value } };
            } else if (section === 'fuel') {
                 if (subField) {
                     // @ts-ignore
                     newData.fuel.details = { ...newData.fuel.details, [field]: { ...newData.fuel.details[field], [subField]: value } };
                 } else {
                     // @ts-ignore
                     newData.fuel[field] = value;
                 }
            } else if (section === 'revenue' && (field === 'goods' || field === 'services' || field === 'objective' || field === 'total')) {
                // @ts-ignore
                newData.revenue[field] = value;
            } else if (section === 'margin' && (field === 'total')) {
                // @ts-ignore
                newData.margin.total = value;
            }

            if (section === 'fuel' && subField) {
                 // @ts-ignore
                 const d = newData.fuel.details;
                 newData.fuel.volume = (d.gasoil?.volume || 0) + (d.sansPlomb?.volume || 0) + (d.gnr?.volume || 0);
            }
            if (section === 'bfr') {
                const r = newData.bfr.receivables;
                r.total = r.clients + r.state + r.social + r.other;
                const s = newData.bfr.stock;
                s.total = s.goods + s.floating;
                const d = newData.bfr.debts;
                d.total = d.suppliers + d.state + d.social + d.salaries + d.other;
                newData.bfr.total = r.total + s.total - d.total;
            }
            if (section === 'cashFlow') {
                newData.cashFlow.treasury = newData.cashFlow.active - newData.cashFlow.passive;
            }
            if ((section === 'margin' && field === 'total') || (section === 'revenue' && field === 'total')) {
                const rev = newData.revenue.total || 0;
                const marg = newData.margin?.total || 0;
                if (!newData.margin) newData.margin = { rate: 0, total: 0, breakdown: {} };
                
                if (rev > 0) {
                    newData.margin.rate = (marg / rev) * 100;
                } else {
                    newData.margin.rate = 0;
                }
            }
            return newData;
        });
    };

    const handleProfitCenterChange = (pcId: string, type: 'revenue' | 'margin', value: number) => {
        setFormData(prev => {
            const newData = { ...prev };
            if (type === 'revenue') {
                newData.revenue = { ...prev.revenue, breakdown: { ...prev.revenue.breakdown, [pcId]: value } };
            } else {
                if (!newData.margin) newData.margin = { rate: 0, total: 0, breakdown: {} };
                newData.margin = { ...prev.margin, breakdown: { ...prev.margin.breakdown, [pcId]: value } };
            }
            return newData;
        });
    };
    
    const formatCurrency = (val: number) => formatForDisplay(val) + ' €';
    const formatLitres = (val: number) => formatForDisplay(val) + ' L';

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
            {/* Hidden File Input for CSV */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileImport} 
            />

            {/* HEADER */}
            <div className={`flex justify-between items-center p-6 border-b border-slate-100 rounded-t-xl ${isAdminOverride ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {initialData ? 'Modification du rapport' : 'Nouvelle saisie'}
                        {isLocked && <Lock className="w-5 h-5 text-amber-500" />}
                        {isAdminOverride && <ShieldAlert className="w-5 h-5 text-amber-600" />}
                    </h2>
                    <p className="text-sm text-slate-500">Remplissez les informations mensuelles.</p>
                </div>
                <div className="flex gap-3">
                    {/* CSV IMPORT BUTTON */}
                    {!isLocked && (
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-brand-600 transition font-medium text-sm shadow-sm"
                            title="Importer via CSV client (Année;Mois;CA;Salaires;BFR;Tréso)"
                        >
                            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importer CSV</span>
                        </button>
                    )}

                    <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-300 rounded-lg transition font-medium">
                        {isLocked ? 'Retour' : 'Annuler'}
                    </button>
                    {!isLocked && (
                        <button 
                            onClick={() => {
                                // CONFIRMATION AVANT ENREGISTREMENT
                                if (window.confirm("Confirmez-vous l'enregistrement des données ?")) {
                                    onSave(formData);
                                }
                            }} 
                            className={`px-4 py-2 text-white rounded-lg shadow-md hover:shadow-lg transition flex items-center gap-2 font-medium ${isAdminOverride ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                        >
                            <Save className="w-4 h-4" /> {isAdminOverride ? 'Forcer l\'enregistrement' : 'Enregistrer'}
                        </button>
                    )}
                </div>
            </div>

            {/* ... RESTE DU COMPOSANT (NON MODIFIÉ) ... */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
                {isClientInactive && userRole === 'client' && (
                     <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-4 rounded-lg flex items-center gap-4 shadow-sm">
                        <div className="p-2 bg-red-100 rounded-full"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                        <div>
                            <p className="font-bold text-lg">Dossier en veille administrative</p>
                            <p className="text-sm opacity-90">La saisie est désactivée pour ce dossier. Veuillez contacter votre consultant pour réactiver l'accès.</p>
                        </div>
                    </div>
                )}

                {isLocked && !isClientInactive && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-4 rounded-lg flex items-center gap-4 shadow-sm">
                        <div className="p-2 bg-amber-100 rounded-full"><CheckCircle className="w-6 h-6 text-amber-600" /></div>
                        <div>
                            <p className="font-bold text-lg">{formData.isValidated ? "Période Validée par le Cabinet" : "Saisie Transmise au Cabinet"}</p>
                            <p className="text-sm opacity-90">{formData.isValidated ? "Ce rapport a été audité et validé. Il n'est plus modifiable." : "Vos chiffres ont été bien enregistrés. Ils sont figés en attente de validation par votre consultant."}</p>
                        </div>
                    </div>
                )}

                {isAdminOverride && (
                    <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 text-amber-900 px-6 py-4 rounded-r-lg shadow-sm flex items-start gap-4">
                        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                        <div>
                            <p className="font-bold text-lg">Mode Super-Administrateur</p>
                            <p className="text-sm">Attention : Ce rapport est statutairement <strong>{formData.isValidated ? 'VALIDÉ' : (formData.isSubmitted ? 'SOUMIS PAR LE CLIENT' : 'INACTIF')}</strong>.<br/>En tant qu'administrateur, vous avez le pouvoir de modifier ces données. Vos changements écraseront la version actuelle.</p>
                        </div>
                    </div>
                )}

                <SectionCard className="mb-6 border-l-4 border-l-brand-500">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mois</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                <select value={formData.month} onChange={(e) => setFormData({...formData, month: e.target.value as Month})} disabled={isLocked} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500">
                                    {MONTH_ORDER.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Année</label>
                            <select value={formData.year} onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})} disabled={isLocked} className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500">
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </SectionCard>

                <div className="space-y-6">
                    <SectionCard>
                        <SectionHeader number="1" title="Activité & Rentabilité" icon={ShoppingBag} />
                        {/* CONDITIONAL GRID COLUMNS BASED ON MARGIN VISIBILITY */}
                        <div className={`grid grid-cols-1 ${showCommercialMargin ? 'md:grid-cols-3' : 'md:grid-cols-1 md:w-1/2 md:mx-auto'} gap-6 mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200`}>
                            <div className={`flex flex-col items-center ${showCommercialMargin ? 'border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0' : ''}`}>
                                <span className="text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">CA Global HT <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" /></span>
                                <SmartBigInput value={formData.revenue.total || 0} onChange={(val: number) => handleChange('revenue', 'total', val)} disabled={isLocked} colorClass="text-brand-700" borderColorClass="border-brand-200" />
                                <div className="mt-2 text-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">N-1</span>
                                    <span className="text-xs font-bold text-slate-600">{comparisonRecord ? formatCurrency(comparisonRecord.revenue.total) : '-'}</span>
                                </div>
                            </div>
                            
                            {showCommercialMargin && (
                                <>
                                    <div className="flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0">
                                        <span className="text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">Marge Globale (€) <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" /></span>
                                        <SmartBigInput value={formData.margin?.total || 0} onChange={(val: number) => handleChange('margin', 'total', val)} disabled={isLocked} colorClass="text-purple-700" borderColorClass="border-purple-200" />
                                        <div className="mt-2 text-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">N-1</span>
                                            <span className="text-xs font-bold text-slate-600">{comparisonRecord?.margin?.total ? formatCurrency(comparisonRecord.margin.total) : '-'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-bold text-slate-600 uppercase mb-1">Taux Global (%)</span>
                                        <div className="flex items-center gap-2">
                                            <PieChart className="w-5 h-5 text-purple-500" />
                                            <span className="text-2xl font-bold text-slate-800">{formData.margin?.rate?.toFixed(1) || 0}%</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium mt-1">Calculé (Marge € / CA €)</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {profitCenters.length > 0 ? (
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4 text-brand-500" /> Détail par Activité (Comparatif N-1 inclus)</h4>
                                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
                                    <div className={showCommercialMargin ? "col-span-3" : "col-span-6"}>Activité</div>
                                    <div className={showCommercialMargin ? "col-span-3 text-center" : "col-span-6 text-center"}>CA HT (N)</div>
                                    {showCommercialMargin && <div className="col-span-3 text-center">Marge € (N)</div>}
                                    {showCommercialMargin && <div className="col-span-3 text-center">Taux %</div>}
                                </div>
                                <div className="space-y-3">
                                    {profitCenters.map(pc => {
                                        const caVal = formData.revenue.breakdown?.[pc.id] || 0;
                                        const marginVal = formData.margin?.breakdown?.[pc.id] || 0;
                                        const rateVal = caVal > 0 ? (marginVal / caVal) * 100 : 0;
                                        const n1CA = comparisonRecord?.revenue?.breakdown?.[pc.id];
                                        return (
                                            <div key={pc.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:shadow-sm transition-all">
                                                <div className={showCommercialMargin ? "col-span-3" : "col-span-6"}>
                                                    <span className="block text-sm font-bold text-slate-800 truncate" title={pc.name}>{pc.name}</span>
                                                    <span className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-semibold uppercase">{pc.type === 'goods' ? 'Marchandise' : 'Service'}</span>
                                                </div>
                                                <div className={showCommercialMargin ? "col-span-3" : "col-span-6"}>
                                                    <div className="relative border border-slate-300 rounded bg-white overflow-hidden flex">
                                                        <div className="flex-1">
                                                            <SmartTableInput value={caVal} onChange={(val: number) => handleProfitCenterChange(pc.id, 'revenue', val)} disabled={isLocked} placeholder="0" />
                                                        </div>
                                                        {n1CA !== undefined && (
                                                            <div className="bg-slate-100 border-l border-slate-200 px-2 flex flex-col justify-center min-w-[60px] text-right" title="CA N-1">
                                                                <span className="text-[9px] text-slate-400 font-bold">N-1</span>
                                                                <span className="text-[10px] text-slate-600 font-bold">{n1CA > 999 ? (n1CA/1000).toFixed(0) + 'k' : n1CA}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {showCommercialMargin && (
                                                    <>
                                                        <div className="col-span-3">
                                                            <div className="border border-slate-300 rounded bg-white overflow-hidden">
                                                                <SmartTableInput value={marginVal} onChange={(val: number) => handleProfitCenterChange(pc.id, 'margin', val)} disabled={isLocked} placeholder="0" />
                                                            </div>
                                                        </div>
                                                        <div className="col-span-3 flex justify-center">
                                                            <span className="text-sm font-bold text-brand-700 bg-brand-50 px-2 py-1 rounded border border-brand-100">{rateVal.toFixed(1)}%</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div className="grid grid-cols-12 gap-2 items-center bg-slate-800 p-4 rounded-xl border border-slate-700 mt-4 shadow-md text-white">
                                        <div className={showCommercialMargin ? "col-span-3 flex items-center gap-2" : "col-span-6 flex items-center gap-2"}>
                                            <div className="p-1 bg-brand-500 rounded text-white"><Sigma className="w-4 h-4" /></div><span className="text-sm font-bold text-white uppercase tracking-wide">Total Détails</span>
                                        </div>
                                        <div className={`${showCommercialMargin ? "col-span-3" : "col-span-6"} text-center font-mono font-bold text-lg text-brand-200`}>{formatForDisplay(detailTotals.ca)}</div>
                                        {showCommercialMargin && (
                                            <>
                                                <div className="col-span-3 text-center font-mono font-bold text-lg text-purple-200">{formatForDisplay(detailTotals.margin)}</div>
                                                <div className="col-span-3 text-center font-bold text-sm text-white">{detailTotals.rate.toFixed(1)}%</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-brand-50/50 rounded-lg border border-dashed border-brand-200 text-center text-sm text-brand-600 font-medium">Aucune famille d'article configurée. La ventilation n'est pas nécessaire.</div>
                        )}
                        
                        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-4">
                             <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Target className="w-5 h-5" /></div>
                             <div className="flex-1">
                                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Objectif CA Mensuel</label>
                                 <div className="max-w-xs border border-slate-300 rounded-lg overflow-hidden">
                                     <SmartTableInput value={formData.revenue.objective || 0} onChange={(val: number) => handleChange('revenue', 'objective', val)} disabled={isLocked} placeholder="Objectif €" align="left" />
                                 </div>
                             </div>
                        </div>
                    </SectionCard>

                    {showFuelTracking && (
                        <SectionCard>
                            <SectionHeader number="2" title="Carburant (Litrage)" icon={Droplets} colorClass="text-blue-700" bgClass="bg-blue-100" />
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <SmartNumberInput label="Gasoil (L)" value={formData.fuel?.details?.gasoil.volume} onChange={(v: number) => handleChange('fuel', 'gasoil', v, 'volume')} disabled={isLocked} suffix="L" n1Value={comparisonRecord?.fuel?.details?.gasoil.volume} className="border-slate-300 focus:ring-blue-500" />
                                     <SmartNumberInput label="Sans Plomb (L)" value={formData.fuel?.details?.sansPlomb.volume} onChange={(v: number) => handleChange('fuel', 'sansPlomb', v, 'volume')} disabled={isLocked} suffix="L" n1Value={comparisonRecord?.fuel?.details?.sansPlomb.volume} className="border-slate-300 focus:ring-blue-500" />
                                     <SmartNumberInput label="GNR (L)" value={formData.fuel?.details?.gnr.volume} onChange={(v: number) => handleChange('fuel', 'gnr', v, 'volume')} disabled={isLocked} suffix="L" n1Value={comparisonRecord?.fuel?.details?.gnr.volume} className="border-slate-300 focus:ring-blue-500" />
                                </div>
                                <div className="lg:col-span-1 lg:border-l lg:border-slate-100 lg:pl-8">
                                    <ResultCard label="Volume Total" value={formatLitres(formData.fuel?.volume || 0)} subtext={formData.fuel?.objective ? `Obj Total: ${formatLitres(formData.fuel.objective)}` : 'Aucun objectif défini'} icon={Droplets} colorClass="text-blue-700" bgClass="bg-blue-50" />
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    <SectionCard>
                        <SectionHeader number={2 + (showFuelTracking ? 1 : 0)} title="Charges & Productivité" icon={Users} colorClass="text-orange-700" bgClass="bg-orange-100" />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <SmartNumberInput label="Masse Salariale Chargée" value={formData.expenses.salaries} onChange={(v: number) => handleChange('expenses', 'salaries', v)} disabled={isLocked} definition={DEFINITIONS.salaries} n1Value={comparisonRecord?.expenses.salaries} />
                                <div className="grid grid-cols-2 gap-3">
                                    <SmartNumberInput label="Heures Travaillées" value={formData.expenses.hoursWorked} onChange={(v: number) => handleChange('expenses', 'hoursWorked', v)} disabled={isLocked} suffix="h" n1Value={comparisonRecord?.expenses.hoursWorked} icon={Clock} />
                                    <SmartNumberInput label="Dont Heures Sup." value={formData.expenses.overtimeHours} onChange={(v: number) => handleChange('expenses', 'overtimeHours', v)} disabled={isLocked} suffix="h" className="border-orange-200 focus:ring-orange-500 bg-orange-50 text-orange-800" n1Value={comparisonRecord?.expenses.overtimeHours} />
                                </div>
                            </div>
                            <div className="lg:col-span-1 lg:border-l lg:border-slate-100 lg:pl-8">
                                <ResultCard label="Ratio Salarial / CA" value={`${formData.revenue.total ? ((formData.expenses.salaries / formData.revenue.total) * 100).toFixed(1) : 0}%`} subtext={((formData.expenses.salaries / (formData.revenue.total || 1)) * 100) > 40 ? "Attention : Ratio Élevé" : "Ratio Maîtrisé"} icon={Calculator} colorClass={((formData.expenses.salaries / (formData.revenue.total || 1)) * 100) > 40 ? "text-orange-600" : "text-emerald-600"} bgClass={((formData.expenses.salaries / (formData.revenue.total || 1)) * 100) > 40 ? "bg-orange-50" : "bg-emerald-50"} />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard>
                        <SectionHeader number={3 + (showFuelTracking ? 1 : 0)} title="BFR (Besoin en Fonds de Roulement)" icon={Scale} colorClass="text-cyan-700" bgClass="bg-cyan-100" />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                             <div className="space-y-4">
                                <div className="flex items-center gap-2 text-cyan-700 border-b border-cyan-100 pb-2"><div className="p-1.5 bg-cyan-100 rounded-lg"><ArrowUpCircle className="w-4 h-4" /></div><span className="font-bold text-sm uppercase tracking-wide">Actif Circulant</span></div>
                                <SmartNumberInput label="Créances Clients" value={formData.bfr.receivables.clients} onChange={(v: number) => handleChange('bfr', 'receivables', v, 'clients')} disabled={isLocked} className="border-cyan-200 focus:ring-cyan-500 bg-cyan-50" />
                                <SmartNumberInput label="Stocks Marchandises" value={formData.bfr.stock.goods} onChange={(v: number) => handleChange('bfr', 'stock', v, 'goods')} disabled={isLocked} className="border-cyan-200 focus:ring-cyan-500 bg-cyan-50" />
                                <SmartNumberInput label="Autres Créances" value={formData.bfr.receivables.other} onChange={(v: number) => handleChange('bfr', 'receivables', v, 'other')} disabled={isLocked} className="border-cyan-200 focus:ring-cyan-500 bg-cyan-50" />
                             </div>
                             <div className="space-y-4 lg:border-l lg:border-r border-slate-100 lg:px-6">
                                <div className="flex items-center gap-2 text-red-700 border-b border-red-100 pb-2"><div className="p-1.5 bg-red-100 rounded-lg"><ArrowDownCircle className="w-4 h-4" /></div><span className="font-bold text-sm uppercase tracking-wide">Dettes Exploitation</span></div>
                                <SmartNumberInput label="Fournisseurs" value={formData.bfr.debts.suppliers} onChange={(v: number) => handleChange('bfr', 'debts', v, 'suppliers')} disabled={isLocked} className="border-red-200 focus:ring-red-500 bg-red-50" />
                                <SmartNumberInput label="Dettes Fiscales (État)" value={formData.bfr.debts.state} onChange={(v: number) => { handleChange('bfr', 'debts', v, 'state'); }} disabled={isLocked} className="border-red-200 focus:ring-red-500 bg-red-50" />
                                <SmartNumberInput label="Dettes Sociales (URSSAF...)" value={formData.bfr.debts.social} onChange={(v: number) => { handleChange('bfr', 'debts', v, 'social'); }} disabled={isLocked} className="border-red-200 focus:ring-red-500 bg-red-50" />
                                <SmartNumberInput label="Autres Dettes" value={formData.bfr.debts.other} onChange={(v: number) => handleChange('bfr', 'debts', v, 'other')} disabled={isLocked} className="border-red-200 focus:ring-red-500 bg-red-50" />
                             </div>
                             <div className="flex flex-col h-full justify-center">
                                 <ResultCard label="BFR Net Calculé" value={formatCurrency(formData.bfr.total)} subtext="Actif Circulant - Passif Circulant" icon={Scale} colorClass="text-cyan-800" bgClass="bg-cyan-50" />
                             </div>
                        </div>
                    </SectionCard>

                    <SectionCard className={isLocked ? "opacity-90 grayscale-[0.2]" : ""}>
                        <SectionHeader number={4 + (showFuelTracking ? 1 : 0)} title="Situation de Trésorerie" icon={Landmark} colorClass="text-brand-700" bgClass="bg-brand-100" />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-emerald-700 border-b border-emerald-100 pb-2"><div className="p-1.5 bg-emerald-100 rounded-lg"><TrendingUp className="w-4 h-4" /></div><span className="font-bold text-sm uppercase tracking-wide">Disponibilités</span></div>
                                <SmartNumberInput label="Soldes Créditeurs" value={formData.cashFlow.active} onChange={(val: number) => handleChange('cashFlow', 'active', val)} className="border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50 text-emerald-900 font-bold" disabled={isLocked} definition={DEFINITIONS.treasuryPositive} n1Value={comparisonRecord?.cashFlow.active} prefix={<span className="text-emerald-500 font-bold">+</span>} />
                                <p className="text-[10px] text-slate-500 font-medium leading-tight">Comptes courants créditeurs, caisse espèces, livrets et placements disponibles.</p>
                            </div>
                            <div className="space-y-4 lg:border-l lg:border-r border-slate-100 lg:px-8">
                                <div className="flex items-center gap-2 text-red-700 border-b border-red-100 pb-2"><div className="p-1.5 bg-red-100 rounded-lg"><TrendingDown className="w-4 h-4" /></div><span className="font-bold text-sm uppercase tracking-wide">Concours Bancaires</span></div>
                                <SmartNumberInput label="Soldes Débiteurs" value={formData.cashFlow.passive} onChange={(val: number) => handleChange('cashFlow', 'passive', val)} className="border-red-200 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-900 font-bold" disabled={isLocked} definition={DEFINITIONS.treasuryNegative} n1Value={comparisonRecord?.cashFlow.passive} prefix={<span className="text-red-500 font-bold">-</span>} />
                                <p className="text-[10px] text-slate-500 font-medium leading-tight">Découverts autorisés ou non, facilités de caisse, emprunts court terme.</p>
                            </div>
                            <div className="flex flex-col h-full justify-center">
                                <ResultCard label="Trésorerie Nette" value={formatCurrency(formData.cashFlow.treasury)} subtext="Active - Passive" icon={Landmark} colorClass={formData.cashFlow.treasury >= 0 ? 'text-emerald-800' : 'text-red-800'} bgClass={formData.cashFlow.treasury >= 0 ? 'bg-emerald-50' : 'bg-red-50'} />
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};

export default EntryForm;
