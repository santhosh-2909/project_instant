import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetRateLimits } from '@/lib/rateLimit';

// next/navigation is unavailable outside the Next runtime; components under
// test only need router methods to exist.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  localStorage.clear();
  resetRateLimits();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
