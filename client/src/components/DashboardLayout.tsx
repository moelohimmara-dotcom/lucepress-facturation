import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Bot,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeft,
  ReceiptText,
  Settings,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Vue d’ensemble", path: "/" },
  { icon: FileText, label: "Devis", path: "/devis" },
  { icon: ReceiptText, label: "Factures", path: "/factures" },
  { icon: UsersRound, label: "Clients", path: "/clients" },
  { icon: FolderKanban, label: "Chantiers", path: "/chantiers" },
  { icon: Wrench, label: "Prestations", path: "/prestations" },
  { icon: Settings, label: "Paramètres", path: "/parametres" },
  { icon: Mail, label: "Relances", path: "/relances" },
];

const SIDEBAR_WIDTH_KEY = "lucepress-sidebar-width";
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
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Lucepress</p>
          <h1 className="font-editorial text-3xl font-semibold leading-tight">Votre gestion commerciale, avec précision.</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Connectez-vous pour accéder aux devis, factures et chantiers de l’entreprise.</p>
          <Button onClick={() => startLogin()} size="lg" className="mt-8 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-150 active:scale-[0.97]">Accéder à l’espace Lucepress</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location);

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
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-sidebar text-sidebar-foreground" disableTransition={isResizing}>
          <SidebarHeader className="h-[92px] justify-center px-3">
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Réduire la navigation">
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && <div className="min-w-0"><p className="font-editorial text-xl font-semibold leading-none tracking-tight">Lucepress</p><p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/55">BTP & Forage</p></div>}
            </div>
          </SidebarHeader>
          <SidebarContent className="gap-0 px-2 py-3">
            {!isCollapsed && <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45">Gestion commerciale</p>}
            <SidebarMenu className="gap-1">
              {menuItems.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl px-3 font-semibold transition-colors data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <item.icon className="h-[18px] w-[18px]" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {!isCollapsed && <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.06] p-3.5"><div className="flex gap-2.5"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" /><div><p className="text-xs font-bold">Assistant IA</p><p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/60">Transformez un besoin de chantier en devis à valider.</p></div></div></div>}
          </SidebarContent>
          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/15"><AvatarFallback className="bg-sidebar-primary text-xs font-extrabold text-sidebar-primary-foreground">{user?.name?.charAt(0).toUpperCase() || "L"}</AvatarFallback></Avatar>
                  {!isCollapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user?.name || "Utilisateur Lucepress"}</p><p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/55">{user?.email || "Accès sécurisé"}</p></div>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Se déconnecter</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-sidebar-primary/40 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
      </div>
      <SidebarInset className="bg-background">
        {isMobile && <header className="sticky top-0 z-40 flex h-[66px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur"><div className="flex items-center gap-3"><SidebarTrigger className="h-9 w-9 rounded-xl border border-border bg-card" /><div><p className="font-editorial text-lg font-semibold leading-none">Lucepress</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{activeMenuItem?.label ?? "Gestion"}</p></div></div><Bot className="h-5 w-5 text-primary" /></header>}
        <main className="min-h-screen flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
