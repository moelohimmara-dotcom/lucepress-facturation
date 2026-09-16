import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSOLE_REFUSED_ERR_MSG, systemProcedure } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { CONSOLE_ATTEMPT_WINDOW_MS, formatConsoleAttempt, logConsoleAttempt, resetConsoleAttemptLog } from "./systemAccessLog";

/**
 * LA CONSOLE, CÔTÉ SERVEUR — LE RÔLE COMME SEUL VERROU, LA MFA COMME CHOIX.
 *
 * Deux règles s’y croisent, et il serait facile de n’en vérifier qu’une :
 *
 *  1. UN COMPTE `systeme` ENTRE DANS LA CONSOLE, MFA OU PAS. Le cahier des
 *     charges § 6 exigeait la double authentification pour ouvrir la console
 *     (étape B2) ; le propriétaire de l’instance a demandé le contraire — « je
 *     dois toujours avoir le choix de décider ». Le 403 ne frappe donc plus
 *     qu’un RÔLE non habilité, et `systemProcedure` ne consulte même plus
 *     l’état MFA : un test l’épingle en vérifiant que la lecture n’est JAMAIS
 *     appelée.
 *  2. CE COMPTE GARDE LA MAIN SUR SON SECOND FACTEUR. L’enrôlement, la
 *     confirmation, la lecture d’état et la désactivation restent ouverts sous
 *     `protectedProcedure` : c’est ce qui rend la MFA réellement facultative —
 *     disponible pour tous, imposée à personne.
 *
 * Et par-dessus les deux : LE REFUS EST MUET. Ni le message d’erreur, ni le
 * rendu de l’écran ne nomment l’espace protégé. La tentative est écrite dans le
 * journal du serveur — visible pour l’administrateur système, invisible pour
 * l’intéressé.
 *
 * `server/mfa.ts` est doublé ici : la mécanique MFA est prouvée sur le vrai
 * module dans `server/mfa.test.ts`, et les deux gestes de la console — activer
 * puis désactiver — sur ce même vrai module dans
 * `server/systemConsoleMfaOptional.test.ts`. Ce fichier-ci vérifie QUI passe,
 * QUI est refusé, et CE QUI EST ÉCRIT.
 */

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return {
    /**
     * Lecture d’état MFA du compte qui appelle. Elle est DOUBLÉE pour pouvoir
     * être SURVEILLÉE : depuis que la console n’exige plus la MFA, ce double
     * sert à prouver qu’elle n’est plus consultée du tout.
     */
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
/* 1. Le verrou : le rôle, et lui seul                                 */
/* ------------------------------------------------------------------ */

/**
 * Les cinq lectures de la console, appelées par un compte `systeme`. On ne
 * suppose PAS qu’elles aboutissent toutes : certaines interrogent une base qui
 * n’est pas configurée en test. Ce qui est prouvé ici est plus précis, et c’est
 * exactement la règle qui a changé : le refus de CONSOLE ne tombe plus.
 */
const LECTURES_CONSOLE: Array<{ nom: string; appeler: (caller: ReturnType<typeof appRouter.createCaller>) => Promise<unknown> }> = [
  { nom: "system.overview", appeler: caller => caller.system.overview() },
  { nom: "system.metrics", appeler: caller => caller.system.metrics() },
  { nom: "system.access", appeler: caller => caller.system.access() },
  { nom: "system.sessions.list", appeler: caller => caller.system.sessions.list() },
  { nom: "system.sessions.revoke", appeler: caller => caller.system.sessions.revoke({ id: 3 }) },
];

/** Issue d’un appel, succès comme échec, sans jamais lever : « ok » ou le code tRPC. */
async function issue(appel: () => Promise<unknown>): Promise<string> {
  try {
    await appel();
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "echec";
  }
}

describe("Console — rôle système SANS MFA : l’accès reste OUVERT", () => {
  beforeEach(() => {
    // Retournement : ce même double rendait `false` pour prouver le 403 ; il
    // rend désormais `false` pour prouver que RIEN ne change.
    mocks.isMfaActiveForUser.mockResolvedValue(false);
  });

  it("ouvre la console à un compte système non enrôlé", async () => {
    const payload = await appRouter.createCaller(contextFor("systeme")).system.overview();
    expect(payload).toMatchObject({ application: { name: "Lucepress Facturation" } });
  });

  it("n’oppose JAMAIS le refus de console sur les cinq procédures", async () => {
    const issues: string[] = [];
    for (const lecture of LECTURES_CONSOLE) {
      issues.push(await issue(() => lecture.appeler(appRouter.createCaller(contextFor("systeme")))));
    }
    // Aucune des cinq ne se heurte au garde. Un échec d’infrastructure
    // (`INTERNAL_SERVER_ERROR` sur la base absente, par exemple) n’est PAS un
    // refus d’accès et ne doit pas être confondu avec lui.
    expect(issues.filter(resultat => resultat === "FORBIDDEN")).toEqual([]);
    // Et la lecture qui ne dépend d’aucune base rend bien son résumé.
    expect(issues[0]).toBe("ok");
  });

  it("ne consulte même PLUS l’état MFA du compte", async () => {
    // C’est la preuve la plus directe du retrait de l’obligation : l’état du
    // second facteur n’est pas seulement ignoré, il n’est pas lu.
    await appRouter.createCaller(contextFor("systeme")).system.overview();
    expect(mocks.isMfaActiveForUser).not.toHaveBeenCalled();
  });

  it("se comporte à l’IDENTIQUE, MFA active ou non", async () => {
    // Contrôle croisé : la seule chose qui change entre les deux séries est la
    // valeur du double MFA. Si un résultat différait, c’est que la MFA
    // discriminerait encore quelque chose.
    const appels = LECTURES_CONSOLE.map(lecture => () => lecture.appeler(appRouter.createCaller(contextFor("systeme"))));

    mocks.isMfaActiveForUser.mockResolvedValue(false);
    const sansMfa: string[] = [];
    for (const appel of appels) sansMfa.push(await issue(appel));

    mocks.isMfaActiveForUser.mockResolvedValue(true);
    const avecMfa: string[] = [];
    for (const appel of appels) avecMfa.push(await issue(appel));

    expect(sansMfa).toEqual(avecMfa);
  });

  it("laisse passer quand la MFA est active — comme avant, et comme sans elle", async () => {
    mocks.isMfaActiveForUser.mockResolvedValue(true);
    const payload = await appRouter.createCaller(contextFor("systeme")).system.overview();
    expect(payload).toMatchObject({ application: { name: "Lucepress Facturation" } });
  });

  it("refuse en 403 TOUT rôle autre que système, MFA active ou non", async () => {
    for (const role of ["admin", "directeur", "cadre", "client"]) {
      for (const active of [false, true]) {
        mocks.isMfaActiveForUser.mockResolvedValue(active);
        for (const lecture of LECTURES_CONSOLE) {
          await expect(lecture.appeler(appRouter.createCaller(contextFor(role)))).rejects.toMatchObject({
            code: "FORBIDDEN",
            message: CONSOLE_REFUSED_ERR_MSG,
          });
        }
      }
    }
  });
});

describe("Console — l’ENRÔLEMENT reste atteignable, et il est le seul chemin", () => {
  it("un compte système non enrôlé lit son état, ouvre un enrôlement, le confirme", async () => {
    // Retournement : ce test commençait par constater un 403 sur `overview`.
    // La console est désormais ouverte dans les deux cas, et la gestion de la
    // MFA reste exactement le même chemin — c’est ce qui rend le choix réel :
    // disponible pour s’enrôler, disponible pour se dé-enrôler.
    mocks.isMfaActiveForUser.mockResolvedValue(false);
    const caller = appRouter.createCaller(contextFor("systeme"));
    await expect(caller.system.overview()).resolves.toMatchObject({ application: { name: "Lucepress Facturation" } });

    // ...et l’enrôlement répond, comme avant.
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

  it("ACTIVE puis DÉSACTIVE la MFA depuis la console, sans jamais fermer l’accès", async () => {
    // AJOUTÉ — c’est le geste que la décision rend possible : le titulaire du
    // compte décide, dans les deux sens. Les procédures sont celles de la
    // console, et l’état relu auprès du serveur suit à chaque étape ; la
    // mécanique TOTP elle-même (secret chiffré, anti-rejeu, codes de secours)
    // est prouvée sur le VRAI module dans `server/mfa.test.ts`.
    const caller = appRouter.createCaller(contextFor("systeme"));

    // 1. Rien n’est actif.
    mocks.readMfaState.mockResolvedValue(ETAT_SANS_MFA);
    await expect(caller.mfa.status()).resolves.toMatchObject({ enabled: false, pending: false });

    // 2. Activation : secret, puis premier code.
    const demarrage = await caller.mfa.enrollStart();
    expect(demarrage.otpauthUri.startsWith("otpauth://totp/")).toBe(true);
    const activation = await caller.mfa.enrollConfirm({ code: "123456" });
    expect(activation.success).toBe(true);
    expect(mocks.confirmEnrollment).toHaveBeenCalledWith(42, "123456");
    // Les codes de secours sont rendus groupés, une seule fois.
    expect(activation.recoveryCodes).toEqual(["A2C4E-7GH9K"]);

    // 3. L’état a suivi — c’est la RELECTURE serveur qui le dit, pas un drapeau.
    mocks.readMfaState.mockResolvedValue({
      readable: true,
      enabled: true,
      pending: false,
      enrolledAt: new Date("2026-09-16T10:00:00.000Z"),
      recoveryCodesRemaining: 10,
    });
    await expect(caller.mfa.status()).resolves.toEqual({
      readable: true,
      enabled: true,
      pending: false,
      enrolledAt: "2026-09-16T10:00:00.000Z",
      recoveryCodesRemaining: 10,
    });

    // 4. Désactivation, sur un code valide. Le code part TEL QUEL : c’est
    //    l’interface qui normalise un code de secours (tirets, minuscules) avant
    //    de l’envoyer, et le serveur vérifie ce qu’on lui présente.
    const desactivation = await caller.mfa.disable({ code: "ABCDEFGHIJ" });
    expect(desactivation).toMatchObject({ success: true });
    expect(mocks.disableMfa).toHaveBeenCalledWith(42, "ABCDEFGHIJ");

    // 5. Retour à l’état initial, et la console est restée accessible à CHAQUE
    //    étape : rien de tout cela ne ferme ni n’ouvre l’espace protégé.
    mocks.readMfaState.mockResolvedValue(ETAT_SANS_MFA);
    await expect(caller.mfa.status()).resolves.toMatchObject({ enabled: false });
    await expect(caller.system.overview()).resolves.toMatchObject({ application: { name: "Lucepress Facturation" } });
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

  it("ne promet plus aucun refus lié à la MFA — ni en base, ni dans le garde", () => {
    // Retournement : ce test épinglait le message « Authentification à deux
    // facteurs requise… », qui ne nommait rien mais ANNONÇAIT une obligation.
    // Cette obligation n’existe plus : le garde de la console ne doit donc plus
    // porter ni le middleware, ni le message. On le prouve sur la source, parce
    // que c’est le seul endroit où une règle retirée peut survivre par
    // inadvertance — un texte oublié, un verrou laissé en place.
    const trpcSource = readFileSync(resolve(process.cwd(), "server/_core/trpc.ts"), "utf8");
    expect(trpcSource).not.toContain("requireConsoleMfa");
    expect(trpcSource).not.toContain("CONSOLE_MFA_REQUIRED_ERR_MSG");
    expect(trpcSource).not.toContain("deux facteurs requise");
    // Et le vocabulaire du journal ne conserve pas non plus de motif
    // « mfa_absente » : un motif que plus rien n’émet ferait croire à un refus
    // qui n’a pas eu lieu.
    expect(readFileSync(resolve(process.cwd(), "server/systemAccessLog.ts"), "utf8")).not.toContain("mfa_absente");
    // Ce qui subsiste EST muet : le seul refus que la console oppose encore.
    expect(CONSOLE_REFUSED_ERR_MSG).toBe("Accès refusé.");
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

  it("n’écrit AUCUNE ligne quand un compte habilité entre sans MFA", async () => {
    // Retournement : ce test vérifiait qu’un compte `systeme` sans MFA laissait
    // une ligne « mfa_absente ». Il n’y a plus rien à signaler — ce compte
    // n’est pas refusé, il entre : journaliser une absence de MFA ferait passer
    // un droit pour une anomalie, et noierait les vrais refus.
    mocks.isMfaActiveForUser.mockResolvedValue(false);
    await appRouter.createCaller(contextFor("systeme")).system.overview();

    expect(journal.filter(ligne => ligne.includes("[console] tentative"))).toEqual([]);
    expect(journal.some(ligne => ligne.includes("mfa_absente"))).toBe(false);
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
    // Un compte réellement habilité (rôle système) n’a rien à signaler — avec
    // ou sans second facteur : c’est le RÔLE qui ouvre la console. Sans ce
    // garde-fou, n’importe qui pourrait se créer de fausses traces en appelant
    // la procédure à la main, et la ligne cesserait d’être une preuve.
    mocks.isMfaActiveForUser.mockResolvedValue(false);
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
  it("n’applique plus QUE le rôle sur systemProcedure", async () => {
    const source = systemProcedure as unknown as { _def?: unknown };
    // La procédure existe toujours, et c’est un garde COMPOSÉ : sa définition
    // porte bien le middleware de rôles.
    expect(source).toBeTruthy();
    const trpcSource = (await import("node:fs")).readFileSync("server/_core/trpc.ts", "utf8");
    const declaration = trpcSource.indexOf("export const systemProcedure = t.procedure.use(");
    expect(declaration).toBeGreaterThan(-1);

    const roles = trpcSource.slice(declaration);
    expect(roles).toContain("requireRoles(");
    // Retournement : le second maillon (`requireConsoleMfa`) est retiré, et le
    // maillon de rôle n’est plus suivi d’un `.use(...)` — un verrou ajouté par
    // inadvertance derrière le rôle se verrait ici.
    expect(roles).not.toContain("requireConsoleMfa");
    const apresRoles = roles.slice(roles.indexOf("requireRoles("));
    expect(apresRoles.slice(0, apresRoles.indexOf(";"))).not.toContain(".use(");

    // Le rôle est TOUJOURS le seul autorisé : la liste ne s’est pas élargie.
    expect(apresRoles.startsWith('requireRoles(["systeme"]')).toBe(true);
    // Le message de refus reste neutre dans le code aussi : aucune chaîne du
    // dépôt ne doit réintroduire « réservé à la console d’exploitation ».
    expect(trpcSource).not.toContain("Accès réservé à la console");
  });
});
