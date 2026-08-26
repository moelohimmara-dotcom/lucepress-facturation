// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  prepare: vi.fn(),
  disable: vi.fn(),
  invalidate: vi.fn(),
  integrations: [
    {
      id: 1,
      slug: "whatsapp-business",
      name: "WhatsApp Business",
      category: "communication",
      transport: "api",
      documentationUrl: "https://example.test/whatsapp",
      authType: "oauth2",
      isSupported: "oui",
      capabilities: [{ id: 1, label: "Préparer et envoyer un message approuvé", requiresApproval: "oui" }],
      connection: null,
      readiness: "a_preparer",
    },
    {
      id: 2,
      slug: "workspace-mcp",
      name: "Workspace via MCP",
      category: "collaboration",
      transport: "mcp",
      documentationUrl: "https://example.test/mcp",
      authType: "oauth2",
      isSupported: "non",
      capabilities: [{ id: 2, label: "Découvrir les outils MCP autorisés", requiresApproval: "non" }],
      connection: null,
      readiness: "non_disponible",
    },
  ],
  audit: [],
}));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children, ...props }: any) => createElement("span", props, children) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ billing: { integrations: { list: { invalidate: state.invalidate }, audit: { invalidate: state.invalidate } } } }),
  billing: {
    integrations: {
      list: { useQuery: () => ({ data: state.integrations, isLoading: false }) },
      audit: { useQuery: () => ({ data: state.audit }) },
      prepareConnection: { useMutation: () => ({ mutate: state.prepare, isPending: false, variables: undefined }) },
      disableConnection: { useMutation: () => ({ mutate: state.disable, isPending: false, variables: undefined }) },
    },
  },
} }));

import IntegrationsPage from "../client/src/pages/IntegrationsPage";

afterEach(() => { cleanup(); state.prepare.mockClear(); state.disable.mockClear(); });

describe("centre d’intégrations", () => {
  it("affiche les fournisseurs approuvés et les garanties de sécurité", () => {
    render(createElement(IntegrationsPage));
    expect(screen.getByRole("heading", { name: "Centre d’intégrations" })).toBeTruthy();
    expect(screen.getByText("WhatsApp Business")).toBeTruthy();
    expect(screen.getByText("Workspace via MCP")).toBeTruthy();
    expect(screen.getByText(/Aucun secret n’est affiché/)).toBeTruthy();
  });

  it("prépare seulement un fournisseur disponible et bloque une intégration non disponible", () => {
    render(createElement(IntegrationsPage));
    fireEvent.click(screen.getByRole("button", { name: "Préparer l’accès" }));
    expect(state.prepare).toHaveBeenCalledWith({ providerSlug: "whatsapp-business" });
    expect(screen.getByRole("button", { name: "Bientôt disponible" })).toHaveProperty("disabled", true);
  });
});
