-- Multi-tenant foundation: tenants, memberships, invitations, subscriptions
-- Password auth on users, tenantId on all business tables

CREATE TABLE `tenants` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(180) NOT NULL,
  `plan` enum('trial','pro','enterprise','suspended') DEFAULT 'trial' NOT NULL,
  `status` enum('trial','active','suspended','cancelled') DEFAULT 'trial' NOT NULL,
  `currency` varchar(3) DEFAULT 'GNF' NOT NULL,
  `trialEndsAt` timestamp NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint

CREATE TABLE `tenant_memberships` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `tenantId` int NOT NULL,
  `role` enum('admin','member','viewer') DEFAULT 'member' NOT NULL,
  `status` enum('active','suspended','revoked') DEFAULT 'active' NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY `tenant_memberships_user_tenant_unique` (`userId`,`tenantId`),
  CONSTRAINT `tm_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `tm_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
);--> statement-breakpoint

CREATE TABLE `invitations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `role` enum('admin','member','viewer') DEFAULT 'member' NOT NULL,
  `token` varchar(64) NOT NULL,
  `status` enum('pending','accepted','expired','revoked') DEFAULT 'pending' NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `invitedById` int,
  `acceptedAt` timestamp NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY `invitations_token_unique` (`token`),
  INDEX `invitations_tenant_status_idx` (`tenantId`,`status`),
  CONSTRAINT `inv_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `inv_user_fk` FOREIGN KEY (`invitedById`) REFERENCES `users`(`id`) ON DELETE SET NULL
);--> statement-breakpoint

CREATE TABLE `subscriptions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenantId` int NOT NULL,
  `monerooPaymentId` varchar(255),
  `plan` enum('trial','pro','enterprise') DEFAULT 'trial' NOT NULL,
  `status` enum('pending','success','failed','expired') DEFAULT 'pending' NOT NULL,
  `amount` bigint DEFAULT 0 NOT NULL,
  `currency` varchar(3) DEFAULT 'GNF' NOT NULL,
  `paidAt` timestamp NULL,
  `expiresAt` timestamp NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX `subscriptions_tenant_status_idx` (`tenantId`,`status`),
  CONSTRAINT `sub_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
);--> statement-breakpoint

-- Add passwordHash to users
ALTER TABLE `users` ADD COLUMN `passwordHash` text;--> statement-breakpoint

-- Add tenantId to all business tables (nullable for backward compat)
ALTER TABLE `clients` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `project_costs` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `services` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `documents` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `company_settings` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `client_attachments` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `client_activities` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `agent_operator_grants` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `agent_message_jobs` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `agent_test_email_deliveries` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `agent_audit_logs` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `integration_connections` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `integration_jobs` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `integration_audit_logs` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `integration_oauth_sessions` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `integration_webhook_events` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `document_sequences` ADD COLUMN `tenantId` int;--> statement-breakpoint
ALTER TABLE `service_price_revisions` ADD COLUMN `tenantId` int;--> statement-breakpoint

-- Add tenant indexes
CREATE INDEX `clients_tenantId_idx` ON `clients` (`tenantId`);--> statement-breakpoint
CREATE INDEX `documents_tenantId_idx` ON `documents` (`tenantId`);--> statement-breakpoint
CREATE INDEX `projects_tenantId_idx` ON `projects` (`tenantId`);--> statement-breakpoint
CREATE INDEX `services_tenantId_idx` ON `services` (`tenantId`);--> statement-breakpoint
CREATE INDEX `payments_tenantId_idx` ON `payments` (`tenantId`);--> statement-breakpoint
CREATE INDEX `company_settings_tenantId_idx` ON `company_settings` (`tenantId`);--> statement-breakpoint

-- Backfill: create a default tenant and assign all existing data to it
INSERT INTO `tenants` (`name`, `plan`, `status`, `currency`, `trialEndsAt`)
VALUES ('Entreprise par défaut', 'pro', 'active', 'GNF', NULL);--> statement-breakpoint

SET @defaultTenantId = LAST_INSERT_ID();--> statement-breakpoint

-- Assign existing users as members of the default tenant
INSERT INTO `tenant_memberships` (`userId`, `tenantId`, `role`, `status`)
SELECT `id`, @defaultTenantId,
  CASE WHEN `role` = 'admin' THEN 'admin' ELSE 'member' END,
  'active'
FROM `users`;--> statement-breakpoint

-- Backfill tenantId on all business tables
UPDATE `clients` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `projects` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `project_costs` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `services` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `documents` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `payments` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `company_settings` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `client_attachments` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `client_activities` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `agent_operator_grants` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `agent_delegations` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `agent_campaigns` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `agent_message_jobs` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `agent_test_email_deliveries` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `agent_audit_logs` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `integration_connections` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `integration_jobs` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `integration_audit_logs` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `integration_oauth_sessions` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `integration_webhook_events` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `document_sequences` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;--> statement-breakpoint
UPDATE `service_price_revisions` SET `tenantId` = @defaultTenantId WHERE `tenantId` IS NULL;
