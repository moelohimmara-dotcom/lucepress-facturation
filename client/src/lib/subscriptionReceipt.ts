export type SubscriptionReceiptData = {
  invoiceNumber: string;
  tenantName: string;
  plan: string;
  amount: number;
  currency: string;
  paidAt: string;
  expiresAt: string;
  monerooPaymentId: string;
};

function formatAmount(value: number, currency: string) {
  return `${value.toLocaleString("fr-GN")} ${currency}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function downloadSubscriptionReceiptPdf(data: SubscriptionReceiptData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header
  doc.setFillColor(4, 72, 52);
  doc.rect(0, 0, pageWidth, 38, "F");
  doc.setFillColor(243, 212, 139);
  doc.circle(margin + 5, 15, 5, "F");
  doc.setTextColor(4, 72, 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("L", margin + 3.5, 17.5);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Lucepress", margin + 13, 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("SARL · SOLUTIONS DURABLES · CENTRE D'INTÉGRATIONS", margin + 13, 22);
  doc.setFontSize(7);
  doc.text(`Émis le ${new Date().toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}`, pageWidth - margin, 12, { align: "right" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Reçu de paiement — Abonnement", margin, 31);

  let y = 50;

  // Invoice number and status badge
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Reçu N° ${data.invoiceNumber}`, margin, y);
  doc.setFillColor(5, 115, 87);
  doc.roundedRect(pageWidth - margin - 30, y - 5, 30, 7, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text("PAYÉ", pageWidth - margin - 15, y - 0.5, { align: "center" });
  y += 12;

  // Client info box
  doc.setFillColor(243, 245, 241);
  doc.rect(margin, y, pageWidth - margin * 2, 22, "F");
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("CLIENT", margin + 4, y + 6);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.tenantName, margin + 4, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Référence paiement: ${data.monerooPaymentId}`, margin + 4, y + 18);
  y += 30;

  // Details table
  doc.setFillColor(243, 245, 241);
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("DESCRIPTION", margin + 2, y + 5);
  doc.text("PÉRIODE", margin + 90, y + 5);
  doc.text("MONTANT", pageWidth - margin - 2, y + 5, { align: "right" });
  y += 12;

  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(`Abonnement Lucepress ${data.plan === "pro" ? "Pro" : "Entreprise"} — mensuel`, 80) as string[];
  doc.text(descLines, margin + 2, y);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${formatDate(data.paidAt)} → ${formatDate(data.expiresAt)}`, margin + 90, y);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(formatAmount(data.amount, data.currency), pageWidth - margin - 2, y, { align: "right" });
  y += 10;

  // Total
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL PAYÉ", margin, y);
  doc.text(formatAmount(data.amount, data.currency), pageWidth - margin, y, { align: "right" });
  y += 14;

  // Footer
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Ce reçu confirme la réception de votre paiement d'abonnement Lucepress.", margin, y);
  y += 5;
  doc.text("Conservez ce document pour vos archives comptables.", margin, y);
  doc.text("Lucepress SARL · Conakry, République de Guinée", margin, pageHeight - 10);

  doc.save(`lucepress-recu-${data.invoiceNumber}.pdf`);
}
