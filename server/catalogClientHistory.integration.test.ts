import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), onOpenDocument: vi.fn() }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("wouter", () => ({ useLocation: () => ["/clients", mocks.navigate] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ billing: { clients: { list: { invalidate: vi.fn() }, attachments: { list: { invalidate: vi.fn() } } } } }),
    billing: {
      clients: {
        list: { useQuery: () => ({ data: [{ id: 1, companyName: "Bati Guinée", contactName: "Mamadou", email: "contact@bati.example", phone: "+224 600 00 00 00", address: "Conakry", taxId: "NIF-1", notes: null }] }) },
        attachments: { list: { useQuery: () => ({ data: [], isLoading: false }) } },
        activities: { list: { useQuery: () => ({ data: [{ id: "document-9", type: "document_genere", title: "Facture FAC-2026-0009 généré", description: "Document envoyé", documentId: 9, createdAt: new Date("2026-08-26") }], isLoading: false }) } },
        create: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        update: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      },
      assistant: { extractClient: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } },
    },
  },
}));
vi.mock("../client/src/components/ClientActivityTimeline", () => ({ default: ({ activities, onOpenDocument }: { activities: Array<{ documentId?: number }>; onOpenDocument: (id: number) => void }) => { if (activities[0]?.documentId) onOpenDocument(activities[0].documentId); return createElement("section", null, "Historique d’activités", createElement("button", null, "Ouvrir le document")); } }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  const states = [true, false, 1, { companyName: "", contactName: "", email: "", phone: "", address: "", taxId: "", notes: "" }, "", [], false];
  return { ...actual, useState: vi.fn((initial: unknown) => [states.length ? states.shift() : initial, vi.fn()]) };
});

import CatalogPage from "../client/src/pages/CatalogPage";

describe("fiche client avec historique", () => {
  it("affiche l’historique chargé et relie l’action au document concerné", () => {
    const html = renderToStaticMarkup(createElement(CatalogPage, { kind: "clients" }));
    expect(html).toContain("Historique d’activités");
    expect(html).toContain("Ouvrir le document");
    expect(mocks.navigate).toHaveBeenCalledWith("/documents/9");
  });
});
