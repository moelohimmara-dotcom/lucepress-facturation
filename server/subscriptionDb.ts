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

export async function checkTenantAccess(tenantId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ plan: tenants.plan, status: tenants.status, trialEndsAt: tenants.trialEndsAt, currentPeriodEnd: tenants.currentPeriodEnd })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const tenant = rows[0];
  if (!tenant) throw new Error("Espace de travail introuvable.");

  const now = new Date();
  const trialEndsAt = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  const isActive = tenant.status === "active";
  const isTrial = tenant.status === "trial";

  // Check if active subscription has expired
  let subscriptionExpired = false;
  if (isActive && tenant.currentPeriodEnd) {
    const periodEnd = new Date(tenant.currentPeriodEnd);
    if (periodEnd < now) {
      subscriptionExpired = true;
      // Auto-suspend the tenant
      await db
        .update(tenants)
        .set({ status: "suspended" })
        .where(eq(tenants.id, tenantId));
    }
  }

  const trialExpired = isTrial && (!trialEndsAt || trialEndsAt < now);
  const daysRemaining = isTrial && trialEndsAt && trialEndsAt > now
    ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const hasAccess = (isActive && !subscriptionExpired) || (isTrial && !trialExpired);

  return {
    hasAccess,
    plan: tenant.plan,
    status: subscriptionExpired ? "suspended" : tenant.status,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: tenant.currentPeriodEnd?.toISOString() ?? null,
    daysRemaining,
  };
}

export async function getTenantSubscriptionStatus(tenantId: number) {
  const db = await requireDb();
  const tenantRows = await db
    .select({ id: tenants.id, name: tenants.name, plan: tenants.plan, status: tenants.status, trialEndsAt: tenants.trialEndsAt, currentPeriodEnd: tenants.currentPeriodEnd, currency: tenants.currency })
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

    // Activate tenant and set the subscription period end (30 days from now, or extend from current period if still active)
    const now = new Date();
    const existingTenant = await tx
      .select({ currentPeriodEnd: tenants.currentPeriodEnd, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, input.tenantId))
      .limit(1);
    const current = existingTenant[0];
    // If the current period hasn't ended yet, extend from its end date; otherwise start from now
    const baseDate = current?.currentPeriodEnd && current.currentPeriodEnd > now && current.status === "active"
      ? new Date(current.currentPeriodEnd)
      : now;
    const periodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await tx
      .update(tenants)
      .set({
        plan: input.plan,
        status: "active",
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      })
      .where(eq(tenants.id, input.tenantId));
  });
}
