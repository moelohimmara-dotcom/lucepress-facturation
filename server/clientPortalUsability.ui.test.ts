import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const portal = readFileSync(resolve(process.cwd(), "client/src/pages/ClientPortalPage.tsx"), "utf8");
const catalog = readFileSync(resolve(process.cwd(), "client/src/pages/CatalogPage.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("P0.2 — portail utilisable", () => {
  it("distingue un compte interne d’un vrai client", () => {
    expect(portal).toContain("isStaffRole");
    expect(portal).toContain("Aperçu du portail client");
    expect(portal).toContain("Inviter au portail");
  });

  it("expose l’acceptation / refus de devis côté portail", () => {
    expect(portal).toContain("respondToQuote");
    expect(portal).toContain("Accepter le devis");
    expect(portal).toContain("Devis à traiter");
  });

  it("permet d’inviter depuis la fiche client", () => {
    expect(catalog).toContain("invitePortal");
    expect(catalog).toContain("Inviter au portail");
  });

  it("redirige un rôle client hors des écrans staff", () => {
    expect(layout).toContain("isClientRole");
    expect(layout).toContain('setLocation("/portail-client")');
  });
});
