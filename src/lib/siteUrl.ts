/**
 * Canonical public URL of this deployment.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL   — set this to your custom domain in production
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's stable production hostname
 *   3. VERCEL_URL             — the per-deployment preview hostname
 *   4. localhost              — development
 *
 * Used for sitemap/robots and canonical metadata, so preview deployments never
 * advertise themselves as the production site.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return `https://${preview}`;

  return 'http://localhost:3000';
}
