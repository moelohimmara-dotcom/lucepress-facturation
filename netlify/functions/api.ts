// jose v6 (JWT sessions) référence le global `crypto.subtle` (Web Crypto).
// Sur le runtime Lambda Netlify (Node 20), `globalThis.crypto` n'est pas
// exposé automatiquement. On l'amorce avant tout import qui déclenche jose.
import { webcrypto as nodeWebCrypto } from "node:crypto";
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = nodeWebCrypto as any;
}

import serverlessHttp from "serverless-http";
import { createApp } from "../../server/_core/index.ts";

let handlerPromise = null;

async function getHandler() {
  if (!handlerPromise) {
    const { app } = await createApp();
    handlerPromise = serverlessHttp(app);
  }
  return handlerPromise;
}

/**
 * Le runtime Netlify Functions moderne (bootstrap v2) appelle le handler
 * avec une `Request` Web API. serverless-http attend un event API Gateway
 * v1 ({ path, httpMethod, headers, body, isBase64Encoded, ... }) et retourne
 * l'ancien format v1 ({ statusCode, headers, body, isBase64Encoded }).
 * On assure les deux conversions.
 */
async function requestToEvent(req: Request): Promise<any> {
  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const body = req.method === "GET" || req.method === "HEAD" ? null : await req.text();
  return {
    path: url.pathname,
    httpMethod: req.method,
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: body ?? null,
    isBase64Encoded: false,
  };
}

function v1ToWebResponse(result: any): Response {
  if (result instanceof Response) return result;
  const status = result?.statusCode ?? 200;
  const headers = result?.headers ?? {};
  const isBase64 = result?.isBase64Encoded === true;
  const body = result?.body ?? "";
  const init: ResponseInit = {
    status,
    headers: new Headers(headers as Record<string, string>),
  };
  if (isBase64) {
    const bin = Buffer.from(String(body), "base64");
    return new Response(new Uint8Array(bin), init);
  }
  return new Response(body == null ? "" : String(body), init);
}

export default async (event: any, context: any) => {
  try {
    const handler = await getHandler();
    // Netlify v2 runtime: event is a Web Request.
    if (event instanceof Request) {
      const gwEvent = await requestToEvent(event);
      const result = await handler(gwEvent, context);
      return v1ToWebResponse(result);
    }
    // Fallback: legacy API Gateway event (Netlify v1 / local).
    const out: any = { ...event };
    if (!out.path && out.rawPath) out.path = out.rawPath;
    if (!out.httpMethod) {
      out.httpMethod = out.requestContext?.http?.method || out.requestContext?.httpMethod || "GET";
    }
    if (out.body && typeof out.body === "object") out.body = JSON.stringify(out.body);
    const result = await handler(out, context);
    return v1ToWebResponse(result);
  } catch (err) {
    const message = err && err.stack ? err.stack : String(err);
    return v1ToWebResponse({
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ diag: "api-handler-throw", message }),
    });
  }
};
