CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`amount` bigint NOT NULL,
	`paidAt` date NOT NULL,
	`method` enum('especes','virement','cheque','mobile_money','autre') NOT NULL DEFAULT 'autre',
	`reference` varchar(120),
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_documentId_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_documentId_idx` ON `payments` (`documentId`);--> statement-breakpoint
CREATE INDEX `payments_paidAt_idx` ON `payments` (`paidAt`);