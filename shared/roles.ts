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
 * `systeme` en est volontairement exclu : l’ajouter exige une migration de
 * l’énumération, hors périmètre de la Phase 1 (socle, sans changement de schéma).
 * À élargir le jour où le rôle système devient persistable.
 */
export const PERSISTED_APP_ROLES = ["admin", "directeur", "cadre", "client"] as const;
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
 * `systeme` en est exclu : le compte d’exploitation n’est pas un compte
 * commercial, il se provisionne hors de cet écran.
 */
export const STAFF_ASSIGNABLE_ROLES = ["cadre", "directeur", "admin"] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

export function nextAssignableStaffRole(role: AppRole | string | undefined): StaffAssignableRole {
  if (role === "cadre") return "directeur";
  if (role === "directeur") return "admin";
  return "cadre";
}
