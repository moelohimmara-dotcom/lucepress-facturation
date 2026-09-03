import { buildCalendarEvents, calendarDateKey } from "@shared/calendarEvents";
import { describe, expect, it } from "vitest";

describe("échéances du calendrier Lucepress", () => {
  it("agrège les échéances de devis et les relances programmées dans l’ordre chronologique", () => {
    const events = buildCalendarEvents([
      { id: 2, number: "DEV-002", clientName: "Bati Guinée", validUntil: "2026-09-11T00:00:00.000Z", status: "envoye" },
    ], [
      { id: 5, name: "Relances septembre", nextExecutionAt: "2026-09-10T09:00:00.000Z", scheduleTimeZone: "Africa/Conakry", status: "active_simulation", eligibleCount: 4 },
    ], [{ id: 9, number: "FAC-009", clientName: "Hydro Guinée", projectName: "Forage Kindia", collectionStatus: "a_rappeler", collectionReminderDate: "2026-09-09T00:00:00.000Z" }]);

    expect(events.map(event => event.kind)).toEqual(["rappel", "relance", "devis"]);
    expect(events[0]).toMatchObject({ href: "/creances?facture=9", title: "Rappel FAC-009", detail: "Hydro Guinée · Forage Kindia" });
    expect(events[1]).toMatchObject({ href: "/agent-ia/planification", detail: "4 brouillon(s) · Africa/Conakry" });
    expect(events[2]).toMatchObject({ href: "/documents/2", title: "Validité DEV-002" });
  });

  it("écarte les devis refusés et les campagnes suspendues, et fournit une clé stable par jour", () => {
    const events = buildCalendarEvents([
      { id: 1, number: "DEV-001", clientName: "Client", validUntil: "2026-09-10T00:00:00.000Z", status: "refuse" },
    ], [
      { id: 1, name: "Suspendue", nextExecutionAt: "2026-09-10T09:00:00.000Z", status: "suspendue" },
    ]);

    expect(events).toEqual([]);
    expect(calendarDateKey("2026-09-10T09:00:00.000Z")).toBe("2026-09-10");
  });

  it("place acompte, solde et échéance de facture ouverte", () => {
    const events = buildCalendarEvents(
      [{ id: 3, number: "DEV-003", clientName: "Alpha", depositDueDate: "2026-09-04T00:00:00.000Z", balanceDueDate: "2026-09-20T00:00:00.000Z", status: "accepte" }],
      [],
      [],
      [{ id: 12, number: "FAC-012", clientName: "Beta", dueDate: "2026-09-08T00:00:00.000Z", status: "envoye", balanceDue: 800_000 }],
    );
    expect(events.map(event => event.title)).toEqual(["Acompte DEV-003", "Échéance FAC-012", "Solde DEV-003"]);
    expect(events.find(event => event.kind === "facture")?.href).toBe("/documents/12");
  });
});
