CREATE TABLE `agent_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`delegationId` int,
	`campaignId` int,
	`actorId` int,
	`action` varchar(100) NOT NULL,
	`target` varchar(255),
	`decision` enum('autorise','refuse','information') NOT NULL DEFAULT 'information',
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`delegationId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`status` enum('brouillon','simulee','a_approuver','approuvee','active_simulation','suspendue','archivee') NOT NULL DEFAULT 'brouillon',
	`scheduledFor` timestamp,
	`eligibleCount` int NOT NULL DEFAULT 0,
	`preparedById` int NOT NULL,
	`approvedById` int,
	`approvedAt` timestamp,
	`secondApprovedById` int,
	`secondApprovedAt` timestamp,
	`activatedById` int,
	`suspendedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_delegations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`purpose` enum('relance_facture','suivi_devis') NOT NULL,
	`channel` enum('email','whatsapp') NOT NULL,
	`tone` enum('courtois','professionnel','ferme','commercial') NOT NULL DEFAULT 'professionnel',
	`status` enum('brouillon','a_approuver','active_simulation','suspendue','expiree','revoquee') NOT NULL DEFAULT 'brouillon',
	`startsAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`dailyLimit` int NOT NULL DEFAULT 60,
	`contactCooldownDays` int NOT NULL DEFAULT 7,
	`requiresSecondApproval` enum('oui','non') NOT NULL DEFAULT 'non',
	`scheduleCronTaskUid` varchar(65),
	`policyVersion` int NOT NULL DEFAULT 1,
	`ownerId` int NOT NULL,
	`approvedById` int,
	`approvedAt` timestamp,
	`secondApprovedById` int,
	`secondApprovedAt` timestamp,
	`activatedById` int,
	`suspendedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_delegations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_message_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`clientId` int NOT NULL,
	`documentId` int NOT NULL,
	`idempotencyKey` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`contentHash` varchar(128) NOT NULL,
	`status` enum('simulation_prete','bloquee','annulee') NOT NULL DEFAULT 'simulation_prete',
	`blockedReason` varchar(500),
	`scheduledFor` timestamp,
	`policySnapshot` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_message_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_message_jobs_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `agent_operator_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('directeur_general','responsable_commercial') NOT NULL,
	`canApprove` enum('oui','non') NOT NULL DEFAULT 'oui',
	`canActivate` enum('oui','non') NOT NULL DEFAULT 'non',
	`scope` enum('global','commercial') NOT NULL DEFAULT 'commercial',
	`status` enum('active','suspendue','revoquee') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`grantedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_operator_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_operator_grants_user_role_unique` UNIQUE(`userId`,`role`)
);
--> statement-breakpoint
ALTER TABLE `agent_audit_logs` ADD CONSTRAINT `agent_audit_logs_delegationId_agent_delegations_id_fk` FOREIGN KEY (`delegationId`) REFERENCES `agent_delegations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_audit_logs` ADD CONSTRAINT `agent_audit_logs_campaignId_agent_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `agent_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_audit_logs` ADD CONSTRAINT `agent_audit_logs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD CONSTRAINT `agent_campaigns_delegationId_agent_delegations_id_fk` FOREIGN KEY (`delegationId`) REFERENCES `agent_delegations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD CONSTRAINT `agent_campaigns_preparedById_users_id_fk` FOREIGN KEY (`preparedById`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD CONSTRAINT `agent_campaigns_approvedById_users_id_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD CONSTRAINT `agent_campaigns_secondApprovedById_users_id_fk` FOREIGN KEY (`secondApprovedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD CONSTRAINT `agent_campaigns_activatedById_users_id_fk` FOREIGN KEY (`activatedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD CONSTRAINT `agent_campaigns_suspendedById_users_id_fk` FOREIGN KEY (`suspendedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD CONSTRAINT `agent_delegations_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD CONSTRAINT `agent_delegations_approvedById_users_id_fk` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD CONSTRAINT `agent_delegations_secondApprovedById_users_id_fk` FOREIGN KEY (`secondApprovedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD CONSTRAINT `agent_delegations_activatedById_users_id_fk` FOREIGN KEY (`activatedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_delegations` ADD CONSTRAINT `agent_delegations_suspendedById_users_id_fk` FOREIGN KEY (`suspendedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_message_jobs` ADD CONSTRAINT `agent_message_jobs_campaignId_agent_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `agent_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_message_jobs` ADD CONSTRAINT `agent_message_jobs_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_message_jobs` ADD CONSTRAINT `agent_message_jobs_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_operator_grants` ADD CONSTRAINT `agent_operator_grants_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_operator_grants` ADD CONSTRAINT `agent_operator_grants_grantedById_users_id_fk` FOREIGN KEY (`grantedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_audit_logs_delegation_date_idx` ON `agent_audit_logs` (`delegationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_audit_logs_campaign_date_idx` ON `agent_audit_logs` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_audit_logs_actor_date_idx` ON `agent_audit_logs` (`actorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_campaigns_delegation_status_idx` ON `agent_campaigns` (`delegationId`,`status`);--> statement-breakpoint
CREATE INDEX `agent_campaigns_scheduled_status_idx` ON `agent_campaigns` (`scheduledFor`,`status`);--> statement-breakpoint
CREATE INDEX `agent_delegations_owner_status_idx` ON `agent_delegations` (`ownerId`,`status`);--> statement-breakpoint
CREATE INDEX `agent_delegations_status_expiry_idx` ON `agent_delegations` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `agent_delegations_schedule_uid_idx` ON `agent_delegations` (`scheduleCronTaskUid`);--> statement-breakpoint
CREATE INDEX `agent_message_jobs_campaign_status_idx` ON `agent_message_jobs` (`campaignId`,`status`);--> statement-breakpoint
CREATE INDEX `agent_message_jobs_document_idx` ON `agent_message_jobs` (`documentId`);--> statement-breakpoint
CREATE INDEX `agent_operator_grants_user_status_idx` ON `agent_operator_grants` (`userId`,`status`);