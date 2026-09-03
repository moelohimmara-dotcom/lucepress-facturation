import { jsPDF } from "jspdf";
import { formatGnf } from "../shared/billing";

type SharePdfLine = {
  description: string;
  quantity: number | string;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

type SharePdfDocument = {
  kind: "devis" | "facture";
  number: string;
  issueDate: Date | string;
  validUntil?: Date | string | null;
  dueDate?: Date | string | null;
  clientName: string;
  contactName?: string | null;
  clientAddress?: string | null;
  notes?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  lines: SharePdfLine[];
};

type SharePdfCompany = {
  legalName?: string | null;
  legalAddress?: string | null;
  phone?: string | null;
  email?: string | null;
};

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-GN");
}

/** PDF texte simple pour pièce jointe e-mail (sans rendu HTML serveur). */
export function buildDocumentSharePdfBuffer(document: SharePdfDocument, company: SharePdfCompany = {}): Buffer {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const kindLabel = document.kind === "facture" ? "Facture" : "Devis";
  let y = 18;
  const left = 16;
  const width = 178;

  const line = (text: string, size = 10, style: "normal" | "bold" = "normal") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    const rows = pdf.splitTextToSize(text, width) as string[];
    for (const row of rows) {
      if (y > 280) {
        pdf.addPage();
        y = 18;
      }
      pdf.text(row, left, y);
      y += size * 0.45 + 2;
    }
  };

  line(company.legalName || "Lucepres", 16, "bold");
  if (company.legalAddress) line(company.legalAddress, 9);
  if (company.phone || company.email) line([company.phone, company.email].filter(Boolean).join(" · "), 9);
  y += 4;
  line(`${kindLabel} ${document.number}`, 14, "bold");
  line(`Émis le ${fmtDate(document.issueDate)}`, 10);
  if (document.kind === "devis" && document.validUntil) line(`Valable jusqu’au ${fmtDate(document.validUntil)}`, 10);
  if (document.kind === "facture" && document.dueDate) line(`Échéance ${fmtDate(document.dueDate)}`, 10);
  y += 3;
  line("Destinataire", 11, "bold");
  line(document.clientName, 10, "bold");
  if (document.contactName) line(document.contactName, 10);
  if (document.clientAddress) line(document.clientAddress, 9);
  y += 3;
  line("Désignation", 11, "bold");
  for (const item of document.lines) {
    line(`${item.description} (${item.unit}) · qté ${Number(item.quantity)} · ${formatGnf(item.lineTotal)}`, 9);
  }
  y += 3;
  line(`Sous-total : ${formatGnf(document.subtotal)}`, 10);
  line(`Taxes : ${formatGnf(document.taxTotal)}`, 10);
  line(`Total TTC : ${formatGnf(document.total)}`, 12, "bold");
  if (document.notes) {
    y += 3;
    line("Notes", 11, "bold");
    line(document.notes, 9);
  }
  y += 6;
  line("Document généré par Lucepres Gestion.", 8);

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
