import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await db.user.findUnique({
      where: { userId: authUser.userId },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        mobileNumber: true,
        countryId: true,
        stateId: true,
        cityId: true,
        securityQuestionId: true,
        createdAt: true,
        role: {
          select: { roleName: true },
        },
        status: {
          select: { statusName: true },
        },
      },
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User does not exist.' }, { status: 404 });
    }

    return NextResponse.json(userProfile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, mobileNumber, countryId, stateId, cityId } = body;

    // Required fields check
    if (!firstName || !lastName || !mobileNumber || !countryId || !stateId || !cityId) {
      return NextResponse.json(
        { error: 'Required fields cannot be empty.' },
        { status: 400 }
      );
    }

    if (mobileNumber.length !== 10) {
      return NextResponse.json(
        { error: 'Mobile number must contain exactly 10 digits.' },
        { status: 400 }
      );
    }

    const updatedUser = await db.user.update({
      where: { userId: authUser.userId },
      data: {
        firstName,
        lastName,
        mobileNumber,
        countryId: Number(countryId),
        stateId: Number(stateId),
        cityId: Number(cityId),
      },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        mobileNumber: true,
        countryId: true,
        stateId: true,
        cityId: true,
        role: { select: { roleName: true } },
      },
    });

    return NextResponse.json({
      message: 'Profile updated successfully.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 });
  }
}
