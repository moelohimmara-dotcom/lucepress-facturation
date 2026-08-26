export function calculateBalanceInvoiceAmount(quoteTotal: number, depositInvoiceTotal: number) {
  if (!Number.isInteger(quoteTotal) || quoteTotal <= 0) throw new Error("Le devis d’origine doit avoir un montant total positif.");
  if (!Number.isInteger(depositInvoiceTotal) || depositInvoiceTotal <= 0) throw new Error("La facture d’acompte doit avoir un montant positif.");
  const balance = quoteTotal - depositInvoiceTotal;
  if (balance <= 0) throw new Error("Le devis ne comporte pas de solde à facturer.");
  return balance;
}

export function assertDepositInvoiceIsFullyPaid(depositInvoiceTotal: number, paidAmount: number) {
  if (!Number.isInteger(depositInvoiceTotal) || depositInvoiceTotal <= 0) throw new Error("La facture d’acompte doit avoir un montant positif.");
  if (!Number.isInteger(paidAmount) || paidAmount < depositInvoiceTotal) throw new Error("La facture d’acompte doit être intégralement réglée avant de créer le solde.");
}

export function reuseExistingGeneratedInvoice(existing: { id: number; number: string } | undefined) {
  return existing ? { ...existing, existing: true } : null;
}
