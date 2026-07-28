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
