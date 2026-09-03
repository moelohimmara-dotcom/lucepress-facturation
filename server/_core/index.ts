import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { registerClientAttachmentRoutes } from "../clientAttachments";
import { registerProjectCostAttachmentRoutes } from "../projectCostAttachments";
import { registerIntegrationExternalRoutes } from "../integrations/externalRoutes";
import { registerAgentCampaignScheduleRoutes } from "../agentCampaignScheduleRoutes";
import { setupVite, serveStatic } from "./vite";
import { createContext } from "./context";
import { pingDatabase, seedDefaultEmailTemplates } from "../db";
import { buildHealthPayload } from "./health";
import { isMailConfigured, verifySmtp } from "./mailer";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
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
    res.status(200).json(buildHealthPayload({ dbOk }));
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Seed les templates par défaut (idempotent)
  try {
    await seedDefaultEmailTemplates();
  } catch (err) {
    console.warn("[seed] Erreur lors du seed des templates e-mail:", err);
  }

  if (isMailConfigured()) {
    void verifySmtp();
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
