import { afterEach, describe, expect, it } from "vitest";
import { getRequestOrigin } from "./invitationIssue";

describe("getRequestOrigin", () => {
  afterEach(() => {
    delete process.env.APP_PUBLIC_URL;
  });

  it("privilégie APP_PUBLIC_URL", () => {
    process.env.APP_PUBLIC_URL = "https://app.example.com/";
    expect(getRequestOrigin({ get: () => "ignored.netlify.app" })).toBe("https://app.example.com");
  });

  it("utilise x-lucepress-public-origin quand l’API est proxifiée", () => {
    const req = {
      get: (name: string) =>
        name === "x-lucepress-public-origin"
          ? "https://lucepress-gestion.moelohimmara.workers.dev"
          : name === "host"
            ? "lucepress-gestion.netlify.app"
            : undefined,
    };
    expect(getRequestOrigin(req)).toBe("https://lucepress-gestion.moelohimmara.workers.dev");
  });

  it("retombe sur le Worker Cloudflare en local", () => {
    expect(getRequestOrigin({ get: () => "localhost:3000" })).toBe(
      "https://lucepress-gestion.moelohimmara.workers.dev",
    );
  });
});
