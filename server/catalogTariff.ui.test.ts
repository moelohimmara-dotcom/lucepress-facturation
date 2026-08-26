/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ catalog: [{ id: 12, code: "HYD-ETU-001", name: "Étude hydraulique", category: "hydraulique", description: null, unit: "forfait", defaultUnitPrice: 0, defaultTaxRate: 0, isActive: "oui" }], noOp: () => undefined, setCatalog: null as any }));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => createElement("div", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: any) => createElement("button", props, children) }));
vi.mock("wouter", () => ({ useLocation: () => ["/prestations", state.noOp] }));
vi.mock("sonner", () => ({ toast: { success: state.noOp, error: state.noOp } }));
vi.mock("@/lib/trpc", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return { trpc: {
    useUtils: () => ({ billing: { clients: { list: { invalidate: state.noOp } }, projects: { list: { invalidate: state.noOp } }, services: { list: { invalidate: state.noOp, setData: (_input: unknown, updater: (current: typeof state.catalog) => typeof state.catalog) => state.setCatalog((current: typeof state.catalog) => updater(current)) } } } }),
    billing: {
      clients: { list: { useQuery: () => ({ data: [] }) } },
      projects: { list: { useQuery: () => ({ data: [] }) }, create: { useMutation: () => ({ mutate: state.noOp, isPending: false }) } },
      services: {
        list: { useQuery: () => { const [catalog, setCatalog] = React.useState(state.catalog); state.setCatalog = setCatalog; return { data: catalog }; } },
        create: { useMutation: () => ({ mutate: state.noOp, isPending: false }) },
        updateTariff: { useMutation: ({ onSuccess }: any) => ({ isPending: false, mutate: (input: any) => onSuccess({ success: true }, input) }) },
      },
    },
  } };
});

import CatalogPage from "../client/src/pages/CatalogPage";

afterEach(() => { cleanup(); Object.assign(state.catalog[0], { defaultUnitPrice: 0, defaultTaxRate: 0 }); });

describe("répertoire Prestations", () => {
  it("rafraîchit le prix et la taxe affichés après la modification d’un tarif", () => {
    render(createElement(CatalogPage, { kind: "prestations" }));
    fireEvent.click(screen.getByRole("button", { name: "Tarif" }));
    fireEvent.change(screen.getByLabelText("Prix unitaire (GNF) *"), { target: { value: "450000" } });
    fireEvent.change(screen.getByLabelText("Taux de taxe (%)"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le tarif" }));
    expect(screen.getByText(/450.*000.*GNF/)).toBeTruthy();
    expect(screen.getByText("Taxe 18%")).toBeTruthy();
  });
});
