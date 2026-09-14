/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/LandingPage.tsx"), "utf8");

describe("landing page publique Lucepress (refonte immersive)", () => {
  it("expose un hero clair orienté bénéfice (devis → paiement encaissé)", () => {
    expect(source).toContain("Du premier devis");
    expect(source).toContain("au");
    expect(source).toContain("paiement");
    expect(source).toContain("encaiss");
    expect(source).toContain("Tu gagnes du temps sur le papier");
  });

  it("affiche une réassurance métier visible (Guinée, GNF, IA, sécurité)", () => {
    expect(source).toContain("Pensé pour la Guinée");
    expect(source).toContain("GNF");
    expect(source).toContain("agent IA");
    expect(source).toContain("Sécurité entreprise");
  });

  it("présente un aperçu produit (dashboard mockup de trésorerie) sous le hero", () => {
    expect(source).toContain("dash-bars");
    expect(source).toContain("dash-rows");
    expect(source).toContain("Trésorerie");
    expect(source).toContain("Live");
    expect(source).toContain("DASH_BAR_HEIGHTS");
    expect(source).toContain("DASH_ROWS");
  });

  it("hiérarchise les fonctions différenciantes (devis guidés, portail client, relances)", () => {
    expect(source).toContain("Devis en 5 étapes guidées");
    expect(source).toContain("Portail client");
    expect(source).toContain("Relances en un clic");
    expect(source).toContain("FEATURES");
  });

  it("affiche des statistiques chiffrées (stats grid)", () => {
    expect(source).toContain("STATS");
    expect(source).toContain("3.4×");
    expect(source).toContain("92%");
    expect(source).toContain("stat-value");
  });

  it("monte une scène WebGL planète immersive en arrière-plan", () => {
    expect(source).toContain("startPlanetScene");
    expect(source).toContain("planet-canvas");
  });

  it("expose les coordonnées de contact dans le footer", () => {
    expect(source).toContain("mailto:");
    expect(source).toContain("tel:");
    expect(source).toContain("LUCEPRES_PUBLIC_PROFILE.phone");
    expect(source).toContain("LUCEPRES_PUBLIC_PROFILE.email");
  });

  it("structure la page de façon accessible (aria-labelledby sur les sections)", () => {
    expect(source).toContain('aria-labelledby="features-title"');
    expect(source).toContain('aria-labelledby="solutions-title"');
    expect(source).toContain('aria-labelledby="cta-title"');
    expect(source).toContain("Aperçu illustratif du tableau de bord");
  });
});
