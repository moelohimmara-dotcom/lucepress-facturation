import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";
import { parse as parseCookieHeader } from "cookie";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import {
  tenants,
  tenantMemberships,
  users,
  type User,
} from "../../drizzle/schema";
import { ENV } from "./env";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const TRIAL_HOURS = 48;
const TRIAL_MS = TRIAL_HOURS * 60 * 60 * 1000;

export const TRIAL_DURATION_HOURS = TRIAL_HOURS;

// ── Password hashing (scrypt) ──────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scrypt(password, salt, 64);
  const derivedHex = derived.toString("hex");
  if (derivedHex.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(derivedHex), Buffer.from(hash));
}

// ── JWT session ─────────────────────────────────────────────────────────────

export type SessionPayload = {
  userId: number;
  tenantId: number;
  role: string;
};

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    tenantId: payload.tenantId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifySession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const userId = Number(payload.userId);
    const tenantId = Number(payload.tenantId);
    const role = payload.role;
    if (!userId || !tenantId || typeof role !== "string") return null;
    return { userId, tenantId, role };
  } catch {
    return null;
  }
}

// ── Request authentication ──────────────────────────────────────────────────

export type AuthenticatedUser = User & {
  tenantId: number;
  tenantRole: string;
  tenantStatus: string;
  trialEndsAt: Date | null;
};

export async function authenticateRequest(
  req: Request
): Promise<AuthenticatedUser | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  let token = cookies[COOKIE_NAME];

  // Fallback: Authorization header (for preview iframe cookie issues)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  const session = await verifySession(token);
  if (!session) return null;

  const db = getDb();
  if (!db) return null;

  // Look up the membership to get the tenant-scoped role + tenant status
  const membershipRows = await db
    .select({
      userId: tenantMemberships.userId,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
      tenantStatus: tenants.status,
      trialEndsAt: tenants.trialEndsAt,
      plan: tenants.plan,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenantMemberships.userId, session.userId))
    .limit(1);

  const membership = membershipRows[0];
  if (!membership) return null;

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = userRows[0];
  if (!user) return null;

  // Update last signed in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  return {
    ...user,
    tenantId: membership.tenantId,
    tenantRole: membership.role,
    tenantStatus: membership.tenantStatus,
    trialEndsAt: membership.trialEndsAt,
  };
}

// ── Registration & login ────────────────────────────────────────────────────

function getDb() {
  if (!ENV.databaseUrl) return null;
  try {
    return drizzle(ENV.databaseUrl);
  } catch {
    return null;
  }
}

export async function registerTenant(input: {
  email: string;
  password: string;
  companyName: string;
}): Promise<{ userId: number; tenantId: number; token: string }> {
  const db = getDb();
  if (!db) throw new Error("Base de données indisponible.");

  const email = input.email.trim().toLowerCase();
  const companyName = input.companyName.trim();

  if (!email || !email.includes("@")) throw new Error("Adresse e-mail invalide.");
  if (input.password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
  if (companyName.length < 2) throw new Error("Le nom de l'entreprise est requis.");

  // Check if email already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) throw new Error("Un compte existe déjà avec cette adresse e-mail.");

  const passwordHash = await hashPassword(input.password);
  const openId = `local_${nanoid(24)}`;

  // Create user
  const userResult = await db.insert(users).values({
    openId,
    name: companyName,
    email,
    passwordHash,
    loginMethod: "email",
    role: "admin",
    lastSignedIn: new Date(),
  });
  const userId = Number(userResult[0].insertId);

  // Create tenant with 48h trial
  const trialEndsAt = new Date(Date.now() + TRIAL_MS);
  const tenantResult = await db.insert(tenants).values({
    name: companyName,
    plan: "trial",
    status: "trial",
    currency: "GNF",
    trialEndsAt,
  });
  const tenantId = Number(tenantResult[0].insertId);

  // Create admin membership
  await db.insert(tenantMemberships).values({
    userId,
    tenantId,
    role: "admin",
    status: "active",
  });

  const token = await createSessionToken({ userId, tenantId, role: "admin" });
  return { userId, tenantId, token };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ userId: number; tenantId: number; role: string; token: string }> {
  const db = getDb();
  if (!db) throw new Error("Base de données indisponible.");

  const email = input.email.trim().toLowerCase();

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = userRows[0];
  if (!user || !user.passwordHash) throw new Error("E-mail ou mot de passe incorrect.");

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new Error("E-mail ou mot de passe incorrect.");

  const membershipRows = await db
    .select({
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
    })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, user.id))
    .limit(1);
  const membership = membershipRows[0];
  if (!membership) throw new Error("Aucun espace de travail associé à ce compte.");

  const token = await createSessionToken({
    userId: user.id,
    tenantId: membership.tenantId,
    role: membership.role,
  });
  return { userId: user.id, tenantId: membership.tenantId, role: membership.role, token };
}

// ── Invitations ─────────────────────────────────────────────────────────────

export async function createInvitation(input: {
  tenantId: number;
  email: string;
  role: "admin" | "member" | "viewer";
  invitedById: number;
}): Promise<{ token: string }> {
  const db = getDb();
  if (!db) throw new Error("Base de données indisponible.");

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(invitations).values({
    tenantId: input.tenantId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    token,
    expiresAt,
    status: "pending",
    invitedById: input.invitedById,
  });

  return { token };
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
  name: string;
}): Promise<{ userId: number; tenantId: number; role: string; token: string }> {
  const db = getDb();
  if (!db) throw new Error("Base de données indisponible.");

  const invRows = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, input.token))
    .limit(1);
  const invitation = invRows[0];
  if (!invitation) throw new Error("Invitation invalide ou expirée.");
  if (invitation.status !== "pending") throw new Error("Cette invitation a déjà été utilisée.");
  if (invitation.expiresAt <= new Date()) throw new Error("Cette invitation a expiré.");

  if (input.password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");

  const passwordHash = await hashPassword(input.password);
  const openId = `local_${nanoid(24)}`;

  const userResult = await db.insert(users).values({
    openId,
    name: input.name.trim(),
    email: invitation.email,
    passwordHash,
    loginMethod: "email",
    role: invitation.role,
    lastSignedIn: new Date(),
  });
  const userId = Number(userResult[0].insertId);

  await db.insert(tenantMemberships).values({
    userId,
    tenantId: invitation.tenantId,
    role: invitation.role,
    status: "active",
  });

  await db
    .update(invitations)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  const sessionToken = await createSessionToken({
    userId,
    tenantId: invitation.tenantId,
    role: invitation.role,
  });
  return { userId, tenantId: invitation.tenantId, role: invitation.role, token: sessionToken };
}

// ── Subscription gate ────────────────────────────────────────────────────────

export function isTenantActive(tenant: {
  status: string;
  trialEndsAt: Date | null;
}): boolean {
  if (tenant.status === "active" || tenant.status === "pro" || tenant.status === "enterprise") return true;
  if (tenant.status === "trial" && tenant.trialEndsAt) {
    return new Date(tenant.trialEndsAt) > new Date();
  }
  return false;
}
