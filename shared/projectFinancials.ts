export type ProjectMarginInput = {
  revenueCollected: number;
  costTotal: number;
  plannedRevenue?: number;
  plannedBudget?: number;
};

export function calculateProjectMargin({ revenueCollected, costTotal, plannedRevenue = 0, plannedBudget = 0 }: ProjectMarginInput) {
  const margin = revenueCollected - costTotal;
  const hasPlannedMargin = plannedRevenue > 0 && plannedBudget > 0;
  const plannedMargin = hasPlannedMargin ? plannedRevenue - plannedBudget : null;
  return {
    revenueCollected,
    costTotal,
    margin,
    marginRate: revenueCollected > 0 ? Math.round((margin / revenueCollected) * 1000) / 10 : null,
    plannedRevenue,
    plannedBudget,
    plannedMargin,
    plannedMarginRate: hasPlannedMargin ? Math.round((plannedMargin! / plannedRevenue) * 1000) / 10 : null,
    marginVariance: plannedMargin === null ? null : margin - plannedMargin,
  };
}
