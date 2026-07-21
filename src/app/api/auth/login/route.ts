import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Find user with relations
    const user = await db.user.findUnique({
      where: { email },
      include: {
        role: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User does not exist.' },
        { status: 404 }
      );
    }

    // Check if locked
    if (user.status.statusName === 'Locked') {
      return NextResponse.json(
        { error: 'Account is Locked.' },
        { status: 403 }
      );
    }

    if (user.status.statusName === 'Inactive') {
      return NextResponse.json(
        { error: 'Account is inactive. Please contact administration.' },
        { status: 403 }
      );
    }

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const newFailedAttempts = user.failedAttempts + 1;

      if (newFailedAttempts >= 3) {
        // Lock account
        const lockedStatus = await db.accountStatus.findFirst({
          where: { statusName: 'Locked' },
        });

        if (lockedStatus) {
          await db.user.update({
            where: { userId: user.userId },
            data: {
              failedAttempts: newFailedAttempts,
              statusId: lockedStatus.statusId,
            },
          });
        }

        return NextResponse.json(
          { error: 'Account is Locked.' },
          { status: 403 }
        );
      } else {
        // Increment attempts
        await db.user.update({
          where: { userId: user.userId },
          data: {
            failedAttempts: newFailedAttempts,
          },
        });

        return NextResponse.json(
          { error: 'Invalid Email or Password.' },
          { status: 401 }
        );
      }
    }

    // Password matches - reset failed attempts
    await db.user.update({
      where: { userId: user.userId },
      data: {
        failedAttempts: 0,
      },
    });

    // Create session JWT
    const token = jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        role: user.role.roleName,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie using async cookies() in Next.js 15
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({
      message: 'Login Successful. Welcome to Fake News Detection System.',
      user: {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.roleName,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed due to a server error.' },
      { status: 500 }
    );
  }
}

// Add a GET or DELETE handler to support logout
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    return NextResponse.json({ message: 'Logged out successfully.' });
  } catch (error) {
    return NextResponse.json({ error: 'Logout failed.' }, { status: 500 });
  }
}
