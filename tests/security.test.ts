import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { consume, clientKey, rateLimitHeaders, resetRateLimits, LIMITS } from '@/server/http/rateLimit';
import { hashSecurityAnswer, normaliseSecurityAnswer, verifySecurityAnswer } from '@/server/auth/securityAnswer';
import { requireSecret, optionalKey } from '@/server/config/env';
import { mentionsUnretrievedSource, parseAssessment } from '@/server/verification/llm';
import type { RetrievedEvidence } from '@/server/verification/retrieval';

describe('TC-SEC-01 env fail-fast (fixes S-1)', () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('throws when the secret is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => requireSecret('JWT_SECRET')).toThrow(/not set/i);
  });

  it('throws when the secret is too short', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => requireSecret('JWT_SECRET')).toThrow(/at least 32 characters/i);
  });

  it('REGRESSION: rejects the old hardcoded fallback value', () => {
    process.env.JWT_SECRET = 'super-secret-key';
    expect(() => requireSecret('JWT_SECRET')).toThrow();
  });

  it('accepts a strong secret', () => {
    const strong = 'a'.repeat(48);
    process.env.JWT_SECRET = strong;
    expect(requireSecret('JWT_SECRET')).toBe(strong);
  });

  it('treats mock and placeholder API keys as absent', () => {
    process.env.TEST_KEY = 'mock_abc123';
    expect(optionalKey('TEST_KEY')).toBeNull();

    process.env.TEST_KEY = 'your_key_here';
    expect(optionalKey('TEST_KEY')).toBeNull();

    process.env.TEST_KEY = 'sk-real-value';
    expect(optionalKey('TEST_KEY')).toBe('sk-real-value');

    delete process.env.TEST_KEY;
    expect(optionalKey('TEST_KEY')).toBeNull();
  });
});

describe('TC-SEC-02 security answers (fixes S-2)', () => {
  it('normalises case and whitespace', () => {
    expect(normaliseSecurityAnswer('  My  First   Dog ')).toBe('my first dog');
  });

  it('stores answers hashed, never in readable form', async () => {
    const hash = await hashSecurityAnswer('Bruno');
    expect(hash).not.toContain('bruno');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifies a correct answer regardless of case or spacing', async () => {
    const hash = await hashSecurityAnswer('My First Dog');
    const result = await verifySecurityAnswer('  my first dog  ', hash);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it('rejects an incorrect answer', async () => {
    const hash = await hashSecurityAnswer('Bruno');
    expect((await verifySecurityAnswer('Rex', hash)).valid).toBe(false);
  });

  it('accepts a legacy plaintext answer and flags it for rehashing', async () => {
    const result = await verifySecurityAnswer('Bruno', 'bruno');
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(true);
  });

  it('rejects a wrong answer against a legacy plaintext record', async () => {
    const result = await verifySecurityAnswer('Rex', 'bruno');
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });
});

describe('TC-SEC-03 rate limiting (fixes S-4 / S-6)', () => {
  beforeEach(() => resetRateLimits());

  it('allows requests up to the limit, then blocks', () => {
    for (let i = 0; i < 3; i++) {
      expect(consume('k', 3, 60_000).ok).toBe(true);
    }
    const blocked = consume('k', 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('counts down the remaining allowance', () => {
    expect(consume('k', 3, 60_000).remaining).toBe(2);
    expect(consume('k', 3, 60_000).remaining).toBe(1);
    expect(consume('k', 3, 60_000).remaining).toBe(0);
  });

  it('resets once the window elapses', () => {
    const now = 1_000_000;
    consume('k', 1, 1000, now);
    expect(consume('k', 1, 1000, now + 500).ok).toBe(false);
    expect(consume('k', 1, 1000, now + 1500).ok).toBe(true);
  });

  it('keeps separate buckets per key', () => {
    consume('a', 1, 60_000);
    expect(consume('a', 1, 60_000).ok).toBe(false);
    expect(consume('b', 1, 60_000).ok).toBe(true);
  });

  it('keys by user when authenticated, by IP otherwise', () => {
    const request = new Request('https://x.test', { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } });
    expect(clientKey(request, 'login', 'user-1')).toBe('login:user:user-1');
    expect(clientKey(request, 'login')).toBe('login:ip:203.0.113.9');
  });

  it('still throttles requests with no identifiable client', () => {
    const request = new Request('https://x.test');
    expect(clientKey(request, 'login')).toBe('login:ip:unknown');
  });

  it('emits standard RateLimit headers, adding Retry-After only when blocked', () => {
    const allowed = consume('h', 2, 60_000);
    expect(rateLimitHeaders(allowed)).not.toHaveProperty('Retry-After');

    consume('h', 2, 60_000);
    const blocked = consume('h', 2, 60_000);
    expect(rateLimitHeaders(blocked)).toHaveProperty('Retry-After');
  });

  it('defines a limit for every sensitive endpoint', () => {
    for (const key of ['login', 'register', 'passwordReset', 'verify', 'check', 'read'] as const) {
      expect(LIMITS[key].limit).toBeGreaterThan(0);
      expect(LIMITS[key].windowMs).toBeGreaterThan(0);
    }
  });
});

describe('TC-SEC-04 LLM output is constrained (fixes D-1)', () => {
  const retrieved: RetrievedEvidence[] = [
    {
      title: 'Report',
      publisher: 'Alt News',
      author: null,
      url: 'https://altnews.in/x',
      publishedAt: null,
      snippet: 'snippet',
      stance: 'Contradicting',
      similarity: 0.7,
      reliability: 0.93,
      provider: 'factcheck',
    },
  ];

  it('parses a well-formed assessment', () => {
    const parsed = parseAssessment('{"score": -0.8, "reasoning": "The fact-check contradicts the claim."}');
    expect(parsed).toEqual({ score: -0.8, reasoning: 'The fact-check contradicts the claim.' });
  });

  it('parses a response wrapped in code fences', () => {
    const parsed = parseAssessment('```json\n{"score": 0.5, "reasoning": "Partly supported."}\n```');
    expect(parsed?.score).toBe(0.5);
  });

  it('clamps an out-of-range score', () => {
    expect(parseAssessment('{"score": 9, "reasoning": "x"}')?.score).toBe(1);
  });

  it('returns null for unparseable or incomplete output', () => {
    expect(parseAssessment('not json at all')).toBeNull();
    expect(parseAssessment('{"score": "abc", "reasoning": "x"}')).toBeNull();
    expect(parseAssessment('{"score": 1}')).toBeNull();
    expect(parseAssessment('')).toBeNull();
  });

  it('detects a model citing a source that was never retrieved', () => {
    expect(mentionsUnretrievedSource('Reuters and the BBC both confirmed this.', retrieved)).toBe(true);
  });

  it('permits references to sources that WERE retrieved', () => {
    expect(mentionsUnretrievedSource('Alt News rated this claim false.', retrieved)).toBe(false);
  });

  it('permits reasoning that names no outlet at all', () => {
    expect(mentionsUnretrievedSource('The evidence provided contradicts the claim.', retrieved)).toBe(false);
  });
});
