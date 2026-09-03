import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";
import { runWithTenant } from "./tenantContext";

// NOTE: superjson retiré car incompatible avec body parser global
// Les dates doivent être sérialisées manuellement si nécessaire
const t = initTRPC.context<TrpcContext>().create({});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  const user = ctx.user;
  const tenantId = ctx.tenantId;
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Aucun tenant associé." });
  }

  return runWithTenant(tenantId, () =>
    next({
      ctx: {
        ...ctx,
        user,
        tenantId,
      },
    }),
  );
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const user = ctx.user;
    const tenantId = ctx.tenantId;
    if (!user || user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    if (!tenantId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Aucun tenant associé." });
    }

    return runWithTenant(tenantId, () =>
      next({
        ctx: {
          ...ctx,
          user,
          tenantId,
        },
      }),
    );
  }),
);

/**
 * Procédure pour les administrateurs ET directeurs.
 * Accès étendu sauf gestion des utilisateurs (réservée aux admins).
 */
export const directionProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const user = ctx.user;
    const tenantId = ctx.tenantId;
    if (!user || (user.role !== "admin" && user.role !== "directeur")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé à la direction." });
    }

    if (!tenantId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Aucun tenant associé." });
    }

    return runWithTenant(tenantId, () =>
      next({
        ctx: {
          ...ctx,
          user,
          tenantId,
        },
      }),
    );
  }),
);
