import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');

    if (!articleId) {
      return NextResponse.json({ error: 'Article ID is required.' }, { status: 400 });
    }

    const evidence = await db.evidenceRepository.findMany({
      where: { articleId },
      include: {
        trustedSource: true,
        vectorDatabase: true,
      },
      orderBy: { similarityScore: 'desc' },
    });

    const supporting = evidence.filter((item) => item.evidenceType === 'Supporting');
    const contradicting = evidence.filter((item) => item.evidenceType === 'Contradicting');

    return NextResponse.json({
      articleId,
      totalCount: evidence.length,
      supporting,
      contradicting,
    });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    return NextResponse.json({ error: 'Failed to retrieve evidence.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privilege required.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      articleId,
      evidenceTitle,
      evidenceContent,
      sourceName,
      evidenceType,
      similarityScore,
    } = body;

    if (!articleId || !evidenceTitle || !evidenceContent || !sourceName || !evidenceType) {
      return NextResponse.json({ error: 'Mandatory fields are missing.' }, { status: 400 });
    }

    // Find trusted source if exists
    const trustedSrc = await db.trustedNewsSource.findFirst({
      where: { sourceName: { contains: sourceName, mode: 'insensitive' } },
    });

    const vecDb = await db.vectorDatabase.findFirst();

    const newEvidence = await db.evidenceRepository.create({
      data: {
        articleId,
        evidenceTitle,
        evidenceContent,
        sourceName,
        publicationDate: new Date(),
        evidenceType, // Supporting or Contradicting
        similarityScore: Number(similarityScore) || 0.5,
        status: 'Verified',
        trustedSourceId: trustedSrc ? trustedSrc.sourceId : null,
        vectorId: vecDb ? vecDb.vectorId : null,
      },
    });

    // Update evidence history count
    await db.evidenceHistory.create({
      data: {
        articleId,
        retrievedEvidenceCount: 1,
        verificationStatus: 'Completed',
        evidenceId: newEvidence.evidenceId,
      },
    });

    return NextResponse.json({
      message: 'Evidence repository updated successfully.',
      evidence: newEvidence,
    });
  } catch (error) {
    console.error('Error creating evidence:', error);
    return NextResponse.json({ error: 'Unable to update the evidence repository.' }, { status: 500 });
  }
}
