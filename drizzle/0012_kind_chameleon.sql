CREATE TABLE `integration_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int,
	`actorId` int,
	`action` varchar(100) NOT NULL,
	`target` varchar(255),
	`decision` enum('autorise','refuse','information') NOT NULL DEFAULT 'information',
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_capabilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`code` varchar(100) NOT NULL,
	`label` varchar(180) NOT NULL,
	`direction` enum('lecture','ecriture','bidirectionnel') NOT NULL,
	`riskLevel` enum('faible','moyen','eleve') NOT NULL DEFAULT 'moyen',
	`requiresApproval` enum('oui','non') NOT NULL DEFAULT 'oui',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_capabilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_capabilities_provider_code_unique` UNIQUE(`providerId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`status` enum('eligible','credentials_pending','testing','active','degraded','revoked','disabled') NOT NULL DEFAULT 'eligible',
	`grantedScopes` text,
	`secretRef` varchar(255),
	`lastHealthCheckAt` timestamp,
	`lastError` text,
	`enabledById` int,
	`connectedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_connections_provider_unique` UNIQUE(`providerId`)
);
--> statement-breakpoint
CREATE TABLE `integration_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`operation` varchar(100) NOT NULL,
	`idempotencyKey` varchar(255) NOT NULL,
	`payloadHash` varchar(128) NOT NULL,
	`status` enum('queued','approved','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_jobs_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `integration_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`internalId` int NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`externalVersion` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_mappings_connection_entity_internal_unique` UNIQUE(`connectionId`,`entityType`,`internalId`)
);
--> statement-breakpoint
CREATE TABLE `integration_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` enum('communication','collaboration','chantier','comptabilite') NOT NULL,
	`transport` enum('api','mcp') NOT NULL,
	`documentationUrl` varchar(512),
	`authType` enum('oauth2','api_key','none') NOT NULL,
	`isSupported` enum('oui','non') NOT NULL DEFAULT 'oui',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_providers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `integration_audit_logs` ADD CONSTRAINT `int_audit_connection_fk` FOREIGN KEY (`connectionId`) REFERENCES `integration_connections`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_audit_logs` ADD CONSTRAINT `int_audit_actor_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_capabilities` ADD CONSTRAINT `int_cap_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `integration_providers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_connections` ADD CONSTRAINT `int_conn_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `integration_providers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_connections` ADD CONSTRAINT `int_conn_enabled_by_fk` FOREIGN KEY (`enabledById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_jobs` ADD CONSTRAINT `int_job_connection_fk` FOREIGN KEY (`connectionId`) REFERENCES `integration_connections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_mappings` ADD CONSTRAINT `int_mapping_connection_fk` FOREIGN KEY (`connectionId`) REFERENCES `integration_connections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `integration_audit_logs_connection_created_idx` ON `integration_audit_logs` (`connectionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `integration_audit_logs_actor_created_idx` ON `integration_audit_logs` (`actorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `integration_capabilities_provider_idx` ON `integration_capabilities` (`providerId`);--> statement-breakpoint
CREATE INDEX `integration_connections_status_idx` ON `integration_connections` (`status`);--> statement-breakpoint
CREATE INDEX `integration_jobs_connection_status_idx` ON `integration_jobs` (`connectionId`,`status`);--> statement-breakpoint
CREATE INDEX `integration_mappings_external_idx` ON `integration_mappings` (`connectionId`,`externalId`);--> statement-breakpoint
CREATE INDEX `integration_providers_category_idx` ON `integration_providers` (`category`,`sortOrder`);
