-- Ajout du champ passwordHash pour l'authentification locale email+mot de passe
-- (remplace l'authentification OAuth Manus)
ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255) NULL AFTER `email`;
