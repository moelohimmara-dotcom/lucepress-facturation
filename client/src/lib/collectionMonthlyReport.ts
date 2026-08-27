import { collectionFollowUpLabels, type CollectionFollowUpStatus } from "@shared/collectionFollowUp";

export type CollectionMonthlyReport = {
  month: string;
  generatedAt: Date | string;
  summary: {
    openCount: number;
    overdueCount: number;
    outstandingTotal: number;
    overdueTotal: number;
    assignedCount: number;
    activityCount: number;
    paymentCount: number;
    monthlyCollectedAmount: number;
    statusCounts: Record<CollectionFollowUpStatus, number>;
  };
  invoices: Array<{ number: string; clientName: string; dueDate: Date | string | null; balanceDue: number; isOverdue: boolean; daysOverdue: number; collectionStatus: CollectionFollowUpStatus; collectionOwnerName: string | null }>;
  activities: Array<{ id: string; type: string; title: string; description: string | null; documentNumber: string; clientName: string; occurredAt: Date | string }>;
};

const statusColors: Record<CollectionFollowUpStatus, [number, number, number]> = {
  a_traiter: [161, 98, 7],
  contacte: [5, 115, 87],
  a_rappeler: [190, 24, 93],
};

function formatAmount(value: number) {
  return `${value.toLocaleString("fr-GN")} GNF`;
}

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-GN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMonth(value: string) {
  return new Date(`${value}-01T12:00:00Z`).toLocaleDateString("fr-GN", { month: "long", year: "numeric" });
}

export async function downloadCollectionMonthlyReportPdf(report: CollectionMonthlyReport) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 0;

  const addHeader = () => {
    doc.setFillColor(4, 72, 52);
    doc.rect(0, 0, pageWidth, 38, "F");
    doc.setFillColor(243, 212, 139);
    doc.circle(margin + 5, 15, 5, "F");
    doc.setTextColor(4, 72, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("L", margin + 3.5, 17.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Lucepres", margin + 13, 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("SARL · SOLUTIONS DURABLES · RECOUVREMENT", margin + 13, 22);
    doc.setFontSize(7);
    doc.text(`Généré le ${new Date(report.generatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}`, pageWidth - margin, 12, { align: "right" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Rapport mensuel de recouvrement", margin, 31);
    y = 48;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    addHeader();
  };

  const addTableHeader = (columns: Array<{ label: string; x: number }>) => {
    doc.setFillColor(243, 245, 241);
    doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    columns.forEach(column => doc.text(column.label, column.x, y + 5));
    y += 10;
  };

  addHeader();
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Période des activités : ${formatMonth(report.month)} · Situation des factures ouvertes à la génération.`, margin, y);
  y += 10;

  const cards = [
    ["Encours ouvert", formatAmount(report.summary.outstandingTotal)],
    ["Encaissé ce mois", formatAmount(report.summary.monthlyCollectedAmount)],
    ["En retard", String(report.summary.overdueCount)],
    ["Activités tracées", String(report.summary.activityCount)],
  ];
  cards.forEach(([label, value], index) => {
    const x = margin + (index % 2) * 91;
    const cardY = y + Math.floor(index / 2) * 19;
    doc.setFillColor(249, 250, 247);
    doc.setDrawColor(222, 228, 220);
    doc.rect(x, cardY, 86, 15, "FD");
    doc.setTextColor(4, 72, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value, x + 4, cardY + 6);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(label, x + 4, cardY + 11);
  });
  y += 43;

  doc.setTextColor(4, 72, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Pilotage du suivi", margin, y);
  y += 6;
  const statusSummary = (["a_traiter", "contacte", "a_rappeler"] as CollectionFollowUpStatus[]).map(status => `${collectionFollowUpLabels[status]} : ${report.summary.statusCounts[status]}`).join("   |   ");
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${statusSummary}   |   Attribuées : ${report.summary.assignedCount}/${report.summary.openCount}`, margin, y);
  y += 12;

  doc.setTextColor(4, 72, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Créances ouvertes", margin, y);
  y += 7;
  addTableHeader([{ label: "FACTURE / CLIENT", x: margin + 2 }, { label: "SUIVI", x: margin + 73 }, { label: "RESPONSABLE", x: margin + 111 }, { label: "SOLDE", x: margin + 158 }]);
  if (!report.invoices.length) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Aucune créance ouverte à la génération du rapport.", margin + 2, y + 4);
    y += 11;
  }
  report.invoices.forEach(invoice => {
    const clientLines = doc.splitTextToSize(`${invoice.number} · ${invoice.clientName}`, 64) as string[];
    const ownerLines = doc.splitTextToSize(invoice.collectionOwnerName || "Non attribué", 39) as string[];
    const amountLines = doc.splitTextToSize(formatAmount(invoice.balanceDue), 27) as string[];
    const rowHeight = Math.max(10, clientLines.length * 4 + 5, ownerLines.length * 4 + 5, amountLines.length * 4 + 5);
    ensureSpace(rowHeight + 8);
    if (y === 48) addTableHeader([{ label: "FACTURE / CLIENT", x: margin + 2 }, { label: "SUIVI", x: margin + 73 }, { label: "RESPONSABLE", x: margin + 111 }, { label: "SOLDE", x: margin + 158 }]);
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(clientLines, margin + 2, y + 5);
    const [red, green, blue] = statusColors[invoice.collectionStatus];
    doc.setTextColor(red, green, blue);
    doc.setFont("helvetica", "bold");
    doc.text(collectionFollowUpLabels[invoice.collectionStatus], margin + 73, y + 5);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.text(ownerLines, margin + 111, y + 5);
    doc.setTextColor(invoice.isOverdue ? 185 : 4, invoice.isOverdue ? 28 : 72, invoice.isOverdue ? 28 : 52);
    doc.setFont("helvetica", "bold");
    doc.text(amountLines, margin + 158, y + 5);
    y += rowHeight;
  });

  ensureSpace(18);
  doc.setTextColor(4, 72, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Activités de ${formatMonth(report.month)}`, margin, y + 8);
  y += 15;
  addTableHeader([{ label: "DATE", x: margin + 2 }, { label: "CLIENT / FACTURE", x: margin + 34 }, { label: "ACTIVITÉ", x: margin + 88 }]);
  if (!report.activities.length) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Aucune activité de recouvrement enregistrée pour cette période.", margin + 2, y + 4);
    y += 11;
  }
  report.activities.forEach(activity => {
    const clientLines = doc.splitTextToSize(`${activity.clientName} · ${activity.documentNumber}`, 49) as string[];
    const activityLines = doc.splitTextToSize([activity.title, activity.description].filter(Boolean).join(" · "), 88) as string[];
    const rowHeight = Math.max(10, clientLines.length * 4 + 5, activityLines.length * 4 + 5);
    ensureSpace(rowHeight + 8);
    if (y === 48) addTableHeader([{ label: "DATE", x: margin + 2 }, { label: "CLIENT / FACTURE", x: margin + 34 }, { label: "ACTIVITÉ", x: margin + 88 }]);
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(formatDate(activity.occurredAt), margin + 2, y + 5);
    doc.setTextColor(31, 41, 55);
    doc.text(clientLines, margin + 34, y + 5);
    doc.text(activityLines, margin + 88, y + 5);
    y += rowHeight;
  });
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text("Rapport de pilotage interne · les relances restent soumises à validation humaine.", margin, pageHeight - 10);
  doc.save(`lucepress-recouvrement-${report.month}.pdf`);
}
