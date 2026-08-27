export type ApprovalReportRow = {
  source: "Simulation locale" | "Demande interne";
  status: "En attente" | "Approuvée" | "Refusée";
  providerName: string;
  operation: string;
  createdAt: string;
  decidedAt?: string;
};

export type ApprovalReportFilters = {
  search: string;
  provider: string;
  status: string;
  decisionDate: string;
};

const statusColors: Record<ApprovalReportRow["status"], [number, number, number]> = {
  "En attente": [161, 98, 7],
  "Approuvée": [5, 115, 87],
  "Refusée": [190, 24, 93],
};

function humanizeFilter(value: string, labels: Record<string, string>) {
  return labels[value] ?? value;
}

export async function downloadApprovalReportPdf(rows: ApprovalReportRow[], filters: ApprovalReportFilters) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 0;

  const addHeader = () => {
    doc.setFillColor(4, 72, 52);
    doc.rect(0, 0, pageWidth, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Lucepress", margin, 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("SOLUTIONS DURABLES · CENTRE D’INTÉGRATIONS", margin, 22);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Rapport de synthèse des approbations", margin, 31);
    y = 48;
  };

  const addTableHeader = () => {
    doc.setFillColor(243, 245, 241);
    doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("STATUT", margin + 2, y + 5);
    doc.text("FOURNISSEUR", margin + 34, y + 5);
    doc.text("OPÉRATION", margin + 72, y + 5);
    doc.text("DATE", margin + 139, y + 5);
    y += 10;
  };

  addHeader();
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const summary = [
    `Demandes visibles : ${rows.length}`,
    `Fournisseur : ${humanizeFilter(filters.provider, { all: "Tous" })}`,
    `Statut : ${humanizeFilter(filters.status, { all: "Tous", pending: "En attente", approved: "Approuvées", rejected: "Refusées" })}`,
    `Décision : ${filters.decisionDate || "Toutes dates"}`,
  ];
  doc.text(summary.join("   |   "), margin, y);
  y += 8;
  if (filters.search.trim()) {
    doc.text(`Recherche : ${filters.search.trim()}`, margin, y);
    y += 8;
  }

  const pendingCount = rows.filter(row => row.status === "En attente").length;
  const approvedCount = rows.filter(row => row.status === "Approuvée").length;
  const rejectedCount = rows.filter(row => row.status === "Refusée").length;
  const cards = [["En attente", pendingCount], ["Approuvées", approvedCount], ["Refusées", rejectedCount]] as const;
  cards.forEach(([label, count], index) => {
    const x = margin + index * 57;
    doc.setFillColor(249, 250, 247);
    doc.setDrawColor(222, 228, 220);
    doc.rect(x, y, 52, 16, "FD");
    doc.setTextColor(4, 72, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(count), x + 4, y + 7);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(label, x + 4, y + 12);
  });
  y += 25;
  addTableHeader();

  rows.forEach(row => {
    const providerLines = doc.splitTextToSize(row.providerName, 34) as string[];
    const operationLines = doc.splitTextToSize(row.operation, 62) as string[];
    const dateLines = doc.splitTextToSize(row.decidedAt || row.createdAt, 30) as string[];
    const rowHeight = Math.max(10, providerLines.length * 4 + 5, operationLines.length * 4 + 5, dateLines.length * 4 + 5);
    if (y + rowHeight > pageHeight - 18) {
      doc.addPage();
      addHeader();
      addTableHeader();
    }
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    const [red, green, blue] = statusColors[row.status];
    doc.setTextColor(red, green, blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(row.status, margin + 2, y + 5);
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "normal");
    doc.text(providerLines, margin + 34, y + 5);
    doc.text(operationLines, margin + 72, y + 5);
    doc.setTextColor(100, 116, 139);
    doc.text(dateLines, margin + 139, y + 5);
    y += rowHeight;
  });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text("Rapport généré localement · aucune donnée externe n’a été transmise.", margin, pageHeight - 10);
  doc.save(`lucepress-approbations-${new Date().toISOString().slice(0, 10)}.pdf`);
}
