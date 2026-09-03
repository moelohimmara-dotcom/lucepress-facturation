/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ navigate: vi.fn(), createDepositInvoice: vi.fn(), createBalanceInvoice: vi.fn() }));
const noOp = () => undefined;
const quote = { id: 15, kind: "devis" as const, number: "DEV-2026-0015", status: "accepte" as const, issueDate: "2026-08-26", dueDate: null, validUntil: "2026-09-26", depositPercent: 30, depositDueDate: "2026-08-31", balanceDueDate: "2026-09-26", discountPercent: 10, discountAmount: 10000, subtotal: 100000, taxTotal: 10000, total: 100000, notes: null, isAiDraft: "non" as const, clientId: 2, projectId: null, clientName: "Client test", contactName: null, clientAddress: null, clientEmail: null, projectName: null, projectLocation: null, lines: [{ id: 1, description: "Intervention", quantity: "1.00", unit: "forfait", unitPrice: 100000, taxRate: 0, lineTotal: 100000 }], payments: [], paidAmount: 0, balanceDue: 0, isOverdue: false };

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/lib/pdf", () => ({ downloadPdfFromElement: async () => undefined }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ billing: { documents: { get: { invalidate: noOp }, list: { invalidate: noOp } }, dashboard: { invalidate: noOp } } }),
  billing: { documents: { get: { useQuery: () => ({ data: quote, isLoading: false }) }, createDepositInvoice: { useMutation: ({ onSuccess }: any) => ({ isPending: false, mutate: (input: unknown) => { state.createDepositInvoice(input); onSuccess({ id: 22, number: "FAC-2026-0022", existing: false }); } }) }, createBalanceInvoice: { useMutation: () => ({ isPending: false, mutate: state.createBalanceInvoice }) }, sendByEmail: { useMutation: () => ({ mutate: noOp, isPending: false }) } }, settings: { get: { useQuery: () => ({ data: {} }) } }, payments: { create: { useMutation: () => ({ mutate: noOp, isPending: false }) } } },
} }));
vi.mock("wouter", () => ({ useLocation: () => ["/documents/15", state.navigate], useParams: () => ({ id: "15" }) }));
vi.mock("sonner", () => ({ toast: { success: noOp, error: noOp } }));
vi.mock("../client/src/pages/DocumentsPage", () => ({ humanStatus: () => "Accepté" }));

afterEach(() => { cleanup(); state.navigate.mockReset(); state.createDepositInvoice.mockReset(); state.createBalanceInvoice.mockReset(); });

describe("aperçu de devis accepté", () => {
  it("génère la facture d’acompte et ouvre le document créé", async () => {
    const { default: DocumentPreviewPage } = await import("../client/src/pages/DocumentPreviewPage");
    render(createElement(DocumentPreviewPage));
    fireEvent.click(screen.getByRole("button", { name: "Générer facture d’acompte" }));
    expect(state.createDepositInvoice).toHaveBeenCalledWith({ quoteId: 15 });
    expect(state.navigate).toHaveBeenCalledWith("/documents/22");
  });
});
