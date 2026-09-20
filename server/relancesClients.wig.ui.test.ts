import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reminders = readFileSync(resolve(process.cwd(), "client/src/pages/RemindersPage.tsx"), "utf8");
const catalog = readFileSync(resolve(process.cwd(), "client/src/pages/CatalogPage.tsx"), "utf8");

describe("WIG — Relances & Clients cibles 44px", () => {
  it("Relances : tons, génération et envoi en min-h-11", () => {
    expect(reminders).toContain("min-h-11 rounded-xl border px-3 text-xs font-bold");
    expect(reminders).toContain("mt-4 min-h-11 rounded-xl bg-primary");
    expect(reminders).toContain("min-h-11 rounded-xl bg-primary text-xs font-bold text-primary-foreground");
    expect(reminders).not.toMatch(/ToneButton[\s\S]*?h-8 /);
  });

  it("Clients : CTAs liste et fermetures en 44px", () => {
    expect(catalog).toContain("min-h-11 rounded-xl border-border bg-card font-bold");
    expect(catalog).toContain("inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground");
    expect(catalog).toContain("[&_input]:min-h-11");
    expect(catalog).toContain("[&_select]:min-h-11");
    expect(catalog).not.toContain('className="h-9 rounded-lg');
    expect(catalog).not.toContain('className="h-8 rounded-lg');
  });
});
