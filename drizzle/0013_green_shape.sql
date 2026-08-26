CREATE TABLE `integration_oauth_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`providerId` int NOT NULL,
	`clientId` varchar(255) NOT NULL,
	`redirectUri` varchar(512) NOT NULL,
	`requestedScopes` text NOT NULL,
	`stateHash` varchar(128) NOT NULL,
	`status` enum('authorization_ready','completed','failed','expired') NOT NULL DEFAULT 'authorization_ready',
	`error` text,
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_oauth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_oauth_sessions_state_hash_unique` UNIQUE(`stateHash`)
);
--> statement-breakpoint
CREATE TABLE `integration_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`externalEventId` varchar(255) NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`deliveryStatus` varchar(120),
	`signatureStatus` enum('valid','invalid','pending') NOT NULL DEFAULT 'pending',
	`processingStatus` enum('accepted','rejected','processed','failed') NOT NULL DEFAULT 'accepted',
	`payloadHash` varchar(128) NOT NULL,
	`summary` varchar(500),
	`error` text,
	`occurredAt` timestamp NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `integration_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_webhook_events_connection_external_unique` UNIQUE(`connectionId`,`externalEventId`)
);
--> statement-breakpoint
ALTER TABLE `integration_jobs` ADD `approvedById` int;--> statement-breakpoint
ALTER TABLE `integration_jobs` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `integration_jobs` ADD `approvalNote` varchar(500);--> statement-breakpoint
ALTER TABLE `integration_oauth_sessions` ADD CONSTRAINT `int_oauth_connection_fk` FOREIGN KEY (`connectionId`) REFERENCES `integration_connections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_oauth_sessions` ADD CONSTRAINT `int_oauth_provider_fk` FOREIGN KEY (`providerId`) REFERENCES `integration_providers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_oauth_sessions` ADD CONSTRAINT `int_oauth_creator_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_webhook_events` ADD CONSTRAINT `int_webhook_connection_fk` FOREIGN KEY (`connectionId`) REFERENCES `integration_connections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `integration_oauth_sessions_connection_status_idx` ON `integration_oauth_sessions` (`connectionId`,`status`);--> statement-breakpoint
CREATE INDEX `integration_webhook_events_connection_received_idx` ON `integration_webhook_events` (`connectionId`,`receivedAt`);--> statement-breakpoint
CREATE INDEX `integration_webhook_events_signature_idx` ON `integration_webhook_events` (`signatureStatus`,`receivedAt`);--> statement-breakpoint
ALTER TABLE `integration_jobs` ADD CONSTRAINT `int_jobs_approver_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
