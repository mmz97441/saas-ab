import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rateLimiter';

/**
 * Note: the rate limiter is module-scoped in-memory state (no reset API).
 * We avoid pollution between tests by using unique uids per test.
 */
describe('checkRateLimit — in-memory counter', () => {
  it('allows first request under limit and reports remaining', () => {
    const uid = `u1-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(uid, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('decrements remaining for each call up to the limit', () => {
    const uid = `u-dec-${Date.now()}-${Math.random()}`;
    const r1 = checkRateLimit(uid, 3, 60_000);
    const r2 = checkRateLimit(uid, 3, 60_000);
    const r3 = checkRateLimit(uid, 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it('blocks request after limit is hit', () => {
    const uid = `u2-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(uid, 5, 60_000);
    }
    const result = checkRateLimit(uid, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('resets after window expires', async () => {
    const uid = `u3-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(uid, 3, 100);
    expect(checkRateLimit(uid, 3, 100).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 150));
    expect(checkRateLimit(uid, 3, 100).allowed).toBe(true);
  });

  it('tracks different uids independently', () => {
    const uid1 = `multi1-${Date.now()}-${Math.random()}`;
    const uid2 = `multi2-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(uid1, 3, 60_000);
    expect(checkRateLimit(uid1, 3, 60_000).allowed).toBe(false);
    expect(checkRateLimit(uid2, 3, 60_000).allowed).toBe(true);
  });

  it('uses defaults when only uid is provided (30/hr)', () => {
    const uid = `u-defaults-${Date.now()}-${Math.random()}`;
    const result = checkRateLimit(uid);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });
});
