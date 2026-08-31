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
  /**
   * Nombre de blocages déjà infligés à cette clé. Sert de mémoire de récidive
   * pour le repli exponentiel : survit à l'expiration d'une peine, contrairement
   * à `failures` qui est remis à zéro pour rouvrir l'accès.
   */
  blocks: number;
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

  /**
   * À appeler AVANT de vérifier le mot de passe.
   *
   * ATOMICITÉ (corrige une faille TOCTOU vérifiée en production)
   * -----------------------------------------------------------
   * Cette méthode RÉSERVE la tentative : elle incrémente le compteur
   * immédiatement, avant tout `await` de l'appelant.
   *
   * Une première version se contentait de LIRE le compteur, la comptabilisation
   * n'intervenant qu'ensuite via `recordFailure`. Or tRPC exécute les appels d'un
   * même lot `httpBatchLink` EN PARALLÈLE : les N `check()` s'exécutaient tous
   * avant le premier `recordFailure`, lisaient donc un compteur encore vierge et
   * repartaient tous « autorisés ». Mesuré sur le serveur : 20 mots de passe
   * testés dans UNE seule requête HTTP avant tout blocage.
   *
   * En réservant dès la lecture, la N-ième tentative concurrente voit déjà les
   * N-1 précédentes. `recordSuccess` libère ensuite les réservations du compte.
   */
  check(input: { email: string; ip: string }): RateLimitVerdict {
    const now = this.options.now();
    const emailKey = normalizeEmailKey(input.email);

    // ORDRE IMPORTANT : le quota IP est réservé EN PREMIER.
    //
    // L'inverse (e-mail puis IP, avec restitution en cas de refus IP) laissait
    // une fuite : la restitution ramenait `failures` à sa valeur d'avant, mais si
    // la réservation e-mail venait de CRÉER le compteur, la clé subsistait avec
    // une fenêtre déjà démarrée. Un balayage d'IP pouvait ainsi entamer l'état du
    // compteur d'un compte légitime — exactement le déni de service croisé que ce
    // limiteur doit empêcher.
    const ipVerdict = this.reserve(
      this.ipBuckets,
      input.ip,
      now,
      this.options.maxFailuresPerIp,
      "ip"
    );
    if (!ipVerdict.allowed) return ipVerdict;

    const emailVerdict = this.reserve(
      this.emailBuckets,
      emailKey,
      now,
      this.options.maxFailuresPerEmail,
      "email"
    );
    if (!emailVerdict.allowed) {
      // Le compte est bloqué : on rend la réservation IP prise juste au-dessus,
      // sinon marteler un seul compte déjà verrouillé consommerait le quota IP
      // et bloquerait tous les autres utilisateurs partageant cette sortie
      // Internet (bureau, NAT d'entreprise).
      this.release(this.ipBuckets, input.ip);
    }
    return emailVerdict;
  }

  /**
   * À appeler après un échec (mot de passe faux OU e-mail inconnu).
   *
   * La tentative a déjà été comptée par `check()`. Cette méthode CONFIRME
   * l'échec : elle transforme la réservation en échec définitif et arme le
   * blocage à repli exponentiel si le seuil est franchi.
   */
  recordFailure(input: { email: string; ip: string }): void {
    const now = this.options.now();
    this.confirmFailure(
      this.emailBuckets,
      normalizeEmailKey(input.email),
      now,
      this.options.maxFailuresPerEmail
    );
    this.confirmFailure(this.ipBuckets, input.ip, now, this.options.maxFailuresPerIp);
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

  /**
   * Réserve une tentative de façon atomique (aucun `await` à l'intérieur : le
   * modèle mono-thread de Node garantit qu'aucun autre appel ne s'intercale).
   *
   * Renvoie `allowed: false` si le quota est déjà consommé ou si un blocage court.
   */
  private reserve(
    store: Map<string, Bucket>,
    key: string,
    now: number,
    maxFailures: number,
    scope: "email" | "ip"
  ): RateLimitVerdict {
    let bucket = store.get(key);

    if (bucket) {
      const blocageTermine = bucket.blockedUntil > 0 && bucket.blockedUntil <= now;
      const fenetreEcoulee = now - bucket.windowStartedAt >= this.options.windowMs;

      if (blocageTermine) {
        // La peine a été purgée : on rouvre l'accès. Sans cette remise à zéro,
        // `failures` restait au-dessus du seuil et le compte était bloqué à vie
        // (le blocage expirait, mais le compteur le réarmait aussitôt).
        // `blocks` est CONSERVÉ : il porte la mémoire du repli exponentiel, pour
        // qu'un attaquant persistant ne retrouve pas une peine minimale.
        bucket.failures = 0;
        bucket.blockedUntil = 0;
        bucket.windowStartedAt = now;
      } else if (bucket.blockedUntil === 0 && fenetreEcoulee) {
        // Fenêtre écoulée sans incident : le compteur repart totalement à neuf.
        store.delete(key);
        bucket = undefined;
      }
    }

    if (bucket && bucket.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
        scope,
      };
    }

    if (!bucket) {
      bucket = { failures: 0, blocks: 0, windowStartedAt: now, blockedUntil: 0, lastSeenAt: now };
      store.set(key, bucket);
    }

    // Quota déjà consommé (y compris par des tentatives encore « en vol » du
    // même lot) : on arme le blocage sans laisser passer celle-ci.
    if (bucket.failures >= maxFailures) {
      bucket.lastSeenAt = now;
      this.armBlock(bucket, now);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
        scope,
      };
    }

    bucket.failures += 1;
    bucket.lastSeenAt = now;
    this.evictIfNeeded(store, now);
    return { allowed: true };
  }

  /** Rend une réservation prise à tort (ex. refus par l'autre compteur). */
  private release(store: Map<string, Bucket>, key: string): void {
    const bucket = store.get(key);
    if (!bucket) return;
    bucket.failures = Math.max(0, bucket.failures - 1);
    // `blocks` doit être nul aussi : sinon on effacerait la mémoire de récidive
    // d'une clé déjà sanctionnée, offrant un moyen de repartir à peine minimale.
    if (bucket.failures === 0 && bucket.blockedUntil === 0 && bucket.blocks === 0) {
      store.delete(key);
    }
  }

  /**
   * Confirme un échec déjà réservé : arme le blocage si le seuil est franchi.
   * N'incrémente PAS le compteur (`reserve` l'a fait), pour éviter tout
   * double comptage.
   */
  private confirmFailure(
    store: Map<string, Bucket>,
    key: string,
    now: number,
    maxFailures: number
  ): void {
    const bucket = store.get(key);
    if (!bucket) return;

    bucket.lastSeenAt = now;
    if (bucket.failures >= maxFailures) {
      this.armBlock(bucket, now);
    }
    this.evictIfNeeded(store, now);
  }

  /**
   * Arme (ou prolonge) le blocage avec un repli exponentiel : chaque blocage
   * successif double la peine, plafonnée à `maxBlockMs`.
   *
   * Le compteur `blocks` sert de mémoire de récidive : il survit à l'expiration
   * d'une peine, de sorte qu'un attaquant qui revient après chaque déblocage
   * subit une attente croissante plutôt que de repartir au minimum.
   */
  private armBlock(bucket: Bucket, now: number): void {
    if (bucket.blockedUntil > now) return; // Blocage déjà en cours.

    const blockMs = Math.min(
      this.options.maxBlockMs,
      this.options.baseBlockMs * 2 ** bucket.blocks
    );
    bucket.blocks += 1;
    bucket.blockedUntil = now + blockMs;
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
