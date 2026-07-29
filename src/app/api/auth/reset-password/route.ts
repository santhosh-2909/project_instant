import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { db } from '@/server/data/db';
import { hashSecurityAnswer, verifySecurityAnswer } from '@/server/auth/securityAnswer';
import { consume, clientKey, rateLimitHeaders, LIMITS } from '@/server/http/rateLimit';

/**
 * POST /api/auth/reset-password
 *
 * Audit fix S-3: this route previously allowed unlimited security-answer
 * guesses with no throttle, which bypassed the 3-strike login lockout entirely.
 * It is now rate limited per IP *and* per account, and a wrong answer counts
 * toward the same failed-attempt budget that locks the account.
 */

const MAX_ANSWER_ATTEMPTS = 5;

/** Identical response for "no such email" and "wrong answer" — no enumeration. */
const rejected = (headers: Record<string, string>) =>
  NextResponse.json(
    { error: 'The email and security answer do not match our records.' },
    { status: 401, headers }
  );

export async function POST(request: Request) {
  const limit = consume(
    clientKey(request, 'password-reset'),
    LIMITS.passwordReset.limit,
    LIMITS.passwordReset.windowMs
  );
  const headers = rateLimitHeaders(limit);

  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many reset attempts. Try again in ${limit.retryAfter} seconds.` },
      { status: 429, headers }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      securityAnswer?: unknown;
      newPassword?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const securityAnswer = typeof body.securityAnswer === 'string' ? body.securityAnswer : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!email || !securityAnswer || !newPassword) {
      return NextResponse.json(
        { error: 'Email, security answer and new password are all required.' },
        { status: 400, headers }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400, headers }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return rejected(headers);

    // Per-account throttle: an attacker spreading guesses across many IPs still
    // cannot exceed this budget for a single account.
    const perAccount = consume(`password-reset:account:${user.userId}`, MAX_ANSWER_ATTEMPTS, LIMITS.passwordReset.windowMs);
    if (!perAccount.ok) {
      return NextResponse.json(
        { error: 'Too many reset attempts for this account. Try again later.' },
        { status: 429, headers }
      );
    }

    const { valid, needsRehash } = await verifySecurityAnswer(securityAnswer, user.securityAnswer);

    if (!valid) {
      // A wrong answer is a failed authentication and counts toward lockout.
      await db.user.update({
        where: { userId: user.userId },
        data: { failedAttempts: user.failedAttempts + 1 },
      });
      return rejected(headers);
    }

    const activeStatus = await db.accountStatus.findFirst({ where: { statusName: 'Active' } });

    await db.user.update({
      where: { userId: user.userId },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        failedAttempts: 0,
        statusId: activeStatus ? activeStatus.statusId : user.statusId,
        // Upgrade legacy plaintext answers on first successful use.
        ...(needsRehash ? { securityAnswer: await hashSecurityAnswer(securityAnswer) } : {}),
      },
    });

    return NextResponse.json(
      { message: 'Password changed successfully. You can now sign in.' },
      { headers }
    );
  } catch (error) {
    console.error('[api/auth/reset-password] failed:', error);
    return NextResponse.json({ error: 'Password reset failed.' }, { status: 500, headers });
  }
}
