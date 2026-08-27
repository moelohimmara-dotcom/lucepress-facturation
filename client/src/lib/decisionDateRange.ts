export type DecisionDatePreset = "week" | "month" | "last30";

function toDateInputValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function getDecisionDateRange(preset: DecisionDatePreset, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  if (preset === "week") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else if (preset === "month") {
    start.setDate(1);
  } else {
    start.setDate(start.getDate() - 29);
  }
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}
