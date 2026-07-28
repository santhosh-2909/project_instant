/**
 * POST /api/news/verify — verify a stored NewsArticle and persist the outcome.
 *
 * Runs the same real pipeline as /api/news/check (retrieve → constrained
 * reasoning → fuse) and writes the result across VerificationStatus,
 * VerificationHistory, EvidenceRepository and EvidenceHistory.
 *
 * Audit fixes: D-1 (the fabricated-evidence generator is gone — every stored
 * EvidenceRepository row now has a real URL and publisher), D-6 (threshold
 * lookup by confidence level; article never stranded in 'Verifying'),
 * P1-1 (Uncertain is a real outcome), S-4 (rate limited).
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { decide } from '@/lib/decisionEngine';
import { assess } from '@/lib/llm';
import { retrieveEvidence } from '@/lib/retrieval';
import { providerStatus } from '@/lib/env';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/lib/rateLimit';

export async function POST(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = consume(clientKey(request, 'verify', authUser.userId), LIMITS.verify.limit, LIMITS.verify.windowMs);
  const headers = rateLimitHeaders(limit);

  if (!limit.ok) {
    return NextResponse.json(
      { error: `Verification limit reached. Try again in ${limit.retryAfter} seconds.` },
      { status: 429, headers }
    );
  }

  let articleId: string | undefined;

  try {
    const body = (await request.json().catch(() => ({}))) as { articleId?: unknown };
    articleId = typeof body.articleId === 'string' ? body.articleId : undefined;

    if (!articleId) {
      return NextResponse.json({ error: 'Article ID is required.' }, { status: 400, headers });
    }

    const article = await db.newsArticle.findUnique({
      where: { articleId },
      include: { category: true, source: true, country: true, language: true },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found.' }, { status: 404, headers });
    }

    const activeModel = await db.embeddingModel.findFirst({ where: { status: 'Active' } });
    const activeLLM = await db.lLMConfiguration.findFirst({ where: { status: 'Active' } });

    if (!activeModel || !activeLLM) {
      return NextResponse.json(
        { error: 'No active embedding model or LLM configuration. Run `npm run db:seed`.' },
        { status: 503, headers }
      );
    }

    await db.newsArticle.update({ where: { articleId }, data: { status: 'Verifying' } });

    // --- Real pipeline -----------------------------------------------------
    const claim = `${article.title}. ${article.description ?? ''} ${article.content}`.trim();
    const retrieval = await retrieveEvidence(claim);
    const llm = await assess(claim, retrieval.evidence);
    const decision = decide(article.title, article.content, retrieval, llm);

    // --- Threshold (looked up, never hardcoded) ----------------------------
    const confidenceLevel =
      decision.confidence >= 80 ? 'High' : decision.confidence >= 50 ? 'Medium' : 'Low';

    const threshold =
      (await db.similarityThreshold.findFirst({ where: { confidenceLevel } })) ??
      (await db.similarityThreshold.findFirst());

    if (!threshold) {
      await db.newsArticle.update({ where: { articleId }, data: { status: 'Retrieved' } });
      return NextResponse.json(
        { error: 'Similarity thresholds are not seeded. Run `npm run db:seed`.' },
        { status: 503, headers }
      );
    }

    // --- Persist ------------------------------------------------------------
    const verificationStatus = await db.verificationStatus.create({
      data: {
        verificationResult: decision.verdict,
        confidenceScore: decision.confidence,
        status: 'Completed',
        thresholdId: threshold.thresholdId,
      },
    });

    const verificationHistory = await db.verificationHistory.create({
      data: {
        userId: authUser.userId,
        articleId: article.articleId,
        verificationResult: decision.verdict,
        confidenceScore: decision.confidence,
        modelId: activeModel.modelId,
        llmId: activeLLM.llmId,
        verificationId: verificationStatus.verificationId,
      },
    });

    // Every row written here traces back to a real retrieved document.
    for (const item of decision.evidence) {
      const trustedSource = await db.trustedNewsSource.findFirst({
        where: { sourceName: { equals: item.publisher, mode: 'insensitive' } },
      });

      const createdEvidence = await db.evidenceRepository.create({
        data: {
          articleId: article.articleId,
          evidenceTitle: item.title,
          evidenceDescription: item.url,
          evidenceContent: item.snippet,
          sourceName: item.publisher,
          publicationDate: item.publishedAt ? new Date(item.publishedAt) : new Date(),
          evidenceType: item.stance,
          similarityScore: item.similarity,
          status: 'Verified',
          trustedSourceId: trustedSource ? trustedSource.sourceId : null,
          vectorId: null,
        },
      });

      await db.evidenceHistory.create({
        data: {
          articleId: article.articleId,
          retrievedEvidenceCount: 1,
          verificationStatus: 'Completed',
          evidenceId: createdEvidence.evidenceId,
        },
      });
    }

    await db.newsArticle.update({
      where: { articleId: article.articleId },
      data: { status: 'Verified' },
    });

    return NextResponse.json(
      {
        message: 'Verification completed.',
        verificationId: verificationStatus.verificationId,
        historyId: verificationHistory.historyId,
        verdict: decision.verdict,
        confidence: decision.confidence,
        summary: decision.summary,
        signals: decision.signals,
        evidence: decision.evidence,
        caveats: decision.caveats,
        layers: decision.layers,
        providers: { queried: retrieval.providersQueried, failed: retrieval.providersFailed, configured: providerStatus() },
      },
      { headers }
    );
  } catch (error) {
    console.error('[api/news/verify] failed:', error);

    // Never leave an article stranded in the transient 'Verifying' state.
    if (articleId) {
      await db.newsArticle
        .update({ where: { articleId }, data: { status: 'Retrieved' } })
        .catch(() => undefined);
    }

    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500, headers });
  }
}
