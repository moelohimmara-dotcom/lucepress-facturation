CREATE TABLE `password_resets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_resets_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` int NOT NULL,
	`role` enum('admin','member','viewer') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_memberships_user_tenant_unique` UNIQUE(`userId`,`tenantId`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`plan` enum('trial','pro','enterprise') NOT NULL DEFAULT 'trial',
	`stripeCustomerId` varchar(255),
	`trialEndsAt` timestamp,
	`status` enum('active','trial','suspended','cancelled') NOT NULL DEFAULT 'trial',
	`currency` varchar(3) NOT NULL DEFAULT 'GNF',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_audit_logs` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_message_jobs` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_operator_grants` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_test_email_deliveries` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `client_activities` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `client_attachments` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `document_lines` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `document_sequences` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_connections` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `invitations` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_promises` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `project_cost_attachments` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `project_costs` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `service_price_revisions` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `tenantId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `password_resets_user_idx` ON `password_resets` (`userId`);--> statement-breakpoint
CREATE INDEX `password_resets_status_idx` ON `password_resets` (`expiresAt`);--> statement-breakpoint
ALTER TABLE `agent_audit_logs` ADD CONSTRAINT `agent_audit_logs_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD CONSTRAINT `agent_campaigns_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD CONSTRAINT `agent_delegations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_message_jobs` ADD CONSTRAINT `agent_message_jobs_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_operator_grants` ADD CONSTRAINT `agent_operator_grants_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_test_email_deliveries` ADD CONSTRAINT `agent_test_email_deliveries_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_activities` ADD CONSTRAINT `client_activities_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_attachments` ADD CONSTRAINT `client_attachments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_settings` ADD CONSTRAINT `company_settings_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_lines` ADD CONSTRAINT `document_lines_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_sequences` ADD CONSTRAINT `document_sequences_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_connections` ADD CONSTRAINT `integration_connections_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_promises` ADD CONSTRAINT `payment_promises_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_cost_attachments` ADD CONSTRAINT `project_cost_attachments_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_costs` ADD CONSTRAINT `project_costs_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_price_revisions` ADD CONSTRAINT `service_price_revisions_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE set null ON UPDATE no action;