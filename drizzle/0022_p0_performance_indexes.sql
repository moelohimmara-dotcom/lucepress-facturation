-- P0 performance indexes
CREATE INDEX `documents_updatedAt_idx` ON `documents` (`updatedAt`);
--> statement-breakpoint
CREATE INDEX `documents_kind_updatedAt_idx` ON `documents` (`kind`,`updatedAt`);
--> statement-breakpoint
CREATE INDEX `documents_projectId_idx` ON `documents` (`projectId`);
--> statement-breakpoint
CREATE INDEX `payments_document_paidAt_idx` ON `payments` (`documentId`,`paidAt`);
--> statement-breakpoint
CREATE INDEX `clients_email_idx` ON `clients` (`email`);
