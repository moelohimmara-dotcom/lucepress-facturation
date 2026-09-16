import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifyLocalSession } from "./localAuth";
import * as db from "../db";
import { readSessionState, touchSessionSeen } from "../sessionRegistry";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  tenantId: number | null;
};

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) map.set(key, decodeURIComponent(value));
  }
  return map;
}

/**
 * Jeton de session présenté par la requête, ou `null`.
 *
 * Exporté : le garde-fou de révocation de la console (`system.sessions.revoke`)
 * a besoin de désigner LA session qui fait la demande, donc de lire le même
 * cookie que ce contexte. Une seconde implémentation finirait par diverger.
 * À ne pas confondre avec `readSessionToken(cookieHeader)` de `server/routers.ts`,
 * qui prend l’en-tête brut et renvoie `""` par défaut.
 */
export function readRequestSessionToken(req: { headers?: { cookie?: string } }): string | null {
  return parseCookies(req.headers?.cookie)?.get(COOKIE_NAME) ?? null;
}

/**
 * Construit le contexte de chaque requête tRPC.
 *
 * RÈGLE DE SÉCURITÉ NON NÉGOCIABLE : `user` vaut `null` tant qu'une session JWT
 * valide n'a pas été présentée et retrouvée en base.
 *
 * HISTORIQUE — NE PAS RÉINTRODUIRE
 * --------------------------------
 * Une version déployée de ce fichier contenait un repli « contrôle local » qui,
 * en l'absence de session, fabriquait un utilisateur `local-admin` avec
 * `role: "admin"`. Conséquence : TOUT visiteur non authentifié d'Internet était
 * traité comme administrateur — `adminProcedure` laissait donc passer la lecture
 * et l'écriture de toutes les données (clients, devis, factures).
 *
 * Ce repli avait été ajouté comme béquille au retrait de l'OAuth Manus. Il est
 * devenu inutile dès que l'authentification locale (e-mail + mot de passe) a été
 * mise en place : c'est désormais `auth.login` qui délivre la session.
 *
 * Si plus aucun compte n'existe en base, la bonne procédure est d'amorcer le
 * premier administrateur via `auth.register` (garde-fou d'amorçage), PAS de
 * rouvrir un accès anonyme privilégié.
 *
 * OÙ VIT LE CONTRÔLE DE RÉVOCATION DE SESSION (Phase 3, étape B1)
 * ---------------------------------------------------------------
 * Ici, et nulle part ailleurs. Ce contexte est le point de passage OBLIGÉ de
 * toute requête tRPC : les procédures (`protectedProcedure`, `adminProcedure`,
 * `systemProcedure`…) ne voient l’utilisateur que s’il a été résolu ici. Poser le
 * contrôle ailleurs (dans un middleware, dans une procédure, dans l’interface)
 * laisserait des chemins non couverts ; le poser ici le rend impossible à
 * contourner, y compris par une procédure ajoutée plus tard.
 *
 * COÛT
 * ----
 * Deux lectures concurrentes au lieu d’une (`Promise.all`) :
 *   - `db.getUserByOpenId` — déjà présent avant cette étape ;
 *   - `readSessionState` — une ligne cherchée par l’index UNIQUE
 *     `sessions_tokenHash_unique`.
 * Aucune latence ajoutée en pratique : les deux requêtes partent ensemble sur le
 * pool et la seconde est une recherche d’index sur une seule ligne. Le calcul de
 * l’empreinte (SHA-256 sur ~300 octets) est négligeable devant un aller-retour
 * réseau.
 *
 * Un cache en mémoire a été écarté, pour deux raisons : il repousserait la
 * révocation au-delà de « la requête suivante » (exigence de sécurité), et il
 * serait inopérant en déploiement multi-instances, où l’instance qui révoque
 * n’est pas celle qui sert la requête suivante.
 *
 * En cas d’échec de lecture, la session est laissée ouverte et l’échec est
 * journalisé (voir l’en-tête de `server/sessionRegistry.ts`) : une panne de base
 * ne doit pas se transformer en panne d’authentification générale.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const cookies = parseCookies(opts.req.headers.cookie);
  const token = cookies.get(COOKIE_NAME) ?? null;

  const session = await verifyLocalSession(token);
  if (session && token) {
    const [resolved, state] = await Promise.all([
      db.getUserByOpenId(session.openId),
      readSessionState(token),
    ]);
    // Révocation : la session existait et a été fermée depuis la console. Le
    // compte reste introuvable pour la suite du cycle → 401 sur toute procédure
    // protégée. On n’en dérive non plus aucun tenant : rien ne doit provenir
    // d’une session révoquée. Le cookie n’est pas effacé ici (le contexte n’a pas
    // à écrire de réponse) : il est remplacé à la prochaine connexion.
    if (state.revoked) return { req: opts.req, res: opts.res, user: null, tenantId: null };
    user = resolved ?? null;
    if (user) touchSessionSeen(token);
  }

  const tenantId = session?.tenantId ?? user?.tenantId ?? null;

  return { req: opts.req, res: opts.res, user, tenantId };
}
