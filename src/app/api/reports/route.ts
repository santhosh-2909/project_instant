import { NextResponse } from 'next/server';
import { getAuthUser } from '@/server/auth/session';
import { db } from '@/server/data/db';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privilege required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const typeId = searchParams.get('reportTypeId'); // ID of seeded report types
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const newsCategory = searchParams.get('newsCategory') || 'All';
    const newsSource = searchParams.get('newsSource') || 'All';
    const verificationStatus = searchParams.get('verificationStatus') || 'All';

    if (!typeId) {
      // If no reportTypeId is specified, return the history of generated reports
      const reportHistory = await db.report.findMany({
        include: {
          reportType: true,
          generator: { select: { firstName: true, lastName: true, email: true } },
          filter: true,
        },
        orderBy: { generatedDate: 'desc' },
      });

      const reportTypes = await db.reportType.findMany();

      return NextResponse.json({ reportHistory, reportTypes });
    }

    const numericTypeId = Number(typeId);
    const reportType = await db.reportType.findUnique({
      where: { reportTypeId: numericTypeId },
    });

    if (!reportType) {
      return NextResponse.json({ error: 'Invalid report type selected.' }, { status: 400 });
    }

    // Parse Dates
    const start = startDateStr ? new Date(startDateStr) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDateStr ? new Date(endDateStr) : new Date();

    if (end < start) {
      return NextResponse.json({ error: 'End date cannot be earlier than start date.' }, { status: 400 });
    }

    // Build database filters
    const whereClause: any = {
      verificationTime: {
        gte: start,
        lte: end,
      },
    };

    if (newsCategory !== 'All') {
      whereClause.article = whereClause.article || {};
      whereClause.article.category = { categoryName: newsCategory };
    }

    if (newsSource !== 'All') {
      whereClause.article = whereClause.article || {};
      whereClause.article.source = { sourceName: newsSource };
    }

    if (verificationStatus !== 'All') {
      whereClause.verificationResult = verificationStatus; // Likely Real, Likely Fake, etc.
    }

    // Log the generated report in history
    const filter = await db.reportFilter.create({
      data: {
        startDate: start,
        endDate: end,
        newsCategory: newsCategory === 'All' ? null : newsCategory,
        newsSource: newsSource === 'All' ? null : newsSource,
        verificationStatus: verificationStatus === 'All' ? null : verificationStatus,
      },
    });

    await db.report.create({
      data: {
        reportName: `${reportType.reportName} (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`,
        reportTypeId: numericTypeId,
        generatedBy: authUser.userId,
        reportFormat: 'PDF', // default format, UI allows switching
        reportStatus: 'Completed',
        filterId: filter.filterId,
      },
    });

    // ----------------------------------------------------
    // COMPUTE STATISTICS BASED ON REPORT TYPE
    // ----------------------------------------------------
    const reportData: any = {};

    // 1. Fetch Verification History records matching criteria
    const histories = await db.verificationHistory.findMany({
      where: whereClause,
      include: {
        article: {
          include: { category: true, source: true },
        },
      },
    });

    const totalVerified = histories.length;
    const realCount = histories.filter((h) => h.verificationResult === 'Likely Real').length;
    const fakeCount = histories.filter((h) => h.verificationResult === 'Likely Fake').length;
    const manualCount = histories.filter((h) => h.verificationResult === 'Needs Manual Verification').length;

    const avgConfidence =
      totalVerified > 0
        ? Number((histories.reduce((acc, h) => acc + h.confidenceScore, 0) / totalVerified).toFixed(2))
        : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    const sourceBreakdown: Record<string, number> = {};

    histories.forEach((h) => {
      const cat = h.article.category.categoryName;
      const src = h.article.source.sourceName;
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
    });

    // General Summary statistics (always returned)
    reportData.summary = {
      totalVerified,
      realCount,
      fakeCount,
      manualCount,
      avgConfidence,
      categoryBreakdown,
      sourceBreakdown,
    };

    // 2. Fetch User registrations
    const totalUsers = await db.user.count();
    const activeUsers = await db.user.count({
      where: { status: { statusName: 'Active' } },
    });
    const lockedUsers = await db.user.count({
      where: { status: { statusName: 'Locked' } },
    });

    reportData.userStats = {
      totalUsers,
      activeUsers,
      lockedUsers,
    };

    // 3. Feedback statistics
    const feedbacks = await db.feedback.findMany({
      include: { feedbackType: true },
    });
    const feedbackCount = feedbacks.length;
    const resolvedFeedback = feedbacks.filter((f) => f.status === 'Resolved').length;
    const pendingFeedback = feedbacks.filter((f) => f.status === 'Pending').length;

    reportData.feedbackStats = {
      totalFeedback: feedbackCount,
      resolvedFeedback,
      pendingFeedback,
    };

    // Return combined dataset
    return NextResponse.json({
      success: true,
      reportName: reportType.reportName,
      generatedDate: new Date(),
      filter: {
        startDate: start,
        endDate: end,
        category: newsCategory,
        source: newsSource,
        status: verificationStatus,
      },
      data: reportData,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Report generation failed.' }, { status: 500 });
  }
}
