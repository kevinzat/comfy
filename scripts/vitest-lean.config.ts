import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/test-lean.ts'],
    globals: true,
    testTimeout: 60_000,
  },
});
