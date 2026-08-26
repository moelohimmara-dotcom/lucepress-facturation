export const COMPACT_VIEWPORT_MIN = 768;
export const COMPACT_VIEWPORT_MAX = 1180;
export const COMPACT_SIDEBAR_MAX_WIDTH = 240;

export type SidebarDensityPreference = "compact" | "normal" | null;

export function getSidebarDensityPreference(value: string | null): SidebarDensityPreference {
  if (value === "compact" || value === "true") return "compact";
  if (value === "normal") return "normal";
  return null;
}

export function getRestorableRoute(currentRoute: string, rememberedRoute: string | null, allowedRoutes: string[]) {
  if (currentRoute !== "/" || !rememberedRoute || !allowedRoutes.includes(rememberedRoute)) return null;
  return rememberedRoute;
}

export function isCompactSidebar(preference: SidebarDensityPreference, viewportWidth: number) {
  if (preference === "compact") return true;
  if (preference === "normal") return false;
  return viewportWidth >= COMPACT_VIEWPORT_MIN && viewportWidth <= COMPACT_VIEWPORT_MAX;
}

export function getEffectiveSidebarWidth(sidebarWidth: number, compact: boolean) {
  return compact ? Math.min(sidebarWidth, COMPACT_SIDEBAR_MAX_WIDTH) : sidebarWidth;
}

export function getSidebarShortcutPath(key: string, altKey: boolean, ctrlKey = false, metaKey = false) {
  if (!altKey || ctrlKey || metaKey) return null;
  if (key === "1") return "/clients";
  if (key === "2") return "/chantiers";
  if (key === "3") return "/devis/nouveau?assistant=1";
  return null;
}

export function hasSidebarOverflow(scrollHeight: number, clientHeight: number, scrollTop: number) {
  return scrollHeight > clientHeight && scrollTop + clientHeight < scrollHeight - 4;
}
