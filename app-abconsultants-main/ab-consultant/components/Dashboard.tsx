
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

const COLORS_RECEIVABLES = ['#0891b2', '#06b6d4', '#22d3ee', '#67e8f9']; // Cyan/Teal shades for Assets
const COLORS_DEBTS = ['#be123c', '#e11d48', '#f43f5e', '#fb7185', '#fda4af']; // Rose shades for Liabilities
const COLORS_ACTIVITIES: string[] = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899']; // Extended Colors

// Standard calendar order
const standardMonthOrder = Object.values(Month);

// --- ANIMATION COMPONENTS ---

// Component to animate numbers (CountUp) with Dynamic Formatting
// FIX: Added cancelAnimationFrame cleanup to prevent memory leak on unmount
const AnimatedNumber = ({ value, format = true }: { value: number, format?: boolean }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        let startTime: number | null = null;
        const duration = 1000;
        const startValue = displayValue;
        const endValue = value;

        if (startValue === endValue) return;

        const step = (timestamp: number) => {
            if (startTime === null) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            const ease = 1 - Math.pow(1 - progress, 4);

            const current = startValue + (endValue - startValue) * ease;
            setDisplayValue(current);

            if (progress < 1) {
                rafRef.current = window.requestAnimationFrame(step);
            }
        };

        rafRef.current = window.requestAnimationFrame(step);

        // Cleanup: cancel animation on unmount or value change
        return () => {
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
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
         globalMarginRate: 0,
         revenueVariation: null,
         treasuryVariation: null,
         bfrVariation: null,
         marginVariation: null,
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

    // --- N-1 COMPARISONS ---
    const n1Data = data.filter(d => d.year === selectedYear - 1);
    const n1Filtered = selectedMonths.length === 0 ? n1Data : n1Data.filter(d => selectedMonths.includes(d.month));
    const n1Revenue = n1Filtered.reduce((acc, curr) => acc + curr.revenue.total, 0);
    const n1Treasury = n1Filtered.length > 0 ? n1Filtered[n1Filtered.length - 1].cashFlow.treasury : null;
    const n1Bfr = n1Filtered.length > 0 ? n1Filtered.reduce((acc, curr) => acc + curr.bfr.total, 0) / n1Filtered.length : null;
    const n1Margin = n1Filtered.reduce((acc, curr) => acc + (curr.margin?.total || 0), 0);
    const n1MarginRate = n1Revenue > 0 ? (n1Margin / n1Revenue) * 100 : null;

    const revenueVariation = n1Revenue > 0 ? ((totalRevenue - n1Revenue) / n1Revenue) * 100 : null;
    const treasuryVariation = n1Treasury !== null && n1Treasury !== 0 ? ((lastTreasury - n1Treasury) / Math.abs(n1Treasury)) * 100 : null;
    const bfrVariation = n1Bfr !== null && n1Bfr !== 0 ? ((avgBfr - n1Bfr) / Math.abs(n1Bfr)) * 100 : null;
    const marginVariation = n1MarginRate !== null ? globalMarginRate - n1MarginRate : null;

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
      globalMarginRate,
      revenueVariation,
      treasuryVariation,
      bfrVariation,
      marginVariation,
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


  // BFR stacked chart data (evolution créances / stocks / dettes)
  const bfrStackedData = useMemo(() => {
    return chartData.map(d => ({
      name: d.name,
      fullMonth: d.fullMonth,
      Creances: d.BFR_Creances ?? 0,
      Stocks: d.BFR_Stocks ?? 0,
      Dettes: d.BFR_Dettes ?? 0,
      BFR_Net: d.BFR ?? 0,
    }));
  }, [chartData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER: Year + Period Presets + Month Grid */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-100 space-y-3">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
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
                        {p === 'ALL' ? 'ANNEE' : p}
                    </button>
                ))}
             </div>
           </div>

           {/* Active Filters Display */}
           {selectedMonths.length > 0 && (
             <div className="flex items-center gap-2 bg-brand-50 text-brand-600 px-3 py-1.5 rounded-full text-xs font-bold border border-brand-200">
                 <Filter className="w-3 h-3" />
                 {selectedMonths.length} mois selectionne{selectedMonths.length > 1 ? 's' : ''}
                 <button onClick={() => applyPreset('ALL')} className="ml-1 hover:text-red-500"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
           )}
         </div>

         {/* MONTH GRID - Clickable months */}
         <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
            {fiscalMonthOrder.map(m => {
              const hasData = yearData.some(d => d.month === m);
              const isSelected = selectedMonths.includes(m);
              const shortName = toShortMonth(m);
              return (
                <button
                  key={m}
                  onClick={() => handleMonthToggle(m)}
                  className={`px-1 py-2 text-[10px] font-bold rounded-lg transition-all border ${
                    isSelected
                      ? 'bg-brand-900 text-white border-brand-800 shadow-sm'
                      : hasData
                      ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100 hover:border-brand-300'
                      : 'bg-slate-50 text-slate-300 border-slate-100 cursor-default'
                  }`}
                  disabled={!hasData}
                >
                  {shortName}
                </button>
              );
            })}
         </div>
      </div>

      {/* KPIS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

         {/* REVENUE CARD */}
         <div className="p-4 rounded-xl border bg-white border-brand-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-1">
                <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
                    <DollarSign className="w-4 h-4" />
                </div>
                <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {kpis.revenuePerformance}% Obj
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">Chiffre d'Affaires</p>
            <h3 className="text-xl font-bold text-slate-800">
                <AnimatedNumber value={kpis.revenue} />
            </h3>
            {kpis.revenueVariation !== null && (
              <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${kpis.revenueVariation >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {kpis.revenueVariation >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpis.revenueVariation > 0 ? '+' : ''}{kpis.revenueVariation.toFixed(1)}% vs N-1
              </div>
            )}
            <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${parseFloat(kpis.revenuePerformance) >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(parseFloat(kpis.revenuePerformance), 100)}%` }} />
            </div>
         </div>

         {/* MARGIN CARD */}
         <div className="bg-white p-4 rounded-xl border border-brand-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-1">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                    <Percent className="w-4 h-4" />
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">Taux de Marge</p>
            <h3 className="text-xl font-bold text-slate-800">
                {kpis.globalMarginRate.toFixed(1)}%
            </h3>
            {kpis.marginVariation !== null && (
              <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${kpis.marginVariation >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {kpis.marginVariation >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpis.marginVariation > 0 ? '+' : ''}{kpis.marginVariation.toFixed(1)} pts vs N-1
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1">Sur CA HT total</p>
         </div>

         {/* TREASURY CARD */}
         <div className={`p-4 rounded-xl border shadow-sm ${kpis.treasury < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-brand-100'}`}>
             <div className="flex justify-between items-start mb-1">
                <div className={`p-1.5 rounded-lg ${kpis.treasury >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    <Landmark className="w-4 h-4" />
                </div>
                {kpis.treasury < 0 && <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">ALERTE</div>}
             </div>
             <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">Tresorerie Nette</p>
             <h3 className={`text-xl font-bold ${kpis.treasury >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                <AnimatedNumber value={kpis.treasury} />
             </h3>
             {kpis.treasuryVariation !== null && (
               <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${kpis.treasuryVariation >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                 {kpis.treasuryVariation >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                 {kpis.treasuryVariation > 0 ? '+' : ''}{kpis.treasuryVariation.toFixed(1)}% vs N-1
               </div>
             )}
         </div>

         {/* BFR CARD */}
         <div className="p-4 rounded-xl border bg-white border-brand-100 shadow-sm">
             <div className="flex justify-between items-start mb-1">
                <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-600">
                    <Briefcase className="w-4 h-4" />
                </div>
             </div>
             <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400">BFR Moyen</p>
             <h3 className="text-xl font-bold text-cyan-800">
                <AnimatedNumber value={kpis.bfr} />
             </h3>
             {kpis.bfrVariation !== null && (
               <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${kpis.bfrVariation <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                 {kpis.bfrVariation <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                 {kpis.bfrVariation > 0 ? '+' : ''}{kpis.bfrVariation.toFixed(1)}% vs N-1
               </div>
             )}
         </div>
      </div>

      {/* ============================================= */}
      {/* ROW 1: CA + Tresorerie side by side           */}
      {/* ============================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         {/* CA Chart */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-brand-600" />
                    Chiffre d'Affaires
                </h3>
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-brand-900 rounded-sm"></div> N</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-sm"></div> N-1</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-amber-500"></div> Obj</span>
                </div>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} onClick={handleChartClick} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val: any) => { const v = Number(val); return !isNaN(v) && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(val); }} />
                        <Tooltip content={<CustomTooltip type="revenue" />} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="CA_N1" fill="#e2e8f0" radius={[3, 3, 0, 0]} barSize={16} name="CA N-1" />
                        <Bar dataKey="CA" fill="#0f172a" radius={[3, 3, 0, 0]} barSize={16} name="CA N" />
                        <Line type="monotone" dataKey="Objectif" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
         </div>

         {/* Tresorerie Chart */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                    <Landmark className={`w-4 h-4 ${kpis.treasury >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                    Tresorerie
                </h3>
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1"><div className={`w-2 h-2 rounded-sm ${kpis.treasury >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div> N</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-sm"></div> N-1</span>
                </div>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} onClick={handleChartClick} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} allowDataOverflow={false} tickFormatter={(val: any) => { const v = Number(val); return !isNaN(v) && Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(val); }} />
                        <Tooltip content={<CustomTooltip type="treasury" />} cursor={{ fill: '#f8fafc' }} />
                        <ReferenceLine y={0} stroke="#cbd5e1" />
                        <defs>
                            <linearGradient id="colorTreasury" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={kpis.treasury >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={kpis.treasury >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="Tresorerie" fill="url(#colorTreasury)" stroke={kpis.treasury >= 0 ? "#10b981" : "#ef4444"} strokeWidth={2} name="Tresorerie" />
                        <Line type="monotone" dataKey="Tresorerie_N1" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Tresorerie N-1" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* ============================================= */}
      {/* ROW 2: BFR Evolution + Repartition BFR        */}
      {/* ============================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

         {/* BFR Evolution (stacked: creances, stocks, dettes) */}
         <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-brand-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-cyan-600" />
                    Evolution du BFR
                </h3>
                <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-cyan-500 rounded-sm"></div> Creances</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-500 rounded-sm"></div> Stocks</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-sm"></div> Dettes</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-slate-800"></div> BFR Net</span>
                </div>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={bfrStackedData} onClick={handleChartClick} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val: any) => { const v = Number(val); return !isNaN(v) && Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(val); }} />
                        <Tooltip formatter={(value: any, name: string) => [formatCurrency(Number(value)), name]} />
                        <ReferenceLine y={0} stroke="#cbd5e1" />
                        <Bar dataKey="Creances" stackId="bfr" fill="#06b6d4" radius={[0, 0, 0, 0]} barSize={24} name="Creances" />
                        <Bar dataKey="Stocks" stackId="bfr" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={24} name="Stocks" />
                        <Bar dataKey="Dettes" stackId="bfr" fill="#f43f5e" radius={[0, 0, 0, 0]} barSize={24} name="Dettes (-)" />
                        <Line type="monotone" dataKey="BFR_Net" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: '#0f172a' }} name="BFR Net" />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
         </div>

         {/* BFR Breakdown - Pie Charts (ALWAYS VISIBLE) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-100">
            <h3 className="text-sm font-bold text-brand-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Briefcase className="w-4 h-4 text-cyan-500" /> Repartition du BFR
            </h3>
            {snapshotRecord ? (
              <>
                <p className="text-[10px] text-slate-400 text-center mb-2">{snapshotRecord.month} {snapshotRecord.year}</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={receivablesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} fill="#06b6d4" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                              {receivablesData.map((_entry, index) => <Cell key={`recv-${index}`} fill={COLORS_RECEIVABLES[Number(index) % COLORS_RECEIVABLES.length]} />)}
                          </Pie>
                          <Pie data={debtsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={80} fill="#e11d48">
                              {debtsData.map((_entry, index) => <Cell key={`debt-${index}`} fill={COLORS_DEBTS[Number(index) % COLORS_DEBTS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                      </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-xs text-center mt-2 font-bold">
                    <span className="text-cyan-600">Creances (int.)</span>
                    <span className="text-red-600">Dettes (ext.)</span>
                </div>

                {/* BFR Detail Table */}
                <div className="mt-4 space-y-1 text-xs">
                  <div className="font-bold text-cyan-700 mb-1">Actif circulant</div>
                  <div className="flex justify-between text-slate-600"><span>Clients</span><span>{formatCurrency(snapshotRecord.bfr.receivables.clients)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Etat</span><span>{formatCurrency(snapshotRecord.bfr.receivables.state)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Org. Sociaux</span><span>{formatCurrency(snapshotRecord.bfr.receivables.social)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Autres</span><span>{formatCurrency(snapshotRecord.bfr.receivables.other)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Stocks</span><span>{formatCurrency(snapshotRecord.bfr.stock.total)}</span></div>
                  <div className="flex justify-between font-bold text-cyan-800 border-t border-slate-100 pt-1 mt-1"><span>Total Actif</span><span>{formatCurrency(snapshotRecord.bfr.receivables.total + snapshotRecord.bfr.stock.total)}</span></div>

                  <div className="font-bold text-red-700 mt-3 mb-1">Passif circulant</div>
                  <div className="flex justify-between text-slate-600"><span>Fournisseurs</span><span>{formatCurrency(snapshotRecord.bfr.debts.suppliers)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Dettes Fiscales</span><span>{formatCurrency(snapshotRecord.bfr.debts.state)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Dettes Sociales</span><span>{formatCurrency(snapshotRecord.bfr.debts.social)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Salaires</span><span>{formatCurrency(snapshotRecord.bfr.debts.salaries)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Autres</span><span>{formatCurrency(snapshotRecord.bfr.debts.other)}</span></div>
                  <div className="flex justify-between font-bold text-red-800 border-t border-slate-100 pt-1 mt-1"><span>Total Passif</span><span>{formatCurrency(snapshotRecord.bfr.debts.total)}</span></div>

                  <div className="flex justify-between font-bold text-lg text-brand-900 border-t-2 border-brand-200 pt-2 mt-2"><span>BFR Net</span><span>{formatCurrency(snapshotRecord.bfr.total)}</span></div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-8">Aucune donnee pour cette periode</p>
            )}
         </div>
      </div>

      {/* ============================================= */}
      {/* ROW 3: Productivite + Activite side by side  */}
      {/* ============================================= */}
      {(displayData.some(d => d.expenses.hoursWorked > 0) || kpis.topActivities.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Productivite */}
          {displayData.some(d => d.expenses.hoursWorked > 0) && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-orange-600" />
                      Productivite
                  </h3>
                  <div className="flex items-center gap-2 text-[10px]">
                      <span className="flex items-center gap-1"><div className="w-2 h-2 bg-orange-500 rounded-sm"></div> Heures</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-purple-500"></div> CA/h</span>
                  </div>
               </div>
               <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 5, right: 35, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                          <YAxis yAxisId="hours" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis yAxisId="rate" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8b5cf6' }} tickFormatter={(val: any) => `${Number(val).toFixed(0)}E/h`} />
                          <Tooltip formatter={(value: any, name: string) => {
                            if (name === 'CA/Heure') return [`${Number(value).toFixed(1)} E/h`, name];
                            return [Number(value).toLocaleString('fr-FR'), name];
                          }} />
                          <Bar yAxisId="hours" dataKey="Productivity" fill="#f97316" radius={[3, 3, 0, 0]} barSize={16} name="Heures N" />
                          <Line yAxisId="rate" type="monotone" dataKey="ProductivityRate" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name="CA/Heure" />
                      </ComposedChart>
                  </ResponsiveContainer>
               </div>
            </div>
          )}

          {/* Activity Breakdown */}
          {kpis.topActivities.length > 0 && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
               <h3 className="text-sm font-bold text-brand-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <ShoppingBag className="w-4 h-4 text-purple-500" /> Repartition Activite
               </h3>
               <div className="space-y-3">
                 {kpis.topActivities.map((act, idx) => (
                   <div key={act.id} className="relative">
                     <div className="flex justify-between items-end mb-1">
                       <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]" title={act.name}>{act.name}</span>
                       <span className="text-xs font-bold text-brand-900">{act.percent.toFixed(0)}%</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full rounded-full" style={{ width: `${act.percent}%`, backgroundColor: COLORS_ACTIVITIES[Number(idx) % COLORS_ACTIVITIES.length] }} />
                     </div>
                     <div className="flex justify-between mt-0.5 text-[10px] text-slate-400">
                       <span>{formatCurrency(act.val)}</span>
                       <span>Marge: {act.marginRate.toFixed(1)}%</span>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================= */}
      {/* Carburant (only if enabled AND has data)      */}
      {/* ============================================= */}
      {showFuelCard && kpis.fuelVolume > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-blue-600" />
                  Consommation Carburant
              </h3>
              <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-sm"></div> N</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-sm"></div> N-1</span>
              </div>
           </div>
           <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip type="fuel" />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="Fuel_Total_N1" fill="#e2e8f0" radius={[3, 3, 0, 0]} barSize={16} name="Volume N-1" />
                      <Bar dataKey="Fuel_Total" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={16} name="Volume N" />
                  </ComposedChart>
              </ResponsiveContainer>
           </div>
        </div>
      )}

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
                    placeholder={snapshotRecord ? "Redigez votre analyse pour ce mois (Optionnel)..." : "Aucune donnee selectionnee."}
                    disabled={!snapshotRecord}
                    className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none text-sm text-slate-700 bg-slate-50 font-medium leading-relaxed disabled:opacity-50"
                  />
              ) : (
                  <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      {commentText ? (
                          <div className="whitespace-pre-line leading-relaxed">{commentText}</div>
                      ) : (
                          <p className="italic text-slate-400 flex items-center gap-2">
                              <Clock className="w-4 h-4" /> Analyse en cours de redaction...
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
