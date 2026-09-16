import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { ENV } from "./env";

/**
 * Protection du secret TOTP AU REPOS — AES-256-GCM, clé dérivée de `JWT_SECRET`.
 *
 * POURQUOI CHIFFRER
 * -----------------
 * Un secret TOTP est un MOT DE PASSE PARTAGÉ : qui le lit fabrique des codes
 * valides indéfiniment. La colonne `users.mfaSecretCipher` ne doit donc jamais
 * contenir de secret exploitable — ni en clair, ni encodé. C’est aussi ce
 * qu’annonce le commentaire de colonne posé par la migration.
 *
 * POURQUOI DÉRIVER LA CLÉ PLUTÔT QUE CRÉER UNE VARIABLE
 * ----------------------------------------------------
 * Une variable d’environnement de plus (`MFA_ENCRYPTION_KEY`) serait une
 * variable de plus à poser chez l’hébergeur, à faire tourner, et dont l’oubli
 * se traduirait par une panne d’enrôlement en production. `JWT_SECRET` existe
 * déjà, fait au minimum 32 caractères (vérifié par `_core/env.ts`), et n’est
 * pas dans le dépôt. HKDF en dérive une clé de 32 octets PROPRE À CET USAGE :
 * la clé de chiffrement et la clé de signature des sessions sont différentes,
 * donc la compromission de l’une n’ouvre pas l’autre.
 *
 * CE QUE GCM APPORTE EN PLUS DU CHIFFREMENT
 * -----------------------------------------
 * Un tag d’authentification : modifier un octet du texte chiffré (ou le
 * décaler) fait échouer le déchiffrement au lieu de rendre un secret plausible
 * mais faux. Une altération en base se voit, elle ne se subit pas.
 *
 * FORMAT
 * ------
 * `v1.<iv>.<tag>.<texte chiffré>`, chacun en base64url. Le préfixe de version
 * permettra de changer d’algorithme sans casser les enrôlements existants : un
 * secret écrit aujourd’hui reste lisible après une évolution.
 *
 * DEUX CONSÉQUENCES OPÉRATIONNELLES, À CONNAÎTRE AVANT DE FAIRE ÉVOLUER LA CLÉ
 * ---------------------------------------------------------------------------
 * 1. FAIRE TOURNER `JWT_SECRET` REND LES SECRETS TOTP ILLISIBLES. La clé de
 *    chiffrement en dérive : changer le secret d’instance équivaut à jeter la
 *    clé. Les comptes portant une MFA ne peuvent alors plus présenter de code
 *    valide — `auth.mfaLogin` répond « indisponible », et l’enrôlement refuse
 *    tant que la MFA est active. Une rotation de `JWT_SECRET` doit donc être
 *    précédée d’une remise à zéro des colonnes MFA, faite par le propriétaire de
 *    la base (elles sont sous sa responsabilité, aucune procédure applicative ne
 *    les efface : ce serait un chemin de prise de contrôle).
 * 2. IL N’EXISTE PAS DE RÉINITIALISATION EN LIBRE-SERVICE. Un téléphone perdu
 *    sans code de secours ne se remplace pas depuis l’interface : la seule voie
 *    est la remise à zéro des colonnes par le propriétaire, suivie d’un nouvel
 *    enrôlement. C’est le prix de n’avoir ouvert aucun chemin qui retire un
 *    second facteur sans preuve ; c’est un choix, pas un oubli.
 */

/** Marqueur de version du format d’enveloppe. */
const ENVELOPE_VERSION = "v1";

/** Information de domaine HKDF : sépare cette clé de toute autre clé dérivée. */
const KEY_INFO = "lucepress:mfa-secret:v1";

/**
 * Sel HKDF. Non secret par nature (HKDF n’exige pas un sel secret) : il sert à
 * la SÉPARATION DE DOMAINE, pas à la confidentialité.
 */
const KEY_SALT = "lucepress:facturation:mfa";

/** Taille de clé AES-256. */
const KEY_BYTES = 32;

/** Nonce GCM : 12 octets est la taille recommandée pour ce mode. */
const IV_BYTES = 12;

/** Longueur du tag d’authentification GCM, en octets. */
const TAG_BYTES = 16;

/** Secret en clair illisible, ou enveloppe altérée. Jamais un secret exploitable. */
export class MfaSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MfaSecretError";
  }
}

/**
 * Clé de chiffrement dérivée de `JWT_SECRET` par HKDF-SHA256.
 *
 * `secret` est injectable pour les tests : ils peuvent prouver qu’une AUTRE clé
 * ne déchiffre pas une enveloppe produite ici.
 */
export function deriveMfaKey(secret: string = ENV.cookieSecret): Buffer {
  if (secret.length === 0) {
    throw new MfaSecretError("Secret d’instance indisponible : impossible de dériver la clé MFA.");
  }
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from(KEY_SALT, "utf8"), Buffer.from(KEY_INFO, "utf8"), KEY_BYTES));
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function fromBase64Url(value: string): Buffer | null {
  if (value.length === 0) return null;
  try {
    const buffer = Buffer.from(value, "base64url");
    // `Buffer.from` ne signale pas une chaîne illisible : il rend ce qu’il peut.
    // On vérifie donc l’aller-retour, seule façon d’être sûr.
    return buffer.toString("base64url") === value ? buffer : null;
  } catch {
    return null;
  }
}

/** Chiffre un secret TOTP. Renvoie l’enveloppe à écrire dans la colonne. */
export function encryptMfaSecret(plainSecret: string, key: Buffer = deriveMfaKey()): string {
  if (plainSecret.trim().length === 0) {
    throw new MfaSecretError("Refus de chiffrer un secret vide.");
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_VERSION, toBase64Url(iv), toBase64Url(tag), toBase64Url(ciphertext)].join(".");
}

/**
 * Déchiffre une enveloppe produite par `encryptMfaSecret`.
 *
 * Lève `MfaSecretError` — jamais ne rend une valeur approchante : un secret
 * faux accepterait les codes d’un autre compte, ce qui est pire qu’un refus.
 */
export function decryptMfaSecret(envelope: string, key: Buffer = deriveMfaKey()): string {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
    throw new MfaSecretError("Enveloppe MFA de format inconnu.");
  }
  const iv = fromBase64Url(parts[1]);
  const tag = fromBase64Url(parts[2]);
  const ciphertext = fromBase64Url(parts[3]);
  if (!iv || !tag || !ciphertext || iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new MfaSecretError("Enveloppe MFA altérée : composants illisibles.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Ni la clé, ni le contenu, ni la pile ne sont journalisés : l’appelant sait
    // seulement que l’enveloppe n’est pas ouvrable.
    throw new MfaSecretError("Enveloppe MFA illisible : clé différente ou donnée altérée.");
  }
}

/**
 * Forme d’enveloppe RECONNUE — utilisée pour vérifier qu’une valeur lue en base
 * ne peut pas être un secret en clair (un base32 nu, par exemple).
 */
export function isMfaEnvelope(value: string): boolean {
  return value.startsWith(`${ENVELOPE_VERSION}.`) && value.split(".").length === 4;
}
