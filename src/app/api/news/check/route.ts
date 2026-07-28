/**
 * POST /api/news/check — verify a free-text claim.
 *
 * Pipeline: retrieve real evidence → constrained LLM reasoning → Decision
 * Engine fusion → Real / Fake / Uncertain with an explainable breakdown.
 *
 * Audit fixes applied here: D-1 (no fabricated evidence), P1-1 (Uncertain
 * verdict), S-4/S-6 (rate limiting on a paid, formerly open endpoint),
 * TC-API-18 (claim length cap from PRD §10).
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { decide } from '@/lib/decisionEngine';
import { assess } from '@/lib/llm';
import { retrieveEvidence } from '@/lib/retrieval';
import { providerStatus } from '@/lib/env';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/lib/rateLimit';

/** PRD §10: claim text non-empty, max length 10,000 characters. */
const MAX_CLAIM_LENGTH = 10_000;

/**
 * Hard end-to-end budget.
 *
 * The PRD targets p95 < 5s. In practice the authoritative incumbency lookup
 * needs three sequential Wikimedia round-trips on a cold cache, and cutting it
 * short is not a neutral act — it turns a decisive answer into "Uncertain".
 * Correctness wins, so the ceiling is 8s; warm-cache responses land well under
 * a second (see the cache in lib/providers/wikimediaClient.ts).
 */
const PIPELINE_BUDGET_MS = 8_000;

/**
 * Vercel serverless configuration.
 *
 * The pipeline can take up to 8s on a cold cache, which exceeds the 10s default
 * only narrowly — 30s gives headroom for a slow upstream without ever letting a
 * request hang indefinitely.
 */
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startedAt = Date.now();

  // --- Throttle before doing any paid work ---------------------------------
  const auth = await getAuthUser();
  const limit = consume(clientKey(request, 'check', auth?.userId), LIMITS.check.limit, LIMITS.check.windowMs);

  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Verification limit reached. Try again in ${limit.retryAfter} seconds.`,
        retryAfter: limit.retryAfter,
      },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      content?: unknown;
      url?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const sourceUrl = typeof body.url === 'string' ? body.url.trim() : '';

    if (!title && !content) {
      return NextResponse.json(
        { error: 'Provide a headline or article text to verify.' },
        { status: 400, headers: rateLimitHeaders(limit) }
      );
    }

    const combinedLength = title.length + content.length;
    if (combinedLength > MAX_CLAIM_LENGTH) {
      return NextResponse.json(
        {
          error: `Claim is too long (${combinedLength.toLocaleString()} characters). The maximum is ${MAX_CLAIM_LENGTH.toLocaleString()}.`,
        },
        { status: 400, headers: rateLimitHeaders(limit) }
      );
    }

    const claim = [title, content].filter(Boolean).join('. ');

    // --- Layer 2: real retrieval -------------------------------------------
    const configured = providerStatus();
    const retrieval = await withBudget(retrieveEvidence(claim), PIPELINE_BUDGET_MS * 0.8, {
      evidence: [],
      providersQueried: [],
      providersFailed: ['timeout'],
      offline: true,
    });

    // --- Layer 3: constrained reasoning ------------------------------------
    const remaining = PIPELINE_BUDGET_MS - (Date.now() - startedAt);
    const llm =
      remaining > 800 ? await withBudget(assess(claim, retrieval.evidence, remaining), remaining, null) : null;

    // --- Fusion -------------------------------------------------------------
    const decision = decide(title || content.slice(0, 120), content || title, retrieval, llm);

    return NextResponse.json(
      {
        claim: { title: title || 'Untitled claim', url: sourceUrl || null, characters: combinedLength },
        verdict: decision.verdict,
        confidence: decision.confidence,
        summary: decision.summary,
        signals: decision.signals,
        evidence: decision.evidence,
        caveats: decision.caveats,
        layers: decision.layers,
        providers: {
          queried: retrieval.providersQueried,
          failed: retrieval.providersFailed,
          configured,
        },
        analyzedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
      },
      { headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    console.error('[api/news/check] failed:', error);
    return NextResponse.json(
      { error: 'Verification could not be completed. Please try again.' },
      { status: 500, headers: rateLimitHeaders(limit) }
    );
  }
}

/**
 * PRD §10 error handling: if a layer exceeds its budget, fall back rather than
 * blowing the latency SLA.
 */
async function withBudget<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), Math.max(0, ms));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
