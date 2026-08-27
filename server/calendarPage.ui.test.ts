import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/CalendarPage.tsx"), "utf8");

describe("calendrier des rappels de créances", () => {
  it("affiche les rappels avec un filtre et un accès direct à leur suivi", () => {
    expect(source).toContain("Rappels");
    expect(source).toContain("trpc.billing.receivables.useQuery");
    expect(source).toContain("buildCalendarEvents(quotes, center?.campaigns ?? [], receivables?.invoices ?? [])");
    expect(source).toContain("suivi d’une créance à traiter");
  });
});
