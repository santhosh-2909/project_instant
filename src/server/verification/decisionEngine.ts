/**
 * Decision Engine — PRD §8.3 / §10.
 *
 * Fuses three signals into one verdict:
 *   Layer 1  linguistic prior      (fast, local, free)
 *   Layer 2  retrieved corroboration (real sources — see lib/retrieval.ts)
 *   Layer 3  LLM reasoning          (optional, constrained to Layer 2 output)
 *
 * Guarantees this module upholds, each of which fixes an audit finding:
 *  • Emits Real / Fake / **Uncertain** (P1-1 — Uncertain was never produced).
 *  • `confidence` always means "confidence in the stated verdict", never
 *    inverted (D-3).
 *  • Every returned citation exists in the retrieved set (D-1) — the LLM cannot
 *    introduce a source.
 *  • Fully deterministic: no Math.random anywhere in scoring.
 */

/*
 * BACKEND ONLY. The `server-only` import above makes this a build error if any
 * client component ever imports this module, directly or transitively. That is
 * not theoretical: the UI previously imported `tokenise` from the retrieval
 * module, which shipped the provider stack and the ONNX import path to the
 * browser.
 */
import 'server-only';
import { scoreSignals } from '@/server/verification/heuristics';
import type { RetrievedEvidence, RetrievalOutcome } from '@/shared/types';

export type Verdict = 'Real' | 'Fake' | 'Uncertain';

export interface SignalContribution {
  /** Human-readable name shown in the UI's confidence breakdown. */
  label: string;
  /** -1 (points to Fake) … +1 (points to Real). */
  score: number;
  /** How much this signal counted toward the final decision, 0..1. */
  weight: number;
  /** Plain-language justification. Always populated. */
  detail: string;
}

export interface Decision {
  verdict: Verdict;
  /** 0..100 confidence in `verdict`. Higher always means more certain. */
  confidence: number;
  summary: string;
  signals: SignalContribution[];
  evidence: RetrievedEvidence[];
  /** Set when the system could not reach a confident conclusion. */
  caveats: string[];
  /** Which layers actually contributed. */
  layers: {
    linguistic: boolean;
    retrieval: boolean;
    reference: boolean;
    llm: boolean;
  };
}

/** Below this margin the evidence does not justify committing to a verdict. */
const UNCERTAIN_BAND = 0.18;

/** Retrieval is worth more than prose style; an LLM opinion is worth least. */
const WEIGHTS = {
  factCheck: 0.42,
  corroboration: 0.26,
  reference: 0.2,
  linguistic: 0.06,
  llm: 0.06,
} as const;

/** Providers that count as live news reporting. */
const NEWS_PROVIDERS = new Set(['googlenews', 'newsapi']);

/** Providers that count as curated reference data. */
const REFERENCE_PROVIDERS = new Set(['wikipedia', 'wikidata']);

/* ------------------------------------------------------- Layer 1: language */

export function linguisticSignal(title: string, content: string): SignalContribution {
  const { fakeScore, realScore } = scoreSignals(title, content, []);
  const total = fakeScore + realScore;

  if (total === 0) {
    return {
      label: 'Language analysis',
      score: 0,
      weight: WEIGHTS.linguistic,
      detail: 'No strong sensationalist or attribution markers detected in the text.',
    };
  }

  // Normalised to -1..+1, saturating so a keyword pile-up cannot dominate.
  const raw = (realScore - fakeScore) / Math.max(total, 6);
  const score = Math.max(-1, Math.min(1, raw));

  const detail =
    score < -0.2
      ? `Sensationalist markers outweigh attribution (${fakeScore} vs ${realScore} signals): clickbait phrasing, absolute claims or excessive emphasis.`
      : score > 0.2
        ? `Writing carries journalistic attribution markers (${realScore} vs ${fakeScore} signals): named sources, studies or institutional references.`
        : `Mixed stylistic markers (${realScore} credibility vs ${fakeScore} concern signals). Style alone is not decisive.`;

  return { label: 'Language analysis', score, weight: WEIGHTS.linguistic, detail };
}

/* ------------------------------------------- Layer 2: retrieved evidence */

export function factCheckSignal(evidence: RetrievedEvidence[]): SignalContribution | null {
  const reviews = evidence.filter((e) => e.provider === 'factcheck' && e.stance !== 'Neutral');
  if (reviews.length === 0) return null;

  const contradicting = reviews.filter((e) => e.stance === 'Contradicting');
  const supporting = reviews.filter((e) => e.stance === 'Supporting');

  // Weight each review by relevance so a loosely-matched review counts less.
  const weightOf = (e: RetrievedEvidence) => e.similarity * e.reliability;
  const against = contradicting.reduce((sum, e) => sum + weightOf(e), 0);
  const forClaim = supporting.reduce((sum, e) => sum + weightOf(e), 0);
  const total = against + forClaim;

  if (total === 0) return null;

  const score = Math.max(-1, Math.min(1, (forClaim - against) / total));
  const names = [...new Set(reviews.map((e) => e.publisher))].slice(0, 3).join(', ');

  const detail =
    score < 0
      ? `${contradicting.length} professional fact-check${contradicting.length === 1 ? '' : 's'} (${names}) rated this claim false or misleading.`
      : `${supporting.length} professional fact-check${supporting.length === 1 ? '' : 's'} (${names}) rated this claim accurate.`;

  return { label: 'Professional fact-checks', score, weight: WEIGHTS.factCheck, detail };
}

export function corroborationSignal(evidence: RetrievedEvidence[]): SignalContribution {
  const news = evidence.filter((e) => NEWS_PROVIDERS.has(e.provider));
  const trusted = news.filter((e) => e.reliability >= 0.8);
  const strong = trusted.filter((e) => e.similarity >= 0.3);

  if (news.length === 0) {
    return {
      label: 'Independent corroboration',
      score: -0.35,
      weight: WEIGHTS.corroboration,
      detail:
        'No matching reports found across indexed news outlets. Absence of coverage is weak evidence — a genuine local or very recent story may not be indexed yet.',
    };
  }

  if (strong.length === 0) {
    const names = [...new Set(news.slice(0, 3).map((e) => e.publisher))].join(', ');
    return {
      label: 'Independent corroboration',
      score: -0.15,
      weight: WEIGHTS.corroboration,
      detail: `${news.length} loosely related article${news.length === 1 ? '' : 's'} found (${names}), but none closely match the claim and none are from high-reliability outlets.`,
    };
  }

  // Saturating: three strong independent reports is already convincing.
  const score = Math.min(1, strong.length / 3);
  const names = [...new Set(strong.map((e) => e.publisher))].slice(0, 3).join(', ');

  return {
    label: 'Independent corroboration',
    score,
    weight: WEIGHTS.corroboration,
    detail: `${strong.length} closely-matching report${strong.length === 1 ? '' : 's'} from high-reliability outlets (${names}).`,
  };
}

/**
 * Reference sources (Wikipedia, Wikidata).
 *
 * These answer "what is the recorded state of the world?" rather than "is
 * anyone reporting this?". Wikidata in particular holds current office
 * holders and roles as curated statements, which is decisive for the very
 * common "X is now the Y of Z" forward.
 */
export function referenceSignal(evidence: RetrievedEvidence[]): SignalContribution | null {
  const refs = evidence.filter((e) => REFERENCE_PROVIDERS.has(e.provider));
  if (refs.length === 0) return null;

  // A structured incumbency record is decisive: it states who currently holds
  // an office, which prose about a *former* holder cannot contradict.
  const authoritative = refs.find((e) => e.stance !== 'Neutral' && e.similarity >= 0.9);
  if (authoritative) {
    const supports = authoritative.stance === 'Supporting';
    return {
      label: 'Reference sources',
      score: supports ? 1 : -1,
      // Weighted to outrank corroboration: news coverage of a former office
      // holder is plentiful and would otherwise drown out the current record.
      weight: WEIGHTS.reference + WEIGHTS.corroboration,
      detail: authoritative.snippet,
    };
  }

  const best = refs.reduce((a, b) => (b.similarity > a.similarity ? b : a));

  // A close match against curated reference data supports the claim; a weak one
  // is simply uninformative rather than evidence against it.
  const score = best.similarity >= 0.55 ? 1 : best.similarity >= 0.35 ? 0.5 : 0;

  const detail =
    score >= 1
      ? `Reference data corroborates the claim: ${best.publisher} records "${best.title}".`
      : score > 0
        ? `Reference data is consistent with the claim, though not a direct match: ${best.publisher} records "${best.title}".`
        : `Reference sources were consulted (${refs.length} entr${refs.length === 1 ? 'y' : 'ies'}) but none closely matched the claim.`;

  return { label: 'Reference sources', score, weight: WEIGHTS.reference, detail };
}

/* ------------------------------------------------------------ Layer 3: LLM */

export interface LlmAssessment {
  /** The model's leaning, -1 (fake) … +1 (real). */
  score: number;
  reasoning: string;
}

export function llmSignal(assessment: LlmAssessment | null): SignalContribution | null {
  if (!assessment) return null;
  return {
    label: 'Model reasoning',
    score: Math.max(-1, Math.min(1, assessment.score)),
    weight: WEIGHTS.llm,
    detail: assessment.reasoning,
  };
}

/* --------------------------------------------------------------- Fusion */

/** Assigns each evidence item a stance relative to the decided verdict. */
export function labelStances(evidence: RetrievedEvidence[], verdict: Verdict): RetrievedEvidence[] {
  return evidence.map((item) => {
    // Stances a provider asserted directly — a fact-checker's published rating,
    // or a structured incumbency record — are authoritative. Never overwrite
    // them with a stance inferred from lexical similarity.
    if (item.provider === 'factcheck' && item.stance !== 'Neutral') return item;
    if (item.stance !== 'Neutral' && item.similarity >= 0.9) return item;

    if (verdict === 'Uncertain') return { ...item, stance: 'Neutral' };

    const closeAndCredible = item.similarity >= 0.3 && item.reliability >= 0.8;

    if (verdict === 'Real') {
      return { ...item, stance: closeAndCredible ? 'Supporting' : 'Neutral' };
    }
    // verdict === 'Fake': credible outlets reporting the same thing would have
    // supported it, so a close match from a trusted outlet still reads as
    // context rather than support.
    return { ...item, stance: closeAndCredible ? 'Neutral' : 'Contradicting' };
  });
}

export function fuse(
  signals: SignalContribution[],
  retrieval: RetrievalOutcome,
  claimLength: number
): Decision {
  const active = signals.filter((s) => s.weight > 0);
  const totalWeight = active.reduce((sum, s) => sum + s.weight, 0);

  // Weighted mean of signal scores, -1..+1.
  const net = totalWeight > 0 ? active.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight : 0;

  const caveats: string[] = [];

  /*
   * An authoritative check that was ATTEMPTED and FAILED is not the same as one
   * that never applied. For an "X is the <office> of Y" claim, lexical evidence
   * cannot distinguish a current office holder from a former one — articles
   * about both are equally abundant and equally well-matched. Falling back to
   * that evidence produces a confident WRONG answer, which is the worst outcome
   * this system can produce. So we decline to rule instead.
   */
  const authoritativeCheckFailed = retrieval.providersFailed.includes('wikidata-office');

  if (authoritativeCheckFailed) {
    caveats.push(
      'This claim is about who currently holds an office, but the authoritative record could not be reached. Reporting about a former office holder reads the same as reporting about the current one, so no verdict is given.'
    );
  }

  if (retrieval.offline) {
    caveats.push(
      'No evidence provider is configured, so this verdict rests on language analysis alone and cannot be treated as verification.'
    );
  }
  if (retrieval.providersFailed.length > 0) {
    caveats.push(`Could not reach: ${retrieval.providersFailed.join(', ')}. Evidence coverage is incomplete.`);
  }
  if (claimLength < 40) {
    caveats.push('The submitted text is very short, which limits how much can be verified.');
  }

  /* --- Verdict selection ------------------------------------------------ */

  let verdict: Verdict;
  if (retrieval.offline || authoritativeCheckFailed || Math.abs(net) < UNCERTAIN_BAND) {
    verdict = 'Uncertain';
  } else {
    verdict = net > 0 ? 'Real' : 'Fake';
  }

  /* --- Confidence ------------------------------------------------------- */
  // Confidence is *always* certainty in the verdict actually returned.
  // For Real/Fake it grows with the margin; for Uncertain it grows as the
  // signals converge on genuine ambiguity rather than on missing data.

  let confidence: number;

  if (verdict === 'Uncertain') {
    // Strong, conflicting evidence => we are confident it IS ambiguous.
    // No evidence at all => we are not confident about anything.
    const evidenceDepth = Math.min(1, retrieval.evidence.length / 5);
    const conflict = 1 - Math.abs(net) / UNCERTAIN_BAND; // 1 = perfectly balanced
    confidence = retrieval.offline
      ? 25
      : authoritativeCheckFailed
        ? 30 // we are not confident of anything — the decisive source was unreachable
        : Math.round(38 + evidenceDepth * 22 + Math.max(0, conflict) * 12);
  } else {
    const margin = Math.min(1, (Math.abs(net) - UNCERTAIN_BAND) / (1 - UNCERTAIN_BAND));
    const evidenceDepth = Math.min(1, retrieval.evidence.length / 5);
    // 62 floor (we crossed the band) rising to ~97 with margin and depth.
    confidence = Math.round(62 + margin * 26 + evidenceDepth * 9);
  }

  for (const _ of caveats) confidence -= 4;
  confidence = Math.max(10, Math.min(97, confidence));

  /* --- Summary ---------------------------------------------------------- */

  const dominant = [...active].sort((a, b) => Math.abs(b.score) * b.weight - Math.abs(a.score) * a.weight)[0];

  const summary =
    verdict === 'Uncertain'
      ? retrieval.offline
        ? 'Not enough evidence to reach a verdict. No verification provider is currently configured, so this result reflects language analysis only.'
        : authoritativeCheckFailed
          ? 'No verdict given. This claim depends on who currently holds an office, and the authoritative record could not be reached — so the news coverage found here cannot settle it either way. Please try again shortly.'
          : `The available evidence does not point clearly in either direction. ${dominant?.detail ?? ''}`.trim()
      : verdict === 'Real'
        ? `Evidence supports this claim. ${dominant?.detail ?? ''}`.trim()
        : `Evidence contradicts this claim. ${dominant?.detail ?? ''}`.trim();

  return {
    verdict,
    confidence,
    summary,
    signals: active,
    evidence: labelStances(retrieval.evidence, verdict),
    caveats,
    layers: {
      linguistic: active.some((s) => s.label === 'Language analysis'),
      retrieval: !retrieval.offline,
      reference: active.some((s) => s.label === 'Reference sources'),
      llm: active.some((s) => s.label === 'Model reasoning'),
    },
  };
}

/** Convenience: run the whole fusion for a claim. */
export function decide(
  title: string,
  content: string,
  retrieval: RetrievalOutcome,
  llm: LlmAssessment | null = null
): Decision {
  const signals: SignalContribution[] = [linguisticSignal(title, content)];

  const fc = factCheckSignal(retrieval.evidence);
  if (fc) signals.push(fc);

  const reference = referenceSignal(retrieval.evidence);
  if (reference) signals.push(reference);

  if (!retrieval.offline) signals.push(corroborationSignal(retrieval.evidence));

  const llmContribution = llmSignal(llm);
  if (llmContribution) signals.push(llmContribution);

  return fuse(signals, retrieval, (content || title || '').length);
}
