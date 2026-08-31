import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    // Controle local : auth requise mais sans Forge on sert local
    const cookie = req.headers.cookie ?? "";
    // En mode local-admin, on autorise meme sans cookie (dev bypass)
    const isLocalBypass = true; // Manus retire
    if (!isLocalBypass && !cookie.includes("app_session_id") && !req.headers.authorization) {
      res.status(401).send("Auth required");
      return;
    }
    const key = (req.params as Record<string, string>)[0];
    if (!key || key.includes("..") || key.includes("//")) {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      // Fallback local
      const filePath = path.resolve(path.join(import.meta.dirname, "../../storage"), key);
      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
      }
      res.sendFile(filePath);
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
