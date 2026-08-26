export function calculateDepositInvoiceAmount(quoteTotal: number, depositPercent: number | null | undefined) {
  if (!Number.isInteger(depositPercent) || !depositPercent || depositPercent < 1 || depositPercent > 99) throw new Error("Le devis ne comporte pas d’acompte valide.");
  if (!Number.isInteger(quoteTotal) || quoteTotal <= 0) throw new Error("Le devis doit avoir un montant total positif.");
  return Math.round((quoteTotal * depositPercent) / 100);
}
