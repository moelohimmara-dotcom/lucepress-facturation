import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MFA_RECOVERY_ALPHABET,
  MFA_RECOVERY_CODE_LENGTH,
  formatRecoveryCode,
  isRecoveryCode,
  isSecondFactor,
  isTotpCode,
  normalizeRecoveryCode,
  normalizeTotpCode,
} from "../shared/mfa";
import { MFA_CHALLENGE_AUDIENCE, deriveChallengeKey, signMfaChallenge, verifyMfaChallenge } from "./_core/mfaChallenge";
import { MfaSecretError, decryptMfaSecret, deriveMfaKey, encryptMfaSecret, isMfaEnvelope } from "./_core/mfaSecret";
import { signLocalSession, verifyLocalSession } from "./_core/localAuth";
import {
  buildOtpAuthUri,
  decodeBase32,
  encodeBase32,
  generateTotpSecret,
  totpCodeAtStep,
  totpSecondsRemaining,
  totpStepAt,
  verifyTotp,
} from "./_core/totp";
import {
  confirmEnrollment,
  disableMfa,
  generateRecoveryCodes,
  isEncryptedSecret,
  isMfaActiveForUser,
  readMfaState,
  startEnrollment,
  verifySecondFactor,
} from "./mfa";

/**
 * ÉTAPE B2 — MFA (TOTP), le socle : calcul, chiffrement, défi, persistance.
 *
 * Ce fichier couvre ce qui doit être vrai AVANT toute question d’interface :
 *   - le calcul TOTP, confronté aux VECTEURS OFFICIELS de la RFC 6238 ;
 *   - le secret TOTP, qui ne doit JAMAIS toucher la base en clair ;
 *   - le jeton de défi, qui ne doit JAMAIS pouvoir servir de session ;
 *   - l’anti-rejeu et la consommation des codes de secours, prouvés sur le
 *     comportement réel de `server/mfa.ts` — pas sur une déclaration.
 *
 * La base est remplacée par une TABLE `users` EN MÉMOIRE qui interprète les six
 * instructions réellement émises par `server/mfa.ts`. C’est un peu plus de code
 * qu’un `vi.fn()` par appel, et c’est délibéré : sans état, on ne peut prouver
 * ni qu’un code déjà utilisé est refusé, ni qu’un code de secours consommé
 * disparaît de la liste. Ces deux règles SONT l’anti-rejeu.
 *
 * Les rendus d’écran vivent dans `server/systemMfaScreens.ui.test.ts` : ce fichier-ci
 * reste sans navigateur, donc sans dépendance à l’interface.
 */

const mocks = vi.hoisted(() => {
  // `vi.hoisted` s’exécute avant le chargement de `_core/env.ts` : c’est le seul
  // moment où l’on peut fournir un JWT_SECRET, dont dérive la clé de chiffrement
  // du secret TOTP. Sans lui, tout enrôlement échouerait en test.
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test-uniquement-32-caracteres-mini";
  return { getDb: vi.fn() };
});

// `server/mfa.ts` ne demande QUE `getDb` au module de base : le double reste
// donc minimal, et une dépendance nouvelle se signalerait par une erreur.
vi.mock("./db", () => ({ getDb: mocks.getDb }));

/** Texte SQL final et paramètres liés, pour inspecter ce qui part en base. */
function sqlOf(query: SQL) {
  return new PgDialect().sqlToQuery(query);
}

/* ------------------------------------------------------------------ */
/* Table `users` en mémoire                                            */
/* ------------------------------------------------------------------ */

type FakeUserRow = {
  id: number;
  mfaSecretCipher: string | null;
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
  mfaRecoveryCodes: string | null;
  mfaLastUsedStep: number | null;
};

/**
 * Interprète les requêtes de `server/mfa.ts` sur une ligne `users`.
 *
 * Les discriminations portent sur le texte SQL normalisé (minuscules, espaces
 * compactés) : c’est fragile par nature, mais une requête non reconnue rend `[]`
 * — donc un refus — et ne peut pas produire un faux succès. Un changement de
 * requête côté serveur se voit immédiatement dans les tests.
 */
function createFakeUsersTable(initial: Partial<FakeUserRow> = {}) {
  const row: FakeUserRow = {
    id: 7,
    mfaSecretCipher: null,
    mfaEnabled: false,
    mfaEnrolledAt: null,
    mfaRecoveryCodes: null,
    mfaLastUsedStep: null,
    ...initial,
  };
  const statements: string[] = [];
  const unmatched: string[] = [];

  const runner = async (query: SQL): Promise<Record<string, unknown>[]> => {
    const { sql: rawSql, params } = sqlOf(query);
    const text = rawSql.replace(/\s+/g, " ").trim();
    const lower = text.toLowerCase();
    statements.push(text);

    // GARDE-FOU DE L’INTERPRÉTEUR : chaque requête doit viser LA ligne du test.
    // Sans cette vérification, un identifiant de compte erroné dans une
    // instruction passerait inaperçu — la table répondrait quand même, et le
    // test prouverait la mauvaise chose. On échoue bruyamment à la place.
    if (!params.includes(row.id)) {
      throw new Error(`Requête sans l’identifiant du compte (${row.id}) : ${text}`);
    }

    if (lower.startsWith("select")) return [{ ...row }];
    if (!lower.startsWith("update")) {
      unmatched.push(text);
      return [];
    }

    // Activation — `where … "mfaSecretCipher" is not null` : sans secret, rien.
    if (lower.includes('"mfaenabled" = true')) {
      if (row.mfaSecretCipher === null) return [];
      row.mfaEnabled = true;
      row.mfaEnrolledAt = String(params[0]);
      row.mfaRecoveryCodes = String(params[1]);
      row.mfaLastUsedStep = Number(params[2]);
      return [{ id: row.id }];
    }

    // Désactivation — tout est vidé.
    if (lower.includes('"mfasecretcipher" = null')) {
      row.mfaSecretCipher = null;
      row.mfaEnabled = false;
      row.mfaEnrolledAt = null;
      row.mfaRecoveryCodes = null;
      row.mfaLastUsedStep = null;
      return [{ id: row.id }];
    }

    // Enrôlement — écrit le secret chiffré, n’active rien.
    if (lower.includes('set "mfasecretcipher" =')) {
      row.mfaSecretCipher = String(params[0]);
      row.mfaEnabled = false;
      row.mfaEnrolledAt = null;
      row.mfaRecoveryCodes = null;
      row.mfaLastUsedStep = null;
      return [{ id: row.id }];
    }

    // Anti-rejeu — la condition est dans la requête, donc atomique.
    if (lower.includes('set "mfalastusedstep" =')) {
      const step = Number(params[0]);
      const previous = row.mfaLastUsedStep;
      if (previous !== null && !(previous < step)) return [];
      row.mfaLastUsedStep = step;
      return [{ id: row.id }];
    }

    // Consommation d’un code de secours — comparaison-échange.
    if (lower.includes('set "mfarecoverycodes" =')) {
      if (row.mfaRecoveryCodes !== String(params[2])) return [];
      row.mfaRecoveryCodes = String(params[0]);
      return [{ id: row.id }];
    }

    unmatched.push(text);
    return [];
  };

  return { row, runner, statements, unmatched };
}

function useTable(table: ReturnType<typeof createFakeUsersTable>): void {
  mocks.getDb.mockResolvedValue({ execute: table.runner });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockReset();
});

/* ------------------------------------------------------------------ */
/* 1. Calcul TOTP — vecteurs officiels de la RFC 6238                  */
/* ------------------------------------------------------------------ */

describe("TOTP — calcul conforme, sans dépendance", () => {
  // Secret des annexes de la RFC 6238 : l’ASCII « 12345678901234567890 ».
  const SECRET_RFC = encodeBase32(Buffer.from("12345678901234567890", "utf8"));

  it("reproduit les vecteurs de la RFC 6238 (SHA-1, six chiffres)", () => {
    // Les valeurs publiées font huit chiffres ; un code à six chiffres en est la
    // troncature par la droite, ce que la RFC autorise explicitement (§5.3).
    const vecteurs: Array<[number, string]> = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
      [20000000000, "353130"],
    ];
    for (const [epochSeconds, attendu] of vecteurs) {
      const step = Math.floor(epochSeconds / 30);
      expect({ epochSeconds, code: totpCodeAtStep(SECRET_RFC, step) }).toEqual({ epochSeconds, code: attendu });
    }
  });

  it("encode et décode le base32 sans perte, et refuse un alphabet étranger", () => {
    const octets = Buffer.from("Lucepress", "utf8");
    const encode = encodeBase32(octets);
    expect(encode).toMatch(/^[A-Z2-7]+$/);
    expect(decodeBase32(encode)?.equals(octets)).toBe(true);
    // Un remplissage « = » et une casse basse sont tolérés (saisie humaine).
    expect(decodeBase32(`${encode.toLowerCase()}====`)?.equals(octets)).toBe(true);
    // Un caractère hors alphabet rend `null` — jamais des octets inventés.
    expect(decodeBase32("ABC1")).toBeNull();
    expect(decodeBase32("")).toBeNull();
  });

  it("tire un secret neuf de 32 caractères base32 à chaque enrôlement", () => {
    const premier = generateTotpSecret();
    const second = generateTotpSecret();
    expect(premier).toMatch(/^[A-Z2-7]{32}$/);
    expect(second).not.toBe(premier);
  });

  it("accepte le pas courant, tolère ±1, refuse au-delà", () => {
    const secret = generateTotpSecret();
    const maintenant = Date.parse("2026-09-16T10:00:00.000Z");
    const pas = totpStepAt(maintenant);

    for (const offset of [-1, 0, 1]) {
      const verdict = verifyTotp({ secretBase32: secret, code: totpCodeAtStep(secret, pas + offset)!, nowMs: maintenant });
      expect({ offset, ok: verdict.ok, step: verdict.step }).toEqual({ offset, ok: true, step: pas + offset });
    }
    for (const offset of [-2, 2]) {
      const verdict = verifyTotp({ secretBase32: secret, code: totpCodeAtStep(secret, pas + offset)!, nowMs: maintenant });
      expect({ offset, ok: verdict.ok, reason: verdict.reason }).toEqual({ offset, ok: false, reason: "code_incorrect" });
    }
  });

  it("REFUSE un code dont le pas a déjà été consommé (anti-rejeu)", () => {
    const secret = generateTotpSecret();
    const maintenant = Date.parse("2026-09-16T10:00:00.000Z");
    const pas = totpStepAt(maintenant);
    const code = totpCodeAtStep(secret, pas)!;

    // Jamais utilisé : accepté.
    expect(verifyTotp({ secretBase32: secret, code, nowMs: maintenant, lastUsedStep: null }).ok).toBe(true);
    // Le même pas est marqué consommé : refusé, y compris 30 secondes plus tard
    // — où le pas précédent reste dans la fenêtre de tolérance.
    const rejoue = verifyTotp({ secretBase32: secret, code, nowMs: maintenant + 30_000, lastUsedStep: pas });
    expect({ ok: rejoue.ok, reason: rejoue.reason }).toEqual({ ok: false, reason: "deja_utilise" });
    // Un pas POSTÉRIEUR reste accepté : la progression n’est pas bloquée.
    const suivant = totpCodeAtStep(secret, pas + 1)!;
    expect(verifyTotp({ secretBase32: secret, code: suivant, nowMs: maintenant + 30_000, lastUsedStep: pas }).ok).toBe(true);
  });

  it("refuse une saisie qui n’a pas la forme d’un code, sans lever", () => {
    const secret = generateTotpSecret();
    for (const code of ["", "12345", "1234567", "abcdef", "12 34 5"]) {
      expect(verifyTotp({ secretBase32: secret, code, nowMs: Date.now() }).reason).toBe("format");
    }
    // Un secret illisible est un refus, jamais une exception.
    expect(verifyTotp({ secretBase32: "pas-du-base32!", code: "123456", nowMs: Date.now() }).reason).toBe("secret_illisible");
  });

  it("compte les secondes restantes du pas courant", () => {
    expect(totpSecondsRemaining(Date.parse("2026-09-16T10:00:00.000Z"))).toBe(30);
    expect(totpSecondsRemaining(Date.parse("2026-09-16T10:00:29.000Z"))).toBe(1);
  });

  it("construit une URI otpauth complète, avec l’émetteur et les paramètres", () => {
    const secret = generateTotpSecret();
    const uri = buildOtpAuthUri(secret, { account: "systeme@lucepres.gn" });
    expect(uri.startsWith("otpauth://totp/Lucepress%3Asysteme%40lucepres.gn?")).toBe(true);
    const query = new URLSearchParams(uri.split("?")[1]);
    expect(query.get("secret")).toBe(secret);
    expect(query.get("issuer")).toBe("Lucepress");
    expect(query.get("digits")).toBe("6");
    expect(query.get("period")).toBe("30");
    expect(query.get("algorithm")).toBe("SHA1");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Formats partagés                                                 */
/* ------------------------------------------------------------------ */

describe("Formats des codes — saisie tolérante", () => {
  it("nettoie une saisie TOTP sans jamais accepter autre chose que des chiffres", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode("123-456")).toBe("123456");
    expect(isTotpCode("123456")).toBe(true);
    expect(isTotpCode("12345")).toBe(false);
  });

  it("présente un code de secours par groupes, et le relit indifféremment de la casse", () => {
    expect(formatRecoveryCode("a2c4e7gh9k")).toBe("A2C4E-7GH9K");
    expect(normalizeRecoveryCode("a2c4e-7gh9k")).toBe("A2C4E7GH9K");
    expect(isRecoveryCode("A2C4E-7GH9K")).toBe(true);
    // Un glyphe ambigu est refusé : « 0 » et « 1 » ne font pas partie de l’alphabet.
    expect(MFA_RECOVERY_ALPHABET).not.toContain("0");
    expect(MFA_RECOVERY_ALPHABET).not.toContain("1");
    expect(isRecoveryCode("0BCDE7GH9K")).toBe(false);
    expect(isRecoveryCode("A2C4E7GH9")).toBe(false);
  });

  it("accepte les deux natures de second facteur", () => {
    expect(isSecondFactor("123456")).toBe(true);
    expect(isSecondFactor("A2C4E-7GH9K")).toBe(true);
    expect(isSecondFactor("coucou")).toBe(false);
  });

  it("tire des codes de secours distincts, dans l’alphabet annoncé", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toHaveLength(MFA_RECOVERY_CODE_LENGTH);
      expect(isRecoveryCode(code)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Secret au repos                                                  */
/* ------------------------------------------------------------------ */

describe("Secret TOTP au repos — chiffré, jamais en clair", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("chiffre puis relit à l’identique", () => {
    const enveloppe = encryptMfaSecret(secret);
    expect(decryptMfaSecret(enveloppe)).toBe(secret);
  });

  it("ne laisse JAMAIS le secret apparaître dans la valeur stockée", () => {
    const enveloppe = encryptMfaSecret(secret);
    expect(enveloppe).not.toContain(secret);
    // Ni en clair, ni encodé : base64, base64url et hexadécimal sont couverts.
    expect(enveloppe).not.toContain(Buffer.from(secret, "utf8").toString("base64"));
    expect(enveloppe).not.toContain(Buffer.from(secret, "utf8").toString("hex"));
    expect(isMfaEnvelope(enveloppe)).toBe(true);
    expect(isEncryptedSecret(enveloppe)).toBe(true);
    // Un secret nu n’est pas une enveloppe : c’est ce que la vérification traque.
    expect(isEncryptedSecret(secret)).toBe(false);
  });

  it("produit deux enveloppes différentes pour le même secret (nonce aléatoire)", () => {
    expect(encryptMfaSecret(secret)).not.toBe(encryptMfaSecret(secret));
  });

  it("dérive une clé propre à partir de JWT_SECRET, et refuse une autre clé", () => {
    const cle = deriveMfaKey();
    expect(cle).toHaveLength(32);
    expect(deriveMfaKey("un-autre-secret-de-trente-deux-caracteres!")).not.toEqual(cle);

    const enveloppe = encryptMfaSecret(secret, cle);
    expect(() => decryptMfaSecret(enveloppe, deriveMfaKey("un-autre-secret-de-trente-deux-caracteres!"))).toThrow(MfaSecretError);
  });

  it("détecte une altération au lieu de rendre un secret plausible", () => {
    const enveloppe = encryptMfaSecret(secret);
    const parties = enveloppe.split(".");
    // On modifie un caractère du texte chiffré.
    const modifie = `${parties[0]}.${parties[1]}.${parties[2]}.${parties[3].slice(0, -2)}AA`;
    expect(() => decryptMfaSecret(modifie)).toThrow(MfaSecretError);
    // Formats manifestement invalides : refus francs.
    for (const invalide of ["", "v1", "v1.a.b", "v2.a.b.c", `${parties[0]}.${parties[1]}.${parties[2]}.`]) {
      expect(() => decryptMfaSecret(invalide)).toThrow(MfaSecretError);
    }
    // Un secret vide n’est jamais chiffré : ce serait un enrôlement sans secret.
    expect(() => encryptMfaSecret("   ")).toThrow(MfaSecretError);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Jeton de défi                                                   */
/* ------------------------------------------------------------------ */

describe("Jeton de défi — n’est PAS une session", () => {
  it("s’ouvre et se relit, avec le compte et le tenant", async () => {
    const { token, expiresInSeconds } = await signMfaChallenge({ openId: "local_sys", tenantId: 1 });
    expect(expiresInSeconds).toBe(300);
    expect(await verifyMfaChallenge(token)).toEqual({ openId: "local_sys", tenantId: 1 });
  });

  it("NE PEUT PAS servir de session — clé dérivée distincte", async () => {
    const { token } = await signMfaChallenge({ openId: "local_sys", tenantId: 1 });
    // C’est LA preuve qui compte : un défi présenté comme cookie de session est
    // refusé par le vérificateur de session, et réciproquement.
    expect(await verifyLocalSession(token)).toBeNull();

    const session = await signLocalSession({ openId: "local_sys", email: "s@lucepres.gn", name: "Sys", tenantId: 1 });
    expect(await verifyMfaChallenge(session)).toBeNull();
    // ...alors que chacune reste valable dans son propre usage.
    expect(await verifyLocalSession(session)).not.toBeNull();
  });

  it("refuse un défi expiré, un jeton fabriqué, une audience étrangère", async () => {
    const expire = await signMfaChallenge({ openId: "local_sys", tenantId: 1 }, -1);
    expect(await verifyMfaChallenge(expire.token)).toBeNull();

    expect(await verifyMfaChallenge("pas-un-jeton")).toBeNull();
    expect(await verifyMfaChallenge("")).toBeNull();
    expect(await verifyMfaChallenge(null)).toBeNull();

    // Même clé de défi, mais audience d’un autre usage : refusé.
    const cle = deriveChallengeKey();
    const etranger = await new SignJWT({ openId: "local_sys", tenantId: 1 })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("lucepress")
      .setAudience("lucepress:autre-usage")
      .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
      .sign(cle);
    expect(await verifyMfaChallenge(etranger)).toBeNull();
    expect(MFA_CHALLENGE_AUDIENCE).toBe("lucepress:mfa-challenge");

    // Contenu incomplet : refusé aussi (aucun champ optionnel).
    const incomplet = await new SignJWT({ openId: "local_sys" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer("lucepress")
      .setAudience(MFA_CHALLENGE_AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
      .sign(cle);
    expect(await verifyMfaChallenge(incomplet)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 5. Persistance et règles, sur la table en mémoire                   */
/* ------------------------------------------------------------------ */

const MAINTENANT = new Date("2026-09-16T10:00:00.000Z");

describe("Enrôlement — secret chiffré, activation sur premier code", () => {
  it("écrit un secret CHIFFRÉ et n’active rien avant confirmation", async () => {
    const table = createFakeUsersTable();
    useTable(table);

    const demarrage = await startEnrollment(7, "systeme@lucepres.gn");
    expect(demarrage.ok).toBe(true);
    if (!demarrage.ok) return;

    // Le secret rendu est un base32 exploitable...
    expect(demarrage.value.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(demarrage.value.otpauthUri).toContain(demarrage.value.secret);
    // ...mais la colonne ne contient QUE l’enveloppe.
    expect(table.row.mfaSecretCipher).not.toBeNull();
    expect(table.row.mfaSecretCipher).not.toContain(demarrage.value.secret);
    expect(isEncryptedSecret(table.row.mfaSecretCipher)).toBe(true);
    expect(decryptMfaSecret(table.row.mfaSecretCipher as string)).toBe(demarrage.value.secret);

    // Aucune activation, aucun code de secours tant que rien n’est confirmé :
    // un enrôlement interrompu ne doit pas verrouiller la connexion.
    expect(table.row.mfaEnabled).toBe(false);
    expect(table.row.mfaRecoveryCodes).toBeNull();
    expect(await isMfaActiveForUser(7)).toBe(false);
  });

  it("refuse un premier code faux, puis active sur un code juste en rendant dix codes de secours", async () => {
    const table = createFakeUsersTable();
    useTable(table);
    const demarrage = await startEnrollment(7, "systeme@lucepres.gn");
    if (!demarrage.ok) throw new Error("enrôlement non ouvert");

    const faux = await confirmEnrollment(7, "000000", { now: () => MAINTENANT });
    // « 000000 » a une chance sur un million de tomber juste : on vérifie le
    // refus par le motif, pas par la valeur.
    if (faux.ok) throw new Error("un code improbable a été accepté");
    expect(table.row.mfaEnabled).toBe(false);

    const code = totpCodeAtStep(demarrage.value.secret, totpStepAt(MAINTENANT.getTime()))!;
    const confirmation = await confirmEnrollment(7, code, { now: () => MAINTENANT });
    expect(confirmation.ok).toBe(true);
    if (!confirmation.ok) return;

    expect(confirmation.value.recoveryCodes).toHaveLength(10);
    expect(table.row.mfaEnabled).toBe(true);
    expect(table.row.mfaEnrolledAt).toBe(MAINTENANT.toISOString());
    expect(table.row.mfaLastUsedStep).toBe(totpStepAt(MAINTENANT.getTime()));

    // Les codes de secours sont stockés HACHÉS : aucune valeur en clair.
    const stockage = table.row.mfaRecoveryCodes as string;
    for (const code2 of confirmation.value.recoveryCodes) {
      expect(stockage).not.toContain(code2);
    }
    const hashes = JSON.parse(stockage) as string[];
    expect(hashes).toHaveLength(10);
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await readMfaState(7)).toMatchObject({ readable: true, enabled: true, recoveryCodesRemaining: 10 });
    expect(await isMfaActiveForUser(7)).toBe(true);
  });

  it("refuse un second enrôlement quand la MFA est déjà active", async () => {
    const table = createFakeUsersTable({ mfaEnabled: true, mfaSecretCipher: encryptMfaSecret("GEZDGNBVGY3TQOJQ") });
    useTable(table);

    const resultat = await startEnrollment(7, "systeme@lucepres.gn");
    expect(resultat).toEqual({ ok: false, reason: "deja_active" });
    // Le secret déjà en place n’a pas été touché.
    expect(decryptMfaSecret(table.row.mfaSecretCipher as string)).toBe("GEZDGNBVGY3TQOJQ");
  });

  it("refuse de confirmer sans enrôlement en cours", async () => {
    useTable(createFakeUsersTable());
    expect(await confirmEnrollment(7, "123456")).toEqual({ ok: false, reason: "aucun_enrolement" });
  });
});

describe("Vérification — anti-rejeu et codes de secours consommés", () => {
  async function enrole(now: Date = MAINTENANT) {
    const table = createFakeUsersTable();
    useTable(table);
    const demarrage = await startEnrollment(7, "systeme@lucepres.gn");
    if (!demarrage.ok) throw new Error("enrôlement non ouvert");
    const premierCode = totpCodeAtStep(demarrage.value.secret, totpStepAt(now.getTime()))!;
    const confirmation = await confirmEnrollment(7, premierCode, { now: () => now });
    if (!confirmation.ok) throw new Error(`confirmation refusée : ${confirmation.reason}`);
    return { table, secret: demarrage.value.secret, codes: confirmation.value.recoveryCodes };
  }

  it("accepte le code du pas suivant, et REFUSE sa réutilisation", async () => {
    const { table, secret } = await enrole();
    const suivant = new Date(MAINTENANT.getTime() + 30_000);
    const code = totpCodeAtStep(secret, totpStepAt(suivant.getTime()))!;

    const premiere = await verifySecondFactor(7, code, { now: () => suivant });
    expect(premiere.ok).toBe(true);
    if (premiere.ok) expect(premiere.value).toMatchObject({ method: "totp", step: totpStepAt(suivant.getTime()), recoveryCodesRemaining: 10 });

    // Deuxième présentation du MÊME code : refusée par la condition SQL.
    const seconde = await verifySecondFactor(7, code, { now: () => suivant });
    expect(seconde).toEqual({ ok: false, reason: "code_deja_utilise" });
    // ...et le pas enregistré n’a pas reculé.
    expect(table.row.mfaLastUsedStep).toBe(totpStepAt(suivant.getTime()));
  });

  it("refuse le code déjà consommé à l’enrôlement, même encore dans la fenêtre", async () => {
    const { secret } = await enrole();
    const premierCode = totpCodeAtStep(secret, totpStepAt(MAINTENANT.getTime()))!;
    // Le pas de l’enrôlement est marqué consommé : le même code ne rouvre rien.
    expect(await verifySecondFactor(7, premierCode, { now: () => MAINTENANT })).toEqual({ ok: false, reason: "code_deja_utilise" });
  });

  it("accepte un code de secours, puis le CONSOMME : il ne sert qu’une fois", async () => {
    const { table, codes } = await enrole();
    const choisi = codes[0];

    const premiere = await verifySecondFactor(7, choisi);
    expect(premiere.ok).toBe(true);
    if (premiere.ok) expect(premiere.value).toMatchObject({ method: "recovery", step: null, recoveryCodesRemaining: 9 });
    // Le code est retiré de la liste stockée : 9 empreintes, la sienne a disparu.
    const restants = JSON.parse(table.row.mfaRecoveryCodes as string) as string[];
    expect(restants).toHaveLength(9);
    expect(await readMfaState(7)).toMatchObject({ recoveryCodesRemaining: 9 });

    // Deuxième présentation : refusée, et la liste ne bouge plus.
    expect(await verifySecondFactor(7, choisi)).toEqual({ ok: false, reason: "code_incorrect" });
    expect(JSON.parse(table.row.mfaRecoveryCodes as string) as string[]).toHaveLength(9);

    // Présenté avec tirets et en minuscules — comme un utilisateur le recopie.
    const deuxieme = formatRecoveryCode(codes[1]).toLowerCase();
    const suivant = await verifySecondFactor(7, deuxieme);
    expect(suivant.ok).toBe(true);
    if (suivant.ok) expect(suivant.value.recoveryCodesRemaining).toBe(8);
    // Délai explicite : chaque vérification de code de secours compare le code
    // à DIX empreintes scrypt, et scrypt est lent PAR CONSTRUCTION. Tester la
    // vraie fonction de hachage, c’est en payer le prix.
  }, 30_000);

  it("refuse un code faux, un code mal formé, la MFA non active", async () => {
    const { table } = await enrole();
    expect(await verifySecondFactor(7, "000000")).toMatchObject({ ok: false });
    expect(await verifySecondFactor(7, "n’importe quoi")).toEqual({ ok: false, reason: "code_incorrect" });
    expect(await verifySecondFactor(7, "A2C4E7GH9K")).toEqual({ ok: false, reason: "code_incorrect" });

    table.row.mfaEnabled = false;
    expect(await verifySecondFactor(7, "123456")).toEqual({ ok: false, reason: "non_active" });
  }, 30_000);
});

describe("Désactivation — un code valide est exigé", () => {
  it("vide toutes les colonnes MFA sur un code juste", async () => {
    const table = createFakeUsersTable();
    useTable(table);
    const demarrage = await startEnrollment(7, "systeme@lucepres.gn");
    if (!demarrage.ok) throw new Error("enrôlement non ouvert");
    await confirmEnrollment(7, totpCodeAtStep(demarrage.value.secret, totpStepAt(MAINTENANT.getTime()))!, { now: () => MAINTENANT });

    const suivant = new Date(MAINTENANT.getTime() + 60_000);
    const code = totpCodeAtStep(demarrage.value.secret, totpStepAt(suivant.getTime()))!;
    const resultat = await disableMfa(7, code, { now: () => suivant });
    expect(resultat.ok).toBe(true);
    expect(table.row).toMatchObject({
      mfaSecretCipher: null,
      mfaEnabled: false,
      mfaEnrolledAt: null,
      mfaRecoveryCodes: null,
      mfaLastUsedStep: null,
    });
    expect(await isMfaActiveForUser(7)).toBe(false);
  });

  it("refuse un code faux SANS rien désactiver", async () => {
    const table = createFakeUsersTable({ mfaEnabled: true, mfaSecretCipher: encryptMfaSecret("GEZDGNBVGY3TQOJQ") });
    useTable(table);
    const avant = { ...table.row };

    expect(await disableMfa(7, "000000")).toMatchObject({ ok: false });
    expect(table.row).toEqual(avant);
  });

  it("accepte un code de secours : c’est le seul recours d’un téléphone perdu", async () => {
    const table = createFakeUsersTable();
    useTable(table);
    const demarrage = await startEnrollment(7, "systeme@lucepres.gn");
    if (!demarrage.ok) throw new Error("enrôlement non ouvert");
    const confirmation = await confirmEnrollment(7, totpCodeAtStep(demarrage.value.secret, totpStepAt(MAINTENANT.getTime()))!, { now: () => MAINTENANT });
    if (!confirmation.ok) throw new Error("confirmation refusée");

    expect((await disableMfa(7, confirmation.value.recoveryCodes[3])).ok).toBe(true);
    expect(table.row.mfaEnabled).toBe(false);
  }, 30_000);

  it("refuse de désactiver une MFA qui n’est pas active", async () => {
    useTable(createFakeUsersTable());
    expect(await disableMfa(7, "123456")).toEqual({ ok: false, reason: "non_active" });
  });
});

/* ------------------------------------------------------------------ */
/* 6. Panne de base                                                     */
/* ------------------------------------------------------------------ */

describe("Base injoignable — on ne devine pas, on refuse", () => {
  it("n’ouvre JAMAIS la porte de la console (fail-closed)", async () => {
    mocks.getDb.mockResolvedValue(null);
    expect(await isMfaActiveForUser(7)).toBe(false);

    mocks.getDb.mockRejectedValue(new Error("connexion refusée"));
    expect(await isMfaActiveForUser(7)).toBe(false);

    // `readMfaState` distingue « pas de MFA » de « on ne sait pas ».
    expect(await readMfaState(7)).toEqual({
      readable: false,
      enabled: false,
      pending: false,
      enrolledAt: null,
      recoveryCodesRemaining: 0,
    });
  });

  it("refuse chaque opération en le disant, sans lever", async () => {
    mocks.getDb.mockResolvedValue({ execute: vi.fn().mockRejectedValue(new Error('column "mfaEnabled" does not exist')) });

    expect(await startEnrollment(7, "systeme@lucepres.gn")).toEqual({ ok: false, reason: "indisponible" });
    expect(await confirmEnrollment(7, "123456")).toEqual({ ok: false, reason: "indisponible" });
    expect(await verifySecondFactor(7, "123456")).toEqual({ ok: false, reason: "indisponible" });
    expect(await disableMfa(7, "123456")).toEqual({ ok: false, reason: "indisponible" });
  });

  it("décrit l’état d’un enrôlement interrompu sans le confondre avec une MFA active", async () => {
    useTable(createFakeUsersTable({ mfaSecretCipher: encryptMfaSecret("GEZDGNBVGY3TQOJQ"), mfaEnabled: false }));
    expect(await readMfaState(7)).toMatchObject({ readable: true, enabled: false, pending: true, recoveryCodesRemaining: 0 });
    expect(await isMfaActiveForUser(7)).toBe(false);
  });

  it("n’émet QUE des requêtes sur les colonnes MFA annoncées", async () => {
    const table = createFakeUsersTable();
    useTable(table);
    const demarrage = await startEnrollment(7, "systeme@lucepres.gn");
    if (!demarrage.ok) throw new Error("enrôlement non ouvert");
    await confirmEnrollment(7, totpCodeAtStep(demarrage.value.secret, totpStepAt(MAINTENANT.getTime()))!, { now: () => MAINTENANT });

    // Aucune requête non reconnue par la table : tout ce que le module émet est
    // compris, donc rien ne passe « à côté » de l’anti-rejeu.
    expect(table.unmatched).toEqual([]);
    // Et aucune instruction DDL n’a été émise : le schéma appartient au
    // propriétaire de la base, jamais à ce module.
    for (const requete of table.statements) {
      expect(requete.toLowerCase()).not.toMatch(/^\s*(alter|create|drop|truncate)\b/);
    }
  });
});
