import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("administration des campagnes IA", () => {
  const scheduler = readFileSync(new URL("../client/src/pages/AgentCampaignSchedulerPage.tsx", import.meta.url), "utf8");
  const audit = readFileSync(new URL("../client/src/pages/AgentAuditPage.tsx", import.meta.url), "utf8");
  const testInbox = readFileSync(new URL("../client/src/pages/AgentTestEmailPage.tsx", import.meta.url), "utf8");
  const scheduleRoute = readFileSync(resolve(process.cwd(), "server/agentCampaignScheduleRoutes.ts"), "utf8");

  it("propose une programmation visuelle bornée au canal e-mail de test", () => {
    expect(scheduler).toContain("Planificateur de campagnes");
    expect(scheduler).toContain("La programmation ne délivre les messages qu’à la boîte de test interne");
    expect(scheduler).toContain("/relances");
    expect(scheduler).toContain("Relances réelles");
    expect(scheduler).toContain("Heure (Conakry)");
    expect(scheduler).toContain("scheduleCampaign");
    expect(scheduler).not.toContain("sendByEmail");
    expect(scheduler).not.toContain("sendReminderEmail");
  });

  it("présente un journal d’audit filtrable sans modifier les données", () => {
    expect(audit).toContain("Journal d’audit interactif");
    expect(audit).toContain("Toutes les décisions");
    expect(audit).toContain("30 derniers jours");
    expect(audit).toContain("Les filtres n’affectent jamais les données.");
  });

  it("affiche une boîte e-mail interne avec prévisualisation sans fournisseur externe", () => {
    expect(testInbox).toContain("Boîte e-mail de test");
    expect(testInbox).toContain("Aucun envoi externe");
    expect(testInbox).toContain("Prévisualisation e-mail de test");
  });

  it("livre les campagnes planifiées uniquement dans la boîte de test interne", () => {
    expect(scheduleRoute).toContain("deliverScheduledAgentCampaignToTestInbox");
    expect(scheduleRoute).toContain("externalDispatch: false");
    expect(scheduleRoute).not.toContain("sendMail");
  });
});
