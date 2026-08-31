import { and, desc, eq } from "drizzle-orm";
import { getDb, requireDb } from "./db";
import { subscriptions, tenants, type Subscription } from "../drizzle/schema";

export const PLAN_PRICES_GNF: Record<string, number> = {
  pro: 150_000,
  enterprise: 0, // sur devis
};

export const PLAN_LABELS: Record<string, string> = {
  trial: "Essai gratuit",
  pro: "Pro",
  enterprise: "Entreprise",
};

export async function getTenantSubscriptionStatus(tenantId: number) {
  const db = await requireDb();
  const tenantRows = await db
    .select({ id: tenants.id, name: tenants.name, plan: tenants.plan, status: tenants.status, trialEndsAt: tenants.trialEndsAt, currency: tenants.currency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const tenant = tenantRows[0];
  if (!tenant) throw new Error("Espace de travail introuvable.");

  const subRows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(10);

  return { tenant, subscriptions: subRows };
}

export async function createSubscriptionRecord(input: {
  tenantId: number;
  plan: "pro" | "enterprise";
  amount: number;
  currency: string;
  monerooPaymentId?: string;
}): Promise<{ id: number }> {
  const db = await requireDb();
  const result = await db.insert(subscriptions).values({
    tenantId: input.tenantId,
    plan: input.plan,
    status: "pending",
    amount: input.amount,
    currency: input.currency,
    monerooPaymentId: input.monerooPaymentId ?? null,
  });
  return { id: Number(result[0].insertId) };
}

export async function findSubscriptionByMonerooId(
  monerooPaymentId: string
): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.monerooPaymentId, monerooPaymentId))
    .limit(1);
  return rows[0];
}

export async function findPendingSubscription(
  tenantId: number
): Promise<Subscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, "pending")
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0];
}

export async function activateTenantSubscription(input: {
  tenantId: number;
  plan: "pro" | "enterprise";
  monerooPaymentId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const db = await requireDb();
  await db.transaction(async tx => {
    // Mark subscription as success
    await tx
      .insert(subscriptions)
      .values({
        tenantId: input.tenantId,
        plan: input.plan,
        status: "success",
        amount: input.amount,
        currency: input.currency,
        monerooPaymentId: input.monerooPaymentId,
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

    // Activate tenant
    await tx
      .update(tenants)
      .set({
        plan: input.plan,
        status: "active",
        trialEndsAt: null,
      })
      .where(eq(tenants.id, input.tenantId));
  });
}
