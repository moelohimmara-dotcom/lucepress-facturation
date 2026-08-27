import { describe, expect, it } from "vitest";
import { buildCampaignSchedule } from "../shared/agentCampaignSchedule";

describe("planification visuelle de campagnes", () => {
  it("génère un calendrier quotidien à six champs UTC pour Conakry", () => {
    expect(buildCampaignSchedule({ frequency: "daily", time: "09:30" })).toMatchObject({ cron: "0 30 9 * * *", timeZone: "Africa/Conakry" });
  });

  it("génère un calendrier hebdomadaire avec un jour explicite", () => {
    expect(buildCampaignSchedule({ frequency: "weekly", time: "14:05", weekday: 1 })).toMatchObject({ cron: "0 5 14 * * 1" });
  });

  it("refuse un format d’heure ou un jour invalide", () => {
    expect(() => buildCampaignSchedule({ frequency: "daily", time: "9h" })).toThrow("HH:MM");
    expect(() => buildCampaignSchedule({ frequency: "weekly", time: "10:00", weekday: 9 })).toThrow("jour");
  });
});
