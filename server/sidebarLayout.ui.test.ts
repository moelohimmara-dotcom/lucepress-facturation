/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, name: "Responsable Lucepress", email: "contact@lucepress.example" }, logout: vi.fn() }) }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { billing: { workspaceSearch: { useQuery: () => ({ data: [{ id: 7, kind: "creance", title: "FAC-007", subtitle: "Créance · Kankan BTP", href: "/creances?facture=7" }], isFetching: false }) } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/", navigate] }));
vi.mock("@/components/ui/avatar", () => ({ Avatar: ({ children }: any) => createElement("div", null, children), AvatarFallback: ({ children }: any) => createElement("span", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenu: ({ children }: any) => createElement("div", null, children), DropdownMenuContent: ({ children }: any) => createElement("div", null, children), DropdownMenuItem: ({ children, ...props }: any) => createElement("button", props, children), DropdownMenuTrigger: ({ children }: any) => createElement("div", null, children) }));
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: any) => createElement("aside", { "data-testid": "sidebar" }, children),
  SidebarContent: ({ children, className }: any) => createElement("div", { "data-sidebar": "content", "data-testid": "sidebar-content", className }, children),
  SidebarFooter: ({ children }: any) => createElement("footer", { "data-testid": "sidebar-footer" }, children),
  SidebarHeader: ({ children }: any) => createElement("div", null, children),
  SidebarInset: ({ children }: any) => createElement("main", null, children),
  SidebarMenu: ({ children }: any) => createElement("nav", null, children),
  SidebarMenuButton: ({ children, isActive: _isActive, tooltip: _tooltip, ...props }: any) => createElement("button", props, children),
  SidebarMenuItem: ({ children }: any) => createElement("div", null, children),
  SidebarProvider: ({ children }: any) => createElement("div", null, children),
  SidebarTrigger: () => createElement("button"),
  useSidebar: () => ({ state: "expanded", toggleSidebar: vi.fn() }),
}));
vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({ children, open }: any) => open ? createElement("div", { "data-testid": "workspace-search-dialog" }, children) : null,
  CommandInput: ({ onValueChange, ...props }: any) => createElement("input", { ...props, onChange: (event: any) => onValueChange(event.target.value) }),
  CommandList: ({ children }: any) => createElement("div", null, children),
  CommandEmpty: ({ children }: any) => createElement("p", null, children),
  CommandGroup: ({ children }: any) => createElement("div", null, children),
  CommandItem: ({ children, onSelect }: any) => createElement("button", { onClick: onSelect }, children),
  CommandShortcut: ({ children }: any) => createElement("span", null, children),
}));

import { DashboardLayoutContent } from "../client/src/components/DashboardLayout";

describe("sidebar Lucepress sur format contraint", () => {
  it("isole l’Assistant IA dans le pied de barre et laisse Clients et Chantiers dans la navigation défilante", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    const navigation = screen.getByTestId("sidebar-content");
    const footer = screen.getByTestId("sidebar-footer");

    expect(within(navigation).getByText("Clients")).toBeTruthy();
    expect(within(navigation).getByText("Chantiers")).toBeTruthy();
    expect(within(navigation).getByText("Pilotage financier")).toBeTruthy();
    expect(within(navigation).getByText("Agent & automatisations")).toBeTruthy();
    expect(within(navigation).queryByText("Assistant IA")).toBeNull();
    expect(within(footer).getByText("Assistant IA")).toBeTruthy();
    expect(navigation.className).toContain("overflow-y-auto");
  });

  it("restaure la dernière rubrique mémorisée au chargement", () => {
    navigate.mockClear();
    localStorage.setItem("lucepress-last-route", "/clients");
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    expect(navigate).toHaveBeenCalledWith("/clients");
    localStorage.removeItem("lucepress-last-route");
  });

  it("applique une largeur compacte et affiche un repère lorsque la navigation déborde", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    class ResizeObserverMock {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        Object.defineProperties(target, {
          scrollHeight: { configurable: true, value: 700 },
          clientHeight: { configurable: true, value: 400 },
          scrollTop: { configurable: true, value: 0 },
        });
        this.callback([], this as unknown as ResizeObserver);
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    render(createElement(DashboardLayoutContent, { sidebarWidth: 276, setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    expect(screen.getByTestId("sidebar-shell").style.getPropertyValue("--sidebar-width")).toBe("240px");
    expect(screen.getByTestId("sidebar-scroll-indicator")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("ouvre à la demande une visite guidée indépendante de la navigation et mémorise sa complétion", () => {
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    expect(screen.queryByTestId("sidebar-help")).toBeNull();
    fireEvent.click(screen.getByTestId("sidebar-help-trigger"));
    expect(screen.getByTestId("sidebar-help")).toBeTruthy();
    expect(within(screen.getByTestId("sidebar-content")).queryByTestId("sidebar-help")).toBeNull();
    expect(screen.getByText("Votre cockpit, au bon endroit.")).toBeTruthy();
    fireEvent.click(screen.getByText("Suivant"));
    expect(screen.getByText("Ajustez l’espace à votre rythme.")).toBeTruthy();
    fireEvent.click(screen.getByText("Suivant"));
    expect(screen.getByText("Gardez le travail en mouvement.")).toBeTruthy();
    fireEvent.click(screen.getByText("Terminer"));
    expect(screen.queryByTestId("sidebar-help")).toBeNull();
    expect(localStorage.getItem("lucepress-sidebar-guidance-v3-seen")).toBe("true");
  });

  it("permet de choisir manuellement le mode compact ou normal", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    render(createElement(DashboardLayoutContent, { sidebarWidth: 276, setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    const sidebar = screen.getByTestId("sidebar-shell");
    expect(sidebar.style.getPropertyValue("--sidebar-width")).toBe("276px");
    fireEvent.click(screen.getByTestId("sidebar-density-toggle"));
    expect(sidebar.style.getPropertyValue("--sidebar-width")).toBe("240px");
    expect(localStorage.getItem("lucepress-sidebar-compact")).toBe("compact");
    fireEvent.click(screen.getByTestId("sidebar-density-toggle"));
    expect(sidebar.style.getPropertyValue("--sidebar-width")).toBe("276px");
    expect(localStorage.getItem("lucepress-sidebar-compact")).toBe("normal");
  });

  it("navigue par raccourci vers Clients, Chantiers et l’assistant IA", () => {
    navigate.mockClear();
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    fireEvent.keyDown(window, { key: "1", altKey: true });
    fireEvent.keyDown(window, { key: "2", altKey: true });
    fireEvent.keyDown(window, { key: "3", altKey: true });
    expect(navigate).toHaveBeenCalledWith("/clients");
    expect(navigate).toHaveBeenCalledWith("/chantiers");
    expect(navigate).toHaveBeenCalledWith("/devis/nouveau?assistant=1");
  });

  it("ouvre la recherche globale depuis l’en-tête ou le raccourci Ctrl+K", () => {
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("workspace-search-dialog")).toBeTruthy();
    expect(screen.getByText("Saisissez au moins deux caractères pour commencer.")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Client, numéro de devis, facture ou créance…"), { target: { value: "fac" } });
    expect(screen.getByText("FAC-007")).toBeTruthy();
  });

  it("ouvre les filtres avancés de type, statut, période et montant", () => {
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    fireEvent.click(screen.getByTestId("workspace-search-trigger"));
    fireEvent.click(screen.getByRole("button", { name: /Filtres avancés/ }));
    expect(screen.getByLabelText("Filtrer par type")).toBeTruthy();
    expect(screen.getByLabelText("Date de début")).toBeTruthy();
    expect(screen.getByLabelText("Montant minimum")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filtrer par statut"), { target: { value: "envoye" } });
    fireEvent.change(screen.getByLabelText("Montant minimum"), { target: { value: "500000" } });
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("ignore les raccourcis lorsque l’utilisateur saisit du texte", () => {
    navigate.mockClear();
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "1", altKey: true });
    expect(navigate).not.toHaveBeenCalledWith("/clients");
    input.remove();
  });
});
