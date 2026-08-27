import { describe, expect, it } from "vitest";
import { getDecisionDateRange } from "../client/src/lib/decisionDateRange";

describe("préréglages de période de décision", () => {
  it("calcule cette semaine depuis lundi et le mois en cours", () => {
    const now = new Date("2026-08-27T12:00:00");
    expect(getDecisionDateRange("week", now)).toEqual({ start: "2026-08-24", end: "2026-08-27" });
    expect(getDecisionDateRange("month", now)).toEqual({ start: "2026-08-01", end: "2026-08-27" });
  });
});
