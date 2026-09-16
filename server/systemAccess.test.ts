import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  SystemAccessPanel,
  accountDisplayName,
  accessVerdict,
  formatAccessDate,
  isPortalAccount,
  type ConsoleAccess,
} from "../client/src/components/SystemAccess";
import { APP_ROLES } from "../shared/roles";
import { appRouter } from "./routers";
import { ACCESS_MEANS, PASSWORD_POLICY, collectSystemAccess } from "./systemAccess";
import type { TrpcContext } from "./_core/context";

/** Lecture directe des sources : prouve l’absence de secret et l’absence de DDL. */
const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * ÉTAPE B2 — le compte système de ces tests porte une MFA ACTIVE.
 *
 * `systemProcedure` exige désormais le rôle `systeme` ET une double
 * authentification active ; sans ce double, `system.access` recevrait 403. Les
 * deux sens du verrou sont prouvés dans `server/systemConsoleMfa.test.ts` ; ici,
 * on isole la lecture des accès, qui est le sujet de ce fichier.
 */
vi.mock("./mfa", async importOriginal => {
  const actual = await importOriginal<typeof import("./mfa")>();
  return { ...actual, isMfaActiveForUser: vi.fn(async () => true) };
});

/** Tous les fichiers `.ts` du serveur, pour prouver une absence par balayage. */
function listServerSources(dossier = "server"): string[] {
  return readdirSync(resolve(process.cwd(), dossier), { withFileTypes: true }).flatMap(entree => {
    const chemin = `${dossier}/${entree.name}`;
    if (entree.isDirectory()) return listServerSources(chemin);
    return entree.name.endsWith(".ts") ? [chemin] : [];
  });
}

function contextFor(role: string): TrpcContext {
  return {
    user: {
      id: 7,
      openId: `staff-${role}`,
      name: `Compte ${role}`,
      email: `${role}@example.com`,
      loginMethod: "email",
      role,
      createdAt: new Date("2026-01-05T08:00:00.000Z"),
      updatedAt: new Date("2026-01-05T08:00:00.000Z"),
      lastSignedIn: new Date("2026-09-15T19:30:00.000Z"),
    },
    tenantId: 1,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

function anonymousContext(): TrpcContext {
  return {
    user: null,
    tenantId: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

/** Chemins de toutes les clés d’une structure, pour épingler la forme d’une réponse. */
function collectKeys(value: unknown, chemin = "", cumul = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach(item => collectKeys(item, chemin, cumul));
    return cumul;
  }
  if (value && typeof value === "object") {
    for (const [cle, nested] of Object.entries(value)) {
      const cheminComplet = chemin ? `${chemin}.${cle}` : cle;
      cumul.add(cheminComplet);
      collectKeys(nested, cheminComplet, cumul);
    }
  }
  return cumul;
}

/** Relevé type d’une instance peuplée : sert aux rendus statiques. */
function accessFixture(overrides: Partial<ConsoleAccess> = {}): ConsoleAccess {
  const accounts: ConsoleAccess["accounts"] = [
    { id: 1, name: "Aïssatou Bah", email: "a.bah@lucepres.gn", role: "admin", mfaEnabled: false, lastSignedIn: "2026-09-15T19:30:00.000Z", createdAt: "2026-01-05T08:00:00.000Z" },
    { id: 2, name: "Mamadou Diallo", email: "m.diallo@lucepres.gn", role: "cadre", mfaEnabled: false, lastSignedIn: "2026-09-14T07:10:00.000Z", createdAt: "2026-02-11T09:00:00.000Z" },
    { id: 3, name: null, email: "direction@lucepres.gn", role: "directeur", mfaEnabled: false, lastSignedIn: "2026-09-12T16:45:00.000Z", createdAt: "2026-03-02T10:20:00.000Z" },
    // Le compte système porte la MFA : c’est l’exigence de la console (§ 6).
    { id: 4, name: null, email: "systeme@lucepres.gn", role: "systeme", mfaEnabled: true, lastSignedIn: "2026-09-16T06:00:00.000Z", createdAt: "2026-04-01T11:00:00.000Z" },
    { id: 5, name: "Chantier Kamsar", email: "travaux@kamsar.gn", role: "client", mfaEnabled: false, lastSignedIn: "2026-09-10T12:00:00.000Z", createdAt: "2026-05-20T13:30:00.000Z" },
  ];
  const roleCounts = APP_ROLES.map(role => ({
    role,
    label: role,
    count: accounts.filter(account => account.role === role).length,
  }));
  return {
    generatedAt: "2026-09-16T07:45:00.000Z",
    scope: "tenant",
    accounts,
    accountsTotal: accounts.length,
    roleCounts,
    invitations: {
      total: 3,
      byRole: APP_ROLES.map(role => ({ role, label: role, count: role === "cadre" ? 3 : 0 })),
    },
    accessMeans: ACCESS_MEANS,
    passwordPolicy: PASSWORD_POLICY,
    unavailable: [],
    ...overrides,
  };
}

describe("system.access — contrôle serveur de la console", () => {
  it("répond au rôle système avec un relevé sérialisable", async () => {
    const payload = await appRouter.createCaller(contextFor("systeme")).system.access();

    expect(Object.keys(payload).sort()).toEqual([
      "accessMeans",
      "accounts",
      "accountsTotal",
      "generatedAt",
      "invitations",
      "passwordPolicy",
      "roleCounts",
      "scope",
      "unavailable",
    ]);
    expect(payload.scope).toBe("tenant");
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(payload.accounts)).toBe(true);
    expect(typeof payload.accountsTotal).toBe("number");
    expect(payload.roleCounts).toHaveLength(APP_ROLES.length);
    expect(payload.accessMeans).toHaveLength(4);
    expect(payload.passwordPolicy.minLength).toBe(8);
    // Sérialisable tel quel : aucune date non convertie, aucune structure exotique.
    expect(() => JSON.stringify(payload)).not.toThrow();
  });

  it("refuse l’admin en 403, comme tout rôle non système", async () => {
    // RETOURNÉ — `system.access` répondait à l’admin (croisement explicite) :
    // la revue d’accès de l’instance est désormais inaccessible à l’admin.
    await expect(appRouter.createCaller(contextFor("admin")).system.access()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuse tous les rôles non habilités en 403", async () => {
    for (const role of ["admin", "cadre", "directeur", "client"]) {
      await expect(appRouter.createCaller(contextFor(role)).system.access()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("refuse un visiteur non authentifié", async () => {
    await expect(appRouter.createCaller(anonymousContext()).system.access()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("ne transmet aucun secret : liste blanche des clés, liste noire des valeurs", async () => {
    const payload = await appRouter.createCaller(contextFor("systeme")).system.access();

    // 1. Aucune clé hors de celles annoncées : `passwordHash`, `tokenHash`,
    //    `mfaSecret`… ne peuvent pas se glisser dans une réponse dont la forme
    //    est épinglée ici.
    //
    //    Sans base joignable, la liste des comptes est VIDE : la forme d’un
    //    compte (dont `mfaEnabled`, ajouté à l’étape B2) est épinglée par le
    //    test de projection des lignes, plus bas. Ici, on épingle la forme de la
    //    RÉPONSE — et l’absence de tout nom de colonne sensible.
    expect([...collectKeys(payload)].sort()).toEqual(
      [
        "accessMeans",
        "accessMeans.available",
        "accessMeans.detail",
        "accessMeans.key",
        "accessMeans.label",
        "accounts",
        "accountsTotal",
        "generatedAt",
        "invitations",
        "passwordPolicy",
        "passwordPolicy.complexity",
        "passwordPolicy.enforcedBy",
        "passwordPolicy.hashing",
        "passwordPolicy.hashing.algorithm",
        "passwordPolicy.hashing.comparison",
        "passwordPolicy.hashing.implementation",
        "passwordPolicy.hashing.keyBytes",
        "passwordPolicy.hashing.saltBytes",
        "passwordPolicy.hashing.storedFormat",
        "passwordPolicy.maxLength",
        "passwordPolicy.minLength",
        "passwordPolicy.protections",
        "passwordPolicy.resetLinkTtlMinutes",
        "roleCounts",
        "roleCounts.count",
        "roleCounts.label",
        "roleCounts.role",
        "scope",
        "unavailable",
      ].sort(),
    );

    // 2. Aucun nom de colonne sensible, à aucun niveau d’imbrication. Le
    //    sous-arbre `passwordPolicy.hashing` est légitime : il décrit la RÈGLE
    //    (sel, longueur de clé), il ne porte aucune valeur de compte.
    const cles = [...collectKeys(payload)];
    for (const interdite of ["passwordHash", "tokenHash", "mfaSecret", "mfaSecretCipher", "mfaRecoveryCodes", "recoveryCodes", "secret", "token"]) {
      expect(cles).not.toContain(interdite);
    }
    expect(cles.filter(cle => /(passwordHash|tokenHash|mfaSecret|recoveryCodes|recovery)/i.test(cle))).toEqual([]);
    expect(cles.some(cle => cle.endsWith(".salt") || cle.endsWith(".hash"))).toBe(false);

    // 3. Aucune VALEUR ne ressemble à une empreinte `salt:hash` (scrypt : 32
    //    caractères hexadécimaux de sel, 128 de clé).
    const empreinteScrypt = /^[0-9a-f]{16,64}:[0-9a-f]{64,}$/;
    const valeurs: string[] = [];
    const collectStrings = (value: unknown): void => {
      if (typeof value === "string") valeurs.push(value);
      else if (Array.isArray(value)) value.forEach(collectStrings);
      else if (value && typeof value === "object") Object.values(value).forEach(collectStrings);
    };
    collectStrings(payload);
    expect(valeurs.filter(valeur => empreinteScrypt.test(valeur))).toEqual([]);
    expect(valeurs.some(valeur => valeur.startsWith("postgres://") || valeur.startsWith("postgresql://"))).toBe(false);
  });

  it("n’invente aucun compte quand la base est injoignable", async () => {
    const payload = await appRouter.createCaller(contextFor("systeme")).system.access();

    // Sans DATABASE_URL, aucune lecture n’aboutit : on l’annonce, on ne comble pas.
    expect(payload.accounts).toEqual([]);
    expect(payload.accountsTotal).toBe(0);
    expect(payload.invitations).toBeNull();
    expect(payload.unavailable).toEqual(expect.arrayContaining(["accounts", "invitations"]));
    expect(payload.roleCounts.every(entry => entry.count === 0)).toBe(true);
    // Les moyens d’accès et la politique restent renseignés : ils décrivent le code.
    expect(payload.accessMeans.length).toBeGreaterThan(0);
    expect(payload.passwordPolicy.hashing.algorithm).toContain("scrypt");
  });
});

describe("collectSystemAccess — lecture des lignes", () => {
  it("ne lit rien sans tenant : aucun repli inter-tenant", async () => {
    let called = false;
    const payload = await collectSystemAccess({
      tenantId: undefined,
      runQuery: async () => {
        called = true;
        return [];
      },
    });

    expect(called).toBe(false);
    expect(payload.accounts).toEqual([]);
    expect(payload.invitations).toBeNull();
    expect(payload.unavailable).toEqual(["accounts", "invitations"]);
  });

  it("filtre la lecture des comptes par tenant et n’y fait entrer aucun secret", () => {
    const source = readSource("server/systemAccess.ts");
    const select = source.slice(source.indexOf("async function loadAccounts"), source.indexOf("async function loadPendingInvitations"));

    expect(select).toContain('where "tenantId" = ${tenantId}');
    expect(select).not.toContain("passwordHash");
    expect(select).not.toContain("loginMethod");
    expect(select).not.toContain("openId");
    // `select *` ramènerait tout, y compris le hash : on exige une liste explicite.
    expect(select).not.toMatch(/select\s+\*/i);
    for (const colonne of ["id", "name", "email", "role", "lastSignedIn", "createdAt"]) {
      expect(select).toContain(colonne);
    }
  });

  it("agrège les invitations par rôle, sans jeton ni adresse", () => {
    const source = readSource("server/systemAccess.ts");
    const select = source.slice(source.indexOf("async function loadPendingInvitations"));

    expect(select).toContain('where "tenantId" = ${tenantId} and status = \'pending\'');
    expect(select).toContain("group by role");
    expect(select).not.toContain("tokenHash");
    expect(select).not.toMatch(/select\s+\*/i);
    // La raison est écrite dans le module ET rappelée à l’écran.
    expect(source).toContain("Aucun jeton, aucune adresse");
    expect(readSource("client/src/components/SystemAccess.tsx")).toContain("ni jeton d’invitation, ni adresse e-mail");
  });

  it("convertit les lignes lues en comptes et en décomptes exploitables", async () => {
    const accountRows = [
      { id: 1, name: "Aïssatou Bah", email: "a@lucepres.gn", role: "admin", mfaEnabled: true, lastSignedIn: "2026-09-15T19:30:00.000Z", createdAt: "2026-01-05T08:00:00.000Z" },
      { id: 2, name: null, email: null, role: "client", mfaEnabled: false, lastSignedIn: null, createdAt: new Date("2026-05-20T13:30:00.000Z") },
    ];
    const invitationRows = [{ role: "cadre", count: "3" }];
    const queries: string[] = [];

    const payload = await collectSystemAccess({
      tenantId: 1,
      now: () => new Date("2026-09-16T07:45:00.000Z"),
      runQuery: async () => {
        const index = queries.length;
        queries.push(index === 0 ? "accounts" : "invitations");
        return index === 0 ? accountRows : invitationRows;
      },
    });

    expect(queries).toEqual(["accounts", "invitations"]);
    expect(payload.generatedAt).toBe("2026-09-16T07:45:00.000Z");
    expect(payload.accountsTotal).toBe(2);
    expect(payload.accounts[0]).toEqual({
      id: 1,
      name: "Aïssatou Bah",
      email: "a@lucepres.gn",
      role: "admin",
      // ÉTAPE B2 — booléen lu dans la même requête que le compte.
      mfaEnabled: true,
      lastSignedIn: "2026-09-15T19:30:00.000Z",
      createdAt: "2026-01-05T08:00:00.000Z",
    });
    // Une date native est convertie en ISO, un champ vide reste `null` (jamais "").
    expect(payload.accounts[1]).toEqual({
      id: 2,
      name: null,
      email: null,
      role: "client",
      mfaEnabled: false,
      lastSignedIn: null,
      createdAt: "2026-05-20T13:30:00.000Z",
    });
    expect(payload.roleCounts.find(entry => entry.role === "admin")?.count).toBe(1);
    expect(payload.roleCounts.find(entry => entry.role === "client")?.count).toBe(1);
    expect(payload.roleCounts.find(entry => entry.role === "cadre")?.count).toBe(0);
    // `count(*)` revient en chaîne (bigint) : la conversion doit être faite.
    expect(payload.invitations?.total).toBe(3);
    expect(payload.invitations?.byRole.find(entry => entry.role === "cadre")?.count).toBe(3);
    expect(payload.unavailable).toEqual([]);
  });

  it("signale chaque mesure illisible sans faire échouer le relevé", async () => {
    const payload = await collectSystemAccess({
      tenantId: 1,
      runQuery: async () => {
        throw new Error("échec simulé");
      },
    });

    expect(payload.unavailable).toEqual(["accounts", "invitations"]);
    expect(payload.accounts).toEqual([]);
    expect(payload.invitations).toBeNull();
  });
});

describe("Politique de mot de passe — alignement avec le code réel", () => {
  const routers = readSource("server/routers.ts");
  const passwordModule = readSource("server/_core/password.ts");
  const dbModule = readSource("server/db.ts");

  it("annonce les bornes réellement imposées par les schémas zod", () => {
    expect(PASSWORD_POLICY.minLength).toBe(8);
    expect(PASSWORD_POLICY.maxLength).toBe(128);

    // Compte des champs de MOT DE PASSE soumis à la règle (`token:` porte la même
    // borne mais n’est pas un mot de passe : on ne le compte pas).
    const champs = routers
      .split("\n")
      .filter(ligne => /(password|newPassword):\s*z\.string\(\)\.min\(8\)\.max\(128\)/.test(ligne));
    expect(champs).toHaveLength(PASSWORD_POLICY.enforcedBy.length);
    expect(champs.length).toBeGreaterThanOrEqual(5);
  });

  it("cite exactement les procédures qui imposent la règle", () => {
    for (const procedure of PASSWORD_POLICY.enforcedBy) {
      const nom = procedure.split(".").pop() as string;
      expect(routers).toContain(`${nom}:`);
    }
    expect(PASSWORD_POLICY.enforcedBy).toContain("auth.changePassword");
    expect(PASSWORD_POLICY.enforcedBy).toContain("users.resetPassword");
  });

  it("décrit le hachage paramètre par paramètre, sans approximation", () => {
    expect(passwordModule).toContain("scrypt");
    expect(passwordModule).toContain("KEYLEN = 64");
    expect(passwordModule).toContain("SALT_BYTES = 16");
    expect(passwordModule).toContain("timingSafeEqual");
    expect(passwordModule).toContain("`${salt}:${derived.toString(\"hex\")}`");

    expect(PASSWORD_POLICY.hashing.algorithm).toContain("scrypt");
    expect(PASSWORD_POLICY.hashing.saltBytes).toBe(16);
    expect(PASSWORD_POLICY.hashing.keyBytes).toBe(64);
    expect(PASSWORD_POLICY.hashing.comparison).toContain("temps constant");
    expect(PASSWORD_POLICY.hashing.implementation).toBe("server/_core/password.ts");
  });

  it("avoue l’absence de règle de complexité au lieu de la laisser supposer", () => {
    expect(PASSWORD_POLICY.complexity).toBeNull();
    expect(PASSWORD_POLICY.protections.join(" ")).toContain("loginRateLimit");
  });

  it("aligne la durée du lien de réinitialisation sur la constante du code", () => {
    expect(dbModule).toContain("export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;");
    expect(PASSWORD_POLICY.resetLinkTtlMinutes).toBe(60);
  });
});

describe("Moyens d’accès — état réel, jamais supposé", () => {
  it("annonce le mot de passe, la MFA et la révocation de session comme disponibles", () => {
    const parCle = new Map(ACCESS_MEANS.map(mean => [mean.key, mean]));

    expect(parCle.get("password")?.available).toBe(true);
    // ÉTAPE B2 — la MFA n’est plus « à livrer » : elle est en service. Le
    // descripteur devait suivre, sous peine d’annoncer au propriétaire de
    // l’instance une protection qui existe déjà.
    expect(parCle.get("mfa")?.available).toBe(true);
    expect(parCle.get("mfa")?.detail).toContain("TOTP");
    expect(parCle.get("mfa")?.detail).toContain("Exigée pour ouvrir la console");
    // La formulation doit rester honnête sur le périmètre : exigée pour la
    // console, facultative ailleurs.
    expect(parCle.get("mfa")?.detail).toContain("facultative");
    expect(parCle.get("mfa")?.detail).not.toContain("Non implémentée");
    expect(parCle.get("sso")?.available).toBe(false);
    // Étape B1 : les sessions sont désormais listables et révocables.
    expect(parCle.get("sessions")?.available).toBe(true);
    expect(parCle.get("sessions")?.detail).toContain("Sessions actives");
    expect(parCle.get("sessions")?.detail).not.toContain("migration requise");
  });

  it("prouve l’absence de SSO par le code de connexion, pas par une déclaration", () => {
    const context = readSource("server/_core/context.ts");

    // 1. La session est vérifiée par le SEUL jeton local, et le compte est
    //    relu en base avant d’être accordé.
    expect(context).toContain('import { verifyLocalSession } from "./localAuth";');
    expect(context).toContain("let user: User | null = null;");
    // Le compte est toujours relu en base ; depuis l’étape B1 cette lecture est
    // menée EN PARALLÈLE du contrôle de révocation (`Promise.all`), d’où
    // l’absence du mot-clé `await` juste devant l’appel.
    expect(context).toContain("db.getUserByOpenId(session.openId)");
    expect(context).not.toContain("authenticateRequest");
    expect(context).not.toContain("oauthService");
    expect(context).not.toContain('from "./sdk"');

    // 2. Le service OAuth historique n’est appelé par aucune partie du serveur
    //    qui touche à l’authentification des requêtes. On balaie tout `server/`
    //    hors tests : si un module d’exécution se remettait à l’importer, ce test
    //    échouerait — c’est exactement le décalage à surveiller.
    const fichiers = listServerSources();
    const consommateurs = fichiers
      .filter(chemin => !chemin.endsWith(".test.ts"))
      .filter(chemin => readFileSync(resolve(process.cwd(), chemin), "utf8").includes("_core/sdk"))
      .map(chemin => chemin.replace(/\\/g, "/").split("/").pop() as string)
      .filter(nom => nom !== "sdk.ts")
      .sort();

    expect(consommateurs).toEqual(["clientAttachments.ts", "projectCostAttachments.ts"]);
  });

  it("ne remonte que des booléens et des libellés, aucun paramètre de connexion", () => {
    for (const mean of ACCESS_MEANS) {
      expect(typeof mean.available).toBe("boolean");
      expect(mean.label.length).toBeGreaterThan(0);
      expect(mean.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("Étape A — aucune écriture, aucun DDL", () => {
  const source = readSource("server/systemAccess.ts");
  const router = readSource("server/_core/systemRouter.ts");

  it("n’émet que des lectures", () => {
    expect(source).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\b\s+(into|table|from)?/i);
    expect(source).not.toContain("db.insert");
    expect(source).not.toContain("db.update");
    expect(source).not.toContain("db.delete");
    expect((source.match(/\bselect\b/gi) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("déclare la procédure d’accès sous le garde de la console", () => {
    expect(router).toContain("access: systemProcedure.query");
    expect(router).toContain("collectSystemAccess");
    expect(router).not.toMatch(/access:\s*(publicProcedure|protectedProcedure|adminProcedure|staffProcedure)/);
  });

  it("n’expose aucune requête SQL hors du dossier docs/sql", () => {
    // Les seuls fichiers .sql du dépôt vivant dans `server/` sont des migrations
    // Drizzle historiques ; ce module n’en ajoute aucune.
    expect(source.toLowerCase()).not.toContain(".sql");
  });
});

describe("Rendu statique — écran Accès & comptes", () => {
  it("affiche les comptes, les rôles et la répartition", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
    );

    expect(html).toContain("Accès &amp; comptes");
    expect(html).toContain("Consultation seule");
    expect(html).toContain("Aïssatou Bah");
    expect(html).toContain("a.bah@lucepres.gn");
    expect(html).toContain("Chantier Kamsar");
    expect(html).toContain("Répartition par rôle");
    expect(html).toContain("Comptes de l’instance");
    expect(html).toContain("5 compte(s)");
    expect(html).toContain("Accès cloisonné aux documents partagés");
    // Le portail est distingué à l’affichage (badge dédié).
    expect(html).toContain('data-testid="access-role-client"');
    // Chaque ligne de compte est adressable par un test.
    expect(html).toContain('data-testid="access-account-1"');
    expect(html).toContain('data-testid="access-account-5"');
  });

  it("annonce l’état réel des moyens d’accès, MFA et révocation comprises", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
    );

    expect(html).toContain("Moyens d’accès &amp; de session");
    expect(html).toContain("MFA / TOTP");
    // ÉTAPE B2 — la MFA est en service : l’écran ne peut plus dire l’inverse.
    expect(html).not.toContain("Non implémentée");
    expect(html).toContain("Exigée pour ouvrir la console");
    expect(html).toContain("Non disponible");
    expect(html).toContain("Disponible");
    // Étape B1 : l’écran ne prétend plus que les sessions sont irrévocables ; il
    // renvoie vers l’écran qui les révoque, et il le fait sans mentir sur le sien.
    expect(html).toContain("révocables");
    expect(html).toContain("Sessions actives");
    expect(html).not.toContain("aucune session ne peut être révoquée");
    // Un seul moyen indisponible (SSO) + trois disponibles (mot de passe, MFA,
    // sessions) : le décompte doit tomber juste.
    expect((html.match(/Non disponible/g) ?? []).length).toBe(1);
    expect((html.match(/>Disponible</g) ?? []).length).toBe(3);
  });

  it("affiche l’état MFA de chaque compte, en booléen et sans secret", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
    );

    expect(html).toContain("Second facteur");
    // Le compte système du relevé porte la MFA ; les autres non.
    expect(html).toContain('data-testid="access-mfa-4"');
    expect(html).toContain("MFA active");
    expect(html).toContain("MFA inactive");
    expect((html.match(/MFA active/g) ?? []).length).toBe(1);
    // Ni secret, ni empreinte de code de secours dans le rendu.
    expect(html).not.toMatch(/[A-Z2-7]{16,}/);
    expect(html).not.toMatch(/[a-f0-9]{32}:[a-f0-9]{64}/);
  });

  it("affiche la politique de mot de passe réellement appliquée", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
    );

    expect(html).toContain("Politique de mot de passe");
    expect(html).toContain("8 à 128 caractères");
    expect(html).toContain("scrypt");
    expect(html).toContain("16 octets de sel · clé de 64 octets");
    expect(html).toContain("aucune exigence imposée");
    expect(html).toContain("60 min");
    expect(html).toContain("loginRateLimit");
    // Aucune empreinte ni aucun mot de passe ne doit apparaître dans le rendu.
    expect(html).not.toContain("passwordHash");
    expect(html).not.toContain("tokenHash");
  });

  it("affiche les invitations sans jamais exposer de jeton", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
    );

    expect(html).toContain("Invitations en attente");
    expect(html).toContain("Rôle visé");
    expect(html).toContain("ni jeton d’invitation, ni adresse e-mail");
    expect(html).not.toContain("token");
  });

  it("n’affiche aucun zéro à la place d’une mesure indisponible", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture({ accounts: [], accountsTotal: 0, invitations: null, unavailable: ["invitations"] }),
        failed: false,
        isLoading: false,
      }),
    );

    expect(html).toContain("Comptage indisponible");
    expect(html).toContain("indisponible");
    expect(html).toContain("Aucun compte sur le périmètre de cette instance");
    // L’état « partiel » doit primer sur un verdict rassurant.
    expect(html).toContain("Partiel");
  });

  it("signale l’échec de la procédure sans inventer de compte", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: undefined, failed: true, isLoading: false }),
    );

    expect(html).toContain("Relevé des accès indisponible");
    expect(html).toContain("Indisponible");
    expect(html).not.toContain("data-testid=\"access-account-");
  });

  it("explique une liste de comptes illisible au lieu de l’habiller en vide", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, {
        access: accessFixture({ accounts: [], accountsTotal: 0, unavailable: ["accounts"] }),
        failed: false,
        isLoading: false,
      }),
    );

    expect(html).toContain("La liste des comptes n’a pas pu être lue");
    expect(html).not.toContain("Aucun compte sur le périmètre de cette instance");
  });

  it("formate les dates en français et les absences par un tiret", () => {
    expect(formatAccessDate("2026-09-15T19:30:00.000Z")).toMatch(/15\/09\/2026/);
    expect(formatAccessDate(null)).toBe("—");
    expect(formatAccessDate("pas une date")).toBe("—");
    expect(formatAccessDate(undefined)).toBe("—");
  });

  it("nomme un compte même privé de nom, sans jamais afficher de case vide", () => {
    const sansNom = accessFixture().accounts[2];
    expect(sansNom.name).toBeNull();
    expect(accountDisplayName(sansNom)).toBe("direction@lucepres.gn");
    expect(accountDisplayName({ id: 9, name: null, email: null, role: "cadre", lastSignedIn: null, createdAt: null })).toBe("Compte #9");
  });

  it("identifie les comptes du portail client", () => {
    const comptes = accessFixture().accounts;
    expect(comptes.filter(isPortalAccount).map(account => account.id)).toEqual([5]);
  });

  it("résume l’état par un verdict lisible", () => {
    expect(accessVerdict(undefined, false)).toEqual({ tone: "unknown", label: "En attente" });
    expect(accessVerdict(undefined, true)).toEqual({ tone: "down", label: "Indisponible" });
    expect(accessVerdict(accessFixture(), false)).toEqual({ tone: "ok", label: "Lecture seule" });
    expect(accessVerdict(accessFixture({ unavailable: ["accounts"] }), false)).toEqual({ tone: "warn", label: "Partiel" });
  });

  it("n’offre aucune commande : l’écran est en lecture seule", () => {
    const html = renderToStaticMarkup(
      createElement(SystemAccessPanel, { access: accessFixture(), failed: false, isLoading: false }),
    );

    for (const controle of ["<button", "<input", "<select", "<textarea"]) {
      expect(html).not.toContain(controle);
    }
    expect(html).not.toContain("onClick");
  });
});

describe("Isolation de l’écran Accès & comptes", () => {
  const app = readSource("client/src/App.tsx");
  const layout = readSource("client/src/components/DashboardLayout.tsx");
  const page = readSource("client/src/pages/SystemAccessPage.tsx");

  it("charge l’écran en paresseux, jamais statiquement", () => {
    expect(app).toContain('lazy(() => import("./pages/SystemAccessPage"))');
    expect(app).not.toContain('from "./pages/SystemAccessPage"');
  });

  it("garde la route /console/acces derrière SystemGate", () => {
    // Le garde ne reçoit plus d’intitulé depuis l’étape B2 : il refuse
    // muettement, donc il n’a plus de message de refus à composer.
    expect(app).toContain("withSystemGate(SystemAccessPage)");
    expect(app).toContain('<Route path={"/console/acces"} component={SystemAccessRoute} />');
  });

  it("affiche l’entrée de navigation réservée aux rôles habilités", () => {
    expect(layout).toContain('path: "/console/acces"');
    expect(layout).toContain("canAccessPath");
  });

  it("alimente l’écran par la procédure serveur protégée", () => {
    expect(page).toContain("system.access");
    expect(page).toContain("ConsoleModuleRail");
    expect(page).toContain("/console/acces");
    expect(page).toContain("Actualiser");
  });

  it("rend le module navigable dans le rail de la console", () => {
    const rail = readSource("client/src/components/SystemConsoleDashboard.tsx");
    expect(rail).toContain('path: "/console/acces"');
    expect(rail).toContain("Accès & comptes");
    // Le module « Accès & sessions » non livré ne doit pas subsister en double.
    expect(rail).not.toContain("Accès & sessions");
  });
});
