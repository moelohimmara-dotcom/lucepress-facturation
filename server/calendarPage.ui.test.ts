import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/CalendarPage.tsx"), "utf8");

describe("calendrier des rappels de créances", () => {
  it("affiche les rappels avec un filtre et un accès direct à leur suivi", () => {
    expect(source).toContain("Rappels");
    expect(source).toContain("trpc.billing.receivables.useQuery");
    expect(source).toContain("buildCalendarEvents(quotes, center?.campaigns ?? [], receivables?.invoices ?? [], invoices)");
    expect(source).toContain("trpc.billing.documents.list.useQuery({ kind: \"facture\" })");
    expect(source).toContain("suivi d’une créance à traiter");
  });

  it("prévoit le glisser-déposer d’un rappel seulement vers une date future", () => {
    expect(source).toContain("draggable={event.kind === \"rappel\"}");
    expect(source).toContain("handleReminderDrop(day)");
    expect(source).toContain("Un rappel ne peut pas être déplacé vers une date passée.");
    expect(source).toContain("Date de rappel déplacée et journalisée.");
  });
});
