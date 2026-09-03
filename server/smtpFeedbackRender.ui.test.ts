/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const smtp = vi.hoisted(() => ({ configured: false }));
const noOp = () => undefined;
const document = {
  id: 1,
  kind: "devis" as const,
  number: "DEV-2026-0001",
  status: "a_envoyer" as const,
  issueDate: "2026-08-26",
  dueDate: null,
  validUntil: "2026-09-26",
  depositPercent: null,
  depositDueDate: null,
  balanceDueDate: null,
  subtotal: 100000,
  taxTotal: 0,
  total: 100000,
  notes: null,
  isAiDraft: "non" as const,
  clientId: 2,
  projectId: null,
  clientName: "Client test",
  contactName: "Kadiatou Camara",
  clientAddress: "Conakry",
  clientEmail: "client@example.com",
  projectName: null,
  projectLocation: null,
  lines: [{ id: 1, description: "Forage", quantity: "1.00", unit: "forfait", unitPrice: 100000, taxRate: 0, lineTotal: 100000 }],
  payments: [],
  paidAmount: 0,
  balanceDue: 0,
  isOverdue: false,
};

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("@/lib/pdf", () => ({ downloadPdfFromElement: async () => undefined }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ billing: { documents: { get: { invalidate: noOp }, list: { invalidate: noOp } }, dashboard: { invalidate: noOp } } }),
    billing: {
      documents: {
        get: { useQuery: () => ({ data: document, isLoading: false }) },
        createDepositInvoice: { useMutation: () => ({ mutate: noOp, isPending: false }) },
        createBalanceInvoice: { useMutation: () => ({ mutate: noOp, isPending: false }) },
        sendByEmail: { useMutation: () => ({ mutate: noOp, isPending: false }) },
      },
      settings: { get: { useQuery: () => ({ data: {} }) } },
      payments: { create: { useMutation: () => ({ mutate: noOp, isPending: false }) } },
      mailStatus: { useQuery: () => ({ data: { smtpConfigured: smtp.configured } }) },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/documents/1", noOp], useParams: () => ({ id: "1" }) }));
vi.mock("sonner", () => ({ toast: { success: noOp, error: noOp } }));
vi.mock("../client/src/pages/DocumentsPage", () => ({ humanStatus: () => "À envoyer" }));

afterEach(() => {
  cleanup();
  smtp.configured = false;
});

describe("P0.3 — rendu envoi document selon SMTP", () => {
  it("désactive Envoyer et affiche le bandeau si SMTP down", async () => {
    smtp.configured = false;
    const { default: DocumentPreviewPage } = await import("../client/src/pages/DocumentPreviewPage");
    render(createElement(DocumentPreviewPage));
    const send = screen.getByRole("button", { name: /Envoyer par e-mail/i });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/le serveur SMTP n’est pas configuré/i)).toBeTruthy();
  });

  it("autorise Envoyer quand SMTP est prêt et le client a un e-mail", async () => {
    smtp.configured = true;
    const { default: DocumentPreviewPage } = await import("../client/src/pages/DocumentPreviewPage");
    render(createElement(DocumentPreviewPage));
    const send = screen.getByRole("button", { name: /Envoyer par e-mail/i });
    expect((send as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/le serveur SMTP n’est pas configuré/i)).toBeNull();
  });
});
