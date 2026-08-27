CREATE TABLE `agent_test_email_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`messageJobId` int NOT NULL,
	`testRecipient` varchar(255) NOT NULL DEFAULT 'Boîte de test Lucepress',
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`status` enum('previsualise','remis_test','annule') NOT NULL DEFAULT 'previsualise',
	`runKey` varchar(255) NOT NULL,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_test_email_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_test_email_deliveries_run_key_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
ALTER TABLE `agent_message_jobs` MODIFY COLUMN `status` enum('simulation_prete','remis_test','bloquee','annulee') NOT NULL DEFAULT 'simulation_prete';--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD `scheduleCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD `scheduleCronExpression` varchar(80);--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD `scheduleTimeZone` varchar(80) DEFAULT 'Africa/Conakry' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD `nextExecutionAt` timestamp;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD `lastExecutedAt` timestamp;--> statement-breakpoint
ALTER TABLE `agent_campaigns` ADD `lastExecutionStatus` enum('pending','success','skipped','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_test_email_deliveries` ADD CONSTRAINT `agent_test_email_deliveries_campaignId_agent_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `agent_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_test_email_deliveries` ADD CONSTRAINT `agent_test_mail_job_fk` FOREIGN KEY (`messageJobId`) REFERENCES `agent_message_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_test_email_deliveries_campaign_date_idx` ON `agent_test_email_deliveries` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_test_email_deliveries_job_idx` ON `agent_test_email_deliveries` (`messageJobId`);--> statement-breakpoint
CREATE INDEX `agent_campaigns_schedule_uid_idx` ON `agent_campaigns` (`scheduleCronTaskUid`);
