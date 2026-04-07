import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*_test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],  // no .tsx!
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/*.tsx'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    },
  },
});
