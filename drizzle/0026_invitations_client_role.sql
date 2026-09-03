-- Legacy invitations still used role='user' (pre-RBAC). Remap before shrinking the enum.
UPDATE `invitations` SET `role` = 'cadre' WHERE `role` = 'user';
--> statement-breakpoint
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('admin','directeur','cadre','client') NOT NULL DEFAULT 'cadre';
