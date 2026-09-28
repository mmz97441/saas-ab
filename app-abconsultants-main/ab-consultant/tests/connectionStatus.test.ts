import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Re-implements `getConnectionStatus` from `components/ClientPortfolio.tsx`
 * verbatim. The function is not exported from ClientPortfolio (purely internal),
 * but its 4-state classification drives the colored dot on every client card
 * in the consultant portfolio — so we lock it down here.
 *
 * If the production function changes, update this mirror AND add the missing
 * cases. The mirror is the contract.
 */
type ConnectionStatus = 'active' | 'inactive' | 'never' | 'not_invited';

interface MinimalClient {
  owner?: { lastLoginAt?: string };
  invitationStatus?: { lastSentAt?: string };
}

function getConnectionStatus(client: MinimalClient): ConnectionStatus {
  const lastLogin = client.owner?.lastLoginAt;
  if (!lastLogin) {
    if (client.invitationStatus?.lastSentAt) return 'never';
    return 'not_invited';
  }
  const daysSince = Math.floor(
    (Date.now() - new Date(lastLogin).getTime()) / 86400000,
  );
  return daysSince <= 7 ? 'active' : 'inactive';
}

describe('getConnectionStatus — 4-state classification', () => {
  // Pin time so daysSince math is deterministic.
  const NOW = new Date('2026-05-16T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('returns "not_invited" when no lastLoginAt and no invitation', () => {
    expect(getConnectionStatus({})).toBe('not_invited');
    expect(getConnectionStatus({ owner: {} })).toBe('not_invited');
  });

  it('returns "never" when invitation sent but no lastLoginAt', () => {
    expect(
      getConnectionStatus({
        owner: {},
        invitationStatus: { lastSentAt: '2026-05-10T00:00:00.000Z' },
      }),
    ).toBe('never');
  });

  it('returns "active" when lastLogin is today', () => {
    expect(
      getConnectionStatus({
        owner: { lastLoginAt: '2026-05-16T08:00:00.000Z' },
      }),
    ).toBe('active');
  });

  it('returns "active" when lastLogin is exactly 7 days ago (boundary)', () => {
    expect(
      getConnectionStatus({
        owner: { lastLoginAt: '2026-05-09T12:00:00.000Z' },
      }),
    ).toBe('active');
  });

  it('returns "inactive" when lastLogin > 7 days ago', () => {
    expect(
      getConnectionStatus({
        owner: { lastLoginAt: '2026-05-01T12:00:00.000Z' },
      }),
    ).toBe('inactive');
  });

  it('returns "inactive" even if invitation was recent — lastLogin wins', () => {
    expect(
      getConnectionStatus({
        owner: { lastLoginAt: '2026-04-01T00:00:00.000Z' },
        invitationStatus: { lastSentAt: '2026-05-15T00:00:00.000Z' },
      }),
    ).toBe('inactive');
  });
});
