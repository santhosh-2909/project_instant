/**
 * GET /api/health — deployment health and configuration report.
 *
 * Returns 200 when the app can serve verifications, 503 when it cannot. Safe to
 * expose publicly: it reports *whether* each provider is configured, never any
 * key material.
 *
 * Useful immediately after deploying to confirm which providers Vercel actually
 * picked up from the project's environment variables.
 */

import { NextResponse } from 'next/server';
import { providerStatus } from '@/lib/env';
import { embeddingStatus } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = providerStatus();

  // Keyless providers always work, so the verification path is always live.
  // The database is optional — only accounts, history and analytics need it.
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const sessionsConfigured = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);

  const checks = {
    verification: true,
    evidenceProviders: providers.googlenews && providers.wikipedia && providers.wikidata,
    database: databaseConfigured,
    sessions: sessionsConfigured,
  };

  const degraded: string[] = [];
  if (!databaseConfigured) degraded.push('No DATABASE_URL: sign-in, history and dashboard are unavailable.');
  if (!sessionsConfigured) degraded.push('No valid JWT_SECRET (min 32 chars): sign-in is unavailable.');
  if (!providers.factCheck) degraded.push('No GOOGLE_FACT_CHECK_API_KEY: published fact-checker rulings are not consulted.');

  const healthy = checks.verification && checks.evidenceProviders;

  return NextResponse.json(
    {
      status: healthy ? (degraded.length > 0 ? 'degraded' : 'ok') : 'unhealthy',
      checks,
      providers,
      embeddings: embeddingStatus(),
      degraded,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
