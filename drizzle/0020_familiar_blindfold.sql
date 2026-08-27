ALTER TABLE `client_activities` MODIFY COLUMN `type` enum('relance_preparee','note','statut_recouvrement','responsable_recouvrement') NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `collectionStatus` enum('a_traiter','contacte','a_rappeler') DEFAULT 'a_traiter' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `collectionOwnerId` int;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_collectionOwnerId_users_id_fk` FOREIGN KEY (`collectionOwnerId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `documents_collection_owner_status_idx` ON `documents` (`collectionOwnerId`,`collectionStatus`);