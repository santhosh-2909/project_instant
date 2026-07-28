/**
 * Layer 1 — linguistic signal scoring.
 *
 * Pure and deterministic: the same text always produces the same scores. This
 * is the cheapest layer and carries the least weight in the Decision Engine
 * (see lib/decisionEngine.ts), because writing style is weak evidence about
 * whether a claim is true.
 *
 * Note on history: this module previously also owned `smartAnalysis()`, which
 * produced a verdict on its own using keyword counts, a substring-matched
 * "trusted source" list and Math.random()-jittered confidences. That is gone —
 * verdicts now come from retrieved evidence via the Decision Engine.
 */

export const FAKE_ABSURD = [
  'increases lifespan by 100', 'live to 200', 'live forever', 'cure for all diseases',
  'cures all cancer', 'five liters', 'ten liters', 'drink bleach',
  '100 years younger', 'grow back limbs', 'cure cancer overnight',
  'phone in water', 'charge phone in water', 'charge it in water',
  'water charging', 'microwave phone', 'microwave to charge',
];

export const FAKE_HIGH = [
  "you won't believe", "they don't want you to know",
  'scientists baffled', 'doctors hate this', 'one weird trick',
  'government is hiding', 'big pharma hiding', 'illuminati', 'deep state',
  '100% proven', 'guaranteed cure', 'sheeple', 'new world order',
  'share before deleted', 'share before it is taken down', 'miracle cure',
  'forward to everyone', 'mainstream media hiding',
];

export const FAKE_MED = [
  'shocking truth', 'bombshell reveal', 'conspiracy', 'leaked documents prove',
  'alien technology', 'satire', 'parody', 'fictional',
];

export const REAL_HIGH = [
  'according to reuters', 'according to the associated press', 'according to bbc',
  'peer-reviewed study', 'published in the journal', 'published in nature',
  'clinical trial results', 'randomized controlled trial', 'meta-analysis of',
  'national institutes of health', 'world health organization',
  'harvard medical school', 'stanford university', 'oxford university',
  'reuters reported', 'ap reported', 'bbc reported',
];

export const REAL_MED = [
  'according to', 'a new study', 'researchers found', 'experts say',
  'data from', 'official statement', 'spokesperson said',
  'journal of medicine', 'peer review', 'evidence from',
  'percent reduction', 'percent increase', 'double-blind', 'placebo',
];

export interface SignalScores {
  fakeScore: number;
  realScore: number;
}

/**
 * Counts linguistic markers on both sides.
 *
 * Weights: absurd/physically-impossible claims count 3, clickbait phrasing 2,
 * softer markers 1. Attribution to a named authority counts 2, generic
 * attribution 1.
 */
/** Sums the weight for every keyword in `list` that appears in `text`. */
function tally(text: string, list: readonly string[], weight: number): number {
  let total = 0;
  for (const keyword of list) {
    if (text.includes(keyword)) total += weight;
  }
  return total;
}

/** Excessive capitalisation in a title long enough to judge. */
function shoutingScore(title: string): number {
  if (title.length < 8) return 0;
  const capsRatio = (title.match(/[A-Z]/g) ?? []).length / title.length;
  return capsRatio > 0.4 ? 2 : 0;
}

function exclamationScore(text: string): number {
  const count = (text.match(/!/g) ?? []).length;
  if (count >= 2) return 2;
  return count === 1 ? 1 : 0;
}

const STUDY_TERMS = ['study', 'trial', 'research', 'patients'];

/**
 * A specific statistic tied to a study reads as reporting rather than rumour.
 *
 * Implemented as a scan plus a bounded window rather than one regex with a
 * `.{0,40}` bridge, which backtracks super-linearly on adversarial input.
 */
function citedStatisticScore(text: string): number {
  const statistic = /\d+(?:\.\d+)?\s*percent/g;
  let match: RegExpExecArray | null;

  while ((match = statistic.exec(text)) !== null) {
    const window = text.slice(match.index + match[0].length, match.index + match[0].length + 40);
    if (STUDY_TERMS.some((term) => window.includes(term))) return 2;
  }
  return 0;
}

export function scoreSignals(title: string, content: string, _articles: unknown[] = []): SignalScores {
  const safeTitle = title ?? '';
  const text = `${safeTitle} ${content ?? ''}`.toLowerCase();

  const fakeScore =
    tally(text, FAKE_ABSURD, 3) +
    tally(text, FAKE_HIGH, 2) +
    tally(text, FAKE_MED, 1) +
    shoutingScore(safeTitle) +
    exclamationScore(text) +
    // Round, implausible magnitudes.
    (/\b(?:100|200|500|1000)\s*(?:years|pounds|percent|kilograms)\b/.test(text) ? 2 : 0);

  const realScore =
    tally(text, REAL_HIGH, 2) +
    tally(text, REAL_MED, 1) +
    citedStatisticScore(text) +
    // A quoted, attributed statement.
    (/"[^"]{10,}"\s*(?:said|stated|noted)/.test(text) ? 2 : 0);

  return { fakeScore, realScore };
}
