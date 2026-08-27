import { describe, expect, it } from "vitest";
import { collectionFollowUpLabels, collectionMonthBounds, getCollectionReminderSignal, getCollectionStatusDistribution, isCollectionFollowUpStatus, isCollectionReminderToday, isCollectionReportMonth, normalizeCollectionReminderDate, validateCollectionReminder } from "../shared/collectionFollowUp";

describe("règles de suivi des créances", () => {
  it("centralise les statuts de traitement autorisés et leurs libellés français", () => {
    expect(isCollectionFollowUpStatus("a_traiter")).toBe(true);
    expect(isCollectionFollowUpStatus("contacte")).toBe(true);
    expect(isCollectionFollowUpStatus("paye")).toBe(false);
    expect(collectionFollowUpLabels.a_rappeler).toBe("À rappeler");
  });

  it("délimite de manière fiable le mois du rapport", () => {
    expect(isCollectionReportMonth("2026-08")).toBe(true);
    expect(isCollectionReportMonth("2026-13")).toBe(false);
    expect(collectionMonthBounds("2026-08")).toEqual({ start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-09-01T00:00:00.000Z") });
  });

  it("impose une date valide et non échue lorsque la créance est à rappeler", () => {
    const today = new Date("2026-08-27T10:00:00.000Z");
    expect(validateCollectionReminder("a_rappeler", null, today)).toBe("Choisissez une date de rappel pour ce statut.");
    expect(validateCollectionReminder("a_rappeler", normalizeCollectionReminderDate("2026-08-26"), today)).toBe("La date de rappel doit être aujourd’hui ou ultérieure.");
    expect(validateCollectionReminder("a_rappeler", normalizeCollectionReminderDate("2026-08-27"), today)).toBeNull();
    expect(() => normalizeCollectionReminderDate("2026-02-30")).toThrow("La date de rappel est invalide.");
  });

  it("calcule une répartition déterministe des créances par statut", () => {
    expect(getCollectionStatusDistribution({ a_traiter: 1, contacte: 2, a_rappeler: 1 })).toEqual([
      { status: "a_traiter", count: 1, percentage: 25 },
      { status: "contacte", count: 2, percentage: 50 },
      { status: "a_rappeler", count: 1, percentage: 25 },
    ]);
  });

  it("signale les rappels du jour, proches et dépassés selon une fenêtre de trois jours", () => {
    const today = new Date("2026-08-27T10:00:00.000Z");
    expect(getCollectionReminderSignal("2026-08-26", today)).toBe("depasse");
    expect(getCollectionReminderSignal("2026-08-27", today)).toBe("aujourdhui");
    expect(getCollectionReminderSignal("2026-08-30", today)).toBe("proche");
    expect(getCollectionReminderSignal("2026-08-31", today)).toBeNull();
    expect(isCollectionReminderToday("2026-08-27", today)).toBe(true);
  });
});
