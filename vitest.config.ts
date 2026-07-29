import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Test-only config. The application itself is built by Next.js (`npm run build`);
 * Vite is present purely as Vitest's transform pipeline.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      /*
       * `server-only` throws unless it is resolved in a React Server Component
       * graph, which Vitest is not. The package ships empty.js for exactly this
       * case — Next.js still enforces the real guard at build time, so aliasing
       * it here weakens nothing. The architecture test in tests/architecture.test.ts
       * checks the same boundary independently.
       */
      'server-only': path.resolve(process.cwd(), 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Process CSS modules and keep the authored class names, so tests can
    // assert on variants (`btnDanger`) rather than opaque hashes.
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
  },
});
