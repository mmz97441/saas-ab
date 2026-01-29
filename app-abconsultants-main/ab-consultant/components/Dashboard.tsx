
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell, LineChart
} from 'recharts';
import { FinancialRecord, Month, Client } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Users, MousePointerClick, Calendar, Filter, Check, Trophy, AlertCircle, Target, Droplets, ArrowRight, ArrowUpRight, ArrowDownRight, FileText, ShieldAlert, MessageSquare, Send, Bell, Clock, Fuel, Briefcase, Zap, Activity, ShoppingBag, Percent, Landmark } from 'lucide-react';
// @ts-ignore
import confetti from 'canvas-confetti';
import { toShortMonth } from '../services/dataService';

interface DashboardProps {
  data: FinancialRecord[];
  client: Client; // Added Client prop to access fiscalYearEnd and profitCenters
  userRole: 'ab_consultant' | 'client';
  onSaveComment: (record: FinancialRecord) => void;
}

type MetricType = 'revenue' | 'bfr' | 'productivity' | 'treasury' | 'fuel';

const COLORS_RECEIVABLES = ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9']; // Cyan/Teal shades for Assets
const COLORS_DEBTS = ['#be123c', '#e11d48', '#f43f5e', '#fb7185', '#fda4af']; // Rose shades for Liabilities
const COLORS_ACTIVITIES: string[] = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899']; // Extended Colors

// Standard calendar order
const standardMonthOrder = Object.values(Month);

// --- ANIMATION COMPONENTS ---

// Component to animate numbers (CountUp) with Dynamic Formatting
const AnimatedNumber = ({ value, format = true }: { value: number, format?: boolean }) => {
    const [displayValue, setDisplayValue] = useState(0);
    // Utiliser useRef pour éviter le problème de stale closure
    const previousValueRef = useRef(0);

    useEffect(() => {
        let startTime: number | null = null;
        const duration = 1000; // 1 second animation
        const startValue = previousValueRef.current;
        const endValue = value;

        if (startValue === endValue) return;

        let animationId: number;

        const step = (timestamp: number) => {
            if (startTime === null) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            // EaseOutQuart easing function for smooth finish
            const ease = 1 - Math.pow(1 - progress, 4);

            const current = startValue + (endValue - startValue) * ease;
            setDisplayValue(current);

            if (progress < 1) {
                animationId = window.requestAnimationFrame(step);
            } else {
                // Animation terminée, mettre à jour la référence
                previousValueRef.current = endValue;
            }
        };

        animationId = window.requestAnimationFrame(step);

        // Cleanup pour annuler l'animation si le composant est démonté
        return () => {
            if (animationId) {
                window.cancelAnimationFrame(animationId);
            }
        };
    }, [value]);

    if (format) {
        return <>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(displayValue)}</>;
    }
    return <>{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(displayValue)}</>;
};

// Helper for formatting (Dynamic 0-2 fraction digits)
const formatCurrency = (value: number, fractionDigits?: number) => 
    new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: 'EUR', 
        maximumFractionDigits: fractionDigits !== undefined ? fractionDigits : 2, // Default max 2
        minimumFractionDigits: fractionDigits !== undefined ? fractionDigits : 0  // Default min 0
    }).format(value);

const Dashboard: React.FC<DashboardProps> = ({ data, client, userRole, onSaveComment }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  
  // Year Selection
  const [selectedYear, setSelectedYear] = useState<number>(
    data.length > 0 ? Math.max(...data.map(d => d.year)) : new Date().getFullYear()
  );

  // Multi-Month Selection State (Empty array means "All Year")
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [celebrated, setCelebrated] = useState(false);

  // Comment State
  const [commentText, setCommentText] = useState('');

  // Determine if Fuel Card should be shown based on Client Settings
  const showFuelCard = client.settings?.showFuelTracking ?? false;

  // Update selected year when data changes (e.g. initial load)
  useEffect(() => {
    if (data.length > 0) {
      const years: number[] = Array.from(new Set(data.map(d => d.year)));
      if (!years.includes(selectedYear)) {
        setSelectedYear(Math.max(...years));
      }
    }
  }, [data, selectedYear]);

  // --- FISCAL YEAR LOGIC ---
  const fiscalMonthOrder = useMemo(() => {
      if (!client.fiscalYearEnd) return standardMonthOrder;
      const parts = client.fiscalYearEnd.split('/');
      if (parts.length !== 2) return standardMonthOrder;
      const closeMonthIndex = parseInt(parts[1], 10) - 1;
      if (isNaN(closeMonthIndex) || closeMonthIndex < 0 || closeMonthIndex > 11) return standardMonthOrder;
      const startMonthIndex = (closeMonthIndex + 1) % 12;
      return [
          ...standardMonthOrder.slice(startMonthIndex),
          ...standardMonthOrder.slice(0, startMonthIndex)
      ];
  }, [client.fiscalYearEnd]);

  // --- FILTERS LOGIC ---
  const handleMonthToggle = (month: string) => {
    setCelebrated(false);
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      } else {
        const newSelection = [...prev, month];
        return newSelection.sort((a, b) => fiscalMonthOrder.indexOf(a as Month) - fiscalMonthOrder.indexOf(b as Month));
      }
    });
  };

  const applyPreset = (preset: 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'S1' | 'S2') => {
    setCelebrated(false);
    switch (preset) {
      case 'ALL': setSelectedMonths([]); break;
      case 'Q1': setSelectedMonths(fiscalMonthOrder.slice(0, 3)); break;
      case 'Q2': setSelectedMonths(fiscalMonthOrder.slice(3, 6)); break;
      case 'Q3': setSelectedMonths(fiscalMonthOrder.slice(6, 9)); break;
      case 'Q4': setSelectedMonths(fiscalMonthOrder.slice(9, 12)); break;
      case 'S1': setSelectedMonths(fiscalMonthOrder.slice(0, 6)); break;
      case 'S2': setSelectedMonths(fiscalMonthOrder.slice(6, 12)); break;
    }
  };

  // --- DATA PROCESSING ---
  const yearData = useMemo(() => {
    let filtered = data.filter(d => d.year === selectedYear);
    filtered.sort((a, b) => fiscalMonthOrder.indexOf(a.month) - fiscalMonthOrder.indexOf(b.month));
    return filtered;
  }, [data, selectedYear, fiscalMonthOrder]);

  const displayData = useMemo(() => {
    if (selectedMonths.length === 0) return yearData;
    return yearData.filter(d => selectedMonths.includes(d.month));
  }, [yearData, selectedMonths]);

  const snapshotRecord = useMemo(() => {
    return displayData.length > 0 ? displayData[displayData.length - 1] : null;
  }, [displayData]);

  useEffect(() => {
      setCommentText(snapshotRecord?.expertComment || '');
  }, [snapshotRecord]);

  const handleSaveRestitution = () => {
      if (snapshotRecord) {
          const updatedRecord = { ...snapshotRecord, expertComment: commentText };
          onSaveComment(updatedRecord);
          // Alert is handled by App.tsx notification system
      }
  };

  // 4. Calculate KPIs
  const kpis = useMemo(() => {
    if (displayData.length === 0) {
       return {
         revenue: 0, objective: 0, bfr: 0, productivity: 0, productivityRate: 0, overtimeHours: 0,
         treasury: 0, revenuePerformance: '0', bfrComparison: null,
         fuelVolume: 0, fuelPerformance: '0',
         annualRevenueProgress: 0,
         fuelDetails: { 
             gasoil: { vol: 0, obj: 0 }, 
             sp: { vol: 0, obj: 0 }, 
             gnr: { vol: 0, obj: 0 } 
         },
         topActivities: [],
         globalMarginRate: 0
       };
    }

    const totalRevenue = displayData.reduce((acc, curr) => acc + curr.revenue.total, 0);
    const totalObjective = displayData.reduce((acc, curr) => acc + curr.revenue.objective, 0);
    const totalMargin = displayData.reduce((acc, curr) => acc + (curr.margin?.total || 0), 0);
    const totalHours = displayData.reduce((acc, curr) => acc + curr.expenses.hoursWorked, 0);
    const totalOvertime = displayData.reduce((acc, curr) => acc + (curr.expenses.overtimeHours || 0), 0);
    
    // FUEL TOTALS
    const totalFuel = displayData.reduce((acc, curr) => acc + (curr.fuel?.volume || 0), 0);
    const totalFuelObjective = displayData.reduce((acc, curr) => acc + (curr.fuel?.objective || 0), 0);

    // FUEL DETAILS (Volumes)
    const totalGasoil = displayData.reduce((acc, curr) => acc + (curr.fuel?.details?.gasoil.volume || 0), 0);
    const totalSP = displayData.reduce((acc, curr) => acc + (curr.fuel?.details?.sansPlomb.volume || 0), 0);
    const totalGNR = displayData.reduce((acc, curr) => acc + (curr.fuel?.details?.gnr.volume || 0), 0);

    // FUEL OBJECTIVES (Details)
    const totalGasoilObj = displayData.reduce((acc, curr) => acc + (curr.fuel?.details?.gasoil.objective || 0), 0);
    const totalSPObj = displayData.reduce((acc, curr) => acc + (curr.fuel?.details?.sansPlomb.objective || 0), 0);
    const totalGNRObj = displayData.reduce((acc, curr) => acc + (curr.fuel?.details?.gnr.objective || 0), 0);

    const annualRevenueTotal = yearData.reduce((acc, curr) => acc + curr.revenue.total, 0);
    const annualObjectiveTotal = yearData.reduce((acc, curr) => acc + curr.revenue.objective, 0);
    const annualRevenueProgress = annualObjectiveTotal > 0 ? (annualRevenueTotal / annualObjectiveTotal) * 100 : 0;

    const avgBfr = displayData.reduce((acc, curr) => acc + curr.bfr.total, 0) / displayData.length;
    const lastTreasury = snapshotRecord ? snapshotRecord.cashFlow.treasury : 0;
    const avgProdRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    // --- ACTIVITY BREAKDOWN CALCULATION ---
    const activitiesBreakdown: Record<string, { revenue: number, margin: number }> = {};
    let totalGoods = 0;
    let totalServices = 0;

    displayData.forEach(r => {
        totalGoods += r.revenue.goods || 0;
        totalServices += r.revenue.services || 0;

        if(r.revenue.breakdown) {
            Object.entries(r.revenue.breakdown).forEach(([k, v]) => {
                if (!activitiesBreakdown[k]) activitiesBreakdown[k] = { revenue: 0, margin: 0 };
                activitiesBreakdown[k].revenue += (v as number);
                if (r.margin?.breakdown?.[k]) {
                    activitiesBreakdown[k].margin += r.margin.breakdown[k];
                }
            });
        }
    });
    
    let topActivities = Object.entries(activitiesBreakdown)
        .map(([id, data]) => ({ 
            id, 
            val: data.revenue,
            marginRate: data.revenue > 0 ? (data.margin / data.revenue) * 100 : 0,
            name: client.profitCenters?.find(p => p.id === id)?.name || id.charAt(0).toUpperCase() + id.slice(1),
            percent: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
        }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5); 

    if (topActivities.length === 0 && totalRevenue > 0) {
        if (totalGoods > 0) {
            topActivities.push({ id: 'goods', val: totalGoods, marginRate: 0, name: 'Vente Marchandises', percent: (totalGoods / totalRevenue) * 100 });
        }
        if (totalServices > 0) {
            topActivities.push({ id: 'services', val: totalServices, marginRate: 0, name: 'Prestation Services', percent: (totalServices / totalRevenue) * 100 });
        }
        topActivities.sort((a, b) => b.val - a.val);
    }

    const globalMarginRate = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    return {
      revenue: totalRevenue,
      objective: totalObjective,
      bfr: avgBfr,
      productivity: totalHours,
      productivityRate: avgProdRate,
      overtimeHours: totalOvertime,
      treasury: lastTreasury,
      revenuePerformance: totalObjective > 0 ? ((totalRevenue / totalObjective) * 100).toFixed(1) : '0',
      bfrComparison: null,
      fuelVolume: totalFuel,
      fuelPerformance: totalFuelObjective > 0 ? ((totalFuel / totalFuelObjective) * 100).toFixed(1) : '0',
      annualRevenueProgress,
      fuelDetails: { 
          gasoil: { vol: totalGasoil, obj: totalGasoilObj }, 
          sp: { vol: totalSP, obj: totalSPObj }, 
          gnr: { vol: totalGNR, obj: totalGNRObj } 
      },
      topActivities,
      globalMarginRate
    };
  }, [displayData, snapshotRecord, yearData, client.profitCenters]);

  // Celebration
  useEffect(() => {
    const perf = parseFloat(kpis.revenuePerformance);
    if (!celebrated && perf >= 100 && kpis.revenue > 0) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#0ea5e9', '#f59e0b', '#10b981'] });
        setCelebrated(true);
    }
  }, [kpis, celebrated]);


  // Calculate Average Objective for the selected year (Global, not filtered by month selection)
  const averageObjectiveN = useMemo(() => {
    const recordsN = data.filter(d => d.year === selectedYear);
    if (recordsN.length === 0) return null;
    const totalObj = recordsN.reduce((acc, curr) => acc + curr.revenue.objective, 0);
    return totalObj / recordsN.length;
  }, [data, selectedYear]);


  // 5. Prepare Chart Data
  const chartData = useMemo(() => {
    const recordsN = data.filter(d => d.year === selectedYear);
    // FIX: Filter only months with revenue to avoid dragging down average with future/empty months
    const activeRecordsN = recordsN.filter(r => r.revenue.total > 0);
    const annualAverageN = activeRecordsN.length > 0 
        ? activeRecordsN.reduce((acc: number, curr: FinancialRecord) => acc + curr.revenue.total, 0) / activeRecordsN.length 
        : null;

    const recordsN1 = data.filter(d => d.year === selectedYear - 1);
    const activeRecordsN1 = recordsN1.filter(r => r.revenue.total > 0);
    const annualAverageN1 = activeRecordsN1.length > 0 
        ? activeRecordsN1.reduce((acc: number, curr: FinancialRecord) => acc + curr.revenue.total, 0) / activeRecordsN1.length 
        : null;

    const fullYearChartData = fiscalMonthOrder.map(m => {
      const recordN = data.find(d => d.year === selectedYear && d.month === m);
      const recordN1 = data.find(d => d.year === selectedYear - 1 && d.month === m);
      
      const productivityRate = (recordN && recordN.expenses.hoursWorked > 0) ? recordN.revenue.total / recordN.expenses.hoursWorked : null;
      const productivityRateN1 = (recordN1 && recordN1.expenses.hoursWorked > 0) ? recordN1.revenue.total / recordN1.expenses.hoursWorked : null;

      return {
        name: toShortMonth(m), // Using short month name for Axis
        fullMonth: m,
        CA: recordN ? recordN.revenue.total : null,
        CA_N1: recordN1 ? recordN1.revenue.total : null,
        Objectif: recordN ? recordN.revenue.objective : null, 
        Moyenne_N: annualAverageN,
        Moyenne_N1: annualAverageN1,
        BFR: recordN ? recordN.bfr.total : null,
        BFR_N1: recordN1 ? recordN1.bfr.total : null,
        Tresorerie: recordN ? recordN.cashFlow.treasury : null,
        Tresorerie_N1: recordN1 ? recordN1.cashFlow.treasury : null,
        Productivity: recordN ? recordN.expenses.hoursWorked : null,
        Productivity_N1: recordN1 ? recordN1.expenses.hoursWorked : null,
        ProductivityRate: productivityRate,
        ProductivityRate_N1: productivityRateN1,
        BFR_Creances: recordN ? recordN.bfr.receivables.total : null,
        BFR_Stocks: recordN ? recordN.bfr.stock.total : null,
        BFR_Dettes: recordN ? -recordN.bfr.debts.total : null,
        Fuel_Total: recordN ? recordN.fuel?.volume : null,
        Fuel_Gasoil: recordN ? recordN.fuel?.details?.gasoil.volume : null,
        Fuel_SP: recordN ? recordN.fuel?.details?.sansPlomb.volume : null,
        Fuel_GNR: recordN ? recordN.fuel?.details?.gnr.volume : null,
        Fuel_Total_N1: recordN1 ? recordN1.fuel?.volume : null,
      };
    });

    if (selectedMonths.length === 0) return fullYearChartData;
    return fullYearChartData.filter(d => selectedMonths.includes(d.fullMonth));

  }, [data, selectedYear, selectedMonths, fiscalMonthOrder]);

  const receivablesData = useMemo(() => {
    if (!snapshotRecord) return [];
    return [
      { name: 'Clients', value: snapshotRecord.bfr.receivables.clients },
      { name: 'État', value: snapshotRecord.bfr.receivables.state },
      { name: 'Org. Sociaux', value: snapshotRecord.bfr.receivables.social },
      { name: 'Autres', value: snapshotRecord.bfr.receivables.other },
    ].filter(item => item.value > 0);
  }, [snapshotRecord]);

  const debtsData = useMemo(() => {
    if (!snapshotRecord) return [];
    return [
      { name: 'Fournisseurs', value: snapshotRecord.bfr.debts.suppliers },
      { name: 'État', value: snapshotRecord.bfr.debts.state },
      { name: 'Org. Sociaux', value: snapshotRecord.bfr.debts.social },
      { name: 'Salariés', value: snapshotRecord.bfr.debts.salaries },
      { name: 'Autres', value: snapshotRecord.bfr.debts.other },
    ].filter(item => item.value > 0);
  }, [snapshotRecord]);

  const handleChartClick = (data: any) => {
    let clickedMonth: string | null = null;
    if (data && data.activePayload && data.activePayload.length > 0) {
      clickedMonth = data.activePayload[0].payload.fullMonth;
    } else if (data && data.fullMonth) {
      clickedMonth = data.fullMonth;
    } else if (data && data.payload && data.payload.fullMonth) {
        clickedMonth = data.payload.fullMonth;
    }

    if (clickedMonth) {
      setCelebrated(false);
      setSelectedMonths(prev => {
          if (prev.length === 1 && prev[0] === clickedMonth) return [];
          return [clickedMonth as string];
      });
    }
  };

  const CustomTooltip = ({ active, payload, label, type }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const isRevenue = type === 'revenue';
    const isBfr = type === 'bfr';
    const isTreasury = type === 'treasury';
    const isProductivity = type === 'productivity';
    const isFuel = type === 'fuel';
    
    let variation = 0;
    let hasN1 = false;

    const calcVariation = (current: any, previous: any): number | null => {
        const c = Number(current);
        const p = Number(previous);
        if (!isNaN(c) && !isNaN(p) && p !== 0) {
             return ((c - p) / Math.abs(p)) * 100;
        }
        return null;
    };

    if (isRevenue && data.CA_N1) { 
        const v = calcVariation(data.CA, data.CA_N1);
        if (v !== null) { variation = v; hasN1 = true; }
    }
    else if (isBfr && data.BFR_N1) {
        const v = calcVariation(data.BFR, data.BFR_N1);
        if (v !== null) { variation = v; hasN1 = true; }
    } 
    else if (isTreasury && data.Tresorerie_N1) {
        const v = calcVariation(data.Tresorerie, data.Tresorerie_N1);
        if (v !== null) { variation = v; hasN1 = true; }
    }
    else if (isProductivity && data.Productivity_N1) {
        const v = calcVariation(data.Productivity, data.Productivity_N1);
        if (v !== null) { variation = v; hasN1 = true; }
    }
    else if (isFuel && data.Fuel_Total_N1) {
        const v = calcVariation(data.Fuel_Total, data.Fuel_Total_N1);
        if (v !== null) { variation = v; hasN1 = true; }
    }

    return (
      <div className="bg-white/95 backdrop-blur-sm p-5 border border-slate-100 shadow-2xl rounded-2xl ring-1 ring-slate-900/5 min-w-[280px]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
          <span className="font-bold text-slate-700 capitalize">{data.fullMonth} {selectedYear}</span>
        </div>
        
        {isRevenue && (
            <>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">CA Réalisé</span>
                    <span className="font-bold text-brand-700">{formatCurrency(data.CA)}</span>
                </div>
                {data.Objectif > 0 && (
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-500">Objectif</span>
                        <span className="font-bold text-amber-500">{formatCurrency(data.Objectif)}</span>
                    </div>
                )}
                {hasN1 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs text-slate-400">vs N-1</span>
                        <span className={`text-xs font-bold ${variation >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                        </span>
                    </div>
                )}
            </>
        )}

        {isBfr && (
             <>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">BFR Net</span>
                    <span className="font-bold text-cyan-700">{formatCurrency(data.BFR)}</span>
                </div>
             </>
        )}

        {isFuel && (
            <>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">Volume Total</span>
                    <span className="font-bold text-blue-700">{Math.round(data.Fuel_Total).toLocaleString()} L</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-2 text-[10px] text-center">
                    <div className="bg-slate-50 rounded p-1">
                        <span className="block text-slate-400">Gasoil</span>
                        <span className="font-bold text-slate-700">{Math.round(data.Fuel_Gasoil || 0)}</span>
                    </div>
                    <div className="bg-slate-50 rounded p-1">
                        <span className="block text-slate-400">SP</span>
                        <span className="font-bold text-slate-700">{Math.round(data.Fuel_SP || 0)}</span>
                    </div>
                    <div className="bg-slate-50 rounded p-1">
                        <span className="block text-slate-400">GNR</span>
                        <span className="font-bold text-slate-700">{Math.round(data.Fuel_GNR || 0)}</span>
                    </div>
                </div>
            </>
        )}
      </div>
    );
  };

  const currentMetricData = selectedMetric === 'revenue' 
    ? { 
        val: kpis.revenue, 
        obj: kpis.objective, 
        perf: kpis.revenuePerformance, 
        label: "Chiffre d'Affaires", 
        color: "text-brand-600",
        icon: DollarSign 
      }
    : selectedMetric === 'bfr'
    ? {
        val: kpis.bfr,
        obj: 0,
        perf: null,
        label: "BFR Moyen",
        color: "text-cyan-600",
        icon: Briefcase
      }
    : selectedMetric === 'treasury'
    ? {
        val: kpis.treasury,
        obj: 0,
        perf: null,
        label: "Trésorerie Nette",
        color: kpis.treasury >= 0 ? "text-emerald-600" : "text-red-600",
        icon: Landmark
      }
    : selectedMetric === 'productivity'
    ? {
        val: kpis.productivity,
        obj: 0,
        perf: null,
        label: "Heures Travaillées",
        color: "text-orange-600",
        icon: Users
      }
    : {
        val: kpis.fuelVolume,
        obj: 0, // Should be kpis.fuelObjective but simplified for now
        perf: kpis.fuelPerformance,
        label: "Litrage Carburant",
        color: "text-blue-600",
        icon: Droplets
      };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER: Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-brand-100">
         <div className="flex items-center gap-4">
             {/* Year Selector */}
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Exercice</span>
                <div className="relative">
                    <select 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="appearance-none bg-brand-50 border border-brand-200 text-brand-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block pl-3 pr-8 py-2 font-bold cursor-pointer hover:bg-brand-100 transition-colors"
                    >
                       {Array.from(new Set(data.map(d => d.year))).sort((a,b)=>b-a).map(y => (
                           <option key={y} value={y}>{y}</option>
                       ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brand-500">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
             </div>

             {/* Period Presets */}
             <div className="flex gap-1 bg-brand-50 p-1 rounded-lg">
                {['ALL', 'S1', 'S2', 'Q1', 'Q2', 'Q3', 'Q4'].map(p => (
                    <button
                        key={p}
                        onClick={() => applyPreset(p as any)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                            (p === 'ALL' && selectedMonths.length === 0) 
                            ? 'bg-white text-brand-700 shadow-sm' 
                            : 'text-brand-400 hover:text-brand-600 hover:bg-brand-100'
                        }`}
                    >
                        {p === 'ALL' ? 'ANNÉE' : p}
                    </button>
                ))}
             </div>
         </div>
         
         {/* Active Filters Display */}
         {selectedMonths.length > 0 && (
             <div className="flex items-center gap-2 bg-brand-50 text-brand-600 px-3 py-1.5 rounded-full text-xs font-bold border border-brand-200">
                 <Filter className="w-3 h-3" />
                 {selectedMonths.length} mois sélectionné{selectedMonths.length > 1 ? 's' : ''}
                 <button onClick={() => applyPreset('ALL')} className="ml-1 hover:text-red-500"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
         )}
      </div>

      {/* KPIS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         
         {/* REVENUE CARD */}
         <div 
            onClick={() => setSelectedMetric('revenue')}
            className={`cursor-pointer p-5 rounded-xl border transition-all duration-300 relative overflow-hidden group ${selectedMetric === 'revenue' ? 'bg-brand-900 border-brand-800 text-white ring-2 ring-brand-500 ring-offset-2' : 'bg-white border-brand-100 hover:border-brand-300 hover:shadow-md'}`}
         >
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-lg ${selectedMetric === 'revenue' ? 'bg-white/10' : 'bg-brand-50 text-brand-600'}`}>
                    <DollarSign className="w-5 h-5" />
                </div>
                <div className={`text-xs font-bold px-2 py-1 rounded-full ${selectedMetric === 'revenue' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                    {kpis.revenuePerformance}% Obj
                </div>
            </div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${selectedMetric === 'revenue' ? 'text-brand-300' : 'text-slate-400'}`}>Chiffre d'Affaires</p>
            <h3 className={`text-2xl font-bold ${selectedMetric === 'revenue' ? 'text-white' : 'text-slate-800'}`}>
                <AnimatedNumber value={kpis.revenue} />
            </h3>
            {/* Progress Bar */}
            <div className="mt-3 h-1.5 w-full bg-slate-200/20 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ${parseFloat(kpis.revenuePerformance) >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                    style={{ width: `${Math.min(parseFloat(kpis.revenuePerformance), 100)}%` }}
                />
            </div>
         </div>

         {/* MARGIN CARD */}
         <div className="bg-white p-5 rounded-xl border border-brand-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <PieChart className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                    Marge
                </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">Taux de Marge Global</p>
            <h3 className="text-2xl font-bold text-slate-800">
                {kpis.globalMarginRate.toFixed(1)}%
            </h3>
            <p className="text-xs text-slate-500 mt-1">Sur CA HT total</p>
         </div>

         {/* TREASURY CARD */}
         <div 
            onClick={() => setSelectedMetric('treasury')}
            className={`cursor-pointer p-5 rounded-xl border transition-all duration-300 ${selectedMetric === 'treasury' ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500 ring-offset-2' : 'bg-white border-brand-100 hover:border-brand-300 hover:shadow-md'}`}
         >
             <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-lg ${kpis.treasury >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    <Landmark className="w-5 h-5" />
                </div>
             </div>
             <p className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">Trésorerie Nette</p>
             <h3 className={`text-2xl font-bold ${kpis.treasury >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                <AnimatedNumber value={kpis.treasury} />
             </h3>
             <p className="text-xs text-slate-500 mt-1">Situation fin de période</p>
         </div>

         {/* BFR CARD */}
         <div 
            onClick={() => setSelectedMetric('bfr')}
            className={`cursor-pointer p-5 rounded-xl border transition-all duration-300 ${selectedMetric === 'bfr' ? 'bg-cyan-50 border-cyan-200 ring-2 ring-cyan-500 ring-offset-2' : 'bg-white border-brand-100 hover:border-brand-300 hover:shadow-md'}`}
         >
             <div className="flex justify-between items-start mb-2">
                <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600">
                    <Briefcase className="w-5 h-5" />
                </div>
             </div>
             <p className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">BFR Moyen</p>
             <h3 className="text-2xl font-bold text-cyan-800">
                <AnimatedNumber value={kpis.bfr} />
             </h3>
             <p className="text-xs text-slate-500 mt-1">Besoin en fonds de roulement</p>
         </div>
         
         {/* OPTIONAL: FUEL CARD (IF ENABLED) */}
         {showFuelCard && (
             <div 
                onClick={() => setSelectedMetric('fuel')}
                className={`md:col-span-2 lg:col-span-1 cursor-pointer p-5 rounded-xl border transition-all duration-300 ${selectedMetric === 'fuel' ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500 ring-offset-2' : 'bg-white border-brand-100 hover:border-brand-300 hover:shadow-md'}`}
             >
                 <div className="flex justify-between items-start mb-2">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                        <Fuel className="w-5 h-5" />
                    </div>
                 </div>
                 <p className="text-xs font-bold uppercase tracking-wider mb-1 text-slate-400">Carburant</p>
                 <h3 className="text-2xl font-bold text-blue-800">
                    {Math.round(kpis.fuelVolume).toLocaleString()} L
                 </h3>
                 <p className="text-xs text-slate-500 mt-1">Consommation Totale</p>
             </div>
         )}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* MAIN CHART (2 Cols) */}
         <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-brand-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-brand-900 flex items-center gap-2">
                    <currentMetricData.icon className={`w-5 h-5 ${currentMetricData.color}`} />
                    Évolution : {currentMetricData.label}
                </h3>
                <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-brand-500 rounded-sm"></div> Exercice N</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-300 rounded-sm"></div> N-1</span>
                </div>
            </div>
            
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} onClick={handleChartClick} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val: any) => { const v = Number(val); return !isNaN(v) && v >= 1000 ? `${((v as number) / 1000).toFixed(0)}k` : String(val); }} />
                        <Tooltip content={<CustomTooltip type={selectedMetric} />} cursor={{ fill: '#f8fafc' }} />
                        
                        {/* CHART LOGIC SWITCHER */}
                        {selectedMetric === 'revenue' && (
                            <>
                                <Bar dataKey="CA_N1" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="CA" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={20} />
                                <Line type="monotone" dataKey="Objectif" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                            </>
                        )}
                        {selectedMetric === 'bfr' && (
                            <>
                                <Line type="monotone" dataKey="BFR_N1" stroke="#94a3b8" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="BFR" stroke="#06b6d4" strokeWidth={3} activeDot={{ r: 6 }} />
                            </>
                        )}
                        {selectedMetric === 'treasury' && (
                            <>
                                <ReferenceLine y={0} stroke="#cbd5e1" />
                                <Area type="monotone" dataKey="Tresorerie" fill="url(#colorTreasury)" stroke={kpis.treasury >= 0 ? "#10b981" : "#ef4444"} strokeWidth={2} />
                                <defs>
                                    <linearGradient id="colorTreasury" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={kpis.treasury >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor={kpis.treasury >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                            </>
                        )}
                         {selectedMetric === 'fuel' && (
                            <>
                                <Bar dataKey="Fuel_Total_N1" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="Fuel_Total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            </>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
         </div>

         {/* SIDE PANEL (1 Col) - Breakdown or Details */}
         <div className="space-y-6">
             
             {/* ACTIVITY BREAKDOWN (If Available) */}
             {kpis.topActivities.length > 0 && (
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100 h-full">
                     <h3 className="text-sm font-bold text-brand-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                        <ShoppingBag className="w-4 h-4 text-purple-500" /> Répartition Activité
                     </h3>
                     <div className="space-y-4">
                         {kpis.topActivities.map((act, idx) => (
                             <div key={act.id} className="relative">
                                 <div className="flex justify-between items-end mb-1">
                                     <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]" title={act.name}>{act.name}</span>
                                     <span className="text-sm font-bold text-brand-900">{act.percent.toFixed(0)}%</span>
                                 </div>
                                 <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full rounded-full" 
                                        style={{ 
                                            width: `${act.percent}%`, 
                                            backgroundColor: COLORS_ACTIVITIES[Number(idx) % COLORS_ACTIVITIES.length] 
                                        }} 
                                     />
                                 </div>
                                 <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                     <span>{formatCurrency(act.val)}</span>
                                     <span>Marge: {act.marginRate.toFixed(1)}%</span>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* BFR BREAKDOWN (Toujours visible) */}
             {snapshotRecord && (receivablesData.length > 0 || debtsData.length > 0) && (
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100">
                      <h3 className="text-sm font-bold text-brand-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                        <Briefcase className="w-4 h-4 text-cyan-500" /> Structure du BFR
                     </h3>
                     <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={receivablesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#06b6d4">
                                    {receivablesData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_RECEIVABLES[Number(index) % COLORS_RECEIVABLES.length]} />)}
                                </Pie>
                                <Pie data={debtsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={85} fill="#e11d48">
                                    {debtsData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_DEBTS[Number(index) % COLORS_DEBTS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="flex justify-between text-xs text-center mt-2 font-bold">
                         <span className="text-cyan-600">Actif (Int.)</span>
                         <span className="text-red-600">Passif (Ext.)</span>
                     </div>

                     {/* Détails numériques */}
                     <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                         <div className="space-y-1">
                             <p className="font-bold text-cyan-700 uppercase text-[10px]">Créances</p>
                             {receivablesData.map((item, idx) => (
                                 <div key={idx} className="flex justify-between">
                                     <span className="text-slate-500">{item.name}</span>
                                     <span className="font-bold text-slate-700">{formatCurrency(item.value)}</span>
                                 </div>
                             ))}
                         </div>
                         <div className="space-y-1">
                             <p className="font-bold text-red-600 uppercase text-[10px]">Dettes</p>
                             {debtsData.map((item, idx) => (
                                 <div key={idx} className="flex justify-between">
                                     <span className="text-slate-500">{item.name}</span>
                                     <span className="font-bold text-slate-700">{formatCurrency(item.value)}</span>
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
             )}
         </div>
      </div>

      {/* EXPERT COMMENT SECTION */}
      <div className="bg-white rounded-xl shadow-lg border border-brand-100 overflow-hidden">
          <div className="bg-brand-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-accent-500" /> 
                  Le mot du Consultant
                  {snapshotRecord && (
                      <span className="text-xs font-normal opacity-70 ml-2 bg-brand-800 px-2 py-0.5 rounded-full">
                          {snapshotRecord.month} {snapshotRecord.year}
                      </span>
                  )}
              </h3>
              {userRole === 'ab_consultant' && snapshotRecord && (
                  <button 
                    onClick={handleSaveRestitution}
                    className="text-xs bg-accent-500 hover:bg-accent-600 text-brand-950 px-3 py-1.5 rounded-lg font-bold transition shadow-sm flex items-center gap-1"
                  >
                      <Send className="w-3 h-3" /> Enregistrer
                  </button>
              )}
          </div>
          <div className="p-6">
              {userRole === 'ab_consultant' ? (
                  <textarea 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={snapshotRecord ? "Rédigez votre analyse pour ce mois (Optionnel)..." : "Aucune donnée sélectionnée."}
                    disabled={!snapshotRecord}
                    className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none text-sm text-slate-700 bg-slate-50 font-medium leading-relaxed disabled:opacity-50"
                  />
              ) : (
                  <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      {commentText ? (
                          <div className="whitespace-pre-line leading-relaxed">{commentText}</div>
                      ) : (
                          <p className="italic text-slate-400 flex items-center gap-2">
                              <Clock className="w-4 h-4" /> Analyse en cours de rédaction...
                          </p>
                      )}
                  </div>
              )}
          </div>
      </div>

    </div>
  );
};

export default Dashboard;
