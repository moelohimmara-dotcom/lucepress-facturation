import { describe, expect, it } from "vitest";
import { parseDatabasePoolSize } from "../server/_core/dbPool";
import { buildHealthPayload } from "../server/_core/health";
import { summarizeLatencies } from "../shared/benchStats";

describe("parseDatabasePoolSize", () => {
  it("utilise 10 par défaut et borne entre 2 et 50", () => {
    expect(parseDatabasePoolSize(undefined)).toBe(10);
    expect(parseDatabasePoolSize("")).toBe(10);
    expect(parseDatabasePoolSize("1")).toBe(2);
    expect(parseDatabasePoolSize("15")).toBe(15);
    expect(parseDatabasePoolSize("999")).toBe(50);
  });
});

describe("buildHealthPayload", () => {
  it("signale db down sans cacher le process", () => {
    const payload = buildHealthPayload({ dbOk: false, uptimeSec: 12.4, poolLimit: 10, now: new Date("2026-09-03T18:00:00.000Z") });
    expect(payload).toEqual({
      ok: false,
      db: "down",
      uptimeSec: 12,
      poolLimit: 10,
      timestamp: "2026-09-03T18:00:00.000Z",
    });
  });

  it("signale db up quand le ping réussit", () => {
    expect(buildHealthPayload({ dbOk: true, uptimeSec: 3, poolLimit: 12 }).db).toBe("up");
    expect(buildHealthPayload({ dbOk: true, uptimeSec: 3, poolLimit: 12 }).ok).toBe(true);
  });
});

describe("summarizeLatencies", () => {
  it("calcule p95 sur un échantillon simple", () => {
    const stats = summarizeLatencies([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(stats.count).toBe(10);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(100);
    expect(stats.p95).toBe(100);
    expect(stats.p50).toBe(50);
  });
});
