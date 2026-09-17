import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ConsoleModuleRail,
  SystemDashboard,
  formatUptime,
} from "../client/src/components/SystemConsoleDashboard";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  APP_ROLE_LABELS,
  APP_ROLES,
  PERSISTED_APP_ROLES,
  STAFF_ASSIGNABLE_ROLES,
  STAFF_ROLES,
  SYSTEM_ONLY_PATHS,
  canAccessPath,
  hasSystemAccess,
  isAdminRole,
  isAppRole,
  isClientRole,
  isDirectionRole,
  isPersistedAppRole,
  isStaffRole,
  isSystemRole,
  nextAssignableStaffRole,
  nextAssignableStaffRoleLabel,
} from "../shared/roles";

/** Lecture directe des sources : prouve le chargement paresseux et le filtrage de navigation. */
const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * LA MFA N’ENTRE PLUS DANS L’ÉQUATION DE LA CONSOLE.
 *
 * Le compte système de ces tests portait une MFA ACTIVE, parce que
 * `systemProcedure` l’exigeait (étape B2). Ce n’est plus le cas : le garde ne
 * vérifie que le rôle `systeme`, et ne lit même plus l’état MFA du compte. Le
 * double qui remplaçait cette lecture est donc retiré — un module réellement
 * plus simple se prouve mieux qu’un module doublé pour rien.
 *
 * Les deux sens de la règle (accès sans MFA, 403 pour tout autre rôle) sont
 * épinglés dans `server/systemConsoleMfa.test.ts`, et les deux gestes de la
 * console (activer / désactiver) sur le vrai module dans
 * `server/systemConsoleMfaOptional.test.ts`. Ici, on isole le reste des règles
 * de la console.
 */

function contextFor(role: string): TrpcContext {
  return {
    user: {
      id: 42,
      openId: `staff-${role}`,
      name: `Compte ${role}`,
      email: `${role}@example.com`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
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

describe("Console d’exploitation — rôle systeme", () => {
  it("déclare le rôle système dans le vocabulaire applicatif", () => {
    expect(STAFF_ROLES).toContain("systeme");
    expect(APP_ROLES).toContain("systeme");
    expect(APP_ROLE_LABELS.systeme).toBe("Administrateur système");
    expect(isAppRole("systeme")).toBe(true);
    expect(isSystemRole("systeme")).toBe(true);
    expect(isSystemRole("admin")).toBe(false);
    expect(hasSystemAccess("systeme")).toBe(true);
    // RETOURNÉ — l’habilitation de console était partagée avec `admin` le temps
    // des essais (Phase 1 → 3B1) ; elle appartient désormais au seul `systeme`.
    expect(hasSystemAccess("admin")).toBe(false);
    expect(hasSystemAccess("cadre")).toBe(false);
    expect(hasSystemAccess(undefined)).toBe(false);
  });

  it("réserve /console au seul rôle système", () => {
    expect(SYSTEM_ONLY_PATHS).toEqual(["/console"]);
    // RETOURNÉ — `SYSTEM_PATHS` (« tout ce qu’ouvre le rôle système ») est
    // supprimée : le rôle étant super-administrateur, la liste de ses écrans
    // serait l’application entière, et elle deviendrait fausse au premier écran
    // ajouté. Ce qui reste délimité, c’est l’inverse et c’est le seul fait qui
    // compte : ce que LUI SEUL ouvre. `SYSTEM_ONLY_PATHS` porte cette frontière,
    // et `canAccessPath` la fait respecter — vérifié ci-dessous plutôt que
    // recopié.
    expect(hasSystemAccess("systeme")).toBe(true);
    expect(canAccessPath("systeme", SYSTEM_ONLY_PATHS[0])).toBe(true);
    expect(hasSystemAccess("admin")).toBe(false);

    expect(canAccessPath("systeme", "/console")).toBe(true);
    expect(canAccessPath("systeme", "/console/sante")).toBe(true);
    // RETOURNÉ — l’admin ouvrait la console, il ne l’ouvre plus.
    expect(canAccessPath("admin", "/console")).toBe(false);
    expect(canAccessPath("admin", "/console/sante")).toBe(false);
    // Un chemin de console non déclaré reste couvert par le préfixe : il ne peut
    // pas devenir une porte dérobée pour un rôle non habilité.
    expect(canAccessPath("admin", "/console/inconnu")).toBe(false);
    expect(canAccessPath("systeme", "/console/inconnu")).toBe(true);

    expect(canAccessPath("directeur", "/console")).toBe(false);
    expect(canAccessPath("cadre", "/console")).toBe(false);
    expect(canAccessPath("client", "/console")).toBe(false);
    expect(canAccessPath(undefined, "/console")).toBe(false);
    expect(canAccessPath("guest", "/console")).toBe(false);
  });

  it("ouvre au rôle système les écrans d’administration du métier", () => {
    // RETOURNÉ — ces huit écrans étaient FERMÉS au rôle système, qui n’était pas
    // super-administrateur. Ils lui sont désormais ouverts, exactement comme à
    // l’admin : le contrôle porte donc aussi sur la parité des deux rôles sur
    // ces chemins, pour qu’aucun des deux ne dérive.
    for (const path of [
      "/integrations",
      "/parametres/utilisateurs",
      "/parametres/e-mails",
      "/parametres/modeles",
      "/agent-ia",
      "/agent-ia/planification",
      "/agent-ia/audit",
      "/agent-ia/e-mails-test",
    ]) {
      expect({ path, systeme: canAccessPath("systeme", path) }).toEqual({ path, systeme: true });
      expect({ path, admin: canAccessPath("admin", path) }).toEqual({ path, admin: true });
    }
  });

  it("ouvre au rôle système TOUTE l’application, la console restant sienne", () => {
    // RETOURNÉ — le rôle système était cantonné à la console, au mot de passe et
    // à la 404. Super-administrateur, il ouvre désormais chaque chemin de
    // l’application : la seule chose qui ne s’ouvre pas à lui est… rien. Ce qui
    // reste borné est l’inverse — `/console` ne s’ouvre qu’à lui.
    expect(canAccessPath("systeme", "/compte/mot-de-passe")).toBe(true);
    expect(canAccessPath("systeme", "/404")).toBe(true);

    for (const path of ["/", "/devis", "/factures", "/clients", "/parametres", "/journal-audit", "/portail-client", "/creances"]) {
      expect({ path, droit: canAccessPath("systeme", path) }).toEqual({ path, droit: true });
    }
    // `/portail-client` mérite d’être nommé : le cloisonnement par `CLIENT_PATHS`
    // ne vise que le rôle `client`, jamais le super-administrateur. Aucun compte
    // portail pour autant : la porte ouverte est celle de l’ÉCRAN, et le portail
    // ne rend que les données du compte connecté.
    expect(canAccessPath("client", "/portail-client")).toBe(true);
    expect(canAccessPath("client", "/devis")).toBe(false);
  });

  it("ne change rien pour les rôles existants, hors console", () => {
    expect(canAccessPath("admin", "/integrations")).toBe(true);
    expect(canAccessPath("admin", "/devis")).toBe(true);
    expect(canAccessPath("directeur", "/integrations")).toBe(false);
    expect(canAccessPath("directeur", "/journal-audit")).toBe(true);
    expect(canAccessPath("cadre", "/journal-audit")).toBe(false);
    expect(canAccessPath("cadre", "/devis")).toBe(true);
    expect(canAccessPath("cadre", "/parametres")).toBe(true);
    expect(canAccessPath("client", "/portail-client")).toBe(true);
    expect(canAccessPath("client", "/compte/mot-de-passe")).toBe(true);
    expect(canAccessPath("client", "/devis")).toBe(false);
    // L’admin conserve tout son back-office métier : seule la console lui est retirée.
    for (const path of [
      "/",
      "/devis",
      "/factures",
      "/clients",
      "/chantiers",
      "/prestations",
      "/couts-chantier",
      "/creances",
      "/relances",
      "/calendrier",
      "/journal-audit",
      "/parametres",
      "/parametres/utilisateurs",
      "/parametres/e-mails",
      "/parametres/modeles",
      "/parametres/modeles/documents",
      "/integrations",
      "/agent-ia",
      "/agent-ia/planification",
      "/agent-ia/audit",
      "/agent-ia/e-mails-test",
      "/portail-client",
      "/compte/mot-de-passe",
      "/404",
    ]) {
      expect({ path, droit: canAccessPath("admin", path) }).toEqual({ path, droit: true });
    }
  });

  it("rend le rôle système réellement persistable et attribuable", () => {
    // Phase 1bis : l’énumération PostgreSQL porte `systeme`, le rôle n’est donc
    // plus seulement un vocabulaire applicatif.
    expect(PERSISTED_APP_ROLES).toContain("systeme");
    expect(isPersistedAppRole("systeme")).toBe(true);
    // Aucun rôle applicatif ne reste hors de l’énumération : plus de décalage
    // entre le vocabulaire et ce que la colonne `users.role` accepte.
    expect([...PERSISTED_APP_ROLES].sort()).toEqual([...APP_ROLES].sort());

    expect(STAFF_ASSIGNABLE_ROLES).toContain("systeme");
    expect(STAFF_ASSIGNABLE_ROLES).not.toContain("client");
    expect(nextAssignableStaffRole("cadre")).toBe("directeur");
    expect(nextAssignableStaffRole("directeur")).toBe("admin");
    // RETOURNÉ — le raccourci de la page Utilisateurs (écran d’admin) proposait
    // « Passer administrateur système » : l’admin ne peut plus l’attribuer, le
    // bouton ne doit donc plus le proposer. Le rôle `systeme` reste dans
    // `STAFF_ASSIGNABLE_ROLES` (l’énumération acceptée par `users.setRole`) :
    // seul un compte `systeme` s’en sert, et il n’a pas cet écran.
    expect(nextAssignableStaffRole("admin")).toBe("cadre");
    expect(nextAssignableStaffRole("systeme")).toBe("cadre");
    // Un rôle inconnu retombe sur la valeur par défaut de la colonne.
    expect(nextAssignableStaffRole("guest")).toBe("cadre");
    expect(nextAssignableStaffRole(undefined)).toBe("cadre");
    // Aucun rôle ne voit le cycle proposer `systeme` : l’écran Utilisateurs ne
    // peut pas promettre une promotion que le serveur refuse (403).
    for (const role of APP_ROLES) {
      expect(nextAssignableStaffRole(role)).not.toBe("systeme");
    }
  });

  it("annonce toujours le rôle qu’il attribue réellement", () => {
    expect(nextAssignableStaffRoleLabel("cadre")).toBe("Passer directeur");
    expect(nextAssignableStaffRoleLabel("directeur")).toBe("Passer admin");
    expect(nextAssignableStaffRoleLabel("admin")).toBe("Passer cadre");
    expect(nextAssignableStaffRoleLabel("systeme")).toBe("Passer cadre");
    // Garde-fou d’affichage : le libellé ne doit jamais être vide ni figé.
    for (const role of APP_ROLES) {
      expect(nextAssignableStaffRoleLabel(role)).toMatch(/^Passer .+/);
    }
  });

  it("compte le rôle système dans les prédicats métier, comme les gardes serveur", () => {
    // RETOURNÉ — ces prédicats excluaient `systeme` (« séparation des devoirs »).
    // Le rôle étant super-administrateur, ils doivent lui rendre `true` : ils
    // commandent les gardes UI métier (`staffProcedure`, `directionProcedure`) et
    // un prédicat qui répondrait `false` fermerait à l’écran ce que le serveur
    // ouvre — l’écran s’afficherait sur des procédures qui répondent 403.
    expect(isStaffRole("systeme")).toBe(true);
    expect(isDirectionRole("systeme")).toBe(true);
    expect(isAdminRole("systeme")).toBe(true);
    // Le seul prédicat qui reste fermé : le portail client. Un compte système
    // n’est pas un compte portail.
    expect(isClientRole("systeme")).toBe(false);
    // Non-régression : les rôles existants ne changent pas de nature.
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("directeur")).toBe(true);
    expect(isStaffRole("cadre")).toBe(true);
    expect(isStaffRole("client")).toBe(false);
    expect(isDirectionRole("admin")).toBe(true);
    expect(isDirectionRole("directeur")).toBe(true);
    expect(isDirectionRole("cadre")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("directeur")).toBe(false);
    expect(isClientRole("client")).toBe(true);
  });
});

describe("Énumération role_admin_directeur — alignement du schéma", () => {
  // Aucune base n’est sollicitée : on prouve par lecture de source que les deux
  // déclarations du schéma portent la même énumération. `schema.pg.ts` est la
  // source de vérité (config drizzle PostgreSQL) ; `schema.ts` est le miroir
  // importé par le runtime (`server/db.ts`), les deux doivent rester identiques.
  const attendu = 'pgEnum("role_admin_directeur", ["admin", "directeur", "cadre", "client", "systeme"])';

  it("déclare systeme en fin de liste, dans les deux fichiers de schéma", () => {
    expect(readSource("drizzle/schema.pg.ts")).toContain(attendu);
    expect(readSource("drizzle/schema.ts")).toContain(attendu);
  });

  it("garde les deux fichiers de schéma strictement identiques", () => {
    expect(readSource("drizzle/schema.ts")).toBe(readSource("drizzle/schema.pg.ts"));
  });

  it("n’utilise ni BEFORE ni AFTER : ADD VALUE place la valeur en fin de liste", () => {
    // L’ordre déclaré doit correspondre à ce que produira le futur
    // `ALTER TYPE … ADD VALUE 'systeme'` (sans BEFORE/AFTER) en base.
    for (const file of ["drizzle/schema.pg.ts", "drizzle/schema.ts"]) {
      const ligne = readSource(file)
        .split("\n")
        .find(l => l.includes('pgEnum("role_admin_directeur"'));
      expect(ligne).toBeDefined();
      expect(ligne!.trimEnd().endsWith('"systeme"]);')).toBe(true);
    }
  });
});

describe("system.overview — contrôle serveur de la console", () => {
  it("répond au rôle système, MFA active ou non", async () => {
    // AJOUTÉ — la règle centrale de cette livraison : ouvrir la console ne
    // demande qu’un rôle. Le compte `systeme` sans second facteur obtient
    // exactement le même résumé que celui qui en a un.
    const payload = await appRouter.createCaller(contextFor("systeme")).system.overview();
    expect(payload).toMatchObject({ application: { name: "Lucepress Facturation" } });
  });

  it("répond au rôle système avec un résumé réel et sans secret", async () => {
    const payload = await appRouter.createCaller(contextFor("systeme")).system.overview();

    expect(Object.keys(payload).sort()).toEqual(["application", "health"]);
    expect(payload.application.name).toBe("Lucepress Facturation");
    expect(payload.application.version === null || typeof payload.application.version === "string").toBe(true);
    expect(["up", "down"]).toContain(payload.health.db);
    expect(typeof payload.health.ok).toBe("boolean");
    expect(typeof payload.health.uptimeSec).toBe("number");
    expect(typeof payload.health.poolLimit).toBe("number");

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/DATABASE_URL|postgres:\/\/|password|passwordHash|stack|node_modules/i);
    expect(serialized).not.toContain("staff-systeme");
  });

  it("refuse l’admin en 403, comme tout autre rôle non système", async () => {
    // RETOURNÉ — `system.overview` répondait à l’admin (croisement explicite).
    // Le refus serveur est la moitié du contrôle : l’interface ne suffit jamais.
    await expect(appRouter.createCaller(contextFor("admin")).system.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuse tous les rôles non habilités en 403", async () => {
    for (const role of ["admin", "cadre", "directeur", "client"]) {
      await expect(appRouter.createCaller(contextFor(role)).system.overview()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("refuse un visiteur non authentifié", async () => {
    // Même convention que `adminProcedure` / `staffProcedure` : le middleware de
    // rôles répond FORBIDDEN (403) quand aucun utilisateur n’est authentifié.
    await expect(appRouter.createCaller(anonymousContext()).system.overview()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

/* ------------------------------------------------------------------ */
/* ÉTANCHÉITÉ — la contrepartie de l’ouverture                          */
/* ------------------------------------------------------------------ */

/**
 * Le rôle système a gagné des droits : c’est la moitié de la livraison. L’autre
 * moitié, celle qui décide si le changement est sûr, est ce que les AUTRES rôles
 * n’ont PAS gagné. Ces tests la mesurent, plutôt que de la supposer.
 *
 * Aucune base n’est sollicitée : le garde de rôle s’exécute AVANT le corps de la
 * procédure, donc avant toute lecture. C’est précisément ce qu’on veut prouver —
 * un refus qui dépendrait de la base ne serait pas un refus.
 */
describe("Étanchéité — ce que les autres rôles n’ont pas gagné", () => {
  /**
   * LES PROCÉDURES DE CONSOLE, RECENSÉES DANS LE ROUTEUR ET NON RECOPIÉES.
   *
   * La liste est lue dans l’arbre de `appRouter` : une procédure de console
   * ajoutée demain sans garde fait échouer ce test toute seule, sans que
   * personne ait à penser à l’inscrire ici. Les quatre exclusions sont nommées
   * et vérifiées plus bas, une par une — aucune n’est laissée implicite.
   */
  const HORS_CONSOLE = ["system.health", "system.reportRefusal", "system.llmModels", "system.notifyOwner"] as const;

  const proceduresDuRouteur = Object.keys(
    (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures,
  ).sort();

  const proceduresDeConsole = proceduresDuRouteur.filter(
    path => path.startsWith("system.") && !(HORS_CONSOLE as readonly string[]).includes(path),
  );

  /**
   * Chaque procédure, appelée avec une entrée VALIDE quand elle en exige une.
   * Sans cela, tRPC refuserait sur l’entrée (`BAD_REQUEST`) avant le moindre
   * contrôle de rôle : le test prouverait la validation, pas le garde.
   */
  function appelsDeConsole(role: string): Array<[string, () => Promise<unknown>]> {
    const caller = appRouter.createCaller(contextFor(role));
    return [
      ["system.overview", () => caller.system.overview()],
      ["system.metrics", () => caller.system.metrics()],
      ["system.access", () => caller.system.access()],
      ["system.accounts.create", () => caller.system.accounts.create({ email: "x@example.com", password: "motdepasse1", role: "cadre" })],
      ["system.accounts.rename", () => caller.system.accounts.rename({ userId: 1, name: "Nom" })],
      ["system.accounts.setRole", () => caller.system.accounts.setRole({ userId: 1, role: "cadre" })],
      ["system.accounts.resetPassword", () => caller.system.accounts.resetPassword({ userId: 1 })],
      ["system.accounts.remove", () => caller.system.accounts.remove({ userId: 1 })],
      ["system.invitations.list", () => caller.system.invitations.list()],
      ["system.invitations.issue", () => caller.system.invitations.issue({ email: "x@example.com", role: "cadre" })],
      ["system.invitations.resend", () => caller.system.invitations.resend({ id: 1 })],
      ["system.invitations.revoke", () => caller.system.invitations.revoke({ id: 1 })],
      ["system.sessions.list", () => caller.system.sessions.list()],
      ["system.sessions.revoke", () => caller.system.sessions.revoke({ id: 1 })],
      // Module « Données & conformité » (lot 3) : les quatre procédures de
      // l’écran `/console/donnees`. Les entrées sont VALIDES — un jeton
      // d’export illisible fait partie du contrat, il est refusé par le module,
      // pas par le schéma — afin que le refus observé soit bien celui du garde.
      ["system.data.overview", () => caller.system.data.overview()],
      ["system.data.demoCandidates", () => caller.system.data.demoCandidates()],
      ["system.data.export", () => caller.system.data.export({ clientIds: [1] })],
      [
        "system.data.purge",
        () =>
          caller.system.data.purge({
            clientIds: [1],
            confirmation: "SUPPRIMER 14 ENREGISTREMENTS",
            exportToken: "v1.charge-utile.signature",
          }),
      ],
    ];
  }

  it("recense toutes les procédures de console, et rien d’autre", () => {
    // Le recensement est la prémisse des trois tests suivants : s’il était vide
    // ou partiel, ils passeraient à vide.
    expect(proceduresDuRouteur.length).toBeGreaterThan(20);
    expect(proceduresDeConsole.sort()).toEqual(appelsDeConsole("admin").map(([path]) => path).sort());
    // Les exclusions sont réelles, et aucune n’est un garde de console déguisé :
    // les deux premières ne lisent AUCUN rôle, les deux suivantes exigent l’admin.
    const source = readSource("server/_core/systemRouter.ts");
    expect(source).toContain("health: publicProcedure.query(");
    expect(source).toContain("reportRefusal: publicProcedure.mutation(({ ctx }) => {");
    expect(source).toContain("llmModels: adminProcedure.query(");
    expect(source).toContain("notifyOwner: adminProcedure");
    expect(source).not.toContain("overview: publicProcedure");
  });

  it("refuse l’admin en 403 sur CHAQUE procédure de console", async () => {
    // La preuve demandée, rôle par rôle et procédure par procédure : le
    // super-administrateur métier n’a pas gagné un pouce de console. `admin` est
    // traité à part parce que c’est le seul rôle qui a un historique d’accès
    // partagé avec la console (Phases 1 → 3B1).
    const appels = appelsDeConsole("admin");
    const refus = await Promise.all(
      appels.map(async ([path, call]) => {
        try {
          await call();
          return { path, code: "AUCUN_REFUS" };
        } catch (error) {
          return { path, code: (error as { code?: string }).code ?? "SANS_CODE" };
        }
      }),
    );

    expect(refus).toEqual(appels.map(([path]) => ({ path, code: "FORBIDDEN" })));
  });

  it("refuse aussi directeur, cadre et client en 403, partout", async () => {
    for (const role of ["directeur", "cadre", "client"]) {
      const appels = appelsDeConsole(role);
      const refus = await Promise.all(
        appels.map(async ([path, call]) => {
          try {
            await call();
            return { role, path, code: "AUCUN_REFUS" };
          } catch (error) {
            return { role, path, code: (error as { code?: string }).code ?? "SANS_CODE" };
          }
        }),
      );

      expect(refus).toEqual(appels.map(([path]) => ({ role, path, code: "FORBIDDEN" })));
    }
  });

  it("ne donne à AUCUN rôle non système la moindre entrée de console", () => {
    // Le pendant côté écran du refus serveur : sur les chemins réellement
    // déclarés dans la barre latérale, aucun rôle autre que `systeme` n’ouvre un
    // `/console…`. L’ouverture du métier au super-administrateur ne s’est donc
    // pas payée d’une fuite inverse.
    const layout = readSource("client/src/components/DashboardLayout.tsx");
    const chemins = [...layout.matchAll(/\{\s*icon:\s*[A-Za-z]+,\s*label:\s*"[^"]+",\s*path:\s*"([^"]+)"\s*\}/g)].map(m => m[1]);
    expect(chemins.filter(path => path.startsWith("/console")).length).toBeGreaterThan(0);

    for (const role of ["admin", "directeur", "cadre", "client"] as const) {
      expect({ role, console: chemins.filter(path => path.startsWith("/console") && canAccessPath(role, path)) }).toEqual({
        role,
        console: [],
      });
    }
    expect(chemins.filter(path => path.startsWith("/console") && canAccessPath("systeme", path)).length).toBe(
      chemins.filter(path => path.startsWith("/console")).length,
    );
  });
});

describe("Isolation du bundle et de la navigation", () => {
  const app = readSource("client/src/App.tsx");
  const layout = readSource("client/src/components/DashboardLayout.tsx");
  const gate = readSource("client/src/components/SystemGate.tsx");
  const consolePage = readSource("client/src/pages/SystemConsolePage.tsx");
  const dashboard = readSource("client/src/components/SystemConsoleDashboard.tsx");

  it("charge la page console en paresseux, jamais statiquement", () => {
    expect(app).toContain('lazy(() => import("./pages/SystemConsolePage"))');
    expect(app).toContain("withSystemGate");
    expect(app).toContain('<Route path={"/console"} component={SystemConsoleRoute} />');
    // Aucun import statique de la page : le chunk console reste hors du bundle métier.
    expect(app).not.toContain('from "./pages/SystemConsolePage"');
  });

  it("garde la route /console derrière SystemGate", () => {
    // Le garde ne reçoit plus d’intitulé : il n’y a plus de message de refus à
    // composer, puisqu’il refuse MUETTEMENT (voir `systemMfaScreens.ui.test.ts`).
    expect(app).toContain("withSystemGate(SystemConsolePage)");
    // Les SIX routes de la console portent le garde : aucune porte de côté.
    for (const page of ["SystemConsolePage", "SystemSupervisionPage", "SystemAccessPage", "SystemSessionsPage", "SystemPermissionsPage", "SystemMetierPage"]) {
      expect({ page, garde: app.includes(`withSystemGate(${page})`) }).toEqual({ page, garde: true });
    }
    expect(gate).toContain("hasSystemAccess");
    // Défaut sûr : le garde refuse AVANT de rendre, sur la négation de la règle.
    expect(gate.replace(/\s+/g, " ")).toContain("if (!hasSystemAccess(user?.role)) {");
    // Le refus rend l’écran « introuvable » de l’application — celui de la 404 —
    // et ne nomme rien.
    expect(gate).toContain("IntrouvableScreen");
    expect(gate).not.toContain("réservée à l’administration système");
  });

  it("n’affiche l’entrée de navigation que pour les rôles habilités", () => {
    expect(layout).toContain('path: "/console"');
    // RETOURNÉ — la navigation filtrait par `isSystemRole` (le rôle système était
    // le seul à ouvrir la console, et le seul à ne pas ouvrir le métier). Elle
    // filtre désormais par `canAccessPath`, la MÊME règle que les gardes d’écran :
    // un prédicat particulier ne peut plus décider de ce qui s’affiche, et la
    // barre latérale ne peut donc pas diverger des routes.
    expect(layout).toContain("canAccessPath");
    expect(layout).not.toContain("isSystemRole");
  });

  /**
   * MÉTHODE (et non affirmation) : on relit les chemins réellement déclarés dans
   * `navigationGroups` et on les passe au MÊME filtre que celui du rendu
   * (`canAccessPath(role, item.path)`). Ce que ce test calcule est donc ce que la
   * barre latérale affiche.
   */
  const navigationPaths = [...layout.matchAll(/\{\s*icon:\s*[A-Za-z]+,\s*label:\s*"[^"]+",\s*path:\s*"([^"]+)"\s*\}/g)]
    .map(match => match[1]);

  it("filtre la navigation avec canAccessPath", () => {
    expect(navigationPaths.length).toBeGreaterThan(10);
    expect(navigationPaths).toContain("/console");
    expect(layout.replace(/\s+/g, " ")).toContain("items: group.items.filter(item => canAccessPath(role, item.path))");
  });

  it("ne montre aucune entrée de console à un rôle autre que système", () => {
    for (const role of APP_ROLES) {
      const visibles = navigationPaths.filter(path => canAccessPath(role, path));
      const consoleVisibles = visibles.filter(path => path === "/console" || path.startsWith("/console/"));
      // Preuve par le filtre : `admin` ne voit plus une seule entrée `/console…`.
      expect({ role, consoleVisibles }).toEqual({
        role,
        consoleVisibles: role === "systeme" ? navigationPaths.filter(p => p.startsWith("/console")) : [],
      });
    }
    // La ligne précédente serait vide des deux côtés si la console avait disparu
    // de la navigation : on vérifie qu’elle y est toujours, pour le seul système.
    expect(navigationPaths.filter(path => path.startsWith("/console")).length).toBeGreaterThan(0);
  });

  it("ne laisse aucun lien vers /console dans les vues publiques et métier", () => {
    // Surfaces qu’un rôle non système peut réellement ouvrir : accueil public,
    // page 404, recherche globale, guide, accueil métier, comptes collaborateurs,
    // paramètres, table des raccourcis et recherche d’espace de travail.
    for (const chemin of [
      "client/src/components/LandingPage.tsx",
      "client/src/components/CommandPalette.tsx",
      "client/src/components/TourGuide.tsx",
      "client/src/pages/NotFound.tsx",
      "client/src/pages/LoginPage.tsx",
      "client/src/pages/Home.tsx",
      "client/src/pages/UsersPage.tsx",
      "client/src/pages/SettingsPage.tsx",
      "shared/sidebarNavigation.ts",
      "shared/workspaceSearch.ts",
      "shared/todayInbox.ts",
    ]) {
      expect({ chemin, console: readSource(chemin).includes("/console") }).toEqual({ chemin, console: false });
    }
  });

  it("affiche la santé, la version et la date sur le tableau de bord", () => {
    expect(consolePage).toContain('fetch("/api/health"');
    expect(consolePage).toContain("system.overview");
    expect(consolePage).toContain("ConsoleModuleRail");
    expect(consolePage).toContain("SystemDashboard");
    expect(dashboard).toContain("uptimeSec");
    expect(dashboard).toContain("poolLimit");
    expect(dashboard).toContain("Tableau de bord système");
  });
});

describe("Tableau de bord système — rendu", () => {
  const now = new Date("2026-09-15T10:30:00Z");

  it("liste les modules de la console, un seul actif en Phase 1", () => {
    const html = renderToStaticMarkup(createElement(ConsoleModuleRail));
    for (const label of [
      "Tableau de bord",
      "Santé &amp; supervision",
      "Base &amp; sauvegardes",
      "Accès &amp; comptes",
      "Rôles &amp; permissions",
      "Données &amp; métier",
      // « Données » est le module LIVRÉ (lot 3), avec sa route ; « Conformité »
      // reste l’annonce de ce qui n’est pas encore livré. Les deux libellés sont
      // distincts : le rail ne peut pas laisser croire qu’un module est livré
      // quand il ne l’est pas.
      "Données",
      "Environnement",
      "Intégrations",
      "Tâches &amp; files",
      "Journal technique",
      "Conformité",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('href="/console/donnees"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Phase 5");
  });

  it("affiche la santé, la version et la date réelles", () => {
    const html = renderToStaticMarkup(
      createElement(SystemDashboard, {
        health: { ok: true, db: "up", uptimeSec: 3 * 86_400 + 4 * 3_600, poolLimit: 20, timestamp: "2026-09-15T10:29:00.000Z" },
        healthError: null,
        isLoadingHealth: false,
        overview: { application: { name: "Lucepress Facturation", version: "1.0.0" } },
        isLoadingOverview: false,
        overviewFailed: false,
        now,
      }),
    );
    expect(html).toContain("Tableau de bord système");
    expect(html).toContain("En ligne");
    expect(html).toContain("Accessible");
    expect(html).toContain("3 j 4 h");
    expect(html).toContain("20");
    expect(html).toContain("Lucepress Facturation");
    expect(html).toContain("1.0.0");
    expect(html).toContain("vérifié");
    expect(html).toContain("2026");
  });

  it("signale l’indisponibilité sans inventer de valeur", () => {
    const html = renderToStaticMarkup(
      createElement(SystemDashboard, {
        health: null,
        healthError: "Connexion au relevé impossible.",
        isLoadingHealth: false,
        overview: undefined,
        isLoadingOverview: false,
        overviewFailed: true,
        now,
      }),
    );
    expect(html).toContain("Relevé de santé indisponible");
    expect(html).toContain("Connexion au relevé impossible.");
    expect(html).toContain("Inconnu");
    expect(html).toContain("non communiquée");
    expect(html).toContain("refusé");
  });

  it("formate la disponibilité en français", () => {
    expect(formatUptime(45)).toBe("45 s");
    expect(formatUptime(120)).toBe("2 min");
    expect(formatUptime(3 * 3_600 + 15 * 60)).toBe("3 h 15 min");
    expect(formatUptime(2 * 86_400 + 5 * 3_600)).toBe("2 j 5 h");
  });
});
