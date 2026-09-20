import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "@/pages/LoginPage";

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    mfaLogin: vi.fn(),
  }),
}));

describe("LoginPage — WIG formulaire", () => {
  it("expose name, autocomplete et placeholders conformes", () => {
    render(<LoginPage />);

    const email = screen.getByLabelText(/e-mail/i);
    expect(email.getAttribute("name")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("email");
    expect(email.getAttribute("spellcheck")).toBe("false");
    expect(email.getAttribute("type")).toBe("email");

    const password = screen.getByLabelText(/mot de passe/i);
    expect(password.getAttribute("name")).toBe("password");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
    expect(password.getAttribute("placeholder")).toBe("Votre mot de passe…");

    const forgot = screen.getByRole("link", { name: /mot de passe oublié/i });
    expect(forgot.getAttribute("href")).toBe("/forgot-password");
    expect(forgot.className).toMatch(/min-h-11/);
  });
});
