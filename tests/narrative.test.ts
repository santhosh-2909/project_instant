// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { contradictsVerdict, parseSummary } from '@/server/verification/reportNarrative';
import { configuredModels } from '@/server/verification/groqClient';
import type { RetrievedEvidence } from '@/shared/types';
import { mentionsUnretrievedSource } from '@/server/verification/llm';

function evidence(publisher: string): RetrievedEvidence {
  return {
    title: 'Headline',
    publisher,
    author: null,
    url: 'https://example.com/a',
    publishedAt: null,
    snippet: 'Snippet',
    stance: 'Neutral',
    similarity: 0.5,
    reliability: 0.9,
    provider: 'googlenews',
  };
}

describe('TC-NAR-01 parseSummary()', () => {
  it('extracts the summary from a clean JSON response', () => {
    const out = parseSummary('{"summary":"This claim is contradicted by two published fact-checks."}');
    expect(out).toBe('This claim is contradicted by two published fact-checks.');
  });

  it('tolerates markdown code fences', () => {
    const out = parseSummary('```json\n{"summary":"The evidence here is thin and inconclusive overall."}\n```');
    expect(out).toContain('thin and inconclusive');
  });

  it('tolerates prose wrapped around the JSON', () => {
    const out = parseSummary('Sure! Here you go: {"summary":"Several outlets corroborate this account fully."} Hope that helps.');
    expect(out).toBe('Several outlets corroborate this account fully.');
  });

  it('rejects malformed or empty responses', () => {
    for (const bad of ['', 'not json at all', '{}', '{"summary":""}', '{"summary":123}', '{"summary":"too short"}']) {
      expect(parseSummary(bad)).toBeNull();
    }
  });

  it('caps runaway output', () => {
    const long = parseSummary(JSON.stringify({ summary: 'x'.repeat(5000) }));
    expect(long!.length).toBeLessThanOrEqual(900);
  });
});

describe('TC-NAR-02 contradictsVerdict() — the report must not undermine itself', () => {
  it('catches a narrative calling a Fake verdict true', () => {
    expect(contradictsVerdict('In fact the claim is true and widely confirmed.', 'Fake')).toBe(true);
    expect(contradictsVerdict('The claim is verified by the sources.', 'Fake')).toBe(true);
  });

  it('catches a narrative calling a Real verdict false', () => {
    expect(contradictsVerdict('This claim is false and should not be shared.', 'Real')).toBe(true);
    expect(contradictsVerdict('No evidence supports this account.', 'Real')).toBe(true);
  });

  it('accepts a narrative that agrees with a Fake verdict', () => {
    expect(contradictsVerdict('Two fact-checkers rated this claim false, so it should not be shared.', 'Fake')).toBe(false);
  });

  it('accepts a narrative that agrees with a Real verdict', () => {
    expect(contradictsVerdict('Several reliable outlets report the same account, supporting the claim.', 'Real')).toBe(false);
  });

  it('never blocks an Uncertain narrative — both directions are legitimate there', () => {
    expect(contradictsVerdict('The claim may be true but the evidence is false in places.', 'Uncertain')).toBe(false);
  });
});

describe('TC-NAR-03 the narrative cannot cite unretrieved sources', () => {
  it('rejects an invented outlet', () => {
    // Reuses the reasoning layer's guard, so both AI surfaces share one rule.
    expect(mentionsUnretrievedSource('According to Reuters this is false.', [evidence('The Hindu')])).toBe(true);
  });

  it('accepts an outlet that was actually retrieved', () => {
    expect(mentionsUnretrievedSource('According to The Hindu this is false.', [evidence('The Hindu')])).toBe(false);
  });

  it('accepts a narrative naming no outlet at all', () => {
    expect(mentionsUnretrievedSource('The available sources do not settle this question.', [evidence('The Hindu')])).toBe(false);
  });
});

describe('TC-NAR-04 Groq model selection', () => {
  it('falls back through a chain when no model is pinned', () => {
    delete process.env.GROQ_MODEL;
    const models = configuredModels();
    expect(models.length).toBeGreaterThan(1);
    expect(models[0]).toContain('llama');
  });

  it('tries the pinned model first but keeps the chain behind it', () => {
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
    const models = configuredModels();

    expect(models[0]).toBe('llama-3.3-70b-versatile');
    // A pinned id is a preference, not an exclusive. It used to be exclusive,
    // and one typo in .env ("openai/gpt-oss-120" for "…-120b") silently
    // disabled the whole AI layer. A bad value must cost the preferred model,
    // not the feature.
    expect(models.length).toBeGreaterThan(1);

    delete process.env.GROQ_MODEL;
  });

  it('does not list the pinned model twice when it is already in the chain', () => {
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
    const models = configuredModels();
    expect(models.filter((m) => m === 'llama-3.1-8b-instant')).toHaveLength(1);
    expect(models[0]).toBe('llama-3.1-8b-instant');
    delete process.env.GROQ_MODEL;
  });

  it('includes the reasoning models that need extra token headroom', () => {
    delete process.env.GROQ_MODEL;
    expect(configuredModels().some((m) => /gpt-oss/.test(m))).toBe(true);
  });
});
