export type QuotePaymentScheduleInput = {
  depositPercent?: number | null;
  depositDueDate?: string | null;
  balanceDueDate?: string | null;
};

export function calculateQuotePaymentSchedule(total: number, depositPercent?: number | null) {
  if (!depositPercent || depositPercent <= 0 || depositPercent >= 100) return null;
  const depositAmount = Math.round((total * depositPercent) / 100);
  return { depositPercent, depositAmount, balancePercent: 100 - depositPercent, balanceAmount: total - depositAmount };
}

export function validateQuotePaymentSchedule(input: QuotePaymentScheduleInput) {
  const errors: Partial<Record<keyof QuotePaymentScheduleInput, string>> = {};
  const hasSchedule = input.depositPercent !== undefined && input.depositPercent !== null;
  if (!hasSchedule) return errors;
  if (!Number.isInteger(input.depositPercent) || input.depositPercent! < 1 || input.depositPercent! > 99) errors.depositPercent = "L’acompte doit être un pourcentage entier compris entre 1 et 99.";
  if (!input.depositDueDate) errors.depositDueDate = "Indiquez la date d’échéance de l’acompte.";
  if (!input.balanceDueDate) errors.balanceDueDate = "Indiquez la date d’échéance du solde.";
  if (input.depositDueDate && input.balanceDueDate && input.depositDueDate > input.balanceDueDate) errors.balanceDueDate = "Le solde ne peut pas être exigible avant l’acompte.";
  return errors;
}
