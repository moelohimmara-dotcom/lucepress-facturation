import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import type { AppRole } from "@shared/roles";
import { logConsoleAttempt } from "../systemAccessLog";
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

/**
 * Refus d’entrée dans un espace réservé — VOCABULAIRE NEUTRE, DÉLIBÉRÉMENT.
 *
 * `CONSOLE_REFUSED_ERR_MSG` ne dit NI « console », NI « exploitation », NI
 * « administration système ». Un appelant non habilité qui frappe une procédure
 * de la console n’apprend rien de plus que « c’est refusé » : la page, côté
 * interface, répond de la même façon par la 404 neutre de l’application
 * (`client/src/components/SystemGate.tsx`).
 *
 * CE QUE CE SILENCE NE COUVRE PAS — pour ne pas se raconter d’histoires :
 * tRPC répond `NOT_FOUND` (« No procedure found on path ») pour un chemin
 * INCONNU, et `FORBIDDEN` ici. Un appelant qui sonde l’API distingue donc
 * « procédure inexistante » de « procédure existante mais refusée ». Ce
 * différentiel est celui de tRPC lui-même, il s’applique aussi bien à
 * `adminProcedure`, et le corriger supposerait de répondre 404 à la place de
 * 403 — un changement de convention hors de portée ici. Ce qui est garanti,
 * c’est que le message ne NOMME rien.
 *
 * Ce silence est asymétrique, et c’est voulu : l’intéressé n’apprend rien, mais
 * l’administrateur système, lui, voit la tentative dans le journal du serveur
 * (voir `server/systemAccessLog.ts`).
 */
export const CONSOLE_REFUSED_ERR_MSG = "Accès refusé.";

/** Ce qu’un refus de rôle transmet au journal. Aucun contenu de requête. */
type RefusalInfo = {
  /** Procédure visée, telle que tRPC la nomme (`system.overview`). */
  path: string;
  /** Rôle porté par le compte, `null` si anonyme. */
  role: string | null;
  actor: string | null;
  actorId: number | null;
  tenantId: number | null;
  authenticated: boolean;
};

/** Chemin de la procédure en cours, sans dépendre de la forme exacte du type tRPC. */
function procedurePath(options: { path?: unknown }): string {
  return typeof options.path === "string" && options.path.length > 0 ? options.path : "procédure inconnue";
}

/** Journalise un refus de rôle ou une tentative anonyme. Ne lève jamais. */
function onConsoleAccessRefused(info: RefusalInfo): void {
  logConsoleAttempt({
    outcome: info.authenticated ? "role_refuse" : "anonyme",
    target: info.path,
    role: info.role,
    actor: info.actor,
    actorId: info.actorId,
    tenantId: info.tenantId,
  });
}

function requireRoles(
  allowed: readonly AppRole[],
  forbiddenMessage: string,
  /**
   * Appelé AVANT de lever, uniquement pour journaliser. La console s’en sert
   * pour tracer une tentative sans rien révéler à celui qui la fait.
   */
  onRefused?: (info: RefusalInfo) => void,
) {
  return t.middleware(async opts => {
    const { ctx, next } = opts;
    const user = ctx.user;
    const tenantId = ctx.tenantId;
    if (!user || !allowed.includes(user.role as AppRole)) {
      onRefused?.({
        path: procedurePath(opts as { path?: unknown }),
        role: user?.role ?? null,
        actor: user?.email ?? user?.openId ?? null,
        actorId: user?.id ?? null,
        // Le tenant aide à situer une tentative dans une instance : il vient du
        // contexte, jamais de la requête.
        tenantId: tenantId ?? null,
        authenticated: Boolean(user),
      });
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

/**
 * Administration métier — utilisateurs, paramètres société, intégrations.
 *
 * LE RÔLE SYSTÈME EST UN SUPER-ADMINISTRATEUR : il ouvre l’application entière,
 * donc cette porte aussi. Ce qui ne change pas, c’est le DOMAINE de chacun dans
 * les mutations de comptes (`assertAccountHabilitation`, `server/routers.ts`) :
 * un `admin` ne peut pas créer ni promouvoir un compte `systeme`, un compte
 * `systeme` ne distribue pas les rôles du commerce. L’escalade reste fermée —
 * elle n’a jamais reposé sur ce garde.
 */
export const adminProcedure = t.procedure.use(
  requireRoles(["admin", "systeme"], NOT_ADMIN_ERR_MSG),
);

/**
 * Direction : admin + directeur + administrateur système.
 * Accès étendu (clients, pilotage) sans gestion des utilisateurs.
 */
export const directionProcedure = t.procedure.use(
  requireRoles(["admin", "directeur", "systeme"], "Accès réservé à la direction."),
);

/**
 * Équipe commerciale : admin + directeur + cadre + administrateur système.
 * Documents, paiements, créances, relances, catalogue, dashboard.
 */
export const staffProcedure = t.procedure.use(
  requireRoles(
    ["admin", "directeur", "cadre", "systeme"],
    "Accès réservé à l’équipe commerciale Lucepres.",
  ),
);

/**
 * Gestion des comptes (comptes collaborateurs et comptes système).
 *
 * Le garde ouvre la porte à DEUX rôles, mais chacun sur son DOMAINE : les
 * mutations arbitrent ensuite (`assertAccountHabilitation`, `server/routers.ts`).
 * Un `admin` ne peut pas créer, promouvoir, modifier ni supprimer un compte
 * `systeme` — sinon il pourrait s’octroyer la console d’exploitation. Un compte
 * `systeme` ne distribue pas les rôles du commerce.
 *
 * Le rôle reste appliqué côté serveur : l’interface ne fait que refléter.
 */
export const usersProcedure = t.procedure.use(
  requireRoles(
    ["admin", "systeme"],
    "Accès réservé à l’administration des comptes.",
  ),
);

/**
 * Console d’exploitation : rôle `systeme` UNIQUEMENT.
 *
 * L’accès partagé avec `admin` (Phases 1 → 3B1) était un compromis d’essai, il
 * est retiré. Le contrôle ne repose jamais sur l’interface — chaque procédure de
 * la console repasse par ce middleware, et l’admin reçoit un 403 comme tout
 * autre rôle.
 *
 * UN SEUL VERROU : LE RÔLE, ET C’EST UNE DÉCISION DU PROPRIÉTAIRE.
 * Le cahier des charges § 6 prévoyait une MFA OBLIGATOIRE pour ouvrir la
 * console ; le propriétaire de l’instance a demandé l’inverse — « je dois
 * toujours avoir le choix de décider ». La MFA reste donc ENTIÈREMENT
 * DISPONIBLE (`mfa.*`, `server/routers.ts`) et RECOMMANDÉE pour un compte
 * d’administration, mais elle n’est plus EXIGÉE pour entrer : un compte
 * `systeme` sans second facteur ouvre la console comme les autres, et l’active
 * — ou non — depuis la console elle-même.
 *
 * Ce qui n’a pas changé : le refus de rôle reste muet et journalisé (voir
 * `CONSOLE_REFUSED_ERR_MSG`), et aucun autre rôle n’obtient la moindre
 * procédure de console.
 *
 * L’administrateur système, lui, est devenu un SUPER-ADMINISTRATEUR : il ouvre
 * aussi `adminProcedure`, `directionProcedure` et `staffProcedure`. La console
 * n’en devient pas pour autant publique — c’est ici, et nulle part ailleurs,
 * que se joue le fait qu’elle reste SON espace : `systeme`, et lui seul.
 */
export const systemProcedure = t.procedure.use(
  requireRoles(["systeme"], CONSOLE_REFUSED_ERR_MSG, onConsoleAccessRefused),
);
