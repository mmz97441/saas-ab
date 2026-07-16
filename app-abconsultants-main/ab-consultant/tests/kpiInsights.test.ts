import { describe, it, expect } from 'vitest';
import {
  revenueInsights, marginInsights, treasuryInsights, bfrInsights, KpiData,
} from '../lib/kpiInsights';
import { FinancialRecord } from '../types';

/**
 * Les insights croisés pilotent les analyses "cachées" des cartes KPI du
 * dashboard. Comme ce sont eux qui justifient un conseil au dirigeant, on
 * verrouille les seuils de déclenchement ici.
 */

const baseKpi: KpiData = {
  revenue: 100000,
  objective: 100000,
  revenueVariation: 0,
  globalMarginRate: 20,
  marginVariation: 0,
  marginUnset: false,
  treasury: 50000,
  treasuryVariation: 0,
  bfr: 30000,
  bfrVariation: 0,
  bfrDays: 30,
  dso: 30,
  dpo: 30,
  dio: 5,
  masseSalarialeRate: 25,
  caPerHour: 40,
  costPerHour: 20,
  topActivities: [],
};

const snap = (over: Partial<FinancialRecord['bfr']>, cf?: Partial<FinancialRecord['cashFlow']>): FinancialRecord => ({
  id: 'r', clientId: 'c', year: 2026, month: 'Janvier' as any, isValidated: true,
  revenue: { goods: 0, services: 0, total: 100000, objective: 100000 },
  expenses: { salaries: 25000, hoursWorked: 2500, overtimeHours: 0 },
  bfr: {
    receivables: { clients: 0, state: 0, social: 0, other: 0, total: 0 },
    stock: { goods: 0, floating: 0, total: 0 },
    debts: { suppliers: 0, state: 0, social: 0, salaries: 0, other: 0, total: 0 },
    total: 0,
    ...over,
  },
  cashFlow: { active: 50000, passive: 0, treasury: 50000, ...cf },
});

describe('revenueInsights', () => {
  it('flags activity concentration above 60% as critical', () => {
    const k = { ...baseKpi, topActivities: [{ id: 'a', name: 'Transport', val: 70000, percent: 70, marginRate: 18 }] };
    const ins = revenueInsights(k);
    const dep = ins.find(i => i.title === 'Dépendance à une activité');
    expect(dep?.severity).toBe('critical');
  });

  it('flags a big low-margin activity as "croissance sans valeur"', () => {
    const k = { ...baseKpi, globalMarginRate: 20, topActivities: [{ id: 'a', name: 'Négoce', val: 30000, percent: 30, marginRate: 8 }] };
    const ins = revenueInsights(k);
    expect(ins.some(i => i.title === 'Croissance sans valeur')).toBe(true);
  });
});

describe('marginInsights', () => {
  it('detects the scissor effect (CA up, margin rate down)', () => {
    const k = { ...baseKpi, revenueVariation: 8, marginVariation: -1.5 };
    const ins = marginInsights(k);
    const scissor = ins.find(i => i.title === 'Effet ciseau détecté');
    expect(scissor?.severity).toBe('critical');
  });

  it('returns a single info insight when margin is unset', () => {
    const ins = marginInsights({ ...baseKpi, marginUnset: true });
    expect(ins).toHaveLength(1);
    expect(ins[0].severity).toBe('info');
  });
});

describe('treasuryInsights', () => {
  it('flags trompe-l\'œil when treasury positive but DSO high', () => {
    const k = { ...baseKpi, treasury: 50000, dso: 80 };
    const ins = treasuryInsights(k, snap({ receivables: { clients: 40000, state: 0, social: 0, other: 0, total: 40000 } }));
    const t = ins.find(i => i.title === "Trésorerie en trompe-l'œil");
    expect(t?.severity).toBe('critical');
  });

  it('flags fiscal/social debts exceeding treasury (URSSAF risk)', () => {
    const k = { ...baseKpi, treasury: 10000, dso: 20 };
    const ins = treasuryInsights(k, snap({ debts: { suppliers: 0, state: 8000, social: 9000, salaries: 0, other: 0, total: 17000 } }));
    expect(ins.some(i => i.title === 'Dettes fiscales & sociales > trésorerie' && i.severity === 'critical')).toBe(true);
  });
});

describe('bfrInsights', () => {
  it('always reports the cash conversion cycle', () => {
    const ins = bfrInsights(baseKpi);
    expect(ins.some(i => i.title === 'Cycle de conversion du cash')).toBe(true);
  });

  it('flags "tu paies avant d\'être payé" when DSO >> DPO', () => {
    const ins = bfrInsights({ ...baseKpi, dso: 70, dpo: 30 });
    expect(ins.some(i => i.title === "Tu paies avant d'être payé")).toBe(true);
  });
});
