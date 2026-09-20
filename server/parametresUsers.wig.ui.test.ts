import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settings = readFileSync(resolve(process.cwd(), "client/src/pages/SettingsPage.tsx"), "utf8");
const users = readFileSync(resolve(process.cwd(), "client/src/pages/UsersPage.tsx"), "utf8");

describe("WIG — Paramètres & Utilisateurs cibles 44px", () => {
  it("Paramètres : Enregistrer et champs en min-h-11", () => {
    expect(settings).toContain("min-h-11 rounded-xl bg-primary font-bold text-primary-foreground");
    expect(settings).toContain("[&_input]:min-h-11");
    expect(settings).toContain("[&_select]:min-h-11");
    expect(settings).not.toContain("[&_input]:h-10");
  });

  it("Utilisateurs : CTAs et actions liste sans size=sm", () => {
    expect(users).toContain("min-h-11 rounded-xl bg-primary font-bold text-primary-foreground");
    expect(users).toContain("min-h-11 rounded-xl font-bold");
    expect(users).toContain('className="min-h-11 rounded-xl"');
    expect(users).toContain("min-h-11 w-full rounded-xl");
    expect(users).not.toContain('size="sm"');
    expect(users).not.toContain('className="h-10 rounded-xl');
  });
});
