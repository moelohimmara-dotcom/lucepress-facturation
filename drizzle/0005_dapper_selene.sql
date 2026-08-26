CREATE TABLE `client_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`documentId` int,
	`type` enum('relance_preparee','note') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `client_activities` ADD CONSTRAINT `client_activities_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_activities` ADD CONSTRAINT `client_activities_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_activities` ADD CONSTRAINT `client_activities_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_activities_clientId_createdAt_idx` ON `client_activities` (`clientId`,`createdAt`);