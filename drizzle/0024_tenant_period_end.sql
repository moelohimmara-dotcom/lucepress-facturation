-- Add currentPeriodEnd column to tenants for subscription renewal tracking

ALTER TABLE `tenants` ADD COLUMN `currentPeriodEnd` timestamp NULL;
