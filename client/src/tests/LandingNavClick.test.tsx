import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/LandingPage";

vi.mock("wouter", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("framer-motion", () => {
  const sanitize = (props: Record<string, unknown>) => {
    const {
      initial: _i,
      animate: _a,
      transition: _t,
      whileHover: _h,
      whileTap: _p,
      ...rest
    } = props;
    return rest;
  };
  return {
    motion: {
      nav: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <nav {...sanitize(props)}>{children}</nav>
      ),
      span: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <span {...sanitize(props)}>{children}</span>
      ),
      p: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <p {...sanitize(props)}>{children}</p>
      ),
      h1: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <h1 {...sanitize(props)}>{children}</h1>
      ),
      div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <div {...sanitize(props)}>{children}</div>
      ),
    },
    useReducedMotion: () => true,
  };
});

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

  it("expose Se connecter comme lien /login", () => {
    render(<LandingPage />);
    const logins = screen.getAllByRole("link", { name: "Se connecter" });
    expect(logins.length).toBeGreaterThanOrEqual(1);
    expect(logins[0].getAttribute("href")).toBe("/login");
  });

  it("expose Accéder à l'espace comme lien /login", () => {
    render(<LandingPage />);
    const ctas = screen.getAllByRole("link", { name: /Accéder/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    ctas.forEach((cta) => expect(cta.getAttribute("href")).toBe("/login"));
  });
});
