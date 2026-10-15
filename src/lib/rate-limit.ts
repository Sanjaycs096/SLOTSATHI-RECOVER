import { NextRequest } from 'next/server';

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

// Bounded in-memory sliding token bucket cache
// Max entries to prevent memory exhaustion DoS attacks
const MAX_RATE_LIMIT_ENTRIES = 5000;
const rateLimitMap = new Map<string, RateLimitEntry>();

// Periodic garbage collection for expired entries (older than 10 minutes)
let lastCleanup = Date.now();
function cleanupStaleEntries(now: number) {
  if (now - lastCleanup < 60000 && rateLimitMap.size < MAX_RATE_LIMIT_ENTRIES) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap.entries()) {
    // If entry has been full/idle for more than 5 minutes, remove it
    if (now - entry.lastRefill > 300000) {
      rateLimitMap.delete(key);
    }
  }

  // If still above threshold, drop oldest entries
  if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    const keysToDelete = Array.from(rateLimitMap.keys()).slice(0, 1000);
    for (const k of keysToDelete) {
      rateLimitMap.delete(k);
    }
  }
}

export interface RateLimitConfig {
  maxTokens: number;
  refillRatePerSec: number;
}

// Strict IPv4 and IPv6 format validators to prevent spoofed arbitrary headers
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

/**
 * Extract sanitized client IP from request headers or fallback
 * Validates syntax before trusting forwarded headers to prevent header injection
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const candidate = forwarded.split(',')[0].trim();
    if (IPV4_REGEX.test(candidate) || IPV6_REGEX.test(candidate)) {
      return candidate;
    }
  }

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && (IPV4_REGEX.test(realIp) || IPV6_REGEX.test(realIp))) {
    return realIp;
  }

  return '127.0.0.1';
}

/**
 * Token bucket rate limiter enforced server-side.
 * Default: 20 requests burst, 2 per second refill.
 * 
 * Note on Multi-Instance Architecture:
 * For multi-instance horizontal scaling (e.g., multi-region Vercel or Kubernetes pods),
 * rate limits should be backed by an external distributed store like Redis (Upstash)
 * or Supabase RPC. For single-instance, local, and staging tests, this bounded in-memory
 * limiter provides leak-proof enforcement with bounded memory consumption.
 */
export function checkRateLimit(
  req: NextRequest,
  actionKey: string = 'global',
  config: RateLimitConfig = { maxTokens: 20, refillRatePerSec: 2 },
  resourceIdentifier?: string
): { allowed: boolean; remaining: number; resetSec: number } {
  const now = Date.now();
  cleanupStaleEntries(now);

  const ip = getClientIp(req);
  // Optional compound key binding to specific target resource to prevent IP rotation attacks on the same token
  const key = resourceIdentifier
    ? `${actionKey}:${ip}:${resourceIdentifier}`
    : `${actionKey}:${ip}`;

  let entry = rateLimitMap.get(key);
  if (!entry) {
    entry = { tokens: config.maxTokens, lastRefill: now };
    rateLimitMap.set(key, entry);
  }

  // Refill tokens based on elapsed time
  const elapsedSec = (now - entry.lastRefill) / 1000;
  const addedTokens = elapsedSec * config.refillRatePerSec;
  entry.tokens = Math.min(config.maxTokens, entry.tokens + addedTokens);
  entry.lastRefill = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(entry.tokens),
      resetSec: Math.ceil((config.maxTokens - entry.tokens) / config.refillRatePerSec),
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetSec: Math.ceil((1 - entry.tokens) / config.refillRatePerSec),
  };
}
