import { defineConfig } from 'vitest/config';

// Dedicated config for Firestore rules tests. Runs in Node (no jsdom),
// without the global firebase mocks used by component tests in tests/setup.ts.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    // The rules-unit-testing emulator handshake can be slow on first run.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
