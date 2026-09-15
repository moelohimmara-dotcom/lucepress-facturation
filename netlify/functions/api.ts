// jose v6 (JWT sessions) référence le global `crypto.subtle` (Web Crypto).
// Sur le runtime Lambda Netlify (Node 20), `globalThis.crypto` n'est pas
// exposé automatiquement. On l'amorce avant tout import qui déclenche jose.
import { webcrypto as nodeWebCrypto } from "node:crypto";
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = nodeWebCrypto as any;
}

import serverlessHttp from "serverless-http";
import { createApp } from "../../server/_core/index.ts";
import { internalErrorResponse, requestToEvent, v1ToWebResponse } from "../../server/_core/serverlessHttpAdapter.ts";

let handlerPromise = null;

async function getHandler() {
  if (!handlerPromise) {
    const { app } = await createApp();
    handlerPromise = serverlessHttp(app);
  }
  return handlerPromise;
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
    // Le détail (stack, chemins internes, identifiant de build) reste dans les
    // logs serveur : la réponse HTTP ne doit rien divulguer.
    console.error("[api] handler serverless en échec:", err);
    return internalErrorResponse();
  }
};
