/**
 * GET /api/analytics — aggregate figures for the dashboard.
 *
 * Scoped to the caller unless they are an Admin, so a regular user sees their
 * own activity rather than everyone's. All figures are computed from the
 * database; nothing is fabricated for display.
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/server/auth/session';
import { db } from '@/server/data/db';
import { providerStatus } from '@/server/config/env';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/server/http/rateLimit';
import { describeError } from '@/server/data/errors';

export async function GET(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = consume(clientKey(request, 'analytics', authUser.userId), LIMITS.read.limit, LIMITS.read.windowMs);
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  try {
    const isAdmin = authUser.role === 'Admin';
    const scope = isAdmin ? {} : { userId: authUser.userId };

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [records, totalCount] = await Promise.all([
      db.verificationHistory.findMany({
        where: { ...scope, verificationTime: { gte: since } },
        include: { article: { select: { category: { select: { categoryName: true } }, source: { select: { sourceName: true } } } } },
        orderBy: { verificationTime: 'desc' },
        take: 500,
      }),
      db.verificationHistory.count({ where: scope }),
    ]);

    const byVerdict = { Real: 0, Fake: 0, Uncertain: 0 } as Record<string, number>;
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    for (const record of records) {
      byVerdict[record.verificationResult] = (byVerdict[record.verificationResult] ?? 0) + 1;

      const category = record.article.category.categoryName;
      byCategory[category] = (byCategory[category] ?? 0) + 1;

      const source = record.article.source.sourceName;
      bySource[source] = (bySource[source] ?? 0) + 1;

      const day = record.verificationTime.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const avgConfidence =
      records.length > 0
        ? Number((records.reduce((sum, r) => sum + r.confidenceScore, 0) / records.length).toFixed(1))
        : 0;

    // A 30-day dense series so the chart has no gaps.
    const trend: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      trend.push({ date: key, count: byDay[key] ?? 0 });
    }

    return NextResponse.json(
      {
        scope: isAdmin ? 'all' : 'self',
        totals: {
          allTime: totalCount,
          last30Days: records.length,
          avgConfidence,
        },
        byVerdict,
        byCategory,
        bySource,
        trend,
        providers: providerStatus(),
      },
      { headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    console.error('[api/analytics] failed:', error);
    const friendly = describeError(error, 'Could not load analytics.');
    return NextResponse.json(
      { error: friendly.message },
      { status: friendly.status }
    );
  }
}
