import net from "net";
import { fileURLToPath } from "node:url";
import { createApp } from "./index";
import { serveStatic } from "./serveStatic";
import { seedDefaultEmailTemplates } from "../db";
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

export async function startServer() {
  const { app, server } = await createApp();
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
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

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], import.meta.url));
if (isMain) {
  startServer().catch(err => {
    console.error("[serve] Erreur au demarrage:", err);
    process.exit(1);
  });
}
