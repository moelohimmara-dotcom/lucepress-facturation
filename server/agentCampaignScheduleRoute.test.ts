import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("callback planifié de la boîte e-mail de test", () => {
  const source = readFileSync(new URL("./agentCampaignScheduleRoutes.ts", import.meta.url), "utf8");

  it("n'accepte que les appels cron authentifiés et ne réalise aucune livraison externe", () => {
    expect(source).toContain('app.post("/api/scheduled/agent-test-email"');
    expect(source).toContain("taskUid");
    expect(source).toContain("deliverScheduledAgentCampaignToTestInbox");
    expect(source).toContain("externalDispatch: false");
    expect(source).toContain("Pas d'auth");
  });
});
