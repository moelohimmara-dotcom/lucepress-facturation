import express, { type Express } from "express";
import { storagePut } from "./storage";
import { createClientAttachment, getClientById } from "./db";
import { sdk } from "./_core/sdk";
import { runWithTenant } from "./_core/tenantContext";
import { sanitizeClientAttachmentName, validateClientAttachmentMetadata } from "../shared/clientAttachments";

export function registerClientAttachmentRoutes(app: Express) {
  app.post("/api/client-attachments", express.raw({ type: "*/*", limit: "20mb" }), async (req, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Session expirée ou invalide." });
      }
      if (!user || user.role !== "admin") return res.status(401).json({ error: "Accès non autorisé." });
      if (user.tenantId == null) return res.status(401).json({ error: "Aucun tenant associé." });
      // Porte le tenant courant dans le contexte async pour filtrer les tables métier.
      return await runWithTenant(user.tenantId, async () => {
        const clientId = Number(req.header("x-client-id"));
        const fileName = sanitizeClientAttachmentName(req.header("x-file-name") || "");
        const contentType = (req.header("content-type") || "application/octet-stream").split(";")[0];
        const data = req.body as Buffer;
        if (!Number.isInteger(clientId) || clientId <= 0) return res.status(400).json({ error: "Client invalide." });
        if (!(await getClientById(clientId))) return res.status(400).json({ error: "Le client sélectionné est introuvable." });
        const metadataError = validateClientAttachmentMetadata(contentType, Buffer.isBuffer(data) ? data.length : 0);
        if (metadataError) return res.status(400).json({ error: metadataError });
        const stored = await storagePut(`client-attachments/${clientId}/${fileName}`, data, contentType);
        const attachment = await createClientAttachment({ clientId, fileName, contentType, size: data.length, storageKey: stored.key, storageUrl: stored.url, createdById: user.id });
        return res.status(201).json({ ...attachment, fileName, contentType, size: data.length, storageUrl: stored.url });
      });
    } catch (error) {
      console.error("[Client attachments] Upload failed:", error);
      return res.status(500).json({ error: "La pièce jointe n’a pas pu être enregistrée." });
    }
  });
}
