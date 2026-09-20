/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/LandingPage.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "client/src/components/lucepress-landing.css"), "utf8");

describe("landing page publique Lucepres (Monsoon × Atelier)", () => {
  it("expose un hero clair orienté bénéfice (devis → paiement encaissé)", () => {
    expect(source).toContain("Du premier devis");
    expect(source).toContain("paiement");
    expect(source).toContain("encaiss");
    expect(source).toContain("Tu gagnes du temps sur le papier");
  });

  it("ancre la marque Lucepres au niveau héro", () => {
    expect(source).toContain("lp-hero-brand");
    expect(source).toContain("LUCEPRES_PUBLIC_PROFILE.displayName");
  });

  it("route Se connecter et les CTA vers /login via Link", () => {
    expect(source).toContain('Link href="/login"');
    expect(source).toContain("Se connecter");
    expect(source).toContain("Accéder à l");
    expect(source).toContain("espace");
  });

  it("utilise une vidéo héro claire + sections métiers avec images (pas de logos fictifs)", () => {
    expect(source).toContain("lp-hero-video");
    expect(source).toContain("hero.mp4");
    expect(source).toContain("SECTEURS");
    expect(source).toContain("Forage");
    expect(source).toContain("Hydraulique");
    expect(source).toContain("/landing/secteur-forage.png");
    expect(source).toContain("lp-sectors");
    expect(source).not.toContain("lp-strip");
    expect(source).not.toContain("Terrain Lucepres");
    expect(source).not.toContain("Gestion commerciale");
    expect(source).not.toContain("lp-eyebrow");
    expect(source).not.toContain("Northwind");
    expect(source).not.toContain("3.4×");
  });

  it("monte le parcours funnel et le contact réel", () => {
    expect(source).toContain("FUNNEL");
    expect(source).toContain("mailto:");
    expect(source).toContain("tel:");
    expect(source).toContain("LUCEPRES_PUBLIC_PROFILE.phone");
  });

  it("ne charge plus la scène WebGL Ascend", () => {
    expect(source).not.toContain("startPlanetScene");
    expect(source).not.toContain("ascendPlanet");
    expect(source).not.toContain("planet-canvas");
  });

  it("applique le pattern Monsoon adapté Atelier (nav pill givrée + tokens)", () => {
    expect(css).toContain("backdrop-filter: blur(18px)");
    expect(css).toContain("--lp-btn-radius: 1rem");
    expect(css).toContain("--lp-primary: oklch(0.3 0.079 166)");
    expect(css).toContain("--lp-display:");
    expect(css).toContain(".lp-nav");
    expect(css).toContain(".lp-footer");
    expect(css).toContain("prefers-reduced-motion");
  });
});
