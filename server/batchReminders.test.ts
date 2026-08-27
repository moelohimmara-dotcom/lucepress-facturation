import { describe, expect, it } from "vitest";
import { BATCH_REMINDER_LIMIT, normalizeBatchReminderDocumentIds, normalizeBatchReminderInstruction } from "../shared/batchReminders";

describe("préparation groupée de relances", () => {
  it("déduplique la sélection et garde une instruction facultative nettoyée", () => {
    expect(normalizeBatchReminderDocumentIds([4, 8, 4])).toEqual([4, 8]);
    expect(normalizeBatchReminderInstruction("  rappeler le contact de chantier  ")).toBe("rappeler le contact de chantier");
    expect(normalizeBatchReminderInstruction("   ")).toBeUndefined();
  });

  it("refuse les sélections vides ou supérieures à la limite de sécurité", () => {
    expect(() => normalizeBatchReminderDocumentIds([])).toThrow("au moins une facture");
    expect(() => normalizeBatchReminderDocumentIds(Array.from({ length: BATCH_REMINDER_LIMIT + 1 }, (_, index) => index + 1))).toThrow("limitée");
  });
});
