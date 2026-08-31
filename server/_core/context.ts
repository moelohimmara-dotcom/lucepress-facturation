import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifyLocalSession } from "./localAuth";
import * as db from "../db";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
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
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const cookies = parseCookies(opts.req.headers.cookie);
  const token = cookies.get(COOKIE_NAME) ?? null;

  const session = await verifyLocalSession(token);
  if (session) {
    // `?? null` : `getUserByEmail`/`getUserByOpenId` renvoient `undefined` quand
    // le compte a été supprimé alors qu'un cookie valide circulait encore. Sans
    // cette normalisation, `user` valait `undefined` et le typage `User | null`
    // était trahi (erreur TS2322 préexistante, corrigée ici).
    user = (await db.getUserByOpenId(session.openId)) ?? null;
  }

  // Aucune dépendance à Manus n'est active : anciens cookies OAuth ignorés.
  // Aucun repli administrateur : pas de session valide => pas d'utilisateur.

  return { req: opts.req, res: opts.res, user };
}
