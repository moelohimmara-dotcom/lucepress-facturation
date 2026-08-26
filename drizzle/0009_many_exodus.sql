CREATE TABLE `service_price_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`previousUnitPrice` bigint NOT NULL,
	`nextUnitPrice` bigint NOT NULL,
	`previousTaxRate` int NOT NULL,
	`nextTaxRate` int NOT NULL,
	`changedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_price_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `service_price_revisions` ADD CONSTRAINT `service_price_revisions_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_price_revisions` ADD CONSTRAINT `service_price_revisions_changedById_users_id_fk` FOREIGN KEY (`changedById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `service_price_revisions_serviceId_createdAt_idx` ON `service_price_revisions` (`serviceId`,`createdAt`);