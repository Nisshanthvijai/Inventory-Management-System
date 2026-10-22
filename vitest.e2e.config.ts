import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Opt-in, against the REAL Supabase project: `npm run test:e2e`.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test-e2e/**/*.e2e.ts'],
    testTimeout: 30_000, // every call goes to Supabase (~1 s each from India to Sydney)
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
