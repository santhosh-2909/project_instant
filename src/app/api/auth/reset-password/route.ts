import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, securityAnswer, newPassword } = body;

    if (!email || !securityAnswer || !newPassword) {
      return NextResponse.json(
        { error: 'All fields (email, security answer, new password) are mandatory.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // Lookup user
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Email not found.' },
        { status: 404 }
      );
    }

    // Verify security answer (case-insensitive and trimmed)
    const normalizedDbAnswer = user.securityAnswer.trim().toLowerCase();
    const normalizedInputAnswer = securityAnswer.trim().toLowerCase();

    if (normalizedDbAnswer !== normalizedInputAnswer) {
      return NextResponse.json(
        { error: 'Security answer incorrect.' },
        { status: 401 }
      );
    }

    // Encrypt new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Get Active status in case they were locked
    const activeStatus = await db.accountStatus.findFirst({
      where: { statusName: 'Active' },
    });

    // Update password, reset attempts, set active
    await db.user.update({
      where: { userId: user.userId },
      data: {
        password: hashedNewPassword,
        failedAttempts: 0,
        statusId: activeStatus ? activeStatus.statusId : user.statusId,
      },
    });

    return NextResponse.json({
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Password reset failed.' },
      { status: 500 }
    );
  }
}
