import { calculateDocumentTotals, type EditableDocumentLine } from "./billing";

export function calculateDocumentDiscount(lines: EditableDocumentLine[], discountPercent = 0) {
  const totals = calculateDocumentTotals(lines);
  const normalizedPercent = Number.isInteger(discountPercent) && discountPercent >= 0 && discountPercent <= 99 ? discountPercent : 0;
  const discountAmount = Math.round((totals.total * normalizedPercent) / 100);
  return { ...totals, discountPercent: normalizedPercent, discountAmount, totalAfterDiscount: totals.total - discountAmount };
}
