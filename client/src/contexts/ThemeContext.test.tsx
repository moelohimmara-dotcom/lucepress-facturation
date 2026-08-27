/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme}>{theme}</button>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("préférence de thème Lucepress", () => {
  it("active le thème sombre et le mémorise lorsque le basculement est autorisé", () => {
    render(<ThemeProvider defaultTheme="light" switchable><ThemeProbe /></ThemeProvider>);

    expect(screen.getByRole("button").textContent).toBe("light");
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("restaure une préférence sombre précédemment enregistrée", () => {
    localStorage.setItem("theme", "dark");
    render(<ThemeProvider defaultTheme="light" switchable><ThemeProbe /></ThemeProvider>);

    expect(screen.getByRole("button").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
