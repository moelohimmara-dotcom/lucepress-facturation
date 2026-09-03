CREATE TABLE `document_share_links` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tenantId` int NOT NULL,
  `documentId` int NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `recipientEmail` varchar(320),
  `createdById` int,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp,
  `lastAccessAt` timestamp,
  `accessCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `document_share_links_id` PRIMARY KEY(`id`),
  CONSTRAINT `document_share_links_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `document_share_links` ADD CONSTRAINT `document_share_links_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `document_share_links` ADD CONSTRAINT `document_share_links_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `document_share_links` ADD CONSTRAINT `document_share_links_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `document_share_links_document_idx` ON `document_share_links` (`documentId`,`revokedAt`);
--> statement-breakpoint
CREATE INDEX `document_share_links_tenant_expires_idx` ON `document_share_links` (`tenantId`,`expiresAt`);
