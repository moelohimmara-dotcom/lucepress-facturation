import { describe, expect, it, vi } from "vitest";

const pdf = vi.hoisted(() => ({
  addPage: vi.fn(),
  circle: vi.fn(),
  line: vi.fn(),
  rect: vi.fn(),
  save: vi.fn(),
  setDrawColor: vi.fn(),
  setFillColor: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setLineWidth: vi.fn(),
  setTextColor: vi.fn(),
  text: vi.fn(),
}));

vi.mock("jspdf", () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    addPage = pdf.addPage;
    circle = pdf.circle;
    line = pdf.line;
    rect = pdf.rect;
    save = pdf.save;
    setDrawColor = pdf.setDrawColor;
    setFillColor = pdf.setFillColor;
    setFont = pdf.setFont;
    setFontSize = pdf.setFontSize;
    setLineWidth = pdf.setLineWidth;
    setTextColor = pdf.setTextColor;
    splitTextToSize = (value: string) => [value];
    text = pdf.text;
  },
}));

import { downloadApprovalReportPdf } from "../client/src/lib/approvalReport";

describe("rapport PDF d’approbations", () => {
  it("génère une synthèse locale avec les lignes visibles et leur statut", async () => {
    await downloadApprovalReportPdf([
      { source: "Simulation locale", status: "Approuvée", providerName: "QuickBooks Online", operation: "Créer une facture", createdAt: "27 août, 09:15", decidedAt: "27 août, 11:00" },
      { source: "Simulation locale", status: "Refusée", providerName: "Procore", operation: "Synchroniser un rapport", createdAt: "27 août, 10:00", decidedAt: "27 août, 11:05" },
    ], { search: "", provider: "all", status: "all", decisionStart: "2026-08-01", decisionEnd: "2026-08-27" });

    expect(pdf.text).toHaveBeenCalledWith("Rapport de synthèse des approbations", 14, 31);
    expect(pdf.text).toHaveBeenCalledWith("Lucepres", 27, 16);
    expect(pdf.text.mock.calls).toContainEqual([["QuickBooks Online"], 48, expect.any(Number)]);
    expect(pdf.text.mock.calls).toContainEqual([["Procore"], 48, expect.any(Number)]);
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/lucepress-approbations-.*\.pdf/));
  });
});
