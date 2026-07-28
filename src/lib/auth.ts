import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret } from './env';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Reads the current session.
 *
 * Audit fix S-1: the signing secret comes from `getJwtSecret()`, which throws
 * when JWT_SECRET is absent or weak. There is no insecure default any more, so
 * a misconfigured deployment fails loudly instead of accepting forged tokens.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    if (!decoded?.userId || !decoded?.email || !decoded?.role) return null;

    return { userId: decoded.userId, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AuthUser | null> {
  const user = await getAuthUser();
  return user?.role === 'Admin' ? user : null;
}

export function signSession(user: AuthUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
