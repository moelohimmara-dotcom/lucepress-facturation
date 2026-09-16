/**
 * Authentification à deux facteurs (TOTP) — VOCABULAIRE PARTAGÉ.
 *
 * Pourquoi un module partagé : le serveur vérifie les codes, l’interface les
 * saisit et les annonce. Si les deux décrivaient les paramètres séparément, une
 * divergence (6 ou 8 chiffres, 30 ou 60 secondes) produirait des codes refusés
 * sans que personne ne sache pourquoi. Une seule déclaration, lue des deux
 * côtés.
 *
 * AUCUNE dépendance : ni bibliothèque TOTP, ni bibliothèque de QR code. Le
 * calcul vit dans `server/_core/totp.ts`, sur `node:crypto`.
 */

/** Nom affiché par l’application d’authentification du téléphone. */
export const MFA_ISSUER = "Lucepress";

/** Nombre de chiffres d’un code TOTP (RFC 6238 §5.3). */
export const TOTP_DIGITS = 6;

/** Durée d’un pas, en secondes. 30 s est la valeur universellement admise. */
export const TOTP_PERIOD_SECONDS = 30;

/** Algorithme de hachage. SHA-1 est celui que tout authentificateur implémente. */
export const TOTP_ALGORITHM = "SHA1";

/**
 * Nombre de pas acceptés de part et d’autre du pas courant (±1).
 *
 * Tolérance d’horloge UNIQUEMENT : elle absorbe une dérive de quelques secondes
 * entre le téléphone et le serveur, ce qui est la règle du métier. Elle n’ouvre
 * pas une fenêtre de plusieurs minutes — au plus 90 secondes de validité réelle.
 */
export const TOTP_WINDOW = 1;

/** Taille du secret, en octets. 160 bits : la recommandation de la RFC 4226 §4. */
export const MFA_SECRET_BYTES = 20;

/** Nombre de codes de secours remis à l’enrôlement. */
export const MFA_RECOVERY_CODE_COUNT = 10;

/**
 * Alphabet des codes de secours : 32 caractères, sans « I », « O », « 0 » ni
 * « 1 ». Ces quatre glyphes se confondent à la lecture et à la dictée, et un
 * code de secours se lit sur un écran, se note sur un papier, parfois se
 * recopie au téléphone. 32 = 5 bits par caractère, donc un entier de bits.
 */
export const MFA_RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Un code de secours = 2 groupes de 5 caractères (50 bits, soit ~1,1 × 10¹⁵). */
export const MFA_RECOVERY_GROUP_SIZE = 5;
export const MFA_RECOVERY_GROUPS = 2;

/** Longueur utile d’un code de secours, groupes et tiret exclus. */
export const MFA_RECOVERY_CODE_LENGTH = MFA_RECOVERY_GROUP_SIZE * MFA_RECOVERY_GROUPS;

/**
 * Durée de vie du défi ouvert par `auth.login` quand le compte porte une MFA.
 *
 * Volontairement TRÈS courte : ce jeton n’est pas une session, il n’autorise
 * qu’une seule chose — présenter un second facteur. Le temps d’ouvrir son
 * téléphone et de recopier six chiffres, sans plus.
 */
export const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

/** Taille d’un champ de saisie TOTP, telle que l’interface la dessine. */
export const MFA_CODE_LENGTH = TOTP_DIGITS;

/**
 * Nettoie une saisie de code TOTP : espaces, tirets et points sont retirés.
 * Un utilisateur qui recopie « 123 456 » ou « 123-456 » doit être compris.
 */
export function normalizeTotpCode(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** La saisie est-elle un code TOTP complet ? (exactement 6 chiffres) */
export function isTotpCode(value: string): boolean {
  return normalizeTotpCode(value).length === MFA_CODE_LENGTH;
}

/**
 * Nettoie une saisie de code de secours : majuscules, sans tirets ni espaces.
 * Le tiret de présentation et la casse de saisie ne doivent jamais faire
 * échouer un code juste.
 */
export function normalizeRecoveryCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Un code de secours complet et composé uniquement de l’alphabet annoncé ? */
export function isRecoveryCode(value: string): boolean {
  const normalized = normalizeRecoveryCode(value);
  if (normalized.length !== MFA_RECOVERY_CODE_LENGTH) return false;
  for (let index = 0; index < normalized.length; index += 1) {
    if (!MFA_RECOVERY_ALPHABET.includes(normalized.charAt(index))) return false;
  }
  return true;
}

/** Présentation d’un code de secours : « A2C4E-7GH9K ». */
export function formatRecoveryCode(value: string): string {
  const normalized = normalizeRecoveryCode(value);
  const groups: string[] = [];
  for (let index = 0; index < normalized.length; index += MFA_RECOVERY_GROUP_SIZE) {
    groups.push(normalized.slice(index, index + MFA_RECOVERY_GROUP_SIZE));
  }
  return groups.join("-");
}

/**
 * Saisie d’un second facteur : un code TOTP de 6 chiffres, ou un code de
 * secours. Les deux chemins sont acceptés à la connexion (`auth.mfaLogin`).
 */
export function isSecondFactor(value: string): boolean {
  return isTotpCode(value) || isRecoveryCode(value);
}
