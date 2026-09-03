ALTER TABLE `clients`
  ADD COLUMN `identityKind` ENUM('immatriculee','en_immatriculation','personne_physique','sans_immatriculation','autre') NOT NULL DEFAULT 'immatriculee' AFTER `taxId`,
  ADD COLUMN `registrationNumber` VARCHAR(100) NULL AFTER `identityKind`;
--> statement-breakpoint
ALTER TABLE `company_settings`
  ADD COLUMN `identityKind` ENUM('immatriculee','en_immatriculation','personne_physique','sans_immatriculation','autre') NOT NULL DEFAULT 'immatriculee' AFTER `website`;
