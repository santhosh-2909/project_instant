/**
 * Shared Wikimedia (Wikipedia + Wikidata) HTTP client.
 *
 * A single claim can trigger eight or more Wikimedia lookups — entity searches,
 * article extracts, office-holder statements. Fired as an unthrottled burst
 * these get rate-limited, and because a throttled lookup used to return `null`
 * the verdict silently degraded to lexical matching. That made results
 * non-deterministic: the same claim could come back Fake or Real depending on
 * traffic, which is worse than being consistently wrong.
 *
 * On serverless the cache and concurrency gate are per-instance, so a cold
 * instance pays full price for its first lookup; warm instances answer from
 * cache in well under a second. Correctness does not depend on the cache — only
 * latency and how often we get throttled do.
 *
 * This client fixes that with three measures:
 *   • a shared TTL cache, so repeated lookups cost nothing
 *   • a concurrency gate, so we never burst
 *   • one bounded retry, so a single throttled response is not fatal
 */

/*
 * BACKEND ONLY. The `server-only` import above makes this a build error if any
 * client component ever imports this module, directly or transitively. That is
 * not theoretical: the UI previously imported `tokenise` from the retrieval
 * module, which shipped the provider stack and the ONNX import path to the
 * browser.
 */
import 'server-only';
const USER_AGENT = 'VeritasGuard/1.0 (news verification research project)';

/* ------------------------------------------------------------------ Cache */

interface CacheEntry {
  value: unknown;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 500;

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: unknown) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Cheapest sufficient eviction: drop the oldest insertion.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

/** Test/maintenance helper. */
export function clearWikimediaCache() {
  cache.clear();
}

export function wikimediaCacheSize() {
  return cache.size;
}

/* ------------------------------------------------------- Concurrency gate */

/*
 * A single claim issues up to eight Wikimedia calls: two for the article
 * search, up to three entity lookups, and three sequential office-holder
 * lookups. At two slots those serialise into a queue long enough to blow the
 * retrieval budget, which shows up as a verdict of "Uncertain" with no sources
 * at all. Four slots keeps the burst small enough to avoid throttling while
 * halving the queue depth.
 */
const MAX_CONCURRENT = 4;
let active = 0;
const queue: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  active += 1;
}

function release() {
  active -= 1;
  const next = queue.shift();
  if (next) next();
}

/* ---------------------------------------------------------------- Request */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Statuses worth a second attempt: throttling and transient server errors. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function attempt(url: string, timeoutMs: number): Promise<{ ok: true; body: unknown } | { ok: false; retryable: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (!response.ok) {
      return { ok: false, retryable: RETRYABLE.has(response.status) };
    }
    return { ok: true, body: await response.json() };
  } catch {
    // Aborts and network errors are both worth one retry.
    return { ok: false, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches JSON from a Wikimedia API, cached, gated and retried once.
 * Returns null only after a genuine, repeated failure.
 */
export async function wikimediaJson(url: string, timeoutMs = 2500): Promise<unknown | null> {
  const cached = cacheGet(url);
  if (cached !== undefined) return cached;

  await acquire();
  try {
    // One retry only. Wikimedia throttles bursts and a failed lookup costs us
    // a verdict, but retrying too eagerly blows the latency budget — which
    // costs us the same verdict, more slowly.
    let result = await attempt(url, timeoutMs);
    if (!result.ok && result.retryable) {
      await sleep(250);
      result = await attempt(url, timeoutMs);
    }

    if (!result.ok) return null;

    cacheSet(url, result.body);
    return result.body;
  } finally {
    release();
  }
}
