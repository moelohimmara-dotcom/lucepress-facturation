import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
const source = readFileSync(resolve(process.cwd(), "scripts/bench/run.mjs"), "utf8");
const provision = readFileSync(resolve(process.cwd(), "scripts/bench/provision-users.mjs"), "utf8");

describe("chantier multi-users — points d’entrée", () => {
  it("expose GET /api/health hors SPA", () => {
    expect(indexSource).toContain('app.get("/api/health"');
    expect(indexSource).toContain("buildHealthPayload");
    expect(indexSource).toContain("pingDatabase");
  });

  it("refuse les identifiants de bench en dur", () => {
    expect(source).toContain("LUCEPRESS_BENCH_USERS_FILE");
    expect(source).not.toMatch(/Yeo\?KVK/);
    expect(source).toContain("auth.login");
    expect(source).toContain("billing.receivables");
    expect(provision).toContain("bench");
    expect(provision).toContain("@lucepress.test");
    expect(provision).toContain("--out");
  });

  it("applique un rate-limit après le body parser, pas avant", () => {
    expect(indexSource).toContain("express.json({ limit: \"1mb\" })");
    const jsonAt = indexSource.indexOf("express.json");
    const limitAt = indexSource.indexOf("rateLimit(");
    expect(limitAt).toBeGreaterThan(jsonAt);
    expect(indexSource).toContain("API_RATE_LIMIT_MAX");
    expect(indexSource).toContain("validate: false");
  });
});
