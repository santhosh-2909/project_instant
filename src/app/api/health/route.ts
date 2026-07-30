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
import { providerStatus } from '@/server/config/env';
import { embeddingStatus } from '@/server/verification/embeddings';
import { probeAllProviders } from '@/server/verification/providerProbe';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const providers = providerStatus();

  /*
   * ?probe=1 makes a real request to every keyed provider.
   *
   * "Configured" only means a key exists in the environment. Two keys here
   * looked configured and were not — a GROQ_MODEL missing one character, and a
   * fact-check key that was not a Google API key at all. Both silently removed
   * a provider from every verdict. This turns that into a five-second check.
   *
   * Costs one Tavily search from the monthly quota when Tavily is configured.
   */
  const probe = new URL(request.url).searchParams.get('probe') === '1';
  const probes = probe ? await probeAllProviders() : null;

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
      ...(probes ? { probes } : {}),
      degraded,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
