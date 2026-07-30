import { NextResponse } from 'next/server';
import { getAuthUser } from '@/server/auth/session';
import { db } from '@/server/data/db';
import { describeError } from '@/server/data/errors';

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let feedbacks;

    if (authUser.role === 'Admin') {
      // Admins see all feedback with relations
      feedbacks = await db.feedback.findMany({
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
          article: {
            select: { title: true },
          },
          feedbackType: true,
          resolutions: {
            include: {
              reviewer: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { submissionDate: 'desc' },
      });
    } else {
      // Regular users only see their own feedback
      feedbacks = await db.feedback.findMany({
        where: { userId: authUser.userId },
        include: {
          article: { select: { title: true } },
          feedbackType: true,
          resolutions: true,
        },
        orderBy: { submissionDate: 'desc' },
      });
    }

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    const friendly = describeError(error, 'Failed to retrieve feedback history.');
    return NextResponse.json(
      { error: friendly.message },
      { status: friendly.status }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { articleId, verificationId, rating, feedbackDescription, feedbackTypeName } = body;

    // Field validations
    if (!articleId || !verificationId || !rating || !feedbackDescription || !feedbackTypeName) {
      return NextResponse.json({ error: 'Mandatory fields are missing.' }, { status: 400 });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
    }

    if (feedbackDescription.trim() === '') {
      return NextResponse.json({ error: 'Feedback description cannot be empty.' }, { status: 400 });
    }

    // Check if feedback already submitted for this verification history
    const existingFeedback = await db.feedback.findFirst({
      where: {
        userId: authUser.userId,
        verificationId,
      },
    });

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback already submitted for this article verification.' },
        { status: 400 }
      );
    }

    // Resolve feedback type ID
    const fType = await db.feedbackType.findUnique({
      where: { feedbackTypeName },
    });

    if (!fType) {
      return NextResponse.json({ error: 'Invalid feedback type selected.' }, { status: 400 });
    }

    // Create Feedback
    const newFeedback = await db.feedback.create({
      data: {
        userId: authUser.userId,
        articleId,
        verificationId,
        rating: numericRating,
        feedbackDescription: feedbackDescription.trim(),
        feedbackTypeId: fType.feedbackTypeId,
        status: 'Pending',
      },
    });

    return NextResponse.json({
      message: 'Feedback submitted successfully.',
      feedback: newFeedback,
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    const friendly = describeError(error, 'Unable to save feedback.');
    return NextResponse.json(
      { error: friendly.message },
      { status: friendly.status }
    );
  }
}

// PUT is used by Admins to review/resolve feedback
export async function PUT(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'Admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privilege required.' }, { status: 403 });
    }

    const body = await request.json();
    const { feedbackId, resolutionDescription, resolutionStatus } = body; // resolutionStatus: Reviewed or Resolved

    if (!feedbackId || !resolutionDescription || !resolutionStatus) {
      return NextResponse.json({ error: 'Mandatory fields are missing.' }, { status: 400 });
    }

    const feedback = await db.feedback.findUnique({
      where: { feedbackId },
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback record not found.' }, { status: 404 });
    }

    // Update feedback status
    const updatedFeedback = await db.feedback.update({
      where: { feedbackId },
      data: {
        status: resolutionStatus === 'Resolved' ? 'Resolved' : 'Reviewed',
      },
    });

    // Create a resolution entry
    const resolution = await db.resolution.create({
      data: {
        feedbackId,
        resolutionDescription,
        reviewedBy: authUser.userId,
        resolutionStatus: resolutionStatus === 'Resolved' ? 'Applied' : 'Pending',
      },
    });

    return NextResponse.json({
      message: 'Resolution status updated successfully.',
      feedback: updatedFeedback,
      resolution,
    });
  } catch (error) {
    console.error('Error updating resolution:', error);
    const friendly = describeError(error, 'Resolution update failed.');
    return NextResponse.json(
      { error: friendly.message },
      { status: friendly.status }
    );
  }
}
