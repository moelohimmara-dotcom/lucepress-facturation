import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

describe("alerte préventive de rappel du cockpit", () => {
  it("signale les rappels attribués prévus le lendemain et nomme leur responsable", () => {
    expect(source).toContain("isCollectionReminderTomorrow");
    expect(source).toContain("Rappels de demain");
    expect(source).toContain("tomorrowReminderLoads");
    expect(source).toContain("Voir la file");
  });
});
