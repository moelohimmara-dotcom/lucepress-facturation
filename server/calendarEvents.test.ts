import { buildCalendarEvents, calendarDateKey } from "@shared/calendarEvents";
import { describe, expect, it } from "vitest";

describe("échéances du calendrier Lucepress", () => {
  it("agrège les échéances de devis et les relances programmées dans l’ordre chronologique", () => {
    const events = buildCalendarEvents([
      { id: 2, number: "DEV-002", clientName: "Bati Guinée", validUntil: "2026-09-11T00:00:00.000Z", status: "envoye" },
    ], [
      { id: 5, name: "Relances septembre", nextExecutionAt: "2026-09-10T09:00:00.000Z", scheduleTimeZone: "Africa/Conakry", status: "active_simulation", eligibleCount: 4 },
    ]);

    expect(events.map(event => event.kind)).toEqual(["relance", "devis"]);
    expect(events[0]).toMatchObject({ href: "/agent-ia/planification", detail: "4 brouillon(s) · Africa/Conakry" });
    expect(events[1]).toMatchObject({ href: "/documents/2", title: "Échéance DEV-002" });
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
});
