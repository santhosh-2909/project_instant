/**
 * The contract between backend and frontend.
 *
 * This module is the ONLY thing both sides are allowed to share, and it must
 * stay free of runtime dependencies on either. Types are declared here and
 * imported *by* the server — not re-exported *from* it. That direction matters:
 * previously the UI imported its types from `lib/retrieval`, which dragged the
 * entire provider stack (and the ONNX runtime import path) into the browser
 * bundle.
 *
 * Nothing here may import from `@/server/**`.
 */

/* ------------------------------------------------------------------ Verdict */

export type Verdict = 'Real' | 'Fake' | 'Uncertain';

export interface SignalContribution {
  /** Human-readable name shown in the confidence breakdown. */
  label: string;
  /** -1 (points to Fake) … +1 (points to Real). */
  score: number;
  /** How much this signal counted toward the final decision, 0..1. */
  weight: number;
  /** Plain-language justification. Always populated. */
  detail: string;
}

/* ----------------------------------------------------------------- Evidence */

export type EvidenceStance = 'Supporting' | 'Contradicting' | 'Neutral';

export type ProviderId = 'factcheck' | 'newsapi' | 'googlenews' | 'wikipedia' | 'wikidata';

export interface RetrievedEvidence {
  title: string;
  /** Publisher / outlet name exactly as the provider reported it. */
  publisher: string;
  author: string | null;
  url: string;
  publishedAt: string | null;
  snippet: string;
  stance: EvidenceStance;
  /** 0..1 relevance to the claim. Measured, never random. */
  similarity: number;
  /** 0..1 publisher reliability. */
  reliability: number;
  provider: ProviderId;
  /** Present only for fact-check provider results. */
  factCheckRating?: string;
}

export interface RetrievalOutcome {
  evidence: RetrievedEvidence[];
  /** Providers that were configured and actually answered. */
  providersQueried: string[];
  /** Providers that failed or timed out. */
  providersFailed: string[];
  /** True when no provider answered at all — the caller must degrade. */
  offline: boolean;
}

/** Providers that need no API key and are therefore always available. */
export const KEYLESS_PROVIDERS: ProviderId[] = ['googlenews', 'wikipedia', 'wikidata'];

/* ------------------------------------------------------------------ Report */

export interface ProviderStatus {
  googlenews: boolean;
  wikipedia: boolean;
  wikidata: boolean;
  factCheck: boolean;
  newsapi: boolean;
  groq: boolean;
  gemini: boolean;
}

/** The exact JSON shape returned by POST /api/news/check. */
export interface VerificationReport {
  claim: { title: string; url: string | null; characters: number };
  verdict: Verdict;
  confidence: number;
  summary: string;
  signals: SignalContribution[];
  evidence: RetrievedEvidence[];
  caveats: string[];
  layers: { linguistic: boolean; retrieval: boolean; reference: boolean; llm: boolean };
  providers: { queried: string[]; failed: string[]; configured: ProviderStatus };
  analyzedAt: string;
  elapsedMs: number;
}

/** A locally-stored verification, used by the history view. */
export interface StoredVerification extends VerificationReport {
  id: string;
}

/* --------------------------------------------------------- Derived helpers */

/**
 * Aggregate evidence quality — derived from the report, never stored, so the
 * UI and the PDF export can never disagree about it.
 */
export function evidenceQuality(report: Pick<VerificationReport, 'evidence'>): {
  label: 'Strong' | 'Moderate' | 'Limited' | 'None';
  score: number;
} {
  const { evidence } = report;
  if (evidence.length === 0) return { label: 'None', score: 0 };

  const avgReliability = evidence.reduce((sum, e) => sum + e.reliability, 0) / evidence.length;
  const avgSimilarity = evidence.reduce((sum, e) => sum + e.similarity, 0) / evidence.length;
  const depth = Math.min(1, evidence.length / 5);

  const score = Math.round((avgReliability * 0.4 + avgSimilarity * 0.35 + depth * 0.25) * 100);

  return {
    label: score >= 70 ? 'Strong' : score >= 45 ? 'Moderate' : 'Limited',
    score,
  };
}

/** What the reader should actually do about this verdict. */
export function recommendationFor(verdict: Verdict): { title: string; body: string; icon: string } {
  switch (verdict) {
    case 'Fake':
      return {
        icon: '⚠',
        title: 'Do not share this claim',
        body:
          'The retrieved evidence contradicts this claim. If you received it as a forward, consider replying with one of the fact-checks cited below rather than passing it on.',
      };
    case 'Real':
      return {
        icon: '✓',
        title: 'Supported by independent reporting',
        body:
          'Multiple independent sources corroborate this claim. Reading the cited coverage directly is still the most reliable way to understand the full context.',
      };
    default:
      return {
        icon: '?',
        title: 'Treat as unverified for now',
        body:
          'There is not enough evidence to rule either way. Breaking stories often land here — check back once more outlets have reported, and avoid sharing it as established fact.',
      };
  }
}
