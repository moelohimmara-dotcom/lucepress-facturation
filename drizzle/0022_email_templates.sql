-- Migration: table email_templates (alignée sur drizzle/schema.ts — camelCase)
-- Date: 2026-09-02

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tenantId` INT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(500) NOT NULL,
  `html` TEXT NOT NULL,
  `text` TEXT NULL,
  `enabled` ENUM('oui', 'non') NOT NULL DEFAULT 'oui',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `email_templates_tenant_slug_unique` (`tenantId`, `slug`),
  INDEX `email_templates_slug_idx` (`slug`),
  CONSTRAINT `email_templates_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
