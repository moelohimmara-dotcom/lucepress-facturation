/**
 * Anti-abus pour les liens guest de documents (consultation / acceptation).
 * Compteurs en mémoire process — adapté au déploiement PM2 mono-instance actuel.
 */

export type GuestShareRateVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type Bucket = { count: number; windowStartedAt: number; blockedUntil: number };

const DEFAULTS = {
  windowMs: 15 * 60_000,
  maxAttempts: 40,
  blockMs: 15 * 60_000,
  maxTrackedKeys: 5_000,
};

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size <= DEFAULTS.maxTrackedKeys) return;
  for (const [key, bucket] of Array.from(buckets.entries())) {
    if (bucket.blockedUntil < now && bucket.windowStartedAt + DEFAULTS.windowMs < now) {
      buckets.delete(key);
    }
  }
  while (buckets.size > DEFAULTS.maxTrackedKeys) {
    const first = buckets.keys().next().value;
    if (first === undefined) break;
    buckets.delete(first);
  }
}

export function assertGuestShareRateLimit(ip: string | undefined): GuestShareRateVerdict {
  const key = (ip || "unknown").trim() || "unknown";
  const now = Date.now();
  prune(now);
  const existing = buckets.get(key);
  if (existing && existing.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.blockedUntil - now) / 1000) };
  }
  if (!existing || existing.windowStartedAt + DEFAULTS.windowMs < now) {
    buckets.set(key, { count: 1, windowStartedAt: now, blockedUntil: 0 });
    return { allowed: true };
  }
  existing.count += 1;
  if (existing.count > DEFAULTS.maxAttempts) {
    existing.blockedUntil = now + DEFAULTS.blockMs;
    return { allowed: false, retryAfterSeconds: Math.ceil(DEFAULTS.blockMs / 1000) };
  }
  return { allowed: true };
}

/** Tests uniquement. */
export function __resetGuestShareRateLimitForTests() {
  buckets.clear();
}
