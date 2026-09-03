import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
const benchSource = readFileSync(resolve(process.cwd(), "scripts/bench/run.mjs"), "utf8");

describe("chantier multi-users — points d’entrée", () => {
  it("expose GET /api/health hors SPA", () => {
    expect(indexSource).toContain('app.get("/api/health"');
    expect(indexSource).toContain("buildHealthPayload");
    expect(indexSource).toContain("pingDatabase");
  });

  it("refuse les identifiants de bench en dur", () => {
    expect(benchSource).toContain("LUCEPRESS_BENCH_EMAIL");
    expect(benchSource).not.toMatch(/Yeo\?KVK/);
    expect(benchSource).toContain("auth.login");
    expect(benchSource).toContain("billing.receivables");
  });
});
