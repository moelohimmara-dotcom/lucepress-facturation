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
