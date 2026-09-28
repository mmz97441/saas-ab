import { describe, it, expect, vi } from 'vitest';

// dataService.ts pulls in firebase/firestore — stub it so the module loads.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { now: vi.fn() },
}));
vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

import { normalizeId, toShortMonth, MONTH_ORDER } from '../services/dataService';

describe('dataService pure helpers', () => {
  describe('normalizeId', () => {
    it('lowercases and strips non-alphanumerics', () => {
      expect(normalizeId('Nice.Guillaume@gmail.com')).toBe(
        'niceguillaumegmailcom',
      );
    });

    it('trims surrounding whitespace before normalizing', () => {
      expect(normalizeId('  Jean.Dupont@x.fr  ')).toBe('jeandupontxfr');
    });

    it('returns empty string for purely-symbol input', () => {
      expect(normalizeId('@@@!!!---')).toBe('');
    });

    it('handles unicode by stripping it (a-z/0-9 only)', () => {
      // This locks down current behavior: accents are dropped, not normalized.
      expect(normalizeId('café@x.fr')).toBe('cafxfr');
    });
  });

  describe('toShortMonth', () => {
    it('returns the canonical short form for each known French month', () => {
      expect(toShortMonth('Janvier')).toBe('Janv');
      expect(toShortMonth('Février')).toBe('Fév');
      expect(toShortMonth('Juillet')).toBe('Juil');
      expect(toShortMonth('Septembre')).toBe('Sept');
      expect(toShortMonth('Décembre')).toBe('Déc');
    });

    it('falls back to first 4 chars for an unknown month string', () => {
      expect(toShortMonth('Foobar')).toBe('Foob');
    });
  });

  describe('MONTH_ORDER', () => {
    it('contains 12 months in calendar order (Janvier first, Décembre last)', () => {
      expect(MONTH_ORDER).toHaveLength(12);
      expect(MONTH_ORDER[0]).toBe('Janvier');
      expect(MONTH_ORDER[11]).toBe('Décembre');
    });
  });
});
