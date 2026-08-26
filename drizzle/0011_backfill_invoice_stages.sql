UPDATE `documents`
SET `invoiceStage` = 'acompte'
WHERE `kind` = 'facture'
  AND `invoiceStage` = 'standard'
  AND `relatedDocumentId` IS NOT NULL
  AND `notes` LIKE 'Facture d’acompte%';
