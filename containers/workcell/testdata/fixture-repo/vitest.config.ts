import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: process.env.LIVEMAIN_CACHE_DIR ?? 'node_modules/.vite',
  test: {
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
    watch: false,
  },
});
