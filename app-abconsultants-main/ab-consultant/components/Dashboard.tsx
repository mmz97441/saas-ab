
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell, LineChart
} from 'recharts';
import { FinancialRecord, Month, Client } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Users, MousePointerClick, Calendar, Filter, Check, Trophy, AlertCircle, Target, Droplets, ArrowRight, ArrowUpRight, ArrowDownRight, FileText, ShieldAlert, MessageSquare, Send, Bell, Clock, Fuel, Briefcase, Zap, Activity, ShoppingBag, Percent, Landmark, Maximize2, Minimize2, Printer } from 'lucide-react';
// @ts-ignore
import confetti from 'canvas-confetti';
import { toShortMonth } from '../services/dataService';

interface DashboardProps {
  data: FinancialRecord[];
  client: Client;
  userRole: 'ab_consultant' | 'client';
  onSaveComment: (record: FinancialRecord) => void;
  isPresentationMode?: boolean;
  onTogglePresentation?: () => void;
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

const Dashboard: React.FC<DashboardProps> = ({ data, client, userRole, onSaveComment, isPresentationMode = false, onTogglePresentation }) => {
  
  // Year Selection
  const [selectedYear, setSelectedYear] = useState<number>(
    data.length > 0 ? Math.max(...data.map(d => d.year)) : new Date().getFullYear()
  );

  // Multi-Month Selection State (Empty array means "All Year")
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [celebrated, setCelebrated] = useState(false);

  // Rolling period mode (12M = 12 mois glissants, 6M = 6 mois glissants)
  const [rollingMode, setRollingMode] = useState<'12M' | '6M' | null>(null);

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

  // --- ROLLING PERIOD DATA (12M / 6M glissants) ---
  const rollingData = useMemo(() => {
    if (!rollingMode) return null;
    const monthCount = rollingMode === '12M' ? 12 : 6;
    // Build ordered list of (year, month) tuples ending at M-1
    const now = new Date();
    let endMonthIdx = now.getMonth() - 1; // M-1 (0-indexed)
    let endYear = now.getFullYear();
    if (endMonthIdx < 0) { endMonthIdx = 11; endYear--; }

    const periods: { year: number; month: Month; label: string }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      let mIdx = endMonthIdx - i;
      let yr = endYear;
      while (mIdx < 0) { mIdx += 12; yr--; }
      const m = standardMonthOrder[mIdx];
      const shortYear = String(yr).slice(-2);
      periods.push({ year: yr, month: m, label: `${toShortMonth(m)} ${shortYear}` });
    }

    // Fetch matching records
    const records = periods.map(p => {
      const record = data.find(d => d.year === p.year && d.month === p.month);
      return { ...p, record: record || null };
    });

    // N-1 rolling: same months but one year earlier
    const n1Records = periods.map(p => {
      const record = data.find(d => d.year === p.year - 1 && d.month === p.month);
      return { year: p.year - 1, month: p.month, record: record || null };
    });

    return { periods, records, n1Records };
  }, [rollingMode, data]);

  // --- FILTERS LOGIC ---
  const handleMonthToggle = (month: string) => {
    setCelebrated(false);
    setRollingMode(null);
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
    setRollingMode(null);
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

  const applyRollingMode = (mode: '12M' | '6M') => {
    setCelebrated(false);
    setSelectedMonths([]);
    setRollingMode(prev => prev === mode ? null : mode);
  };

  // --- DATA PROCESSING ---
  const yearData = useMemo(() => {
    let filtered = data.filter(d => d.year === selectedYear);
    filtered.sort((a, b) => fiscalMonthOrder.indexOf(a.month) - fiscalMonthOrder.indexOf(b.month));
    return filtered;
  }, [data, selectedYear, fiscalMonthOrder]);

  const displayData = useMemo(() => {
    // Rolling mode: cross-year data
    if (rollingMode && rollingData) {
      return rollingData.records
        .filter(r => r.record !== null)
        .map(r => r.record!);
    }
    if (selectedMonths.length > 0) {
      return yearData.filter(d => selectedMonths.includes(d.month));
    }
    // No selection: for current year, show only completed months (up to M-1)
    if (defaultMonthsUpToM1 !== null) {
      return yearData.filter(d => (defaultMonthsUpToM1 as string[]).includes(d.month));
    }
    return yearData;
  }, [yearData, selectedMonths, defaultMonthsUpToM1, rollingMode, rollingData]);

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
         dso: 0, dpo: 0, dio: 0, bfrDays: 0, masseSalarialeRate: 0, caPerHour: 0, costPerHour: 0,
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
        .sort((a, b) => b.val - a.val);

    // Filter out parent/total entries: if an entry represents ≥98% of total revenue
    // and there are other entries, it's a category total (e.g. "Marchandises" = sum of sub-families)
    if (topActivities.length > 1) {
        topActivities = topActivities.filter(a => a.percent < 98);
    }
    topActivities = topActivities.slice(0, 5);

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

    // --- RATIOS FINANCIERS ---
    const totalSalaries = displayData.reduce((acc, curr) => acc + curr.expenses.salaries, 0);
    const avgMonthlyRevenue = displayData.length > 0 ? totalRevenue / displayData.length : 0;
    const lastRec = snapshotRecord;
    const dso = avgMonthlyRevenue > 0 && lastRec ? (lastRec.bfr.receivables.clients / avgMonthlyRevenue) * 30 : 0;
    const dpo = avgMonthlyRevenue > 0 && lastRec ? (lastRec.bfr.debts.suppliers / avgMonthlyRevenue) * 30 : 0;
    const dio = avgMonthlyRevenue > 0 && lastRec ? (lastRec.bfr.stock.total / avgMonthlyRevenue) * 30 : 0;
    const bfrDays = avgMonthlyRevenue > 0 ? (avgBfr / avgMonthlyRevenue) * 30 : 0;
    const masseSalarialeRate = totalRevenue > 0 ? (totalSalaries / totalRevenue) * 100 : 0;
    const caPerHour = totalHours > 0 ? totalRevenue / totalHours : 0;
    const costPerHour = totalHours > 0 ? totalSalaries / totalHours : 0;

    // --- N-1 COMPARISONS ---
    let n1Filtered: FinancialRecord[];
    if (rollingMode && rollingData) {
      // Rolling mode: N-1 = same months but 1 year earlier
      n1Filtered = rollingData.n1Records
        .filter(r => r.record !== null)
        .map(r => r.record!);
    } else {
      const n1Data = data.filter(d => d.year === selectedYear - 1);
      n1Filtered = selectedMonths.length > 0
        ? n1Data.filter(d => selectedMonths.includes(d.month))
        : defaultMonthsUpToM1 !== null
          ? n1Data.filter(d => (defaultMonthsUpToM1 as string[]).includes(d.month))
          : n1Data;
    }
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
      dso,
      dpo,
      dio,
      bfrDays,
      masseSalarialeRate,
      caPerHour,
      costPerHour,
    };
  }, [displayData, snapshotRecord, yearData, client.profitCenters, selectedMonths, defaultMonthsUpToM1, data, selectedYear, rollingMode, rollingData]);

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
    // --- ROLLING MODE: cross-year chart data ---
    if (rollingMode && rollingData) {
      const rollingRecords = rollingData.records.filter(r => r.record !== null).map(r => r.record!);
      const rollingAvg = rollingRecords.length > 0
        ? rollingRecords.reduce((acc, r) => acc + r.revenue.total, 0) / rollingRecords.length
        : null;

      return rollingData.periods.map(p => {
        const recordN = data.find(d => d.year === p.year && d.month === p.month);
        const recordN1 = data.find(d => d.year === p.year - 1 && d.month === p.month);

        const productivityRate = (recordN && recordN.expenses.hoursWorked > 0) ? recordN.revenue.total / recordN.expenses.hoursWorked : null;
        const productivityRateN1 = (recordN1 && recordN1.expenses.hoursWorked > 0) ? recordN1.revenue.total / recordN1.expenses.hoursWorked : null;

        return {
          name: p.label, // "Jan 25", "Fev 26" etc.
          fullMonth: p.month,
          _year: p.year,
          CA: recordN ? recordN.revenue.total : null,
          CA_N1: recordN1 ? recordN1.revenue.total : null,
          Objectif: recordN ? recordN.revenue.objective : null,
          Moyenne_N: rollingAvg,
          Moyenne_N1: null,
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
          Fuel_Obj_Gasoil: recordN ? recordN.fuel?.details?.gasoil.objective : null,
          Fuel_Obj_SP: recordN ? recordN.fuel?.details?.sansPlomb.objective : null,
          Fuel_Obj_GNR: recordN ? recordN.fuel?.details?.gnr.objective : null,
          Fuel_Obj_Total: recordN ? recordN.fuel?.objective : null,
          DSO: recordN && recordN.revenue.total > 0 ? (recordN.bfr.receivables.clients / recordN.revenue.total) * 30 : null,
          DPO: recordN && recordN.revenue.total > 0 ? (recordN.bfr.debts.suppliers / recordN.revenue.total) * 30 : null,
          DIO: recordN && recordN.revenue.total > 0 ? (recordN.bfr.stock.total / recordN.revenue.total) * 30 : null,
        };
      });
    }

    // --- STANDARD MODE: single year ---
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
        Fuel_Obj_Gasoil: recordN ? recordN.fuel?.details?.gasoil.objective : null,
        Fuel_Obj_SP: recordN ? recordN.fuel?.details?.sansPlomb.objective : null,
        Fuel_Obj_GNR: recordN ? recordN.fuel?.details?.gnr.objective : null,
        Fuel_Obj_Total: recordN ? recordN.fuel?.objective : null,
        // Ratios (en jours)
        DSO: recordN && recordN.revenue.total > 0 ? (recordN.bfr.receivables.clients / recordN.revenue.total) * 30 : null,
        DPO: recordN && recordN.revenue.total > 0 ? (recordN.bfr.debts.suppliers / recordN.revenue.total) * 30 : null,
        DIO: recordN && recordN.revenue.total > 0 ? (recordN.bfr.stock.total / recordN.revenue.total) * 30 : null,
      };
    });

    if (selectedMonths.length === 0) {
      if (defaultMonthsUpToM1 !== null) {
        return fullYearChartData.filter(d => (defaultMonthsUpToM1 as string[]).includes(d.fullMonth));
      }
      return fullYearChartData;
    }
    return fullYearChartData.filter(d => selectedMonths.includes(d.fullMonth));

  }, [data, selectedYear, selectedMonths, fiscalMonthOrder, defaultMonthsUpToM1, rollingMode, rollingData]);

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
    if (rollingMode) return; // Disable click filtering in rolling mode
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
          <span className="font-bold text-slate-700 capitalize">{data.fullMonth} {data._year || selectedYear}</span>
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
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-500">Volume Total</span>
                    <span className="font-bold text-blue-700">{Math.round(data.Fuel_Total || 0).toLocaleString()} L</span>
                </div>
                {data.Fuel_Obj_Total > 0 && (
                    <div className="flex justify-between items-center mb-1.5 text-[10px]">
                        <span className="text-slate-400">Objectif Total</span>
                        <span className="font-medium text-slate-500">{Math.round(data.Fuel_Obj_Total).toLocaleString()} L</span>
                    </div>
                )}
                <div className="space-y-1 mt-2 text-[10px]">
                    {[
                      { label: 'Gasoil', vol: data.Fuel_Gasoil, obj: data.Fuel_Obj_Gasoil, color: '#3b82f6' },
                      { label: 'SP', vol: data.Fuel_SP, obj: data.Fuel_Obj_SP, color: '#f59e0b' },
                      { label: 'GNR', vol: data.Fuel_GNR, obj: data.Fuel_Obj_GNR, color: '#10b981' },
                    ].filter(f => (f.vol || 0) > 0 || (f.obj || 0) > 0).map(f => (
                        <div key={f.label} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: f.color }} />
                            <span className="text-slate-500 w-10">{f.label}</span>
                            <span className="font-bold text-slate-700 flex-1 text-right">{Math.round(f.vol || 0).toLocaleString()} L</span>
                            {(f.obj || 0) > 0 && (
                                <span className="text-slate-400 ml-1">/ {Math.round(f.obj).toLocaleString()}</span>
                            )}
                        </div>
                    ))}
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

  // --- ACTIVITY TREND DATA ---
  const activityTrendData = useMemo(() => {
    if (!kpis.topActivities.length) return [];
    const actIds = kpis.topActivities.map(a => a.id);
    return chartData.map(d => {
      const yr = (d as any)._year || selectedYear;
      const record = data.find(r => r.year === yr && r.month === d.fullMonth);
      const point: Record<string, any> = { name: d.name, fullMonth: d.fullMonth };
      actIds.forEach(id => {
        point[id] = record?.revenue.breakdown?.[id] || 0;
      });
      return point;
    });
  }, [chartData, data, selectedYear, kpis.topActivities]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* HEADER: Year + Period Presets + Month Grid */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-100 space-y-3">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
             {/* Year Selector */}
             <div className={`flex items-center gap-2 ${rollingMode ? 'opacity-40 pointer-events-none' : ''}`}>
                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Exercice</span>
                <div className="relative">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      disabled={!!rollingMode}
                      className="appearance-none bg-brand-50 border border-brand-200 text-brand-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block pl-3 pr-8 py-2 font-bold cursor-pointer hover:bg-brand-100 transition-colors disabled:cursor-not-allowed"
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
                            (p === 'ALL' && selectedMonths.length === 0 && !rollingMode)
                            ? 'bg-white text-brand-700 shadow-sm'
                            : 'text-brand-400 hover:text-brand-600 hover:bg-brand-100'
                        }`}
                    >
                        {p === 'ALL' ? 'ANNEE' : p}
                    </button>
                ))}
                <div className="w-px bg-brand-200 mx-0.5" />
                {(['6M', '12M'] as const).map(mode => (
                    <button
                        key={mode}
                        onClick={() => applyRollingMode(mode)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                            rollingMode === mode
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title={mode === '12M' ? '12 mois glissants' : '6 derniers mois'}
                    >
                        {mode}
                    </button>
                ))}
             </div>
           </div>

           {/* Presentation & Print Controls */}
           <div className="flex items-center gap-2 print:hidden">
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
           {rollingMode && rollingData ? (
             <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200">
                 <Activity className="w-3 h-3" />
                 {rollingMode === '12M' ? '12 mois glissants' : '6 derniers mois'} : {rollingData.periods[0].label} → {rollingData.periods[rollingData.periods.length - 1].label}
                 <button onClick={() => setRollingMode(null)} className="ml-1 hover:text-red-500"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
           ) : selectedMonths.length > 0 ? (
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
         <div className={`grid grid-cols-6 md:grid-cols-12 gap-1 ${rollingMode ? 'opacity-30 pointer-events-none' : ''}`}>
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
         {(() => {
           const caPerf = parseFloat(kpis.revenuePerformance);
           const getCaBadge = (p: number) => {
             if (p >= 110) return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
             if (p >= 100) return { bg: 'bg-lime-100', text: 'text-lime-700' };
             if (p >= 95) return { bg: 'bg-amber-100', text: 'text-amber-700' };
             if (p >= 85) return { bg: 'bg-orange-100', text: 'text-orange-700' };
             return { bg: 'bg-red-100', text: 'text-red-700' };
           };
           const getCaBarColor = (p: number) => {
             if (p >= 110) return '#059669';
             if (p >= 100) return '#65a30d';
             if (p >= 95) return '#d97706';
             if (p >= 85) return '#ea580c';
             return '#dc2626';
           };
           const getCaTextColor = (p: number) => {
             if (p >= 110) return 'text-emerald-700';
             if (p >= 100) return 'text-lime-700';
             if (p >= 95) return 'text-amber-600';
             if (p >= 85) return 'text-orange-600';
             return 'text-red-600';
           };
           const badge = getCaBadge(caPerf);
           const barColor = getCaBarColor(caPerf);
           const textColor = getCaTextColor(caPerf);
           return (
         <div className="p-4 rounded-xl border bg-white border-brand-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-1">
                <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
                    <DollarSign className="w-4 h-4" />
                </div>
                {kpis.objective > 0 && (
                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                    {kpis.revenuePerformance}% Obj
                </div>
                )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400" title="CA HT facturé sur la période sélectionnée">Chiffre d'Affaires</p>
            <h3 className="text-xl font-bold text-slate-800">
                <AnimatedNumber value={kpis.revenue} />
            </h3>
            {kpis.revenueVariation !== null && (
              <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${kpis.revenueVariation >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {kpis.revenueVariation >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpis.revenueVariation > 0 ? '+' : ''}{kpis.revenueVariation.toFixed(1)}% vs N-1
              </div>
            )}
            {/* Jauge d'atteinte objectif CA */}
            {kpis.objective > 0 && (
              <div className="mt-3 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="font-medium text-slate-500">Objectif</span>
                  <span className="text-slate-500">
                    <span className={`font-bold ${textColor}`}>{Math.round(kpis.revenue).toLocaleString()} €</span>
                    <span className="text-slate-400"> / {Math.round(kpis.objective).toLocaleString()} €</span>
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(caPerf, 100)}%`, backgroundColor: barColor }} />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-[10px] font-bold ${textColor}`}>
                    {caPerf >= 110 ? 'Excellent !' : caPerf >= 100 ? 'Objectif atteint' : caPerf >= 95 ? 'Presque...' : caPerf >= 85 ? 'En retard' : 'Critique'}
                  </span>
                  <span className={`text-[10px] font-bold ${textColor}`}>{caPerf.toFixed(1)}%</span>
                </div>
              </div>
            )}
         </div>
           );
         })()}

         {/* MARGIN CARD */}
         <div className="bg-white p-4 rounded-xl border border-brand-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-1">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                    <Percent className="w-4 h-4" />
                </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400" title="Marge commerciale brute en % du CA HT">Taux de Marge</p>
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
             <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400" title="Soldes bancaires créditeurs - Soldes débiteurs et découverts">Trésorerie Nette</p>
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
             <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-400" title="Besoin en Fonds de Roulement : (Créances + Stocks) - Dettes courantes">BFR Moyen</p>
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

      {/* RATIOS FINANCIERS BADGES */}
      {kpis.revenue > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-100">
          <h3 className="text-xs font-bold text-brand-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            Ratios Financiers
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: 'DSO', value: `${kpis.dso.toFixed(0)}j`, sub: 'Délai clients', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
              { label: 'DPO', value: `${kpis.dpo.toFixed(0)}j`, sub: 'Délai fourn.', color: 'bg-rose-50 text-rose-700 border-rose-200' },
              { label: 'DIO', value: `${kpis.dio.toFixed(0)}j`, sub: 'Rotation stocks', color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'BFR', value: `${kpis.bfrDays.toFixed(0)}j`, sub: 'en jours de CA', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { label: 'Masse Sal.', value: `${kpis.masseSalarialeRate.toFixed(1)}%`, sub: '% du CA', color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: 'CA/Heure', value: `${kpis.caPerHour.toFixed(0)}€`, sub: 'Productivité', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Coût/H', value: `${kpis.costPerHour.toFixed(0)}€`, sub: 'Coût salarial', color: 'bg-orange-50 text-orange-700 border-orange-200' },
            ].map(r => (
              <div key={r.label} className={`flex flex-col items-center p-2.5 rounded-lg border ${r.color}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{r.label}</span>
                <span className="text-lg font-bold">{r.value}</span>
                <span className="text-[9px] opacity-60">{r.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

         {/* BFR Breakdown */}
         <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
            <h3 className="text-sm font-bold text-brand-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <Briefcase className="w-4 h-4 text-cyan-500" /> Répartition du BFR
            </h3>
            {snapshotRecord ? (() => {
              const r = snapshotRecord;
              const totalActif = r.bfr.receivables.total + r.bfr.stock.total;
              const totalPassif = r.bfr.debts.total;
              const barMax = Math.max(totalActif, totalPassif, 1);

              return (
                <>
                  <p className="text-[10px] text-slate-400 text-center mb-3">{r.month} {r.year}</p>

                  {/* BFR Net — highlighted card at top */}
                  <div className={`rounded-lg p-3 mb-4 text-center ${r.bfr.total < 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">BFR Net</div>
                    <div className={`text-2xl font-bold ${r.bfr.total < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatCurrency(r.bfr.total, 0)}
                    </div>
                    <div className={`text-[10px] font-medium mt-0.5 ${r.bfr.total < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {r.bfr.total < 0 ? 'Excédent de trésorerie' : 'Besoin de financement'}
                    </div>
                  </div>

                  {/* Actif vs Passif comparison bars */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-cyan-700">Actif circulant</span>
                        <span className="font-bold text-cyan-700">{formatCurrency(totalActif, 0)}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${(totalActif / barMax) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-rose-700">Passif circulant</span>
                        <span className="font-bold text-rose-700">{formatCurrency(totalPassif, 0)}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${(totalPassif / barMax) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Detail table — two columns side by side */}
                  <div className="grid grid-cols-2 gap-4 text-[11px] border-t border-slate-100 pt-3">
                    {/* Actif detail */}
                    <div className="space-y-1">
                      <div className="font-bold text-cyan-700 text-[10px] uppercase tracking-wider mb-1">Détail Actif</div>
                      <div className="flex justify-between"><span className="text-slate-500">Clients</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.receivables.clients, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">État</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.receivables.state, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Org. Sociaux</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.receivables.social, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Autres</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.receivables.other, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Stocks</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.stock.total, 0)}</span></div>
                    </div>
                    {/* Passif detail */}
                    <div className="space-y-1">
                      <div className="font-bold text-rose-700 text-[10px] uppercase tracking-wider mb-1">Détail Passif</div>
                      <div className="flex justify-between"><span className="text-slate-500">Fournisseurs</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.debts.suppliers, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Fiscal</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.debts.state, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Social</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.debts.social, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Salaires</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.debts.salaries, 0)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Autres</span><span className="text-slate-700 font-medium">{formatCurrency(r.bfr.debts.other, 0)}</span></div>
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
      {/* ROW 4: Evolution Ratios + Tendances Activité  */}
      {/* ============================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolution des Ratios (jours) */}
        {chartData.some(d => d.DSO !== null || d.DPO !== null || d.DIO !== null) && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                Evolution des Ratios (jours)
              </h3>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-cyan-500"></div> DSO</span>
                <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-rose-500"></div> DPO</span>
                <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-amber-500"></div> DIO</span>
              </div>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val: any) => `${Number(val).toFixed(0)}j`} />
                  <Tooltip formatter={(value: any, name: string) => [`${Number(value).toFixed(1)} jours`, name]} />
                  <Line type="monotone" dataKey="DSO" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} name="DSO" connectNulls />
                  <Line type="monotone" dataKey="DPO" stroke="#e11d48" strokeWidth={2} dot={{ r: 3, fill: '#e11d48' }} name="DPO" connectNulls />
                  <Line type="monotone" dataKey="DIO" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="DIO" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tendances par Activité */}
        {activityTrendData.length > 0 && kpis.topActivities.length > 0 && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Tendances par Activité
              </h3>
              <div className="flex items-center gap-2 text-[10px] flex-wrap justify-end">
                {kpis.topActivities.map((act, idx) => (
                  <span key={act.id} className="flex items-center gap-1">
                    <div className="w-2 h-0.5" style={{ backgroundColor: COLORS_ACTIVITIES[idx % COLORS_ACTIVITIES.length] }}></div>
                    <span className="truncate max-w-[60px]" title={act.name}>{act.name}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityTrendData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val: any) => { const v = Number(val); return !isNaN(v) && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(val); }} />
                  <Tooltip formatter={(value: any, name: string) => {
                    const act = kpis.topActivities.find(a => a.id === name);
                    return [formatCurrency(Number(value)), act?.name || name];
                  }} />
                  {kpis.topActivities.map((act, idx) => (
                    <Line
                      key={act.id}
                      type="monotone"
                      dataKey={act.id}
                      stroke={COLORS_ACTIVITIES[idx % COLORS_ACTIVITIES.length]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COLORS_ACTIVITIES[idx % COLORS_ACTIVITIES.length] }}
                      name={act.id}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* Carburant (only if enabled AND has data)      */}
      {/* ============================================= */}
      {showFuelCard && kpis.fuelVolume > 0 && (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-brand-100">
           {/* Header */}
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2 uppercase tracking-wide">
                  <Fuel className="w-4 h-4 text-blue-600" />
                  Volume Carburant
              </h3>
              <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div> Gasoil</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></div> SP</span>
                  <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div> GNR</span>
                  <span className="flex items-center gap-1"><div className="w-4 border-t-2 border-dashed border-slate-400"></div> Objectif</span>
              </div>
           </div>

           {/* Stacked Bar Chart */}
           <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <Tooltip content={<CustomTooltip type="fuel" />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="Fuel_Gasoil" stackId="fuel" fill="#3b82f6" name="Gasoil" barSize={28} />
                      <Bar dataKey="Fuel_SP" stackId="fuel" fill="#f59e0b" name="SP" barSize={28} />
                      <Bar dataKey="Fuel_GNR" stackId="fuel" fill="#10b981" name="GNR" radius={[3, 3, 0, 0]} barSize={28}
                        label={(props: any) => {
                          const { x, y, width, index } = props;
                          const d = chartData[index];
                          if (!d) return null;
                          const total = (d.Fuel_Gasoil || 0) + (d.Fuel_SP || 0) + (d.Fuel_GNR || 0);
                          if (total === 0) return null;
                          return <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={9} fill="#475569" fontWeight={600}>{total >= 1000 ? `${(total/1000).toFixed(1)}k` : Math.round(total)}</text>;
                        }}
                      />
                      <Line type="stepAfter" dataKey="Fuel_Obj_Total" stroke="#94a3b8" strokeDasharray="6 3" dot={false} strokeWidth={1.5} name="Objectif" connectNulls />
                  </ComposedChart>
              </ResponsiveContainer>
           </div>

           {/* Fuel Type Summary — objectives by fuel type */}
           {(kpis.fuelDetails.gasoil.obj > 0 || kpis.fuelDetails.sp.obj > 0 || kpis.fuelDetails.gnr.obj > 0) && (
             <div className="mt-4 pt-3 border-t border-slate-100">
               <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Objectifs par type de carburant</div>
               <div className="space-y-2">
                 {[
                   { label: 'Gasoil', vol: kpis.fuelDetails.gasoil.vol, obj: kpis.fuelDetails.gasoil.obj },
                   { label: 'Sans Plomb', vol: kpis.fuelDetails.sp.vol, obj: kpis.fuelDetails.sp.obj },
                   { label: 'GNR', vol: kpis.fuelDetails.gnr.vol, obj: kpis.fuelDetails.gnr.obj },
                 ].filter(f => f.obj > 0 || f.vol > 0).map(f => {
                   const pct = f.obj > 0 ? (f.vol / f.obj) * 100 : 0;
                   // Station-service : plus on vend mieux c'est (comme le CA)
                   // > 100% → vert (objectif dépassé), < 85% → rouge (loin de l'objectif)
                   const getBarColor = (p: number) => {
                     if (p >= 110) return '#059669';  // emerald-600 — excellent
                     if (p >= 100) return '#65a30d';  // lime-600 — objectif atteint
                     if (p >= 95) return '#d97706';   // amber-600 — presque
                     if (p >= 85) return '#ea580c';   // orange-600 — en retard
                     return '#dc2626';                 // red-600 — critique
                   };
                   const getTextColor = (p: number) => {
                     if (p >= 110) return 'text-emerald-700';
                     if (p >= 100) return 'text-lime-700';
                     if (p >= 95) return 'text-amber-600';
                     if (p >= 85) return 'text-orange-600';
                     return 'text-red-600';
                   };
                   const barColor = getBarColor(pct);
                   const textColor = getTextColor(pct);
                   return (
                     <div key={f.label}>
                       <div className="flex justify-between items-center text-[11px] mb-0.5">
                         <span className="font-medium text-slate-600">{f.label}</span>
                         <span className="text-slate-500">
                           <span className={`font-bold ${textColor}`}>{Math.round(f.vol).toLocaleString()} L</span>
                           {f.obj > 0 && <span className="text-slate-400"> / {Math.round(f.obj).toLocaleString()} L</span>}
                           {f.obj > 0 && <span className={`ml-1.5 font-bold ${textColor}`}>({pct.toFixed(0)}%)</span>}
                         </span>
                       </div>
                       {f.obj > 0 && (
                         <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             </div>
           )}
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
          </div>
      </div>

    </div>
  );
};

export default Dashboard;
