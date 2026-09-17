import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SystemPermissionsPanel, capabilityGuardSummary } from "../client/src/components/SystemPermissions";
import {
  ADMIN_ONLY_PATHS,
  APP_ROLES,
  CLIENT_PATHS,
  DIRECTION_ONLY_PATHS,
  HABILITATIONS,
  PERMISSION_CAPABILITIES,
  PERMISSION_MATRIX_ROLES,
  PROCEDURE_GUARD_ROLES,
  PROCEDURE_GUARDS,
  canAccessPath,
  findHabilitationForPath,
  habilitationRoles,
  hasSystemAccess,
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

    // Six modules de console : les cinq de la Phase 3, plus « Données & métier »,
    // qui ouvre l’administration système sur les écrans métier.
    expect(consoleCapabilities).toHaveLength(6);
    for (const capability of consoleCapabilities) {
      // RETOURNÉ — la matrice accordait la console au couple `admin` + `systeme`.
      expect(PERMISSION_MATRIX_ROLES.filter(role => permissionFor(role, capability))).toEqual(["systeme"]);
      for (const role of ["admin", "directeur", "cadre", "client"] as AppRole[]) {
        expect(permissionFor(role, capability)).toBe(false);
      }
    }
  });

  it("ouvre au super-administrateur les écrans métier, sans les donner aux autres", () => {
    const metier = PERMISSION_CAPABILITIES.filter(capability => capability.key.startsWith("metier."));
    expect(metier.length).toBeGreaterThanOrEqual(5);

    for (const capability of metier) {
      // RETOURNÉ — le rôle système était CANTONNÉ à la console : la matrice lui
      // refusait tout le métier. Super-administrateur, il ouvre désormais ces
      // écrans comme l’équipe — c’est le sens même du changement.
      expect(permissionFor("systeme", capability)).toBe(true);
      expect(permissionFor("cadre", capability)).toBe(true);
    }
    // Le pilotage suit la même règle : `directionProcedure` accepte `systeme`.
    expect(permissionFor("systeme", PERMISSION_CAPABILITIES.find(c => c.key === "pilotage.audit")!)).toBe(true);
    expect(permissionFor("systeme", PERMISSION_CAPABILITIES.find(c => c.key === "compte.mot-de-passe")!)).toBe(true);
    // Les écrans restés fermés au rôle système sont ceux qu’aucune habilitation
    // ne lui ouvre — et la console, elle, reste fermée aux autres.
    expect(permissionFor("admin", PERMISSION_CAPABILITIES.find(c => c.key === "console.metier")!)).toBe(false);
    expect(permissionFor("cadre", PERMISSION_CAPABILITIES.find(c => c.key === "config.comptes")!)).toBe(false);
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

    // Six habilitations de console : `systemProcedure` les porte toutes, et lui
    // seul les ouvre.
    expect(consoleHabilitations).toHaveLength(6);
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
    // RETOURNÉ — `systemProcedure` exigeait `systeme` + `admin`. La console est
    // redevenue l’espace du seul rôle système.
    expect(guardRolesFromSource(trpc, "systemProcedure")).toEqual(["systeme"]);
    // RETOURNÉ — les trois gardes métier n’acceptaient que les rôles du commerce.
    // Le rôle système, devenu super-administrateur, y figure désormais — c’est ce
    // qui ouvre l’application entière, et ce qui oblige `isAdminRole`,
    // `isDirectionRole` et `isStaffRole` à le compter (tests « Étanchéité » de
    // `systemConsole.test.ts`). Ce qui n’a PAS bougé : aucun rôle du commerce n’a
    // gagné un rôle de plus, et la console reste hors de leur portée.
    expect(guardRolesFromSource(trpc, "adminProcedure")).toEqual(["admin", "systeme"]);
    expect(guardRolesFromSource(trpc, "directionProcedure")).toEqual(["admin", "directeur", "systeme"]);
    expect(guardRolesFromSource(trpc, "staffProcedure")).toEqual(["admin", "directeur", "cadre", "systeme"]);
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
    // RETOURNÉ — l’admin SEUL écrivait ce que l’équipe peut lire. Le rôle système
    // est super-administrateur : `adminProcedure` l’accepte, l’écriture est donc
    // portée par les deux. L’écart lecture/écriture, lui, demeure : `cadre` et
    // `directeur` lisent les paramètres sans pouvoir les écrire.
    expect(PROCEDURE_GUARD_ROLES.adminProcedure).toEqual(["admin", "systeme"]);
    expect(permissionFor("cadre", parametres!)).toBe(true);
    // L’écart lecture/écriture, lui, n’a pas bougé : le cadre lit les paramètres
    // et n’ouvre pas la gestion des comptes.
    expect(canAccessPath("cadre", "/parametres")).toBe(true);
    expect(canAccessPath("cadre", "/parametres/utilisateurs")).toBe(false);
    expect(PROCEDURE_GUARD_ROLES.staffProcedure).not.toContain("client");
    expect(PROCEDURE_GUARD_ROLES.adminProcedure.length).toBeLessThan(PROCEDURE_GUARD_ROLES.staffProcedure.length);
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
    // Vingt capacités : les dix-neuf de la Phase 3, plus « Données & métier ».
    expect(PERMISSION_CAPABILITIES.length).toBe(20);
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
    // RETOURNÉ — le panneau annonçait que l’administrateur système n’avait
    // « aucun accès aux données commerciales ». C’était vrai tant qu’il était
    // cantonné à la console ; ce ne l’est plus. L’écran doit dire la règle
    // nouvelle, et surtout PLUS l’ancienne : une phrase rassurante devenue fausse
    // serait pire que pas de phrase du tout.
    expect(html).toContain("super-administrateur");
    expect(html).toContain("écrans métier compris");
    expect(html).not.toContain("aucun accès aux données commerciales");
    // Ce qui justifie la séparation des devoirs n’a pas bougé : l’admin métier,
    // lui, n’a AUCUNE habilitation de console, et ne peut pas fabriquer un compte
    // système pour s’en donner une.
    expect(html).toContain("sans aucune habilitation de console");
    expect(html).toContain("personne d’autre");
    expect(html).toContain("reste donc lisible même si la base est indisponible");
  });

  it("n’expose ni secret, ni empreinte, ni jeton dans le rendu", () => {
    const html = renderToStaticMarkup(createElement(SystemPermissionsPanel));
    for (const interdit of ["passwordHash", "tokenHash", "mfaSecret", "postgres://"]) {
      expect(html).not.toContain(interdit);
    }
  });

  it("résume les gardes en français, sans identifiant technique nu", () => {
    // Le libellé d’une procédure est LISIBLE dans `PROCEDURE_GUARD_ROLES`, jamais
    // recopié : un garde qui gagne un rôle change de libellé tout seul. Deux
    // gardes font exception, parce qu’ils ne décrivent pas une liste de rôles —
    // la console (un espace) et la session authentifiée (une condition).
    expect(capabilityGuardSummary(["systemProcedure"])).toBe("console d’exploitation");
    expect(capabilityGuardSummary(["protectedProcedure"])).toBe("session authentifiée");
    // RETOURNÉ — ces trois résumés étaient figés sur les seuls rôles du commerce
    // (« équipe commerciale », « direction (admin + directeur) », « admin
    // seulement »). Ils sont dérivés de `PROCEDURE_GUARD_ROLES` : le rôle système
    // étant super-administrateur, il apparaît désormais dans chacun, et le
    // libellé suit sans qu’une ligne ait été réécrite pour lui.
    expect(capabilityGuardSummary(["staffProcedure"])).toBe("admin + directeur + cadre + système");
    expect(capabilityGuardSummary(["directionProcedure"])).toBe("admin + directeur + système");
    expect(capabilityGuardSummary(["adminProcedure"])).toBe("admin + système");
    // Le rôle système y est nommé en toutes lettres : « admin seulement » ne
    // décrit plus `adminProcedure`, et ne doit donc plus s’afficher.
    expect(capabilityGuardSummary(["adminProcedure"])).not.toBe("admin seulement");
    expect(capabilityGuardSummary(["staffProcedure", "adminProcedure"])).toBe(
      "admin + directeur + cadre + système · écriture : admin + système",
    );
    // Aucun identifiant technique nu ne remonte à l’écran : le suffixe
    // « Procedure » d’un garde inconnu ne doit jamais s’afficher tel quel.
    for (const guard of PROCEDURE_GUARDS) {
      expect(capabilityGuardSummary([guard])).not.toMatch(/Procedure/);
    }
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
    // Depuis l’étape B2, le garde ne reçoit plus d’intitulé : il refuse
    // muettement, donc il n’a plus de message de refus à composer.
    expect(app).toContain("withSystemGate(SystemPermissionsPage)");
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
    // Six modules livrés : les cinq de la Phase 3 (Accès & comptes et Sessions
    // actives inclus), plus « Données & métier » — les six portent une route.
    expect(PERMISSION_CAPABILITIES.filter(capability => capability.path.startsWith("/console"))).toHaveLength(6);
    expect(page).toContain("/console/permissions");
    expect(page).toContain("ConsoleModuleRail");
    expect(page).toContain("SystemPermissionsPanel");
  });
});

/* ------------------------------------------------------------------ */
/* ÉTANCHÉITÉ — la contrepartie de l’ouverture                          */
/* ------------------------------------------------------------------ */

/** Équivalent local de `matchesPath` (`shared/roles.ts`), pour le témoin. */
function correspond(candidats: readonly string[], path: string): boolean {
  return candidats.some(candidat => path === candidat || path.startsWith(`${candidat}/`));
}

/**
 * LA RÈGLE D’AVANT, RÉÉCRITE POUR SERVIR DE TÉMOIN.
 *
 * Le rôle système est devenu super-administrateur : `canAccessPath`,
 * `isAdminRole`, `isDirectionRole` et `isStaffRole` ont changé, et la matrice de
 * `GUARD_ROLES` avec eux. Reste à prouver ce qui, dans ce changement, NE
 * CONCERNE PAS les quatre rôles historiques.
 *
 * Cette fonction rejoue l’ancienne règle — celle de `HEAD`, `SYSTEM_PATHS`
 * comprise — pour `admin`, `directeur`, `cadre` et `client` uniquement. Aucun de
 * ces quatre rôles ne figure dans une liste où `systeme` a été AJOUTÉ : le
 * changement ne peut donc pas les atteindre, et toute divergence entre cette
 * fonction et `canAccessPath` serait un droit gagné sans décision. Le test qui
 * suit compare les deux sur tous les chemins réels de l’application.
 */
const ANCIENS_ROLES_PAR_GARDE: Record<string, readonly string[]> = {
  protectedProcedure: ["admin", "directeur", "cadre", "systeme", "client"],
  adminProcedure: ["admin"],
  directionProcedure: ["admin", "directeur"],
  staffProcedure: ["admin", "directeur", "cadre"],
  usersProcedure: ["admin", "systeme"],
  systemProcedure: ["systeme"],
};

function ancienDroit(role: "admin" | "directeur" | "cadre" | "client", path: string): boolean {
  if (role === "client") return correspond(CLIENT_PATHS, path);
  const habilitation = findHabilitationForPath(path);
  if (habilitation) return ANCIENS_ROLES_PAR_GARDE[habilitation.guards[0]].includes(role);
  if (role === "admin") return true;
  if (correspond(DIRECTION_ONLY_PATHS, path)) return role === "directeur";
  return !correspond(ADMIN_ONLY_PATHS, path);
}

describe("Étanchéité — les quatre rôles historiques n’ont rien gagné", () => {
  /**
   * TOUS LES CHEMINS QUI COMPTENT : chaque ligne de la matrice, plus les chemins
   * réels du routeur qui n’ont pas de ligne propre, plus des chemins INCONNUS —
   * le défaut sûr se vérifie précisément sur ce qui n’est pas déclaré.
   */
  const CHEMINS = [
    ...new Set([
      ...HABILITATIONS.map(habilitation => habilitation.path),
      "/",
      "/devis",
      "/devis/nouveau",
      "/factures",
      "/chantiers",
      "/prestations",
      "/parametres/modeles/documents",
      "/404",
      "/console/inconnu",
      "/console/inconnu/profond",
      "/aucun-ecran-declare",
    ]),
  ];

  const TEMOINS = ["admin", "directeur", "cadre", "client"] as const;

  it("rend à chaque rôle témoin EXACTEMENT son droit d’avant, chemin par chemin", () => {
    for (const role of TEMOINS) {
      const ecarts = CHEMINS.map(path => ({
        role,
        path,
        avant: ancienDroit(role, path),
        apres: canAccessPath(role, path),
      })).filter(ligne => ligne.avant !== ligne.apres);

      // La comparaison est nommée : un écart s’affiche avec le rôle et le chemin,
      // donc avec le droit exact qui a été gagné.
      expect(ecarts).toEqual([]);
    }
  });

  it("ne laisse AUCUN rôle témoin entrer dans la console, ni par un chemin déclaré, ni par un inconnu", () => {
    const cheminsDeConsole = CHEMINS.filter(path => path === "/console" || path.startsWith("/console/"));

    // Le balayage porte bien sur la console : sans cette ligne, le test
    // passerait à vide si `/console…` avait disparu de la liste.
    expect(cheminsDeConsole.length).toBeGreaterThanOrEqual(8);
    for (const role of TEMOINS) {
      expect({
        role,
        console: cheminsDeConsole.filter(path => canAccessPath(role, path)),
      }).toEqual({ role, console: [] });
    }
    // Et le prédicat d’accès à la console le dit dans l’autre sens.
    for (const role of TEMOINS) {
      expect({ role, habilitations: PERMISSION_CAPABILITIES.filter(c => c.path.startsWith("/console") && permissionFor(role, c)) }).toEqual({
        role,
        habilitations: [],
      });
      expect(hasSystemAccess(role)).toBe(false);
    }
  });

  it("réserve au rôle système la console, et RIEN d’autre", () => {
    const TOUS_ROLES = [...TEMOINS, "systeme"] as const;

    // Le rôle système ouvre tous les chemins balayés : sans cette ligne,
    // l’exclusivité mesurée ci-dessous pourrait n’être qu’un refus général, et le
    // test passerait en prouvant l’inverse de ce qu’il annonce.
    expect(CHEMINS.filter(path => canAccessPath("systeme", path)).sort()).toEqual([...CHEMINS].sort());

    // Les chemins que PERSONNE d’autre que lui n’ouvre. C’est là, en une ligne,
    // que se lit la règle nouvelle : l’espace privé du super-administrateur est
    // EXACTEMENT la console. L’ouverture du métier ne lui a donc rien donné
    // d’exclusif de plus — et n’a rien retiré aux autres, qui gardent leurs
    // écrans (deuxième test ci-dessus).
    const exclusifs = CHEMINS.filter(path => {
      const ouvreurs = TOUS_ROLES.filter(role => canAccessPath(role, path));
      return ouvreurs.length === 1 && ouvreurs[0] === "systeme";
    });

    expect(exclusifs.sort()).toEqual(
      CHEMINS.filter(path => path === "/console" || path.startsWith("/console/")).sort(),
    );
    expect(exclusifs.length).toBeGreaterThanOrEqual(8);
  });
});
