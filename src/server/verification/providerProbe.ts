/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

import { optionalKey } from '@/server/config/env';
import { probeGroq } from '@/server/verification/groqClient';

/**
 * Live credential checks.
 *
 * "Configured" only means a key is present in the environment; it says nothing
 * about whether the key works. That distinction cost real debugging time here:
 * a GROQ_MODEL missing one character, and a GOOGLE_FACT_CHECK_API_KEY that was
 * 72 characters of something other than a Google API key. Both looked correct
 * in the environment and both silently removed a provider from every verdict,
 * because the pipeline degrades rather than failing loudly.
 *
 * This probes each keyed provider with a real request and reports what came
 * back, so a bad key is a five-second check rather than an investigation.
 *
 * Safe to expose: it reports status and error text from the provider, never key
 * material.
 */

export interface ProbeResult {
  provider: string;
  configured: boolean;
  /** True only when the provider answered successfully. */
  working: boolean;
  detail: string;
}

const timeout = (ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
};

/* ------------------------------------------------------- Google Fact Check */

async function probeFactCheck(): Promise<ProbeResult> {
  const key = optionalKey('GOOGLE_FACT_CHECK_API_KEY');
  if (!key) {
    return {
      provider: 'factCheck',
      configured: false,
      working: false,
      detail: 'Not configured. This is the heaviest-weighted source — a hit means a professional fact-checker already ruled on the claim.',
    };
  }

  const t = timeout(10_000);
  try {
    const response = await fetch(
      `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=test&pageSize=1&languageCode=en&key=${encodeURIComponent(key)}`,
      { signal: t.signal, cache: 'no-store' }
    );

    if (response.ok) {
      return { provider: 'factCheck', configured: true, working: true, detail: 'Responding normally.' };
    }

    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const message = body?.error?.message ?? `HTTP ${response.status}`;

    // The overwhelmingly common cause, and the one with a specific remedy.
    const looksWrongShape = !key.startsWith('AIza');
    const hint = looksWrongShape
      ? ' A Google API key starts with "AIza" and is about 39 characters. Create one at console.cloud.google.com → APIs & Services → Credentials, then enable "Fact Check Tools API".'
      : ' Check that the Fact Check Tools API is enabled for this key\'s project.';

    return { provider: 'factCheck', configured: true, working: false, detail: message + hint };
  } catch (error) {
    return {
      provider: 'factCheck',
      configured: true,
      working: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    t.done();
  }
}

/* ------------------------------------------------------------------ NewsAPI */

async function probeNewsApi(): Promise<ProbeResult> {
  const key = optionalKey('NEWS_API_KEY');
  if (!key) {
    return { provider: 'newsapi', configured: false, working: false, detail: 'Not configured. Google News RSS covers this partially and needs no key.' };
  }

  const t = timeout(10_000);
  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=test&pageSize=1&language=en&apiKey=${encodeURIComponent(key)}`,
      { signal: t.signal, cache: 'no-store' }
    );
    const body = (await response.json().catch(() => null)) as
      | { status?: string; message?: string; totalResults?: number }
      | null;

    if (response.ok && body?.status === 'ok') {
      return { provider: 'newsapi', configured: true, working: true, detail: `Responding normally (${body.totalResults ?? 0} results for a test query).` };
    }
    return { provider: 'newsapi', configured: true, working: false, detail: body?.message ?? `HTTP ${response.status}` };
  } catch (error) {
    return { provider: 'newsapi', configured: true, working: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    t.done();
  }
}

/* ------------------------------------------------------------------- Tavily */

async function probeTavily(): Promise<ProbeResult> {
  const key = optionalKey('TAVILY_API_KEY');
  if (!key) {
    return { provider: 'tavily', configured: false, working: false, detail: 'Not configured. Web search beyond news and encyclopaedias is unavailable.' };
  }

  const t = timeout(15_000);
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: t.signal,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      // Deliberately minimal: a probe should cost one credit, not two.
      body: JSON.stringify({ query: 'test', search_depth: 'basic', max_results: 1 }),
    });

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { results?: unknown[] } | null;
      return { provider: 'tavily', configured: true, working: true, detail: `Responding normally (${body?.results?.length ?? 0} results). Note: this probe spends one search from your monthly quota.` };
    }

    const text = await response.text().catch(() => '');
    const hint = !key.startsWith('tvly-') ? ' A Tavily key normally starts with "tvly-".' : '';
    return { provider: 'tavily', configured: true, working: false, detail: `HTTP ${response.status}: ${text.slice(0, 160)}${hint}` };
  } catch (error) {
    return { provider: 'tavily', configured: true, working: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    t.done();
  }
}

/* --------------------------------------------------------------------- Groq */

async function probeGroqProvider(): Promise<ProbeResult> {
  const result = await probeGroq();
  if (!result.configured) {
    return { provider: 'groq', configured: false, working: false, detail: 'Not configured. Verdicts still work; the AI reasoning signal and written report do not.' };
  }
  return {
    provider: 'groq',
    configured: true,
    working: result.reachable,
    detail: result.reachable
      ? `Responding via ${result.model}.`
      : (result.error ?? 'No model in the chain responded.') +
        ' List valid ids with: curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"',
  };
}

/* ---------------------------------------------------------------- Aggregate */

export interface ProbeReport {
  /** Providers that need no key and are therefore always available. */
  keyless: string[];
  probes: ProbeResult[];
  /** Configured but not working — the cases worth acting on. */
  broken: string[];
}

export async function probeAllProviders(): Promise<ProbeReport> {
  const probes = await Promise.all([probeFactCheck(), probeNewsApi(), probeTavily(), probeGroqProvider()]);

  return {
    keyless: ['googlenews', 'wikipedia', 'wikidata', 'embeddings'],
    probes,
    broken: probes.filter((p) => p.configured && !p.working).map((p) => p.provider),
  };
}
