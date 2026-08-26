/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ navigate: vi.fn(), created: vi.fn(), savedDocument: null as any }));
const noOp = () => undefined;

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/components/ClientPrefillCard", () => ({ ClientPrefillCard: () => null }));
vi.mock("@/lib/pdf", () => ({ downloadPdfFromElement: async () => undefined }));
vi.mock("wouter", () => ({ useLocation: () => ["/devis/nouveau", state.navigate], useParams: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: noOp, error: noOp } }));
vi.mock("../client/src/pages/DocumentsPage", () => ({ humanStatus: () => "Brouillon" }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ billing: { dashboard: { invalidate: noOp }, documents: { list: { invalidate: noOp }, get: { invalidate: noOp } } } }),
    billing: {
      clients: { list: { useQuery: () => ({ data: [{ id: 8, companyName: "Client test", contactName: null, email: null, phone: null, address: null, defaultDiscountPercent: 10 }] }) } },
      projects: { list: { useQuery: () => ({ data: [] }) } },
      services: { list: { useQuery: () => ({ data: [
        { id: 1, code: "HYD-ETU-001", name: "Étude hydraulique", unit: "forfait", defaultUnitPrice: 250000, defaultTaxRate: 0 },
        { id: 2, code: "HYD-ADD-001", name: "Pose de conduite", unit: "ml", defaultUnitPrice: 50000, defaultTaxRate: 0 },
        { id: 3, code: "HYD-EQP-001", name: "Équipement", unit: "unité", defaultUnitPrice: 700000, defaultTaxRate: 18 },
      ] }) } },
      assistant: { proposeQuote: { useMutation: () => ({ mutate: noOp, isPending: false }) } },
      documents: {
        get: { useQuery: () => ({ data: state.savedDocument, isLoading: false }) },
        create: { useMutation: ({ onSuccess }: any) => ({ isPending: false, mutate: (input: any) => { state.created(input); state.savedDocument = { id: 44, kind: "devis", number: "DEV-2026-0044", status: "brouillon", issueDate: input.issueDate, dueDate: null, validUntil: input.validUntil, depositPercent: input.depositPercent, depositDueDate: input.depositDueDate, balanceDueDate: input.balanceDueDate, subtotal: 2_200_000, taxTotal: 126000, total: 2_326_000, notes: input.notes, isAiDraft: "non", clientId: 8, projectId: null, clientName: "Client test", contactName: null, clientAddress: null, clientEmail: null, projectName: null, projectLocation: null, lines: input.lines.map((line: any, index: number) => ({ id: index + 1, ...line, quantity: String(line.quantity), lineTotal: Math.round(line.quantity * line.unitPrice * (1 + line.taxRate / 100)) })), payments: [], paidAmount: 0, balanceDue: 0, isOverdue: false }; onSuccess({ id: 44, number: "DEV-2026-0044" }); } }) },
        update: { useMutation: () => ({ mutate: noOp, isPending: false }) }, createDepositInvoice: { useMutation: () => ({ mutate: noOp, isPending: false }) }, list: { useQuery: () => ({ data: [] }) },
      },
      settings: { get: { useQuery: () => ({ data: {} }) } },
      payments: { create: { useMutation: () => ({ mutate: noOp, isPending: false }) } },
    },
  },
}));

afterEach(() => { cleanup(); state.created.mockReset(); state.navigate.mockReset(); state.savedDocument = null; });

describe("éditeur de devis multi-services", () => {
  it("applique un modèle, modifie les lignes, enregistre l’échéancier et le restitue dans l’aperçu", async () => {
    const { default: DocumentEditorPage } = await import("../client/src/pages/DocumentEditorPage");
    const { unmount } = render(createElement(DocumentEditorPage, { kind: "devis", mode: "create" }));
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "8" } });
    fireEvent.change(screen.getByDisplayValue("Choisir un modèle"), { target: { value: "hydraulique" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer le modèle" }));
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Prévoir un échéancier"));
    fireEvent.change(screen.getByLabelText("Acompte (%)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Échéance acompte"), { target: { value: "2026-08-31" } });
    fireEvent.change(screen.getByLabelText("Échéance solde"), { target: { value: "2026-09-26" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le document" }));

    expect(state.created).toHaveBeenCalledWith(expect.objectContaining({ discountPercent: 10, depositPercent: 30, depositDueDate: "2026-08-31", balanceDueDate: "2026-09-26", lines: expect.arrayContaining([expect.objectContaining({ description: "Étude hydraulique", quantity: 2 })]) }));
    unmount();
    const { default: DocumentPreviewPage } = await import("../client/src/pages/DocumentPreviewPage");
    render(createElement(DocumentPreviewPage));
    expect(screen.getByText("Échéancier de règlement proposé")).toBeTruthy();
    expect(screen.getByText("Acompte · 30%")).toBeTruthy();
    expect(screen.getByText("Solde · 70%")).toBeTruthy();
  });
});
