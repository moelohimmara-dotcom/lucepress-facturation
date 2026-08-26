export const COMPACT_VIEWPORT_MIN = 768;
export const COMPACT_VIEWPORT_MAX = 1180;
export const COMPACT_SIDEBAR_MAX_WIDTH = 240;

export function getRestorableRoute(currentRoute: string, rememberedRoute: string | null, allowedRoutes: string[]) {
  if (currentRoute !== "/" || !rememberedRoute || !allowedRoutes.includes(rememberedRoute)) return null;
  return rememberedRoute;
}

export function isCompactSidebar(manualCompact: boolean, viewportWidth: number) {
  return manualCompact || (viewportWidth >= COMPACT_VIEWPORT_MIN && viewportWidth <= COMPACT_VIEWPORT_MAX);
}

export function getEffectiveSidebarWidth(sidebarWidth: number, compact: boolean) {
  return compact ? Math.min(sidebarWidth, COMPACT_SIDEBAR_MAX_WIDTH) : sidebarWidth;
}

export function hasSidebarOverflow(scrollHeight: number, clientHeight: number, scrollTop: number) {
  return scrollHeight > clientHeight && scrollTop + clientHeight < scrollHeight - 4;
}
