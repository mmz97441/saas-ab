/**
 * Calcul des ratios financiers — logique pure, testable.
 * Utilisé par Dashboard.tsx et les tests unitaires.
 */

export interface RatioInput {
  ca: number;            // Chiffre d'affaires (revenue.total)
  marginTotal: number;   // Marge (margin.total)
  salaries: number;      // Masse salariale (expenses.salaries)
  hoursWorked: number;   // Heures travaillées (expenses.hoursWorked)
  receivablesClients: number; // Créances clients (bfr.receivables.clients)
  debtsSuppliers: number;     // Dettes fournisseurs (bfr.debts.suppliers)
  stockTotal: number;         // Stock total (bfr.stock.total)
}

export interface RatioResult {
  dso: number;
  dpo: number;
  dio: number;
  bfrDays: number;
  salaryRatio: number;
  productivityPerHour: number;
  costPerHour: number;
  dsoInactive: boolean;
  dpoInactive: boolean;
  dioInactive: boolean;
  bfrDaysInactive: boolean;
  salaryInactive: boolean;
  productivityInactive: boolean;
  costInactive: boolean;
}

export function calculateRatios(input: RatioInput): RatioResult {
  const { ca, marginTotal, salaries, hoursWorked, receivablesClients, debtsSuppliers, stockTotal } = input;

  const achats = Math.max(ca - marginTotal, 0);

  const hasCa = ca > 0;
  const hasAchats = achats > 0;
  const hasSalaries = salaries > 0;
  const hasHours = hoursWorked > 0;
  const hasReceivables = receivablesClients > 0;
  const hasDebtsSuppliers = debtsSuppliers > 0;
  const hasStock = stockTotal > 0;

  const dso = hasCa ? (receivablesClients / ca) * 30 : 0;
  const dpo = hasAchats ? (debtsSuppliers / achats) * 30 : 0;
  const dio = hasAchats ? (stockTotal / achats) * 30 : 0;
  const bfrDays = dso + dio - dpo;
  const salaryRatio = hasCa ? (salaries / ca) * 100 : 0;
  const productivityPerHour = hasHours ? ca / hoursWorked : 0;
  const costPerHour = hasHours ? salaries / hoursWorked : 0;

  // "inactive" = pas de données source pour calculer ce ratio
  const dsoInactive = !hasCa || !hasReceivables;
  const dpoInactive = !hasAchats || !hasDebtsSuppliers;
  const dioInactive = !hasAchats || !hasStock;
  const bfrDaysInactive = dsoInactive && dpoInactive && dioInactive;
  const salaryInactive = !hasCa || !hasSalaries;
  const productivityInactive = !hasCa || !hasHours;
  const costInactive = !hasSalaries || !hasHours;

  return {
    dso, dpo, dio, bfrDays, salaryRatio, productivityPerHour, costPerHour,
    dsoInactive, dpoInactive, dioInactive, bfrDaysInactive, salaryInactive, productivityInactive, costInactive,
  };
}
