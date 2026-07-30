/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

import { optionalKey } from '@/server/config/env';
import { publisherReliability, similarity } from '@/shared/textMatch';
import type { RetrievedEvidence } from '@/shared/types';

/**
 * Tavily — general web search built for retrieval pipelines.
 *
 * Fills the gap the other providers leave. Google News RSS and NewsAPI only see
 * news outlets; Wikipedia and Wikidata only see encyclopaedic records. A claim
 * debunked on a government portal, a university page or a company statement is
 * invisible to all four. Tavily searches the open web and returns ranked
 * passages with its own relevance score.
 *
 * QUOTA DISCIPLINE: the free tier is 1,000 searches/month — roughly 33 a day.
 * Calling it on every verification would exhaust that in hours under any real
 * traffic, so it is an *escalation* tier: it runs only when the free providers
 * have not produced convincing evidence. See `shouldEscalate` below.
 */

const ENDPOINT = 'https://api.tavily.com/search';

export interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  /** Tavily's own 0..1 relevance score. */
  score?: number;
  published_date?: string;
}

interface TavilyPayload {
  results?: TavilyResult[];
  answer?: string;
}

/* --------------------------------------------------------------- Publisher */

/** Derives a readable outlet name from a URL, since Tavily returns no publisher. */
export function publisherFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');

    // Government and academic domains carry institutional weight worth naming.
    const parts = host.split('.');
    const core = parts.length > 2 && parts[parts.length - 2].length <= 3
      ? parts[parts.length - 3] // e.g. pib.gov.in -> pib
      : parts[0];

    return core.charAt(0).toUpperCase() + core.slice(1);
  } catch {
    return 'Web';
  }
}

/**
 * Institutional domains are more reliable than the generic 0.4 an unknown
 * outlet receives, and Tavily surfaces a lot of them.
 */
export function domainReliability(url: string, publisher: string): number {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 0.4;
  }

  // Official sources: government, international bodies, universities.
  if (/\.gov(\.[a-z]{2})?$/.test(host) || host.endsWith('.gov.in')) return 0.93;
  if (/\.(int|who\.int)$/.test(host) || host.endsWith('un.org') || host.endsWith('who.int')) return 0.93;
  if (/\.(edu|ac\.[a-z]{2})$/.test(host)) return 0.88;
  if (host.endsWith('.nic.in') || host.endsWith('pib.gov.in')) return 0.92;

  // Otherwise defer to the shared publisher table, which knows news outlets.
  const known = publisherReliability(publisher);
  if (known >= 0.8) return known;

  // A generic web page is weaker evidence than an identified news outlet.
  return Math.max(0.45, known);
}

/* ---------------------------------------------------------------- Escalation */

/**
 * Whether Tavily is worth spending a search on.
 *
 * True when the free providers left us short: no strong, closely-matching
 * evidence from a reliable source. If they already answered convincingly,
 * another search would cost quota without changing the verdict.
 */
export function shouldEscalate(existing: RetrievedEvidence[]): boolean {
  const strong = existing.filter((item) => item.similarity >= 0.35 && item.reliability >= 0.8);
  if (strong.length >= 3) return false;

  // A published fact-check on this exact claim already settles it.
  const decisiveFactCheck = existing.some(
    (item) => item.provider === 'factcheck' && item.stance !== 'Neutral' && item.similarity >= 0.4
  );
  if (decisiveFactCheck) return false;

  // An authoritative incumbency record is likewise decisive.
  const authoritative = existing.some((item) => item.similarity >= 0.9 && item.stance !== 'Neutral');
  if (authoritative) return false;

  return true;
}

/* ------------------------------------------------------------------ Search */

/**
 * Maps a Tavily payload onto our evidence shape.
 *
 * Separated from the HTTP call so it can be tested against a recorded real
 * response rather than an assumed one. Verified against live output: results
 * carry `url`, `title`, `content` and `score`, and — notably — **no
 * `published_date`**, so evidence dates come back null for this provider.
 */
export function mapTavilyResults(claim: string, results: TavilyResult[]): RetrievedEvidence[] {
  return results
    .filter((item) => item.url && item.title)
    .map((item) => {
      const publisher = publisherFromUrl(item.url!);
      const snippet = (item.content ?? '').slice(0, 400);

      return {
        title: item.title!,
        publisher,
        author: null,
        url: item.url!,
        publishedAt: item.published_date ?? null,
        snippet: snippet || item.title!,
        stance: 'Neutral' as const,
        similarity: blendRelevance(claim, item, snippet),
        reliability: domainReliability(item.url!, publisher),
        provider: 'tavily' as const,
      };
    });
}

/**
 * Blends Tavily's ranking with our own measurement.
 *
 * Neither alone is right. Tavily scores a page against a reduced keyword query,
 * not the full claim; our scorer measures the claim but cannot see how the page
 * ranked against the whole web.
 *
 * Its scores also run low and compressed — a live query returned 0.19 to 0.41
 * across five results — so they are stretched rather than damped. Damping them
 * would push nearly every web result under the 0.3 threshold that
 * `corroborationSignal` treats as a close match, making the provider
 * contribute almost nothing.
 */
export function blendRelevance(claim: string, item: TavilyResult, snippet: string): number {
  const measured = similarity(claim, `${item.title ?? ''} ${snippet}`);

  if (typeof item.score !== 'number' || !Number.isFinite(item.score)) return measured;

  // Map Tavily's usable band (~0.15-0.60) onto 0..1 before comparing.
  const stretched = Math.max(0, Math.min(1, (item.score - 0.15) / 0.45));

  return Math.max(measured, stretched);
}

export async function searchTavily(
  claim: string,
  query: string,
  { timeoutMs = 6000, maxResults = 8 } = {}
): Promise<RetrievedEvidence[] | null> {
  const apiKey = optionalKey('TAVILY_API_KEY');
  if (!apiKey) return null;
  if (!query.trim()) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: claim.slice(0, 380),
        // "basic" costs one credit; "advanced" costs two. Quota is scarce.
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn(`[tavily] HTTP ${response.status}: ${detail.slice(0, 160)}`);
      return null;
    }

    const data = (await response.json()) as TavilyPayload;
    return mapTavilyResults(claim, data.results ?? []);
  } catch (error) {
    console.warn('[tavily] request failed:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
