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
import { getAuthUser } from '@/server/auth/session';
import { decide } from '@/server/verification/decisionEngine';
import { assess } from '@/server/verification/llm';
import { generateNarrative } from '@/server/verification/reportNarrative';
import { retrieveEvidence } from '@/server/verification/retrieval';
import { providerStatus } from '@/server/config/env';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/server/http/rateLimit';

/** PRD §10: claim text non-empty, max length 10,000 characters. */
const MAX_CLAIM_LENGTH = 10_000;

/**
 * Hard end-to-end budget.
 *
 * The PRD targets p95 < 5s. Two things push past it, and cutting either short
 * costs real quality rather than just latency:
 *
 *   • the authoritative incumbency lookup needs three sequential Wikimedia
 *     round-trips on a cold cache, and truncating it turns a decisive answer
 *     into "Uncertain";
 *   • reasoning models (gpt-oss, qwen3) think before answering, so a verdict
 *     call and a narrative call run several seconds each.
 *
 * The ceiling is therefore 20s, comfortably inside the 30s maxDuration. Warm
 * caches and non-reasoning models land far below it — the Wikimedia cache alone
 * takes repeat lookups under a second.
 */
const PIPELINE_BUDGET_MS = 20_000;

/** Reasoning models need seconds, not milliseconds, to produce a paragraph. */
const NARRATIVE_BUDGET_MS = 10_000;

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
    const retrieval = await withBudget(retrieveEvidence(claim), Math.min(6_000, PIPELINE_BUDGET_MS * 0.4), {
      evidence: [],
      providersQueried: [],
      providersFailed: ['timeout'],
      offline: true,
    });

    // --- Layer 3: constrained reasoning ------------------------------------
    const remaining = PIPELINE_BUDGET_MS - (Date.now() - startedAt);
    const llm =
      remaining > 2000
        ? await withBudget(assess(claim, retrieval.evidence, Math.min(8_000, remaining)), remaining, null)
        : null;

    // --- Fusion -------------------------------------------------------------
    const decision = decide(title || content.slice(0, 120), content || title, retrieval, llm);

    /*
     * Report narrative. Written AFTER the verdict is fixed, and given the
     * verdict as an instruction rather than a question — the model explains the
     * decision, it does not participate in making it. Null whenever Groq is
     * unconfigured or the output fails a guard; the deterministic summary from
     * the Decision Engine is always present as the fallback.
     */
    const budgetLeft = PIPELINE_BUDGET_MS - (Date.now() - startedAt);
    const narrative =
      budgetLeft > 2000
        ? await generateNarrative(
            claim,
            decision.verdict,
            decision.confidence,
            decision.signals,
            decision.evidence,
            Math.min(NARRATIVE_BUDGET_MS, budgetLeft)
          )
        : null;

    return NextResponse.json(
      {
        claim: { title: title || 'Untitled claim', url: sourceUrl || null, characters: combinedLength },
        verdict: decision.verdict,
        confidence: decision.confidence,
        summary: decision.summary,
        narrative: narrative?.summary ?? null,
        narrativeModel: narrative?.model ?? null,
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
