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

const MONTHS_BY_INDEX: Month[] = [
  Month.Jan, Month.Feb, Month.Mar, Month.Apr, Month.May, Month.Jun,
  Month.Jul, Month.Aug, Month.Sep, Month.Oct, Month.Nov, Month.Dec,
];

// Try to parse a cell value as a month
// Handles: text ("Janvier", "janv.", "janvier-25"), Date objects, Excel date serial numbers
function parseMonth(raw: any): Month | null {
  if (raw === undefined || raw === null || raw === '') return null;

  // Handle Date objects (from cellDates: true or JS Dates)
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return MONTHS_BY_INDEX[raw.getMonth()];
  }

  // Handle Excel date serial numbers (numbers between ~1 and ~60000)
  // Excel: Jan 1, 1900 = 1. Typical range for 2020-2030: ~43831-~47848
  if (typeof raw === 'number' && raw > 28 && raw < 60000) {
    // Convert Excel serial to JS Date
    // Excel epoch is Jan 0, 1900 (with the Lotus 123 leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + raw * 86400000);
    if (!isNaN(date.getTime())) {
      return MONTHS_BY_INDEX[date.getMonth()];
    }
  }

  // Handle strings
  let cleaned = String(raw).toLowerCase().trim().replace(/\./g, '');
  // Strip year suffix: "janvier-25" → "janvier", "février-2025" → "février"
  cleaned = cleaned.replace(/[-\/]\d{2,4}$/, '');
  // Numeric month (1-12) in string form
  const num = parseInt(cleaned);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return MONTHS_BY_INDEX[num - 1];
  }
  return MONTH_MAP[cleaned] || null;
}

// Extract year from a cell value (month-year header like "janvier-25", Date, or serial)
function extractYearFromCell(raw: any): number | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.getFullYear();
  }
  if (typeof raw === 'number' && raw > 28 && raw < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + raw * 86400000);
    if (!isNaN(date.getTime())) return date.getFullYear();
  }
  const match = String(raw).match(/[-\/](\d{2,4})$/);
  if (!match) return null;
  const y = parseInt(match[1]);
  if (y >= 2000) return y;
  if (y >= 20 && y <= 99) return 2000 + y;
  return null;
}

// Convert a cell to a display-friendly header string
function cellToHeaderString(cell: any): string {
  if (cell instanceof Date && !isNaN(cell.getTime())) {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${months[cell.getMonth()]}-${String(cell.getFullYear()).slice(2)}`;
  }
  if (typeof cell === 'number' && cell > 28 && cell < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + cell * 86400000);
    if (!isNaN(date.getTime())) {
      const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      return `${months[date.getMonth()]}-${String(date.getFullYear()).slice(2)}`;
    }
  }
  return String(cell ?? '').trim();
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
  type: 'revenue_by_family' | 'fuel_volumes' | 'analyse_activite' | 'ignore';
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
// Scans up to the first 30 rows to find a row with at least 3 month names
function findHeaderRowIndex(rawData: any[][]): number {
  const maxScan = Math.min(rawData.length, 30);
  let bestRow = 0;
  let bestCount = 0;

  for (let i = 0; i < maxScan; i++) {
    const row = rawData[i];
    if (!row || !Array.isArray(row)) continue;
    let monthCount = 0;
    for (const cell of row) {
      if (parseMonth(cell)) {
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
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        const sheets: ParsedSheet[] = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name];
          const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          // Dynamically find the header row (the one with month names)
          const headerRowIdx = findHeaderRowIndex(rawData);

          // Convert headers to display strings (handles Date objects and Excel date serials)
          const headers = rawData.length > headerRowIdx
            ? rawData[headerRowIdx].map((h: any) => cellToHeaderString(h))
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

// Detect year from sheet data - look for a year pattern in headers (e.g. "janvier-25", "2025", etc.)
function detectYear(sheet: ParsedSheet): number {
  const currentYear = new Date().getFullYear();

  // Check headers for year (handles "janvier-25", Date objects, serials)
  for (const h of sheet.headers) {
    const y = extractYearFromCell(h);
    if (y) return y;
  }

  // Check headers for explicit year pattern (e.g. "2025")
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
const FUEL_TOTAL_ALIASES = ['total vol', 'total carburant', 'total litrage', 'volume total'];
const FUEL_SKIP_ALIASES = ['vol. cum', 'vol cum', 'cumul'];

function matchesFuelType(label: string, aliases: string[]): boolean {
  const cleaned = label.toLowerCase().trim();
  return aliases.some(a => cleaned.includes(a));
}

// Check if a sheet looks like revenue by family, fuel volumes, or analyse activite
export function detectSheetType(sheet: ParsedSheet): 'revenue_by_family' | 'fuel_volumes' | 'analyse_activite' | 'unknown' {
  const sheetNameLower = sheet.name.toLowerCase();

  // Check sheet name hints FIRST (before month detection, because some sheets
  // may have month headers that aren't perfectly detected)
  if (sheetNameLower.includes('saisie') || sheetNameLower.includes('analyse activit')) return 'analyse_activite';
  if (sheetNameLower.includes('volume') && sheetNameLower.includes('carburant')) return 'fuel_volumes';

  const monthCols = detectMonthColumns(sheet.headers);
  if (monthCols.length < 3) return 'unknown'; // Need at least 3 months to be confident

  // Find the label column (first non-month column)
  const labelColIndex = sheet.headers.findIndex((h, i) => !monthCols.some(mc => mc.colIndex === i));
  const effectiveLabelCol = labelColIndex >= 0 ? labelColIndex : 0;

  // Check row labels
  const rowLabels = sheet.rows.map(r => String(r[effectiveLabelCol] || '').toLowerCase().trim());

  // Detect "analyse activite" / "feuille de saisie" sheets:
  // These have multiple sections (CA, marge, BFR, trésorerie) in a single sheet
  const analyseKeywords = ['besoin en fonds', 'bfr', 'trésorerie', 'tresorerie', 'productivité', 'productivite'];
  const analyseMatches = rowLabels.filter(l => analyseKeywords.some(k => l.includes(k)));
  const hasMargeAndCA = rowLabels.some(l => l.includes('marge')) && rowLabels.some(l => l.includes('marchandise') || l.includes('ca '));
  if (analyseMatches.length >= 1 && hasMargeAndCA) return 'analyse_activite';

  // Check row labels for fuel-related keywords
  const fuelKeywords = [...FUEL_GASOIL_ALIASES, ...FUEL_SP_ALIASES, ...FUEL_GNR_ALIASES];
  const fuelMatches = rowLabels.filter(l => fuelKeywords.some(k => l.includes(k)));
  if (fuelMatches.length >= 2) return 'fuel_volumes';

  // If sheet name hints at fuel/carburant
  if (sheetNameLower.includes('carburant') || sheetNameLower.includes('volume')) return 'fuel_volumes';

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
  const totalAliases = ['total', 'total général', 'total general', 'total ca', 'total ht', 'sous-total', 'sous total', "chiffre d'affaires", 'chiffre d\'affaires'];
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
// Handles objectives rows (e.g. "Objectifs ENGEN") and cumulative rows (VOL. CUM.)
export function parseFuelSheet(
  sheet: ParsedSheet,
  year: number
): {
  volumes: Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>;
  objectives: Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>;
} {
  const monthCols = detectMonthColumns(sheet.headers);
  if (monthCols.length === 0) return { volumes: new Map(), objectives: new Map() };

  // Find the label column (first non-month column, usually index 0)
  const labelColIndex = sheet.headers.findIndex((h, i) => !monthCols.some(mc => mc.colIndex === i));
  const effectiveLabelCol = labelColIndex >= 0 ? labelColIndex : 0;

  const volumes = new Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>();
  const objectives = new Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>();

  // Initialize all months
  for (const mc of monthCols) {
    volumes.set(mc.month, { gasoil: 0, sansPlomb: 0, gnr: 0, total: 0 });
    objectives.set(mc.month, { gasoil: 0, sansPlomb: 0, gnr: 0, total: 0 });
  }

  // Track the last fuel type seen so "Objectifs ENGEN" rows bind to it
  let lastFuelType: 'gasoil' | 'sansPlomb' | 'gnr' | null = null;

  for (const row of sheet.rows) {
    const label = String(row[effectiveLabelCol] || '').trim();
    if (!label) continue;

    const labelLower = label.toLowerCase();

    // Skip cumulative rows
    if (FUEL_SKIP_ALIASES.some(a => labelLower.includes(a))) continue;

    // Check if this is an objective row (e.g. "Objectifs ENGEN", "Objectif")
    const isObjective = labelLower.includes('objectif');

    if (isObjective && lastFuelType) {
      // Assign objectives to the last fuel type seen
      for (const mc of monthCols) {
        const val = parseNum(row[mc.colIndex]);
        objectives.get(mc.month)![lastFuelType] = val;
      }
      continue;
    }

    // Match fuel types
    for (const mc of monthCols) {
      const val = parseNum(row[mc.colIndex]);
      const entry = volumes.get(mc.month)!;

      if (matchesFuelType(label, FUEL_GASOIL_ALIASES)) {
        entry.gasoil = val;
        lastFuelType = 'gasoil';
      } else if (matchesFuelType(label, FUEL_SP_ALIASES)) {
        entry.sansPlomb = val;
        lastFuelType = 'sansPlomb';
      } else if (matchesFuelType(label, FUEL_GNR_ALIASES)) {
        entry.gnr = val;
        lastFuelType = 'gnr';
      } else if (FUEL_TOTAL_ALIASES.some(a => labelLower.includes(a))) {
        entry.total = val;
        lastFuelType = null;
      }
    }
  }

  // Calculate totals if not provided
  for (const [month, entry] of volumes.entries()) {
    if (entry.total === 0) {
      entry.total = entry.gasoil + entry.sansPlomb + entry.gnr;
    }
  }
  for (const [month, entry] of objectives.entries()) {
    if (entry.total === 0) {
      entry.total = entry.gasoil + entry.sansPlomb + entry.gnr;
    }
  }

  return { volumes, objectives };
}

// Data extracted from a single month of the "Feuille de Saisie" / "Analyse Activité" sheet
interface AnalyseMonthData {
  revenueGoods: number;
  revenueServices: number;
  revenueTotal: number;
  revenueObjective: number;
  marginTotal: number;
  marginObjective: number;
  hoursWorked: number;
  salaries: number;
  bfr: {
    receivables: { clients: number; state: number; social: number; other: number; total: number };
    stock: { goods: number; floating: number; total: number };
    debts: { suppliers: number; state: number; social: number; salaries: number; other: number; total: number };
    total: number;
  };
  cashFlow: { active: number; passive: number; treasury: number };
}

function emptyAnalyseMonthData(): AnalyseMonthData {
  return {
    revenueGoods: 0, revenueServices: 0, revenueTotal: 0, revenueObjective: 0,
    marginTotal: 0, marginObjective: 0,
    hoursWorked: 0, salaries: 0,
    bfr: {
      receivables: { clients: 0, state: 0, social: 0, other: 0, total: 0 },
      stock: { goods: 0, floating: 0, total: 0 },
      debts: { suppliers: 0, state: 0, social: 0, salaries: 0, other: 0, total: 0 },
      total: 0,
    },
    cashFlow: { active: 0, passive: 0, treasury: 0 },
  };
}

// Parse the "FEUILLE DE SAISIE" / "Analyse Activité N" sheet
// This sheet has multiple sections: CA, Marge, Productivité, BFR, Trésorerie
export function parseAnalyseActiviteSheet(
  sheet: ParsedSheet,
  year: number
): Map<string, AnalyseMonthData> {
  let monthCols = detectMonthColumns(sheet.headers);
  let dataRows = sheet.rows;
  let effectiveHeaders = sheet.headers;

  // Fallback: if headers don't have months, re-scan rawData to find the real header row
  // This handles cases where findHeaderRowIndex's scan limit was too low
  if (monthCols.length < 3 && sheet.rawData) {
    const maxScan = Math.min(sheet.rawData.length, 50);
    let bestRow = -1;
    let bestCount = 0;
    for (let i = 0; i < maxScan; i++) {
      const row = sheet.rawData[i];
      if (!row || !Array.isArray(row)) continue;
      let count = 0;
      for (const cell of row) {
        if (parseMonth(cell)) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestRow = i;
      }
    }
    if (bestCount >= 3 && bestRow >= 0) {
      effectiveHeaders = sheet.rawData[bestRow].map((h: any) => cellToHeaderString(h));
      monthCols = detectMonthColumns(effectiveHeaders);
      dataRows = sheet.rawData.slice(bestRow + 1);
    }
  }

  if (monthCols.length === 0) return new Map();

  const labelColIndex = effectiveHeaders.findIndex((h: string, i: number) => !monthCols.some(mc => mc.colIndex === i));
  const effectiveLabelCol = labelColIndex >= 0 ? labelColIndex : 0;

  // Initialize result for each month
  const result = new Map<string, AnalyseMonthData>();
  for (const mc of monthCols) {
    result.set(mc.month, emptyAnalyseMonthData());
  }

  // State machine for section tracking
  type MainSection = 'ca' | 'marge' | 'productivity' | 'bfr' | 'treasury' | null;
  type BfrSubSection = 'receivables' | 'stock' | 'debts' | null;

  let mainSection: MainSection = null;
  let bfrSub: BfrSubSection = null;

  // Helper: get values for all months from a row
  const getMonthValues = (row: any[]): Map<string, number> => {
    const vals = new Map<string, number>();
    for (const mc of monthCols) {
      vals.set(mc.month, parseNum(row[mc.colIndex]));
    }
    return vals;
  };

  for (const row of dataRows) {
    const label = String(row[effectiveLabelCol] || '').trim();
    if (!label) continue;
    const ll = label.toLowerCase();

    // Stop at N-1 section (only parse current year)
    if (ll.includes('n-1') || ll.includes('n - 1')) break;

    // --- Detect main sections ---
    // CA section: "1. CA HT", "CA HT", etc.
    if ((ll.includes('ca ht') || ll.includes('ca ttc') || (ll.match(/^\d+[\.\)]?\s*ca\b/) !== null)) && !ll.includes('objectif')) {
      mainSection = 'ca'; bfrSub = null; continue;
    }
    // Marge section: "2. MARGE", "MARGE"
    if (ll.match(/^\d+[\.\)]?\s*marge/) || (ll === 'marge' && !ll.includes('objectif'))) {
      mainSection = 'marge'; bfrSub = null; continue;
    }
    // Productivity section: "3. Productivité du personnel"
    if (ll.includes('productivit') || ll.includes('personnel')) {
      mainSection = 'productivity'; bfrSub = null; continue;
    }
    // BFR section: "BESOIN EN FONDS DE ROULEMENT", "BFR"
    if (ll.includes('besoin en fonds') || ll.includes('fonds de roulement') || ll === 'bfr') {
      mainSection = 'bfr'; bfrSub = null; continue;
    }
    // Treasury section: "4. TRESORERIE"
    if (ll.match(/^\d+[\.\)]?\s*tr[eé]sor/) || (ll.includes('trésorerie') && !ll.includes('positive') && !ll.includes('négative') && !ll.includes('negative'))) {
      // Only set section if this looks like a section header (not a data row)
      const vals = getMonthValues(row);
      const hasData = [...vals.values()].some(v => v !== 0);
      if (!hasData) {
        mainSection = 'treasury'; bfrSub = null; continue;
      }
    }

    // --- BFR sub-sections ---
    if (mainSection === 'bfr') {
      if (ll.includes('créance') || ll.includes('creance') || ll.match(/^a[\.\)]/)) {
        bfrSub = 'receivables'; continue;
      }
      if (ll.includes('stock') || ll.match(/^b[\.\)]/)) {
        bfrSub = 'stock'; continue;
      }
      if (ll.includes('dette') || ll.match(/^c[\.\)]/)) {
        bfrSub = 'debts'; continue;
      }
    }

    // --- Parse data rows based on current section ---
    const vals = getMonthValues(row);
    const hasData = [...vals.values()].some(v => v !== 0);
    if (!hasData) continue;

    switch (mainSection) {
      case 'ca':
        if (ll.includes('marchandise')) {
          for (const [m, v] of vals) result.get(m)!.revenueGoods = v;
        } else if (ll.includes('service') || ll.includes('prestation') || ll.includes('biens')) {
          for (const [m, v] of vals) result.get(m)!.revenueServices = v;
        } else if (ll.includes('objectif')) {
          for (const [m, v] of vals) result.get(m)!.revenueObjective = v;
        } else if (ll.includes('total') || ll.includes("chiffre d'affaires")) {
          for (const [m, v] of vals) result.get(m)!.revenueTotal = v;
        }
        break;

      case 'marge':
        if (ll.includes('objectif')) {
          for (const [m, v] of vals) result.get(m)!.marginObjective = v;
        } else if (ll.includes('marge')) {
          for (const [m, v] of vals) result.get(m)!.marginTotal = v;
        }
        break;

      case 'productivity':
        if (ll.includes('heure')) {
          for (const [m, v] of vals) result.get(m)!.hoursWorked = v;
        } else if (ll.includes('salaire') || ll.includes('charges') || ll.includes('masse')) {
          for (const [m, v] of vals) result.get(m)!.salaries = v;
        }
        break;

      case 'bfr':
        if (bfrSub === 'receivables') {
          if (ll.includes('client')) {
            for (const [m, v] of vals) result.get(m)!.bfr.receivables.clients = v;
          } else if (ll.includes('etat') || ll.includes('état')) {
            for (const [m, v] of vals) result.get(m)!.bfr.receivables.state = v;
          } else if (ll.includes('social') || ll.includes('sociaux')) {
            for (const [m, v] of vals) result.get(m)!.bfr.receivables.social = v;
          } else if (ll.includes('total')) {
            for (const [m, v] of vals) result.get(m)!.bfr.receivables.total = v;
          } else {
            // "Salariés", "Autres", etc. → accumulate in "other"
            for (const [m, v] of vals) result.get(m)!.bfr.receivables.other += v;
          }
        } else if (bfrSub === 'stock') {
          if (ll.includes('total')) {
            for (const [m, v] of vals) result.get(m)!.bfr.stock.total = v;
          } else if (ll.includes('flottant') || ll.includes('en-cours') || ll.includes('en cours')) {
            for (const [m, v] of vals) result.get(m)!.bfr.stock.floating = v;
          } else {
            for (const [m, v] of vals) result.get(m)!.bfr.stock.goods = v;
          }
        } else if (bfrSub === 'debts') {
          if (ll.includes('fournisseur')) {
            for (const [m, v] of vals) result.get(m)!.bfr.debts.suppliers = v;
          } else if (ll.includes('etat') || ll.includes('état')) {
            for (const [m, v] of vals) result.get(m)!.bfr.debts.state = v;
          } else if (ll.includes('social') || ll.includes('sociaux')) {
            for (const [m, v] of vals) result.get(m)!.bfr.debts.social = v;
          } else if (ll.includes('salarié') || ll.includes('salarie') || ll.includes('salaires')) {
            for (const [m, v] of vals) result.get(m)!.bfr.debts.salaries = v;
          } else if (ll.includes('total')) {
            for (const [m, v] of vals) result.get(m)!.bfr.debts.total = v;
          } else {
            for (const [m, v] of vals) result.get(m)!.bfr.debts.other += v;
          }
        }
        // BFR total row (outside sub-sections)
        if (ll.includes('total') && ll.includes('bfr')) {
          for (const [m, v] of vals) result.get(m)!.bfr.total = v;
        }
        break;

      case 'treasury':
        if (ll.includes('positive') || ll.includes('actif')) {
          for (const [m, v] of vals) result.get(m)!.cashFlow.active = v;
        } else if (ll.includes('négative') || ll.includes('negative') || ll.includes('passif')) {
          for (const [m, v] of vals) result.get(m)!.cashFlow.passive = v;
        }
        break;
    }
  }

  // Post-process: calculate totals and treasury if missing
  for (const [month, data] of result.entries()) {
    // Revenue total = goods + services if not explicitly provided
    if (data.revenueTotal === 0 && (data.revenueGoods > 0 || data.revenueServices > 0)) {
      data.revenueTotal = data.revenueGoods + data.revenueServices;
    }
    // BFR receivables total
    if (data.bfr.receivables.total === 0) {
      data.bfr.receivables.total = data.bfr.receivables.clients + data.bfr.receivables.state + data.bfr.receivables.social + data.bfr.receivables.other;
    }
    // BFR stock total
    if (data.bfr.stock.total === 0) {
      data.bfr.stock.total = data.bfr.stock.goods + data.bfr.stock.floating;
    }
    // BFR debts total
    if (data.bfr.debts.total === 0) {
      data.bfr.debts.total = data.bfr.debts.suppliers + data.bfr.debts.state + data.bfr.debts.social + data.bfr.debts.salaries + data.bfr.debts.other;
    }
    // BFR total
    if (data.bfr.total === 0) {
      data.bfr.total = data.bfr.receivables.total + data.bfr.stock.total - data.bfr.debts.total;
    }
    // Treasury
    data.cashFlow.treasury = data.cashFlow.active - data.cashFlow.passive;
  }

  return result;
}

// Build the final import result from mapped sheets
// Merges data from all 3 sources: analyse_activite, revenue_by_family, fuel_volumes
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
  summary: { monthCount: number; familyCount: number; newFamilyCount: number; hasFuel: boolean; hasAnalyseActivite: boolean };
} {
  let allFamilies: string[] = [];
  let revenueData = new Map<string, Map<string, number>>();
  let fuelVolumes = new Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>();
  let fuelObjectives = new Map<string, { gasoil: number; sansPlomb: number; gnr: number; total: number }>();
  let totalRow: Map<string, number> | null = null;
  let analyseData = new Map<string, AnalyseMonthData>();

  // Process each mapped sheet
  for (const mapping of mappings) {
    if (mapping.type === 'ignore') continue;
    const sheet = sheets.find(s => s.name === mapping.sheetName);
    if (!sheet) continue;

    if (mapping.type === 'analyse_activite') {
      analyseData = parseAnalyseActiviteSheet(sheet, year);
    } else if (mapping.type === 'revenue_by_family') {
      const parsed = parseRevenueSheet(sheet, year);
      allFamilies = [...allFamilies, ...parsed.families];
      revenueData = parsed.monthlyData;
      totalRow = parsed.totalRow;
    } else if (mapping.type === 'fuel_volumes') {
      const parsed = parseFuelSheet(sheet, year);
      fuelVolumes = parsed.volumes;
      fuelObjectives = parsed.objectives;
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

  // Collect all months from all sources
  const allMonths = new Set<string>();
  for (const m of analyseData.keys()) allMonths.add(m);
  for (const m of revenueData.keys()) allMonths.add(m);
  for (const m of fuelVolumes.keys()) allMonths.add(m);

  // Build records for each month
  const records: FinancialRecord[] = [];

  for (const monthName of allMonths) {
    const month = monthName as Month;
    const existing = existingRecords.find(r => r.year === year && r.month === month);

    // Data from analyse_activite (main source)
    const analyse = analyseData.get(monthName);

    // Data from CA par famille (breakdown)
    const familyValues = revenueData.get(monthName);

    // Data from fuel volumes
    const fuel = fuelVolumes.get(monthName);
    const fuelObj = fuelObjectives.get(monthName);

    // Build revenue breakdown keyed by profit center ID
    const revenueBreakdown: Record<string, number> = {};
    let caFromFamilies = 0;
    if (familyValues) {
      for (const [familyName, value] of familyValues.entries()) {
        const pcId = nameToId.get(familyName.toLowerCase().trim());
        if (pcId) {
          revenueBreakdown[pcId] = value;
          caFromFamilies += value;
        }
      }
    }

    // Revenue: prefer analyse_activite data, fallback to family sum
    const totalFromSheet = totalRow?.get(monthName);
    const revenueGoods = analyse?.revenueGoods || 0;
    const revenueServices = analyse?.revenueServices || 0;
    const revenueTotal = analyse?.revenueTotal
      || (totalFromSheet !== undefined && totalFromSheet > 0 ? totalFromSheet : caFromFamilies)
      || (revenueGoods + revenueServices);
    const revenueObjective = analyse?.revenueObjective || 0;

    // Skip months where absolutely no data was found
    const hasAnyData = revenueTotal > 0 || caFromFamilies > 0
      || (fuel && fuel.total > 0) || (analyse && (analyse.salaries > 0 || analyse.bfr.receivables.total > 0));
    if (!hasAnyData) continue;

    // Build the record by merging all sources
    const baseRecord: FinancialRecord = existing
      ? JSON.parse(JSON.stringify(existing))
      : {
          id: `${clientId}-${year}-${month}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          clientId,
          year,
          month,
          isValidated: false,
          isPublished: false,
          isSubmitted: false,
          revenue: { goods: 0, services: 0, total: 0, objective: 0, breakdown: {} },
          fuel: { volume: 0, objective: 0, details: { gasoil: { volume: 0, objective: 0 }, sansPlomb: { volume: 0, objective: 0 }, gnr: { volume: 0, objective: 0 } } },
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

    // Apply revenue data
    baseRecord.revenue = {
      goods: revenueGoods || revenueTotal, // If no goods/services split, put everything in goods
      services: revenueServices,
      total: revenueTotal,
      objective: revenueObjective || baseRecord.revenue.objective || 0,
      breakdown: { ...(baseRecord.revenue.breakdown || {}), ...revenueBreakdown },
    };
    // If we have both goods and services from analyse, use them
    if (revenueGoods > 0 || revenueServices > 0) {
      baseRecord.revenue.goods = revenueGoods;
      baseRecord.revenue.services = revenueServices;
    }

    // Apply fuel data
    if (fuel && fuel.total > 0) {
      baseRecord.fuel = {
        volume: fuel.total,
        objective: fuelObj?.total || baseRecord.fuel?.objective || 0,
        details: {
          gasoil: { volume: fuel.gasoil, objective: fuelObj?.gasoil || baseRecord.fuel?.details?.gasoil?.objective || 0 },
          sansPlomb: { volume: fuel.sansPlomb, objective: fuelObj?.sansPlomb || baseRecord.fuel?.details?.sansPlomb?.objective || 0 },
          gnr: { volume: fuel.gnr, objective: fuelObj?.gnr || baseRecord.fuel?.details?.gnr?.objective || 0 },
        }
      };
    }

    // Apply analyse_activite data (margin, expenses, BFR, treasury)
    if (analyse) {
      if (analyse.marginTotal > 0 || analyse.marginObjective > 0) {
        baseRecord.margin = {
          ...baseRecord.margin,
          total: analyse.marginTotal,
          theoretical: analyse.marginObjective || baseRecord.margin?.theoretical,
          rate: revenueTotal > 0 ? (analyse.marginTotal / revenueTotal) * 100 : 0,
        };
      }

      if (analyse.hoursWorked > 0 || analyse.salaries > 0) {
        baseRecord.expenses = {
          ...baseRecord.expenses,
          hoursWorked: analyse.hoursWorked,
          salaries: analyse.salaries,
        };
      }

      // BFR - only override if we have actual data
      const hasBFRData = analyse.bfr.receivables.total > 0 || analyse.bfr.stock.total > 0 || analyse.bfr.debts.total > 0;
      if (hasBFRData) {
        baseRecord.bfr = analyse.bfr;
      }

      // Treasury
      if (analyse.cashFlow.active > 0 || analyse.cashFlow.passive > 0) {
        baseRecord.cashFlow = analyse.cashFlow;
      }
    }

    records.push(baseRecord);
  }

  return {
    records,
    newProfitCenters,
    allProfitCenters,
    summary: {
      monthCount: records.length,
      familyCount: allFamilies.length,
      newFamilyCount: newFamilyNames.length,
      hasFuel: fuelVolumes.size > 0 && [...fuelVolumes.values()].some(f => f.total > 0),
      hasAnalyseActivite: analyseData.size > 0,
    },
  };
}
