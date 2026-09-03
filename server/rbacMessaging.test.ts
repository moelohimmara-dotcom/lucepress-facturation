import { describe, expect, it } from "vitest";
import { canAccessPath, isStaffRole, isAppRole, isAdminRole } from "../shared/roles";
import { ACTIVE_CHANNELS, assertSmtpOnly, dispatchWhatsAppStub, isChannelActive } from "./messaging";

describe("RBAC canAccessPath", () => {
  it("admin accesses everything", () => {
    expect(canAccessPath("admin", "/integrations")).toBe(true);
    expect(canAccessPath("admin", "/creances")).toBe(true);
  });

  it("directeur / cadre blocked from admin-only paths", () => {
    expect(canAccessPath("directeur", "/integrations")).toBe(false);
    expect(canAccessPath("cadre", "/parametres/utilisateurs")).toBe(false);
    expect(canAccessPath("cadre", "/parametres/e-mails")).toBe(false);
    expect(canAccessPath("directeur", "/parametres/modeles")).toBe(false);
    expect(canAccessPath("directeur", "/agent-ia")).toBe(false);
  });

  it("staff can still open company settings (read)", () => {
    expect(canAccessPath("cadre", "/parametres")).toBe(true);
    expect(canAccessPath("directeur", "/parametres")).toBe(true);
  });

  it("staff can access commercial paths", () => {
    expect(canAccessPath("cadre", "/devis")).toBe(true);
    expect(canAccessPath("directeur", "/relances")).toBe(true);
    expect(canAccessPath("cadre", "/portail-client")).toBe(true);
  });

  it("compte portail limité au portail et au mot de passe", () => {
    expect(canAccessPath("client", "/portail-client")).toBe(true);
    expect(canAccessPath("client", "/compte/mot-de-passe")).toBe(true);
    expect(canAccessPath("client", "/devis")).toBe(false);
    expect(canAccessPath("client", "/parametres")).toBe(false);
    expect(isStaffRole("client")).toBe(false);
  });

  it("unknown role denied", () => {
    expect(canAccessPath(undefined, "/devis")).toBe(false);
    expect(isAppRole("guest")).toBe(false);
    expect(isStaffRole("cadre")).toBe(true);
    expect(isAdminRole("cadre")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
  });
});

describe("messaging SMTP-first", () => {
  it("only smtp is active", () => {
    expect(isChannelActive("smtp")).toBe(true);
    expect(isChannelActive("whatsapp")).toBe(false);
    expect(ACTIVE_CHANNELS.has("whatsapp")).toBe(false);
  });

  it("whatsapp stub refuses send", async () => {
    const result = await dispatchWhatsAppStub({
      channel: "whatsapp",
      to: "+224600000000",
      subject: "x",
      text: "y",
    });
    expect(result.ok).toBe(false);
  });

  it("assertSmtpOnly throws for whatsapp", async () => {
    await expect(assertSmtpOnly("whatsapp")).rejects.toThrow(/désactivé/);
  });
});
