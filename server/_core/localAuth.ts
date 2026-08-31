import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type LocalSessionPayload = {
  openId: string;
  email: string;
  name: string;
};

function getSecret(): Uint8Array {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function signLocalSession(
  payload: LocalSessionPayload,
  expiresInMs: number = ONE_YEAR_MS
): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({
    openId: payload.openId,
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecret());
}

export async function verifyLocalSession(
  token: string | undefined | null
): Promise<LocalSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { openId, email, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || typeof email !== "string" || typeof name !== "string") {
      return null;
    }
    return { openId, email, name };
  } catch {
    return null;
  }
}
