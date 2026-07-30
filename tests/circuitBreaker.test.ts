// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest';
import { breakerStatus, isOpen, recordFailure, recordSuccess, resetBreakers } from '@/server/verification/circuitBreaker';

beforeEach(() => resetBreakers());

describe('TC-CB-01 a healthy provider is never skipped', () => {
  it('starts closed', () => {
    expect(isOpen('factcheck')).toBe(false);
  });

  it('stays closed after occasional failures below the threshold', () => {
    recordFailure('factcheck');
    recordFailure('factcheck');
    expect(isOpen('factcheck')).toBe(false);
  });

  it('resets the failure count on any success', () => {
    recordFailure('newsapi');
    recordFailure('newsapi');
    recordSuccess('newsapi');
    recordFailure('newsapi');
    recordFailure('newsapi');
    // Two failures either side of a success must not add up to three.
    expect(isOpen('newsapi')).toBe(false);
  });
});

describe('TC-CB-02 a persistently broken provider is skipped', () => {
  it('opens after three consecutive failures', () => {
    for (let i = 0; i < 3; i++) recordFailure('factcheck');
    expect(isOpen('factcheck')).toBe(true);
  });

  it('isolates the failure to that provider', () => {
    for (let i = 0; i < 3; i++) recordFailure('factcheck');
    // The whole reason this exists: one bad key must not cost every other
    // provider its latency budget.
    expect(isOpen('googlenews')).toBe(false);
    expect(isOpen('wikidata')).toBe(false);
  });

  it('reports remaining cooldown for diagnostics', () => {
    for (let i = 0; i < 3; i++) recordFailure('tavily');
    const status = breakerStatus();
    expect(status.tavily.open).toBe(true);
    expect(status.tavily.secondsRemaining).toBeGreaterThan(0);
  });
});

describe('TC-CB-03 recovery', () => {
  const now = 1_000_000;

  it('closes again once the cooldown elapses', () => {
    for (let i = 0; i < 3; i++) recordFailure('factcheck', now);
    expect(isOpen('factcheck', now)).toBe(true);

    // Six minutes later, past the five-minute cooldown.
    expect(isOpen('factcheck', now + 6 * 60_000)).toBe(false);
  });

  it('gives a recovered provider a genuine retry rather than reopening at once', () => {
    for (let i = 0; i < 3; i++) recordFailure('factcheck', now);

    const later = now + 6 * 60_000;
    // One failure after the cooldown must not immediately reopen the circuit,
    // or a provider that recovered would be locked out by a single blip.
    recordFailure('factcheck', later);
    expect(isOpen('factcheck', later)).toBe(false);
  });

  it('clears completely on success', () => {
    for (let i = 0; i < 3; i++) recordFailure('factcheck', now);
    recordSuccess('factcheck');
    expect(isOpen('factcheck', now)).toBe(false);
    expect(breakerStatus(now).factcheck).toBeUndefined();
  });
});
