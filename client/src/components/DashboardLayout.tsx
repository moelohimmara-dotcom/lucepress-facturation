import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { getEffectiveSidebarWidth, getRestorableRoute, getSidebarDensityPreference, getSidebarShortcutPath, hasSidebarOverflow, isCompactSidebar, type SidebarDensityPreference } from "@shared/sidebarNavigation";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import {
  Bot,
  Cable,
  CircleHelp,
  CircleDollarSign,
  ChevronDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Maximize2,
  Minimize2,
  PanelLeft,
  ReceiptText,
  Settings,
  Sparkles,
  UsersRound,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import React, { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Vue d’ensemble", path: "/tableau-de-bord" },
  { icon: FileText, label: "Devis", path: "/devis" },
  { icon: ReceiptText, label: "Factures", path: "/factures" },
  { icon: UsersRound, label: "Clients", path: "/clients" },
  { icon: FolderKanban, label: "Chantiers", path: "/chantiers" },
  { icon: CircleDollarSign, label: "Coûts & marges", path: "/couts-chantier" },
  { icon: WalletCards, label: "Créances", path: "/creances" },
  { icon: Wrench, label: "Prestations", path: "/prestations" },
  { icon: Cable, label: "Intégrations", path: "/integrations" },
  { icon: Bot, label: "Agent IA", path: "/agent-ia" },
  { icon: Settings, label: "Paramètres", path: "/parametres" },
  { icon: Mail, label: "Relances", path: "/relances" },
];

const SIDEBAR_WIDTH_KEY = "lucepress-sidebar-width";
const LAST_ROUTE_KEY = "lucepress-last-route";
const COMPACT_MODE_KEY = "lucepress-sidebar-compact";
const SIDEBAR_HELP_SEEN_KEY = "lucepress-sidebar-help-seen";
const DEFAULT_WIDTH = 276;
const MIN_WIDTH = 224;
const MAX_WIDTH = 380;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [hasMoreNavigation, setHasMoreNavigation] = useState(false);
  const [densityPreference, setDensityPreference] = useState<SidebarDensityPreference>(() => getSidebarDensityPreference(localStorage.getItem(COMPACT_MODE_KEY)));
  const [showSidebarHelp, setShowSidebarHelp] = useState(() => localStorage.getItem(SIDEBAR_HELP_SEEN_KEY) !== "true");
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isCompact = !isCollapsed && isCompactSidebar(densityPreference, viewportWidth);
  const isMediumViewport = viewportWidth >= 768 && viewportWidth <= 1180;
  const effectiveSidebarWidth = getEffectiveSidebarWidth(sidebarWidth, isCompact);

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
    localStorage.setItem(SIDEBAR_HELP_SEEN_KEY, "true");
  };

  const setSidebarHelpOpen = (open: boolean) => {
    if (open) setShowSidebarHelp(true);
    else dismissSidebarHelp();
  };

  const toggleDensity = () => setDensityPreference(isCompact ? "normal" : "compact");

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
      <div className="relative" data-testid="sidebar-shell" ref={sidebarRef} style={{ "--sidebar-width": `${effectiveSidebarWidth}px` } as CSSProperties}>
        <Sidebar collapsible="icon" className="border-r-0 bg-sidebar text-sidebar-foreground" disableTransition={isResizing}>
          <SidebarHeader className={`${isCompact ? "h-[76px]" : "h-[92px]"} shrink-0 justify-center px-3`}>
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Réduire la navigation">
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && <div className="min-w-0 flex-1"><p className="font-editorial text-xl font-semibold leading-none tracking-tight">{LUCEPRES_PUBLIC_PROFILE.displayName}</p>{!isCompact && <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/55">{LUCEPRES_PUBLIC_PROFILE.positioning}</p>}</div>}
              {!isCollapsed && <div className="flex shrink-0 items-center gap-1"><button data-testid="sidebar-density-toggle" onClick={toggleDensity} className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label={isCompact ? "Passer au mode normal" : "Passer au mode compact"} title={isCompact ? "Passer au mode normal" : "Passer au mode compact"}>{isCompact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</button><Popover open={showSidebarHelp} onOpenChange={setSidebarHelpOpen}><PopoverTrigger asChild><button data-testid="sidebar-help-trigger" className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/65 transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Afficher l’aide de navigation" title="Afficher l’aide de navigation"><CircleHelp className="h-4 w-4" /></button></PopoverTrigger><PopoverContent data-testid="sidebar-help" align={isMobile ? "start" : "center"} side={isMobile ? "bottom" : "right"} sideOffset={10} className="w-72 rounded-xl border-sidebar-primary/30 bg-sidebar p-3 text-sidebar-foreground shadow-xl"><div className="flex items-start gap-2"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" /><div className="min-w-0 flex-1"><p className="text-xs font-extrabold">Navigation rapide</p><p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/70">Utilisez le bouton voisin pour choisir le mode compact ou normal. Les raccourcis <kbd>Alt + 1</kbd>, <kbd>Alt + 2</kbd> et <kbd>Alt + 3</kbd> ouvrent Clients, Chantiers et l’assistant IA.</p></div><button onClick={dismissSidebarHelp} className="-mt-1 -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/65 hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Fermer l’aide de navigation"><X className="h-3.5 w-3.5" /></button></div></PopoverContent></Popover></div>}
            </div>
          </SidebarHeader>
          <SidebarContent className={`relative min-h-0 gap-0 overflow-y-auto ${isCompact ? "px-1 py-2" : "px-2 py-3"}`}>
            {!isCollapsed && !isCompact && <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45">Gestion commerciale</p>}
            <SidebarMenu className="gap-1">
              {menuItems.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} aria-keyshortcuts={item.path === "/clients" ? "Alt+1" : item.path === "/chantiers" ? "Alt+2" : undefined} className={`${isCompact ? "h-9 rounded-lg px-2 text-[13px]" : "h-11 rounded-xl px-3"} font-semibold transition-colors data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`}>
                    <item.icon className="h-[18px] w-[18px]" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
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
        <div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-sidebar-primary/40 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
      </div>
      <SidebarInset className="bg-background">
        {isMobile && <header className="sticky top-0 z-40 flex h-[66px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur"><div className="flex items-center gap-3"><SidebarTrigger className="h-9 w-9 rounded-xl border border-border bg-card" /><div><p className="font-editorial text-lg font-semibold leading-none">{LUCEPRES_PUBLIC_PROFILE.displayName}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{activeMenuItem?.label ?? "Gestion"}</p></div></div><Bot className="h-5 w-5 text-primary" /></header>}
        <main className="min-h-screen flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
