import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetRateLimits } from '@/lib/rateLimit';

// next/navigation is unavailable outside the Next runtime; components under
// test only need router methods to exist.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Suites that need a native runtime — the sentence-transformer runs on ONNX,
 * which cannot load in jsdom — opt into the Node environment with a
 * `@vitest-environment node` docblock. There is no DOM there, so the
 * browser-only cleanup below is skipped rather than crashing the whole file.
 */
const hasDom = typeof window !== 'undefined';

async function cleanupDom() {
  if (!hasDom) return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
}

beforeEach(() => {
  if (hasDom) localStorage.clear();
  resetRateLimits();
});

afterEach(async () => {
  await cleanupDom();
  if (hasDom) localStorage.clear();
});
