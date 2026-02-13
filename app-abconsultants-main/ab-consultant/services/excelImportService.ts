import * as XLSX from 'xlsx';
import { Month, ProfitCenter, FinancialRecord } from '../types';

// French month names mapping (handles various casing/accents)
const MONTH_MAP: Record<string, Month> = {
  'janvier': Month.Jan, 'janv': Month.Jan, 'jan': Month.Jan,
  'février': Month.Feb, 'fevrier': Month.Feb, 'fév': Month.Feb, 'fev': Month.Feb, 'feb': Month.Feb,
  'mars': Month.Mar, 'mar': Month.Mar,
  'avril': Month.Apr, 'avr': Month.Apr, 'apr': Month.Apr,
  'mai': Month.May,
  'juin': Month.Jun, 'jun': Month.Jun,
  'juillet': Month.Jul, 'juil': Month.Jul, 'jul': Month.Jul,
  'août': Month.Aug, 'aout': Month.Aug, 'aoû': Month.Aug, 'aug': Month.Aug,
  'septembre': Month.Sep, 'sept': Month.Sep, 'sep': Month.Sep,
  'octobre': Month.Oct, 'oct': Month.Oct,
  'novembre': Month.Nov, 'nov': Month.Nov,
  'décembre': Month.Dec, 'decembre': Month.Dec, 'déc': Month.Dec, 'dec': Month.Dec,
};

// Try to parse a cell as a month
function parseMonth(raw: string): Month | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().trim().replace(/\./g, '');
  // Numeric month (1-12)
  const num = parseInt(cleaned);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return Object.values(Month)[num - 1];
  }
  return MONTH_MAP[cleaned] || null;
}

// Parse numeric value from cell
function parseNum(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/\s/g, '').replace(',', '.').replace(/[€%LlKk]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: any[][];
  rawData: any[][];
}

export interface SheetMapping {
  sheetName: string;
  type: 'revenue_by_family' | 'fuel_volumes' | 'ignore';
}

export interface ImportedMonthData {
  month: Month;
  year: number;
  revenueBreakdown: Record<string, number>; // family name -> CA
  marginBreakdown: Record<string, number>;  // family name -> margin (if present)
  revenueTotal: number;
  marginTotal: number;
  fuelDetails?: {
    gasoil: number;
    sansPlomb: number;
    gnr: number;
    total: number;
  };
}

export interface ExcelImportResult {
  monthlyData: ImportedMonthData[];
  detectedFamilies: string[];
  detectedFuelTypes: string[];
  sheets: ParsedSheet[];
}

// Find the row index that contains month names (the actual header row)
// Scans up to the first 15 rows to find a row with at least 3 month names
function findHeaderRowIndex(rawData: any[][]): number {
  const maxScan = Math.min(rawData.length, 15);
  let bestRow = 0;
  let bestCount = 0;

  for (let i = 0; i < maxScan; i++) {
    const row = rawData[i];
    if (!row || !Array.isArray(row)) continue;
    let monthCount = 0;
    for (const cell of row) {
      if (parseMonth(String(cell || '').trim())) {
        monthCount++;
      }
    }
    if (monthCount > bestCount) {
      bestCount = monthCount;
      bestRow = i;
    }
  }

  return bestCount >= 3 ? bestRow : 0;
}

// Read an Excel file and return parsed sheets
export function readExcelFile(file: File): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets: ParsedSheet[] = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          // Dynamically find the header row (the one with month names)
          const headerRowIdx = findHeaderRowIndex(rawData);

          const headers = rawData.length > headerRowIdx
            ? rawData[headerRowIdx].map((h: any) => String(h).trim())
            : [];

          // Data rows start after the header row
          const rows = rawData.slice(headerRowIdx + 1);

          return { name, headers, rows, rawData };
        });

        resolve(sheets);
      } catch (err) {
        reject(new Error('Impossible de lire le fichier Excel. Vérifiez le format.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsArrayBuffer(file);
  });
}

// Detect months in a header row (columns after the first one which is typically the label/family column)
function detectMonthColumns(headers: string[]): { colIndex: number; month: Month }[] {
  const result: { colIndex: number; month: Month }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const month = parseMonth(headers[i]);
    if (month) {
      result.push({ colIndex: i, month });
    }
  }
  return result;
}

// Detect year from sheet data - look for a year pattern (2020-2030) in headers or first column
function detectYear(sheet: ParsedSheet): number {
  const currentYear = new Date().getFullYear();

  // Check headers for year pattern
  for (const h of sheet.headers) {
    const match = String(h).match(/(20[2-3]\d)/);
    if (match) return parseInt(match[1]);
  }

  // Check first column of data rows
  for (const row of sheet.rows) {
    if (row[0]) {
      const match = String(row[0]).match(/(20[2-3]\d)/);
      if (match) return parseInt(match[1]);
    }
  }

  // Check sheet name
  const nameMatch = sheet.name.match(/(20[2-3]\d)/);
  if (nameMatch) return parseInt(nameMatch[1]);

  return currentYear;
}

// Known fuel type aliases
const FUEL_GASOIL_ALIASES = ['gasoil', 'gazole', 'diesel', 'go'];
const FUEL_SP_ALIASES = ['sans plomb', 'sans-plomb', 'sp', 'sp95', 'sp98', 'e10', 'e85', 'essence'];
const FUEL_GNR_ALIASES = ['gnr', 'gnv', 'biocarburant'];
const FUEL_TOTAL_ALIASES = ['total', 'total carburant', 'total litrage', 'volume total'];

function matchesFuelType(label: string, aliases: string[]): boolean {
  const cleaned = label.toLowerCase().trim();
  return aliases.some(a => cleaned.includes(a));
}

// Check if a sheet looks like revenue by family (has months as columns, families as rows)
export function detectSheetType(sheet: ParsedSheet): 'revenue_by_family' | 'fuel_volumes' | 'unknown' {
  const monthCols = detectMonthColumns(sheet.headers);
  if (monthCols.length < 3) return 'unknown'; // Need at least 3 months to be confident

  // Find the label column (first non-month column)
  const labelColIndex = sheet.headers.findIndex((h, i) => !monthCols.some(mc => mc.colIndex === i));
  const effectiveLabelCol = labelColIndex >= 0 ? labelColIndex : 0;

  // Check row labels for fuel-related keywords
  const rowLabels = sheet.rows.map(r => String(r[effectiveLabelCol] || '').toLowerCase().trim());
  const fuelKeywords = [...FUEL_GASOIL_ALIASES, ...FUEL_SP_ALIASES, ...FUEL_GNR_ALIASES];
  const fuelMatches = rowLabels.filter(l => fuelKeywords.some(k => l.includes(k)));

  if (fuelMatches.length >= 2) return 'fuel_volumes';

  // If it has month columns and row-based data, it's likely revenue by family
  if (monthCols.length >= 3) return 'revenue_by_family';

  return 'unknown';
}

// Parse a revenue-by-family sheet
// Handles complex structures with section headers (CA HT, MARGE, etc.)
// Expected format (simple or with sections):
// [label_col] | Janvier | Février | Mars | ...
// CA HT       |         |         |       <- optional section header
// Boutique    | 12000   | 13000   | 11000 | ...
// Carburant   | 50000   | 52000   | 48000 | ...
// TOTAL       | 62000   | 65000   | 59000 | ...
// MARGE       |         |         |       <- section we skip
export function parseRevenueSheet(
  sheet: ParsedSheet,
  year: number
): { families: string[]; monthlyData: Map<string, Map<string, number>>; totalRow: Map<string, number> | null } {
  const monthCols = detectMonthColumns(sheet.headers);
  if (monthCols.length === 0) return { families: [], monthlyData: new Map(), totalRow: null };

  // Find the label column (first non-month column, usually index 0)
  const labelColIndex = sheet.headers.findIndex((h, i) => !monthCols.some(mc => mc.colIndex === i));
  const effectiveLabelCol = labelColIndex >= 0 ? labelColIndex : 0;

  const families: string[] = [];
  const monthlyData = new Map<string, Map<string, number>>(); // month -> (family -> value)
  let totalRow: Map<string, number> | null = null;

  // Skip rows that look like headers/totals
  const totalAliases = ['total', 'total général', 'total general', 'total ca', 'total ht', 'sous-total', 'sous total'];
  const marginAliases = ['marge', 'taux de marge', 'taux marge'];

  // Section tracking: detect section headers and only collect families in CA section
  const caSectionKeywords = ['ca', 'ca ht', 'ca ttc', 'chiffre', 'recette', 'vente', 'activite', 'activité', 'produit'];
  const nonCaSectionKeywords = ['marge', 'taux', 'charge', 'frais', 'resultat', 'résultat', 'etp', 'effectif', 'salaire', 'masse salariale', 'bfr', 'trésorerie', 'tresorerie'];

  // 'ca' = we're in a CA/revenue section (collect families)
  // 'other' = we're in a non-CA section (skip families)
  // 'unknown' = no section detected yet (collect families by default)
  let currentSection: 'ca' | 'other' | 'unknown' = 'unknown';
  let firstTotalSeen = false;

  for (const row of sheet.rows) {
    const label = String(row[effectiveLabelCol] || '').trim();
    if (!label) continue;

    const labelLower = label.toLowerCase();

    // Check if this row has numeric data
    const numericValues = monthCols.filter(mc => parseNum(row[mc.colIndex]) !== 0).length;
    const hasNumericData = numericValues > 0;

    // Detect section headers: rows with a label but no/very little numeric data
    if (!hasNumericData || numericValues <= 1) {
      const isCASection = caSectionKeywords.some(k => labelLower.includes(k));
      const isOtherSection = nonCaSectionKeywords.some(k => labelLower.includes(k));
      if (isCASection && !isOtherSection) {
        currentSection = 'ca';
        continue;
      }
      if (isOtherSection) {
        currentSection = 'other';
        continue;
      }
    }

    // Skip margin rows regardless of section
    const isMargin = marginAliases.some(a => labelLower.includes(a));
    if (isMargin) continue;

    // Check if this is a total row
    const isTotal = totalAliases.some(a => labelLower === a || labelLower.startsWith(a));

    if (isTotal) {
      // Only capture the first total row (CA total) for validation
      if (!firstTotalSeen && (currentSection === 'ca' || currentSection === 'unknown')) {
        totalRow = new Map();
        for (const mc of monthCols) {
          totalRow.set(mc.month, parseNum(row[mc.colIndex]));
        }
        firstTotalSeen = true;
      }
      // After the first total, switch to 'other' section (subsequent data is likely margin, etc.)
      if (currentSection === 'unknown') {
        currentSection = 'other';
      }
      continue;
    }

    // Only collect families from CA section or unknown section (before first total)
    if (currentSection === 'other') continue;

    if (!hasNumericData) continue;

    // Avoid duplicate family names (same family can appear in different sections)
    if (!families.includes(label)) {
      families.push(label);
    }

    for (const mc of monthCols) {
      if (!monthlyData.has(mc.month)) {
        monthlyData.set(mc.month, new Map());
      }
      monthlyData.get(mc.month)!.set(label, parseNum(row[mc.colIndex]));
    }
  }

  return { families, monthlyData, totalRow };
}

// Parse a fuel volumes sheet
export function parseFuelSheet(
  sheet: ParsedSheet,
  year: number
): Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }> {
  const monthCols = detectMonthColumns(sheet.headers);
  if (monthCols.length === 0) return new Map();

  // Find the label column (first non-month column, usually index 0)
  const labelColIndex = sheet.headers.findIndex((h, i) => !monthCols.some(mc => mc.colIndex === i));
  const effectiveLabelCol = labelColIndex >= 0 ? labelColIndex : 0;

  const result = new Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>();

  // Initialize all months
  for (const mc of monthCols) {
    result.set(mc.month, { gasoil: 0, sansPlomb: 0, gnr: 0, total: 0 });
  }

  for (const row of sheet.rows) {
    const label = String(row[effectiveLabelCol] || '').trim();
    if (!label) continue;

    for (const mc of monthCols) {
      const val = parseNum(row[mc.colIndex]);
      const entry = result.get(mc.month)!;

      if (matchesFuelType(label, FUEL_GASOIL_ALIASES)) {
        entry.gasoil = val;
      } else if (matchesFuelType(label, FUEL_SP_ALIASES)) {
        entry.sansPlomb = val;
      } else if (matchesFuelType(label, FUEL_GNR_ALIASES)) {
        entry.gnr = val;
      } else if (matchesFuelType(label, FUEL_TOTAL_ALIASES)) {
        entry.total = val;
      }
    }
  }

  // Calculate totals if not provided
  for (const [month, entry] of result.entries()) {
    if (entry.total === 0) {
      entry.total = entry.gasoil + entry.sansPlomb + entry.gnr;
    }
  }

  return result;
}

// Build the final import result from mapped sheets
export function buildImportData(
  sheets: ParsedSheet[],
  mappings: SheetMapping[],
  year: number,
  clientId: string,
  existingRecords: FinancialRecord[],
  existingProfitCenters: ProfitCenter[]
): {
  records: FinancialRecord[];
  newProfitCenters: ProfitCenter[];
  allProfitCenters: ProfitCenter[];
  summary: { monthCount: number; familyCount: number; newFamilyCount: number; hasFuel: boolean };
} {
  let allFamilies: string[] = [];
  let revenueData = new Map<string, Map<string, number>>();
  let fuelData = new Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>();
  let totalRow: Map<string, number> | null = null;

  // Process each mapped sheet
  for (const mapping of mappings) {
    if (mapping.type === 'ignore') continue;
    const sheet = sheets.find(s => s.name === mapping.sheetName);
    if (!sheet) continue;

    if (mapping.type === 'revenue_by_family') {
      const parsed = parseRevenueSheet(sheet, year);
      allFamilies = [...allFamilies, ...parsed.families];
      revenueData = parsed.monthlyData;
      totalRow = parsed.totalRow;
    } else if (mapping.type === 'fuel_volumes') {
      fuelData = parseFuelSheet(sheet, year);
    }
  }

  // Deduplicate families
  allFamilies = [...new Set(allFamilies)];

  // Determine which families are new
  const existingNames = new Set(existingProfitCenters.map(pc => pc.name.toLowerCase().trim()));
  const newFamilyNames = allFamilies.filter(f => !existingNames.has(f.toLowerCase().trim()));

  // Create new ProfitCenter objects for missing families
  const newProfitCenters: ProfitCenter[] = newFamilyNames.map((name, i) => ({
    id: `pc_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
    name: name,
    type: 'goods' as const,
    defaultMargin: 0,
  }));

  // Merge all profit centers
  const allProfitCenters = [...existingProfitCenters, ...newProfitCenters];

  // Build a name -> id map
  const nameToId = new Map<string, string>();
  for (const pc of allProfitCenters) {
    nameToId.set(pc.name.toLowerCase().trim(), pc.id);
  }

  // Build records for each month
  const records: FinancialRecord[] = [];
  const monthsProcessed = new Set<string>();

  for (const [monthName, familyValues] of revenueData.entries()) {
    const month = monthName as Month;
    monthsProcessed.add(month);

    // Find existing record or create new one
    const existing = existingRecords.find(r => r.year === year && r.month === month);

    // Build revenue breakdown keyed by profit center ID
    const revenueBreakdown: Record<string, number> = {};
    let caTotal = 0;

    for (const [familyName, value] of familyValues.entries()) {
      const pcId = nameToId.get(familyName.toLowerCase().trim());
      if (pcId) {
        revenueBreakdown[pcId] = value;
        caTotal += value;
      }
    }

    // Use total row value if available, otherwise sum of breakdowns
    const totalFromSheet = totalRow?.get(month);
    const revenueTotal = totalFromSheet !== undefined && totalFromSheet > 0 ? totalFromSheet : caTotal;

    // Get fuel data for this month
    const fuel = fuelData.get(month);

    const record: FinancialRecord = existing
      ? {
          ...JSON.parse(JSON.stringify(existing)),
          revenue: {
            ...existing.revenue,
            total: revenueTotal,
            goods: revenueTotal, // Default: all goods (user can adjust)
            services: 0,
            breakdown: { ...(existing.revenue.breakdown || {}), ...revenueBreakdown },
          },
          ...(fuel ? {
            fuel: {
              volume: fuel.total,
              objective: existing.fuel?.objective || 0,
              details: {
                gasoil: { volume: fuel.gasoil, objective: existing.fuel?.details?.gasoil?.objective || 0 },
                sansPlomb: { volume: fuel.sansPlomb, objective: existing.fuel?.details?.sansPlomb?.objective || 0 },
                gnr: { volume: fuel.gnr, objective: existing.fuel?.details?.gnr?.objective || 0 },
              }
            }
          } : {}),
        }
      : {
          id: `${clientId}-${year}-${month}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          clientId,
          year,
          month,
          isValidated: false,
          isPublished: false,
          isSubmitted: false,
          revenue: {
            goods: revenueTotal,
            services: 0,
            total: revenueTotal,
            objective: 0,
            breakdown: revenueBreakdown,
          },
          fuel: fuel ? {
            volume: fuel.total,
            objective: 0,
            details: {
              gasoil: { volume: fuel.gasoil, objective: 0 },
              sansPlomb: { volume: fuel.sansPlomb, objective: 0 },
              gnr: { volume: fuel.gnr, objective: 0 },
            }
          } : { volume: 0, objective: 0, details: { gasoil: { volume: 0, objective: 0 }, sansPlomb: { volume: 0, objective: 0 }, gnr: { volume: 0, objective: 0 } } },
          margin: { rate: 0, total: 0, breakdown: {} },
          expenses: { salaries: 0, hoursWorked: 0, overtimeHours: 0 },
          bfr: {
            receivables: { clients: 0, state: 0, social: 0, other: 0, total: 0 },
            stock: { goods: 0, floating: 0, total: 0 },
            debts: { suppliers: 0, state: 0, social: 0, salaries: 0, other: 0, total: 0 },
            total: 0,
          },
          cashFlow: { active: 0, passive: 0, treasury: 0 },
        };

    records.push(record);
  }

  // Also process fuel-only months (months that have fuel data but no revenue data)
  for (const [monthName, fuel] of fuelData.entries()) {
    if (monthsProcessed.has(monthName)) continue;

    const month = monthName as Month;
    const existing = existingRecords.find(r => r.year === year && r.month === month);

    if (existing) {
      records.push({
        ...JSON.parse(JSON.stringify(existing)),
        fuel: {
          volume: fuel.total,
          objective: existing.fuel?.objective || 0,
          details: {
            gasoil: { volume: fuel.gasoil, objective: existing.fuel?.details?.gasoil?.objective || 0 },
            sansPlomb: { volume: fuel.sansPlomb, objective: existing.fuel?.details?.sansPlomb?.objective || 0 },
            gnr: { volume: fuel.gnr, objective: existing.fuel?.details?.gnr?.objective || 0 },
          }
        }
      });
    } else {
      records.push({
        id: `${clientId}-${year}-${month}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        clientId,
        year,
        month,
        isValidated: false,
        isPublished: false,
        isSubmitted: false,
        revenue: { goods: 0, services: 0, total: 0, objective: 0, breakdown: {} },
        fuel: {
          volume: fuel.total,
          objective: 0,
          details: {
            gasoil: { volume: fuel.gasoil, objective: 0 },
            sansPlomb: { volume: fuel.sansPlomb, objective: 0 },
            gnr: { volume: fuel.gnr, objective: 0 },
          }
        },
        margin: { rate: 0, total: 0, breakdown: {} },
        expenses: { salaries: 0, hoursWorked: 0, overtimeHours: 0 },
        bfr: {
          receivables: { clients: 0, state: 0, social: 0, other: 0, total: 0 },
          stock: { goods: 0, floating: 0, total: 0 },
          debts: { suppliers: 0, state: 0, social: 0, salaries: 0, other: 0, total: 0 },
          total: 0,
        },
        cashFlow: { active: 0, passive: 0, treasury: 0 },
      });
    }
  }

  return {
    records,
    newProfitCenters,
    allProfitCenters,
    summary: {
      monthCount: records.length,
      familyCount: allFamilies.length,
      newFamilyCount: newFamilyNames.length,
      hasFuel: fuelData.size > 0,
    },
  };
}
