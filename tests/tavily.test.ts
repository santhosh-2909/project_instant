// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { domainReliability, publisherFromUrl, shouldEscalate } from '@/server/verification/providers/tavily';
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
