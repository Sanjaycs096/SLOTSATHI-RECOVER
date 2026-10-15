import crypto from 'crypto';

/**
 * Generate a cryptographically secure, unguessable token
 * Uses crypto.randomBytes (never Math.random)
 */
export function generateSecureToken(prefix: string = 'sec', byteLength: number = 24): string {
  const randomHex = crypto.randomBytes(byteLength).toString('hex');
  return `${prefix}_${randomHex}`;
}

/**
 * Compute SHA-256 hash of a token for secure storage & lookup
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
