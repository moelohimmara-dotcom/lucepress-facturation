import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  MFA_ISSUER,
  MFA_SECRET_BYTES,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  TOTP_WINDOW,
  normalizeTotpCode,
} from "../../shared/mfa";

/**
 * TOTP — calcul et vérification, sans aucune dépendance (RFC 4226 + RFC 6238).
 *
 * POURQUOI PAS DE BIBLIOTHÈQUE
 * ----------------------------
 * `node:crypto` fournit HMAC-SHA1 ; tout le reste tient en une trentaine de
 * lignes normalisées. Une dépendance de plus dans un chemin d’AUTHENTIFICATION
 * (chaîne de fourniture, mises à jour, surface d’attaque) coûterait plus cher
 * que ce qu’elle épargnerait.
 *
 * CE QUE CE MODULE NE FAIT PAS
 * ----------------------------
 * Il ne connaît ni la base, ni l’utilisateur, ni l’anti-rejeu persistant. Il
 * calcule, il compare, il rend un verdict avec le PAS retenu — à charge de
 * l’appelant (`server/mfa.ts`) d’enregistrer ce pas pour refuser sa réutilisation.
 *
 * HORLOGE
 * -------
 * Le temps est toujours INJECTÉ (`nowMs`). Aucun appel caché à `Date.now()`
 * dans les fonctions de vérification : les tests peuvent donc rejouer les
 * vecteurs officiels de la RFC 6238 sans figer l’horloge du processus.
 */

/* ------------------------------------------------------------------ */
/* Base32 (RFC 4648, alphabet A-Z et 2-7, sans remplissage)            */
/* ------------------------------------------------------------------ */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encode des octets en base32 sans remplissage — la forme attendue par les authentificateurs. */
export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let index = 0; index < buffer.length; index += 1) {
    value = (value << 8) | buffer[index];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/**
 * Décode une chaîne base32 (`null` si elle est illisible).
 *
 * Renvoie `null` plutôt que de lever : un secret corrompu en base ne doit pas
 * produire une exception à chaque tentative de connexion, mais un refus franc.
 */
export function decodeBase32(value: string): Buffer | null {
  const normalized = value.toUpperCase().replace(/[\s=-]/g, "");
  if (normalized.length === 0) return null;
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (let position = 0; position < normalized.length; position += 1) {
    const index = BASE32_ALPHABET.indexOf(normalized.charAt(position));
    if (index === -1) return null;
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/* ------------------------------------------------------------------ */
/* Calcul du code                                                      */
/* ------------------------------------------------------------------ */

/** Secret TOTP neuf : 20 octets aléatoires, en base32. */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(MFA_SECRET_BYTES));
}

/** Le compte qui reçoit le secret, tel qu’il apparaît dans l’authentificateur. */
export type TotpAccount = {
  /** Libellé lisible : e-mail du compte, ou son nom. */
  account: string;
  /** Nom du service. `Lucepress` par défaut. */
  issuer?: string;
};

/** Numéro de pas d’un instant donné (secondes depuis l’époque / 30). */
export function totpStepAt(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * Code TOTP d’un pas donné.
 *
 * HMAC-SHA1(secret, pas sur 8 octets big-endian), puis troncature dynamique
 * (RFC 4226 §5.3) : les 4 derniers bits de l’empreinte désignent l’offset du
 * mot de 32 bits à lire, dont on garde `TOTP_DIGITS` chiffres.
 */
export function totpCodeAtStep(secretBase32: string, step: number): string | null {
  const key = decodeBase32(secretBase32);
  if (!key) return null;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/** Code à présenter MAINTENANT, pour un secret donné. */
export function currentTotpCode(secretBase32: string, nowMs: number = Date.now()): string | null {
  return totpCodeAtStep(secretBase32, totpStepAt(nowMs));
}

/** Secondes restantes avant le pas suivant — l’interface peut l’afficher. */
export function totpSecondsRemaining(nowMs: number = Date.now()): number {
  const elapsed = Math.floor(nowMs / 1000) % TOTP_PERIOD_SECONDS;
  return TOTP_PERIOD_SECONDS - elapsed;
}

/* ------------------------------------------------------------------ */
/* Vérification                                                        */
/* ------------------------------------------------------------------ */

export type TotpVerdict = {
  /** Le code est valide ET n’a jamais servi. */
  ok: boolean;
  /**
   * Pas effectivement retenu, quand le code est valide. C’est LUI qu’il faut
   * enregistrer en base : sans cela, le même code resterait acceptable pendant
   * toute sa fenêtre de validité (rejeu).
   */
  step: number | null;
  /** Motif du refus, à des fins de journal — jamais montré tel quel à l’utilisateur. */
  reason: "ok" | "format" | "secret_illisible" | "code_incorrect" | "deja_utilise";
};

export type VerifyTotpInput = {
  /** Secret en CLAIR (déjà déchiffré par l’appelant). */
  secretBase32: string;
  /** Code présenté par l’utilisateur. */
  code: string;
  /** Instant de référence. */
  nowMs: number;
  /** Tolérance d’horloge en nombre de pas. */
  window?: number;
  /**
   * Dernier pas DÉJÀ accepté pour ce compte (`users.mfaLastUsedStep`).
   * `null` si aucun code n’a encore servi.
   */
  lastUsedStep?: number | null;
};

/**
 * Vérifie un code TOTP, avec anti-rejeu.
 *
 * ANTI-REJEU — pourquoi `step > lastUsedStep` et non `step !== lastUsedStep` :
 * un code appartient à un PAS. Si le pas N a déjà été consommé, présenter à
 * nouveau le code de N (ou celui de N−1, encore toléré par la fenêtre) doit
 * échouer. Exiger un pas STRICTEMENT supérieur ferme les deux portes d’un coup,
 * et reste compatible avec un décalage d’horloge durable : un téléphone en
 * retard d’un pas consomme N−1 puis N, ce qui progresse normalement.
 *
 * Comparaison à TEMPS CONSTANT (`timingSafeEqual`) : un code se devine chiffre
 * par chiffre si la durée de la comparaison varie. On compare donc TOUS les pas
 * de la fenêtre, sans sortie anticipée, puis on décide.
 */
export function verifyTotp(input: VerifyTotpInput): TotpVerdict {
  const code = normalizeTotpCode(input.code);
  if (code.length !== TOTP_DIGITS) return { ok: false, step: null, reason: "format" };
  if (!decodeBase32(input.secretBase32)) return { ok: false, step: null, reason: "secret_illisible" };

  const window = input.window ?? TOTP_WINDOW;
  const center = totpStepAt(input.nowMs);
  const lastUsedStep = input.lastUsedStep ?? null;

  const candidate = Buffer.from(code, "utf8");
  let match: number | null = null;
  // Parcours EXHAUSTIF des pas de la fenêtre : aucune sortie anticipée, donc
  // aucune indication sur le pas qui a manqué.
  for (let offset = -window; offset <= window; offset += 1) {
    const step = center + offset;
    if (step < 0) continue;
    const expected = totpCodeAtStep(input.secretBase32, step);
    if (!expected) continue;
    const expectedBuffer = Buffer.from(expected, "utf8");
    const equal =
      expectedBuffer.length === candidate.length && timingSafeEqual(expectedBuffer, candidate);
    if (equal && match === null) match = step;
  }

  if (match === null) return { ok: false, step: null, reason: "code_incorrect" };
  if (lastUsedStep !== null && match <= lastUsedStep) {
    return { ok: false, step: match, reason: "deja_utilise" };
  }
  return { ok: true, step: match, reason: "ok" };
}

/**
 * URI `otpauth://` — ce que l’authentificateur lit (QR ou lien) pour enregistrer
 * le compte. Les valeurs sont encodées : un e-mail contient « @ », un libellé
 * peut contenir des espaces.
 */
export function buildOtpAuthUri(secretBase32: string, account: TotpAccount): string {
  const issuer = account.issuer ?? MFA_ISSUER;
  const label = `${issuer}:${account.account}`;
  const parameters = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${parameters.toString()}`;
}
