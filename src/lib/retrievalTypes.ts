/** Shared shapes for the retrieval layer. Kept separate so provider modules
 *  and the orchestrator can import them without a circular dependency. */

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
  /** 0..1 lexical overlap with the claim. Measured, never random. */
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
