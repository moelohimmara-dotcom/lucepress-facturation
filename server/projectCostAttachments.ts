import express, { type Express } from "express";
import { createProjectCostAttachment, getProjectCostById } from "./db";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";
import { sanitizeProjectCostAttachmentName, validateProjectCostAttachmentMetadata } from "../shared/projectCostAttachments";

export function registerProjectCostAttachmentRoutes(app: Express) {
  app.post("/api/project-cost-attachments", express.raw({ type: "*/*", limit: "10mb" }), async (req, res) => {
    try {
      let user;
      try { user = await sdk.authenticateRequest(req); } catch { return res.status(401).json({ error: "Session expirée ou invalide." }); }
      if (!user || user.role !== "admin") return res.status(401).json({ error: "Accès non autorisé." });
      const projectCostId = Number(req.header("x-project-cost-id"));
      const fileName = sanitizeProjectCostAttachmentName(decodeURIComponent(req.header("x-file-name") || ""));
      const contentType = (req.header("content-type") || "application/octet-stream").split(";")[0];
      const data = req.body as Buffer;
      if (!Number.isInteger(projectCostId) || projectCostId <= 0) return res.status(400).json({ error: "Coût invalide." });
      const cost = await getProjectCostById(projectCostId);
      if (!cost) return res.status(400).json({ error: "Le coût sélectionné est introuvable." });
      const metadataError = validateProjectCostAttachmentMetadata(contentType, Buffer.isBuffer(data) ? data.length : 0);
      if (metadataError) return res.status(400).json({ error: metadataError });
      const stored = await storagePut(`project-cost-attachments/${cost.projectId}/${projectCostId}/${fileName}`, data, contentType);
      const attachment = await createProjectCostAttachment({ projectCostId, fileName, contentType, size: data.length, storageKey: stored.key, storageUrl: stored.url, createdById: user.id });
      return res.status(201).json({ ...attachment, fileName, contentType, size: data.length, storageUrl: stored.url });
    } catch (error) {
      console.error("[Project cost attachments] Upload failed:", error);
      return res.status(500).json({ error: "Le justificatif n’a pas pu être enregistré." });
    }
  });
}
