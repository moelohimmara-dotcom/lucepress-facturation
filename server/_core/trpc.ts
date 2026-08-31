import { NOT_ADMIN_ERR_MSG, TRIAL_EXPIRED_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { isTenantActive } from "./auth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next, type } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Gatekeeper: block mutations when tenant is not active (trial expired / suspended)
  if (type === "mutation" && !isTenantActive({ status: ctx.user.tenantStatus, trialEndsAt: ctx.user.trialEndsAt })) {
    throw new TRPCError({ code: "FORBIDDEN", message: TRIAL_EXPIRED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireAdmin = t.middleware(async opts => {
  const { ctx, next, type } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Gatekeeper: block mutations when tenant is not active (trial expired / suspended)
  if (type === "mutation" && !isTenantActive({ status: ctx.user.tenantStatus, trialEndsAt: ctx.user.trialEndsAt })) {
    throw new TRPCError({ code: "FORBIDDEN", message: TRIAL_EXPIRED_ERR_MSG });
  }

  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
    },
  });
});

export const adminProcedure = t.procedure.use(requireAdmin);
