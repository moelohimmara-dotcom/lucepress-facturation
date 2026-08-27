export type ProjectMarginInput = {
  revenueCollected: number;
  costTotal: number;
};

export function calculateProjectMargin({ revenueCollected, costTotal }: ProjectMarginInput) {
  const margin = revenueCollected - costTotal;
  return {
    revenueCollected,
    costTotal,
    margin,
    marginRate: revenueCollected > 0 ? Math.round((margin / revenueCollected) * 1000) / 10 : null,
  };
}
