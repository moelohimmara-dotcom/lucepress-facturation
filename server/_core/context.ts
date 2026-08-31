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

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const cookies = parseCookies(opts.req.headers.cookie);
  const token = cookies.get(COOKIE_NAME) ?? null;

  const session = await verifyLocalSession(token);
  if (session) {
    user = await db.getUserByOpenId(session.openId);
  }

  // Aucune dépendance à Manus n'est active : anciens cookies OAuth ignorés.

  if (!user) {
    return { req: opts.req, res: opts.res, user: null };
  }

  return { req: opts.req, res: opts.res, user };
}
