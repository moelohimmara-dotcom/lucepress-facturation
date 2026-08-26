CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(180) NOT NULL,
	`contactName` varchar(180),
	`email` varchar(320),
	`phone` varchar(64),
	`address` text,
	`taxId` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`position` int NOT NULL,
	`description` text NOT NULL,
	`quantity` decimal(12,2) NOT NULL DEFAULT '1.00',
	`unit` varchar(30) NOT NULL DEFAULT 'unité',
	`unitPrice` bigint NOT NULL DEFAULT 0,
	`taxRate` int NOT NULL DEFAULT 0,
	`lineTotal` bigint NOT NULL DEFAULT 0,
	`serviceId` int,
	CONSTRAINT `document_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_lines_document_position_unique` UNIQUE(`documentId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `document_sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('devis','facture') NOT NULL,
	`lastValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_sequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_sequences_kind_unique` UNIQUE(`kind`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('devis','facture') NOT NULL,
	`number` varchar(80) NOT NULL,
	`clientId` int NOT NULL,
	`projectId` int,
	`relatedDocumentId` int,
	`status` enum('brouillon','a_envoyer','envoye','accepte','refuse','partiellement_paye','paye','en_retard','annule') NOT NULL DEFAULT 'brouillon',
	`issueDate` date NOT NULL,
	`dueDate` date,
	`validUntil` date,
	`currency` varchar(3) NOT NULL DEFAULT 'GNF',
	`subtotal` bigint NOT NULL DEFAULT 0,
	`taxTotal` bigint NOT NULL DEFAULT 0,
	`total` bigint NOT NULL DEFAULT 0,
	`notes` text,
	`isAiDraft` enum('oui','non') NOT NULL DEFAULT 'non',
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `documents_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`reference` varchar(80),
	`type` enum('btp','forage','mixte') NOT NULL,
	`status` enum('actif','en_pause','termine') NOT NULL DEFAULT 'actif',
	`location` varchar(255),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` enum('btp','forage','etude','transport','autre') NOT NULL DEFAULT 'autre',
	`description` text,
	`unit` varchar(30) NOT NULL DEFAULT 'unité',
	`defaultUnitPrice` bigint NOT NULL DEFAULT 0,
	`defaultTaxRate` int NOT NULL DEFAULT 0,
	`isActive` enum('oui','non') NOT NULL DEFAULT 'oui',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `document_lines` ADD CONSTRAINT `document_lines_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_lines` ADD CONSTRAINT `document_lines_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `clients_companyName_idx` ON `clients` (`companyName`);--> statement-breakpoint
CREATE INDEX `document_lines_documentId_idx` ON `document_lines` (`documentId`);--> statement-breakpoint
CREATE INDEX `documents_kind_status_idx` ON `documents` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `documents_clientId_idx` ON `documents` (`clientId`);--> statement-breakpoint
CREATE INDEX `documents_dueDate_idx` ON `documents` (`dueDate`);--> statement-breakpoint
CREATE INDEX `projects_clientId_idx` ON `projects` (`clientId`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);