import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const noOp = () => undefined;
const document = { id: 1, kind: "devis" as const, number: "DEV-2026-0001", status: "envoye" as const, issueDate: "2026-08-26", dueDate: null, validUntil: "2026-09-26", depositPercent: 30, depositDueDate: "2026-08-31", balanceDueDate: "2026-09-26", subtotal: 100000, taxTotal: 0, total: 100000, notes: "Règlement à échéance.", isAiDraft: "non" as const, clientId: 2, projectId: null, clientName: "Client test", contactName: "Kadiatou Camara", clientAddress: "Conakry", clientEmail: "client@example.com", projectName: null, projectLocation: null, lines: [{ id: 1, description: "Forage", quantity: "1.00", unit: "forfait", unitPrice: 100000, taxRate: 0, lineTotal: 100000 }], payments: [], paidAmount: 0, balanceDue: 0, isOverdue: false };
const company = { id: 1, legalName: "Lucepress Guinée SARL", legalAddress: "Kaloum, Conakry", phone: "+224 600 00 00 00", email: "contact@lucepress.example", website: null, taxId: "NIF-123", registrationNumber: "RCCM-456", bankName: "Banque Guinée", accountName: "Lucepress Guinée SARL", accountNumber: "00123456", iban: "GN001", swift: "BGNQGN22", paymentInstructions: "Indiquez le numéro de facture.", documentFooter: "Merci de votre confiance.", updatedAt: new Date() };

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/pdf", () => ({ downloadPdfFromElement: async () => undefined }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ billing: { documents: { get: { invalidate: noOp }, list: { invalidate: noOp } }, dashboard: { invalidate: noOp } } }), billing: { documents: { get: { useQuery: () => ({ data: document, isLoading: false }) }, createDepositInvoice: { useMutation: () => ({ mutate: noOp, isPending: false }) } }, settings: { get: { useQuery: () => ({ data: company }) } }, payments: { create: { useMutation: () => ({ mutate: noOp, isPending: false }) } } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/documents/1", noOp], useParams: () => ({ id: "1" }) }));
vi.mock("sonner", () => ({ toast: { success: noOp, error: noOp } }));
vi.mock("../client/src/pages/DocumentsPage", () => ({ humanStatus: () => "Envoyé" }));

describe("DocumentPreviewPage avec paramètres entreprise", () => {
  it("affiche les mentions légales, bancaires, pied personnalisé et échéancier dans le rendu exportable", async () => {
    const { default: DocumentPreviewPage } = await import("../client/src/pages/DocumentPreviewPage");
    const html = renderToStaticMarkup(createElement(DocumentPreviewPage));
    expect(html).toContain("Lucepress Guinée SARL");
    expect(html).toContain("Kaloum, Conakry");
    expect(html).toContain("Banque Guinée");
    expect(html).toContain("IBAN : GN001");
    expect(html).toContain("Merci de votre confiance.");
    expect(html).toContain("Échéancier de règlement proposé");
    expect(html).toContain("Acompte · 30%");
    expect(html).toContain("70 000 GNF");
  });
});
