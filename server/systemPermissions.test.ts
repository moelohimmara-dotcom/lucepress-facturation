import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SystemPermissionsPanel, capabilityGuardSummary } from "../client/src/components/SystemPermissions";
import {
  APP_ROLES,
  HABILITATIONS,
  PERMISSION_CAPABILITIES,
  PERMISSION_MATRIX_ROLES,
  PROCEDURE_GUARD_ROLES,
  PROCEDURE_GUARDS,
  canAccessPath,
  findHabilitationForPath,
  habilitationRoles,
  permissionFor,
  permissionMatrix,
  type AppRole,
} from "../shared/roles";

/** Lecture directe des sources : prouve l’alignement de la matrice avec le code. */
const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * Rôles réellement exigés par une procédure protégée, extraits de
 * `server/_core/trpc.ts`. On lit le source plutôt que de faire confiance à la
 * copie de `shared/roles.ts` : c’est précisément le décalage que ce test
 * surveille.
 */
function guardRolesFromSource(trpcSource: string, guard: string): string[] {
  const declaration = trpcSource.indexOf(`export const ${guard} = t.procedure.use(`);
  if (declaration === -1) return [];
  const appel = trpcSource.indexOf("requireRoles(", declaration);
  if (appel === -1) return [];
  const ouverture = trpcSource.indexOf("[", appel);
  const fermeture = trpcSource.indexOf("]", ouverture);
  if (ouverture === -1 || fermeture === -1) return [];
  return [...trpcSource.slice(ouverture + 1, fermeture).matchAll(/"([^"]+)"/g)].map(match => match[1]);
}

describe("Matrice de référence — alignement avec canAccessPath", () => {
  it("décrit chaque capacité par un chemin réel de l’application", () => {
    const app = readSource("client/src/App.tsx");
    const chemins = new Set(PERMISSION_CAPABILITIES.map(capability => capability.path));

    expect(chemins.size).toBe(PERMISSION_CAPABILITIES.length);
    for (const chemin of chemins) {
      // `App.tsx` écrit `path={"/…"}` ou `path="/…"` selon la route : les deux
      // formes désignent le même écran, aucune n’est inventée.
      const echappe = chemin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(app).toMatch(new RegExp(`path=\\{?"${echappe}"\\}?`));
    }
  });

  it("donne à chaque rôle le droit que canAccessPath applique vraiment", () => {
    // Le contrôle porte sur les CINQ rôles, y compris `client`, même s’il n’a pas
    // de colonne : la matrice ne doit pas se tromper sur les rôles exclus.
    for (const capability of PERMISSION_CAPABILITIES) {
      for (const role of APP_ROLES) {
        expect({ capability: capability.key, role, droit: permissionFor(role, capability) }).toEqual({
          capability: capability.key,
          role,
          droit: canAccessPath(role, capability.path),
        });
      }
    }
  });

  it("refuse tout rôle non habilité ou inconnu", () => {
    for (const capability of PERMISSION_CAPABILITIES) {
      expect(permissionFor(undefined, capability)).toBe(false);
      expect(permissionFor("guest", capability)).toBe(false);
      expect(permissionFor("", capability)).toBe(false);
    }
  });

  it("accorde la console au seul rôle système", () => {
    const consoleCapabilities = PERMISSION_CAPABILITIES.filter(capability => capability.path.startsWith("/console"));

    expect(consoleCapabilities).toHaveLength(5);
    for (const capability of consoleCapabilities) {
      // RETOURNÉ — la matrice accordait la console au couple `admin` + `systeme`.
      expect(PERMISSION_MATRIX_ROLES.filter(role => permissionFor(role, capability))).toEqual(["systeme"]);
      for (const role of ["admin", "directeur", "cadre", "client"] as AppRole[]) {
        expect(permissionFor(role, capability)).toBe(false);
      }
    }
  });

  it("cantonne l’administrateur système hors du métier", () => {
    const metier = PERMISSION_CAPABILITIES.filter(capability => capability.key.startsWith("metier."));
    expect(metier.length).toBeGreaterThanOrEqual(5);

    for (const capability of metier) {
      expect(permissionFor("systeme", capability)).toBe(false);
      expect(permissionFor("cadre", capability)).toBe(true);
    }
    expect(permissionFor("systeme", PERMISSION_CAPABILITIES.find(c => c.key === "pilotage.audit")!)).toBe(false);
    expect(permissionFor("systeme", PERMISSION_CAPABILITIES.find(c => c.key === "compte.mot-de-passe")!)).toBe(true);
  });

  it("produit une matrice complète : capacités × rôles internes", () => {
    const rows = permissionMatrix();

    expect(rows).toHaveLength(PERMISSION_CAPABILITIES.length);
    for (const row of rows) {
      expect(Object.keys(row.grants).sort()).toEqual([...PERMISSION_MATRIX_ROLES].sort());
      for (const role of PERMISSION_MATRIX_ROLES) {
        expect(row.grants[role]).toBe(canAccessPath(role, row.capability.path));
      }
    }
  });
});

describe("Modèle d’habilitation — une seule source de droit", () => {
  it("dérive le droit d’écran des rôles de la procédure d’ouverture", () => {
    // Aucun rôle n’est écrit deux fois : `canAccessPath` doit rendre exactement
    // ce que la procédure d’ouverture de l’habilitation autorise.
    for (const habilitation of HABILITATIONS) {
      for (const role of APP_ROLES) {
        expect({ key: habilitation.key, role, droit: canAccessPath(role, habilitation.path) }).toEqual({
          key: habilitation.key,
          role,
          droit: habilitationRoles(habilitation).includes(role),
        });
      }
    }
  });

  it("ne déclare les capacités qu’une fois : le descripteur EST la matrice", () => {
    expect(PERMISSION_CAPABILITIES).toBe(HABILITATIONS);
  });

  it("réserve chaque habilitation de console au seul rôle système", () => {
    const consoleHabilitations = HABILITATIONS.filter(habilitation => habilitation.path.startsWith("/console"));

    expect(consoleHabilitations).toHaveLength(5);
    for (const habilitation of consoleHabilitations) {
      expect(habilitation.guards[0]).toBe("systemProcedure");
      expect(habilitationRoles(habilitation)).toEqual(["systeme"]);
      expect(habilitationRoles(habilitation)).not.toContain("admin");
    }
  });

  it("rattache un chemin de console non déclaré à l’habilitation de console", () => {
    // Le préfixe couvre les modules à venir : aucun `/console/…` ne peut
    // échapper à la règle, et donc redevenir accessible à un rôle non système.
    expect(findHabilitationForPath("/console/base")?.key).toBe("console.tableau-de-bord");
    expect(canAccessPath("systeme", "/console/base")).toBe(true);
    expect(canAccessPath("admin", "/console/base")).toBe(false);
  });

  it("retient l’habilitation la plus spécifique pour un chemin", () => {
    expect(findHabilitationForPath("/console/sante")?.key).toBe("console.sante");
    expect(findHabilitationForPath("/parametres/utilisateurs")?.key).toBe("config.comptes");
    // `/parametres/modeles/documents` n’a pas de ligne propre : il relève de
    // `/parametres/modeles`, donc de l’admin — comme avant la refonte.
    expect(findHabilitationForPath("/parametres/modeles/documents")?.key).toBe("config.modeles");
    expect(findHabilitationForPath("/aucun-ecran-declare")).toBeUndefined();
  });
});

describe("Matrice de référence — alignement avec les procédures serveur", () => {
  const trpc = readSource("server/_core/trpc.ts");

  it("exige le 403 pour chaque garde annoncé", () => {
    // `protectedProcedure` n’utilise pas `requireRoles` : il n’exige qu’une
    // session authentifiée, donc tout le vocabulaire des rôles.
    expect(trpc).toContain("export const protectedProcedure = t.procedure.use(requireUser);");
    expect(PROCEDURE_GUARD_ROLES.protectedProcedure).toEqual([...APP_ROLES]);

    for (const guard of PROCEDURE_GUARDS.filter(garde => garde !== "protectedProcedure")) {
      const rolesDuCode = guardRolesFromSource(trpc, guard);
      expect(rolesDuCode.length).toBeGreaterThan(0);
      expect({ guard, roles: [...PROCEDURE_GUARD_ROLES[guard]] }).toEqual({ guard, roles: rolesDuCode });
    }
    // RETOURNÉ — `systemProcedure` exigeait `systeme` + `admin`.
    expect(guardRolesFromSource(trpc, "systemProcedure")).toEqual(["systeme"]);
    expect(guardRolesFromSource(trpc, "adminProcedure")).toEqual(["admin"]);
    expect(guardRolesFromSource(trpc, "directionProcedure")).toEqual(["admin", "directeur"]);
    expect(guardRolesFromSource(trpc, "staffProcedure")).toEqual(["admin", "directeur", "cadre"]);
    // Gestion des comptes : admin (comptes métier) + système (comptes système).
    // Les mutations arbitrent ensuite par domaine (`assertAccountHabilitation`).
    expect(guardRolesFromSource(trpc, "usersProcedure")).toEqual(["admin", "systeme"]);
  });

  it("ne cite que des procédures réellement déclarées", () => {
    for (const capability of PERMISSION_CAPABILITIES) {
      expect(capability.guards.length).toBeGreaterThan(0);
      for (const guard of capability.guards) {
        expect(PROCEDURE_GUARDS).toContain(guard);
        expect(trpc).toContain(`export const ${guard} =`);
      }
    }
  });

  it("fait coïncider la garde d’ouverture avec le droit affiché", () => {
    // `guards[0]` ouvre l’écran : ses rôles doivent être exactement ceux que
    // `canAccessPath` accorde. C’est le point où une matrice mensongère se voit.
    for (const capability of PERMISSION_CAPABILITIES) {
      const [ouverture] = capability.guards;
      const rolesGarde = PROCEDURE_GUARD_ROLES[ouverture].filter(role =>
        (PERMISSION_MATRIX_ROLES as readonly string[]).includes(role),
      );
      const rolesMatrice = PERMISSION_MATRIX_ROLES.filter(role => permissionFor(role, capability));

      expect({ capability: capability.key, ouverture, roles: [...rolesMatrice].sort() }).toEqual({
        capability: capability.key,
        ouverture,
        roles: [...rolesGarde].sort(),
      });
    }
  });

  it("signale les écritures plus restrictives que la lecture", () => {
    const parametres = PERMISSION_CAPABILITIES.find(capability => capability.key === "config.parametres");
    expect(parametres?.guards).toEqual(["staffProcedure", "adminProcedure"]);
    expect(capabilityGuardSummary(parametres!.guards)).toContain("écriture");
    // L’admin seul écrit ce que l’équipe peut lire.
    expect(PROCEDURE_GUARD_ROLES.adminProcedure).toEqual(["admin"]);
    expect(permissionFor("cadre", parametres!)).toBe(true);
  });
});

describe("Rendu statique — écran Rôles & permissions", () => {
  it("affiche le bandeau « matrice de référence — édition à venir »", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));

    expect(html).toContain("Rôles &amp; permissions");
    expect(html).toContain("Matrice de référence");
    expect(html).toContain("Matrice de référence — édition à venir (migration requise)");
    expect(html).toContain("aucune écriture n’est possible depuis cette console");
  });

  it("rend les quatre colonnes de rôles, sans colonne client", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));

    for (const role of PERMISSION_MATRIX_ROLES) {
      expect(html).toContain(`data-testid="perm-col-${role}"`);
    }
    expect(html).toContain("Admin");
    expect(html).toContain("Directeur");
    expect(html).toContain("Cadre");
    expect(html).toContain("Administrateur système");
    expect(html).not.toContain('data-testid="perm-col-client"');
    expect(html).toContain("portail client");
  });

  it("affiche une ligne par capacité et une cellule par rôle", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));

    for (const capability of PERMISSION_CAPABILITIES) {
      expect(html).toContain(`data-testid="perm-row-${capability.key}"`);
      for (const role of PERMISSION_MATRIX_ROLES) {
        expect(html).toContain(`data-testid="perm-${capability.key}-${role}"`);
      }
    }
    expect(PERMISSION_CAPABILITIES.length).toBe(19);
  });

  it("rend exactement le droit calculé par canAccessPath, pour chaque cellule", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));

    for (const capability of PERMISSION_CAPABILITIES) {
      for (const role of PERMISSION_MATRIX_ROLES) {
        const cellule = new RegExp(
          `data-testid="perm-${capability.key.replace(/\./g, "\\.")}-${role}" data-granted="(oui|non)"`,
        );
        const trouvee = html.match(cellule);
        expect(trouvee, `cellule ${capability.key} × ${role} absente du rendu`).not.toBeNull();
        expect({ capability: capability.key, role, affiche: trouvee![1] }).toEqual({
          capability: capability.key,
          role,
          affiche: canAccessPath(role, capability.path) ? "oui" : "non",
        });
      }
    }
  });

  it("n’offre aucun contrôle modifiable : la matrice est en lecture seule", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));
    const source = readSource("client/src/components/SystemPermissions.tsx");
    const page = readSource("client/src/pages/SystemPermissionsPage.tsx");

    for (const controle of ["<button", "<input", "<select", "<textarea", "onChange", "contentEditable"]) {
      expect(html).not.toContain(controle);
      expect(source).not.toContain(controle);
    }
    expect(html).not.toContain("onClick");
    expect(source).not.toContain("onClick");
    // Aucun accès aux données : ni requête, ni mutation, ni lecture de cache.
    expect(page).not.toContain("useMutation");
    expect(source).not.toContain("useMutation");
    expect(source).not.toContain("useQuery");
    expect(source).not.toContain("useUtils");
    expect(source).not.toContain('from "@/lib/trpc"');
    expect(source).not.toContain('from "@/lib/api"');
  });

  it("explique la source unique et la séparation des devoirs", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));

    expect(html).toContain("shared/roles.ts");
    expect(html).toContain("canAccessPath");
    expect(html).toContain("Séparation des devoirs");
    expect(html).toContain("aucun accès aux données commerciales");
    expect(html).toContain("reste donc lisible même si la base est indisponible");
  });

  it("n’expose ni secret, ni empreinte, ni jeton dans le rendu", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));
    for (const interdit of ["passwordHash", "tokenHash", "mfaSecret", "postgres://"]) {
      expect(html).not.toContain(interdit);
    }
  });

  it("résume les gardes en français, sans identifiant technique nu", () => {
    expect(capabilityGuardSummary(["systemProcedure"])).toBe("console d’exploitation");
    expect(capabilityGuardSummary(["staffProcedure"])).toBe("équipe commerciale");
    expect(capabilityGuardSummary(["directionProcedure"])).toBe("direction (admin + directeur)");
    expect(capabilityGuardSummary(["adminProcedure"])).toBe("admin seulement");
    expect(capabilityGuardSummary(["protectedProcedure"])).toBe("session authentifiée");
    expect(capabilityGuardSummary(["staffProcedure", "adminProcedure"])).toBe(
      "équipe commerciale · écriture : admin seulement",
    );
  });
});

describe("Isolation de l’écran Rôles & permissions", () => {
  const app = readSource("client/src/App.tsx");
  const layout = readSource("client/src/components/DashboardLayout.tsx");
  const rail = readSource("client/src/components/SystemConsoleDashboard.tsx");
  const page = readSource("client/src/pages/SystemPermissionsPage.tsx");

  it("charge l’écran en paresseux, jamais statiquement", () => {
    expect(app).toContain('lazy(() => import("./pages/SystemPermissionsPage"))');
    expect(app).not.toContain('from "./pages/SystemPermissionsPage"');
  });

  it("garde la route /console/permissions derrière SystemGate", () => {
    expect(app).toContain('withSystemGate(SystemPermissionsPage, "Rôles & permissions")');
    expect(app).toContain('<Route path={"/console/permissions"} component={SystemPermissionsRoute} />');
  });

  it("affiche l’entrée de navigation réservée aux rôles habilités", () => {
    expect(layout).toContain('path: "/console/permissions"');
    expect(rail).toContain('path: "/console/permissions"');
    expect(rail).toContain("Rôles & permissions");
  });

  it("réserve l’écran au seul rôle système", () => {
    expect(canAccessPath("systeme", "/console/permissions")).toBe(true);
    // RETOURNÉ — l’admin ouvrait la console, il ne l’ouvre plus.
    expect(canAccessPath("admin", "/console/permissions")).toBe(false);
    for (const role of ["admin", "directeur", "cadre", "client"]) {
      expect(canAccessPath(role, "/console/permissions")).toBe(false);
    }
    expect(canAccessPath(undefined, "/console/permissions")).toBe(false);
  });

  it("rend le module navigable dans le rail de la console", () => {
    // Cinq modules livrés : les cinq portent une route (Accès & comptes et
    // Sessions actives inclus, livrés en Phase 3).
    expect(PERMISSION_CAPABILITIES.filter(capability => capability.path.startsWith("/console"))).toHaveLength(5);
    expect(page).toContain("/console/permissions");
    expect(page).toContain("ConsoleModuleRail");
    expect(page).toContain("SystemPermissionsPanel");
  });
});
