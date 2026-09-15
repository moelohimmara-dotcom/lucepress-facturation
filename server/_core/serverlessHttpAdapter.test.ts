import { describe, expect, it } from "vitest";
import express from "express";
import cors from "cors";
import serverlessHttp from "serverless-http";
import { requestToEvent, v1ToWebResponse } from "./serverlessHttpAdapter";

/**
 * Reproduit la chaîne réelle du runtime Netlify Functions v2 :
 * Request Web → event API Gateway v1 → Express → résultat v1 → Response Web.
 */
function buildPreflightHandler() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return serverlessHttp(app);
}

async function preflight(url: string, origin = "https://app.example.com") {
  const handler = buildPreflightHandler();
  const result = await handler(
    {
      path: new URL(url).pathname,
      httpMethod: "OPTIONS",
      headers: { origin, "access-control-request-method": "GET" },
      queryStringParameters: {},
      body: null,
      isBase64Encoded: false,
    },
    {},
  );
  return v1ToWebResponse(result);
}

describe("v1ToWebResponse", () => {
  it("accepte un 204 sans corps (preflight CORS) et conserve les en-têtes CORS", async () => {
    const response = await preflight("https://api.example.com/api/health");
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("n'attache aucun corps aux statuts 204, 205 et 304", () => {
    for (const statusCode of [204, 205, 304]) {
      const response = v1ToWebResponse({ statusCode, headers: {}, body: String(statusCode) });
      expect(response.status).toBe(statusCode);
      expect(response.body).toBeNull();
      expect(response.headers.get("content-length")).toBeNull();
    }
  });

  it("n'attache aucun corps à un 204 marqué isBase64Encoded", () => {
    const response = v1ToWebResponse({ statusCode: 204, headers: {}, body: "", isBase64Encoded: true });
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it("transmet normalement un corps JSON sur un statut 200", async () => {
    const response = v1ToWebResponse({
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("décode un corps base64 sur un statut 200", async () => {
    const response = v1ToWebResponse({
      statusCode: 200,
      headers: { "content-type": "text/plain" },
      body: Buffer.from("ok").toString("base64"),
      isBase64Encoded: true,
    });
    expect(await response.text()).toBe("ok");
  });

  it("laisse passer une Response Web telle quelle", () => {
    const original = new Response("déjà converti", { status: 202 });
    expect(v1ToWebResponse(original)).toBe(original);
  });
});

describe("requestToEvent", () => {
  it("conserve le chemin, la méthode, les en-têtes et la query", async () => {
    const event = await requestToEvent(
      new Request("https://api.example.com/api/health?verbose=1", { headers: { "x-test": "1" } }),
    );
    expect(event.path).toBe("/api/health");
    expect(event.httpMethod).toBe("GET");
    expect(event.headers["x-test"]).toBe("1");
    expect(event.queryStringParameters).toEqual({ verbose: "1" });
  });

  it("n'expose pas de corps pour GET et HEAD", async () => {
    expect((await requestToEvent(new Request("https://api.example.com/api/trpc", { method: "GET" }))).body).toBeNull();
    expect((await requestToEvent(new Request("https://api.example.com/api/trpc", { method: "HEAD" }))).body).toBeNull();
  });

  it("transmet le corps brut pour POST", async () => {
    const event = await requestToEvent(
      new Request("https://api.example.com/api/trpc", { method: "POST", body: '{"a":1}' }),
    );
    expect(event.httpMethod).toBe("POST");
    expect(event.body).toBe('{"a":1}');
  });
});
