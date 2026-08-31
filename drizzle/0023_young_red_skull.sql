CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`invitedBy` int NOT NULL,
	`status` enum('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`acceptedByUser` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
CREATE INDEX `invitations_email_idx` ON `invitations` (`email`);--> statement-breakpoint
CREATE INDEX `invitations_status_idx` ON `invitations` (`status`);--> statement-breakpoint
CREATE INDEX `documents_updatedAt_idx` ON `documents` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `documents_kind_updatedAt_idx` ON `documents` (`kind`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `documents_projectId_idx` ON `documents` (`projectId`);