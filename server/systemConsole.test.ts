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
  SYSTEM_PATHS,
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
    expect(hasSystemAccess("admin")).toBe(true);
    expect(hasSystemAccess("cadre")).toBe(false);
    expect(hasSystemAccess(undefined)).toBe(false);
  });

  it("réserve /console au rôle système et à l’admin", () => {
    expect(SYSTEM_ONLY_PATHS).toEqual(["/console"]);
    expect(SYSTEM_PATHS).toContain("/console");

    expect(canAccessPath("systeme", "/console")).toBe(true);
    expect(canAccessPath("systeme", "/console/sante")).toBe(true);
    expect(canAccessPath("admin", "/console")).toBe(true);

    expect(canAccessPath("directeur", "/console")).toBe(false);
    expect(canAccessPath("cadre", "/console")).toBe(false);
    expect(canAccessPath("client", "/console")).toBe(false);
    expect(canAccessPath(undefined, "/console")).toBe(false);
    expect(canAccessPath("guest", "/console")).toBe(false);
  });

  it("refuse au rôle système les écrans d’administration du métier", () => {
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
      expect(canAccessPath("systeme", path)).toBe(false);
    }
  });

  it("cantonne le rôle système à la console, au mot de passe et à la 404", () => {
    expect(canAccessPath("systeme", "/compte/mot-de-passe")).toBe(true);
    expect(canAccessPath("systeme", "/404")).toBe(true);

    for (const path of ["/", "/devis", "/factures", "/clients", "/parametres", "/journal-audit", "/portail-client", "/creances"]) {
      expect(canAccessPath("systeme", path)).toBe(false);
    }
  });

  it("ne change rien pour les rôles existants", () => {
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
    expect(nextAssignableStaffRole("admin")).toBe("systeme");
    expect(nextAssignableStaffRole("systeme")).toBe("cadre");
    // Un rôle inconnu retombe sur la valeur par défaut de la colonne.
    expect(nextAssignableStaffRole("guest")).toBe("cadre");
    expect(nextAssignableStaffRole(undefined)).toBe("cadre");
  });

  it("annonce toujours le rôle qu’il attribue réellement", () => {
    expect(nextAssignableStaffRoleLabel("cadre")).toBe("Passer directeur");
    expect(nextAssignableStaffRoleLabel("directeur")).toBe("Passer admin");
    expect(nextAssignableStaffRoleLabel("admin")).toBe("Passer administrateur système");
    expect(nextAssignableStaffRoleLabel("systeme")).toBe("Passer cadre");
    // Garde-fou d’affichage : le libellé ne doit jamais être vide ni figé.
    for (const role of APP_ROLES) {
      expect(nextAssignableStaffRoleLabel(role)).toMatch(/^Passer .+/);
    }
  });

  it("ne rouvre aucun accès métier au rôle système", () => {
    // Séparation des devoirs : ces prédicats commandent `staffProcedure`,
    // `directionProcedure` et les gardes UI métier — `systeme` doit en rester exclu.
    expect(isStaffRole("systeme")).toBe(false);
    expect(isDirectionRole("systeme")).toBe(false);
    expect(isAdminRole("systeme")).toBe(false);
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

  it("répond aussi à l’admin (croisement explicite)", async () => {
    const payload = await appRouter.createCaller(contextFor("admin")).system.overview();
    expect(payload.health.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it("refuse les rôles non habilités en 403", async () => {
    for (const role of ["cadre", "directeur", "client"]) {
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
    expect(gate).toContain("hasSystemAccess");
    expect(gate).toContain("Accès réservé");
    expect(gate).toContain("réservée à l’administration système");
  });

  it("n’affiche l’entrée de navigation que pour les rôles habilités", () => {
    expect(layout).toContain('path: "/console"');
    expect(layout).toContain("canAccessPath");
    expect(layout).toContain("isSystemRole");
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

  it("liste les dix modules de la console, un seul actif en Phase 1", () => {
    const html = renderToStaticMarkup(createElement(ConsoleModuleRail));
    for (const label of [
      "Tableau de bord",
      "Santé &amp; supervision",
      "Base &amp; sauvegardes",
      "Accès &amp; sessions",
      "Rôles &amp; permissions",
      "Environnement",
      "Intégrations",
      "Tâches &amp; files",
      "Journal technique",
      "Données &amp; conformité",
    ]) {
      expect(html).toContain(label);
    }
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
