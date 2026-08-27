export const LOCAL_HISTORY_ASSUMED_LIMIT_BYTES = 4_500_000;
export const LOCAL_HISTORY_WARNING_RATIO = 0.75;

export type LocalHistoryCapacity = {
  bytes: number;
  percent: number;
  shouldWarn: boolean;
};

export function getLocalHistoryCapacity(value: unknown): LocalHistoryCapacity {
  const serialized = JSON.stringify(value);
  const bytes = new Blob([serialized]).size;
  const percent = Math.min(100, Math.round((bytes / LOCAL_HISTORY_ASSUMED_LIMIT_BYTES) * 100));
  return { bytes, percent, shouldWarn: bytes >= LOCAL_HISTORY_ASSUMED_LIMIT_BYTES * LOCAL_HISTORY_WARNING_RATIO };
}
