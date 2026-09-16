import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

/**
 * Durée de vie d’une session, en millisecondes.
 *
 * SOURCE UNIQUE : le JWT (`exp`), le cookie (`maxAge`) et la ligne `sessions`
 * (`expiresAt`) doivent décrire la MÊME échéance. Trois constantes séparées
 * finiraient par diverger — et une session révoquée mais encore valide, ou
 * l’inverse, serait alors un bogue silencieux. Exportée pour être lue par
 * `server/routers.ts` (cookie) et `server/sessionRegistry.ts` (`expiresAt`).
 */
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export type LocalSessionPayload = {
  openId: string;
  email: string;
  name: string;
  tenantId: number;
};

function getSecret(): Uint8Array {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function signLocalSession(
  payload: LocalSessionPayload,
  expiresInMs: number = SESSION_TTL_MS
): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({
    openId: payload.openId,
    email: payload.email,
    name: payload.name,
    tenantId: payload.tenantId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    // `jti` aléatoire : sans lui, deux connexions du même compte dans la même
    // seconde produisent un jeton IDENTIQUE (mêmes revendications, même `exp`
    // arrondi à la seconde). Le hachage serait alors identique, l’index unique
    // `sessions_tokenHash_unique` refuserait la seconde ligne et l’écran
    // « Sessions actives » confondrait deux ouvertures distinctes en une seule.
    .setJti(randomUUID())
    .setExpirationTime(expirationSeconds)
    .sign(getSecret());
}

export async function verifyLocalSession(
  token: string | undefined | null
): Promise<LocalSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { openId, email, name, tenantId } = payload as Record<string, unknown>;
    if (
      typeof openId !== "string" ||
      typeof email !== "string" ||
      typeof name !== "string" ||
      typeof tenantId !== "number"
    ) {
      return null;
    }
    return { openId, email, name, tenantId };
  } catch {
    return null;
  }
}
