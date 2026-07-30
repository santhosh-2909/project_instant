/**
 * Environment access with fail-fast validation.
 *
 * Fixes audit finding S-1: JWT_SECRET previously fell back to the literal
 * 'super-secret-key', which let anyone forge an admin token. Secrets now have
 * no fallback — a missing or weak secret is a startup error, not a silent
 * downgrade.
 */

/*
 * BACKEND ONLY. The `server-only` import above makes this a build error if any
 * client component ever imports this module, directly or transitively. That is
 * not theoretical: the UI previously imported `tokenise` from the retrieval
 * module, which shipped the provider stack and the ONNX import path to the
 * browser.
 */
import 'server-only';
class EnvError extends Error {
  constructor(message: string) {
    super(`[env] ${message}`);
    this.name = 'EnvError';
  }
}

/** Reads a required secret. Throws if absent or obviously insecure. */
export function requireSecret(name: string, minLength = 32): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new EnvError(
      `${name} is not set. Copy .env.example to .env.local and provide a value. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }

  if (value.length < minLength) {
    throw new EnvError(`${name} must be at least ${minLength} characters (got ${value.length}).`);
  }

  const banned = ['super-secret-key', 'secret', 'changeme', 'password', 'development'];
  if (banned.includes(value.toLowerCase())) {
    throw new EnvError(`${name} is set to a well-known placeholder value. Use a real random secret.`);
  }

  return value;
}

/** Reads an optional API key. Treats unset and `mock_*` placeholders alike. */
export function optionalKey(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('mock_') || value.includes('your_')) return null;
  return value;
}

export const getJwtSecret = () => requireSecret('JWT_SECRET');

/**
 * Which evidence providers are available right now.
 *
 * The first three need no API key and are therefore always on — this is what
 * lets the app return real, sourced verdicts straight out of the box. The rest
 * are optional upgrades that improve accuracy when a key is supplied.
 */
export function providerStatus() {
  return {
    // Keyless — always available.
    googlenews: true,
    wikipedia: true,
    wikidata: true,
    // Key required.
    factCheck: optionalKey('GOOGLE_FACT_CHECK_API_KEY') !== null,
    newsapi: optionalKey('NEWS_API_KEY') !== null,
    tavily: optionalKey('TAVILY_API_KEY') !== null,
    groq: optionalKey('GROQ_API_KEY') !== null,
    gemini: optionalKey('GEMINI_API_KEY') !== null,
  };
}
