// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  prepare: vi.fn(),
  disable: vi.fn(),
  startGoogleOauth: vi.fn(),
  decideApproval: vi.fn(),
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
      slug: "google-workspace",
      name: "Google Workspace",
      category: "collaboration",
      transport: "api",
      documentationUrl: "https://example.test/google",
      authType: "oauth2",
      isSupported: "oui",
      capabilities: [{ id: 2, label: "Créer une échéance de chantier", requiresApproval: "oui" }],
      connection: { id: 12, status: "credentials_pending", lastHealthCheckAt: null, lastError: null },
      readiness: "a_preparer",
    },
    {
      id: 3,
      slug: "workspace-mcp",
      name: "Workspace via MCP",
      category: "collaboration",
      transport: "mcp",
      documentationUrl: "https://example.test/mcp",
      authType: "oauth2",
      isSupported: "non",
      capabilities: [{ id: 3, label: "Découvrir les outils MCP autorisés", requiresApproval: "non" }],
      connection: null,
      readiness: "non_disponible",
    },
  ],
  audit: [],
  operationsDashboard: { connections: [], pendingApprovals: [], webhookEvents: [], summary: { activeConnections: 0, degradedConnections: 0, pendingApprovals: 0, acceptedWebhooks: 0, rejectedWebhooks: 0 } },
  approvals: [{ id: 31, providerName: "QuickBooks Online", operation: "create_invoice", payloadHash: "abcdef0123456789", createdAt: new Date() }],
  oauthSessions: [],
  runtimeReadiness: { googleOAuthConfigured: false, whatsappWebhookConfigured: false },
}));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children, ...props }: any) => createElement("span", props, children) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ billing: { integrations: { list: { invalidate: state.invalidate }, audit: { invalidate: state.invalidate }, operationsDashboard: { invalidate: state.invalidate }, pendingApprovals: { invalidate: state.invalidate }, googleOauthSessions: { invalidate: state.invalidate } } } }),
  billing: {
    integrations: {
      list: { useQuery: () => ({ data: state.integrations, isLoading: false }) },
      audit: { useQuery: () => ({ data: state.audit }) },
      runtimeReadiness: { useQuery: () => ({ data: state.runtimeReadiness }) },
      operationsDashboard: { useQuery: () => ({ data: state.operationsDashboard }) },
      pendingApprovals: { useQuery: () => ({ data: state.approvals }) },
      googleOauthSessions: { useQuery: () => ({ data: state.oauthSessions }) },
      prepareConnection: { useMutation: () => ({ mutate: state.prepare, isPending: false, variables: undefined }) },
      startGoogleOauth: { useMutation: () => ({ mutate: state.startGoogleOauth, isPending: false, variables: undefined }) },
      decideApproval: { useMutation: () => ({ mutate: state.decideApproval, isPending: false, variables: undefined }) },
      disableConnection: { useMutation: () => ({ mutate: state.disable, isPending: false, variables: undefined }) },
    },
  },
} }));

import IntegrationsPage from "../client/src/pages/IntegrationsPage";

afterEach(() => { cleanup(); state.prepare.mockClear(); state.disable.mockClear(); state.startGoogleOauth.mockClear(); state.decideApproval.mockClear(); });

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

  it("maintient OAuth désactivé sans secret tout en laissant un administrateur décider d’une écriture", () => {
    render(createElement(IntegrationsPage));
    fireEvent.change(screen.getByLabelText("Identifiant client OAuth Google"), { target: { value: "client.apps.googleusercontent.com" } });
    fireEvent.change(screen.getByLabelText("URI de redirection HTTPS"), { target: { value: "https://lucepress.example/callback/google" } });
    expect(screen.getByRole("button", { name: "OAuth désactivé — secret requis" })).toHaveProperty("disabled", true);
    expect(state.startGoogleOauth).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approuver" }));
    expect(state.decideApproval).toHaveBeenCalledWith({ jobId: 31, decision: "approve" });
  });
});
