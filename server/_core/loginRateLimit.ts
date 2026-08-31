/**
 * Anti-brute-force pour l'authentification locale (email + mot de passe).
 *
 * POURQUOI CE MODULE EXISTE ALORS QU'UN `express-rate-limit` EST DÉJÀ EN PLACE
 * ---------------------------------------------------------------------------
 * `server/_core/index.ts` applique `rateLimit({ windowMs: 60s, max: 120 })` sur
 * `/api/`. Ce garde-fou ne protège PAS `auth.login`, pour deux raisons :
 *
 *  1. Le client utilise `httpBatchLink` (voir `client/src/main.tsx`). tRPC
 *     regroupe plusieurs appels dans UNE SEULE requête HTTP. Un attaquant peut
 *     donc empaqueter 100 tentatives de connexion dans 1 requête : le compteur
 *     HTTP ne voit qu'un seul hit. Le comptage doit se faire DANS la procédure.
 *  2. Le quota HTTP est global (120 req/min toutes routes confondues) : bien
 *     trop permissif pour du credential-stuffing, et non ciblé sur le compte.
 *
 * STRATÉGIE
 * ---------
 * Double compteur, et on ne compte QUE LES ÉCHECS :
 *  - par e-mail : bloque l'acharnement sur un compte précis (défense primaire) ;
 *  - par IP     : bloque le balayage de nombreux comptes depuis une source.
 * Une connexion réussie purge le compteur e-mail (l'utilisateur légitime qui
 * s'est trompé 3 fois n'est pas puni ensuite).
 *
 * Après le seuil atteint, le blocage est à repli exponentiel (backoff) :
 * chaque nouvel échec double la durée, jusqu'à un plafond.
 *
 * LIMITE CONNUE (assumée) : l'état est EN MÉMOIRE DU PROCESSUS.
 *  - Adapté au déploiement actuel : 1 seul process Node (PM2, `lucepress`).
 *  - Un redémarrage remet les compteurs à zéro.
 *  - Si l'app passe en multi-instance (cluster/scale horizontal), il faudra un
 *    store partagé (Redis) : voir `docs/AUTH-email-password.md`.
 */

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; scope: "email" | "ip" };

export type LoginRateLimitOptions = {
  /** Fenêtre glissante d'observation des échecs. */
  windowMs: number;
  /** Échecs tolérés pour un même e-mail avant blocage. */
  maxFailuresPerEmail: number;
  /** Échecs tolérés pour une même IP (tous comptes confondus) avant blocage. */
  maxFailuresPerIp: number;
  /** Durée du premier blocage. */
  baseBlockMs: number;
  /** Plafond de la durée de blocage. */
  maxBlockMs: number;
  /** Garde-fou mémoire : nombre max de clés suivies par compteur. */
  maxTrackedKeys: number;
  /** Horloge injectable (tests). */
  now: () => number;
};

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimitOptions = {
  windowMs: 15 * 60_000,
  maxFailuresPerEmail: 5,
  maxFailuresPerIp: 20,
  baseBlockMs: 60_000,
  maxBlockMs: 60 * 60_000,
  maxTrackedKeys: 10_000,
  now: () => Date.now(),
};

type Bucket = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
  lastSeenAt: number;
};

/**
 * Normalise la clé e-mail : sans cela `Admin@X.com` et `admin@x.com ` seraient
 * deux compteurs distincts, ce qui multiplierait le quota par autant de
 * variations de casse — un contournement trivial.
 */
export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

export class LoginRateLimiter {
  private readonly options: LoginRateLimitOptions;
  private readonly emailBuckets = new Map<string, Bucket>();
  private readonly ipBuckets = new Map<string, Bucket>();

  constructor(options: Partial<LoginRateLimitOptions> = {}) {
    this.options = { ...DEFAULT_LOGIN_RATE_LIMIT, ...options };
  }

  /** À appeler AVANT de vérifier le mot de passe. */
  check(input: { email: string; ip: string }): RateLimitVerdict {
    const now = this.options.now();
    const emailVerdict = this.inspect(this.emailBuckets, normalizeEmailKey(input.email), now, "email");
    if (!emailVerdict.allowed) return emailVerdict;
    return this.inspect(this.ipBuckets, input.ip, now, "ip");
  }

  /** À appeler après un échec (mot de passe faux OU e-mail inconnu). */
  recordFailure(input: { email: string; ip: string }): void {
    const now = this.options.now();
    this.bump(this.emailBuckets, normalizeEmailKey(input.email), now, this.options.maxFailuresPerEmail);
    this.bump(this.ipBuckets, input.ip, now, this.options.maxFailuresPerIp);
  }

  /**
   * À appeler après une connexion réussie : purge le compteur du compte.
   * Le compteur IP est volontairement CONSERVÉ — sinon un attaquant possédant
   * un compte valide pourrait remettre son quota IP à zéro à volonté entre deux
   * salves de credential-stuffing.
   */
  recordSuccess(input: { email: string }): void {
    this.emailBuckets.delete(normalizeEmailKey(input.email));
  }

  /** Tests / maintenance. */
  reset(): void {
    this.emailBuckets.clear();
    this.ipBuckets.clear();
  }

  private inspect(
    store: Map<string, Bucket>,
    key: string,
    now: number,
    scope: "email" | "ip"
  ): RateLimitVerdict {
    const bucket = store.get(key);
    if (!bucket) return { allowed: true };

    if (bucket.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
        scope,
      };
    }

    // Fenêtre expirée et plus de blocage actif : on repart de zéro.
    if (now - bucket.windowStartedAt >= this.options.windowMs) {
      store.delete(key);
    }
    return { allowed: true };
  }

  private bump(store: Map<string, Bucket>, key: string, now: number, maxFailures: number): void {
    let bucket = store.get(key);

    if (!bucket || now - bucket.windowStartedAt >= this.options.windowMs) {
      bucket = { failures: 0, windowStartedAt: now, blockedUntil: 0, lastSeenAt: now };
    }

    bucket.failures += 1;
    bucket.lastSeenAt = now;

    if (bucket.failures >= maxFailures) {
      // Repli exponentiel : 1er blocage = baseBlockMs, puis x2 par échec
      // supplémentaire, plafonné à maxBlockMs.
      const overshoot = bucket.failures - maxFailures;
      const blockMs = Math.min(
        this.options.maxBlockMs,
        this.options.baseBlockMs * 2 ** overshoot
      );
      bucket.blockedUntil = now + blockMs;
    }

    store.set(key, bucket);
    this.evictIfNeeded(store, now);
  }

  /**
   * Garde-fou mémoire : sans plafond, un attaquant pourrait faire grossir la
   * Map indéfiniment (une clé par e-mail inventé) — un DoS mémoire.
   * On purge d'abord les entrées périmées, puis les plus anciennes.
   */
  private evictIfNeeded(store: Map<string, Bucket>, now: number): void {
    if (store.size <= this.options.maxTrackedKeys) return;

    // `forEach` plutôt qu'un `for...of` sur la Map : le tsconfig du projet cible
    // un niveau ES qui n'autorise pas l'itération directe des Map (TS2802).
    const staleKeys: string[] = [];
    store.forEach((bucket, key) => {
      const expired =
        bucket.blockedUntil <= now && now - bucket.windowStartedAt >= this.options.windowMs;
      if (expired) staleKeys.push(key);
    });
    staleKeys.forEach(key => store.delete(key));
    if (store.size <= this.options.maxTrackedKeys) return;

    const surplus = store.size - this.options.maxTrackedKeys;
    const entries: Array<{ key: string; lastSeenAt: number }> = [];
    store.forEach((bucket, key) => entries.push({ key, lastSeenAt: bucket.lastSeenAt }));
    entries.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
    for (let i = 0; i < surplus; i++) {
      const entry = entries[i];
      if (entry) store.delete(entry.key);
    }
  }
}

/** Instance partagée utilisée par `auth.login` / `auth.register`. */
export const loginRateLimiter = new LoginRateLimiter();

/**
 * Quota volontairement plus permissif pour l'inscription : on veut freiner le
 * spam de création de comptes, pas bloquer une saisie maladroite.
 */
export const registerRateLimiter = new LoginRateLimiter({
  maxFailuresPerEmail: 3,
  maxFailuresPerIp: 10,
  windowMs: 60 * 60_000,
  baseBlockMs: 5 * 60_000,
  maxBlockMs: 60 * 60_000,
});
