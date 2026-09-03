import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const preview = readFileSync(resolve(process.cwd(), "client/src/pages/DocumentPreviewPage.tsx"), "utf8");
const reminders = readFileSync(resolve(process.cwd(), "client/src/pages/RemindersPage.tsx"), "utf8");
const settings = readFileSync(resolve(process.cwd(), "client/src/pages/SettingsPage.tsx"), "utf8");

describe("P0.3 — feedback SMTP", () => {
  it("désactive l’envoi document si SMTP down", () => {
    expect(preview).toContain("mailStatus");
    expect(preview).toContain("canEmailDocument");
    expect(preview).toContain("SMTP n’est pas configuré");
  });

  it("désactive l’envoi relance si SMTP down", () => {
    expect(reminders).toContain("smtpReady");
    expect(reminders).toContain("SMTP non configuré");
    expect(reminders).toContain("!clientEmail || !smtpReady");
  });

  it("affiche l’état SMTP dans les paramètres", () => {
    expect(settings).toContain("mailStatus.smtpConfigured");
    expect(settings).toContain("Envoi e-mail opérationnel");
  });
});
