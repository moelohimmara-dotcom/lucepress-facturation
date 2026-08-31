import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  // Controle local - Manus retire : utilisateur admin par defaut si pas de session
  if (!user) {
    const now = new Date();
    user = {
      id: 1,
      openId: "local-admin",
      name: "Admin Lucepress",
      email: "admin@lucepress.local",
      loginMethod: "local",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } as User;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
