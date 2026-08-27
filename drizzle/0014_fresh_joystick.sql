CREATE TABLE `project_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`category` enum('materiaux','main_oeuvre','transport','equipement','sous_traitance','autre') NOT NULL,
	`description` varchar(500) NOT NULL,
	`amount` bigint NOT NULL,
	`incurredAt` date NOT NULL,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_costs` ADD CONSTRAINT `project_costs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_costs` ADD CONSTRAINT `project_costs_createdById_users_id_fk` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_costs_project_date_idx` ON `project_costs` (`projectId`,`incurredAt`);--> statement-breakpoint
CREATE INDEX `project_costs_category_idx` ON `project_costs` (`category`);