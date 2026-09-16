import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSOLE_MFA_REQUIRED_ERR_MSG, CONSOLE_REFUSED_ERR_MSG, systemProcedure } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { CONSOLE_ATTEMPT_WINDOW_MS, formatConsoleAttempt, logConsoleAttempt, resetConsoleAttemptLog } from "./systemAccessLog";

/**
 * ÉTAPE B2 — LE VERROU DE LA CONSOLE, CÔTÉ SERVEUR.
 *
 * Deux règles s’y croisent, et il serait facile de n’en vérifier qu’une :
 *
 *  1. UN COMPTE `systeme` SANS MFA N’OBTIENT AUCUNE PROCÉDURE DE CONSOLE (403).
 *     Le cahier des charges § 6 exige la double authentification pour ouvrir la
 *     console ; l’exiger « dans l’interface » ne serait pas l’exiger.
 *  2. CE MÊME COMPTE CONSERVE L’ACCÈS À L’ENRÔLEMENT. Sans cette seconde
 *     moitié, le verrou serait une porte fermée sans clé : un administrateur
 *     système sans MFA ne pourrait jamais s’enrôler, donc jamais entrer.
 *
 * Et par-dessus les deux : LE REFUS EST MUET. Ni le message d’erreur, ni le
 * rendu de l’écran ne nomment l’espace protégé. La tentative est écrite dans le
 * journal du serveur — visible pour l’administrateur système, invisible pour
 * l’intéressé.
 *
 * `server/mfa.ts` est doublé ici : la mécanique MFA est prouvée sur le vrai
 * module dans `server/mfa.test.ts`. Ce fichier-ci vérifie QUI passe, QUI est
 * refusé, et CE QUI EST ÉCRIT.
 */

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    isMfaActiveForUser: vi.fn(async () => true),
    readMfaState: vi.fn(),
    startEnrollment: vi.fn(),
    confirmEnrollment: vi.fn(),
    disableMfa: vi.fn(),
  };
});

vi.mock("./mfa", async importOriginal => {
  const actual = await importOriginal<typeof import("./mfa")>();
  return { ...actual, ...mocks };
});

const ETAT_SANS_MFA = { readable: true, enabled: false, pending: false, enrolledAt: null, recoveryCodesRemaining: 0 };

function contextFor(role: string): TrpcContext {
  return {
    user: {
      id: 42,
      openId: `staff-${role}`,
      name: `Compte ${role}`,
      email: `${role}@lucepres.gn`,
      loginMethod: "email",
      role,
      createdAt: new Date("2026-01-05T08:00:00.000Z"),
      updatedAt: new Date("2026-01-05T08:00:00.000Z"),
      lastSignedIn: new Date("2026-09-16T06:00:00.000Z"),
    },
    tenantId: 1,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

function anonymousContext(): TrpcContext {
  return { user: null, tenantId: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
}

/** Les lignes écrites par le journal, capturées au lieu d’aller sur la sortie. */
let journal: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  resetConsoleAttemptLog();
  journal = [];
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    journal.push(args.map(String).join(" "));
  });
  mocks.isMfaActiveForUser.mockResolvedValue(true);
  mocks.readMfaState.mockResolvedValue(ETAT_SANS_MFA);
  mocks.startEnrollment.mockResolvedValue({
    ok: true,
    value: {
      secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      otpauthUri: "otpauth://totp/Lucepress%3Asysteme%40lucepres.gn?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      issuer: "Lucepress",
      account: "systeme@lucepres.gn",
      digits: 6,
      periodSeconds: 30,
      algorithm: "SHA1",
    },
  });
  mocks.confirmEnrollment.mockResolvedValue({
    ok: true,
    value: { recoveryCodes: ["A2C4E7GH9K"], enrolledAt: new Date("2026-09-16T10:00:00.000Z") },
  });
  mocks.disableMfa.mockResolvedValue({ ok: true, value: { disabledAt: new Date("2026-09-16T10:00:00.000Z") } });
});

/* ------------------------------------------------------------------ */
/* 1. Le verrou, dans les deux sens                                    */
/* ------------------------------------------------------------------ */

describe("Console — rôle système SANS MFA : refus", () => {
  it("refuse les cinq procédures de console en 403", async () => {
    mocks.isMfaActiveForUser.mockResolvedValue(false);
    const caller = appRouter.createCaller(contextFor("systeme"));

    for (const appel of [
      () => caller.system.overview(),
      () => caller.system.metrics(),
      () => caller.system.access(),
      () => caller.system.sessions.list(),
      () => caller.system.sessions.revoke({ id: 3 }),
    ]) {
      await expect(appel()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("ÉCHOUE FERMÉ quand l’état MFA n’est pas lisible", async () => {
    // `isMfaActiveForUser` rend `false` sur toute lecture impossible : une panne
    // de base ne peut donc pas ouvrir la console.
    mocks.isMfaActiveForUser.mockResolvedValue(false);
    await expect(appRouter.createCaller(contextFor("systeme")).system.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("laisse passer quand la MFA est active", async () => {
    mocks.isMfaActiveForUser.mockResolvedValue(true);
    const payload = await appRouter.createCaller(contextFor("systeme")).system.overview();
    expect(payload).toMatchObject({ application: { name: "Lucepress Facturation" } });
  });
});

describe("Console — l’ENRÔLEMENT reste atteignable sans MFA", () => {
  it("un compte système non enrôlé lit son état, ouvre un enrôlement, le confirme", async () => {
    // Le verrou de la console est actif...
    mocks.isMfaActiveForUser.mockResolvedValue(false);
    const caller = appRouter.createCaller(contextFor("systeme"));
    await expect(caller.system.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });

    // ...et pourtant l’enrôlement répond : c’est ce qui permet de se mettre en
    // règle. Sans cette moitié, le compte serait enfermé dehors pour toujours.
    const statut = await caller.mfa.status();
    expect(statut).toEqual({ readable: true, enabled: false, pending: false, enrolledAt: null, recoveryCodesRemaining: 0 });

    const demarrage = await caller.mfa.enrollStart();
    expect(demarrage.secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(demarrage.otpauthUri.startsWith("otpauth://totp/")).toBe(true);

    const confirmation = await caller.mfa.enrollConfirm({ code: "123456" });
    expect(confirmation).toMatchObject({ success: true, recoveryCodes: ["A2C4E-7GH9K"] });
    // Les codes rendus sont PRÉSENTÉS groupés ; la base n’en garde que les empreintes.
    expect(mocks.confirmEnrollment).toHaveBeenCalledWith(42, "123456");
  });

  it("la MFA reste FACULTATIVE pour les autres rôles : chacun peut enrôler la sienne", async () => {
    for (const role of ["admin", "directeur", "cadre"]) {
      const caller = appRouter.createCaller(contextFor(role));
      await expect(caller.mfa.status()).resolves.toBeTruthy();
      await expect(caller.mfa.enrollStart()).resolves.toMatchObject({ issuer: "Lucepress" });
    }
  });

  it("refuse l’enrôlement à un visiteur non authentifié", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.mfa.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.mfa.enrollStart()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.mfa.disable({ code: "123456" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("traduit chaque motif de refus en message actionnable", async () => {
    mocks.confirmEnrollment.mockResolvedValue({ ok: false, reason: "aucun_enrolement" });
    await expect(appRouter.createCaller(contextFor("systeme")).mfa.enrollConfirm({ code: "123456" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Aucun enrôlement en cours"),
    });

    mocks.disableMfa.mockResolvedValue({ ok: false, reason: "code_incorrect" });
    await expect(appRouter.createCaller(contextFor("systeme")).mfa.disable({ code: "000000" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("Code refusé"),
    });

    mocks.startEnrollment.mockResolvedValue({ ok: false, reason: "indisponible" });
    await expect(appRouter.createCaller(contextFor("systeme")).mfa.enrollStart()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("indisponible"),
    });
  });
});

/* ------------------------------------------------------------------ */
/* 2. Le refus est MUET                                                */
/* ------------------------------------------------------------------ */

describe("Refus muet — l’intéressé n’apprend RIEN", () => {
  /** Mots qui trahiraient l’existence de l’espace protégé. */
  const MOTS_INTERDITS = ["console", "exploitation", "administration système", "systeme", "système", "réservé"];

  it("n’emploie aucun mot révélateur dans le message de refus de rôle", async () => {
    for (const role of ["admin", "cadre", "directeur", "client"]) {
      const refus = await appRouter
        .createCaller(contextFor(role))
        .system.overview()
        .then(
          () => null,
          (error: { message: string }) => error.message,
        );
      expect({ role, message: refus }).toEqual({ role, message: CONSOLE_REFUSED_ERR_MSG });
    }
    // Et le message lui-même est neutre.
    const message = CONSOLE_REFUSED_ERR_MSG.toLowerCase();
    for (const mot of MOTS_INTERDITS) {
      expect({ mot, present: message.includes(mot) }).toEqual({ mot, present: false });
    }
  });

  it("n’emploie aucun mot révélateur pour un visiteur anonyme non plus", async () => {
    await expect(appRouter.createCaller(anonymousContext()).system.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: CONSOLE_REFUSED_ERR_MSG,
    });
  });

  it("n’emploie aucun mot révélateur quand la MFA manque", () => {
    // Le motif doit dire CE QU’IL FAUT FAIRE (activer un second facteur) sans
    // nommer l’espace où il est exigé : le titulaire légitime n’a pas besoin de
    // ce mot, son interface l’oriente déjà.
    const message = CONSOLE_MFA_REQUIRED_ERR_MSG.toLowerCase();
    for (const mot of MOTS_INTERDITS) {
      expect({ mot, present: message.includes(mot) }).toEqual({ mot, present: false });
    }
    expect(message).toContain("deux facteurs");
  });
});

/* ------------------------------------------------------------------ */
/* 3. Le refus est JOURNALISÉ                                          */
/* ------------------------------------------------------------------ */

describe("Journal — silencieux pour l’intéressé, visible pour l’administrateur", () => {
  it("écrit une ligne structurée quand un rôle non habilité frappe la console", async () => {
    await appRouter
      .createCaller(contextFor("admin"))
      .system.overview()
      .catch(() => undefined);

    const lignes = journal.filter(ligne => ligne.includes("[console] tentative"));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toContain("motif=role_refuse");
    expect(lignes[0]).toContain("acteur=admin@lucepres.gn(id 42)");
    expect(lignes[0]).toContain("role=admin");
    expect(lignes[0]).toContain("tenant=1");
    // La procédure visée est nommée : c’est ce qui rend la ligne exploitable.
    expect(lignes[0]).toContain("cible=system.overview");
  });

  it("distingue une tentative anonyme d’un rôle refusé", async () => {
    await appRouter.createCaller(anonymousContext()).system.overview().catch(() => undefined);
    expect(journal.filter(ligne => ligne.includes("motif=anonyme"))).toHaveLength(1);
    expect(journal.some(ligne => ligne.includes("motif=role_refuse"))).toBe(false);
  });

  it("journalise l’absence de MFA chez un compte pourtant habilité", async () => {
    mocks.isMfaActiveForUser.mockResolvedValue(false);
    await appRouter.createCaller(contextFor("systeme")).system.overview().catch(() => undefined);

    const lignes = journal.filter(ligne => ligne.includes("motif=mfa_absente"));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toContain("role=systeme");
    expect(lignes[0]).toContain("acteur=systeme@lucepres.gn(id 42)");
  });

  it("journalise l’enrôlement, sans jamais y mettre un secret ni un code", async () => {
    const caller = appRouter.createCaller(contextFor("systeme"));
    await caller.mfa.enrollStart();
    await caller.mfa.enrollConfirm({ code: "123456" });

    const demarrage = journal.find(ligne => ligne.includes("motif=enrolement_demarre"));
    const confirme = journal.find(ligne => ligne.includes("motif=enrolement_confirme"));
    expect(demarrage).toBeTruthy();
    expect(confirme).toBeTruthy();

    // Ni le secret rendu, ni l’URI, ni le code présenté ne figurent au journal.
    for (const ligne of journal) {
      expect(ligne).not.toContain("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
      expect(ligne).not.toContain("otpauth://");
      expect(ligne).not.toContain("A2C4E7GH9K");
      expect(ligne).not.toContain("123456");
    }
  });

  it("ne répète pas la même tentative en boucle, sans jamais mentir", async () => {
    // Un client qui boucle écrirait des milliers de lignes identiques : on écrit
    // une fois par fenêtre et par (motif, cible, acteur).
    for (let index = 0; index < 25; index += 1) {
      await appRouter
        .createCaller(contextFor("cadre"))
        .system.overview()
        .catch(() => undefined);
    }
    expect(journal.filter(ligne => ligne.includes("motif=role_refuse"))).toHaveLength(1);
  });

  it("ne journalise que des champs fermés, et rien d’autre", () => {
    const lignes: string[] = [];
    logConsoleAttempt(
      {
        outcome: "role_refuse",
        target: "system.access",
        role: "admin",
        actor: "admin@lucepres.gn",
        actorId: 42,
        tenantId: 1,
      },
      { sink: ligne => lignes.push(ligne), now: () => 1_000 },
    );

    expect(lignes).toEqual([
      "[console] tentative — motif=role_refuse cible=system.access acteur=admin@lucepres.gn(id 42) role=admin tenant=1",
    ]);
    // Un acteur inconnu ne fait pas échouer la ligne : il est nommé « anonyme ».
    expect(formatConsoleAttempt({ outcome: "anonyme", target: "system.overview" })).toBe(
      "[console] tentative — motif=anonyme cible=system.overview acteur=anonyme(id ?) role=aucun tenant=?",
    );
    expect(CONSOLE_ATTEMPT_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it("ne laisse jamais un problème de journal faire échouer la requête", () => {
    const lignes: string[] = [];
    // Une destination qui explose : l’appel ne doit pas propager l’erreur.
    expect(() =>
      logConsoleAttempt({ outcome: "anonyme", target: "system.overview" }, {
        sink: () => {
          throw new Error("sortie standard indisponible");
        },
        now: () => 2_000,
      }),
    ).not.toThrow();
    // Et la fenêtre de déduplication est bien remise à zéro entre deux tests.
    logConsoleAttempt({ outcome: "anonyme", target: "system.overview" }, { sink: ligne => lignes.push(ligne), now: () => 3_000 });
    expect(lignes).toHaveLength(1);
  });

  it("journalise une tentative rapportée par le navigateur, sans entrée à falsifier", async () => {
    // Ce chemin comble le trou du refus rendu côté interface : sans lui, un
    // visiteur qui tape un chemin réservé dans sa barre d’adresse ne laissait
    // aucune trace, parce qu’aucune requête n’était émise.
    const reponse = await appRouter.createCaller(contextFor("admin")).system.reportRefusal();
    expect(reponse).toEqual({ success: true });

    const ligne = journal.find(entree => entree.includes("[console] tentative"));
    expect(ligne).toBeTruthy();
    expect(ligne).toContain("motif=role_refuse");
    // L’acteur vient de la session RÉSOLUE, jamais de la requête : il n’y a
    // d’ailleurs aucune entrée à présenter.
    expect(ligne).toContain("acteur=admin@lucepres.gn(id 42)");
    expect(ligne).toContain("cible=/console");

    // Visiteur anonyme : la tentative est nommée comme telle.
    resetConsoleAttemptLog();
    journal.length = 0;
    await appRouter.createCaller(anonymousContext()).system.reportRefusal();
    expect(journal.find(entree => entree.includes("motif=anonyme"))).toBeTruthy();
  });

  it("ne rend AUCUNE donnée : le témoin informe, il n’ouvre aucun droit", () => {
    const source = readFileSync(resolve(process.cwd(), "server/_core/systemRouter.ts"), "utf8");
    const debut = source.indexOf("reportRefusal: publicProcedure");
    expect(debut).toBeGreaterThan(-1);
    const corps = source.slice(debut, source.indexOf("}),", debut));
    // Aucun message, aucun libellé, aucun champ susceptible de renseigner
    // l’appelant sur l’espace qu’il vient de manquer.
    expect(corps).not.toMatch(/message\s*:/);
    expect(corps).toContain("return { success: true as const };");
    // Et elle est PUBLIQUE par construction : un visiteur anonyme doit pouvoir
    // signaler sa tentative, sinon la moitié du journal serait perdue.
    expect(corps).not.toContain("systemProcedure");
    expect(corps).not.toContain("protectedProcedure");
  });

  it("ne fabrique pas de fausse trace quand l’appelant n’a PAS été refusé", async () => {
    // Un compte réellement habilité (rôle système) n’a rien à signaler. Sans ce
    // garde-fou, n’importe qui pourrait se créer de fausses traces en appelant
    // la procédure à la main, et la ligne cesserait d’être une preuve.
    mocks.isMfaActiveForUser.mockResolvedValue(true);
    const reponse = await appRouter.createCaller(contextFor("systeme")).system.reportRefusal();
    expect(reponse).toEqual({ success: true });
    expect(journal.filter(entree => entree.includes("[console] tentative"))).toEqual([]);

    // Le même appel depuis un rôle NON habilité, lui, laisse une ligne.
    await appRouter.createCaller(contextFor("cadre")).system.reportRefusal();
    expect(journal.filter(entree => entree.includes("motif=role_refuse"))).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Le garde serveur est bien celui de la console                    */
/* ------------------------------------------------------------------ */

describe("Placement du verrou — sur la procédure, pas dans l’interface", () => {
  it("applique le rôle AVANT la MFA, et les deux sur systemProcedure", async () => {
    const source = systemProcedure as unknown as { _def?: unknown };
    // Une procédure composée : sa définition existe, et les deux verrous sont
    // enchaînés dans cet ordre (rôle d’abord : un compte non habilité ne fait
    // pas interroger la base sur son état MFA).
    expect(source).toBeTruthy();
    const trpcSource = (await import("node:fs")).readFileSync("server/_core/trpc.ts", "utf8");
    const declaration = trpcSource.indexOf("export const systemProcedure = t.procedure.use(");
    expect(declaration).toBeGreaterThan(-1);
    const roles = trpcSource.slice(declaration);
    expect(roles.indexOf("requireRoles(")).toBeLessThan(roles.indexOf("requireConsoleMfa"));
    // Le message de rôle est neutre dans le code aussi : aucune chaîne du dépôt
    // ne doit réintroduire « réservé à la console d’exploitation ».
    expect(trpcSource).not.toContain("Accès réservé à la console");
  });
});
