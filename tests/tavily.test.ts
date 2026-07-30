// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  blendRelevance,
  domainReliability,
  mapTavilyResults,
  publisherFromUrl,
  shouldEscalate,
  type TavilyResult,
} from '@/server/verification/providers/tavily';
import realResponse from './fixtures/tavily-response.json';
import type { ProviderId, RetrievedEvidence } from '@/shared/types';

function evidence(overrides: Partial<RetrievedEvidence> = {}): RetrievedEvidence {
  return {
    title: 'Headline',
    publisher: 'Reuters',
    author: null,
    url: 'https://example.com/a',
    publishedAt: null,
    snippet: 'Snippet',
    stance: 'Neutral',
    similarity: 0.5,
    reliability: 0.9,
    provider: 'googlenews' as ProviderId,
    ...overrides,
  };
}

describe('TC-TAV-01 publisherFromUrl()', () => {
  it('derives a readable name from a hostname', () => {
    expect(publisherFromUrl('https://www.thehindu.com/news/x')).toBe('Thehindu');
    expect(publisherFromUrl('https://reuters.com/article/y')).toBe('Reuters');
  });

  it('handles multi-part public suffixes', () => {
    // pib.gov.in must not resolve to "Gov".
    expect(publisherFromUrl('https://pib.gov.in/PressRelease')).toBe('Pib');
  });

  it('never throws on a malformed URL', () => {
    expect(publisherFromUrl('not a url')).toBe('Web');
    expect(publisherFromUrl('')).toBe('Web');
  });
});

describe('TC-TAV-02 domainReliability()', () => {
  it('rates government and international sources highest', () => {
    expect(domainReliability('https://pib.gov.in/x', 'Pib')).toBeGreaterThanOrEqual(0.9);
    expect(domainReliability('https://www.who.int/news', 'Who')).toBeGreaterThanOrEqual(0.9);
  });

  it('rates academic sources highly', () => {
    expect(domainReliability('https://cam.ac.uk/research', 'Cam')).toBeGreaterThanOrEqual(0.85);
    expect(domainReliability('https://mit.edu/paper', 'Mit')).toBeGreaterThanOrEqual(0.85);
  });

  it('defers to the shared publisher table for known news outlets', () => {
    expect(domainReliability('https://www.thehindu.com/x', 'The Hindu')).toBeGreaterThanOrEqual(0.9);
  });

  it('gives an unknown blog a middling score, not a trusted one', () => {
    const score = domainReliability('https://random-blog.xyz/post', 'Random-blog');
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.8);
  });

  it('never throws on a malformed URL', () => {
    expect(domainReliability('nonsense', 'Web')).toBe(0.4);
  });
});

describe('TC-TAV-03 shouldEscalate() — protects a 1,000/month quota', () => {
  it('escalates when nothing was found', () => {
    expect(shouldEscalate([])).toBe(true);
  });

  it('escalates when the evidence is weak or from unknown sources', () => {
    const weak = [
      evidence({ similarity: 0.15, reliability: 0.4 }),
      evidence({ similarity: 0.2, reliability: 0.45 }),
    ];
    expect(shouldEscalate(weak)).toBe(true);
  });

  it('does NOT escalate when three strong sources already agree', () => {
    const strong = Array.from({ length: 3 }, () => evidence({ similarity: 0.6, reliability: 0.9 }));
    // Spending a search here would cost quota without changing the verdict.
    expect(shouldEscalate(strong)).toBe(false);
  });

  it('does NOT escalate when a fact-checker already ruled on the claim', () => {
    const ruled = [
      evidence({ provider: 'factcheck', stance: 'Contradicting', similarity: 0.6, reliability: 0.9 }),
    ];
    expect(shouldEscalate(ruled)).toBe(false);
  });

  it('does NOT escalate when an authoritative record settles it', () => {
    // The Wikidata incumbency check pins similarity at 0.95 with a real stance.
    const authoritative = [
      evidence({ provider: 'wikidata', stance: 'Contradicting', similarity: 0.95, reliability: 0.9 }),
    ];
    expect(shouldEscalate(authoritative)).toBe(false);
  });

  it('still escalates past a fact-check that barely matches the claim', () => {
    const loose = [
      evidence({ provider: 'factcheck', stance: 'Contradicting', similarity: 0.2, reliability: 0.9 }),
    ];
    expect(shouldEscalate(loose)).toBe(true);
  });

  it('still escalates when only one or two strong sources exist', () => {
    const two = Array.from({ length: 2 }, () => evidence({ similarity: 0.6, reliability: 0.9 }));
    expect(shouldEscalate(two)).toBe(true);
  });
});


describe('TC-TAV-04 mapping a REAL Tavily response', () => {
  // Captured verbatim from the live API, so this pins the mapper to the shape
  // Tavily actually returns rather than the one it was assumed to return.
  const results = realResponse.results as TavilyResult[];
  const claim = 'Which API detects real or fake news spreading?';
  const mapped = mapTavilyResults(claim, results);

  it('maps every result without dropping any', () => {
    expect(mapped).toHaveLength(5);
  });

  it('carries the real URL through untouched', () => {
    expect(mapped[0].url).toBe('https://newsapi.ai/data-mining');
    expect(mapped.every((m) => m.url.startsWith('http'))).toBe(true);
  });

  it('derives a publisher, because Tavily does not supply one', () => {
    expect(mapped[0].publisher).toBe('Newsapi');
    expect(mapped[3].publisher).toBe('Link'); // link.springer.com
    expect(mapped.every((m) => m.publisher.length > 0)).toBe(true);
  });

  it('DOCUMENTED GAP: publishedAt is null — the API returns no date', () => {
    // Every result in the live payload lacks published_date. The UI shows
    // "Date not reported" for these rather than inventing one.
    expect(mapped.every((m) => m.publishedAt === null)).toBe(true);
  });

  it('recognises the academic domain in the result set', () => {
    const springer = mapped.find((m) => m.url.includes('springer'));
    expect(springer!.reliability).toBeGreaterThanOrEqual(0.45);
  });

  it('produces similarity scores inside 0..1 for all of them', () => {
    for (const item of mapped) {
      expect(item.similarity).toBeGreaterThanOrEqual(0);
      expect(item.similarity).toBeLessThanOrEqual(1);
    }
  });

  it('leaves stance Neutral — a web page asserts nothing on its own', () => {
    expect(mapped.every((m) => m.stance === 'Neutral')).toBe(true);
  });

  it('keeps the top-ranked result above the relevance floor', () => {
    // MIN_SIMILARITY in retrieval.ts is 0.1. Tavily's own scores in this
    // response run 0.19-0.41, so a naive pass-through would sink most of them.
    expect(mapped[0].similarity).toBeGreaterThan(0.1);
  });
});

describe('TC-TAV-05 blendRelevance() calibration', () => {
  const snippet = 'some page text';

  it('stretches Tavily’s compressed band rather than damping it', () => {
    // Live scores ranged 0.19-0.41. Multiplying those down would push nearly
    // every web result under the 0.3 "close match" threshold, making the
    // provider contribute almost nothing.
    const top = blendRelevance('unrelated claim text', { title: 'x', score: 0.41 }, snippet);
    expect(top).toBeGreaterThan(0.41);
  });

  it('floors a very low score at zero rather than going negative', () => {
    expect(blendRelevance('unrelated', { title: 'x', score: 0.05 }, snippet)).toBeGreaterThanOrEqual(0);
  });

  it('caps a very high score at one', () => {
    expect(blendRelevance('unrelated', { title: 'x', score: 0.99 }, snippet)).toBeLessThanOrEqual(1);
  });

  it('falls back to measured similarity when the score is missing', () => {
    const claim = 'government announces free electricity';
    const withScore = blendRelevance(claim, { title: claim, score: undefined }, claim);
    expect(withScore).toBeGreaterThan(0.5); // text matches the claim exactly
  });

  it('prefers our measurement when it beats the provider ranking', () => {
    const claim = 'government announces free electricity for households';
    const blended = blendRelevance(claim, { title: claim, score: 0.2 }, claim);
    expect(blended).toBeGreaterThan(0.5);
  });
});
