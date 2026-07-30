/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

/**
 * Turns database failures into messages a human can act on.
 *
 * Every route previously answered "…failed due to a server error", which is
 * true and useless. The most common cause in practice is that no database is
 * configured yet — a setup problem, not a bug — and the generic message sent
 * people hunting through application code for a missing environment variable.
 *
 * In development the cause is named outright. In production it is not, because
 * infrastructure detail should not be readable by anonymous callers; the server
 * log still carries the full error either way.
 */

const isDev = process.env.NODE_ENV !== 'production';

export interface FriendlyError {
  message: string;
  status: number;
  /** True when this is a deployment/config problem rather than a code fault. */
  configuration: boolean;
}

/** Prisma initialisation and connection failures we can explain precisely. */
function classify(error: unknown): FriendlyError | null {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  if (text.includes('Environment variable not found: DATABASE_URL')) {
    return {
      status: 503,
      configuration: true,
      message: isDev
        ? 'No database is configured. Accounts need one: set DATABASE_URL in .env.local, then run `npm run db:push` and `npm run db:seed`. Verification works without it.'
        : 'Accounts are temporarily unavailable. Verification is unaffected.',
    };
  }

  // Prisma cannot reach the server: wrong host/port, container down, firewall.
  if (
    text.includes("Can't reach database server") ||
    text.includes('ECONNREFUSED') ||
    text.includes('P1001')
  ) {
    return {
      status: 503,
      configuration: true,
      message: isDev
        ? 'The database is configured but unreachable. Check that it is running and that DATABASE_URL points at it.'
        : 'Accounts are temporarily unavailable. Verification is unaffected.',
    };
  }

  // Schema has never been applied.
  if (text.includes('does not exist in the current database') || text.includes('P2021') || text.includes('P1010')) {
    return {
      status: 503,
      configuration: true,
      message: isDev
        ? 'The database is reachable but empty. Run `npm run db:push` to create the schema, then `npm run db:seed`.'
        : 'Accounts are temporarily unavailable. Verification is unaffected.',
    };
  }

  return null;
}

/**
 * Maps any thrown value to a response body and status.
 * `fallback` is used for genuine application faults.
 */
export function describeError(error: unknown, fallback: string): FriendlyError {
  return classify(error) ?? { message: fallback, status: 500, configuration: false };
}
