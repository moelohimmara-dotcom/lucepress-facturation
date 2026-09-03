import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/SettingsPage.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const gateSource = readFileSync(resolve(process.cwd(), "client/src/components/AdminGate.tsx"), "utf8");

const authState = vi.hoisted(() => ({ role: "cadre" as string }));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 2, role: authState.role, name: "Cadre", email: "cadre@x.com" }, loading: false }),
}));
vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ billing: { settings: { get: { invalidate: () => undefined } } } }),
    billing: {
      settings: {
        get: { useQuery: () => ({ data: { legalName: "Lucepres Sarl" }, isLoading: false }) },
        save: { useMutation: () => ({ mutate: () => undefined, isPending: false }) },
      },
      mailStatus: { useQuery: () => ({ data: { smtpConfigured: true } }) },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: () => undefined, error: () => undefined } }));

(globalThis as { React?: typeof React }).React = React;

describe("P0.1 — Paramètres UI alignés sur les droits", () => {
  it("n’expose Enregistrer / comptes / templates que si isAdmin", () => {
    expect(source).toContain("isAdminRole");
    expect(source).toContain("Lecture seule");
    expect(source).toContain("{isAdmin && (");
    expect(source).toContain("/parametres/utilisateurs");
    expect(source).toContain("fieldset disabled={!isAdmin}");
  });

  it("gate les routes admin dans App", () => {
    expect(appSource).toContain("AdminGate");
    expect(appSource).toContain("AdminUsersPage");
    expect(appSource).toContain("AdminEmailTemplatesPage");
    expect(gateSource).toContain("isAdminRole");
  });

  it("cadre: lecture seule, pas de bouton Enregistrer ni Gérer les comptes", async () => {
    authState.role = "cadre";
    const { default: SettingsPage } = await import("../client/src/pages/SettingsPage");
    const html = renderToStaticMarkup(createElement(SettingsPage));
    expect(html).toContain("Lecture seule");
    expect(html).not.toContain("Enregistrer");
    expect(html).not.toContain("Gérer les comptes");
    expect(html).not.toContain("Templates d'e-mail");
    expect(html).toContain("Changer mon mot de passe");
  });
});
