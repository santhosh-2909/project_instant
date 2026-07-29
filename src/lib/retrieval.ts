/**
 * Evidence retrieval orchestrator.
 *
 * Every item returned originates from a real HTTP response from a real
 * provider, carries its true URL, publisher and publication date, and is scored
 * by measurable overlap with the claim. The reasoning model is never allowed to
 * introduce a source — see lib/decisionEngine.ts and lib/llm.ts.
 *
 * Three providers need **no API key** and therefore always run:
 *   • Google News RSS — real-time reporting from thousands of outlets
 *   • Wikipedia       — encyclopaedic context
 *   • Wikidata        — current structured facts (office holders, dates, roles)
 *
 * Two more are used when a key is configured, and materially improve accuracy:
 *   • Google Fact Check Tools — published fact-checker rulings
 *   • NewsAPI                 — additional archive depth
 */

import { optionalKey } from './env';
import { buildQuery, similarity, tokenise, publisherReliability } from './textMatch';
import type { RetrievedEvidence, RetrievalOutcome, EvidenceStance } from './retrievalTypes';
import { searchGoogleNews } from './providers/googleNews';
import { searchWikipedia, searchWikidata } from './providers/wikipedia';
import { checkOfficeHolder } from './providers/officeHolder';
import { scoreCandidates, warmUp } from './embeddings';

// Re-exported so existing imports from '@/lib/retrieval' keep working.
export type { RetrievedEvidence, RetrievalOutcome, EvidenceStance } from './retrievalTypes';
export {
  buildQuery,
  extractEntities,
  isTrustedPublisher,
  normalisePublisher,
  publisherReliability,
  similarity,
  tokenise,
} from './textMatch';

/* ------------------------------------------------------------ Fact checking */

interface FactCheckPayload {
  claims?: Array<{
    text?: string;
    claimant?: string;
    claimDate?: string;
    claimReview?: Array<{
      publisher?: { name?: string; site?: string };
      url?: string;
      title?: string;
      textualRating?: string;
      reviewDate?: string;
    }>;
  }>;
}

/** Maps a fact-checker's textual rating onto a stance. */
export function stanceFromRating(rating: string): EvidenceStance {
  const value = (rating || '').toLowerCase();
  if (!value) return 'Neutral';

  const falsey = [
    'false', 'fake', 'incorrect', 'misleading', 'pants on fire', 'debunked',
    'no evidence', 'hoax', 'altered', 'satire', 'miscaptioned', 'scam',
  ];
  const truthy = ['true', 'correct', 'accurate', 'confirmed', 'verified', 'mostly true'];

  if (falsey.some((term) => value.includes(term))) return 'Contradicting';
  // 'mostly false' contains 'false' and is caught above, so this stays safe.
  if (truthy.some((term) => value.includes(term))) return 'Supporting';
  return 'Neutral';
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchFactCheck(claim: string, timeoutMs = 4000): Promise<RetrievedEvidence[] | null> {
  const apiKey = optionalKey('GOOGLE_FACT_CHECK_API_KEY');
  if (!apiKey) return null;

  const query = buildQuery(claim, 10);
  if (!query) return [];

  const url =
    'https://factchecktools.googleapis.com/v1alpha1/claims:search?query=' +
    encodeURIComponent(query) +
    '&pageSize=10&languageCode=en&key=' +
    encodeURIComponent(apiKey);

  const data = (await fetchJson(url, timeoutMs)) as FactCheckPayload | null;
  if (!data) return null;

  const out: RetrievedEvidence[] = [];

  for (const item of data.claims ?? []) {
    for (const review of item.claimReview ?? []) {
      if (!review.url) continue;
      const publisher = review.publisher?.name ?? review.publisher?.site ?? 'Fact checker';
      const rating = review.textualRating ?? '';

      out.push({
        title: review.title ?? item.text ?? 'Fact check',
        publisher,
        author: item.claimant ?? null,
        url: review.url,
        publishedAt: review.reviewDate ?? item.claimDate ?? null,
        snippet: item.text ? `Claim reviewed: "${item.text}" — rated ${rating || 'unrated'}.` : rating,
        stance: stanceFromRating(rating),
        similarity: similarity(claim, `${item.text ?? ''} ${review.title ?? ''}`),
        reliability: Math.max(publisherReliability(publisher), 0.85),
        provider: 'factcheck',
        factCheckRating: rating || undefined,
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ NewsAPI */

interface NewsApiPayload {
  articles?: Array<{
    title?: string;
    description?: string | null;
    content?: string | null;
    url?: string;
    author?: string | null;
    publishedAt?: string;
    source?: { name?: string };
  }>;
}

export async function searchNewsApi(claim: string, timeoutMs = 4000): Promise<RetrievedEvidence[] | null> {
  const apiKey = optionalKey('NEWS_API_KEY');
  if (!apiKey) return null;

  const query = buildQuery(claim, 6);
  if (!query) return [];

  const url =
    'https://newsapi.org/v2/everything?q=' +
    encodeURIComponent(query) +
    '&pageSize=12&sortBy=relevancy&language=en&apiKey=' +
    encodeURIComponent(apiKey);

  const data = (await fetchJson(url, timeoutMs)) as NewsApiPayload | null;
  if (!data) return null;

  return (data.articles ?? [])
    .filter((article) => article.title && article.url)
    .map((article) => {
      const publisher = article.source?.name ?? 'Unknown';
      const body = [article.title, article.description, article.content].filter(Boolean).join(' ');
      return {
        title: article.title!,
        publisher,
        author: article.author ?? null,
        url: article.url!,
        publishedAt: article.publishedAt ?? null,
        snippet: article.description ?? article.title!,
        stance: 'Neutral' as const,
        similarity: similarity(claim, body),
        reliability: publisherReliability(publisher),
        provider: 'newsapi' as const,
      };
    });
}

/* ------------------------------------------------------- Dedupe and ranking */

const MIN_SIMILARITY = 0.1;

/** De-duplicates by URL, then by near-identical title. */
export function dedupe(items: RetrievedEvidence[]): RetrievedEvidence[] {
  const byUrl = new Map<string, RetrievedEvidence>();
  for (const item of items) {
    const key = item.url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
    const existing = byUrl.get(key);
    if (!existing || item.similarity > existing.similarity) byUrl.set(key, item);
  }

  const seenTitles = new Set<string>();
  const out: RetrievedEvidence[] = [];
  for (const item of byUrl.values()) {
    const titleKey = tokenise(item.title).slice(0, 8).join(' ');
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (titleKey) seenTitles.add(titleKey);
    out.push(item);
  }
  return out;
}

/** Provider trust bonus applied during ranking. */
const PROVIDER_BONUS: Record<string, number> = {
  factcheck: 0.15,
  wikidata: 0.1,
  wikipedia: 0.06,
  googlenews: 0.02,
  newsapi: 0,
};

/** Ranks by how much an item should move the verdict. */
export function rank(items: RetrievedEvidence[]): RetrievedEvidence[] {
  const score = (item: RetrievedEvidence) =>
    item.similarity * 0.6 + item.reliability * 0.4 + (PROVIDER_BONUS[item.provider] ?? 0);

  return [...items].sort((a, b) => score(b) - score(a));
}

/* ------------------------------------------------------------ Orchestration */

interface ProviderRun {
  id: string;
  run: Promise<RetrievedEvidence[] | null>;
  /** Keyless providers are always expected to answer. */
  configured: boolean;
}

export async function retrieveEvidence(claim: string, limit = 10): Promise<RetrievalOutcome> {
  warmUp(); // begin loading the sentence-transformer without blocking this request

  const query = buildQuery(claim, 8);

  const runs: ProviderRun[] = [
    // Always available — no key required.
    { id: 'googlenews', run: searchGoogleNews(claim, query), configured: true },
    { id: 'wikipedia', run: searchWikipedia(claim, query), configured: true },
    { id: 'wikidata', run: searchWikidata(claim), configured: true },
    // Structured incumbency check — only fires for "X is the <office> of Y".
    // A lookup failure is reported rather than swallowed: without it the verdict
    // would silently fall back to lexical matching, which cannot tell a current
    // office holder from a former one.
    {
      id: 'wikidata-office',
      run: checkOfficeHolder(claim).then((result) => {
        if (result.status === 'checked') return [result.evidence];
        if (result.status === 'lookup-failed') throw new Error(`office check failed at ${result.stage}`);
        return []; // not an office claim — nothing to report
      }),
      configured: true,
    },
    // Optional upgrades.
    { id: 'factcheck', run: searchFactCheck(claim), configured: optionalKey('GOOGLE_FACT_CHECK_API_KEY') !== null },
    { id: 'newsapi', run: searchNewsApi(claim), configured: optionalKey('NEWS_API_KEY') !== null },
  ];

  const settled = await Promise.all(runs.map((entry) => entry.run.catch(() => null)));

  const providersQueried: string[] = [];
  const providersFailed: string[] = [];
  const collected: RetrievedEvidence[] = [];

  settled.forEach((result, index) => {
    const { id, configured } = runs[index];
    if (result === null) {
      // A null from an unconfigured optional provider is expected, not a failure.
      if (configured) providersFailed.push(id);
      return;
    }
    providersQueried.push(id);
    collected.push(...result);
  });

  // Re-score with the semantic layer before filtering, so a paraphrase that
  // shares no distinctive wording is not discarded as irrelevant.
  const rescored = await applySemanticScoring(claim, dedupe(collected));

  const relevant = rescored.filter((item) => item.similarity >= MIN_SIMILARITY);

  return {
    evidence: rank(relevant).slice(0, limit),
    providersQueried,
    providersFailed,
    offline: providersQueried.length === 0,
  };
}

/**
 * Upgrades each item's `similarity` from lexical to hybrid lexical+semantic.
 *
 * Items whose stance a provider asserted directly (a fact-check rating, a
 * structured incumbency record) keep their pinned similarity — those are
 * authoritative and must not be re-ranked below ordinary coverage.
 */
async function applySemanticScoring(claim: string, items: RetrievedEvidence[]): Promise<RetrievedEvidence[]> {
  if (items.length === 0) return items;

  const AUTHORITATIVE = 0.9;
  const scorable = items.filter((item) => item.similarity < AUTHORITATIVE);
  if (scorable.length === 0) return items;

  const scores = await scoreCandidates(
    claim,
    scorable.map((item) => `${item.title}. ${item.snippet}`)
  );

  const updated = new Map<RetrievedEvidence, number>();
  scorable.forEach((item, index) => updated.set(item, scores[index].score));

  return items.map((item) => {
    const next = updated.get(item);
    return next === undefined ? item : { ...item, similarity: next };
  });
}
