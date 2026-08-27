import { describe, expect, it } from "vitest";
import { LOCAL_HISTORY_ASSUMED_LIMIT_BYTES, getLocalHistoryCapacity } from "../client/src/lib/localHistoryCapacity";

describe("capacité de l’historique local", () => {
  it("signale un historique approchant le seuil préventif sans attendre le dépassement", () => {
    expect(getLocalHistoryCapacity([]).shouldWarn).toBe(false);
    const nearlyFull = { decisions: "x".repeat(Math.ceil(LOCAL_HISTORY_ASSUMED_LIMIT_BYTES * 0.8)) };
    const capacity = getLocalHistoryCapacity(nearlyFull);
    expect(capacity.shouldWarn).toBe(true);
    expect(capacity.percent).toBeGreaterThanOrEqual(75);
  });
});
