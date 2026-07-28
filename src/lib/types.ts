/** Shared contract between the verification API and the UI. */

import type { SignalContribution, Verdict } from './decisionEngine';
import type { RetrievedEvidence } from './retrieval';

export type { SignalContribution, Verdict, RetrievedEvidence };

export interface ProviderStatus {
  googlenews: boolean;
  wikipedia: boolean;
  wikidata: boolean;
  factCheck: boolean;
  newsapi: boolean;
  groq: boolean;
  gemini: boolean;
}

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

/** Aggregate evidence quality, derived rather than stored. */
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
