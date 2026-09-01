-- Phase 1.1 — Multi-tenant : colonnes tenantId + tenant par défaut

-- 1) Ajout de tenantId sur users (déjà via schema, mais au cas où)
ALTER TABLE `users` ADD COLUMN `tenantId` int NULL AFTER `id`;

-- 2) Table tenants (si non créée par le schema au démarrage)
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(180) NOT NULL,
  `plan` enum('trial','pro','enterprise') DEFAULT 'trial' NOT NULL,
  `stripeCustomerId` varchar(255) DEFAULT NULL,
  `trialEndsAt` timestamp NULL DEFAULT NULL,
  `status` enum('active','trial','suspended','cancelled') DEFAULT 'trial' NOT NULL,
  `currency` varchar(3) DEFAULT 'GNF' NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Table tenant_memberships
CREATE TABLE IF NOT EXISTS `tenant_memberships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tenantId` int NOT NULL,
  `role` enum('admin','member','viewer') DEFAULT 'member' NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_memberships_user_tenant_unique` (`userId`,`tenantId`),
  KEY `tenant_memberships_tenant_idx` (`tenantId`),
  CONSTRAINT `tenant_memberships_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tenant_memberships_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) Ajout de tenantId sur chaque table métier
ALTER TABLE `clients` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `projects` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `project_costs` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `project_cost_attachments` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `services` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `service_price_revisions` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `documents` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `document_lines` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `payments` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `payment_promises` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `company_settings` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `client_attachments` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `client_activities` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `integration_connections` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `agent_delegations` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `agent_campaigns` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `agent_message_jobs` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `agent_test_email_deliveries` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `agent_audit_logs` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;
ALTER TABLE `document_sequences` ADD COLUMN `tenantId` int NOT NULL AFTER `id`;

-- 5) Création du tenant par défaut (id=1)
INSERT INTO `tenants` (`id`, `name`, `plan`, `status`, `currency`)
VALUES (1, 'Lucepress', 'pro', 'active', 'GNF')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 6) Rattachement des données existantes au tenant 1
UPDATE `users` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `clients` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `projects` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `project_costs` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `project_cost_attachments` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `services` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `service_price_revisions` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `documents` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `document_lines` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `payments` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `payment_promises` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `company_settings` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `client_attachments` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `client_activities` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `integration_connections` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `agent_delegations` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `agent_campaigns` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `agent_message_jobs` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `agent_test_email_deliveries` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `agent_audit_logs` SET `tenantId` = 1 WHERE `tenantId` IS NULL;
UPDATE `document_sequences` SET `tenantId` = 1 WHERE `tenantId` IS NULL;

-- 7) Rattachement de l'utilisateur admin existant (admin@lucepress.local) au tenant 1
INSERT INTO `tenant_memberships` (`userId`, `tenantId`, `role`)
SELECT `id`, 1, 'admin' FROM `users` WHERE `email` = 'admin@lucepress.local'
ON DUPLICATE KEY UPDATE `role` = 'admin';

-- 8) Index sur tenantId pour performance
CREATE INDEX `clients_tenant_idx` ON `clients` (`tenantId`);
CREATE INDEX `projects_tenant_idx` ON `projects` (`tenantId`);
CREATE INDEX `documents_tenant_idx` ON `documents` (`tenantId`);
CREATE INDEX `company_settings_tenant_idx` ON `company_settings` (`tenantId`);
