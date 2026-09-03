/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ navigate: vi.fn(), createBalanceInvoice: vi.fn() }));
const noOp = () => undefined;
const depositInvoice = { id: 21, kind: "facture" as const, invoiceStage: "acompte" as const, relatedDocumentId: 15, number: "FAC-2026-0021", status: "paye" as const, issueDate: "2026-08-26", dueDate: "2026-08-31", validUntil: null, depositPercent: null, depositDueDate: null, balanceDueDate: null, discountPercent: 0, discountAmount: 0, subtotal: 3_000_000, taxTotal: 0, total: 3_000_000, notes: null, isAiDraft: "non" as const, clientId: 2, projectId: null, clientName: "Client test", contactName: null, clientAddress: null, clientEmail: null, projectName: null, projectLocation: null, lines: [{ id: 1, description: "Acompte", quantity: "1.00", unit: "forfait", unitPrice: 3_000_000, taxRate: 0, lineTotal: 3_000_000 }], payments: [], paidAmount: 3_000_000, balanceDue: 0, isOverdue: false };

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/lib/pdf", () => ({ downloadPdfFromElement: async () => undefined }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ billing: { documents: { get: { invalidate: noOp }, list: { invalidate: noOp } }, dashboard: { invalidate: noOp } } }), billing: { documents: { get: { useQuery: () => ({ data: depositInvoice, isLoading: false }) }, createDepositInvoice: { useMutation: () => ({ mutate: noOp, isPending: false }) }, createBalanceInvoice: { useMutation: ({ onSuccess }: any) => ({ isPending: false, mutate: (input: unknown) => { state.createBalanceInvoice(input); onSuccess({ id: 32, number: "FAC-2026-0032", existing: false }); } }) }, sendByEmail: { useMutation: () => ({ mutate: noOp, isPending: false }) } }, settings: { get: { useQuery: () => ({ data: {} }) } }, payments: { create: { useMutation: () => ({ mutate: noOp, isPending: false }) } }, mailStatus: { useQuery: () => ({ data: { smtpConfigured: true } }) } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/documents/21", state.navigate], useParams: () => ({ id: "21" }) }));
vi.mock("sonner", () => ({ toast: { success: noOp, error: noOp } }));
vi.mock("../client/src/pages/DocumentsPage", () => ({ humanStatus: () => "Payé" }));

afterEach(() => { cleanup(); state.navigate.mockReset(); state.createBalanceInvoice.mockReset(); });

describe("aperçu d’acompte réglé", () => {
  it("propose la facture de solde et ouvre le brouillon créé", async () => {
    const { default: DocumentPreviewPage } = await import("../client/src/pages/DocumentPreviewPage");
    render(createElement(DocumentPreviewPage));
    fireEvent.click(screen.getByRole("button", { name: "Générer facture de solde" }));
    expect(state.createBalanceInvoice).toHaveBeenCalledWith({ depositInvoiceId: 21 });
    expect(state.navigate).toHaveBeenCalledWith("/documents/32");
  });
});
