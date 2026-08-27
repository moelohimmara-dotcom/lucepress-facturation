export type ReceivablesPeriod = "all" | "7" | "30" | "90";

function toDay(value: Date | string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isReceivableDueInPeriod(dueDate: Date | string | null, period: ReceivablesPeriod, now = new Date()) {
  if (period === "all") return true;
  const dueDay = toDay(dueDate);
  const today = toDay(now);
  if (dueDay === null || today === null) return false;
  return dueDay >= today - Number(period) * 86_400_000 && dueDay <= today;
}
