import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("en-têtes de cache Netlify pour auto-update PWA", () => {
  const toml = readFileSync(join(process.cwd(), "netlify.toml"), "utf8");

  it("sert sw.js sans cache pour détecter les mises à jour", () => {
    expect(toml).toContain('for = "/sw.js"');
    expect(toml).toContain("max-age=0, must-revalidate");
  });

  it("sert index.html sans cache pour pointer vers les nouveaux chunks", () => {
    expect(toml).toContain('for = "/index.html"');
  });

  it("cache les assets hashés comme immuables", () => {
    expect(toml).toContain('for = "/assets/*"');
    expect(toml).toContain("max-age=31536000, immutable");
  });
});
