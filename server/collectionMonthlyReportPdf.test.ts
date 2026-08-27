import { describe, expect, it, vi } from "vitest";

const pdf = vi.hoisted(() => ({ addPage: vi.fn(), circle: vi.fn(), line: vi.fn(), rect: vi.fn(), save: vi.fn(), setDrawColor: vi.fn(), setFillColor: vi.fn(), setFont: vi.fn(), setFontSize: vi.fn(), setLineWidth: vi.fn(), setTextColor: vi.fn(), text: vi.fn(), triangle: vi.fn() }));
vi.mock("jspdf", () => ({ jsPDF: class { internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }; addPage = pdf.addPage; circle = pdf.circle; line = pdf.line; rect = pdf.rect; save = pdf.save; setDrawColor = pdf.setDrawColor; setFillColor = pdf.setFillColor; setFont = pdf.setFont; setFontSize = pdf.setFontSize; setLineWidth = pdf.setLineWidth; setTextColor = pdf.setTextColor; splitTextToSize = (value: string) => [value]; text = pdf.text; triangle = pdf.triangle; } }));

import { downloadCollectionMonthlyReportPdf } from "../client/src/lib/collectionMonthlyReport";

describe("rapport PDF mensuel de recouvrement", () => {
  it("génère les indicateurs de suivi, les créances et les activités du mois", async () => {
    await downloadCollectionMonthlyReportPdf({ month: "2026-08", generatedAt: "2026-08-27T10:00:00.000Z", summary: { openCount: 1, overdueCount: 1, outstandingTotal: 600000, overdueTotal: 600000, assignedCount: 1, activityCount: 2, paymentCount: 1, monthlyCollectedAmount: 250000, statusCounts: { a_traiter: 0, contacte: 0, a_rappeler: 1 } }, invoices: [{ number: "FAC-2026-0042", clientName: "Bâti Guinée", dueDate: "2026-08-12", balanceDue: 600000, isOverdue: true, daysOverdue: 15, collectionStatus: "a_rappeler", collectionReminderDate: "2026-08-29", collectionOwnerName: "Awa Camara" }], activities: [{ id: "activity-2", type: "relance_preparee", title: "Relance préparée", description: "Objet de test", documentNumber: "FAC-2026-0042", clientName: "Bâti Guinée", occurredAt: "2026-08-20" }] });
    expect(pdf.text).toHaveBeenCalledWith("Rapport mensuel de recouvrement", 14, 31);
    expect(pdf.text).toHaveBeenCalledWith("Répartition des créances par statut", 14, expect.any(Number));
    expect(pdf.triangle).toHaveBeenCalled();
    expect(pdf.text.mock.calls).toContainEqual([["Awa Camara\nRappel : 29 août 2026"], 125, expect.any(Number)]);
    expect(pdf.text.mock.calls).toContainEqual([["FAC-2026-0042 · Bâti Guinée"], 16, expect.any(Number)]);
    expect(pdf.text.mock.calls).toContainEqual([["Bâti Guinée · FAC-2026-0042"], 48, expect.any(Number)]);
    expect(pdf.save).toHaveBeenCalledWith("lucepress-recouvrement-2026-08.pdf");
  });
});
