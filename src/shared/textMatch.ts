/** Deterministic text matching used across every provider and the Decision
 *  Engine. No randomness, no network, no side effects. */

/* --------------------------------------------------------- Publisher trust */

/**
 * Reliability weights, 0..1. Keyed on normalised outlet names and matched on
 * whole words to avoid substring false positives (an early bug scored "Daily
 * Timewaster" as trusted because "time" was in the list).
 */
const RELIABILITY: Record<string, number> = {
  // Global wires and majors
  reuters: 0.97,
  'associated press': 0.97,
  'ap news': 0.97,
  'bbc news': 0.95,
  bbc: 0.95,
  'the guardian': 0.9,
  'the new york times': 0.92,
  'the washington post': 0.91,
  bloomberg: 0.92,
  'financial times': 0.92,
  'the economist': 0.92,
  npr: 0.91,
  'al jazeera': 0.87,
  'abc news': 0.88,
  'nbc news': 0.87,
  'cbs news': 0.87,
  cnn: 0.85,
  politico: 0.85,
  axios: 0.85,
  'the independent': 0.82,
  'the telegraph': 0.82,
  'sky news': 0.84,
  'deutsche welle': 0.88,
  'france 24': 0.86,

  // Indian national press (PRD's primary market)
  'the hindu': 0.92,
  'the indian express': 0.9,
  'indian express': 0.9,
  'the new indian express': 0.86,
  'hindustan times': 0.85,
  'times of india': 0.8,
  'the times of india': 0.8,
  'business standard': 0.87,
  businessline: 0.86,
  'the hindu businessline': 0.87,
  mint: 0.87,
  livemint: 0.87,
  'economic times': 0.84,
  'the economic times': 0.84,
  ndtv: 0.84,
  theprint: 0.85,
  'the wire': 0.83,
  'the wire.in': 0.83,
  scroll: 0.83,
  'scroll.in': 0.83,
  'deccan herald': 0.83,
  'deccan chronicle': 0.79,
  'telangana today': 0.75,
  firstpost: 0.75,
  news18: 0.75,
  'india today': 0.79,
  'republic world': 0.6,
  'ani news': 0.78,
  pti: 0.88,
  'press trust of india': 0.88,

  // Fact-checkers
  'alt news': 0.93,
  'boom live': 0.92,
  boomlive: 0.92,
  boom: 0.92,
  factly: 0.91,
  'pib fact check': 0.88,
  'the quint': 0.8,
  'webqoof': 0.85,
  snopes: 0.9,
  politifact: 0.9,
  'factcheck.org': 0.91,
  'full fact': 0.9,
  'lead stories': 0.85,
  'usa today': 0.83,

  // Reference
  wikipedia: 0.82,
  wikidata: 0.85,
};

/** Normalises an outlet name for lookup: lowercase, no punctuation, trimmed. */
export function normalisePublisher(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\s*[-|–—]\s*.*$/, '') // drop " - Section" suffixes
    .replace(/[^a-z0-9. ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reliability score for a publisher, 0..1.
 *
 * Exact match first, then whole-phrase containment (so "BBC News India"
 * resolves to "bbc news"), never bare substring matching.
 */
export function publisherReliability(name: string): number {
  const key = normalisePublisher(name);
  if (!key) return 0.4;
  if (RELIABILITY[key] !== undefined) return RELIABILITY[key];

  const words = key.split(' ');
  for (const [candidate, score] of Object.entries(RELIABILITY)) {
    const candidateWords = candidate.split(' ');
    for (let i = 0; i + candidateWords.length <= words.length; i++) {
      if (candidateWords.every((word, j) => words[i + j] === word)) return score;
    }
  }
  return 0.4; // unknown outlet — neither trusted nor condemned
}

export const isTrustedPublisher = (name: string) => publisherReliability(name) >= 0.8;

/* ------------------------------------------------------------- Tokenising */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'is', 'are',
  'was', 'were', 'be', 'been', 'has', 'have', 'had', 'that', 'this', 'these', 'those', 'it', 'its',
  'as', 'by', 'from', 'will', 'would', 'can', 'could', 'said', 'says', 'after', 'over', 'new',
  'today', 'todays', 'now', 'currently', 'his', 'her', 'their', 'our', 'you', 'your',
]);

export function tokenise(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-෿ ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Overlap between claim and candidate, 0..1.
 *
 * Coverage of the claim is weighted above symmetric overlap: a long article
 * containing every claim term is strong evidence even though its own
 * vocabulary is much larger.
 */
export function similarity(claim: string, candidate: string): number {
  const a = new Set(tokenise(claim));
  const b = new Set(tokenise(candidate));
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;

  const coverage = shared / a.size;
  const jaccard = shared / (a.size + b.size - shared);
  return Math.min(1, coverage * 0.7 + jaccard * 0.3);
}

/** Reduces a claim to its most distinctive terms for provider queries. */
export function buildQuery(claim: string, maxTerms = 8): string {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const token of tokenise(claim)) {
    if (seen.has(token)) continue;
    seen.add(token);
    terms.push(token);
    if (terms.length >= maxTerms) break;
  }
  return terms.join(' ');
}

/* -------------------------------------------------------- Entity extraction */

const TITLE_WORDS = new Set([
  'today', 'todays', 'breaking', 'the', 'a', 'an', 'is', 'was', 'chief', 'minister', 'prime',
  'president', 'mr', 'mrs', 'ms', 'dr', 'shri',
]);

/**
 * Pulls proper-noun phrases out of a claim — names, places, organisations.
 *
 * Used to build precise provider queries and to look entities up in reference
 * sources. Deliberately simple: capitalised runs, minus leading sentence words.
 */
export function extractEntities(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  // Runs of capitalised words, allowing internal initials like "C. Joseph Vijay".
  for (const match of (text || '').matchAll(/\b([A-Z][\w.'-]*(?:\s+(?:of|de|van|da)?\s*[A-Z][\w.'-]*)*)/g)) {
    const phrase = match[1]
      .split(/\s+/)
      .filter((word) => !TITLE_WORDS.has(word.toLowerCase().replace(/[.]/g, '')))
      .join(' ')
      .trim();

    if (phrase.length < 3) continue;

    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(phrase);
  }

  return found.slice(0, 5);
}
