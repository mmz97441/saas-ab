
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell, LineChart
} from 'recharts';
import { FinancialRecord, Month, Client } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Users, MousePointerClick, Calendar, Filter, Check, Trophy, AlertCircle, Target, Droplets, ArrowRight, ArrowUpRight, ArrowDownRight, FileText, ShieldAlert, MessageSquare, Send, Bell, Clock, Fuel, Briefcase, Zap, Activity, ShoppingBag, Percent, Landmark, Maximize2, Minimize2, Printer } from 'lucide-react';
// @ts-ignore
import confetti from 'canvas-confetti';
import { toShortMonth, getExpertComments, saveExpertComment } from '../services/dataService';
import { calculateRatios } from '../utils/ratios';
import { ExpertComment } from '../types';
import { GlossaryTooltip } from './GlossaryTooltip';

interface DashboardProps {
  data: FinancialRecord[];
  client: Client;
  userRole: 'ab_consultant' | 'client';
  onSaveComment: (record: FinancialRecord) => void;
  isPresentationMode?: boolean;
  onTogglePresentation?: () => void;
  onGenerateReport?: () => void;
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

const Dashboard: React.FC<DashboardProps> = ({ data, client, userRole, onSaveComment, isPresentationMode = false, onTogglePresentation, onGenerateReport }) => {
  
  // Year Selection
  const [selectedYear, setSelectedYear] = useState<number>(
    data.length > 0 ? Math.max(...data.map(d => d.year)) : new Date().getFullYear()
  );

  // Multi-Month Selection State (Empty array means "All Year")
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [celebrated, setCelebrated] = useState(false);

  // Comment State
  const [commentText, setCommentText] = useState('');

  // N-1 toggle (show/hide N-1 comparison on all charts)
  const [showN1, setShowN1] = useState(true);

  // Expert Comment History
  const [commentHistory, setCommentHistory] = useState<ExpertComment[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (client?.id) {
      getExpertComments(client.id).then(setCommentHistory).catch(() => {});
    }
  }, [client?.id]);

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

  // --- M-1 LOGIC: Default view = completed months only ---
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth(); // 0=Jan, 1=Feb...
  // For current year: only months before current month (M-1)
  // For past years: null = show all months
  const defaultMonthsUpToM1 = useMemo(() => {
    if (selectedYear < currentYear) return null;
    if (selectedYear > currentYear) return [];
    if (currentMonthIndex === 0) return []; // January: no completed month yet
    return standardMonthOrder.slice(0, currentMonthIndex);
  }, [selectedYear]);

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
    if (selectedMonths.length > 0) {
      return yearData.filter(d => selectedMonths.includes(d.month));
    }
    // No selection: for current year, show only completed months (up to M-1)
    if (defaultMonthsUpToM1 !== null) {
      return yearData.filter(d => (defaultMonthsUpToM1 as string[]).includes(d.month));
    }
    return yearData;
  }, [yearData, selectedMonths, defaultMonthsUpToM1]);

  const snapshotRecord = useMemo(() => {
    return displayData.length > 0 ? displayData[displayData.length - 1] : null;
  }, [displayData]);

  // Financial Ratios (based on snapshot record — last month of displayed period)
  const ratios = useMemo(() => {
    if (!snapshotRecord) return null;
    return calculateRatios({
      ca: snapshotRecord.revenue.total,
      marginTotal: snapshotRecord.margin?.total || 0,
      salaries: snapshotRecord.expenses.salaries,
      hoursWorked: snapshotRecord.expenses.hoursWorked,
      receivablesClients: snapshotRecord.bfr.receivables.clients,
      debtsSuppliers: snapshotRecord.bfr.debts.suppliers,
      stockTotal: snapshotRecord.bfr.stock.total,
    });
  }, [snapshotRecord]);

  useEffect(() => {
      setCommentText(snapshotRecord?.expertComment || '');
  }, [snapshotRecord]);

  const handleSaveRestitution = async () => {
      if (snapshotRecord) {
          const updatedRecord = { ...snapshotRecord, expertComment: commentText };
          onSaveComment(updatedRecord);
          // Save to comment history
          if (commentText.trim()) {
            try {
              await saveExpertComment({
                clientId: client.id,
                text: commentText,
                authorEmail: '',
                authorName: 'Consultant',
                month: snapshotRecord.month,
                year: snapshotRecord.year,
              });
              const updated = await getExpertComments(client.id);
              setCommentHistory(updated);
            } catch (e) { /* ignore */ }
          }
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
    const n1Filtered = (selectedMonths.length > 0
      ? n1Data.filter(d => selectedMonths.includes(d.month))
      : defaultMonthsUpToM1 !== null
        ? n1Data.filter(d => (defaultMonthsUpToM1 as string[]).includes(d.month))
        : n1Data
    ).sort((a, b) => fiscalMonthOrder.indexOf(a.month) - fiscalMonthOrder.indexOf(b.month));
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
  }, [displayData, snapshotRecord, yearData, client.profitCenters, selectedMonths, defaultMonthsUpToM1, data, selectedYear]);

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

    if (selectedMonths.length === 0) {
      if (defaultMonthsUpToM1 !== null) {
        return fullYearChartData.filter(d => (defaultMonthsUpToM1 as string[]).includes(d.fullMonth));
      }
      return fullYearChartData;
    }
    return fullYearChartData.filter(d => selectedMonths.includes(d.fullMonth));

  }, [data, selectedYear, selectedMonths, fiscalMonthOrder, defaultMonthsUpToM1]);

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


  // --- CUMULATIVE CA vs OBJECTIF ---
  const cumulativeData = useMemo(() => {
    let cumulCA = 0;
    let cumulObj = 0;
    let cumulCA_N1 = 0;
    return chartData.map(d => {
      cumulCA += (d.CA || 0);
      cumulObj += (d.Objectif || 0);
      cumulCA_N1 += (d.CA_N1 || 0);
      return {
        name: d.name,
        fullMonth: d.fullMonth,
        CA_Cumul: cumulCA,
        Objectif_Cumul: cumulObj,
        CA_N1_Cumul: cumulCA_N1,
      };
    });
  }, [chartData]);

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

  // Profit Center Trends (evolution per activity across months)
  const profitCenterTrendsData = useMemo(() => {
    if (!client.profitCenters || client.profitCenters.length === 0) return [];

    return chartData.map(d => {
      const record = data.find(r => r.year === selectedYear && r.month === d.fullMonth);
      const entry: Record<string, any> = { name: d.name, fullMonth: d.fullMonth };

      client.profitCenters!.forEach(pc => {
        entry[pc.name] = record?.revenue.breakdown?.[pc.id] || 0;
      });
      return entry;
    });
  }, [chartData, data, selectedYear, client.profitCenters]);

  // Ratios Evolution Chart Data (DSO / DPO / BFR jours over months)
  const ratiosChartData = useMemo(() => {
    return chartData.map(d => {
      const record = data.find(r => r.year === selectedYear && r.month === d.fullMonth);
      if (!record) return { name: d.name, fullMonth: d.fullMonth, DSO: null, DPO: null, DIO: null, BFR_Jours: null, Masse_Sal: null };

      const ca = record.revenue.total;
      const margin = record.margin?.total || 0;
      const achats = Math.max(ca - margin, 0);

      const dso = ca > 0 ? (record.bfr.receivables.clients / ca) * 30 : null;
      const dpo = achats > 0 ? (record.bfr.debts.suppliers / achats) * 30 : null;
      const dio = achats > 0 ? (record.bfr.stock.total / achats) * 30 : null;
      const bfrDays = (dso !== null && dpo !== null && dio !== null) ? dso + dio - dpo : null;
      const masseSal = ca > 0 ? (record.expenses.salaries / ca) * 100 : null;

      return { name: d.name, fullMonth: d.fullMonth, DSO: dso, DPO: dpo, DIO: dio, BFR_Jours: bfrDays, Masse_Sal: masseSal };
    });
  }, [chartData, data, selectedYear]);

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
                       {Array.from(new Set([...data.map(d => d.year), currentYear])).sort((a,b)=>b-a).map(y => (
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

           {/* Presentation & Print Controls */}
           <div className="flex items-center gap-2 print:hidden">
             {/* N-1 Toggle */}
             <button
               onClick={() => setShowN1(p => !p)}
               className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                 showN1
                   ? 'bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                   : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
               }`}
               title={showN1 ? 'Masquer N-1' : 'Afficher N-1'}
             >
               <Calendar className="w-3.5 h-3.5" />
               N-1 {showN1 ? 'ON' : 'OFF'}
             </button>
             {onTogglePresentation && (
               <button
                 onClick={onTogglePresentation}
                 className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                   isPresentationMode
                     ? 'bg-brand-900 text-white border-brand-800 shadow-sm'
                     : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
                 }`}
                 title={isPresentationMode ? 'Quitter la présentation' : 'Mode présentation'}
               >
                 {isPresentationMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                 {isPresentationMode ? 'Quitter' : 'Présentation'}
               </button>
             )}
             {onGenerateReport && userRole === 'ab_consultant' && (
               <button
                 onClick={onGenerateReport}
                 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-brand-600 border border-brand-200 hover:bg-brand-50 transition-all"
                 title="Générer un rapport client"
               >
                 <FileText className="w-3.5 h-3.5" />
                 Rapport
               </button>
             )}
             <button
               onClick={() => window.print()}
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-brand-600 border border-brand-200 hover:bg-brand-50 transition-all"
               title="Imprimer / Exporter PDF"
             >
               <Printer className="w-3.5 h-3.5" />
               PDF
             </button>
           </div>

           {/* Active Filters Display */}
           {selectedMonths.length > 0 ? (
             <div className="flex items-center gap-2 bg-brand-50 text-brand-600 px-3 py-1.5 rounded-full text-xs font-bold border border-brand-200">
                 <Filter className="w-3 h-3" />
                 {selectedMonths.length} mois selectionne{selectedMonths.length > 1 ? 's' : ''}
                 <button onClick={() => applyPreset('ALL')} className="ml-1 hover:text-red-500"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
           ) : defaultMonthsUpToM1 !== null && defaultMonthsUpToM1.length > 0 ? (
             <div className="flex items-center gap-2 bg-brand-50 text-brand-500 px-3 py-1.5 rounded-full text-xs font-bold border border-brand-200">
                 <Calendar className="w-3 h-3" />
                 Jusqu'a {defaultMonthsUpToM1[defaultMonthsUpToM1.length - 1]} {selectedYear}
             </div>
           ) : null}
         </div>

         {/* MONTH GRID - Clickable months */}
         <div className="grid grid-cols-6 md:grid-cols-12 gap-1">
            {fiscalMonthOrder.map(m => {
              const hasData = yearData.some(d => d.month === m);
              const isSelected = selectedMonths.includes(m);
              const shortName = toShortMonth(m);
              const isFutureMonth = selectedYear === currentYear && standardMonthOrder.indexOf(m) >= currentMonthIndex;
              return (
                <button
                  key={m}
                  onClick={() => handleMonthToggle(m)}
                  className={`px-1 py-2 text-[10px] font-bold rounded-lg transition-all border ${
                    isSelected
                      ? 'bg-brand-900 text-white border-brand-800 shadow-sm'
                      : hasData && !isFutureMonth
                      ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100 hover:border-brand-300'
                      : isFutureMonth
                      ? 'bg-slate-50 text-slate-200 border-dashed border-slate-200 cursor-not-allowed'
                      : 'bg-slate-50 text-slate-300 border-slate-100 cursor-default'
                  }`}
                  disabled={!hasData || isFutureMonth}
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
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400 flex items-center gap-1">Chiffre d'Affaires <GlossaryTooltip term="ca" position="bottom" /></p>
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
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400 flex items-center gap-1">Taux de Marge <GlossaryTooltip term="marge" position="bottom" /></p>
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
             <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400 flex items-center gap-1">Trésorerie Nette <GlossaryTooltip term="tresorerie" position="bottom" /></p>
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
             <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400 flex items-center gap-1">BFR Moyen <GlossaryTooltip term="bfr" position="bottom" /></p>
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
      {/* FINANCIAL RATIOS PANEL                        */}
      {/* ============================================= */}
      {ratios && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Ratios Financiers
            </h3>
            {snapshotRecord && (
              <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded">
                {snapshotRecord.month} {snapshotRecord.year}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className={`rounded-lg p-3 text-center ${ratios.dsoInactive ? 'bg-slate-50/50 opacity-40' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-0.5">DSO <GlossaryTooltip term="dso" position="bottom" /></p>
              <p className={`text-lg font-bold ${ratios.dsoInactive ? 'text-slate-300' : 'text-cyan-700'}`}>{ratios.dso.toFixed(0)}<span className="text-xs font-normal text-slate-400"> j</span></p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ratios.dsoInactive ? 'Aucune donnée' : 'Délai encaissement'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${ratios.dpoInactive ? 'bg-slate-50/50 opacity-40' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-0.5">DPO <GlossaryTooltip term="dpo" position="bottom" /></p>
              <p className={`text-lg font-bold ${ratios.dpoInactive ? 'text-slate-300' : 'text-rose-700'}`}>{ratios.dpo.toFixed(0)}<span className="text-xs font-normal text-slate-400"> j</span></p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ratios.dpoInactive ? 'Aucune donnée' : 'Délai paiement'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${ratios.dioInactive ? 'bg-slate-50/50 opacity-40' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-0.5">DIO <GlossaryTooltip term="dio" position="bottom" /></p>
              <p className={`text-lg font-bold ${ratios.dioInactive ? 'text-slate-300' : 'text-amber-700'}`}>{ratios.dio.toFixed(0)}<span className="text-xs font-normal text-slate-400"> j</span></p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ratios.dioInactive ? 'Aucune donnée' : 'Rotation stock'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${ratios.bfrDaysInactive ? 'bg-slate-50/50 opacity-40' : ratios.bfrDays > 60 ? 'bg-red-50' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-0.5">BFR <GlossaryTooltip term="bfr_jours" position="bottom" /></p>
              <p className={`text-lg font-bold ${ratios.bfrDaysInactive ? 'text-slate-300' : ratios.bfrDays > 60 ? 'text-red-700' : 'text-brand-700'}`}>{ratios.bfrDays.toFixed(0)}<span className="text-xs font-normal text-slate-400"> j</span></p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ratios.bfrDaysInactive ? 'Aucune donnée' : 'en jours de CA'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${ratios.salaryInactive ? 'bg-slate-50/50 opacity-40' : ratios.salaryRatio > 50 ? 'bg-red-50' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-0.5">Masse Sal. <GlossaryTooltip term="ratio_salarial" position="bottom" /></p>
              <p className={`text-lg font-bold ${ratios.salaryInactive ? 'text-slate-300' : ratios.salaryRatio > 50 ? 'text-red-700' : 'text-purple-700'}`}>{ratios.salaryRatio.toFixed(1)}<span className="text-xs font-normal text-slate-400">%</span></p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ratios.salaryInactive ? 'Aucune donnée' : 'du CA'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${ratios.productivityInactive ? 'bg-slate-50/50 opacity-40' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-0.5">CA / Heure <GlossaryTooltip term="productivite" position="bottom" /></p>
              <p className={`text-lg font-bold ${ratios.productivityInactive ? 'text-slate-300' : 'text-emerald-700'}`}>{ratios.productivityPerHour.toFixed(0)}<span className="text-xs font-normal text-slate-400"> €</span></p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ratios.productivityInactive ? 'Aucune donnée' : 'Productivité'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${ratios.costInactive ? 'bg-slate-50/50 opacity-40' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-center gap-0.5">Coût / h</p>
              <p className={`text-lg font-bold ${ratios.costInactive ? 'text-slate-300' : 'text-orange-700'}`}>{ratios.costPerHour.toFixed(0)}<span className="text-xs font-normal text-slate-400"> €</span></p>
              <p className="text-[9px] text-slate-400 mt-0.5">{ratios.costInactive ? 'Aucune donnée' : 'Masse sal.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* MONTHLY DETAIL PANEL (when 1 month selected)  */}
      {/* ============================================= */}
      {selectedMonths.length === 1 && snapshotRecord && (() => {
        const prevYearRecord = data.find(d => d.year === selectedYear - 1 && d.month === selectedMonths[0]);
        return (
          <div className="bg-gradient-to-br from-brand-50 to-white p-5 rounded-xl shadow-sm border border-brand-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" />
                Fiche Mensuelle — {snapshotRecord.month} {snapshotRecord.year}
              </h3>
              <button onClick={() => applyPreset('ALL')} className="text-[10px] text-brand-500 hover:text-brand-700 font-bold">
                Voir l'année complète
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: Activité */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1">Activité</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">CA HT</span><span className="font-bold">{formatCurrency(snapshotRecord.revenue.total)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Objectif</span><span className="font-bold">{formatCurrency(snapshotRecord.revenue.objective)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Performance</span><span className={`font-bold ${snapshotRecord.revenue.objective > 0 && snapshotRecord.revenue.total >= snapshotRecord.revenue.objective ? 'text-emerald-600' : 'text-amber-600'}`}>{snapshotRecord.revenue.objective > 0 ? ((snapshotRecord.revenue.total / snapshotRecord.revenue.objective) * 100).toFixed(1) : '-'}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Marge brute</span><span className="font-bold">{formatCurrency(snapshotRecord.margin?.total || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Taux marge</span><span className="font-bold">{(snapshotRecord.margin?.rate || 0).toFixed(1)}%</span></div>
                  {prevYearRecord && (
                    <>
                      <div className="border-t border-slate-100 pt-1 mt-1 text-slate-400">
                        <div className="flex justify-between"><span>CA N-1</span><span>{formatCurrency(prevYearRecord.revenue.total)}</span></div>
                        {prevYearRecord.revenue.total > 0 && (
                          <div className="flex justify-between">
                            <span>Variation</span>
                            <span className={((snapshotRecord.revenue.total - prevYearRecord.revenue.total) / prevYearRecord.revenue.total * 100) >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                              {((snapshotRecord.revenue.total - prevYearRecord.revenue.total) / prevYearRecord.revenue.total * 100) > 0 ? '+' : ''}
                              {((snapshotRecord.revenue.total - prevYearRecord.revenue.total) / prevYearRecord.revenue.total * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {snapshotRecord.revenue.breakdown && Object.keys(snapshotRecord.revenue.breakdown).length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Par activité</h5>
                    {Object.entries(snapshotRecord.revenue.breakdown).map(([id, val]) => {
                      const name = client.profitCenters?.find(p => p.id === id)?.name || id;
                      return (
                        <div key={id} className="flex justify-between text-[11px]">
                          <span className="text-slate-500 truncate max-w-[120px]">{name}</span>
                          <span className="font-medium">{formatCurrency(val as number)} <span className="text-slate-300">({snapshotRecord.revenue.total > 0 ? (((val as number) / snapshotRecord.revenue.total) * 100).toFixed(0) : 0}%)</span></span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column 2: Charges & RH */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1">Charges & RH</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Masse salariale</span><span className="font-bold">{formatCurrency(snapshotRecord.expenses.salaries)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Heures travaillées</span><span className="font-bold">{snapshotRecord.expenses.hoursWorked.toLocaleString('fr-FR')} h</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Heures sup.</span><span className="font-bold">{(snapshotRecord.expenses.overtimeHours || 0).toLocaleString('fr-FR')} h</span></div>
                  {snapshotRecord.expenses.hoursWorked > 0 && (
                    <>
                      <div className="border-t border-slate-100 pt-1 mt-1">
                        <div className="flex justify-between"><span className="text-slate-500">CA / heure</span><span className="font-bold text-emerald-600">{(snapshotRecord.revenue.total / snapshotRecord.expenses.hoursWorked).toFixed(1)} €/h</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Coût / heure</span><span className="font-bold text-orange-600">{(snapshotRecord.expenses.salaries / snapshotRecord.expenses.hoursWorked).toFixed(1)} €/h</span></div>
                      </div>
                    </>
                  )}
                  {snapshotRecord.revenue.total > 0 && (
                    <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                      <span className="text-slate-500">Ratio masse sal.</span>
                      <span className={`font-bold ${(snapshotRecord.expenses.salaries / snapshotRecord.revenue.total * 100) > 50 ? 'text-red-600' : 'text-purple-600'}`}>
                        {(snapshotRecord.expenses.salaries / snapshotRecord.revenue.total * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {prevYearRecord && (
                    <div className="border-t border-slate-100 pt-1 mt-1 text-slate-400">
                      <div className="flex justify-between"><span>Salaires N-1</span><span>{formatCurrency(prevYearRecord.expenses.salaries)}</span></div>
                      <div className="flex justify-between"><span>Heures N-1</span><span>{prevYearRecord.expenses.hoursWorked.toLocaleString('fr-FR')} h</span></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Trésorerie & BFR */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1">Trésorerie & BFR</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Trésorerie nette</span><span className={`font-bold ${snapshotRecord.cashFlow.treasury >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(snapshotRecord.cashFlow.treasury)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">BFR net</span><span className="font-bold">{formatCurrency(snapshotRecord.bfr.total)}</span></div>
                  {ratios && (
                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <div className="flex justify-between"><span className="text-slate-500">DSO (clients)</span><span className="font-bold text-cyan-600">{ratios.dso.toFixed(0)} j</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">DPO (fourn.)</span><span className="font-bold text-rose-600">{ratios.dpo.toFixed(0)} j</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">DIO (stocks)</span><span className="font-bold text-amber-600">{ratios.dio.toFixed(0)} j</span></div>
                      <div className="flex justify-between font-bold border-t border-slate-100 pt-1 mt-1">
                        <span className="text-slate-700">BFR en jours</span>
                        <span className={ratios.bfrDays > 60 ? 'text-red-600' : 'text-brand-700'}>{ratios.bfrDays.toFixed(0)} j de CA</span>
                      </div>
                    </div>
                  )}
                  {prevYearRecord && (
                    <div className="border-t border-slate-100 pt-1 mt-1 text-slate-400">
                      <div className="flex justify-between"><span>Trésorerie N-1</span><span>{formatCurrency(prevYearRecord.cashFlow.treasury)}</span></div>
                      <div className="flex justify-between"><span>BFR N-1</span><span>{formatCurrency(prevYearRecord.bfr.total)}</span></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                    {showN1 && <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-sm"></div> N-1</span>}
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
                        {showN1 && <Bar dataKey="CA_N1" fill="#e2e8f0" radius={[3, 3, 0, 0]} barSize={16} name="CA N-1" />}
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
                    {showN1 && <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-sm"></div> N-1</span>}
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
                        {showN1 && <Line type="monotone" dataKey="Tresorerie_N1" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="Tresorerie N-1" />}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* ============================================= */}
      {/* ROW 1.5: CA Cumulé vs Objectif Cumulé         */}
      {/* ============================================= */}
      {kpis.objective > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              Progression Cumulée CA vs Objectif
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-brand-600 rounded-full"></div> CA cumulé</span>
              <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-amber-500"></div> Objectif cumulé</span>
              {showN1 && <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-full"></div> CA N-1 cumulé</span>}
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cumulativeData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val: any) => { const v = Number(val); return !isNaN(v) && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(val); }} />
                <Tooltip formatter={(value: any, name: string) => {
                  const labels: Record<string, string> = { CA_Cumul: 'CA Cumulé', Objectif_Cumul: 'Objectif Cumulé', CA_N1_Cumul: 'CA N-1 Cumulé' };
                  return [formatCurrency(Number(value)), labels[name] || name];
                }} />
                <defs>
                  <linearGradient id="colorCACumul" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="CA_Cumul" fill="url(#colorCACumul)" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: '#0f172a' }} name="CA_Cumul" />
                <Line type="monotone" dataKey="Objectif_Cumul" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" name="Objectif_Cumul" />
                {showN1 && <Line type="monotone" dataKey="CA_N1_Cumul" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" name="CA_N1_Cumul" />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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

         {/* BFR Breakdown - Visual Bars */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-cyan-500" /> Répartition du BFR
              </h3>
              {snapshotRecord && (
                <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded">{snapshotRecord.month} {snapshotRecord.year}</span>
              )}
            </div>
            {snapshotRecord ? (() => {
              const totalActif = snapshotRecord.bfr.receivables.total + snapshotRecord.bfr.stock.total;
              const totalPassif = snapshotRecord.bfr.debts.total;
              const maxSide = Math.max(totalActif, totalPassif, 1);
              const bfrNet = snapshotRecord.bfr.total;

              const actifItems = [
                { label: 'Clients', value: snapshotRecord.bfr.receivables.clients, color: 'bg-cyan-500' },
                { label: 'État', value: snapshotRecord.bfr.receivables.state, color: 'bg-cyan-400' },
                { label: 'Org. Sociaux', value: snapshotRecord.bfr.receivables.social, color: 'bg-cyan-300' },
                { label: 'Autres', value: snapshotRecord.bfr.receivables.other, color: 'bg-cyan-200' },
                { label: 'Stocks', value: snapshotRecord.bfr.stock.total, color: 'bg-amber-400' },
              ].filter(i => i.value > 0);

              const passifItems = [
                { label: 'Fournisseurs', value: snapshotRecord.bfr.debts.suppliers, color: 'bg-rose-500' },
                { label: 'Dettes Fiscales', value: snapshotRecord.bfr.debts.state, color: 'bg-rose-400' },
                { label: 'Dettes Sociales', value: snapshotRecord.bfr.debts.social, color: 'bg-rose-300' },
                { label: 'Salaires', value: snapshotRecord.bfr.debts.salaries, color: 'bg-orange-400' },
                { label: 'Autres', value: snapshotRecord.bfr.debts.other, color: 'bg-rose-200' },
              ].filter(i => i.value > 0);

              return (
                <>
                  {/* BFR Net - prominent display */}
                  <div className={`rounded-xl p-4 mb-4 text-center ${bfrNet >= 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">BFR Net</p>
                    <p className={`text-2xl font-black ${bfrNet > 0 ? 'text-amber-700' : bfrNet < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {formatCurrency(bfrNet)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {bfrNet > 0 ? 'Besoin de financement' : bfrNet < 0 ? 'Excédent de financement' : 'Équilibré'}
                    </p>
                  </div>

                  {/* Balance bar: Actif vs Passif */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">Actif circulant</span>
                      <span className="text-xs font-bold text-cyan-800">{formatCurrency(totalActif)}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${(totalActif / maxSide) * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="mb-5">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Passif circulant</span>
                      <span className="text-xs font-bold text-rose-800">{formatCurrency(totalPassif)}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-500" style={{ width: `${(totalPassif / maxSide) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Detail breakdown with proportion bars */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Actif Column */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider pb-1 border-b border-cyan-100">Actif</div>
                      {actifItems.map(item => (
                        <div key={item.label} className="group">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-600">{item.label}</span>
                            <span className="text-[11px] font-bold text-slate-700">{formatCurrency(item.value)}</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full mt-0.5">
                            <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${totalActif > 0 ? (item.value / totalActif) * 100 : 0}%` }}></div>
                          </div>
                        </div>
                      ))}
                      {actifItems.length === 0 && <p className="text-[10px] text-slate-400 italic">Aucun</p>}
                    </div>

                    {/* Passif Column */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider pb-1 border-b border-rose-100">Passif</div>
                      {passifItems.map(item => (
                        <div key={item.label} className="group">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-600">{item.label}</span>
                            <span className="text-[11px] font-bold text-slate-700">{formatCurrency(item.value)}</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full mt-0.5">
                            <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${totalPassif > 0 ? (item.value / totalPassif) * 100 : 0}%` }}></div>
                          </div>
                        </div>
                      ))}
                      {passifItems.length === 0 && <p className="text-[10px] text-slate-400 italic">Aucun</p>}
                    </div>
                  </div>
                </>
              );
            })() : (
              <p className="text-sm text-slate-400 italic text-center py-8">Aucune donnée pour cette période</p>
            )}
         </div>
      </div>

      {/* ============================================= */}
      {/* ROW 2.5: Ratios Evolution (DSO/DPO/BFR jours) */}
      {/* ============================================= */}
      {ratiosChartData.some(d => d.DSO !== null || d.DPO !== null) && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Evolution des Ratios (jours)
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-cyan-500 rounded-full"></div> DSO</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-full"></div> DPO</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-500 rounded-full"></div> DIO</span>
              <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-brand-900"></div> BFR j</span>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ratiosChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val: any) => `${Number(val).toFixed(0)}j`} />
                <Tooltip formatter={(value: any, name: string) => {
                  const labels: Record<string, string> = { DSO: 'DSO (encaissement)', DPO: 'DPO (paiement)', DIO: 'DIO (stocks)', BFR_Jours: 'BFR en jours' };
                  return [`${Number(value).toFixed(1)} jours`, labels[name] || name];
                }} />
                <Bar dataKey="DSO" fill="#06b6d4" radius={[3, 3, 0, 0]} barSize={12} name="DSO" />
                <Bar dataKey="DPO" fill="#f43f5e" radius={[3, 3, 0, 0]} barSize={12} name="DPO" />
                <Bar dataKey="DIO" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={12} name="DIO" />
                <Line type="monotone" dataKey="BFR_Jours" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: '#0f172a' }} name="BFR_Jours" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
      {/* ROW 3.5: Profit Center Trends                 */}
      {/* ============================================= */}
      {profitCenterTrendsData.length > 0 && client.profitCenters && client.profitCenters.length > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Tendances par Activité
            </h3>
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              {client.profitCenters.slice(0, 5).map((pc, idx) => (
                <span key={pc.id} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS_ACTIVITIES[idx % COLORS_ACTIVITIES.length] }}></div>
                  {pc.name}
                </span>
              ))}
            </div>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitCenterTrendsData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val: any) => { const v = Number(val); return !isNaN(v) && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(val); }} />
                <Tooltip formatter={(value: any, name: string) => [formatCurrency(Number(value)), name]} />
                {client.profitCenters.slice(0, 5).map((pc, idx) => (
                  <Line
                    key={pc.id}
                    type="monotone"
                    dataKey={pc.name}
                    stroke={COLORS_ACTIVITIES[idx % COLORS_ACTIVITIES.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COLORS_ACTIVITIES[idx % COLORS_ACTIVITIES.length] }}
                    name={pc.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
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
                  {showN1 && <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-300 rounded-sm"></div> N-1</span>}
              </div>
           </div>
           <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip type="fuel" />} cursor={{ fill: '#f8fafc' }} />
                      {showN1 && <Bar dataKey="Fuel_Total_N1" fill="#e2e8f0" radius={[3, 3, 0, 0]} barSize={16} name="Volume N-1" />}
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
                          <>
                              <div className="whitespace-pre-line leading-relaxed">{commentText}</div>
                              {snapshotRecord && (
                                  <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-200">
                                      Analyse pour {snapshotRecord.month} {snapshotRecord.year}
                                  </p>
                              )}
                          </>
                      ) : (
                          <div className="text-center py-4">
                              <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                              <p className="text-sm font-medium text-slate-400">Pas encore d'analyse pour cette période</p>
                              <p className="text-xs text-slate-300 mt-1">Votre consultant publiera son analyse prochainement.</p>
                          </div>
                      )}
                  </div>
              )}

              {/* COMMENT HISTORY */}
              {commentHistory.length > 1 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs text-brand-500 hover:text-brand-700 font-bold flex items-center gap-1"
                  >
                    <Clock className="w-3 h-3" />
                    {showHistory ? 'Masquer' : 'Voir'} l'historique ({commentHistory.length} analyses)
                  </button>
                  {showHistory && (
                    <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                      {commentHistory.map((c, i) => (
                        <div key={c.id || i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{c.month} {c.year}</span>
                            {c.createdAt?.toMillis && (
                              <span className="text-[10px] text-slate-400">
                                {new Date(c.createdAt.toMillis()).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
      </div>

    </div>
  );
};

export default Dashboard;
