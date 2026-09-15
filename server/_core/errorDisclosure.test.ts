import { describe, expect, it, vi } from "vitest";
import express from "express";
import serverlessHttp from "serverless-http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { publicProcedure, router } from "./trpc";
import { internalErrorResponse, v1ToWebResponse } from "./serverlessHttpAdapter";

/** Formes de fuite réellement observées en production. */
const LEAK_PATTERNS = ["stack", "file:///var/task", "\n    at ", "/var/task"];

const boomRouter = router({
  boom: publicProcedure.query(() => {
    throw new Error("panne interne inattendue");
  }),
});

async function callBoom() {
  const app = express();
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: boomRouter, createContext: (() => ({})) as any }),
  );
  const result = await serverlessHttp(app)(
    {
      path: "/api/trpc/boom",
      httpMethod: "GET",
      headers: {},
      queryStringParameters: {},
      body: null,
      isBase64Encoded: false,
    },
    {},
  );
  return v1ToWebResponse(result);
}

describe("divulgation des erreurs", () => {
  it("n'expose pas de stack ni de chemin interne dans une erreur tRPC HTTP", async () => {
    const response = await callBoom();
    expect(response.status).toBe(500);
    const body = await response.text();
    for (const pattern of LEAK_PATTERNS) {
      expect(body).not.toContain(pattern);
    }
    expect(JSON.parse(body).error.data).not.toHaveProperty("stack");
  });

  it("désactive le mode verbeux par défaut et ne l'active que sur un dev explicite", async () => {
    expect((boomRouter as any)._def._config.isDev).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const dev = await import("./trpc");
    expect((dev.router({}) as any)._def._config.isDev).toBe(true);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("répond de façon générique quand le handler serverless lève", async () => {
    const response = internalErrorResponse();
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: "Erreur interne" });
    expect(body).not.toContain("diag");
    expect(body).not.toContain("build-");
    expect(body).not.toContain("stack");
  });
});
