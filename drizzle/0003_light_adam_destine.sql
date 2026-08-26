CREATE TABLE `company_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalName` varchar(180) NOT NULL DEFAULT 'Lucepress',
	`legalAddress` text,
	`phone` varchar(64),
	`email` varchar(320),
	`website` varchar(255),
	`taxId` varchar(100),
	`registrationNumber` varchar(100),
	`bankName` varchar(180),
	`accountName` varchar(180),
	`accountNumber` varchar(120),
	`iban` varchar(120),
	`swift` varchar(32),
	`paymentInstructions` text,
	`documentFooter` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`)
);
