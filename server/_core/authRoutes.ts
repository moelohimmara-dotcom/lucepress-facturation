import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import {
  acceptInvitation,
  authenticateRequest,
  createInvitation,
  loginUser,
  registerTenant,
  TRIAL_DURATION_HOURS,
} from "./auth";

export function registerAuthRoutes(app: Express) {
  // ── Register ────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const body = req.body as { email?: string; password?: string; companyName?: string };
      if (!body.email || !body.password || !body.companyName) {
        res.status(400).json({ error: "email, password et companyName sont requis." });
        return;
      }
      const result = await registerTenant({
        email: body.email,
        password: body.password,
        companyName: body.companyName,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.status(201).json({
        userId: result.userId,
        tenantId: result.tenantId,
        trialHours: TRIAL_DURATION_HOURS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inscription impossible.";
      res.status(400).json({ error: message });
    }
  });

  // ── Login ────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const body = req.body as { email?: string; password?: string };
      if (!body.email || !body.password) {
        res.status(400).json({ error: "email et password sont requis." });
        return;
      }
      const result = await loginUser({ email: body.email, password: body.password });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.status(200).json({ userId: result.userId, tenantId: result.tenantId, role: result.role });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connexion impossible.";
      res.status(401).json({ error: message });
    }
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(200).json({ success: true });
  });

  // ── Me ───────────────────────────────────────────────────────────────────
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Non authentifié." });
        return;
      }
      res.status(200).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.tenantRole,
        tenantId: user.tenantId,
        tenantStatus: user.tenantStatus,
        trialEndsAt: user.trialEndsAt,
      });
    } catch {
      res.status(401).json({ error: "Non authentifié." });
    }
  });

  // ── Invite ───────────────────────────────────────────────────────────────
  app.post("/api/auth/invite", async (req: Request, res: Response) => {
    try {
      const inviter = await authenticateRequest(req);
      if (!inviter || inviter.tenantRole !== "admin") {
        res.status(403).json({ error: "Seul un administrateur peut inviter." });
        return;
      }
      const body = req.body as { email?: string; role?: string };
      if (!body.email) {
        res.status(400).json({ error: "email est requis." });
        return;
      }
      const role = body.role === "admin" || body.role === "viewer" ? body.role : "member";
      const result = await createInvitation({
        tenantId: inviter.tenantId,
        email: body.email,
        role: role as "admin" | "member" | "viewer",
        invitedById: inviter.id,
      });
      res.status(201).json({ token: result.token });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invitation impossible.";
      res.status(400).json({ error: message });
    }
  });

  // ── Accept invite ────────────────────────────────────────────────────────
  app.post("/api/auth/accept-invite", async (req: Request, res: Response) => {
    try {
      const body = req.body as { token?: string; password?: string; name?: string };
      if (!body.token || !body.password || !body.name) {
        res.status(400).json({ error: "token, password et name sont requis." });
        return;
      }
      const result = await acceptInvitation({ token: body.token, password: body.password, name: body.name });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, result.token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.status(200).json({ userId: result.userId, tenantId: result.tenantId, role: result.role });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Acceptation impossible.";
      res.status(400).json({ error: message });
    }
  });
}
