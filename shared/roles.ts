export const STAFF_ROLES = ["admin", "directeur", "cadre", "systeme"] as const;
export const APP_ROLES = [...STAFF_ROLES, "client"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  directeur: "Directeur",
  cadre: "Cadre",
  systeme: "Administrateur système",
  client: "Client (portail)",
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Rôles acceptés par la colonne `users.role` (énumération `role_admin_directeur`).
 * `systeme` en fait partie : depuis la Phase 1bis l’énumération PostgreSQL le
 * porte, le rôle système est donc un vrai rôle persistable, pas un drapeau.
 */
export const PERSISTED_APP_ROLES = ["admin", "directeur", "cadre", "client", "systeme"] as const;
export type PersistedAppRole = (typeof PERSISTED_APP_ROLES)[number];

export function isPersistedAppRole(value: string): value is PersistedAppRole {
  return (PERSISTED_APP_ROLES as readonly string[]).includes(value);
}

/** Routes réservées à l’admin (paramètres avancés / intégrations). */
export const ADMIN_ONLY_PATHS = [
  "/integrations",
  "/parametres/utilisateurs",
  "/parametres/e-mails",
  "/parametres/modeles",
  "/agent-ia",
  "/agent-ia/planification",
  "/agent-ia/audit",
  "/agent-ia/e-mails-test",
] as const;

/** Routes réservées à l’admin ou au directeur (pilotage / conformité). */
export const DIRECTION_ONLY_PATHS = ["/journal-audit"] as const;

/**
 * Espace de noms de la console d’exploitation (administration système).
 *
 * HABILITATION DURCIE : `systeme` seul. L’accès partagé avec `admin` (Phases 1
 * → 3B1) était un compromis d’essai ; il est retiré. Les sous-routes
 * (`/console/sante`, `/console/metier`, …) sont couvertes par le préfixe, y
 * compris celles qui n’existent pas encore — un chemin inconnu sous `/console`
 * n’ouvre donc aucune porte dérobée.
 *
 * Ce n’est PAS la liste des écrans ouverts au rôle système : depuis que
 * l’administrateur système est un super-administrateur, il ouvre toute
 * l’application (voir `canAccessPath`). Cette constante délimite la console —
 * l’espace que LUI SEUL peut ouvrir, et qui reste fermé à tous les autres.
 */
export const SYSTEM_ONLY_PATHS = ["/console"] as const;

/** Seules routes d’un compte portail client. */
export const CLIENT_PATHS = ["/portail-client", "/compte/mot-de-passe"] as const;

function matchesPath(candidates: readonly string[], path: string): boolean {
  return candidates.some(candidate => path === candidate || path.startsWith(`${candidate}/`));
}

/* ------------------------------------------------------------------ */
/* Modèle d’habilitation — SOURCE UNIQUE DU DROIT                      */
/* ------------------------------------------------------------------ */

/**
 * Rôles réellement exigés par chaque procédure protégée de
 * `server/_core/trpc.ts`.
 *
 * Ces listes sont recopiées ici parce que la console les AFFICHE : un test les
 * confronte au code de `trpc.ts` et à `canAccessPath`. Toute divergence fait
 * échouer la suite plutôt que d’afficher une matrice qui promet autre chose que
 * ce que le serveur applique.
 */
const GUARD_ROLES = {
  /** Toute session authentifiée, portail client compris. */
  protectedProcedure: ["admin", "directeur", "cadre", "systeme", "client"],
  /**
   * Administration MÉTIER : comptes collaborateurs, modèles, intégrations.
   *
   * Le rôle `systeme` y figure depuis que l’administrateur système est un
   * super-administrateur : il ouvre toute l’application. Ce qui ne change pas,
   * c’est le DOMAINE de chaque rôle dans les mutations de comptes (voir
   * `usersProcedure`) : un `admin` ne peut pas fabriquer de compte `systeme`.
   */
  adminProcedure: ["admin", "systeme"],
  /** Pilotage et conformité, sans gestion des comptes. */
  directionProcedure: ["admin", "directeur", "systeme"],
  /** Équipe commerciale : les données métier. */
  staffProcedure: ["admin", "directeur", "cadre", "systeme"],
  /**
   * Gestion des comptes — DEUX rôles, mais deux DOMAINES distincts.
   *
   * Le garde ouvre la porte ; les mutations arbitrent ensuite par domaine
   * (`assertAccountHabilitation`, `server/routers.ts`) :
   * - un `admin` ne peut agir que sur les comptes MÉTIER (cadre, directeur,
   *   admin) — jamais sur un compte `systeme`, ni créer/promouvoir vers lui ;
   * - un `systeme` ne peut agir que sur les comptes SYSTÈME — il ne distribue
   *   pas les rôles du commerce.
   *
   * C’est ce domaine qui ferme l’escalade de privilèges : sans lui, un admin
   * pourrait fabriquer un compte `systeme` et s’octroyer la console.
   */
  usersProcedure: ["admin", "systeme"],
  /** Console d’exploitation : rôle système, et lui seul. */
  systemProcedure: ["systeme"],
} as const;

export type ProcedureGuard = keyof typeof GUARD_ROLES;

export const PROCEDURE_GUARD_ROLES: Record<ProcedureGuard, readonly AppRole[]> = GUARD_ROLES;

/** Procédures protégées, dans l’ordre d’ouverture décroissant. */
export const PROCEDURE_GUARDS = Object.keys(GUARD_ROLES) as ProcedureGuard[];

/**
 * Une habilitation = un écran (ou un espace de noms d’écrans) + la procédure
 * serveur qui applique la même règle.
 *
 * Les RÔLES ne sont pas recopiés ici : ils sont LUS dans `guards[0]`, la
 * procédure qui ouvre l’écran. C’est ce qui garantit qu’un écran ne peut pas
 * être ouvert par un rôle que la procédure serveur refuse, et inversement.
 */
export type Habilitation = {
  key: string;
  /** Intitulé affiché dans la matrice. */
  label: string;
  /** Précision courte affichée sous l’intitulé. */
  detail: string;
  /**
   * Écran de référence de la capacité. Le droit affiché n’est JAMAIS écrit à la
   * main : il est dérivé de `canAccessPath(role, path)`, c’est-à-dire de la règle
   * qui commande réellement la navigation et les gardes d’écran.
   */
  path: string;
  /**
   * Procédures serveur appliquant la même règle.
   *
   * `guards[0]` est la procédure qui OUVRE l’écran : ses rôles coïncident
   * exactement avec `canAccessPath` sur `path` — un test le vérifie pour chaque
   * ligne. Les suivantes couvrent les écritures, plus restrictives.
   *
   * La liste est non vide par construction : une capacité sans procédure
   * serveur connue n’a rien à faire dans une matrice de référence.
   */
  guards: readonly [ProcedureGuard, ...ProcedureGuard[]];
};

/**
 * Habilitations de référence, une ligne par écran de l’application.
 *
 * Chaque `path` est un chemin réel du routeur (`client/src/App.tsx`) et chaque
 * `guards[0]` est la procédure réellement lue par l’écran correspondant.
 *
 * QUI PEUT QUOI, EN CLAIR
 * - `systeme` — SUPER-ADMINISTRATEUR : il ouvre toute l’application, écrans
 *   métier compris, ET les cinq habilitations `/console…` que lui seul porte.
 *   La console reste son espace privé ; elle n’est qu’un point d’entrée vers
 *   les écrans métier, qui restent la référence (voir `/console/metier`).
 * - `admin` — administration MÉTIER : comptes collaborateurs, modèles,
 *   intégrations, agent IA, journal d’audit. Aucune habilitation de console.
 * - `directeur` — pilotage et conformité (journal d’audit), sans les comptes.
 * - `cadre` — les données commerciales.
 * - `client` — portail client uniquement, cloisonné par `CLIENT_PATHS`.
 */
export const HABILITATIONS: readonly Habilitation[] = [
  {
    key: "console.tableau-de-bord",
    label: "Tableau de bord système",
    detail: "Santé applicative, version déployée, disponibilité.",
    path: "/console",
    guards: ["systemProcedure"],
  },
  {
    key: "console.sante",
    label: "Santé & supervision",
    detail: "Base, latence, pool, compteurs et migrations.",
    path: "/console/sante",
    guards: ["systemProcedure"],
  },
  {
    key: "console.acces",
    label: "Accès & comptes",
    detail: "Comptes staff et portail, invitations, moyens d’accès.",
    path: "/console/acces",
    guards: ["systemProcedure"],
  },
  {
    key: "console.sessions",
    label: "Sessions actives",
    detail: "Sessions ouvertes de l’instance, révocation à distance.",
    path: "/console/sessions",
    guards: ["systemProcedure"],
  },
  {
    key: "console.permissions",
    label: "Rôles & permissions",
    detail: "La présente matrice, en lecture seule.",
    path: "/console/permissions",
    guards: ["systemProcedure"],
  },
  {
    key: "console.metier",
    label: "Données & métier",
    detail: "Hub vers les écrans métier, qui restent la référence des écritures.",
    path: "/console/metier",
    guards: ["systemProcedure"],
  },
  {
    key: "console.donnees",
    label: "Données & conformité",
    detail: "Volumes, inventaire des données de recette, export préalable et purge sélective.",
    path: "/console/donnees",
    guards: ["systemProcedure"],
  },
  {
    key: "metier.documents",
    label: "Devis & factures",
    detail: "Création, envoi, encaissement, partage client.",
    path: "/devis",
    guards: ["staffProcedure"],
  },
  {
    key: "metier.clients",
    label: "Clients, chantiers & prestations",
    detail: "Fiches clients, chantiers et catalogue de prestations.",
    path: "/clients",
    guards: ["staffProcedure"],
  },
  {
    key: "metier.couts",
    label: "Coûts & marges de chantier",
    detail: "Dépenses de chantier et taux de marge.",
    path: "/couts-chantier",
    guards: ["staffProcedure"],
  },
  {
    key: "metier.creances",
    label: "Créances & recouvrement",
    detail: "Suivi des impayés, responsables et rappels.",
    path: "/creances",
    guards: ["staffProcedure"],
  },
  {
    key: "metier.relances",
    label: "Relances clients",
    detail: "Préparation et envoi des relances.",
    path: "/relances",
    guards: ["staffProcedure"],
  },
  {
    key: "metier.calendrier",
    label: "Calendrier",
    detail: "Échéances de devis, factures et paiements.",
    path: "/calendrier",
    guards: ["staffProcedure"],
  },
  {
    key: "pilotage.audit",
    label: "Journal d’audit",
    detail: "Historique des actions de l’équipe.",
    path: "/journal-audit",
    guards: ["directionProcedure"],
  },
  {
    key: "config.parametres",
    label: "Paramètres de la société",
    detail: "Lecture pour l’équipe ; écriture réservée à l’admin.",
    path: "/parametres",
    guards: ["staffProcedure", "adminProcedure"],
  },
  {
    key: "config.comptes",
    label: "Comptes collaborateurs",
    detail: "Création, rôle, réinitialisation de mot de passe, révocation.",
    path: "/parametres/utilisateurs",
    guards: ["adminProcedure"],
  },
  {
    key: "config.emails",
    label: "Modèles d’e-mail",
    detail: "Modèles de relance, d’invitation et de réinitialisation.",
    path: "/parametres/e-mails",
    guards: ["adminProcedure"],
  },
  {
    key: "config.modeles",
    label: "Modèles de devis",
    detail: "Galerie des modèles de documents.",
    path: "/parametres/modeles",
    guards: ["adminProcedure"],
  },
  {
    key: "config.integrations",
    label: "Centre d’intégrations",
    detail: "Connecteurs externes et leurs secrets.",
    path: "/integrations",
    guards: ["adminProcedure"],
  },
  {
    key: "config.agent-ia",
    label: "Agent IA & automatisations",
    detail: "Délégations, campagnes et journal de l’agent.",
    path: "/agent-ia",
    guards: ["adminProcedure"],
  },
  {
    key: "compte.mot-de-passe",
    label: "Changer son propre mot de passe",
    detail: "Exige le mot de passe actuel.",
    path: "/compte/mot-de-passe",
    guards: ["protectedProcedure"],
  },
];

/**
 * Descripteur de capacités lu par la matrice de référence de la console.
 *
 * C’est LA MÊME liste que `HABILITATIONS` — une seule déclaration, donc aucune
 * divergence possible entre le droit appliqué et le droit affiché.
 */
export const PERMISSION_CAPABILITIES: readonly Habilitation[] = HABILITATIONS;

/**
 * Rôles requis pour ouvrir une habilitation : ceux de sa procédure d’ouverture.
 * Un écran ne peut pas être ouvert par un rôle que le serveur refuse.
 */
export function habilitationRoles(habilitation: Habilitation): readonly AppRole[] {
  return PROCEDURE_GUARD_ROLES[habilitation.guards[0]];
}

/**
 * Habilitation qui commande un chemin, la plus SPÉCIFIQUE d’abord.
 *
 * `/console/sante` relève de sa propre habilitation ; `/console/inconnu` retombe
 * sur `/console`, donc sur le rôle système. Aucun chemin sous un espace de noms
 * déclaré ne peut échapper à sa règle.
 */
export function findHabilitationForPath(path: string): Habilitation | undefined {
  let best: Habilitation | undefined;
  for (const habilitation of HABILITATIONS) {
    if (path !== habilitation.path && !path.startsWith(`${habilitation.path}/`)) continue;
    if (!best || habilitation.path.length > best.path.length) best = habilitation;
  }
  return best;
}

/** Capacité de référence à partir de sa clé (`undefined` si inconnue). */
export function findPermissionCapability(key: string): Habilitation | undefined {
  return HABILITATIONS.find(capability => capability.key === key);
}

/**
 * Droit d’écran d’un rôle, dérivé de la matrice d’habilitation.
 *
 * Défaut sûr : tout rôle absent du vocabulaire, non authentifié, ou absent de la
 * matrice est refusé. Les règles résiduelles (hors matrice) ferment le reste :
 * un compte portail est cloisonné, un compte métier n’entre pas dans les écrans
 * d’administration.
 *
 * L’ADMINISTRATEUR SYSTÈME EST UN SUPER-ADMINISTRATEUR : il ouvre TOUS les
 * chemins de l’application, métier compris, en plus de la console. La console
 * n’est pas un couloir : c’est un point d’entrée. Sa particularité n’est donc
 * plus ce qu’il peut ouvrir, mais ce que LUI SEUL peut ouvrir — les habilitations
 * `/console…`, portées par `systemProcedure` (voir `SYSTEM_ONLY_PATHS`) — et ce
 * que les autres ne peuvent pas lui prendre (voir `assertAccountHabilitation`).
 */
export function canAccessPath(role: AppRole | string | undefined, path: string): boolean {
  if (!role || !isAppRole(role)) return false;
  // Portail client : cloisonné, jamais un écran interne.
  if (role === "client") return matchesPath(CLIENT_PATHS, path);
  // Espaces de noms déclarés par la matrice : le plus spécifique gagne.
  const habilitation = findHabilitationForPath(path);
  if (habilitation) return habilitationRoles(habilitation).includes(role);
  // Hors matrice : règles résiduelles. Le rôle système ouvre tout le reste.
  if (isSystemRole(role)) return true;
  if (role === "admin") return true;
  if (matchesPath(DIRECTION_ONLY_PATHS, path)) {
    return isDirectionRole(role);
  }
  return !matchesPath(ADMIN_ONLY_PATHS, path);
}

/**
 * Équipe commerciale — accès aux données métier.
 *
 * Le rôle `systeme` en fait partie : super-administrateur, il ouvre les écrans
 * métier comme l’équipe. Le prédicat reste le miroir exact de `staffProcedure`
 * (`server/_core/trpc.ts`), qui l’accepte désormais lui aussi — sans quoi les
 * écrans s’ouvriraient sur des procédures qui répondraient 403.
 */
export function isStaffRole(role: AppRole | string | undefined): boolean {
  return role === "admin" || role === "directeur" || role === "cadre" || isSystemRole(role);
}

/**
 * Admin ou directeur — pilotage (réattribution, rapports), pas la gestion des comptes.
 * Miroir de `directionProcedure`, qui accepte désormais `systeme` comme les deux autres.
 */
export function isDirectionRole(role: AppRole | string | undefined): boolean {
  return role === "admin" || role === "directeur" || isSystemRole(role);
}

/** Miroir de `adminProcedure`, qui accepte désormais `systeme` comme l’admin. */
export function isAdminRole(role: AppRole | string | undefined): boolean {
  return role === "admin" || isSystemRole(role);
}

export function isClientRole(role: AppRole | string | undefined): boolean {
  return role === "client";
}

/** Administrateur système au sens strict (rôle `systeme`). */
export function isSystemRole(role: AppRole | string | undefined): boolean {
  return role === "systeme";
}

/**
 * Habilitation de console : le rôle `systeme`, et lui seul.
 *
 * Dérivée de `canAccessPath` sur l’espace de noms `/console` — la garde d’écran
 * (`SystemGate`), la navigation latérale et la matrice de référence ne peuvent
 * donc pas diverger. `admin` n’a pas cette habilitation : il lui reste tout le
 * back-office métier, que l’administrateur système ouvre désormais lui aussi.
 *
 * Être super-administrateur ne change rien ici : la console reste l’espace que
 * `systeme` SEUL peut ouvrir, et ce prédicat est ce qui le garantit.
 */
export function hasSystemAccess(role: AppRole | string | undefined): boolean {
  return canAccessPath(role, SYSTEM_ONLY_PATHS[0]);
}

/**
 * Rôles internes assignables depuis la page Utilisateurs (jamais `client`).
 *
 * C’est l’ÉNUMÉRATION acceptée par `users.setRole` — elle décrit ce qui est
 * persistable, pas ce que chaque rôle a le droit d’attribuer. Le rôle `systeme`
 * en fait partie : un compte système peut nommer un autre compte système.
 * L’habilitation d’attribution est appliquée par la procédure (voir
 * `assertAccountHabilitation` dans `server/routers.ts`).
 */
export const STAFF_ASSIGNABLE_ROLES = ["cadre", "directeur", "admin", "systeme"] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

/**
 * Cycle du raccourci « Passer … » de la page Utilisateurs (écran d’ADMIN) :
 * cadre → directeur → admin → cadre.
 *
 * Le cycle ne propose JAMAIS `systeme` : seul un compte système peut attribuer
 * ce rôle, et il n’a pas cet écran. Proposer la promotion ferait promettre au
 * bouton une action que le serveur refuse (403).
 * Un rôle inconnu (ou absent) retombe sur `cadre`, valeur par défaut de la colonne.
 */
export function nextAssignableStaffRole(role: AppRole | string | undefined): StaffAssignableRole {
  if (role === "cadre") return "directeur";
  if (role === "directeur") return "admin";
  return "cadre";
}

/**
 * Libellé du bouton d’attribution d’un rôle (« Passer cadre », « Passer
 * administrateur système », …). Dérivé du cycle ci-dessus : le libellé ne peut
 * pas annoncer autre chose que le rôle réellement écrit par `users.setRole`.
 */
export function nextAssignableStaffRoleLabel(role: AppRole | string | undefined): string {
  return `Passer ${APP_ROLE_LABELS[nextAssignableStaffRole(role)].toLowerCase()}`;
}

/* ------------------------------------------------------------------ */
/* Matrice de permissions — descripteur de référence (lecture seule)   */
/* ------------------------------------------------------------------ */

/**
 * Rôles formant les colonnes de la matrice de référence de la console.
 *
 * Le rôle `client` en est volontairement exclu : le portail client ne partage
 * aucune capacité avec l’équipe interne (il est cloisonné par `CLIENT_PATHS`),
 * une colonne « Client » serait donc une colonne de « non » partout.
 */
export const PERMISSION_MATRIX_ROLES = ["admin", "directeur", "cadre", "systeme"] as const;
export type PermissionMatrixRole = (typeof PERMISSION_MATRIX_ROLES)[number];

/**
 * Droit d’un rôle sur une capacité. Dérivé de `canAccessPath` : la matrice
 * affichée par la console ne peut pas contredire la règle qui commande la
 * navigation et les gardes d’écran.
 */
export function permissionFor(role: AppRole | string | undefined, capability: Habilitation): boolean {
  return canAccessPath(role, capability.path);
}

/** Rôles auxquels une procédure protégée accorde réellement l’accès. */
export function rolesAllowedByGuard(guard: ProcedureGuard): readonly AppRole[] {
  return PROCEDURE_GUARD_ROLES[guard];
}

export type PermissionMatrixRow = {
  capability: Habilitation;
  grants: Record<PermissionMatrixRole, boolean>;
};

/** Matrice complète, prête à afficher : capacités × rôles internes. */
export function permissionMatrix(): PermissionMatrixRow[] {
  return HABILITATIONS.map(capability => ({
    capability,
    grants: PERMISSION_MATRIX_ROLES.reduce(
      (grants, role) => {
        grants[role] = permissionFor(role, capability);
        return grants;
      },
      {} as Record<PermissionMatrixRole, boolean>,
    ),
  }));
}
