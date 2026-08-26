ALTER TABLE `clients` ADD `defaultDiscountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `discountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `discountAmount` bigint DEFAULT 0 NOT NULL;