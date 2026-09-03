export const STAFF_ROLES = ["admin", "directeur", "cadre"] as const;
export const APP_ROLES = [...STAFF_ROLES, "client"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  directeur: "Directeur",
  cadre: "Cadre",
  client: "Client (portail)",
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
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

/** Seules routes d’un compte portail client. */
export const CLIENT_PATHS = ["/portail-client", "/compte/mot-de-passe"] as const;

export function canAccessPath(role: AppRole | string | undefined, path: string): boolean {
  if (!role || !isAppRole(role)) return false;
  if (role === "client") {
    return (CLIENT_PATHS as readonly string[]).some(
      (clientPath) => path === clientPath || path.startsWith(`${clientPath}/`),
    );
  }
  if (role === "admin") return true;
  return !(ADMIN_ONLY_PATHS as readonly string[]).some(
    (adminPath) => path === adminPath || path.startsWith(`${adminPath}/`),
  );
}

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

/** Rôles internes assignables depuis la page Utilisateurs (jamais `client`). */
export const STAFF_ASSIGNABLE_ROLES = ["cadre", "directeur", "admin"] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

export function nextAssignableStaffRole(role: AppRole | string | undefined): StaffAssignableRole {
  if (role === "cadre") return "directeur";
  if (role === "directeur") return "admin";
  return "cadre";
}
