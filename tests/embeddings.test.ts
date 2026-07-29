// @vitest-environment node
//
// The sentence-transformer runs on a native ONNX runtime, which cannot load
// inside jsdom. This suite therefore runs in the Node environment — the same
// one the server uses in production.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearEmbeddingCache,
  combine,
  cosineSimilarity,
  embed,
  embeddingStatus,
  hybridSimilarity,
  rescaleCosine,
  scoreCandidates,
} from '@/lib/embeddings';
import { similarity as lexicalSimilarity } from '@/lib/textMatch';

/**
 * The model download is slow and network-dependent, so the deterministic maths
 * is tested directly and the real model is exercised in one clearly-marked
 * integration block. Set SKIP_MODEL_TESTS=1 to skip that block offline.
 */
const runModelTests = process.env.SKIP_MODEL_TESTS !== '1';

beforeEach(() => clearEmbeddingCache());

describe('TC-EMB-01 cosineSimilarity()', () => {
  it('returns 1 for identical normalised vectors', () => {
    const v = [0.6, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('returns -1 for opposed vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it('returns 0 rather than NaN for empty or mismatched vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe('TC-EMB-02 rescaleCosine() calibration', () => {
  it('maps the unrelated-sentence floor to 0', () => {
    // Measured: unrelated sentences score ~0.35-0.46 with this model family,
    // never near 0. Without rescaling everything would look related.
    expect(rescaleCosine(0.35)).toBe(0);
    expect(rescaleCosine(0.2)).toBe(0);
  });

  it('maps a strong paraphrase to 1', () => {
    expect(rescaleCosine(0.9)).toBe(1);
    expect(rescaleCosine(0.99)).toBe(1);
  });

  it('places a mid-strength match in the middle of the range', () => {
    const score = rescaleCosine(0.625);
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.6);
  });

  it('never leaves the 0..1 range, even for absurd input', () => {
    for (const value of [-5, -1, 0, 0.5, 1, 5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const score = rescaleCosine(value);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('TC-EMB-03 combine()', () => {
  it('falls back to the lexical score when the model is unavailable', () => {
    const result = combine(0.42, null);
    expect(result.score).toBe(0.42);
    expect(result.usedEmbeddings).toBe(false);
  });

  it('takes the higher of the two signals', () => {
    expect(combine(0.2, 0.85).score).toBe(0.85);
    expect(combine(0.85, 0.2).score).toBe(0.85);
  });

  it('never lets a weak semantic score drag down a strong lexical match', () => {
    // The two methods fail in opposite directions, so neither may veto the
    // other — semantic matching is fuzzy about named entities, and a claim
    // that shares exact wording is genuinely relevant.
    const result = combine(0.95, 0.1);
    expect(result.score).toBe(0.95);
  });

  it('reports both components for explainability', () => {
    const result = combine(0.3, 0.7);
    expect(result.lexical).toBe(0.3);
    expect(result.semantic).toBe(0.7);
    expect(result.usedEmbeddings).toBe(true);
  });
});

describe('TC-EMB-04 embeddingStatus()', () => {
  it('reports the configured model and cache size', () => {
    const status = embeddingStatus();
    expect(status.model).toContain('MiniLM');
    expect(typeof status.enabled).toBe('boolean');
    expect(status.cachedVectors).toBe(0);
  });
});

describe.runIf(runModelTests)('TC-EMB-05 Sentence Transformers, real model', () => {
  it(
    'embeds text into a fixed-width normalised vector',
    async () => {
      const vector = await embed('Tamil Nadu chief minister');
      expect(vector).not.toBeNull();
      expect(vector!.length).toBe(384); // all-MiniLM-L6-v2

      // Sentence Transformers L2-normalises, so the magnitude must be 1.
      const magnitude = Math.sqrt(vector!.reduce((sum, v) => sum + v * v, 0));
      expect(magnitude).toBeCloseTo(1, 3);
    },
    180_000
  );

  it(
    'caches repeated text instead of re-embedding it',
    async () => {
      await embed('a repeated sentence');
      expect(embeddingStatus().cachedVectors).toBe(1);
      await embed('a repeated sentence');
      expect(embeddingStatus().cachedVectors).toBe(1);
    },
    180_000
  );

  it(
    'THE POINT: recognises a paraphrase that lexical matching misses',
    async () => {
      const claim = 'Vijay is the Chief Minister of Tamil Nadu';
      const paraphrase = 'The head of the Tamil Nadu government is Vijay';

      const lexical = lexicalSimilarity(claim, paraphrase);
      const hybrid = await hybridSimilarity(claim, paraphrase);

      expect(hybrid.usedEmbeddings).toBe(true);
      expect(hybrid.semantic!).toBeGreaterThan(0.6);
      // The whole reason this layer exists.
      expect(hybrid.score).toBeGreaterThan(lexical);
    },
    180_000
  );

  it(
    'scores unrelated text well below a paraphrase',
    async () => {
      const claim = 'Vijay is the Chief Minister of Tamil Nadu';
      const [related, unrelated] = await scoreCandidates(claim, [
        'Tamil Nadu CM Vijay writes to the Prime Minister',
        'A cricket team won their match in Melbourne yesterday',
      ]);
      expect(related.score).toBeGreaterThan(unrelated.score + 0.25);
    },
    180_000
  );

  it(
    'returns one score per candidate, in order',
    async () => {
      const scores = await scoreCandidates('a test claim', ['first', 'second', 'third']);
      expect(scores).toHaveLength(3);
      scores.forEach((s) => {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(1);
      });
    },
    180_000
  );

  it(
    'handles empty input without throwing',
    async () => {
      expect(await embed('')).toBeNull();
      expect(await scoreCandidates('claim', [])).toEqual([]);
    },
    180_000
  );
});
