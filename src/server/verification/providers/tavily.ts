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

    return (data.results ?? [])
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
          /*
           * Blend Tavily's ranking with our own measurement. Tavily knows how
           * well the page matched the query; our scorer knows how well the text
           * matches the claim. Neither alone is enough — its score reflects a
           * reduced keyword query, not the full claim.
           */
          similarity: Math.max(
            similarity(claim, `${item.title} ${snippet}`),
            typeof item.score === 'number' ? Math.min(1, item.score) * 0.8 : 0
          ),
          reliability: domainReliability(item.url!, publisher),
          provider: 'tavily' as const,
        };
      });
  } catch (error) {
    console.warn('[tavily] request failed:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
