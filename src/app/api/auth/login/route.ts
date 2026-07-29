import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { db } from '@/server/data/db';
import { signSession, setSessionCookie, clearSessionCookie } from '@/server/auth/session';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/server/http/rateLimit';

const MAX_FAILED_ATTEMPTS = 3;

/** A bcrypt hash of a value nobody can supply — used to equalise timing. */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * Uniform failure response.
 *
 * Audit fix S-7: the old handler returned 404 "User does not exist." for an
 * unknown email and 401 for a wrong password, which let anyone enumerate
 * registered accounts. Both cases now return an identical 401.
 */
const invalidCredentials = (headers: Record<string, string>) =>
  NextResponse.json({ error: 'Invalid email or password.' }, { status: 401, headers });

export async function POST(request: Request) {
  // Audit fix S-4: brute force is throttled per IP before any DB work.
  const limit = consume(clientKey(request, 'login'), LIMITS.login.limit, LIMITS.login.windowMs);
  const headers = rateLimitHeaders(limit);

  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many sign-in attempts. Try again in ${limit.retryAfter} seconds.` },
      { status: 429, headers }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400, headers });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { role: true, status: true },
    });

    if (!user) {
      // Equalise timing so a missing account is not detectable by response time.
      await bcrypt.compare(password, DUMMY_HASH);
      return invalidCredentials(headers);
    }

    if (user.status.statusName === 'Locked') {
      return NextResponse.json(
        {
          error: 'This account is locked after repeated failed sign-ins. Reset your password to regain access.',
          locked: true,
        },
        { status: 403, headers }
      );
    }

    if (user.status.statusName === 'Inactive') {
      return NextResponse.json(
        { error: 'This account is inactive. Please contact an administrator.' },
        { status: 403, headers }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const failedAttempts = user.failedAttempts + 1;

      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedStatus = await db.accountStatus.findFirst({ where: { statusName: 'Locked' } });
        await db.user.update({
          where: { userId: user.userId },
          data: {
            failedAttempts,
            ...(lockedStatus ? { statusId: lockedStatus.statusId } : {}),
          },
        });

        return NextResponse.json(
          {
            error: 'This account is locked after repeated failed sign-ins. Reset your password to regain access.',
            locked: true,
          },
          { status: 403, headers }
        );
      }

      await db.user.update({ where: { userId: user.userId }, data: { failedAttempts } });
      return invalidCredentials(headers);
    }

    if (user.failedAttempts !== 0) {
      await db.user.update({ where: { userId: user.userId }, data: { failedAttempts: 0 } });
    }

    const token = signSession({ userId: user.userId, email: user.email, role: user.role.roleName });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        message: 'Signed in successfully.',
        user: {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role.roleName,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error('[api/auth/login] failed:', error);
    return NextResponse.json({ error: 'Sign-in failed due to a server error.' }, { status: 500, headers });
  }
}

/** Sign out. */
export async function DELETE() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ message: 'Signed out successfully.' });
  } catch {
    return NextResponse.json({ error: 'Sign-out failed.' }, { status: 500 });
  }
}
