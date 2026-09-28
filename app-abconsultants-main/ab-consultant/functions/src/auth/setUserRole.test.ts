import { describe, it } from 'vitest';

/**
 * Tests for setUserRole are DEFERRED.
 *
 * Rationale: the entire role-detection logic in `setUserRole.ts` is inlined
 * inside the `functions.https.onCall(...)` handler and is tightly coupled to
 * `admin.firestore()` and `admin.auth()` (sequential `where(...).get()` queries
 * and a full-collection scan for collaborators). There is no pure helper to
 * unit-test without one of:
 *   1. Spinning up the Firebase emulator (out of scope here — handled by
 *      the Firestore rules suite in the parent project).
 *   2. Refactoring the handler to extract a pure
 *      `resolveRole(email, { consultants, clients }) => Claims` function.
 *
 * Recommendation: do (2) when next touching this file. Then port the cases:
 *   - email matches a consultant doc → role=consultant, isAdmin=…
 *   - email === SUPER_ADMIN_EMAIL on a consultant → isAdmin=true
 *   - email matches a client owner → role=client, clientId set
 *   - email matches an active collaborator → role=client + collaboratorRole
 *   - email matches a collaborator with status !== 'active' → not matched
 *   - email matches nothing → throws permission-denied
 */
describe.skip('setUserRole — role detection (deferred)', () => {
  it('placeholder — extract resolveRole() helper before testing', () => {
    // Intentionally empty — see file header for rationale.
  });
});
