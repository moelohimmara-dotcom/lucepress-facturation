import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const calendar = readFileSync(resolve(process.cwd(), "client/src/pages/CalendarPage.tsx"), "utf8");
const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("WIG — Calendrier & Accueil cibles 44px", () => {
  it("Calendrier : navigation mois et filtres en 44px", () => {
    expect(calendar).toContain('className="h-11 w-11 rounded-xl bg-card"');
    expect(calendar).toContain("min-h-11 rounded-xl border px-3 text-xs font-extrabold");
    expect(calendar).toContain("flex min-h-11 w-full items-start gap-3");
    expect(calendar).not.toContain('className="h-9 w-9 rounded-xl bg-card"');
    expect(calendar).not.toContain("h-8 rounded-lg border px-3 text-[11px]");
  });

  it("Accueil : CTAs file vide et démarrage en min-h-11", () => {
    expect(home).toContain("min-h-11 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/15");
    expect(home).toContain("min-h-11 shrink-0 rounded-xl bg-primary font-bold text-primary-foreground");
    expect(home).toContain("inline-flex min-h-11 shrink-0 items-center text-xs font-extrabold text-primary");
    expect(home).not.toContain('className="h-10 rounded-xl bg-primary');
    expect(home).not.toContain('className="h-10 shrink-0 rounded-xl');
  });
});
