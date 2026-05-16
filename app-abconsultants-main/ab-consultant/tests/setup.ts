import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 25 ships an experimental built-in `localStorage` that ends up shadowing
// jsdom's (and the Node one is incomplete — missing .clear()). Install a plain
// in-memory polyfill on both globalThis and window so tests have a predictable
// Storage-like object.
class InMemoryStorage {
  private store: Record<string, string> = {};
  get length(): number {
    return Object.keys(this.store).length;
  }
  key(i: number): string | null {
    return Object.keys(this.store)[i] ?? null;
  }
  getItem(k: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, k)
      ? this.store[k]
      : null;
  }
  setItem(k: string, v: string): void {
    this.store[k] = String(v);
  }
  removeItem(k: string): void {
    delete this.store[k];
  }
  clear(): void {
    this.store = {};
  }
}

const storage = new InMemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storage,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

afterEach(() => {
  cleanup();
  // Clear localStorage between tests so persistence-pattern tests don't leak.
  try {
    storage.clear();
  } catch {
    /* ignore — some env edge cases */
  }
});

// Mock Firebase modules so components that import `../firebase` or `../../firebase`
// don't try to initialize a real client during unit tests.
vi.mock('../../firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('../firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

// Firebase auth methods used in LoginScreen
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}));
