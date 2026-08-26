/** @vitest-environment jsdom */
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("wouter", () => ({ useLocation: () => ["/clients", mocks.navigate] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ billing: { clients: { list: { invalidate: vi.fn() }, attachments: { list: { invalidate: vi.fn() } } } } }),
    billing: {
      clients: {
        list: { useQuery: () => ({ data: [{ id: 1, companyName: "Bati Guinée", contactName: "Mamadou", email: "contact@bati.example", phone: "+224 600 00 00 00", address: "Conakry", taxId: "NIF-1", notes: null }] }) },
        attachments: { list: { useQuery: () => ({ data: [], isLoading: false }) } },
        activities: { list: { useQuery: () => ({ data: [{ id: "payment-4", type: "paiement_enregistre", title: "Paiement de 125 000 GNF enregistré", description: "Facture FAC-2026-0009 · virement", documentId: 9, createdAt: new Date("2026-08-27") }, { id: "document-9", type: "document_genere", title: "Facture FAC-2026-0009 généré", description: "Document envoyé", documentId: 9, createdAt: new Date("2026-08-26") }], isLoading: false }) }, createNote: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } },
        create: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
        update: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      },
      assistant: { extractClient: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) }, summarizeClientHistory: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } },
    },
  },
}));

import CatalogPage from "../client/src/pages/CatalogPage";

describe("fiche client — historique utilisateur", () => {
  it("ouvre une fiche existante, affiche son historique et navigue après le clic sur le document", async () => {
    const user = userEvent.setup();
    render(createElement(CatalogPage, { kind: "clients" }));
    await user.click(screen.getByRole("button", { name: /Modifier/i }));
    expect(await screen.findByText("Historique d’activités")).toBeTruthy();
    expect(screen.getByText("Facture FAC-2026-0009 généré")).toBeTruthy();
    expect(screen.getByText("Paiement de 125 000 GNF enregistré")).toBeTruthy();
    const documentLinks = screen.getAllByRole("button", { name: "Ouvrir le document" });
    expect(documentLinks).toHaveLength(2);
    await user.click(documentLinks[0]!);
    expect(mocks.navigate).toHaveBeenCalledWith("/documents/9");
  });
});
