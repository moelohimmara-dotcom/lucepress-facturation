import { describe, expect, it } from "vitest";
import { isReceivableDueInPeriod } from "../shared/receivablesPeriod";

describe("filtres temporels de créances", () => {
  const now = new Date("2026-08-27T12:00:00Z");
  it("conserve les retards dont l’échéance appartient à la période demandée", () => {
    expect(isReceivableDueInPeriod("2026-08-25", "7", now)).toBe(true);
    expect(isReceivableDueInPeriod("2026-07-20", "30", now)).toBe(false);
    expect(isReceivableDueInPeriod("2026-06-10", "90", now)).toBe(true);
  });
  it("gère le filtre global et les échéances absentes sans faux positif", () => {
    expect(isReceivableDueInPeriod(null, "all", now)).toBe(true);
    expect(isReceivableDueInPeriod(null, "30", now)).toBe(false);
  });
});
