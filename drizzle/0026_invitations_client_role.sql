-- Safety net if 0025 already expanded/shrunk invitations on another environment.
UPDATE `invitations` SET `role` = 'cadre' WHERE `role` = 'user';
--> statement-breakpoint
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('admin','directeur','cadre','client') NOT NULL DEFAULT 'cadre';
