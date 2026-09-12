import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { registerClientAttachmentRoutes } from "../clientAttachments";
import { registerProjectCostAttachmentRoutes } from "../projectCostAttachments";
import { registerIntegrationExternalRoutes } from "../integrations/externalRoutes";
import { registerAgentCampaignScheduleRoutes } from "../agentCampaignScheduleRoutes";
import { serveStatic } from "./serveStatic";
import { createContext } from "./context";
import { pingDatabase, getLastDbError } from "../db";
import { buildHealthPayload } from "./health";

export { serveStatic } from "./serveStatic";

export async function createApp() {
  const app = express();
  const server = createServer(app);
  const helmet = (await import("helmet")).default;
  const cors = (await import("cors")).default;
  const rateLimit = (await import("express-rate-limit")).default;
  const trustProxyRaw = (process.env.TRUST_PROXY ?? "").trim();
  if (trustProxyRaw && trustProxyRaw !== "0" && trustProxyRaw.toLowerCase() !== "false") {
    const hops = Number.parseInt(trustProxyRaw, 10);
    app.set("trust proxy", Number.isFinite(hops) && hops > 0 ? hops : 1);
  }
  // Body parser en TOUT PREMIER — avant rate-limit
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? true, credentials: true }));
  const apiRateMax = Number.parseInt(process.env.API_RATE_LIMIT_MAX ?? "2000", 10);
  if (Number.isFinite(apiRateMax) && apiRateMax > 0) {
    app.use("/api/", rateLimit({
      windowMs: 60_000,
      max: apiRateMax,
      standardHeaders: true,
      legacyHeaders: false,
      validate: false,
      skip: req => req.path === "/health" || req.originalUrl?.startsWith("/api/health"),
    }));
  }

  registerStorageProxy(app);
  registerClientAttachmentRoutes(app);
  registerProjectCostAttachmentRoutes(app);
  registerIntegrationExternalRoutes(app);
  registerAgentCampaignScheduleRoutes(app);

  app.get("/api/health", async (_req, res) => {
    const dbOk = await pingDatabase();
    res.status(200).json({ ...buildHealthPayload({ dbOk }), dbError: dbOk ? null : getLastDbError() });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return { app, server };
}


