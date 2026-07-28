import * as bcrypt from 'bcryptjs';

/**
 * Security answers are password-equivalent secrets (audit finding S-2). They
 * are normalised for usability, then hashed — never stored in readable form.
 */
export function normaliseSecurityAnswer(answer: string): string {
  return (answer ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function hashSecurityAnswer(answer: string): Promise<string> {
  return bcrypt.hash(normaliseSecurityAnswer(answer), 10);
}

/**
 * Verifies an answer against the stored value.
 *
 * Accounts created before answers were hashed still hold a plaintext value, so
 * a legacy constant-time comparison is kept as a fallback. `needsRehash` tells
 * the caller to upgrade the record on the next successful verification.
 */
export async function verifySecurityAnswer(
  answer: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  const normalised = normaliseSecurityAnswer(answer);
  const isHashed = /^\$2[aby]\$/.test(stored);

  if (isHashed) {
    return { valid: await bcrypt.compare(normalised, stored), needsRehash: false };
  }

  const valid = normaliseSecurityAnswer(stored) === normalised;
  return { valid, needsRehash: valid };
}
