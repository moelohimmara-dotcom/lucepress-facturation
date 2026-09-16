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
 * Réservé aux rôles `systeme` et `admin` — les sous-routes (`/console/sante`,
 * `/console/base`, …) sont couvertes par le préfixe.
 */
export const SYSTEM_ONLY_PATHS = ["/console"] as const;

/** Seules routes d’un compte portail client. */
export const CLIENT_PATHS = ["/portail-client", "/compte/mot-de-passe"] as const;

/**
 * Seules routes d’un compte d’administration système : la console, la page de
 * mot de passe et la 404. Séparation des devoirs — aucun écran métier.
 */
export const SYSTEM_PATHS = [...SYSTEM_ONLY_PATHS, "/compte/mot-de-passe", "/404"] as const;

function matchesPath(candidates: readonly string[], path: string): boolean {
  return candidates.some(candidate => path === candidate || path.startsWith(`${candidate}/`));
}

export function canAccessPath(role: AppRole | string | undefined, path: string): boolean {
  if (!role || !isAppRole(role)) return false;
  if (role === "client") {
    return matchesPath(CLIENT_PATHS, path);
  }
  // Console d’exploitation : croisement explicite `systeme` + `admin` (ce dernier
  // pour que l’administrateur en place puisse exploiter et tester la console).
  if (matchesPath(SYSTEM_ONLY_PATHS, path)) return hasSystemAccess(role);
  // L’administrateur système n’a accès qu’à la console, au mot de passe et à la 404.
  if (isSystemRole(role)) return matchesPath(SYSTEM_PATHS, path);
  if (role === "admin") return true;
  if (matchesPath(DIRECTION_ONLY_PATHS, path)) {
    return isDirectionRole(role);
  }
  return !matchesPath(ADMIN_ONLY_PATHS, path);
}

/**
 * Équipe commerciale — accès aux données métier.
 * L’administrateur système (`systeme`) en est volontairement exclu : la console
 * observe le système, elle ne manipule pas le commerce (séparation des devoirs).
 */
export function isStaffRole(role: AppRole | string | undefined): boolean {
  return role === "admin" || role === "directeur" || role === "cadre";
}

/** Admin ou directeur — pilotage (réattribution, rapports), pas la gestion des comptes. */
export function isDirectionRole(role: AppRole | string | undefined): boolean {
  return role === "admin" || role === "directeur";
}

export function isAdminRole(role: AppRole | string | undefined): boolean {
  return role === "admin";
}

export function isClientRole(role: AppRole | string | undefined): boolean {
  return role === "client";
}

/** Administrateur système au sens strict (rôle `systeme`). */
export function isSystemRole(role: AppRole | string | undefined): boolean {
  return role === "systeme";
}

/** Accès à la console d’exploitation : rôle `systeme` ou `admin`. */
export function hasSystemAccess(role: AppRole | string | undefined): boolean {
  return isSystemRole(role) || isAdminRole(role);
}

/**
 * Rôles internes assignables depuis la page Utilisateurs (jamais `client`).
 * `systeme` en fait partie depuis la Phase 1bis : l’administrateur système mène
 * une séparation des devoirs, mais un administrateur doit pouvoir le nommer.
 */
export const STAFF_ASSIGNABLE_ROLES = ["cadre", "directeur", "admin", "systeme"] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

/**
 * Cycle du raccourci « Passer … » de la page Utilisateurs :
 * cadre → directeur → admin → systeme → cadre.
 * Un rôle inconnu (ou absent) retombe sur `cadre`, valeur par défaut de la colonne.
 */
export function nextAssignableStaffRole(role: AppRole | string | undefined): StaffAssignableRole {
  if (role === "cadre") return "directeur";
  if (role === "directeur") return "admin";
  if (role === "admin") return "systeme";
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
  /** Gestion des comptes, des modèles, des intégrations. */
  adminProcedure: ["admin"],
  /** Pilotage et conformité, sans gestion des comptes. */
  directionProcedure: ["admin", "directeur"],
  /** Équipe commerciale : les données métier. */
  staffProcedure: ["admin", "directeur", "cadre"],
  /** Console d’exploitation : rôle système + admin (croisement explicite). */
  systemProcedure: ["systeme", "admin"],
} as const;

export type ProcedureGuard = keyof typeof GUARD_ROLES;

export const PROCEDURE_GUARD_ROLES: Record<ProcedureGuard, readonly AppRole[]> = GUARD_ROLES;

/** Procédures protégées, dans l’ordre d’ouverture décroissant. */
export const PROCEDURE_GUARDS = Object.keys(GUARD_ROLES) as ProcedureGuard[];

export type PermissionCapability = {
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
 * Capacités de référence, une ligne par écran de l’application.
 *
 * Chaque `path` est un chemin réel du routeur (`client/src/App.tsx`) et chaque
 * `guards[0]` est la procédure réellement lue par l’écran correspondant.
 */
export const PERMISSION_CAPABILITIES: readonly PermissionCapability[] = [
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
    key: "console.permissions",
    label: "Rôles & permissions",
    detail: "La présente matrice, en lecture seule.",
    path: "/console/permissions",
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

/** Capacité de référence à partir de sa clé (`undefined` si inconnue). */
export function findPermissionCapability(key: string): PermissionCapability | undefined {
  return PERMISSION_CAPABILITIES.find(capability => capability.key === key);
}

/**
 * Droit d’un rôle sur une capacité. Dérivé de `canAccessPath` : la matrice
 * affichée par la console ne peut pas contredire la règle qui commande la
 * navigation et les gardes d’écran.
 */
export function permissionFor(role: AppRole | string | undefined, capability: PermissionCapability): boolean {
  return canAccessPath(role, capability.path);
}

/** Rôles auxquels une procédure protégée accorde réellement l’accès. */
export function rolesAllowedByGuard(guard: ProcedureGuard): readonly AppRole[] {
  return PROCEDURE_GUARD_ROLES[guard];
}

export type PermissionMatrixRow = {
  capability: PermissionCapability;
  grants: Record<PermissionMatrixRole, boolean>;
};

/** Matrice complète, prête à afficher : capacités × rôles internes. */
export function permissionMatrix(): PermissionMatrixRow[] {
  return PERMISSION_CAPABILITIES.map(capability => ({
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
