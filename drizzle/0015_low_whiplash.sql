CREATE TABLE `payment_promises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`promisedDate` date NOT NULL,
	`note` varchar(500),
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_promises_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_promises_document_unique` UNIQUE(`documentId`)
);
--> statement-breakpoint
CREATE TABLE `project_cost_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectCostId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`contentType` varchar(120) NOT NULL,
	`size` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(512) NOT NULL,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_cost_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payment_promises` ADD CONSTRAINT `payment_promises_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_promises` ADD CONSTRAINT `payment_promises_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_cost_attachments` ADD CONSTRAINT `project_cost_attachments_projectCostId_project_costs_id_fk` FOREIGN KEY (`projectCostId`) REFERENCES `project_costs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_cost_attachments` ADD CONSTRAINT `project_cost_attachments_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payment_promises_date_idx` ON `payment_promises` (`promisedDate`);--> statement-breakpoint
CREATE INDEX `project_cost_attachments_cost_idx` ON `project_cost_attachments` (`projectCostId`);