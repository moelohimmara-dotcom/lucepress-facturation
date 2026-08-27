import { describe, expect, it } from "vitest";
import { collectionFollowUpLabels, collectionMonthBounds, isCollectionFollowUpStatus, isCollectionReportMonth } from "../shared/collectionFollowUp";

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
});
