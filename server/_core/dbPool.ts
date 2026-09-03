const DEFAULT_POOL = 10;
const MIN_POOL = 2;
const MAX_POOL = 50;

/** Taille du pool mysql2. Défaut 10 — suffisant pour 7–20 staff, plafonné pour protéger MySQL partagé. */
export function parseDatabasePoolSize(raw?: string | null): number {
  const parsed = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_POOL;
  return Math.min(MAX_POOL, Math.max(MIN_POOL, parsed));
}
