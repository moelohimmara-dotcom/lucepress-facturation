import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/LandingPage";

vi.mock("wouter", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/lib/ascendPlanet", () => ({
  startPlanetScene: vi.fn(async () => () => {}),
}));

describe("LandingPage — CTA connexion cliquables", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("expose Se connecter comme lien /login (pas un bouton overlay-sensible)", () => {
    render(<LandingPage />);
    const logins = screen.getAllByRole("link", { name: "Se connecter" });
    expect(logins.length).toBeGreaterThanOrEqual(1);
    const navLogin = logins.find((el) => el.className.includes("btn-ghost"));
    expect(navLogin).toBeTruthy();
    expect(navLogin!.getAttribute("href")).toBe("/login");
  });

  it("expose Accéder à l'espace comme lien /login", () => {
    render(<LandingPage />);
    const ctas = screen.getAllByRole("link", { name: /Accéder à l'espace/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    ctas.forEach((cta) => expect(cta.getAttribute("href")).toBe("/login"));
  });
});
