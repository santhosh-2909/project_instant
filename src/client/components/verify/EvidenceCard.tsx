import { Badge, Meter } from '@/client/components/ui';
import { tokenise } from '@/shared/textMatch';
import type { RetrievedEvidence } from '@/shared/types';
import s from './verify.module.css';

const PROVIDER_LABEL: Record<string, string> = {
  factcheck: 'Google Fact Check',
  newsapi: 'NewsAPI',
  googlenews: 'Google News',
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
};

const STANCE_TONE = {
  Supporting: 'real',
  Contradicting: 'fake',
  Neutral: 'neutral',
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return 'Date not reported';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date not reported';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** The specific words this source shares with the claim — the "why it matched". */
function sharedTerms(claim: string, evidence: RetrievedEvidence, max = 6): string[] {
  const claimTerms = new Set(tokenise(claim));
  const seen = new Set<string>();
  const out: string[] = [];

  for (const token of tokenise(`${evidence.title} ${evidence.snippet}`)) {
    if (!claimTerms.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Every field here comes from the provider response — publisher, author, date,
 * URL and a measured similarity. Nothing is decorative or generated.
 */
export function EvidenceCard({ evidence, claim }: { evidence: RetrievedEvidence; claim: string }) {
  const terms = sharedTerms(claim, evidence);

  return (
    <article className={s.evidence}>
      <div className={s.evidenceTop}>
        <span className={s.publisher}>{evidence.publisher}</span>
        <Badge tone={STANCE_TONE[evidence.stance]} dot>
          {evidence.stance}
        </Badge>
        {evidence.factCheckRating && <Badge tone="info">Rated: {evidence.factCheckRating}</Badge>}
        {evidence.reliability >= 0.85 && <Badge tone="accent">High-reliability source</Badge>}
      </div>

      <h4 className={s.evidenceTitle}>
        <a href={evidence.url} target="_blank" rel="noopener noreferrer">
          {evidence.title}
        </a>
      </h4>

      <div className={s.evidenceMeta}>
        <span>{formatDate(evidence.publishedAt)}</span>
        {evidence.author && <span>By {evidence.author}</span>}
        <span>{hostOf(evidence.url)}</span>
        <span>via {PROVIDER_LABEL[evidence.provider] ?? evidence.provider}</span>
      </div>

      <p className={s.evidenceSnippet}>{evidence.snippet}</p>

      {terms.length > 0 && (
        <div className={s.matchedTerms} aria-label="Terms shared with the claim">
          {terms.map((term) => (
            <span key={term} className={s.term}>
              {term}
            </span>
          ))}
        </div>
      )}

      <div className={s.evidenceScores}>
        <Meter label="Match with claim" value={evidence.similarity * 100} />
        <Meter label="Source reliability" value={evidence.reliability * 100} />
      </div>
    </article>
  );
}
