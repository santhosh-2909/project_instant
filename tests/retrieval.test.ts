import { describe, it, expect } from 'vitest';
import {
  buildQuery,
  dedupe,
  isTrustedPublisher,
  normalisePublisher,
  publisherReliability,
  rank,
  similarity,
  stanceFromRating,
  tokenise,
  type RetrievedEvidence,
} from '@/server/verification/retrieval';

function evidence(overrides: Partial<RetrievedEvidence> = {}): RetrievedEvidence {
  return {
    title: 'Sample headline',
    publisher: 'Reuters',
    author: null,
    url: 'https://example.com/a',
    publishedAt: '2026-07-01T00:00:00Z',
    snippet: 'Sample snippet',
    stance: 'Neutral',
    similarity: 0.5,
    reliability: 0.9,
    provider: 'newsapi',
    ...overrides,
  };
}

describe('TC-RET-01 publisherReliability()', () => {
  it('scores known outlets highly', () => {
    expect(publisherReliability('Reuters')).toBeGreaterThanOrEqual(0.95);
    expect(publisherReliability('BBC News')).toBeGreaterThanOrEqual(0.9);
    expect(publisherReliability('Alt News')).toBeGreaterThanOrEqual(0.9);
  });

  it('is case- and punctuation-insensitive', () => {
    expect(publisherReliability('REUTERS')).toBe(publisherReliability('Reuters'));
    expect(publisherReliability('The Guardian!')).toBe(publisherReliability('the guardian'));
  });

  it('resolves outlets with a section suffix', () => {
    expect(publisherReliability('BBC News - Technology')).toBeGreaterThanOrEqual(0.9);
  });

  it('matches on whole words inside a longer name', () => {
    expect(publisherReliability('BBC News India')).toBeGreaterThanOrEqual(0.9);
  });

  it('REGRESSION: no substring false positives (the old isTrusted bug)', () => {
    // 'time' used to be a trusted token, so any name containing it passed.
    expect(isTrustedPublisher('Daily Timewaster Blog')).toBe(false);
    expect(isTrustedPublisher('Fake News Timeline')).toBe(false);
    expect(isTrustedPublisher('CNNews Clone')).toBe(false);
  });

  it('gives unknown outlets a neutral score rather than condemning them', () => {
    const score = publisherReliability('Some Local Paper');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.8);
  });

  it('handles empty input safely', () => {
    expect(publisherReliability('')).toBe(0.4);
    expect(normalisePublisher('')).toBe('');
  });
});

describe('TC-RET-02 tokenise() and similarity()', () => {
  it('drops stopwords and short tokens', () => {
    const tokens = tokenise('The government is on the way to a new policy');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('is');
    expect(tokens).toContain('government');
    expect(tokens).toContain('policy');
  });

  it('scores identical text at 1', () => {
    const text = 'Government announces free electricity for households';
    expect(similarity(text, text)).toBeCloseTo(1, 5);
  });

  it('scores unrelated text near 0', () => {
    expect(similarity('Cricket team wins tournament', 'Volcano erupts in Iceland')).toBe(0);
  });

  it('rewards a candidate that covers the whole claim', () => {
    const claim = 'free electricity announced';
    const covering = 'The government announced free electricity for every household nationwide';
    const partial = 'Electricity prices discussed at length in parliament yesterday';
    expect(similarity(claim, covering)).toBeGreaterThan(similarity(claim, partial));
  });

  it('is deterministic — repeated calls give identical scores', () => {
    const a = similarity('claim about policy', 'policy claim document');
    const b = similarity('claim about policy', 'policy claim document');
    expect(a).toBe(b);
  });

  it('returns 0 rather than NaN for empty input', () => {
    expect(similarity('', 'anything')).toBe(0);
    expect(similarity('anything', '')).toBe(0);
  });
});

describe('TC-RET-03 buildQuery()', () => {
  it('reduces a claim to distinctive terms', () => {
    const query = buildQuery('The government of India announces a brand new electricity subsidy scheme');
    expect(query.split(' ').length).toBeLessThanOrEqual(8);
    expect(query).not.toMatch(/\bthe\b/);
  });

  it('de-duplicates repeated terms', () => {
    const query = buildQuery('electricity electricity electricity subsidy');
    expect(query.split(' ').filter((t) => t === 'electricity')).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(buildQuery('')).toBe('');
  });
});

describe('TC-RET-04 stanceFromRating()', () => {
  it('maps false-family ratings to Contradicting', () => {
    for (const rating of ['False', 'Mostly false', 'Pants on Fire', 'Misleading', 'Hoax', 'No evidence']) {
      expect(stanceFromRating(rating)).toBe('Contradicting');
    }
  });

  it('maps true-family ratings to Supporting', () => {
    for (const rating of ['True', 'Mostly true', 'Accurate', 'Confirmed']) {
      expect(stanceFromRating(rating)).toBe('Supporting');
    }
  });

  it('treats "mostly false" as contradicting, not supporting', () => {
    // 'mostly false' contains neither 'true' first nor should it read as support.
    expect(stanceFromRating('Mostly False')).toBe('Contradicting');
  });

  it('returns Neutral for unknown or empty ratings', () => {
    expect(stanceFromRating('')).toBe('Neutral');
    expect(stanceFromRating('Unrated')).toBe('Neutral');
  });
});

describe('TC-RET-05 dedupe()', () => {
  it('collapses the same URL, keeping the better match', () => {
    const items = [
      evidence({ url: 'https://x.com/a', similarity: 0.3 }),
      evidence({ url: 'https://x.com/a', similarity: 0.8 }),
    ];
    const result = dedupe(items);
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.8);
  });

  it('ignores trailing slashes and query strings when comparing URLs', () => {
    const items = [
      evidence({ url: 'https://x.com/story/' }),
      evidence({ url: 'https://x.com/story?utm_source=news' }),
    ];
    expect(dedupe(items)).toHaveLength(1);
  });

  it('collapses near-identical titles from different URLs', () => {
    const items = [
      evidence({ url: 'https://a.com/1', title: 'Government announces free electricity scheme today' }),
      evidence({ url: 'https://b.com/2', title: 'Government announces free electricity scheme today' }),
    ];
    expect(dedupe(items)).toHaveLength(1);
  });

  it('keeps genuinely different items', () => {
    const items = [
      evidence({ url: 'https://a.com/1', title: 'Electricity subsidy announced by ministry' }),
      evidence({ url: 'https://b.com/2', title: 'Cricket final ends in a dramatic tie' }),
    ];
    expect(dedupe(items)).toHaveLength(2);
  });
});

describe('TC-RET-06 rank()', () => {
  it('places fact-checks above equally-matched news', () => {
    const items = [
      evidence({ url: 'https://n.com', provider: 'newsapi', similarity: 0.6, reliability: 0.9 }),
      evidence({ url: 'https://f.com', provider: 'factcheck', similarity: 0.6, reliability: 0.9 }),
    ];
    expect(rank(items)[0].provider).toBe('factcheck');
  });

  it('places a closer match above a looser one from the same provider', () => {
    const items = [
      evidence({ url: 'https://a.com', similarity: 0.2 }),
      evidence({ url: 'https://b.com', similarity: 0.9 }),
    ];
    expect(rank(items)[0].url).toBe('https://b.com');
  });

  it('does not mutate the input array', () => {
    const items = [evidence({ url: 'https://a.com', similarity: 0.2 }), evidence({ url: 'https://b.com', similarity: 0.9 })];
    const snapshot = [...items];
    rank(items);
    expect(items).toEqual(snapshot);
  });
});
