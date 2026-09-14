/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/LandingPage.tsx"), "utf8");

describe("landing page publique Lucepress", () => {
  it("expose un hero clair orienté bénéfice et non une promesse abstraite", () => {
    expect(source).toContain("Du premier devis");
    expect(source).toContain("au paiement encaissé");
    expect(source).toContain("Tu gagnes du temps sur le papier");
  });

  it("affiche des pastilles de réassurance visibles (sécurisé, GNF, Guinée, IA)", () => {
    expect(source).toContain("Espace sécurisé");
    expect(source).toContain("Montants en GNF");
    expect(source).toContain("Pensé pour la Guinée");
    expect(source).toContain("Agent IA intégré");
  });

  it("présente un aperçu produit (mockup du tableau de bord) sous le hero", () => {
    expect(source).toContain("Aperçu illustratif du tableau de bord");
    expect(source).toContain("Ta file de décisions");
    expect(source).toContain("GNF");
  });

  it("hiérarchise les fonctions différenciantes (devis guidés, portail client)", () => {
    expect(source).toContain("Devis en 5 étapes guidées");
    expect(source).toContain("Portail client");
    expect(source).toContain("primaryFeatures");
    expect(source).toContain("standardFeatures");
  });

  it("concrétise les étapes avec des icônes et des détails orientés action", () => {
    expect(source).toContain("Enregistre tes clients");
    expect(source).toContain("Crée tes devis");
    expect(source).toContain("Suis les paiements");
    expect(source).toContain("saisie guidée en 5 étapes");
  });

  it("expose les coordonnées de contact dans le footer", () => {
    expect(source).toContain("mailto:");
    expect(source).toContain("tel:");
    expect(source).toContain("LUCEPRES_PUBLIC_PROFILE.phone");
  });

  it("structure la page de façon accessible (aria-labelledby sur les sections)", () => {
    expect(source).toContain('aria-labelledby="features-title"');
    expect(source).toContain('aria-labelledby="steps-title"');
    expect(source).toContain('aria-labelledby="cta-title"');
    expect(source).toContain('aria-label="Aperçu du tableau de bord"');
  });
});
