/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

/**
 * Per-provider circuit breaker.
 *
 * A misconfigured provider does not fail for free. An invalid
 * GOOGLE_FACT_CHECK_API_KEY was observed adding latency to every single
 * verification — the request went out, waited, and failed — and that delay was
 * enough to push retrieval past its budget, so a claim that would otherwise
 * have resolved came back "Uncertain" with zero sources.
 *
 * The failure was in one provider; the cost landed on all of them.
 *
 * So: after a few consecutive failures a provider is skipped for a cooldown
 * period, then given one attempt to recover. A key that is simply wrong stops
 * costing latency after the first few requests, while a provider having a
 * momentary wobble comes back on its own.
 */

interface BreakerState {
  consecutiveFailures: number;
  /** Unix ms before which this provider should not be called again. */
  openUntil: number;
}

const state = new Map<string, BreakerState>();

/** Failures needed to open the circuit. Low, because the cost is per-request latency. */
const FAILURE_THRESHOLD = 3;

/** How long to skip a provider once its circuit opens. */
const COOLDOWN_MS = 5 * 60_000;

export function isOpen(provider: string, now = Date.now()): boolean {
  const entry = state.get(provider);
  if (!entry) return false;
  return entry.openUntil > now;
}

export function recordSuccess(provider: string): void {
  state.delete(provider);
}

export function recordFailure(provider: string, now = Date.now()): void {
  const entry = state.get(provider) ?? { consecutiveFailures: 0, openUntil: 0 };
  entry.consecutiveFailures += 1;

  if (entry.consecutiveFailures >= FAILURE_THRESHOLD) {
    entry.openUntil = now + COOLDOWN_MS;
    console.warn(
      `[circuit] "${provider}" failed ${entry.consecutiveFailures} times in a row — ` +
        `skipping it for ${COOLDOWN_MS / 60_000} minutes. Check its credentials at /api/health?probe=1`
    );
    // Reset the counter so one failure after the cooldown does not immediately
    // reopen the circuit — it gets a genuine retry.
    entry.consecutiveFailures = 0;
  }

  state.set(provider, entry);
}

/** Diagnostic for /api/health. */
export function breakerStatus(now = Date.now()): Record<string, { open: boolean; secondsRemaining: number }> {
  const out: Record<string, { open: boolean; secondsRemaining: number }> = {};
  for (const [provider, entry] of state) {
    const open = entry.openUntil > now;
    out[provider] = {
      open,
      secondsRemaining: open ? Math.ceil((entry.openUntil - now) / 1000) : 0,
    };
  }
  return out;
}

/** Test helper. */
export function resetBreakers(): void {
  state.clear();
}
