import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Re-implements `getDossierHealth` from `components/ClientPortfolio.tsx` (Wave 3.5).
 * This function classifies a client into critical/attention/idle/ok and drives
 * the colored pill on every client card. Not exported from the component, so
 * we lock down the priority chain here.
 *
 * Priority order under test (most → least specific):
 *   1. CRITICAL (treasury or stale-pending)
 *   2. ATTENTION (pending OR stale OR invited-but-never-connected > 7d)
 *   3. IDLE (not invited OR brand-new no-data)
 *   4. OK (everything else)
 */
type HealthLevel = 'critical' | 'attention' | 'ok' | 'idle';
type ConnectionStatus = 'active' | 'inactive' | 'never' | 'not_invited';

interface MinimalClient {
  invitationStatus?: { lastSentAt?: string };
}
interface DossierHealthKpi {
  treasuryAlert: boolean;
  dataFresh: boolean;
  pendingValidation: boolean;
  lastRecordValidated: boolean;
  lastActivity: string;
}

function getDossierHealthLevel(
  client: MinimalClient,
  kpi: DossierHealthKpi,
  connectionStatus: ConnectionStatus,
): HealthLevel {
  const invitedAt = client.invitationStatus?.lastSentAt;
  const daysSinceInvite = invitedAt
    ? Math.floor((Date.now() - new Date(invitedAt).getTime()) / 86400000)
    : null;

  const dataStale = !kpi.dataFresh && kpi.lastActivity !== 'Aucune';

  // CRITICAL
  if (kpi.treasuryAlert || (kpi.pendingValidation && dataStale)) {
    return 'critical';
  }
  // ATTENTION
  const inactiveSinceInvite =
    connectionStatus === 'never' &&
    daysSinceInvite !== null &&
    daysSinceInvite > 7;
  if (kpi.pendingValidation || dataStale || inactiveSinceInvite) {
    return 'attention';
  }
  // IDLE
  if (
    connectionStatus === 'not_invited' ||
    (kpi.lastActivity === 'Aucune' && !kpi.dataFresh)
  ) {
    return 'idle';
  }
  // OK
  return 'ok';
}

const okKpi: DossierHealthKpi = {
  treasuryAlert: false,
  dataFresh: true,
  pendingValidation: false,
  lastRecordValidated: true,
  lastActivity: 'Il y a 2j',
};

describe('getDossierHealth — composite health pill (Wave 3.5)', () => {
  const NOW = new Date('2026-05-16T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('returns "critical" on treasury alert (even if everything else is fine)', () => {
    expect(
      getDossierHealthLevel({}, { ...okKpi, treasuryAlert: true }, 'active'),
    ).toBe('critical');
  });

  it('returns "critical" when pending validation AND data is stale', () => {
    expect(
      getDossierHealthLevel(
        {},
        { ...okKpi, pendingValidation: true, dataFresh: false },
        'active',
      ),
    ).toBe('critical');
  });

  it('returns "attention" when pending validation but data is fresh', () => {
    expect(
      getDossierHealthLevel(
        {},
        { ...okKpi, pendingValidation: true },
        'active',
      ),
    ).toBe('attention');
  });

  it('returns "attention" when invited > 7d ago and never connected', () => {
    expect(
      getDossierHealthLevel(
        { invitationStatus: { lastSentAt: '2026-05-01T00:00:00.000Z' } }, // 15d ago
        okKpi,
        'never',
      ),
    ).toBe('attention');
  });

  it('returns "ok" when invited recently (≤7d) and never connected', () => {
    expect(
      getDossierHealthLevel(
        { invitationStatus: { lastSentAt: '2026-05-14T00:00:00.000Z' } }, // 2d
        okKpi,
        'never',
      ),
    ).toBe('ok');
  });

  it('returns "idle" when not invited yet', () => {
    expect(getDossierHealthLevel({}, okKpi, 'not_invited')).toBe('idle');
  });

  it('returns "idle" for a brand-new dossier with no data', () => {
    expect(
      getDossierHealthLevel(
        {},
        { ...okKpi, dataFresh: false, lastActivity: 'Aucune' },
        'active',
      ),
    ).toBe('idle');
  });

  it('returns "ok" in the happy path', () => {
    expect(getDossierHealthLevel({}, okKpi, 'active')).toBe('ok');
  });

  it('treasury alert beats not_invited (critical wins over idle)', () => {
    expect(
      getDossierHealthLevel(
        {},
        { ...okKpi, treasuryAlert: true },
        'not_invited',
      ),
    ).toBe('critical');
  });
});
