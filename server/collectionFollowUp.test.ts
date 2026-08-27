import { describe, expect, it } from "vitest";
import { collectionFollowUpLabels, collectionMonthBounds, getCollectionReminderSignal, getCollectionStatusDistribution, isCollectionFollowUpStatus, isCollectionReminderToday, isCollectionReminderTomorrow, isCollectionReportMonth, normalizeCollectionReminderDate, validateCollectionReminder } from "../shared/collectionFollowUp";
import { buildCollectionReminderLoad } from "../shared/collectionReminderLoad";

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
    expect(isCollectionReminderTomorrow("2026-08-28", today)).toBe(true);
  });

  it("compte les rappels ouverts par responsable, y compris ceux non attribués", () => {
    expect(buildCollectionReminderLoad([
      { collectionStatus: "a_rappeler", collectionReminderDate: "2026-08-28", collectionOwnerId: 7 },
      { collectionStatus: "a_rappeler", collectionReminderDate: "2026-08-29", collectionOwnerId: 7 },
      { collectionStatus: "a_rappeler", collectionReminderDate: "2026-08-30", collectionOwnerId: null },
      { collectionStatus: "contacte", collectionReminderDate: "2026-08-30", collectionOwnerId: 8 },
    ], [{ id: 7, name: "Awa Camara" }, { id: 8, name: "Moussa Touré" }])).toEqual([
      { ownerId: 7, ownerName: "Awa Camara", reminderCount: 2 },
      { ownerId: null, ownerName: "Sans responsable", reminderCount: 1 },
      { ownerId: 8, ownerName: "Moussa Touré", reminderCount: 0 },
    ]);
  });
});
