-- Expand invitations enum first (legacy rows still use role='user').
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('user','admin','directeur','cadre','client') NOT NULL DEFAULT 'cadre';
--> statement-breakpoint
UPDATE `invitations` SET `role` = 'cadre' WHERE `role` = 'user';
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','directeur','cadre','client') NOT NULL DEFAULT 'cadre';
--> statement-breakpoint
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('admin','directeur','cadre','client') NOT NULL DEFAULT 'cadre';
