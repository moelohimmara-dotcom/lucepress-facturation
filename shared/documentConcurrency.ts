export function isConcurrentDocumentUpdate(storedUpdatedAt: Date | string | null | undefined, expectedUpdatedAt: Date | string | null | undefined) {
  if (!expectedUpdatedAt || !storedUpdatedAt) return false;
  const stored = new Date(storedUpdatedAt).getTime();
  const expected = new Date(expectedUpdatedAt).getTime();
  if (Number.isNaN(stored) || Number.isNaN(expected)) return false;
  return stored !== expected;
}
