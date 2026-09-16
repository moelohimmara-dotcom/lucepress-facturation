import { hkdfSync, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { MFA_CHALLENGE_TTL_SECONDS } from "../../shared/mfa";
import { ENV } from "./env";

/**
 * JETON DE DÉFI MFA — le jeton qui n’est PAS une session.
 *
 * LE PROBLÈME QU’IL RÉSOUT
 * ------------------------
 * `auth.login` ne doit plus délivrer de session quand le compte porte une MFA :
 * le mot de passe seul ne suffit plus. Il faut pourtant que le client puisse
 * présenter le second facteur, donc qu’il détienne quelque chose prouvant que le
 * premier a été franchi — sans que ce quelque chose ouvre l’application.
 *
 * SÉPARATION CRYPTOGRAPHIQUE, PAS SEULEMENT LOGIQUE
 * -------------------------------------------------
 * Ce jeton est signé avec une clé HKDF DÉRIVÉE DIFFÉRENTE de celle des sessions
 * (`_core/localAuth.ts` : `JWT_SECRET` brut). Conséquence : `verifyLocalSession`
 * ne peut pas valider un jeton de défi, même si son contenu ressemblait à celui
 * d’une session. La réciproque est vraie. Deux usages, deux clés — la confusion
 * n’est pas « improbable », elle est impossible.
 *
 * Deux barrières supplémentaires, dans le même esprit :
 * - le contenu ne porte NI `email` NI `name`, exactement les champs dont
 *   `verifyLocalSession` a besoin : même avec la bonne clé, la forme ne
 *   conviendrait pas ;
 * - l’audience (`aud`) est vérifiée, et un jeton de défi ne porte que
 *   `openId` + `tenantId`.
 *
 * DURÉE DE VIE
 * ------------
 * Quelques minutes (`MFA_CHALLENGE_TTL_SECONDS`). Le temps d’ouvrir son
 * téléphone. Passé ce délai, la première étape est à refaire — ce que
 * l’interface annonce explicitement.
 *
 * CE QUE CE JETON NE FAIT PAS
 * ---------------------------
 * Il n’est PAS à usage unique : le stockage d’un état de consommation
 * exigerait une table, donc un DDL que cette livraison s’interdit. Le risque
 * résiduel est borné par la durée de vie très courte et par le verrouillage
 * anti-force brute appliqué à `auth.mfaLogin` (voir `_core/loginRateLimit.ts`).
 */

/** Information de domaine HKDF — distincte de celle du secret TOTP et de la session. */
const CHALLENGE_KEY_INFO = "lucepress:mfa-challenge:v1";

/** Sel HKDF : séparation de domaine, non secret. */
const CHALLENGE_KEY_SALT = "lucepress:facturation";

/** Audience du jeton : vérifiée à chaque lecture. */
export const MFA_CHALLENGE_AUDIENCE = "lucepress:mfa-challenge";

/** Émetteur, pour la traçabilité du jeton. */
const MFA_CHALLENGE_ISSUER = "lucepress";

export type MfaChallengePayload = {
  openId: string;
  tenantId: number;
};

export type MfaChallenge = {
  token: string;
  expiresInSeconds: number;
};

/** Clé de signature du défi — DÉRIVÉE, donc jamais confondue avec celle des sessions. */
export function deriveChallengeKey(secret: string = ENV.cookieSecret): Uint8Array {
  return new Uint8Array(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from(CHALLENGE_KEY_SALT, "utf8"),
      Buffer.from(CHALLENGE_KEY_INFO, "utf8"),
      32,
    ),
  );
}

/** Ouvre un défi pour un compte dont le mot de passe vient d’être vérifié. */
export async function signMfaChallenge(
  payload: MfaChallengePayload,
  ttlSeconds: number = MFA_CHALLENGE_TTL_SECONDS,
): Promise<MfaChallenge> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await new SignJWT({ openId: payload.openId, tenantId: payload.tenantId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(MFA_CHALLENGE_ISSUER)
    .setAudience(MFA_CHALLENGE_AUDIENCE)
    // `jti` aléatoire : deux défis ouverts dans la même seconde ne sont pas
    // identiques — sans quoi un jeton pourrait être substitué à un autre.
    .setJti(randomUUID())
    .setExpirationTime(expiresAt)
    .sign(deriveChallengeKey());
  return { token, expiresInSeconds: ttlSeconds };
}

/**
 * Lit un défi. Renvoie `null` pour TOUT motif de refus — expiré, signature
 * invalide, audience étrangère, contenu incomplet. L’appelant n’a pas à
 * distinguer ces cas et ne les distingue pas : tous mènent à « recommencez ».
 */
export async function verifyMfaChallenge(token: string | undefined | null): Promise<MfaChallengePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, deriveChallengeKey(), {
      algorithms: ["HS256"],
      issuer: MFA_CHALLENGE_ISSUER,
      audience: MFA_CHALLENGE_AUDIENCE,
    });
    const { openId, tenantId } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || openId.length === 0) return null;
    if (typeof tenantId !== "number" || !Number.isFinite(tenantId)) return null;
    return { openId, tenantId };
  } catch {
    return null;
  }
}
