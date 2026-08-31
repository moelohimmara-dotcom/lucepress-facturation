import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * Hash a plaintext password using scrypt (Node built-in, no native deps).
 * Returns `salt:hash` where both are hex.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored `salt:hash` value.
 * Uses timingSafeEqual to avoid timing attacks.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  const hashBuffer = Buffer.from(hash, "hex");
  if (hashBuffer.length !== derived.length) return false;
  return timingSafeEqual(hashBuffer, derived);
}
