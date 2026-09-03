export function percentile(sortedMs: number[], p: number) {
  if (!sortedMs.length) return 0;
  const rank = Math.min(sortedMs.length - 1, Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1));
  return sortedMs[rank] ?? 0;
}

export function summarizeLatencies(samplesMs: number[]) {
  const sorted = [...samplesMs].filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const total = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: total,
    min: sorted[0] ?? 0,
    max: sorted[total - 1] ?? 0,
    mean: total ? Math.round(sum / total) : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}
