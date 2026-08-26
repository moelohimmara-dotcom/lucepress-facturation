import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const client = { id: 42, companyName: "Entreprise Kankan", contactName: "Aïssatou Camara", email: "contact@kankan.example", phone: "+224 600 00 00 00", address: "Kankan" };
const noOp = () => undefined;

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ billing: { dashboard: { invalidate: noOp }, documents: { list: { invalidate: noOp }, get: { invalidate: noOp } } } }),
    billing: {
      clients: { list: { useQuery: () => ({ data: [client] }) } },
      projects: { list: { useQuery: () => ({ data: [] }) } },
      services: { list: { useQuery: () => ({ data: [] }) } },
      documents: {
        get: { useQuery: () => ({ data: undefined, isLoading: false }) },
        create: { useMutation: () => ({ mutate: noOp, isPending: false }) },
        update: { useMutation: () => ({ mutate: noOp, isPending: false }) },
      },
      assistant: { proposeQuote: { useMutation: () => ({ mutate: noOp, isPending: false }) } },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/devis/nouveau?clientId=42", noOp], useParams: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: noOp, error: noOp } }));

describe("DocumentEditorPage prérempli", () => {
  it("sélectionne le client de l’URL et affiche ses coordonnées sauvegardées", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search: "?clientId=42" } } });
    const { default: DocumentEditorPage } = await import("../client/src/pages/DocumentEditorPage");
    const html = renderToStaticMarkup(createElement(DocumentEditorPage, { kind: "devis", mode: "create" }));
    expect(html).toContain("Entreprise Kankan");
    expect(html).toContain("Informations client préremplies");
    expect(html).toContain("Aïssatou Camara");
    expect(html).toContain("Kankan");
    expect(html).toMatch(/option value="42" selected/);
  });
});
