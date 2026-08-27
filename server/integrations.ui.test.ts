// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
beforeEach(() => {
  window.localStorage.clear();
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:lucepress-test"), revokeObjectURL: vi.fn() });
});

describe("centre d’intégrations", () => {
  it("affiche les fournisseurs approuvés et les garanties de sécurité", () => {
    render(createElement(IntegrationsPage));
    expect(screen.getByRole("heading", { name: "Centre d’intégrations" })).toBeTruthy();
    expect(screen.getAllByText("WhatsApp Business").length).toBeGreaterThan(0);
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

  it("permet de modifier, approuver et réinitialiser une demande de démonstration locale", () => {
    render(createElement(IntegrationsPage));
    expect(screen.getByText("Simulation locale · aucun envoi externe")).toBeTruthy();
    const search = screen.getByLabelText("Rechercher dans la file") as HTMLInputElement;
    const providerFilter = screen.getByLabelText("Filtrer par fournisseur") as HTMLSelectElement;
    const sort = screen.getByLabelText("Trier la file") as HTMLSelectElement;
    fireEvent.change(sort, { target: { value: "provider-asc" } });
    expect(sort.value).toBe("provider-asc");
    fireEvent.change(search, { target: { value: "Procore" } });
    expect(screen.queryByLabelText("Opération démo demo-qbo-invoice")).toBeNull();
    expect((screen.getByLabelText("Opération démo demo-procore-log") as HTMLInputElement).value).toBe("Synchroniser un rapport journalier");
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(providerFilter, { target: { value: "QuickBooks Online" } });
    expect(screen.getByLabelText("Opération démo demo-qbo-invoice")).toBeTruthy();
    fireEvent.change(providerFilter, { target: { value: "all" } });
    const operation = screen.getByLabelText("Opération démo demo-qbo-invoice") as HTMLInputElement;
    fireEvent.change(operation, { target: { value: "Synchroniser une facture de test" } });
    expect(operation.value).toBe("Synchroniser une facture de test");
    fireEvent.click(screen.getAllByRole("button", { name: "Voir les détails" })[1]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Synchroniser une facture de test")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approuver la démo" }));
    expect(screen.getByRole("status").textContent).toContain("Simulation approuvée");
    expect(screen.queryByLabelText("Opération démo demo-qbo-invoice")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    expect(screen.getByLabelText("Opération démo demo-qbo-invoice")).toBeTruthy();
  });

  it("filtre les décisions, exporte seulement la vue visible et annule une simulation historique", async () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(createElement(IntegrationsPage));
    fireEvent.click(screen.getAllByRole("button", { name: "Voir les détails" })[2]);
    fireEvent.click(screen.getByRole("button", { name: "Approuver la démo" }));
    fireEvent.change(screen.getByLabelText("Filtrer par statut de décision"), { target: { value: "approved" } });
    expect(screen.getByText("Approuvée")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exporter la file filtrée en CSV" }));
    expect(anchorClick).toHaveBeenCalled();
    const blob = (URL.createObjectURL as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as Blob;
    const csv = await blob.text();
    expect(csv).toContain("Approuvée");
    expect(csv).not.toContain("WhatsApp Business");
    fireEvent.change(screen.getByLabelText("Filtrer par statut de décision"), { target: { value: "rejected" } });
    expect(screen.getByText("Aucune simulation refusée ne correspond à ces filtres.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filtrer par statut de décision"), { target: { value: "approved" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler la décision" }));
    fireEvent.change(screen.getByLabelText("Filtrer par statut de décision"), { target: { value: "pending" } });
    expect(screen.getByLabelText("Opération démo demo-qbo-invoice")).toBeTruthy();
    anchorClick.mockRestore();
  });
});
