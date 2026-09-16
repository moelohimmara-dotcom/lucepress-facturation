import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ConsoleModuleRail,
  ConsoleQuickAccess,
  SystemDashboard,
} from "../client/src/components/SystemConsoleDashboard";
import {
  SystemSupervisionPanel,
  formatBytes,
  formatCount,
  formatLatency,
  supervisionVerdict,
  type ConsoleMetrics,
} from "../client/src/components/SystemSupervision";
import { canAccessPath } from "../shared/roles";

/** Lecture directe des sources : prouve le chargement paresseux et le garde d’accès. */
const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/** Relevé type d’une instance saine : sert de base aux rendus statiques. */
function metricsFixture(overrides: Partial<ConsoleMetrics> = {}): ConsoleMetrics {
  return {
    generatedAt: "2026-09-16T07:30:00.000Z",
    database: {
      reachable: true,
      latencyMs: 7,
      pool: { limit: 20, observedConnections: 3 },
      sizeBytes: 4_194_304,
      tables: [
        { name: "documents", bytes: 3_145_728 },
        { name: "clients", bytes: 1_048_576 },
      ],
    },
    counts: { clients: 12, documents: 48, pendingInvitations: 1, accounts: 5 },
    migration: { tracked: true, appliedAt: "2026-09-15T21:10:00.000Z", hash: "9f2c1a" },
    unavailable: [],
    ...overrides,
  };
}

/** Relevé d’une instance dont la base est injoignable : tout est indisponible. */
function degradedMetrics(): ConsoleMetrics {
  return metricsFixture({
    database: {
      reachable: false,
      latencyMs: null,
      pool: { limit: 20, observedConnections: null },
      sizeBytes: null,
      tables: [],
    },
    counts: { clients: null, documents: null, pendingInvitations: null, accounts: null },
    migration: { tracked: false, appliedAt: null, hash: null },
    unavailable: ["observedConnections", "databaseSize", "tableSizes", "counts", "migration"],
  });
}

describe("Santé & supervision — formatage français", () => {
  it("convertit les octets en unités lisibles", () => {
    expect(formatBytes(0)).toBe("0 o");
    expect(formatBytes(4096)).toBe("4 Ko");
    expect(formatBytes(4_194_304)).toBe("4 Mo");
    expect(formatBytes(1_572_864)).toBe("1,5 Mo");
    expect(formatBytes(null)).toBe("indisponible");
    expect(formatBytes(undefined)).toBe("indisponible");
    expect(formatBytes(Number.NaN)).toBe("indisponible");
  });

  it("affiche la latence en millisecondes", () => {
    expect(formatLatency(0)).toBe("0 ms");
    expect(formatLatency(7)).toBe("7 ms");
    expect(formatLatency(12.4)).toBe("12 ms");
    expect(formatLatency(null)).toBe("indisponible");
  });

  it("n’affiche jamais 0 pour un compteur non mesuré", () => {
    expect(formatCount(7)).toBe("7");
    expect(formatCount(0)).toBe("0");
    expect(formatCount(null)).toBe("indisponible");
    expect(formatCount(undefined)).toBe("indisponible");
  });

  it("résume l’état par un verdict simple", () => {
    expect(supervisionVerdict(undefined, false)).toEqual({ tone: "unknown", label: "En attente" });
    expect(supervisionVerdict(undefined, true)).toEqual({ tone: "down", label: "Indisponible" });
    expect(supervisionVerdict(metricsFixture(), false)).toEqual({ tone: "ok", label: "OK" });
    expect(supervisionVerdict(metricsFixture({ unavailable: ["counts"] }), false)).toEqual({ tone: "warn", label: "Attention" });
    expect(supervisionVerdict(degradedMetrics(), false)).toEqual({ tone: "warn", label: "Attention" });
  });
});

describe("Écran Santé & supervision — rendu statique", () => {
  it("affiche les mesures réelles relevées côté serveur", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSupervisionPanel, { metrics: metricsFixture(), failed: false, isLoading: false }),
    );

    expect(html).toContain("Santé &amp; supervision");
    expect(html).toContain("Dernier relevé");
    expect(html).toContain("2026");
    expect(html).toContain("OK");
    expect(html).toContain("Accessible");
    expect(html).toContain("7 ms");
    expect(html).toContain("4 Mo");
    expect(html).toContain("20");
    // L’usage du pool n’est pas exposé par le pilote : on l’annonce explicitement.
    expect(html).toContain("non communiqué");
    expect(html).toContain("Clients");
    expect(html).toContain("Documents");
    expect(html).toContain("Invitations en attente");
    expect(html).toContain("Comptes");
    expect(html).toContain("documents");
    expect(html).toContain("clients");
    expect(html).toContain("présent");
    expect(html).not.toContain("Mesures indisponibles sur ce relevé");
  });

  it("annonce « non communiqué » et « indisponible » plutôt qu’une valeur inventée", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSupervisionPanel, { metrics: degradedMetrics(), failed: false, isLoading: false }),
    );

    expect(html).toContain("Attention");
    expect(html).toContain("Injoignable");
    expect(html).toContain("non communiqué");
    expect(html).toContain("indisponible");
    expect(html).toContain("absent");
    expect(html).toContain("Taille des tables indisponible");
    expect(html).toContain("Mesures indisponibles sur ce relevé");
    expect(html).toContain("observedConnections");
    expect(html).toContain("drizzle.__drizzle_migrations");
  });

  it("signale l’échec du relevé sans afficher de mesure", () => {
    const html = renderToStaticMarkup(
      createElement(SystemSupervisionPanel, { metrics: undefined, failed: true, isLoading: false }),
    );

    expect(html).toContain("Indisponible");
    expect(html).toContain("La procédure de supervision n’a pas répondu");
    expect(html).toContain("non communiqué");
  });
});

describe("Console — navigation des modules livrés", () => {
  it("rend navigables les deux écrans livrés et laisse les autres annotés", () => {
    const html = renderToStaticMarkup(createElement(ConsoleModuleRail, { activePath: "/console/sante" }));

    expect(html).toContain('href="/console"');
    expect(html).toContain('href="/console/sante"');
    // Dix modules : deux livrés (liens), huit encore annotés d’une phase.
    expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(8);
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/href="\/console\/sante"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/console\/sante"/);
  });

  it("marque l’écran actif selon la page appelante", () => {
    const console = renderToStaticMarkup(createElement(ConsoleModuleRail, { activePath: "/console" }));
    expect(console).toMatch(/href="\/console"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/console"/);
  });

  it("propose des accès rapides vers les écrans internes", () => {
    const html = renderToStaticMarkup(createElement(ConsoleQuickAccess, {}));
    expect(html).toContain("Accès rapides");
    expect(html).toContain('href="/console"');
    expect(html).toContain('href="/console/sante"');
  });

  it("affiche l’état global et les accès rapides sur le tableau de bord", () => {
    const now = new Date("2026-09-16T08:00:00Z");
    const offline = renderToStaticMarkup(
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
    expect(offline).toContain("État global");
    expect(offline).toContain("Hors ligne");
    expect(offline).toContain("Dernière vérification");
    expect(offline).toContain("Accès rapides");
    expect(offline).toContain('href="/console/sante"');
  });
});

describe("Isolation de l’écran Santé & supervision", () => {
  const app = readSource("client/src/App.tsx");
  const layout = readSource("client/src/components/DashboardLayout.tsx");
  const page = readSource("client/src/pages/SystemSupervisionPage.tsx");

  it("charge l’écran en paresseux, jamais statiquement", () => {
    expect(app).toContain('lazy(() => import("./pages/SystemSupervisionPage"))');
    expect(app).not.toContain('from "./pages/SystemSupervisionPage"');
  });

  it("garde la route /console/sante derrière SystemGate", () => {
    expect(app).toContain('withSystemGate(SystemSupervisionPage, "Santé & supervision")');
    expect(app).toContain('<Route path={"/console/sante"} component={SystemSupervisionRoute} />');
  });

  it("n’affiche l’entrée de navigation que pour les rôles habilités", () => {
    expect(layout).toContain('path: "/console/sante"');
    expect(layout).toContain("canAccessPath");
  });

  it("réserve /console/sante au rôle système et à l’admin", () => {
    expect(canAccessPath("systeme", "/console/sante")).toBe(true);
    expect(canAccessPath("admin", "/console/sante")).toBe(true);
    for (const role of ["directeur", "cadre", "client"]) {
      expect(canAccessPath(role, "/console/sante")).toBe(false);
    }
    expect(canAccessPath(undefined, "/console/sante")).toBe(false);
  });

  it("alimente l’écran par la procédure serveur protégée", () => {
    expect(page).toContain("system.metrics");
    expect(page).toContain("Actualiser");
    expect(page).toContain("ConsoleModuleRail");
  });
});
