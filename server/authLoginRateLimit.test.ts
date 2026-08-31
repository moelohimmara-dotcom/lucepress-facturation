import { describe, expect, it } from "vitest";
import { LoginRateLimiter, normalizeEmailKey } from "./_core/loginRateLimit";
import { resolveClientIp } from "./_core/clientIp";

/** Horloge contrôlée : évite tout `sleep` et rend les tests déterministes. */
function fakeClock(start = 1_700_000_000_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function limiter(clock: ReturnType<typeof fakeClock>, overrides = {}) {
  return new LoginRateLimiter({
    windowMs: 15 * 60_000,
    maxFailuresPerEmail: 5,
    maxFailuresPerIp: 20,
    baseBlockMs: 60_000,
    maxBlockMs: 60 * 60_000,
    now: clock.now,
    ...overrides,
  });
}

const IP = "41.66.1.9";

describe("anti-brute-force auth.login — quota par e-mail", () => {
  it("laisse passer les tentatives sous le seuil", () => {
    const clock = fakeClock();
    const rl = limiter(clock);

    for (let i = 0; i < 4; i++) {
      expect(rl.check({ email: "dg@lucepress.com", ip: IP }).allowed).toBe(true);
      rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    }
    expect(rl.check({ email: "dg@lucepress.com", ip: IP }).allowed).toBe(true);
  });

  it("bloque au 5e échec et renvoie un délai d'attente exploitable", () => {
    const clock = fakeClock();
    const rl = limiter(clock);

    for (let i = 0; i < 5; i++) {
      rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    }

    const verdict = rl.check({ email: "dg@lucepress.com", ip: IP });
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) throw new Error("attendu: bloqué");
    expect(verdict.scope).toBe("email");
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("n'affecte pas les autres comptes (pas de déni de service croisé)", () => {
    const clock = fakeClock();
    const rl = limiter(clock);

    for (let i = 0; i < 6; i++) {
      rl.recordFailure({ email: "cible@lucepress.com", ip: IP });
    }

    expect(rl.check({ email: "cible@lucepress.com", ip: IP }).allowed).toBe(false);
    // Un autre utilisateur, depuis une autre IP, doit rester libre.
    expect(rl.check({ email: "autre@lucepress.com", ip: "197.2.3.4" }).allowed).toBe(true);
  });

  it("débloque une fois le délai écoulé", () => {
    const clock = fakeClock();
    const rl = limiter(clock);

    for (let i = 0; i < 5; i++) {
      rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    }
    expect(rl.check({ email: "dg@lucepress.com", ip: IP }).allowed).toBe(false);

    clock.advance(60_000 + 1_000);
    expect(rl.check({ email: "dg@lucepress.com", ip: IP }).allowed).toBe(true);
  });

  it("applique un repli exponentiel : s'acharner allonge le blocage", () => {
    const clock = fakeClock();
    const rl = limiter(clock);

    for (let i = 0; i < 5; i++) {
      rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    }
    const first = rl.check({ email: "dg@lucepress.com", ip: IP });
    if (first.allowed) throw new Error("attendu: bloqué");

    rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    const second = rl.check({ email: "dg@lucepress.com", ip: IP });
    if (second.allowed) throw new Error("attendu: bloqué");

    expect(second.retryAfterSeconds).toBeGreaterThan(first.retryAfterSeconds);
  });

  it("plafonne la durée de blocage", () => {
    const clock = fakeClock();
    const rl = limiter(clock, { maxBlockMs: 120_000 });

    for (let i = 0; i < 30; i++) {
      rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    }
    const verdict = rl.check({ email: "dg@lucepress.com", ip: IP });
    if (verdict.allowed) throw new Error("attendu: bloqué");
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(120);
  });

  it("remet le compteur à zéro après une connexion réussie", () => {
    const clock = fakeClock();
    const rl = limiter(clock);

    // 4 erreurs de frappe, puis succès : l'utilisateur ne doit pas être puni.
    for (let i = 0; i < 4; i++) {
      rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    }
    rl.recordSuccess({ email: "dg@lucepress.com" });

    for (let i = 0; i < 4; i++) {
      expect(rl.check({ email: "dg@lucepress.com", ip: IP }).allowed).toBe(true);
      rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    }
    expect(rl.check({ email: "dg@lucepress.com", ip: IP }).allowed).toBe(true);
  });

  it("ne se laisse pas contourner par la casse ou les espaces de l'e-mail", () => {
    const clock = fakeClock();
    const rl = limiter(clock);

    rl.recordFailure({ email: "DG@Lucepress.com", ip: IP });
    rl.recordFailure({ email: "dg@lucepress.com ", ip: IP });
    rl.recordFailure({ email: " Dg@LUCEPRESS.com", ip: IP });
    rl.recordFailure({ email: "dg@lucepress.com", ip: IP });
    rl.recordFailure({ email: "dG@lucepress.COM", ip: IP });

    // Les 5 variantes doivent alimenter UN SEUL compteur.
    expect(rl.check({ email: "dg@lucepress.com", ip: IP }).allowed).toBe(false);
    expect(normalizeEmailKey(" DG@Lucepress.COM ")).toBe("dg@lucepress.com");
  });
});

describe("anti-brute-force auth.login — quota par IP", () => {
  it("bloque le balayage de nombreux comptes depuis une même IP", () => {
    const clock = fakeClock();
    const rl = limiter(clock, { maxFailuresPerIp: 8 });

    // Chaque e-mail est différent : le quota par e-mail n'est jamais atteint.
    for (let i = 0; i < 8; i++) {
      rl.recordFailure({ email: `victime${i}@lucepress.com`, ip: IP });
    }

    const verdict = rl.check({ email: "encore@lucepress.com", ip: IP });
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) throw new Error("attendu: bloqué");
    expect(verdict.scope).toBe("ip");
  });

  it("un succès ne réarme pas le quota IP", () => {
    const clock = fakeClock();
    const rl = limiter(clock, { maxFailuresPerIp: 5 });

    for (let i = 0; i < 5; i++) {
      rl.recordFailure({ email: `victime${i}@lucepress.com`, ip: IP });
    }
    // Un attaquant disposant d'un compte valide ne doit pas pouvoir purger
    // son quota IP en se connectant avec succès.
    rl.recordSuccess({ email: "sien@lucepress.com" });

    expect(rl.check({ email: "suivant@lucepress.com", ip: IP }).allowed).toBe(false);
  });
});

describe("anti-brute-force — garde-fou mémoire", () => {
  it("ne conserve pas indéfiniment les clés (protection DoS mémoire)", () => {
    const clock = fakeClock();
    const rl = limiter(clock, { maxTrackedKeys: 50 });

    for (let i = 0; i < 500; i++) {
      rl.recordFailure({ email: `bidon${i}@exemple.com`, ip: `10.0.${i % 255}.${i % 100}` });
      clock.advance(10);
    }

    // Le compteur d'un e-mail récent doit rester fonctionnel malgré l'éviction.
    for (let i = 0; i < 5; i++) {
      rl.recordFailure({ email: "reel@lucepress.com", ip: IP });
    }
    expect(rl.check({ email: "reel@lucepress.com", ip: IP }).allowed).toBe(false);
  });
});

describe("résolution de l'IP client", () => {
  const baseReq = (headers: Record<string, string | string[]>, ip = "127.0.0.1") =>
    ({ headers, ip, socket: { remoteAddress: ip } }) as any;

  it("ignore X-Forwarded-For quand aucun proxy n'est déclaré (anti-usurpation)", () => {
    delete process.env.TRUST_PROXY;
    const resolved = resolveClientIp(baseReq({ "x-forwarded-for": "1.2.3.4" }, "203.0.113.7"));
    expect(resolved).toBe("203.0.113.7");
  });

  it("retient l'entrée écrite par notre proxy, pas celle fournie par le client", () => {
    process.env.TRUST_PROXY = "1";
    // Le client a injecté "9.9.9.9" ; notre proxy a ajouté la vraie IP en fin de chaîne.
    const resolved = resolveClientIp(baseReq({ "x-forwarded-for": "9.9.9.9, 41.66.1.9" }));
    expect(resolved).toBe("41.66.1.9");
    delete process.env.TRUST_PROXY;
  });

  it("normalise les IPv4 encapsulées en IPv6", () => {
    delete process.env.TRUST_PROXY;
    expect(resolveClientIp(baseReq({}, "::ffff:41.66.1.9"))).toBe("41.66.1.9");
  });
});
