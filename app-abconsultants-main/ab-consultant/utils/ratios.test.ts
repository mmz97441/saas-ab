import { describe, it, expect } from 'vitest';
import { calculateRatios, RatioInput } from './ratios';

/** Données complètes typiques */
const fullInput: RatioInput = {
  ca: 100000,
  marginTotal: 40000,
  salaries: 25000,
  hoursWorked: 500,
  receivablesClients: 15000,
  debtsSuppliers: 8000,
  stockTotal: 5000,
};

describe('calculateRatios', () => {

  // ── DSO ──────────────────────────────────────────────
  describe('DSO (Days Sales Outstanding)', () => {
    it('calcule correctement DSO = (créances / CA) * 30', () => {
      const r = calculateRatios(fullInput);
      // (15000 / 100000) * 30 = 4.5
      expect(r.dso).toBeCloseTo(4.5);
      expect(r.dsoInactive).toBe(false);
    });

    it('DSO inactive si pas de CA', () => {
      const r = calculateRatios({ ...fullInput, ca: 0 });
      expect(r.dso).toBe(0);
      expect(r.dsoInactive).toBe(true);
    });

    it('DSO inactive si pas de créances clients', () => {
      const r = calculateRatios({ ...fullInput, receivablesClients: 0 });
      expect(r.dso).toBe(0);
      expect(r.dsoInactive).toBe(true);
    });
  });

  // ── DPO ──────────────────────────────────────────────
  describe('DPO (Days Payable Outstanding)', () => {
    it('calcule correctement DPO = (dettes fournisseurs / achats) * 30', () => {
      const r = calculateRatios(fullInput);
      // achats = 100000 - 40000 = 60000
      // (8000 / 60000) * 30 = 4.0
      expect(r.dpo).toBeCloseTo(4.0);
      expect(r.dpoInactive).toBe(false);
    });

    it('DPO inactive si marge = CA (achats = 0)', () => {
      const r = calculateRatios({ ...fullInput, marginTotal: 100000 });
      expect(r.dpo).toBe(0);
      expect(r.dpoInactive).toBe(true);
    });

    it('DPO inactive si pas de dettes fournisseurs', () => {
      const r = calculateRatios({ ...fullInput, debtsSuppliers: 0 });
      expect(r.dpo).toBe(0);
      expect(r.dpoInactive).toBe(true);
    });
  });

  // ── DIO ──────────────────────────────────────────────
  describe('DIO (Days Inventory Outstanding)', () => {
    it('calcule correctement DIO = (stock / achats) * 30', () => {
      const r = calculateRatios(fullInput);
      // (5000 / 60000) * 30 = 2.5
      expect(r.dio).toBeCloseTo(2.5);
      expect(r.dioInactive).toBe(false);
    });

    it('DIO inactive si pas de stock', () => {
      const r = calculateRatios({ ...fullInput, stockTotal: 0 });
      expect(r.dio).toBe(0);
      expect(r.dioInactive).toBe(true);
    });
  });

  // ── BFR JOURS ────────────────────────────────────────
  describe('BFR en jours', () => {
    it('calcule correctement BFR = DSO + DIO - DPO', () => {
      const r = calculateRatios(fullInput);
      // 4.5 + 2.5 - 4.0 = 3.0
      expect(r.bfrDays).toBeCloseTo(3.0);
      expect(r.bfrDaysInactive).toBe(false);
    });

    it('BFR peut être négatif (bon signe : cycle de trésorerie favorable)', () => {
      const r = calculateRatios({ ...fullInput, receivablesClients: 1000, debtsSuppliers: 50000 });
      expect(r.bfrDays).toBeLessThan(0);
      expect(r.bfrDaysInactive).toBe(false);
    });

    it('BFR inactive seulement si DSO ET DPO ET DIO sont tous inactifs', () => {
      // DSO inactive (pas de créances), DPO inactive (pas de dettes), DIO inactive (pas de stock)
      const r = calculateRatios({ ...fullInput, receivablesClients: 0, debtsSuppliers: 0, stockTotal: 0 });
      expect(r.bfrDaysInactive).toBe(true);
    });

    it('BFR actif si au moins un sous-ratio est actif', () => {
      // DSO actif (créances > 0), DPO inactive, DIO inactive
      const r = calculateRatios({ ...fullInput, debtsSuppliers: 0, stockTotal: 0 });
      expect(r.bfrDaysInactive).toBe(false);
    });
  });

  // ── RATIO SALARIAL ──────────────────────────────────
  describe('Ratio Salarial (Masse Salariale / CA * 100)', () => {
    it('calcule correctement le ratio salarial en %', () => {
      const r = calculateRatios(fullInput);
      // (25000 / 100000) * 100 = 25%
      expect(r.salaryRatio).toBeCloseTo(25);
      expect(r.salaryInactive).toBe(false);
    });

    it('ratio salarial inactive si pas de CA', () => {
      const r = calculateRatios({ ...fullInput, ca: 0 });
      expect(r.salaryRatio).toBe(0);
      expect(r.salaryInactive).toBe(true);
    });

    it('ratio salarial inactive si pas de salaires', () => {
      const r = calculateRatios({ ...fullInput, salaries: 0 });
      expect(r.salaryRatio).toBe(0);
      expect(r.salaryInactive).toBe(true);
    });
  });

  // ── PRODUCTIVITÉ ────────────────────────────────────
  describe('Productivité (CA / heures)', () => {
    it('calcule correctement la productivité', () => {
      const r = calculateRatios(fullInput);
      // 100000 / 500 = 200 €/h
      expect(r.productivityPerHour).toBeCloseTo(200);
      expect(r.productivityInactive).toBe(false);
    });

    it('productivité inactive si pas d\'heures', () => {
      const r = calculateRatios({ ...fullInput, hoursWorked: 0 });
      expect(r.productivityPerHour).toBe(0);
      expect(r.productivityInactive).toBe(true);
    });

    it('productivité inactive si pas de CA', () => {
      const r = calculateRatios({ ...fullInput, ca: 0 });
      expect(r.productivityPerHour).toBe(0);
      expect(r.productivityInactive).toBe(true);
    });
  });

  // ── COÛT HORAIRE ────────────────────────────────────
  describe('Coût Horaire (salaires / heures)', () => {
    it('calcule correctement le coût horaire', () => {
      const r = calculateRatios(fullInput);
      // 25000 / 500 = 50 €/h
      expect(r.costPerHour).toBeCloseTo(50);
      expect(r.costInactive).toBe(false);
    });

    it('coût horaire inactive si pas d\'heures', () => {
      const r = calculateRatios({ ...fullInput, hoursWorked: 0 });
      expect(r.costPerHour).toBe(0);
      expect(r.costInactive).toBe(true);
    });

    it('coût horaire inactive si pas de salaires', () => {
      const r = calculateRatios({ ...fullInput, salaries: 0 });
      expect(r.costPerHour).toBe(0);
      expect(r.costInactive).toBe(true);
    });
  });

  // ── CAS LIMITES ─────────────────────────────────────
  describe('Cas limites', () => {
    it('tout à zéro → tout inactive', () => {
      const r = calculateRatios({
        ca: 0, marginTotal: 0, salaries: 0, hoursWorked: 0,
        receivablesClients: 0, debtsSuppliers: 0, stockTotal: 0,
      });
      expect(r.dso).toBe(0);
      expect(r.dpo).toBe(0);
      expect(r.dio).toBe(0);
      expect(r.bfrDays).toBe(0);
      expect(r.salaryRatio).toBe(0);
      expect(r.productivityPerHour).toBe(0);
      expect(r.costPerHour).toBe(0);
      expect(r.dsoInactive).toBe(true);
      expect(r.dpoInactive).toBe(true);
      expect(r.dioInactive).toBe(true);
      expect(r.bfrDaysInactive).toBe(true);
      expect(r.salaryInactive).toBe(true);
      expect(r.productivityInactive).toBe(true);
      expect(r.costInactive).toBe(true);
    });

    it('marge supérieure au CA → achats = 0 (max clamp)', () => {
      const r = calculateRatios({ ...fullInput, marginTotal: 200000 });
      // achats = max(100000 - 200000, 0) = 0
      expect(r.dpo).toBe(0);
      expect(r.dio).toBe(0);
      expect(r.dpoInactive).toBe(true);
      expect(r.dioInactive).toBe(true);
    });

    it('valeurs très grandes → pas de NaN ou Infinity', () => {
      const r = calculateRatios({
        ca: 1e12, marginTotal: 5e11, salaries: 2e11, hoursWorked: 1e6,
        receivablesClients: 3e11, debtsSuppliers: 1e11, stockTotal: 5e10,
      });
      expect(Number.isFinite(r.dso)).toBe(true);
      expect(Number.isFinite(r.dpo)).toBe(true);
      expect(Number.isFinite(r.dio)).toBe(true);
      expect(Number.isFinite(r.bfrDays)).toBe(true);
      expect(Number.isFinite(r.salaryRatio)).toBe(true);
      expect(Number.isFinite(r.productivityPerHour)).toBe(true);
      expect(Number.isFinite(r.costPerHour)).toBe(true);
    });
  });
});
