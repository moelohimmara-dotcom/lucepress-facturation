export const APP_ROLES = ["admin", "directeur", "cadre"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  directeur: "Directeur",
  cadre: "Cadre",
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/** Routes réservées à l’admin (paramètres avancés / intégrations). */
export const ADMIN_ONLY_PATHS = [
  "/integrations",
  "/parametres/utilisateurs",
  "/agent-ia",
  "/agent-ia/planification",
  "/agent-ia/audit",
  "/agent-ia/e-mails-test",
] as const;

export function canAccessPath(role: AppRole | string | undefined, path: string): boolean {
  if (!role || !isAppRole(role)) return false;
  if (role === "admin") return true;
  return !(ADMIN_ONLY_PATHS as readonly string[]).some(
    (adminPath) => path === adminPath || path.startsWith(`${adminPath}/`),
  );
}

export function isStaffRole(role: AppRole | string | undefined): boolean {
  return role === "admin" || role === "directeur" || role === "cadre";
}
