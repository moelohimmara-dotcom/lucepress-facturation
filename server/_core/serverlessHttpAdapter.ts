/**
 * Adaptateur entre le contrat « API Gateway v1 » attendu par serverless-http
 * et l'API Web `Request`/`Response` utilisée par le runtime Netlify Functions v2.
 *
 * Isolé du handler pour rester testable sans démarrer Express ni la base.
 */

/** Statuts pour lesquels la spécification Fetch interdit tout corps de réponse. */
export const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/**
 * Le runtime Netlify Functions moderne appelle le handler avec une `Request` Web.
 * serverless-http attend un event API Gateway v1
 * ({ path, httpMethod, headers, body, isBase64Encoded, ... }).
 */
export async function requestToEvent(req: Request): Promise<any> {
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

/**
 * serverless-http retourne l'ancien format v1
 * ({ statusCode, headers, body, isBase64Encoded }).
 */
export function v1ToWebResponse(result: any): Response {
  if (result instanceof Response) return result;
  const status = result?.statusCode ?? 200;
  const headers = result?.headers ?? {};
  const isBase64 = result?.isBase64Encoded === true;
  const body = result?.body ?? "";
  const init: ResponseInit = {
    status,
    headers: new Headers(headers as Record<string, string>),
  };
  // 101/204/205/304 interdisent tout corps de réponse, même vide : passer `""`
  // (ce que fait serverless-http pour un 204) fait lever au constructeur
  // « TypeError: Invalid response status code 204 ». Or le middleware `cors`
  // répond exactement ainsi à chaque preflight OPTIONS.
  if (NULL_BODY_STATUSES.has(status)) {
    return new Response(null, init);
  }
  if (isBase64) {
    const bin = Buffer.from(String(body), "base64");
    return new Response(new Uint8Array(bin), init);
  }
  return new Response(body == null ? "" : String(body), init);
}

/**
 * Réponse d'échec du handler serverless. Volontairement générique : la stack et
 * le tag de build restent dans les logs serveur, jamais dans la réponse HTTP.
 */
export function internalErrorResponse(): Response {
  return new Response(JSON.stringify({ error: "Erreur interne" }), {
    status: 500,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
