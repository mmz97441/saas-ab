import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/rules/**', 'functions/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: [
        'components/**/*.{ts,tsx}',
        'services/**/*.ts',
        'lib/**/*.ts',
        'hooks/**/*.ts',
        'App.tsx',
      ],
      exclude: ['**/*.d.ts', 'tests/**'],
    },
  },
});
