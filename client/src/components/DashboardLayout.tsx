import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { getEffectiveSidebarWidth, getRestorableRoute, getSidebarDensityPreference, getSidebarShortcutPath, hasSidebarOverflow, isCompactSidebar, type SidebarDensityPreference } from "@shared/sidebarNavigation";
import type { WorkspaceSearchFilters } from "@shared/workspaceSearch";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { canAccessPath, isClientRole, isStaffRole } from "@shared/roles";
import {
  ArrowRight,
  History,
  Bot,
  CalendarDays,
  CalendarClock,
  Cable,
  CircleHelp,
  CircleDollarSign,
  Check,
  ChevronDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Moon,
  PanelLeft,
  ReceiptText,
  Settings,
  Sparkles,
  Sun,
  UsersRound,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "./ui/command";

const navigationGroups = [
  { label: "Gestion commerciale", items: [
    { icon: LayoutDashboard, label: "Aujourd’hui", path: "/" },
    { icon: FileText, label: "Devis", path: "/devis" },
    { icon: ReceiptText, label: "Factures", path: "/factures" },
    { icon: UsersRound, label: "Clients", path: "/clients" },
    { icon: FolderKanban, label: "Chantiers", path: "/chantiers" },
    { icon: Wrench, label: "Prestations", path: "/prestations" },
  ] },
  { label: "Pilotage financier", items: [
    { icon: CircleDollarSign, label: "Coûts & marges", path: "/couts-chantier" },
    { icon: WalletCards, label: "Créances", path: "/creances" },
    { icon: Mail, label: "Relances", path: "/relances" },
    { icon: History, label: "Journal d’audit", path: "/journal-audit" },
    { icon: CalendarDays, label: "Calendrier", path: "/calendrier" },
  ] },
  { label: "Client", items: [
    { icon: ShieldCheck, label: "Portail client", path: "/portail-client" },
  ] },
  { label: "Agent & automatisations", items: [
    { icon: Bot, label: "Agent IA", path: "/agent-ia" },
    { icon: CalendarClock, label: "Planification IA", path: "/agent-ia/planification" },
    { icon: ScrollText, label: "Audit IA", path: "/agent-ia/audit" },
    { icon: Mail, label: "E-mails de test", path: "/agent-ia/e-mails-test" },
  ] },
  { label: "Configuration", items: [
    { icon: Cable, label: "Intégrations", path: "/integrations" },
    { icon: Settings, label: "Paramètres", path: "/parametres" },
  ] },
];


const SIDEBAR_WIDTH_KEY = "lucepress-sidebar-width";
const LAST_ROUTE_KEY = "lucepress-last-route";
const COMPACT_MODE_KEY = "lucepress-sidebar-compact";
const SIDEBAR_GUIDANCE_SEEN_KEY = "lucepress-sidebar-guidance-v3-seen";
const DEFAULT_WIDTH = 276;
const MIN_WIDTH = 224;
const MAX_WIDTH = 380;

const sidebarGuidanceSteps = [
  { eyebrow: "01 · Se repérer", title: "Votre cockpit, au bon endroit.", body: "Commencez par Aujourd’hui : une file de décisions. Le reste est regroupé par activité — commercial, financier, automatisations.", highlights: ["Aujourd’hui", "Créances", "Agent IA"] },
  { eyebrow: "02 · S’adapter", title: "Ajustez l’espace à votre rythme.", body: "Passez du thème clair au thème sombre et activez le mode compact lorsque vous avez besoin de plus de place.", highlights: ["Thème clair / sombre", "Mode compact", "Largeur ajustable"] },
  { eyebrow: "03 · Accélérer", title: "Gardez le travail en mouvement.", body: "Les raccourcis ouvrent vos points d’entrée : Alt + 1 pour Clients, Alt + 2 pour Chantiers et Alt + 3 pour l’assistant devis.", highlights: ["Alt + 1", "Alt + 2", "Alt + 3"] },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="surface-grid flex min-h-screen items-center justify-center bg-background p-5">
        <div className="card-shadow w-full max-w-md rounded-[1.75rem] border border-border bg-card p-8 text-center sm:p-10">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <span className="font-editorial text-3xl italic">L</span>
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">{LUCEPRES_PUBLIC_PROFILE.displayName}</p>
          <h1 className="font-editorial text-3xl font-semibold leading-tight">Votre gestion commerciale, avec précision.</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Connectez-vous pour accéder aux devis, factures et chantiers de l’entreprise.</p>
          <Button onClick={() => startLogin()} size="lg" className="mt-8 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-150 active:scale-[0.97]">Accéder à l’espace Lucepres</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

export function DashboardLayoutContent({ children, sidebarWidth = DEFAULT_WIDTH, setSidebarWidth }: { children: React.ReactNode; sidebarWidth?: number; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const visibleGroups = useMemo(() => {
    const role = user?.role;
    return navigationGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => canAccessPath(role, item.path)),
      }))
      .filter(group => group.items.length > 0);
  }, [user?.role]);
  const menuItems = useMemo(() => visibleGroups.flatMap(group => group.items), [visibleGroups]);
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isClientRole(user?.role)) return;
    if (canAccessPath("client", location)) return;
    setLocation("/portail-client");
  }, [user?.role, location, setLocation]);
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [hasMoreNavigation, setHasMoreNavigation] = useState(false);
  const [densityPreference, setDensityPreference] = useState<SidebarDensityPreference>(() => getSidebarDensityPreference(localStorage.getItem(COMPACT_MODE_KEY)));
  const [showSidebarHelp, setShowSidebarHelp] = useState(false);
  const [guidanceStep, setGuidanceStep] = useState(0);
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [workspaceSearchFilters, setWorkspaceSearchFilters] = useState<WorkspaceSearchFilters>({});
  const [workspaceSearchFiltersOpen, setWorkspaceSearchFiltersOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isCompact = !isCollapsed && isCompactSidebar(densityPreference, viewportWidth);
  const isMediumViewport = viewportWidth >= 768 && viewportWidth <= 1180;
  const effectiveSidebarWidth = getEffectiveSidebarWidth(sidebarWidth, isCompact);
  const guidance = sidebarGuidanceSteps[guidanceStep];
  const isFinalGuidanceStep = guidanceStep === sidebarGuidanceSteps.length - 1;
  const workspaceSearchInput = useMemo(() => ({ query: workspaceSearchQuery, filters: workspaceSearchFilters }), [workspaceSearchFilters, workspaceSearchQuery]);
  const activeWorkspaceFilterCount = [workspaceSearchFilters.kind, workspaceSearchFilters.dateFrom, workspaceSearchFilters.dateTo, workspaceSearchFilters.status, workspaceSearchFilters.amountMin !== undefined, workspaceSearchFilters.amountMax !== undefined, workspaceSearchFilters.sortBy && workspaceSearchFilters.sortBy !== "relevance"].filter(Boolean).length;
  const { data: workspaceResults = [], isFetching: isWorkspaceSearching } = trpc.billing.workspaceSearch.useQuery(workspaceSearchInput, { enabled: workspaceSearchOpen && workspaceSearchQuery.trim().length >= 2 && isStaffRole(user?.role) });

  useEffect(() => {
    const routeToRestore = getRestorableRoute(location, localStorage.getItem(LAST_ROUTE_KEY), menuItems.map(item => item.path));
    if (routeToRestore) setLocation(routeToRestore);
  }, []);

  useEffect(() => {
    if (menuItems.some(item => item.path === location)) localStorage.setItem(LAST_ROUTE_KEY, location);
  }, [location]);

  useEffect(() => {
    if (densityPreference) localStorage.setItem(COMPACT_MODE_KEY, densityPreference);
    else localStorage.removeItem(COMPACT_MODE_KEY);
  }, [densityPreference]);

  const dismissSidebarHelp = () => {
    setShowSidebarHelp(false);
    localStorage.setItem(SIDEBAR_GUIDANCE_SEEN_KEY, "true");
  };

  const setSidebarHelpOpen = (open: boolean) => {
    if (open) { setGuidanceStep(0); setShowSidebarHelp(true); }
    else dismissSidebarHelp();
  };

  const advanceGuidance = () => {
    if (guidanceStep < sidebarGuidanceSteps.length - 1) setGuidanceStep(step => step + 1);
    else dismissSidebarHelp();
  };

  const toggleDensity = () => setDensityPreference(isCompact ? "normal" : "compact");
  const closeWorkspaceSearch = () => { setWorkspaceSearchOpen(false); setWorkspaceSearchQuery(""); setWorkspaceSearchFilters({}); setWorkspaceSearchFiltersOpen(false); };
  const updateWorkspaceSearchFilter = <K extends keyof WorkspaceSearchFilters>(key: K, value: WorkspaceSearchFilters[K] | undefined) => setWorkspaceSearchFilters(current => ({ ...current, [key]: value }));
  const resetWorkspaceSearchFilters = () => setWorkspaceSearchFilters({});
  const selectWorkspaceResult = (href: string) => { closeWorkspaceSearch(); setLocation(href); };
  const resultGroups = [
    { kind: "client", label: "Clients", icon: UsersRound },
    { kind: "devis", label: "Devis", icon: FileText },
    { kind: "facture", label: "Factures", icon: ReceiptText },
    { kind: "creance", label: "Créances", icon: WalletCards },
  ].map(group => ({ ...group, results: workspaceResults.filter(result => result.kind === group.kind) }));

  useEffect(() => {
    const updateViewport = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const path = getSidebarShortcutPath(event.key, event.altKey, event.ctrlKey, event.metaKey);
      if (!path) return;
      event.preventDefault();
      setLocation(path);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setLocation]);

  useEffect(() => {
    const handleWorkspaceSearchShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) return;
      event.preventDefault();
      setWorkspaceSearchOpen(true);
    };
    window.addEventListener("keydown", handleWorkspaceSearchShortcut);
    return () => window.removeEventListener("keydown", handleWorkspaceSearchShortcut);
  }, []);

  useEffect(() => {
    const content = sidebarRef.current?.querySelector<HTMLElement>("[data-sidebar='content']");
    if (!content || isCollapsed) return;
    const updateOverflow = () => setHasMoreNavigation(hasSidebarOverflow(content.scrollHeight, content.clientHeight, content.scrollTop));
    updateOverflow();
    content.addEventListener("scroll", updateOverflow, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateOverflow) : null;
    observer?.observe(content);
    return () => { content.removeEventListener("scroll", updateOverflow); observer?.disconnect(); };
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const endResize = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", endResize);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", endResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:left-4 focus:top-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Aller au contenu principal
      </a>
      <div className="relative" data-testid="sidebar-shell" ref={sidebarRef} style={{ "--sidebar-width": `${effectiveSidebarWidth}px` } as CSSProperties}>
        <Sidebar collapsible="icon" aria-label="Navigation principale" className="border-r-0 bg-sidebar text-sidebar-foreground" disableTransition={isResizing}>
          <SidebarHeader className={`${isCompact ? "h-[78px]" : "h-[104px]"} shrink-0 justify-center px-3`}>
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] shadow-sm transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Réduire la navigation">
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && <div className="min-w-0 flex-1"><p className="font-editorial text-xl font-semibold leading-none tracking-tight">{LUCEPRES_PUBLIC_PROFILE.displayName}</p>{!isCompact && <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/55">Solutions durables · opérations</p>}</div>}
              {!isCollapsed && <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"} title={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button data-testid="sidebar-density-toggle" onClick={toggleDensity} className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label={isCompact ? "Passer au mode normal" : "Passer au mode compact"} title={isCompact ? "Passer au mode normal" : "Passer au mode compact"}>{isCompact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</button><button type="button" data-testid="sidebar-help-trigger" onClick={() => { setGuidanceStep(0); setShowSidebarHelp(true); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Ouvrir le guide d’accueil" title="Ouvrir le guide d’accueil"><CircleHelp className="h-4 w-4" /></button></div>}
            </div>
          </SidebarHeader>
          <SidebarContent className={`relative min-h-0 gap-0 overflow-y-auto ${isCompact ? "px-1 py-2" : "px-2 py-3"}`}>
            {visibleGroups.map((group, groupIndex) => <div key={group.label} className={groupIndex ? `${isCompact ? "mt-1" : "mt-4 border-t border-white/[0.08] pt-3"}` : ""}>
              {!isCollapsed && !isCompact && <p className="mb-2 px-3 text-[9px] font-extrabold uppercase tracking-[0.19em] text-sidebar-foreground/42">{group.label}</p>}
              <SidebarMenu className="gap-1">
                {group.items.map(item => <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={item.path === "/" ? location === "/" || location === "/tableau-de-bord" : location === item.path}
                    aria-current={(item.path === "/" ? location === "/" || location === "/tableau-de-bord" : location === item.path) ? "page" : undefined}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className={`${isCompact ? "h-9 rounded-lg px-2 text-[13px]" : "h-10 rounded-xl px-3 text-[13px]"} font-semibold transition-colors data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-[0_9px_22px_-14px_oklch(0.07_0.03_164/80%)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`}
                  >
                    <item.icon className="h-[17px] w-[17px]" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
              </SidebarMenu>
            </div>)}
            {hasMoreNavigation && !isCollapsed && <div aria-hidden="true" data-testid="sidebar-scroll-indicator" className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-end px-3 text-sidebar-foreground/80"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-sidebar/90 shadow-sm"><ChevronDown className="h-3.5 w-3.5 animate-pulse" /></span></div>}
          </SidebarContent>
          <SidebarFooter className={`${isCompact ? "p-2" : "p-3"} shrink-0 border-t border-white/10`}>
            {!isCollapsed && <button type="button" data-testid="sidebar-ai-assistant" onClick={() => setLocation("/devis/nouveau?assistant=1")} aria-keyshortcuts="Alt+3" aria-label="Ouvrir l’assistant IA pour créer un devis" className={`${isCompact ? "mb-0.5 rounded-xl p-2.5" : "mb-1 rounded-2xl p-3.5"} w-full border border-white/10 bg-white/[0.06] text-left transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring`}><div className="flex gap-2.5"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" /><div><p className="text-xs font-bold">Assistant IA</p>{!isCompact && <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/60">Transformez un besoin de chantier en devis à valider.</p>}</div></div></button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/15"><AvatarFallback className="bg-sidebar-primary text-xs font-extrabold text-sidebar-primary-foreground">{user?.name?.charAt(0).toUpperCase() || "L"}</AvatarFallback></Avatar>
                  {!isCollapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user?.name || "Utilisateur Lucepres"}</p>{!isCompact && <p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/55">{user?.email || "Accès sécurisé"}</p>}</div>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Se déconnecter</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner la navigation"
          tabIndex={isCollapsed ? -1 : 0}
          aria-valuenow={sidebarWidth}
          aria-valuemin={224}
          aria-valuemax={380}
          onKeyDown={e => {
            if (e.key === "ArrowLeft") setSidebarWidth(Math.max(224, sidebarWidth - 10));
            if (e.key === "ArrowRight") setSidebarWidth(Math.min(380, sidebarWidth + 10));
            if (e.key === "Home") setSidebarWidth(224);
            if (e.key === "End") setSidebarWidth(380);
          }}
          className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-sidebar-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => setIsResizing(true)}
        />
      </div>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-40 flex h-[66px] items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3">{isMobile && <SidebarTrigger className="h-9 w-9 shrink-0 rounded-xl border border-border bg-card" />}<div><p className="font-editorial text-lg font-semibold leading-none">{isMobile ? LUCEPRES_PUBLIC_PROFILE.displayName : activeMenuItem?.label ?? "Gestion"}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{isMobile ? activeMenuItem?.label ?? "Gestion" : "Recherche et accès rapides"}</p></div></div><div className="flex shrink-0 items-center gap-2"><button type="button" data-testid="workspace-search-trigger" onClick={() => setWorkspaceSearchOpen(true)} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-2.5 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:text-primary sm:min-w-56"><Search className="h-4 w-4 text-primary" /><span className="hidden sm:inline">Rechercher…</span><CommandShortcut className="hidden text-[10px] sm:inline">⌘K</CommandShortcut></button>{isMobile && <><button type="button" onClick={() => { setGuidanceStep(0); setShowSidebarHelp(true); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary shadow-sm" aria-label="Ouvrir le guide d’accueil"><CircleHelp className="h-4 w-4" /></button><button type="button" onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary shadow-sm" aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button></>}</div></header>
        <main id="main-content" tabIndex={-1} className="min-h-screen flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
      <Dialog open={showSidebarHelp} onOpenChange={setSidebarHelpOpen}>
        <DialogContent data-testid="sidebar-help" showCloseButton={false} className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[1.6rem] border-sidebar-primary/35 bg-sidebar p-0 text-sidebar-foreground shadow-2xl sm:max-w-[30rem]">
          <div className="relative"><div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sidebar-primary/20 blur-2xl" /><div className="relative p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-xs font-extrabold text-sidebar-primary-foreground">{guidanceStep + 1}/3</div><button type="button" onClick={dismissSidebarHelp} className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/65 transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Fermer le guide d’accueil"><X className="h-4 w-4" /></button></div><p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sidebar-primary">{guidance.eyebrow}</p><DialogTitle className="mt-2 font-editorial text-2xl font-semibold leading-tight text-sidebar-foreground">{guidance.title}</DialogTitle><DialogDescription className="mt-3 text-sm leading-6 text-sidebar-foreground/72">{guidance.body}</DialogDescription><div className="mt-5 flex flex-wrap gap-2">{guidance.highlights.map(highlight => <span key={highlight} className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-sidebar-foreground/85">{highlight}</span>)}</div><div className="mt-7 flex items-center justify-between gap-3 border-t border-white/[0.1] pt-4"><div className="flex items-center gap-1.5" aria-label={`Étape ${guidanceStep + 1} sur ${sidebarGuidanceSteps.length}`}>{sidebarGuidanceSteps.map((step, index) => <span key={step.eyebrow} className={`h-1.5 rounded-full transition-all ${index <= guidanceStep ? "w-7 bg-sidebar-primary" : "w-2 bg-white/20"}`} />)}</div><Button type="button" size="sm" onClick={advanceGuidance} className="h-10 rounded-xl bg-sidebar-primary px-4 text-xs font-extrabold text-sidebar-primary-foreground hover:bg-sidebar-primary/90">{isFinalGuidanceStep ? <><Check className="mr-1.5 h-3.5 w-3.5" />Terminer</> : <>Suivant<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>}</Button></div></div></div>
        </DialogContent>
      </Dialog>
      <CommandDialog open={workspaceSearchOpen} onOpenChange={open => { if (open) setWorkspaceSearchOpen(true); else closeWorkspaceSearch(); }} title="Recherche globale" description="Recherchez un client, un devis, une facture ou une créance." className="max-w-[calc(100%-2rem)] rounded-2xl border-border bg-card sm:max-w-xl">
        <CommandInput value={workspaceSearchQuery} onValueChange={setWorkspaceSearchQuery} placeholder="Client, numéro de devis, facture ou créance…" />
        <div className="border-b border-border/70 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setWorkspaceSearchFiltersOpen(open => !open)} className="inline-flex items-center gap-2 text-xs font-extrabold text-primary hover:underline" aria-expanded={workspaceSearchFiltersOpen}><SlidersHorizontal className="h-3.5 w-3.5" />Filtres avancés{activeWorkspaceFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{activeWorkspaceFilterCount}</span>}</button>
            {activeWorkspaceFilterCount > 0 && <button type="button" onClick={resetWorkspaceSearchFilters} className="text-[11px] font-bold text-muted-foreground hover:text-primary">Réinitialiser</button>}
          </div>
          {workspaceSearchFiltersOpen && <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Type<select aria-label="Filtrer par type" value={workspaceSearchFilters.kind || ""} onChange={event => updateWorkspaceSearchFilter("kind", event.target.value ? event.target.value as WorkspaceSearchFilters["kind"] : undefined)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground"><option value="">Tous les résultats</option><option value="client">Clients</option><option value="devis">Devis</option><option value="facture">Factures</option><option value="creance">Créances</option></select></label>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Statut<select aria-label="Filtrer par statut" value={workspaceSearchFilters.status || ""} onChange={event => updateWorkspaceSearchFilter("status", event.target.value || undefined)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground"><option value="">Tous les statuts</option><option value="brouillon">Brouillon</option><option value="a_envoyer">À envoyer</option><option value="envoye">Envoyé</option><option value="accepte">Accepté</option><option value="partiellement_paye">Partiellement payé</option><option value="paye">Payé</option><option value="en_retard">En retard</option><option value="a_traiter">À traiter</option><option value="contacte">Contacté</option><option value="a_rappeler">À rappeler</option></select></label>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Date de début<input aria-label="Date de début" type="date" value={workspaceSearchFilters.dateFrom || ""} onChange={event => updateWorkspaceSearchFilter("dateFrom", event.target.value || undefined)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground" /></label>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Date de fin<input aria-label="Date de fin" type="date" value={workspaceSearchFilters.dateTo || ""} onChange={event => updateWorkspaceSearchFilter("dateTo", event.target.value || undefined)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground" /></label>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Montant minimum<input aria-label="Montant minimum" type="number" min="0" step="1" placeholder="GNF" value={workspaceSearchFilters.amountMin ?? ""} onChange={event => updateWorkspaceSearchFilter("amountMin", event.target.value ? Number(event.target.value) : undefined)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground" /></label>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Montant maximum<input aria-label="Montant maximum" type="number" min="0" step="1" placeholder="GNF" value={workspaceSearchFilters.amountMax ?? ""} onChange={event => updateWorkspaceSearchFilter("amountMax", event.target.value ? Number(event.target.value) : undefined)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground" /></label>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Trier par<select aria-label="Trier les résultats" value={workspaceSearchFilters.sortBy || "relevance"} onChange={event => updateWorkspaceSearchFilter("sortBy", event.target.value as WorkspaceSearchFilters["sortBy"])} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground"><option value="relevance">Pertinence</option><option value="date">Date</option><option value="status">Statut</option><option value="amount">Montant</option></select></label>
            <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Ordre<select aria-label="Ordre de tri" value={workspaceSearchFilters.sortDirection || "desc"} onChange={event => updateWorkspaceSearchFilter("sortDirection", event.target.value as WorkspaceSearchFilters["sortDirection"])} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold normal-case tracking-normal text-foreground"><option value="desc">Décroissant</option><option value="asc">Croissant</option></select></label>
          </div>}
        </div>
        <CommandList className="max-h-[min(55vh,430px)] p-2">
          {workspaceSearchQuery.trim().length < 2 ? <CommandEmpty>Saisissez au moins deux caractères pour commencer.</CommandEmpty> : isWorkspaceSearching ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Recherche en cours…</p> : resultGroups.filter(group => group.results.length > 0).map(group => <CommandGroup key={group.kind} heading={group.label}>{group.results.map(result => <CommandItem key={`${result.kind}-${result.id}`} value={`${result.kind} ${result.title} ${result.subtitle}`} onSelect={() => selectWorkspaceResult(result.href)}><group.icon className="h-4 w-4 text-primary" /><div className="min-w-0"><p className="truncate text-sm font-bold">{result.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{result.subtitle}</p></div><ArrowRight className="ml-auto h-4 w-4 text-primary/70" /></CommandItem>)}</CommandGroup>)}
          {workspaceSearchQuery.trim().length >= 2 && !isWorkspaceSearching && workspaceResults.length === 0 && <CommandEmpty>Aucun client, document ou créance ne correspond à votre recherche.</CommandEmpty>}
        </CommandList>
      </CommandDialog>
    </>
  );
}
