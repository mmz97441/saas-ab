import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Mirrors the App.tsx useEffect logic that decides whether to show the
 * "nouvelles données publiées" green banner to a client.
 *
 * Regression: before the fix, the banner false-fired on every login because
 * the baseline was kept in an in-memory ref (null/0) and got beaten by the
 * Firestore snapshot (0 → N).
 */
function shouldShowBanner(publishedCount: number, storageKey: string): boolean {
  const raw = localStorage.getItem(storageKey);
  let stored: number | null = raw === null ? null : parseInt(raw, 10);
  if (Number.isNaN(stored as number)) stored = null;
  const fire = stored !== null && publishedCount > stored;
  localStorage.setItem(storageKey, String(publishedCount));
  return fire;
}

describe('newDataBanner — published count baseline (regression: false-fire on every login)', () => {
  beforeEach(() => localStorage.clear());

  it('does NOT fire on first login ever (no baseline)', () => {
    expect(shouldShowBanner(5, 'ab.lastSeenPublished.clientA')).toBe(false);
    expect(localStorage.getItem('ab.lastSeenPublished.clientA')).toBe('5');
  });

  it('does NOT fire on subsequent login when count unchanged', () => {
    shouldShowBanner(5, 'ab.lastSeenPublished.clientA'); // baseline
    expect(shouldShowBanner(5, 'ab.lastSeenPublished.clientA')).toBe(false);
  });

  it('fires when consultant publishes new data between sessions', () => {
    shouldShowBanner(5, 'ab.lastSeenPublished.clientA'); // baseline = 5
    expect(shouldShowBanner(7, 'ab.lastSeenPublished.clientA')).toBe(true);
  });

  it('does NOT re-fire after user has seen the banner once', () => {
    shouldShowBanner(5, 'ab.lastSeenPublished.clientA');
    shouldShowBanner(7, 'ab.lastSeenPublished.clientA'); // fires, baseline now 7
    expect(shouldShowBanner(7, 'ab.lastSeenPublished.clientA')).toBe(false);
  });

  it('does NOT fire when count drops (e.g. consultant unpublished a record)', () => {
    shouldShowBanner(5, 'ab.lastSeenPublished.clientA');
    expect(shouldShowBanner(3, 'ab.lastSeenPublished.clientA')).toBe(false);
  });

  it('is per-client (different keys do not interfere)', () => {
    shouldShowBanner(5, 'ab.lastSeenPublished.clientA');
    expect(shouldShowBanner(3, 'ab.lastSeenPublished.clientB')).toBe(false);
    // client A unchanged
    expect(localStorage.getItem('ab.lastSeenPublished.clientA')).toBe('5');
  });

  it('recovers from corrupted storage value (NaN treated as no baseline)', () => {
    localStorage.setItem('ab.lastSeenPublished.clientA', 'not-a-number');
    expect(shouldShowBanner(5, 'ab.lastSeenPublished.clientA')).toBe(false);
    expect(localStorage.getItem('ab.lastSeenPublished.clientA')).toBe('5');
  });
});
