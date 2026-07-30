/**
 * GET /api/history — the signed-in user's verification history.
 *
 * Implements PRD §14.1 `viewVerificationHistory()` / §14.3 `maintainHistory()`,
 * which had no endpoint before. Paginated and scoped to the caller; admins may
 * opt into the full log with `?scope=all`.
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/server/auth/session';
import { db } from '@/server/data/db';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/server/http/rateLimit';
import { describeError } from '@/server/data/errors';

export async function GET(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = consume(clientKey(request, 'history', authUser.userId), LIMITS.read.limit, LIMITS.read.windowMs);
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  try {
    const { searchParams } = new URL(request.url);
    const take = Math.min(Math.max(Number(searchParams.get('limit')) || 25, 1), 100);
    const skip = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const verdict = searchParams.get('verdict');
    const scope = searchParams.get('scope');

    const where: Record<string, unknown> = {};

    // Only an admin may widen the scope beyond their own records.
    if (!(scope === 'all' && authUser.role === 'Admin')) {
      where.userId = authUser.userId;
    }

    if (verdict && verdict !== 'All') {
      where.verificationResult = verdict;
    }

    const [records, totalCount] = await Promise.all([
      db.verificationHistory.findMany({
        where,
        include: {
          article: { select: { title: true, newsURL: true, category: { select: { categoryName: true } } } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { verificationTime: 'desc' },
        take,
        skip,
      }),
      db.verificationHistory.count({ where }),
    ]);

    return NextResponse.json(
      {
        records: records.map((record) => ({
          historyId: record.historyId,
          title: record.article.title,
          url: record.article.newsURL,
          category: record.article.category.categoryName,
          verdict: record.verificationResult,
          confidence: record.confidenceScore,
          verifiedAt: record.verificationTime,
          verifiedBy: `${record.user.firstName} ${record.user.lastName}`,
        })),
        totalCount,
        offset: skip,
        limit: take,
      },
      { headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    console.error('[api/history] failed:', error);
    const friendly = describeError(error, 'Could not load verification history.');
    return NextResponse.json(
      { error: friendly.message },
      { status: friendly.status }
    );
  }
}
