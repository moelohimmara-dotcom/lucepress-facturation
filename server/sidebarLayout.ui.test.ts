/** @vitest-environment jsdom */
import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, name: "Responsable Lucepress", email: "contact@lucepress.example" }, logout: vi.fn() }) }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
vi.mock("@/components/ui/avatar", () => ({ Avatar: ({ children }: any) => createElement("div", null, children), AvatarFallback: ({ children }: any) => createElement("span", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenu: ({ children }: any) => createElement("div", null, children), DropdownMenuContent: ({ children }: any) => createElement("div", null, children), DropdownMenuItem: ({ children, ...props }: any) => createElement("button", props, children), DropdownMenuTrigger: ({ children }: any) => createElement("div", null, children) }));
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: any) => createElement("aside", { "data-testid": "sidebar" }, children),
  SidebarContent: ({ children, className }: any) => createElement("div", { "data-testid": "sidebar-content", className }, children),
  SidebarFooter: ({ children }: any) => createElement("footer", { "data-testid": "sidebar-footer" }, children),
  SidebarHeader: ({ children }: any) => createElement("div", null, children),
  SidebarInset: ({ children }: any) => createElement("main", null, children),
  SidebarMenu: ({ children }: any) => createElement("nav", null, children),
  SidebarMenuButton: ({ children, ...props }: any) => createElement("button", props, children),
  SidebarMenuItem: ({ children }: any) => createElement("div", null, children),
  SidebarProvider: ({ children }: any) => createElement("div", null, children),
  SidebarTrigger: () => createElement("button"),
  useSidebar: () => ({ state: "expanded", toggleSidebar: vi.fn() }),
}));

import { DashboardLayoutContent } from "../client/src/components/DashboardLayout";

describe("sidebar Lucepress sur format contraint", () => {
  it("isole l’Assistant IA dans le pied de barre et laisse Clients et Chantiers dans la navigation défilante", () => {
    render(createElement(DashboardLayoutContent, { setSidebarWidth: vi.fn() }, createElement("div", null, "Contenu")));
    const navigation = screen.getByTestId("sidebar-content");
    const footer = screen.getByTestId("sidebar-footer");

    expect(within(navigation).getByText("Clients")).toBeTruthy();
    expect(within(navigation).getByText("Chantiers")).toBeTruthy();
    expect(within(navigation).queryByText("Assistant IA")).toBeNull();
    expect(within(footer).getByText("Assistant IA")).toBeTruthy();
    expect(navigation.className).toContain("overflow-y-auto");
  });
});
