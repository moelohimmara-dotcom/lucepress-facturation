import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import type { AppRole } from "@shared/roles";
import { isMfaActiveForUser } from "../mfa";
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

/**
 * Refus pour MFA absente : neutre lui aussi. Le compte système qui n’a pas
 * encore activé sa MFA n’a pas besoin de ce message pour s’orienter — son
 * interface interroge `mfa.status` et affiche l’écran d’enrôlement.
 */
export const CONSOLE_MFA_REQUIRED_ERR_MSG = "Authentification à deux facteurs requise pour cette opération.";

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
 * Second verrou de la console : la MFA doit être ACTIVE sur le compte.
 *
 * PLACÉ APRÈS `requireRoles` : la question « qui es-tu ? » se tranche avant
 * « as-tu ton second facteur ? », et un compte non habilité n’a pas à faire
 * interroger la base sur son état MFA.
 *
 * ÉCHOUE FERMÉ : `isMfaActiveForUser` rend `false` quand la lecture est
 * impossible (base injoignable, colonne absente). Une panne ne peut donc pas
 * ouvrir la console — au pire elle la ferme, ce qui est le bon côté de l’erreur
 * pour un espace d’administration système.
 *
 * Le refus est journalisé, et le message ne nomme rien : voir
 * `CONSOLE_MFA_REQUIRED_ERR_MSG`.
 */
const requireConsoleMfa = t.middleware(async opts => {
  const { ctx, next } = opts;
  const user = ctx.user;
  const active = user ? await isMfaActiveForUser(user.id) : false;
  if (!active) {
    logConsoleAttempt({
      outcome: "mfa_absente",
      target: procedurePath(opts as { path?: unknown }),
      role: user?.role ?? null,
      actor: user?.email ?? user?.openId ?? null,
      actorId: user?.id ?? null,
      tenantId: ctx.tenantId,
    });
    throw new TRPCError({ code: "FORBIDDEN", message: CONSOLE_MFA_REQUIRED_ERR_MSG });
  }
  return next();
});

/**
 * Console d’exploitation : rôle `systeme` UNIQUEMENT, **et** MFA active.
 *
 * L’accès partagé avec `admin` (Phases 1 → 3B1) était un compromis d’essai, il
 * est retiré. Le contrôle ne repose jamais sur l’interface — chaque procédure de
 * la console repasse par ce middleware, et l’admin reçoit un 403 comme tout
 * autre rôle.
 *
 * DEUX VERROUS, DANS CET ORDRE :
 *   1. le RÔLE (`requireRoles`) — un compte non habilité est refusé ici, et la
 *      tentative est journalisée sans que l’intéressé en sache rien ;
 *   2. la MFA ACTIVE (`requireConsoleMfa`) — le cahier des charges § 6 exige
 *      l’authentification à deux facteurs pour ouvrir la console. Un compte
 *      `systeme` sans MFA n’obtient donc AUCUNE procédure de console (403),
 *      mais conserve l’accès aux procédures d’enrôlement (`mfa.*`), qui sont
 *      sous `protectedProcedure` : c’est ainsi qu’il se met en règle.
 */
export const systemProcedure = t.procedure.use(
  requireRoles(["systeme"], CONSOLE_REFUSED_ERR_MSG, onConsoleAccessRefused),
).use(requireConsoleMfa);
