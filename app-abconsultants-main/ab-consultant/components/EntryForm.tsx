
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FinancialRecord, Month, ProfitCenter } from '../types';
import { Save, Lock, Calendar, HelpCircle, ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, Landmark, ShoppingBag, Target, PieChart, Droplets, Users, Clock, Calculator, Scale, Briefcase, ArrowRight, Truck, Percent, Sigma, CheckCircle, History, AlertTriangle, ShieldAlert, Upload, FileText, RotateCcw, Send, FileSpreadsheet, Loader2, Check } from 'lucide-react';
import { MONTH_ORDER } from '../services/dataService';
import { useConfirmDialog } from '../contexts/ConfirmContext';

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
                        className={`w-full h-full bg-white text-sm font-bold text-slate-900 py-2.5 px-3 outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset disabled:bg-slate-50 disabled:text-slate-600 ${className} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''}`}
                    />
                    {suffix && <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold pointer-events-none">{suffix}</span>}
                </div>

                {/* N-1 Comparison Column */}
                {n1Value !== undefined && (
                    <div className="flex flex-col justify-center px-3 border-l border-slate-100 bg-slate-50 min-w-[80px] text-right" title={`Valeur N-1 : ${formatForDisplay(n1Value)}`}>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">N-1</span>
                        <div className="text-xs font-bold text-slate-600">
                            {formatForDisplay(n1Value)}
                        </div>
                        {variation !== null && (
                            <span className={`text-xs font-bold ${varColor}`}>
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
const SectionCard = ({ children, className = "", id }: { children?: React.ReactNode, className?: string, id?: string }) => (
    <div id={id} className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:p-8 transition-all hover:shadow-md ${className}`}>
        {children}
    </div>
);

const SectionHeader = ({ number, title, icon: Icon, colorClass = "text-brand-700", bgClass = "bg-brand-100", subtitle, hideNumber }: any) => (
    <div className="mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
            {!hideNumber && (
                <div className={`w-8 h-8 rounded-lg ${bgClass} ${colorClass} flex items-center justify-center text-sm font-bold shadow-sm`}>
                    {number}
                </div>
            )}
            <h3 className={`text-lg font-bold ${colorClass} flex items-center gap-2`}>
                <Icon className="w-5 h-5 opacity-80" />
                {title}
            </h3>
        </div>
        {subtitle && (
            <p className="text-sm text-slate-500 mt-2 ml-0">{subtitle}</p>
        )}
    </div>
);

const ResultCard = ({ label, value, subtext, icon: Icon, colorClass, bgClass }: any) => (
    <div className={`relative p-5 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center text-center h-full ${bgClass} ${colorClass} border-current border-opacity-30`}>
        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center mb-3 shadow-sm backdrop-blur-sm">
            <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest mb-1 opacity-90">{label}</span>
        <div className="text-2xl font-extrabold tracking-tight mb-1">
            {value}
        </div>
        {subtext && <div className="text-xs font-semibold opacity-80">{subtext}</div>}
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
  defaultRevenueObjective?: number;
  clientStatus?: 'active' | 'inactive';
  onImportExcel?: () => void;
  currentUserEmail?: string | null;
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
  defaultRevenueObjective,
  clientStatus = 'active',
  onImportExcel,
  currentUserEmail
}) => {
    
    const confirm = useConfirmDialog();

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
            revenue: { goods: 0, services: 0, total: 0, objective: defaultRevenueObjective || 0, breakdown: {} },
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
            const loaded = JSON.parse(JSON.stringify(match));
            if (!loaded.revenue.objective && defaultRevenueObjective) {
                loaded.revenue.objective = defaultRevenueObjective;
            }
            setFormData(loaded);
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
                revenue: { goods: 0, services: 0, total: 0, objective: defaultRevenueObjective || 0, breakdown: {} },
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
    }, [formData.year, formData.month, existingRecords, clientId, defaultFuelObjectives, defaultRevenueObjective]);

    // --- M-1 AUTO-CORRECTION: if year is current and month is in the future, snap back ---
    useEffect(() => {
        const now = new Date();
        if (formData.year === now.getFullYear()) {
            const maxAllowedIndex = now.getMonth() - 1; // M-1
            const currentIndex = MONTH_ORDER.indexOf(formData.month);
            if (maxAllowedIndex >= 0 && currentIndex > maxAllowedIndex) {
                setFormData(prev => ({ ...prev, month: MONTH_ORDER[maxAllowedIndex] }));
            }
        }
    }, [formData.year]);

    // --- SMART DEFAULT MONTH: on mount without initialData, pick the most recent
    // month (<= M-1) that has no submitted/validated record yet. Avoids landing on
    // a locked month when M-1 has already been submitted.
    const didSmartDefaultRef = useRef(false);
    useEffect(() => {
        if (initialData || didSmartDefaultRef.current) return;
        didSmartDefaultRef.current = true;
        const now = new Date();
        const currentYear = now.getFullYear();
        const maxIdx = now.getMonth() - 1;
        if (maxIdx < 0) return;
        const isTaken = (y: number, m: Month) => existingRecords.some(r => r.year === y && r.month === m && (r.isSubmitted || r.isValidated));
        for (let i = maxIdx; i >= 0; i--) {
            const candidate = MONTH_ORDER[i];
            if (!isTaken(currentYear, candidate)) {
                if (candidate !== formData.month || currentYear !== formData.year) {
                    setFormData(prev => ({ ...prev, year: currentYear, month: candidate }));
                }
                return;
            }
        }
        // Fallback: previous year, scan from December down
        for (let i = 11; i >= 0; i--) {
            const candidate = MONTH_ORDER[i];
            if (!isTaken(currentYear - 1, candidate)) {
                setFormData(prev => ({ ...prev, year: currentYear - 1, month: candidate }));
                return;
            }
        }
    }, [initialData, existingRecords]);

    // CHECK IF CLIENT IS INACTIVE
    const isClientInactive = clientStatus === 'inactive';
    const isLocked = userRole === 'client' && (formData.isValidated || formData.isSubmitted || isClientInactive);
    const isAdminOverride = userRole === 'ab_consultant' && (formData.isValidated || formData.isSubmitted || isClientInactive);

    // --- STEPPER MODE (guided wizard) ---
    // Clients get the step-by-step view by default, consultants get the full page.
    const [stepMode, setStepMode] = useState<boolean>(userRole === 'client' && !isLocked);
    const [currentStep, setCurrentStep] = useState<number>(0);
    useEffect(() => {
        if (isLocked) setStepMode(false);
    }, [isLocked]);

    const comparisonRecord = useMemo(() => {
        return existingRecords.find(r => r.year === formData.year - 1 && r.month === formData.month);
    }, [existingRecords, formData.year, formData.month]);

    // --- REPRENDRE M-1 LOGIC ---
    const previousMonthRecord = useMemo(() => {
        const currentMonthIdx = MONTH_ORDER.indexOf(formData.month);
        let prevMonth: Month;
        let prevYear: number;
        if (currentMonthIdx === 0) {
            prevMonth = MONTH_ORDER[11];
            prevYear = formData.year - 1;
        } else {
            prevMonth = MONTH_ORDER[currentMonthIdx - 1];
            prevYear = formData.year;
        }
        return existingRecords.find(r => r.year === prevYear && r.month === prevMonth) || null;
    }, [existingRecords, formData.year, formData.month]);

    const isFormEmpty = useMemo(() => {
        return formData.revenue.total === 0 && formData.expenses.salaries === 0 && formData.cashFlow.treasury === 0;
    }, [formData.revenue.total, formData.expenses.salaries, formData.cashFlow.treasury]);

    // Sync formData when initialData changes (e.g. switching between records without remount)
    useEffect(() => {
        if (initialData) {
            setFormData(JSON.parse(JSON.stringify(initialData)));
        }
    }, [initialData?.id]);

    // --- AUTO-SAVE BROUILLON (localStorage) ---
    const draftKey = `draft-${clientId}-${formData.year}-${formData.month}`;
    const [hasDraft, setHasDraft] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);

    // Restore draft on mount / month change (only for new entries)
    useEffect(() => {
        if (initialData || isLocked) return;
        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                setHasDraft(true);
            }
        } catch {}
    }, [draftKey, initialData, isLocked]);

    const handleRestoreDraft = () => {
        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                setFormData(prev => ({ ...prev, ...parsed, id: prev.id, clientId: prev.clientId, year: prev.year, month: prev.month }));
                setHasDraft(false);
            }
        } catch {}
    };

    const handleDismissDraft = () => {
        localStorage.removeItem(draftKey);
        setHasDraft(false);
    };

    // Auto-save debounced (every 5 seconds of inactivity)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (isLocked || isFormEmpty) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            try {
                const { id, clientId, year, month, isValidated, isPublished, isSubmitted, ...saveable } = formData;
                localStorage.setItem(draftKey, JSON.stringify(saveable));
                setDraftSaved(true);
                setTimeout(() => setDraftSaved(false), 2000);
            } catch {}
        }, 5000);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [formData, draftKey, isLocked, isFormEmpty]);

    // --- AUTO-SAVE TO FIRESTORE (client only) ---
    // State/refs are declared here; the effects that reference `wrappedOnSave`
    // are defined further down (after `wrappedOnSave`) to avoid TDZ issues.
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSaveMountedRef = useRef(false);
    const lastSavedSnapshotRef = useRef<string | null>(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const [nowTick, setNowTick] = useState<number>(() => Date.now());

    const canAutoSave = userRole === 'client' && !isLocked && !isAdminOverride && !isClientInactive;

    const formatLastSaved = (savedAt: number, now: number): string => {
        const seconds = Math.max(0, Math.floor((now - savedAt) / 1000));
        if (seconds < 60) return `il y a ${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `il y a ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        return `il y a ${hours} h`;
    };

    // Cancel any pending auto-save. Used when the user clicks "Soumettre" while
    // a debounced save is still queued — the click handler will save+submit
    // in one go using the current formData, making the queued save redundant.
    const flushAutoSave = useCallback(() => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        setIsAutoSaving(false);
    }, []);

    // --- ABERRANT VALUE DETECTION ---
    const detectAberrantValues = (record: FinancialRecord): string[] => {
        const warnings: string[] = [];
        const MIN_SALARY = 500;
        const MIN_REVENUE = 100;
        const MIN_AMOUNT = 50;
        const MAX_AMOUNT = 100_000_000;

        // Revenue
        if (record.revenue.total > 0 && record.revenue.total < MIN_REVENUE) {
            warnings.push(`CA Global HT = ${formatForDisplay(record.revenue.total)} € (< ${MIN_REVENUE} €)`);
        }
        if (record.revenue.total > MAX_AMOUNT) {
            warnings.push(`CA Global HT = ${formatForDisplay(record.revenue.total)} € (> 100 M€)`);
        }

        // Margin
        if (record.margin?.total && record.margin.total > 0 && record.margin.total < MIN_AMOUNT) {
            warnings.push(`Marge Globale = ${formatForDisplay(record.margin.total)} € (< ${MIN_AMOUNT} €)`);
        }
        if (record.margin?.total && record.margin.total > MAX_AMOUNT) {
            warnings.push(`Marge Globale = ${formatForDisplay(record.margin.total)} € (> 100 M€)`);
        }
        // Margin > Revenue
        if (record.margin?.total && record.revenue.total > 0 && record.margin.total > record.revenue.total) {
            warnings.push(`Marge (${formatForDisplay(record.margin.total)} €) supérieure au CA (${formatForDisplay(record.revenue.total)} €)`);
        }

        // Salaries
        if (record.expenses.salaries > 0 && record.expenses.salaries < MIN_SALARY) {
            warnings.push(`Masse Salariale = ${formatForDisplay(record.expenses.salaries)} € (< ${MIN_SALARY} €)`);
        }
        if (record.expenses.salaries > MAX_AMOUNT) {
            warnings.push(`Masse Salariale = ${formatForDisplay(record.expenses.salaries)} € (> 100 M€)`);
        }

        // Hours worked
        if (record.expenses.hoursWorked > 0 && record.expenses.hoursWorked < 10) {
            warnings.push(`Heures Travaillées = ${record.expenses.hoursWorked} h (< 10 h)`);
        }
        if (record.expenses.hoursWorked > 50_000) {
            warnings.push(`Heures Travaillées = ${formatForDisplay(record.expenses.hoursWorked)} h (> 50 000 h)`);
        }

        // Overtime > Total hours
        if (record.expenses.overtimeHours > 0 && record.expenses.hoursWorked > 0 && record.expenses.overtimeHours > record.expenses.hoursWorked) {
            warnings.push(`Heures Sup. (${record.expenses.overtimeHours} h) supérieures aux Heures Totales (${record.expenses.hoursWorked} h)`);
        }

        // BFR items
        const bfrChecks = [
            { val: record.bfr.receivables.clients, label: 'Créances Clients' },
            { val: record.bfr.stock.goods, label: 'Stocks Marchandises' },
            { val: record.bfr.debts.suppliers, label: 'Fournisseurs' },
            { val: record.bfr.debts.state, label: 'Dettes Fiscales' },
            { val: record.bfr.debts.social, label: 'Dettes Sociales' },
        ];
        for (const { val, label } of bfrChecks) {
            if (val > 0 && val < MIN_AMOUNT) {
                warnings.push(`${label} = ${formatForDisplay(val)} € (< ${MIN_AMOUNT} €)`);
            }
            if (val > MAX_AMOUNT) {
                warnings.push(`${label} = ${formatForDisplay(val)} € (> 100 M€)`);
            }
        }

        // Treasury
        if (record.cashFlow.active > 0 && record.cashFlow.active < MIN_AMOUNT) {
            warnings.push(`Soldes Créditeurs = ${formatForDisplay(record.cashFlow.active)} € (< ${MIN_AMOUNT} €)`);
        }
        if (record.cashFlow.active > MAX_AMOUNT) {
            warnings.push(`Soldes Créditeurs = ${formatForDisplay(record.cashFlow.active)} € (> 100 M€)`);
        }
        if (record.cashFlow.passive > 0 && record.cashFlow.passive < MIN_AMOUNT) {
            warnings.push(`Soldes Débiteurs = ${formatForDisplay(record.cashFlow.passive)} € (< ${MIN_AMOUNT} €)`);
        }
        if (record.cashFlow.passive > MAX_AMOUNT) {
            warnings.push(`Soldes Débiteurs = ${formatForDisplay(record.cashFlow.passive)} € (> 100 M€)`);
        }

        // Fuel volumes
        if (record.fuel) {
            const fuelChecks = [
                { val: record.fuel.details?.gasoil?.volume, label: 'Gasoil' },
                { val: record.fuel.details?.sansPlomb?.volume, label: 'Sans Plomb' },
                { val: record.fuel.details?.gnr?.volume, label: 'GNR' },
            ];
            for (const { val, label } of fuelChecks) {
                if (val && val > 0 && val < 10) {
                    warnings.push(`${label} = ${formatForDisplay(val)} L (< 10 L)`);
                }
                if (val && val > 1_000_000) {
                    warnings.push(`${label} = ${formatForDisplay(val)} L (> 1 000 000 L)`);
                }
            }
        }

        return warnings;
    };

    const validateRequiredFields = useCallback((record: FinancialRecord): string[] => {
        const errors: string[] = [];
        if (record.revenue.total <= 0 && record.revenue.goods <= 0 && record.revenue.services <= 0) {
            errors.push('Le chiffre d\'affaires est vide');
        }
        if (record.expenses.salaries <= 0) {
            errors.push('Les charges salariales ne sont pas renseignées');
        }
        return errors;
    }, []);

    // Clean draft after successful save
    const originalOnSave = onSave;
    const wrappedOnSave = useCallback(async (record: FinancialRecord) => {
        // Check for aberrant values before saving
        const warnings = detectAberrantValues(record);
        if (warnings.length > 0) {
            const ok = await confirm({
                title: 'Valeurs inhabituelles détectées',
                message: `Les montants suivants semblent anormaux :\n\n• ${warnings.join('\n• ')}\n\nVoulez-vous quand même enregistrer ?`,
                variant: 'danger',
                confirmLabel: 'Enregistrer quand même',
            });
            if (!ok) return;
        }
        try {
            const recordWithAuthor = currentUserEmail
                ? { ...record, submittedBy: record.submittedBy || currentUserEmail }
                : record;
            await originalOnSave(recordWithAuthor);
            localStorage.removeItem(draftKey);
        } catch (err) {
            console.error('Erreur sauvegarde:', err);
        }
    }, [draftKey, originalOnSave, confirm]);

    // --- AUTO-SAVE EFFECTS ---
    // Debounces formData changes by 1.5s, then persists via wrappedOnSave with
    // isSubmitted: false. Defined after wrappedOnSave to avoid TDZ.
    const autoSaveInFlightRef = useRef(false);

    useEffect(() => {
        if (!canAutoSave) return;
        // Skip the very first run so the initial render doesn't trigger a save.
        if (!autoSaveMountedRef.current) {
            autoSaveMountedRef.current = true;
            try {
                const { id, clientId, year, month, isValidated, isPublished, isSubmitted, ...saveable } = formData;
                lastSavedSnapshotRef.current = JSON.stringify(saveable);
            } catch {
                lastSavedSnapshotRef.current = null;
            }
            return;
        }
        if (isFormEmpty) return;

        // Skip if a save is already in flight (e.g. confirm modal pending).
        if (autoSaveInFlightRef.current) return;

        // Compare against last-saved snapshot — skip if nothing changed.
        let snapshot: string;
        try {
            const { id, clientId, year, month, isValidated, isPublished, isSubmitted, ...saveable } = formData;
            snapshot = JSON.stringify(saveable);
        } catch {
            return;
        }
        if (snapshot === lastSavedSnapshotRef.current) return;

        setIsAutoSaving(true);
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
            autoSaveTimerRef.current = null;
            autoSaveInFlightRef.current = true;
            try {
                await wrappedOnSave({ ...formData, isSubmitted: false });
                lastSavedSnapshotRef.current = snapshot;
                setLastSavedAt(Date.now());
            } finally {
                autoSaveInFlightRef.current = false;
                setIsAutoSaving(false);
            }
        }, 1500);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, [formData, canAutoSave, isFormEmpty, wrappedOnSave]);

    // Reset auto-save bookkeeping when the record being edited changes
    // (e.g. switching months) so the new record's initial state isn't treated as "dirty".
    useEffect(() => {
        autoSaveMountedRef.current = false;
        lastSavedSnapshotRef.current = null;
        setLastSavedAt(null);
        setIsAutoSaving(false);
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
    }, [initialData?.id, formData.year, formData.month]);

    // Tick every 10s to keep the "il y a Ns" label fresh.
    useEffect(() => {
        if (lastSavedAt === null) return;
        const handle = setInterval(() => setNowTick(Date.now()), 10000);
        return () => clearInterval(handle);
    }, [lastSavedAt]);

    const handleReprendreM1 = async () => {
        if (!previousMonthRecord) return;
        const ok = await confirm({
            title: 'Reprendre les données M-1 ?',
            message: `Les données de ${previousMonthRecord.month} ${previousMonthRecord.year} seront copiées comme point de départ. Vous pourrez les modifier ensuite.`,
            variant: 'default',
            confirmLabel: 'Reprendre'
        });
        if (!ok) return;
        setFormData(prev => ({
            ...prev,
            revenue: { ...JSON.parse(JSON.stringify(previousMonthRecord.revenue)) },
            margin: previousMonthRecord.margin ? { ...JSON.parse(JSON.stringify(previousMonthRecord.margin)) } : prev.margin,
            expenses: { ...previousMonthRecord.expenses },
            bfr: { ...JSON.parse(JSON.stringify(previousMonthRecord.bfr)) },
            cashFlow: { ...previousMonthRecord.cashFlow },
            fuel: previousMonthRecord.fuel ? { ...JSON.parse(JSON.stringify(previousMonthRecord.fuel)) } : prev.fuel,
        }));
    };

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
                    confirm({ title: 'Import réussi', message: `Données importées pour ${csvMonth} ${csvYear}.`, variant: 'success', showCancel: false, confirmLabel: 'OK' });
                    break;
                }
            }

            if (!matched) {
                confirm({ title: 'Aucune donnée', message: `Aucune donnée trouvée dans le fichier pour ${formData.month} ${formData.year}.`, variant: 'info', showCancel: false, confirmLabel: 'OK' });
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
                 if (!newData.fuel) {
                     newData.fuel = { volume: 0, objective: 0, details: { gasoil: { volume: 0, objective: 0 }, sansPlomb: { volume: 0, objective: 0 }, gnr: { volume: 0, objective: 0 } } };
                 }
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
                <div className="flex items-center gap-3">
                    {/* AUTO-SAVE INDICATOR */}
                    {draftSaved && (
                        <span className="text-xs text-slate-400 flex items-center gap-1 animate-in fade-in duration-200">
                            <CheckCircle className="w-3 h-3 text-emerald-400" /> Brouillon sauvé
                        </span>
                    )}
                    {/* IMPORT BUTTONS */}
                    {!isLocked && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-brand-600 transition font-medium text-sm shadow-sm rounded-r-none border-r-0"
                                title="Importer via CSV client (Année;Mois;CA;Salaires;BFR;Tréso)"
                            >
                                <Upload className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
                            </button>
                            {onImportExcel && (
                                <button
                                    onClick={onImportExcel}
                                    className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-100 transition font-medium text-sm shadow-sm rounded-l-none"
                                    title="Importer via Excel multi-feuilles (.xlsx)"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
                                </button>
                            )}
                        </div>
                    )}

                    <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-300 rounded-lg transition font-medium">
                        {isLocked ? 'Retour' : 'Annuler'}
                    </button>
                    {!isLocked && userRole === 'client' && !isAdminOverride && (
                        <>
                            {isAutoSaving ? (
                                <span className="text-xs text-slate-400 flex items-center gap-1" aria-live="polite">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde…
                                </span>
                            ) : lastSavedAt !== null ? (
                                <span className="text-xs text-emerald-600 flex items-center gap-1" aria-live="polite">
                                    <Check className="w-3 h-3" /> Sauvegardé {formatLastSaved(lastSavedAt, nowTick)}
                                </span>
                            ) : null}
                            <button
                                onClick={async () => {
                                    const validationErrors = validateRequiredFields(formData);
                                    if (validationErrors.length > 0) {
                                        await confirm({ title: 'Données incomplètes', message: `Merci de compléter les champs suivants avant de soumettre :\n\n• ${validationErrors.join('\n• ')}`, variant: 'danger', confirmLabel: 'Compris' });
                                        return;
                                    }
                                    const ok = await confirm({ title: 'Soumettre au cabinet ?', message: `Vos données de ${formData.month} ${formData.year} seront transmises au consultant.\n\nUne fois soumises, vous ne pourrez plus les modifier sans l'accord du cabinet.`, variant: 'info', confirmLabel: 'Soumettre' });
                                    if (ok) {
                                        // Cancel any pending debounced auto-save: the submit below will persist
                                        // the current formData in one go, making the queued save redundant.
                                        flushAutoSave();
                                        wrappedOnSave(formData);
                                    }
                                }}
                                className="px-4 py-2 bg-brand-600 text-white rounded-lg shadow-md hover:bg-brand-700 hover:shadow-lg transition flex items-center gap-2 font-medium"
                            >
                                <Send className="w-4 h-4" /> Soumettre
                            </button>
                        </>
                    )}
                    {!isLocked && (userRole !== 'client' || isAdminOverride) && (
                        <button
                            onClick={async () => {
                                if (isAdminOverride) {
                                    const ok = await confirm({ title: 'Forcer l\'enregistrement ?', message: `Attention : ce rapport est ${formData.isValidated ? 'validé' : 'soumis'}. Vos modifications écraseront la version actuelle.`, variant: 'danger', confirmLabel: 'Forcer' });
                                    if (!ok) return;
                                }
                                wrappedOnSave(formData);
                            }}
                            className={`px-4 py-2 text-white rounded-lg shadow-md hover:shadow-lg transition flex items-center gap-2 font-medium ${isAdminOverride ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-600 hover:bg-brand-700'}`}
                        >
                            <Save className="w-4 h-4" /> {isAdminOverride ? 'Forcer l\'enregistrement' : 'Enregistrer'}
                        </button>
                    )}
                </div>
            </div>

            {/* SECTION NAVIGATOR (compact inline stepper) */}
            <div className="px-6 py-2.5 bg-white border-b border-slate-100 print:hidden sticky top-0 z-10 shadow-sm">
                {(() => {
                    const sectionIds = ['section-activite', ...(showFuelTracking ? ['section-carburant'] : []), 'section-charges', 'section-bfr', 'section-tresorerie'];
                    const labels = ['Activité', ...(showFuelTracking ? ['Carburant'] : []), 'Charges', 'BFR', 'Trésorerie'];
                    const filled = [
                        formData.revenue.total > 0 || (formData.margin?.total || 0) > 0,
                        ...(showFuelTracking ? [(formData.fuel?.volume || 0) > 0] : []),
                        formData.expenses.salaries > 0 || formData.expenses.hoursWorked > 0,
                        formData.bfr.receivables.total > 0 || formData.bfr.debts.total > 0 || formData.bfr.stock.total > 0,
                        formData.cashFlow.active > 0 || formData.cashFlow.passive > 0,
                    ];
                    return (
                        <div className="flex items-center gap-3">
                            {/* Inline horizontal stepper */}
                            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
                                {labels.map((label, i) => {
                                    const isDone = stepMode ? i < currentStep : filled[i];
                                    const isCurrent = stepMode && i === currentStep;
                                    return (
                                        <React.Fragment key={i}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (stepMode) {
                                                        setCurrentStep(i);
                                                    } else {
                                                        document.getElementById(sectionIds[i])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }
                                                }}
                                                title={label}
                                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-all shrink-0 ${
                                                    isCurrent ? 'bg-brand-600 text-white shadow-sm' :
                                                    isDone ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' :
                                                    'text-slate-500 hover:bg-slate-100 hover:text-brand-600'
                                                }`}
                                            >
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                                    isCurrent ? 'bg-white/20 text-white' :
                                                    isDone ? 'bg-brand-500 text-white' :
                                                    'bg-slate-200 text-slate-500'
                                                }`}>
                                                    {isDone ? <CheckCircle className="w-3 h-3" /> : i + 1}
                                                </span>
                                                <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
                                            </button>
                                            {i < labels.length - 1 && (
                                                <div className={`h-px w-3 shrink-0 ${
                                                    (stepMode ? i < currentStep : filled[i]) ? 'bg-brand-400' : 'bg-slate-200'
                                                }`} />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                            {/* Mode toggle */}
                            {!isLocked && (
                                <button
                                    type="button"
                                    onClick={() => setStepMode(m => !m)}
                                    className="text-xs font-semibold text-slate-500 hover:text-brand-600 hover:bg-slate-100 px-2 py-1 rounded transition shrink-0"
                                    title={stepMode ? 'Afficher tous les champs sur une seule page' : 'Remplir étape par étape'}
                                >
                                    {stepMode ? 'Vue complète' : 'Mode étapes'}
                                </button>
                            )}
                        </div>
                    );
                })()}
            </div>
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
                    <div className={`mb-6 px-4 py-4 rounded-lg flex items-center gap-4 shadow-sm ${formData.isValidated ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                        <div className={`p-2 rounded-full ${formData.isValidated ? 'bg-emerald-100' : 'bg-amber-100'}`}><CheckCircle className={`w-6 h-6 ${formData.isValidated ? 'text-emerald-600' : 'text-amber-600'}`} /></div>
                        <div>
                            <p className="font-bold text-lg">{formData.isValidated ? "Rapport Validé" : "Saisie Transmise au Cabinet"}</p>
                            <p className="text-sm opacity-90">{formData.isValidated
                                ? "Ce rapport a été audité et validé par votre consultant. Les données sont définitives."
                                : "Vos chiffres ont bien été transmis. Votre consultant les examinera sous 48h ouvrées. Vous serez notifié quand l'analyse sera publiée."}</p>
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

                {/* DRAFT RESTORE BANNER */}
                {hasDraft && !initialData && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-3">
                            <History className="w-5 h-5 text-amber-600" />
                            <div>
                                <p className="text-sm font-bold text-amber-800">Brouillon disponible</p>
                                <p className="text-xs text-amber-600">Une saisie en cours a été sauvegardée automatiquement.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleRestoreDraft} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition">
                                Restaurer
                            </button>
                            <button onClick={handleDismissDraft} className="px-3 py-1.5 bg-white border border-amber-200 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition">
                                Ignorer
                            </button>
                        </div>
                    </div>
                )}

                {stepMode && currentStep > 0 && (
                    <div className="mb-4 inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                        <Calendar className="w-3.5 h-3.5 text-brand-600" />
                        <span className="text-xs font-bold text-slate-700">{formData.month} {formData.year}</span>
                    </div>
                )}

                <SectionCard className={`mb-6 border-l-4 border-l-brand-500 ${stepMode && currentStep > 0 ? 'hidden' : ''}`}>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mois</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                <select value={formData.month} onChange={(e) => setFormData({...formData, month: e.target.value as Month})} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-brand-500">
                                    {MONTH_ORDER.map((m, idx) => {
                                        const now = new Date();
                                        const isFutureMonth = formData.year === now.getFullYear() && idx >= now.getMonth();
                                        const isFutureYear = formData.year > now.getFullYear();
                                        return <option key={m} value={m} disabled={isFutureMonth || isFutureYear}>{m}{isFutureMonth ? ' (non cloture)' : ''}</option>;
                                    })}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Année</label>
                            <select value={formData.year} onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 focus:ring-2 focus:ring-brand-500">
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* Bouton Reprendre M-1 — promoted CTA */}
                    {!isLocked && isFormEmpty && previousMonthRecord && !initialData && (
                        <div className="mt-4 flex items-stretch gap-4 p-5 bg-gradient-to-br from-brand-50 to-brand-100/40 rounded-xl border-2 border-brand-200 shadow-sm">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm shrink-0 self-center">
                                <RotateCcw className="w-6 h-6 text-brand-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-brand-900 mb-0.5">
                                    Gagnez 5 minutes — reprenez {previousMonthRecord.month} {previousMonthRecord.year}
                                </p>
                                <p className="text-xs text-brand-700/80 leading-relaxed">
                                    On copie les valeurs du mois précédent (CA, charges, BFR, trésorerie). Vous n'aurez plus qu'à ajuster ce qui change.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleReprendreM1}
                                className="shrink-0 self-center inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                            >
                                <RotateCcw className="w-4 h-4" /> Reprendre M-1
                            </button>
                        </div>
                    )}
                </SectionCard>

                <div className="space-y-6">
                    <div className={stepMode && currentStep !== 0 ? 'hidden' : ''}>
                    <SectionCard className="scroll-mt-20" id="section-activite">
                        <SectionHeader number="1" title="Activité & Rentabilité" icon={ShoppingBag} hideNumber={stepMode} subtitle={stepMode ? "Indiquez votre chiffre d'affaires du mois et, si applicable, votre marge commerciale." : undefined} />
                        {/* CONDITIONAL GRID COLUMNS BASED ON MARGIN VISIBILITY */}
                        <div className={`grid grid-cols-1 ${showCommercialMargin ? 'md:grid-cols-3' : 'md:grid-cols-1 md:w-1/2 md:mx-auto'} gap-6 mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200`}>
                            <div className={`flex flex-col items-center ${showCommercialMargin ? 'border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0' : ''}`}>
                                <span className="text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">CA Global HT <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" /></span>
                                <SmartBigInput value={formData.revenue.total || 0} onChange={(val: number) => handleChange('revenue', 'total', val)} disabled={isLocked} colorClass="text-brand-700" borderColorClass="border-brand-200" />
                                <div className="mt-2 text-center">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">N-1</span>
                                    <span className="text-xs font-bold text-slate-600">{comparisonRecord ? formatCurrency(comparisonRecord.revenue.total) : '-'}</span>
                                </div>
                            </div>
                            
                            {showCommercialMargin && (
                                <>
                                    <div className="flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0">
                                        <span className="text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">Marge Globale (€) <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help" /></span>
                                        <SmartBigInput value={formData.margin?.total || 0} onChange={(val: number) => handleChange('margin', 'total', val)} disabled={isLocked} colorClass="text-purple-700" borderColorClass="border-purple-200" />
                                        <div className="mt-2 text-center">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">N-1</span>
                                            <span className="text-xs font-bold text-slate-600">{comparisonRecord?.margin?.total ? formatCurrency(comparisonRecord.margin.total) : '-'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-bold text-slate-600 uppercase mb-1">Taux Global (%)</span>
                                        <div className="flex items-center gap-2">
                                            <PieChart className="w-5 h-5 text-purple-500" />
                                            <span className="text-2xl font-bold text-slate-800">{formData.margin?.rate?.toFixed(1) || 0}%</span>
                                        </div>
                                        <span className="text-xs text-slate-500 font-medium mt-1">Calculé (Marge € / CA €)</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {profitCenters.length > 0 ? (
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4 text-brand-500" /> Détail par Activité (Comparatif N-1 inclus)</h4>
                                <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
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
                                                    <span className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-semibold uppercase">{pc.type === 'goods' ? 'Marchandise' : 'Service'}</span>
                                                </div>
                                                <div className={showCommercialMargin ? "col-span-3" : "col-span-6"}>
                                                    <div className="relative border border-slate-300 rounded bg-white overflow-hidden flex">
                                                        <div className="flex-1">
                                                            <SmartTableInput value={caVal} onChange={(val: number) => handleProfitCenterChange(pc.id, 'revenue', val)} disabled={isLocked} placeholder="0" />
                                                        </div>
                                                        {n1CA !== undefined && (
                                                            <div className="bg-slate-100 border-l border-slate-200 px-2 flex flex-col justify-center min-w-[60px] text-right" title="CA N-1">
                                                                <span className="text-xs text-slate-400 font-bold">N-1</span>
                                                                <span className="text-xs text-slate-600 font-bold">{n1CA > 999 ? (n1CA/1000).toFixed(0) + 'k' : n1CA}</span>
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
                                     <SmartTableInput value={formData.revenue.objective || 0} onChange={(val: number) => handleChange('revenue', 'objective', val)} disabled={isLocked || userRole === 'client'} placeholder="Objectif €" align="left" />
                                 </div>
                                 {userRole === 'client' && formData.revenue.objective > 0 && (
                                     <p className="text-xs text-slate-400 mt-1">Défini par votre consultant</p>
                                 )}
                             </div>
                        </div>
                    </SectionCard>
                    </div>

                    {showFuelTracking && (
                        <div className={stepMode && currentStep !== 1 ? 'hidden' : ''}>
                        <SectionCard className="scroll-mt-20" id="section-carburant">
                            <SectionHeader number="2" title="Carburant (Litrage)" icon={Droplets} colorClass="text-blue-700" bgClass="bg-blue-100" hideNumber={stepMode} subtitle={stepMode ? "Renseignez les volumes de carburant consommés sur le mois (en litres)." : undefined} />
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
                        </div>
                    )}

                    <div className={stepMode && currentStep !== (showFuelTracking ? 2 : 1) ? 'hidden' : ''}>
                    <SectionCard className="scroll-mt-20" id="section-charges">
                        <SectionHeader number={2 + (showFuelTracking ? 1 : 0)} title="Charges & Productivité" icon={Users} colorClass="text-amber-700" bgClass="bg-amber-100" hideNumber={stepMode} subtitle={stepMode ? "Masse salariale totale (salaires bruts + charges) et heures travaillées sur le mois." : undefined} />

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <SmartNumberInput label="Masse Salariale Chargée" value={formData.expenses.salaries} onChange={(v: number) => handleChange('expenses', 'salaries', v)} disabled={isLocked} definition={DEFINITIONS.salaries} n1Value={comparisonRecord?.expenses.salaries} />
                                <div className="grid grid-cols-2 gap-3">
                                    <SmartNumberInput label="Heures Travaillées" value={formData.expenses.hoursWorked} onChange={(v: number) => handleChange('expenses', 'hoursWorked', v)} disabled={isLocked} suffix="h" n1Value={comparisonRecord?.expenses.hoursWorked} icon={Clock} />
                                    <SmartNumberInput label="Dont Heures Sup." value={formData.expenses.overtimeHours} onChange={(v: number) => handleChange('expenses', 'overtimeHours', v)} disabled={isLocked} suffix="h" className="border-amber-200 focus:ring-amber-500 bg-amber-50 text-amber-800" n1Value={comparisonRecord?.expenses.overtimeHours} />
                                </div>
                            </div>
                            <div className="lg:col-span-1 lg:border-l lg:border-slate-100 lg:pl-8">
                                <ResultCard label="Ratio Salarial / CA" value={`${formData.revenue.total ? ((formData.expenses.salaries / formData.revenue.total) * 100).toFixed(1) : 0}%`} subtext={((formData.expenses.salaries / (formData.revenue.total || 1)) * 100) > 40 ? "Attention : Ratio Élevé" : "Ratio Maîtrisé"} icon={Calculator} colorClass={((formData.expenses.salaries / (formData.revenue.total || 1)) * 100) > 40 ? "text-amber-600" : "text-emerald-600"} bgClass={((formData.expenses.salaries / (formData.revenue.total || 1)) * 100) > 40 ? "bg-amber-50" : "bg-emerald-50"} />
                            </div>
                        </div>
                    </SectionCard>
                    </div>

                    <div className={stepMode && currentStep !== (showFuelTracking ? 3 : 2) ? 'hidden' : ''}>
                    <SectionCard className="scroll-mt-20" id="section-bfr">
                        <SectionHeader number={3 + (showFuelTracking ? 1 : 0)} title="BFR (Besoin en Fonds de Roulement)" icon={Scale} colorClass="text-cyan-700" bgClass="bg-cyan-100" hideNumber={stepMode} subtitle={stepMode ? "Ce que vos clients vous doivent (à gauche) et ce que vous devez à vos fournisseurs / État / URSSAF (à droite)." : undefined} />
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
                    </div>

                    <div className={stepMode && currentStep !== (showFuelTracking ? 4 : 3) ? 'hidden' : ''}>
                    <SectionCard className={`scroll-mt-20 ${isLocked ? "opacity-90 grayscale-[0.2]" : ""}`} id="section-tresorerie">
                        <SectionHeader number={4 + (showFuelTracking ? 1 : 0)} title="Situation de Trésorerie" icon={Landmark} colorClass="text-brand-700" bgClass="bg-brand-100" hideNumber={stepMode} subtitle={stepMode ? "Soldes bancaires à la fin du mois : vos disponibilités (comptes positifs) et vos concours (découverts)." : undefined} />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-emerald-700 border-b border-emerald-100 pb-2"><div className="p-1.5 bg-emerald-100 rounded-lg"><TrendingUp className="w-4 h-4" /></div><span className="font-bold text-sm uppercase tracking-wide">Disponibilités</span></div>
                                <SmartNumberInput label="Soldes Créditeurs" value={formData.cashFlow.active} onChange={(val: number) => handleChange('cashFlow', 'active', val)} className="border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50 text-emerald-900 font-bold" disabled={isLocked} definition={DEFINITIONS.treasuryPositive} n1Value={comparisonRecord?.cashFlow.active} prefix={<span className="text-emerald-500 font-bold">+</span>} />
                                <p className="text-xs text-slate-500 font-medium leading-tight">Comptes courants créditeurs, caisse espèces, livrets et placements disponibles.</p>
                            </div>
                            <div className="space-y-4 lg:border-l lg:border-r border-slate-100 lg:px-8">
                                <div className="flex items-center gap-2 text-red-700 border-b border-red-100 pb-2"><div className="p-1.5 bg-red-100 rounded-lg"><TrendingDown className="w-4 h-4" /></div><span className="font-bold text-sm uppercase tracking-wide">Concours Bancaires</span></div>
                                <SmartNumberInput label="Soldes Débiteurs" value={formData.cashFlow.passive} onChange={(val: number) => handleChange('cashFlow', 'passive', val)} className="border-red-200 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-900 font-bold" disabled={isLocked} definition={DEFINITIONS.treasuryNegative} n1Value={comparisonRecord?.cashFlow.passive} prefix={<span className="text-red-500 font-bold">-</span>} />
                                <p className="text-xs text-slate-500 font-medium leading-tight">Découverts autorisés ou non, facilités de caisse, emprunts court terme.</p>
                            </div>
                            <div className="flex flex-col h-full justify-center">
                                <ResultCard label="Trésorerie Nette" value={formatCurrency(formData.cashFlow.treasury)} subtext="Active - Passive" icon={Landmark} colorClass={formData.cashFlow.treasury >= 0 ? 'text-emerald-800' : 'text-red-800'} bgClass={formData.cashFlow.treasury >= 0 ? 'bg-emerald-50' : 'bg-red-50'} />
                            </div>
                        </div>
                    </SectionCard>
                    </div>
                </div>

                {/* STEPPER NAVIGATION */}
                {stepMode && (() => {
                    const totalSteps = 4 + (showFuelTracking ? 1 : 0);
                    const isLastStep = currentStep >= totalSteps - 1;
                    const isFirstStep = currentStep <= 0;
                    return (
                        <div className="mt-8 flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky bottom-0">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                                disabled={isFirstStep}
                                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-2"
                            >
                                ← Précédent
                            </button>
                            <span className="text-sm font-bold text-slate-500">
                                Étape {currentStep + 1} / {totalSteps}
                            </span>
                            {!isLastStep ? (
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(s => Math.min(totalSteps - 1, s + 1))}
                                    className="px-5 py-2.5 bg-brand-600 text-white rounded-lg shadow-md hover:bg-brand-700 hover:shadow-lg transition font-medium flex items-center gap-2"
                                >
                                    Suivant <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : userRole === 'client' && !isLocked && !isAdminOverride ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const validationErrors = validateRequiredFields(formData);
                                        if (validationErrors.length > 0) {
                                            await confirm({ title: 'Données incomplètes', message: `Merci de compléter les champs suivants avant de soumettre :\n\n• ${validationErrors.join('\n• ')}`, variant: 'danger', confirmLabel: 'Compris' });
                                            return;
                                        }
                                        const ok = await confirm({ title: 'Soumettre au cabinet ?', message: `Vos données de ${formData.month} ${formData.year} seront transmises au consultant.\n\nUne fois soumises, vous ne pourrez plus les modifier sans l'accord du cabinet.`, variant: 'info', confirmLabel: 'Soumettre' });
                                        if (ok) {
                                            // Cancel any pending debounced auto-save before submitting.
                                            flushAutoSave();
                                            wrappedOnSave(formData);
                                        }
                                    }}
                                    className="px-5 py-2.5 bg-brand-600 text-white rounded-lg shadow-md hover:bg-brand-700 hover:shadow-lg transition font-medium flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" /> Soumettre
                                </button>
                            ) : !isLocked ? (
                                <button
                                    type="button"
                                    onClick={() => wrappedOnSave(formData)}
                                    className="px-5 py-2.5 bg-brand-600 text-white rounded-lg shadow-md hover:bg-brand-700 hover:shadow-lg transition font-medium flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Enregistrer
                                </button>
                            ) : (
                                <span />
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default EntryForm;
