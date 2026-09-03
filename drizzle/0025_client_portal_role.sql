ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','directeur','cadre','client') NOT NULL DEFAULT 'cadre';--> statement-breakpoint
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('admin','directeur','cadre','client') NOT NULL DEFAULT 'cadre';
