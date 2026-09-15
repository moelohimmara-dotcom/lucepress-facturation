import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import type { AppRole } from "@shared/roles";
import type { TrpcContext } from "./context";
import { runWithTenant } from "./tenantContext";

// NOTE: superjson retiré car incompatible avec body parser global
// Les dates doivent être sérialisées manuellement si nécessaire
//
// `isDev` pilote l'exposition de `data.stack` dans les réponses d'erreur.
// Le défaut tRPC (`NODE_ENV !== "production"`) laissait fuiter la stack en
// production : le runtime serverless Netlify ne définit pas forcément
// NODE_ENV=production. On n'active donc le verbeux que sur un dev explicite
// (`NODE_ENV=development`, script `pnpm dev`).
const isDev = process.env.NODE_ENV === "development";
const t = initTRPC.context<TrpcContext>().create({ isDev });

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

function requireRoles(allowed: readonly AppRole[], forbiddenMessage: string) {
  return t.middleware(async opts => {
    const { ctx, next } = opts;
    const user = ctx.user;
    const tenantId = ctx.tenantId;
    if (!user || !allowed.includes(user.role as AppRole)) {
      throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
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
}

export const protectedProcedure = t.procedure.use(requireUser);

/** Admin uniquement — utilisateurs, paramètres société, intégrations. */
export const adminProcedure = t.procedure.use(
  requireRoles(["admin"], NOT_ADMIN_ERR_MSG),
);

/**
 * Direction : admin + directeur.
 * Accès étendu (clients, pilotage) sans gestion des utilisateurs.
 */
export const directionProcedure = t.procedure.use(
  requireRoles(["admin", "directeur"], "Accès réservé à la direction."),
);

/**
 * Équipe commerciale : admin + directeur + cadre.
 * Documents, paiements, créances, relances, catalogue, dashboard.
 */
export const staffProcedure = t.procedure.use(
  requireRoles(
    ["admin", "directeur", "cadre"],
    "Accès réservé à l’équipe commerciale Lucepres.",
  ),
);

/**
 * Console d’exploitation : rôle système + admin (croisement explicite).
 * Le contrôle ne repose jamais sur l’interface — chaque procédure de la console
 * repasse par ce middleware.
 */
export const systemProcedure = t.procedure.use(
  requireRoles(
    ["systeme", "admin"],
    "Accès réservé à la console d’exploitation Lucepres.",
  ),
);
