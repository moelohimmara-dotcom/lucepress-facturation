import { jsPDF } from "jspdf";
import { formatGnf } from "../shared/billing";
import {
  formatCompanyBankLine,
  formatCompanyDocumentFooter,
  formatCompanyLegalLine,
  formatCompanyRegistrationLine,
  LUCEPRES_PUBLIC_PROFILE,
  type CompanyDocumentProfile,
} from "../shared/companyProfile";
import { formatIdentityRegistrationLine } from "../shared/identityPaperwork";
import { calculateQuotePaymentSchedule } from "../shared/paymentSchedule";

export type SharePdfLine = {
  description: string;
  quantity: number | string;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

export type SharePdfDocument = {
  kind: "devis" | "facture";
  number: string;
  issueDate: Date | string;
  validUntil?: Date | string | null;
  dueDate?: Date | string | null;
  clientName: string;
  contactName?: string | null;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientIdentityKind?: string | null;
  clientTaxId?: string | null;
  clientRegistrationNumber?: string | null;
  projectName?: string | null;
  notes?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
  depositPercent?: number | null;
  depositDueDate?: Date | string | null;
  balanceDueDate?: Date | string | null;
  paidAmount?: number | null;
  balanceDue?: number | null;
  lines: SharePdfLine[];
};

export type SharePdfCompany = CompanyDocumentProfile & {
  legalName?: string | null;
  paymentInstructions?: string | null;
  documentFooter?: string | null;
};

const COLOR = {
  brand: [21, 63, 56] as [number, number, number],
  brandDeep: [17, 59, 53] as [number, number, number],
  accent: [30, 96, 81] as [number, number, number],
  kicker: [75, 116, 109] as [number, number, number],
  tableHeaderBg: [238, 245, 241] as [number, number, number],
  tableHeaderText: [40, 83, 75] as [number, number, number],
  cardBg: [246, 250, 248] as [number, number, number],
  cardBorder: [216, 231, 223] as [number, number, number],
  notesBg: [248, 250, 249] as [number, number, number],
  body: [24, 58, 53] as [number, number, number],
  slate: [100, 116, 139] as [number, number, number],
  slateLight: [148, 163, 184] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  brandTint: [214, 224, 220] as [number, number, number],
};

const FONT = { serif: "times", sans: "helvetica", mono: "courier" } as const;
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-GN");
}

function fmtNumber(value: number) {
  return new Intl.NumberFormat("fr-GN").format(value).replace(/[\u202f\u00a0]/g, " ");
}

function fmtGnf(value: number) {
  return formatGnf(value).replace(/[\u202f\u00a0]/g, " ");
}

function setPageBackground(pdf: jsPDF) {
  pdf.setFillColor(...COLOR.white);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
}

export function buildDocumentSharePdfBuffer(document: SharePdfDocument, company: SharePdfCompany = {}): Buffer {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setPageBackground(pdf);

  const state = { y: MARGIN, page: 1 };

  const ensureSpace = (needed: number) => {
    if (state.y + needed > PAGE_H - MARGIN - 18) {
      pdf.addPage();
      setPageBackground(pdf);
      state.page += 1;
      state.y = MARGIN;
    }
  };

  const companyName = company.legalName || LUCEPRES_PUBLIC_PROFILE.legalName;
  const kindLabel = document.kind === "facture" ? "Facture" : "Devis";
  const isInvoice = document.kind === "facture";

  const headerBottom = 34;
  pdf.setFillColor(...COLOR.brand);
  pdf.rect(0, 0, PAGE_W, headerBottom, "F");

  pdf.setTextColor(...COLOR.white);
  pdf.setFont(FONT.serif, "bold");
  pdf.setFontSize(22);
  pdf.text(companyName, MARGIN, 16);

  pdf.setFont(FONT.sans, "bold");
  pdf.setFontSize(8);
  pdf.text("HYDRAULIQUE  ·  TRAVAUX  ·  SERVICES", MARGIN, 22);

  pdf.setFont(FONT.serif, "bold");
  pdf.setFontSize(24);
  pdf.text(kindLabel, PAGE_W - MARGIN, 16, { align: "right" });

  pdf.setFont(FONT.mono, "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...COLOR.brandTint);
  pdf.text(document.number, PAGE_W - MARGIN, 23, { align: "right" });

  state.y = headerBottom + 10;

  const colW = CONTENT_W / 2;
  const leftColX = MARGIN;
  const rightColX = MARGIN + colW;

  pdf.setTextColor(...COLOR.kicker);
  pdf.setFont(FONT.sans, "bold");
  pdf.setFontSize(7.5);
  pdf.text("DESTINATAIRE", leftColX, state.y);

  pdf.setTextColor(...COLOR.body);
  pdf.setFont(FONT.sans, "bold");
  pdf.setFontSize(11);
  pdf.text(document.clientName, leftColX, state.y + 6);
  let dy = state.y + 11;
  pdf.setFont(FONT.sans, "normal");
  pdf.setFontSize(9);
  if (document.contactName) { pdf.text(document.contactName, leftColX, dy); dy += 5; }
  if (document.clientAddress) {
    const addrRows = pdf.splitTextToSize(document.clientAddress, colW - 4) as string[];
    for (const row of addrRows) { pdf.text(row, leftColX, dy); dy += 5; }
  }
  if (document.clientEmail) { pdf.text(document.clientEmail, leftColX, dy); dy += 5; }
  const clientRegLine = formatIdentityRegistrationLine({
    identityKind: document.clientIdentityKind,
    taxId: document.clientTaxId,
    registrationNumber: document.clientRegistrationNumber,
  });
  if (clientRegLine) { pdf.text(clientRegLine, leftColX, dy); dy += 5; }

  pdf.setTextColor(...COLOR.kicker);
  pdf.setFont(FONT.sans, "bold");
  pdf.setFontSize(7.5);
  pdf.text("INFORMATIONS", rightColX, state.y);

  pdf.setFont(FONT.sans, "normal");
  pdf.setFontSize(9);
  const infoRows: Array<[string, string]> = [
    ["Date d’émission", fmtDate(document.issueDate)],
    ...(document.kind === "devis" && document.validUntil ? [["Valide jusqu’au", fmtDate(document.validUntil)] as [string, string]] : []),
    ...(isInvoice && document.dueDate ? [["Échéance", fmtDate(document.dueDate)] as [string, string]] : []),
    ...(document.projectName ? [["Chantier", document.projectName] as [string, string]] : []),
  ];
  let infoY = state.y + 6;
  for (const [label, value] of infoRows) {
    pdf.setTextColor(...COLOR.slate);
    pdf.setFont(FONT.sans, "normal");
    pdf.text(label, rightColX, infoY);
    pdf.setTextColor(...COLOR.body);
    pdf.setFont(FONT.sans, "bold");
    pdf.text(value, PAGE_W - MARGIN, infoY, { align: "right" });
    infoY += 5.5;
  }

  state.y = Math.max(dy, infoY) + 8;

  const descColW = CONTENT_W * 0.50;
  const qtyColW = CONTENT_W * 0.12;
  const puColW = CONTENT_W * 0.18;
  const colStartX = [MARGIN, MARGIN + descColW, MARGIN + descColW + qtyColW, MARGIN + descColW + qtyColW + puColW];
  const colEndX = [colStartX[1], colStartX[2], colStartX[3], PAGE_W - MARGIN];
  const tableTop = state.y;
  const rowH = 7;
  const headerH = 8;

  pdf.setFillColor(...COLOR.tableHeaderBg);
  pdf.setDrawColor(...COLOR.cardBorder);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(MARGIN, tableTop, CONTENT_W, headerH, 1.5, 1.5, "FD");
  pdf.setTextColor(...COLOR.tableHeaderText);
  pdf.setFont(FONT.sans, "bold");
  pdf.setFontSize(8);
  pdf.text("DÉSIGNATION", colStartX[0] + 3, tableTop + 5.3);
  pdf.text("QTÉ", colEndX[1] - 2, tableTop + 5.3, { align: "right" });
  pdf.text("PU (GNF)", colEndX[2] - 2, tableTop + 5.3, { align: "right" });
  pdf.text("TOTAL (GNF)", colEndX[3] - 2, tableTop + 5.3, { align: "right" });

  let rowY = tableTop + headerH;
  pdf.setFont(FONT.sans, "normal");
  pdf.setFontSize(8.5);
  for (const line of document.lines) {
    const descText = `${line.description} (${line.unit})`;
    const descRows = pdf.splitTextToSize(descText, descColW - 6) as string[];
    const cellH = Math.max(rowH, descRows.length * 4.2 + 2);
    ensureSpace(cellH);
    pdf.setDrawColor(...COLOR.cardBorder);
    pdf.setLineWidth(0.1);
    pdf.line(MARGIN, rowY, PAGE_W - MARGIN, rowY);

    pdf.setTextColor(...COLOR.body);
    pdf.setFont(FONT.sans, "normal");
    const descBlockH = descRows.length * 4.2;
    let textY = rowY + (cellH - descBlockH) / 2 + 3.5;
    for (const row of descRows) {
      pdf.text(row, colStartX[0] + 3, textY);
      textY += 4.2;
    }

    const midY = rowY + cellH / 2 + 1.5;
    pdf.setFont(FONT.mono, "normal");
    pdf.text(String(Number(line.quantity)), colEndX[1] - 2, midY, { align: "right" });
    pdf.text(fmtNumber(line.unitPrice), colEndX[2] - 2, midY, { align: "right" });
    pdf.setFont(FONT.mono, "bold");
    pdf.text(fmtNumber(line.lineTotal), colEndX[3] - 2, midY, { align: "right" });
    pdf.setFont(FONT.sans, "normal");

    rowY += cellH;
  }
  pdf.setLineWidth(0.2);
  pdf.setDrawColor(...COLOR.brand);
  pdf.line(MARGIN, rowY, PAGE_W - MARGIN, rowY);
  pdf.setDrawColor(...COLOR.cardBorder);
  pdf.setLineWidth(0.05);
  pdf.line(colStartX[1], tableTop, colStartX[1], rowY);
  pdf.line(colStartX[2], tableTop, colStartX[2], rowY);
  pdf.line(colStartX[3], tableTop, colStartX[3], rowY);
  state.y = rowY + 8;

  const totalsBoxW = 78;
  const totalsX = PAGE_W - MARGIN - totalsBoxW;
  const drawTotalsRow = (label: string, value: string, opts: { bold?: boolean; accent?: boolean; big?: boolean } = {}) => {
    ensureSpace(7);
    pdf.setFont(FONT.sans, opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.big ? 12 : 9);
    pdf.setTextColor(...(opts.accent ? COLOR.accent : COLOR.slate));
    pdf.text(label, totalsX, state.y);
    pdf.setFont(FONT.mono, opts.bold ? "bold" : "normal");
    pdf.setTextColor(...(opts.accent ? COLOR.accent : COLOR.body));
    pdf.text(value, PAGE_W - MARGIN, state.y, { align: "right" });
    state.y += opts.big ? 7 : 5.5;
  };

  drawTotalsRow("Sous-total", fmtGnf(document.subtotal));
  drawTotalsRow("Taxes", fmtGnf(document.taxTotal));
  if (document.discountAmount && document.discountAmount > 0) {
    drawTotalsRow(`Remise · ${document.discountPercent ?? 0}%`, `− ${fmtGnf(document.discountAmount)}`);
  }
  pdf.setDrawColor(...COLOR.brand);
  pdf.setLineWidth(0.2);
  pdf.line(totalsX, state.y - 2, PAGE_W - MARGIN, state.y - 2);
  drawTotalsRow("Total TTC", fmtGnf(document.total), { bold: true, accent: true, big: true });
  if (isInvoice) {
    drawTotalsRow("Déjà encaissé", fmtGnf(document.paidAmount ?? 0));
    drawTotalsRow("Solde dû", fmtGnf(document.balanceDue ?? 0), { bold: true, accent: true });
  }
  state.y += 6;

  if (document.kind === "devis" && document.depositPercent) {
    const schedule = calculateQuotePaymentSchedule(document.total, document.depositPercent);
    if (schedule) {
      ensureSpace(26);
      drawCard(pdf, state.y, 22, (cx, cy) => {
        pdf.setTextColor(...COLOR.kicker);
        pdf.setFont(FONT.sans, "bold");
        pdf.setFontSize(7.5);
        pdf.text("ÉCHÉANCIER DE RÈGLEMENT PROPOSÉ", cx, cy + 5);
        const halfW = (CONTENT_W - 8) / 2;
        pdf.setTextColor(...COLOR.body);
        pdf.setFont(FONT.sans, "bold");
        pdf.setFontSize(9);
        pdf.text(`Acompte · ${schedule.depositPercent}%`, cx, cy + 11);
        pdf.setFont(FONT.mono, "bold");
        pdf.setTextColor(...COLOR.accent);
        pdf.setFontSize(11);
        pdf.text(fmtGnf(schedule.depositAmount), cx, cy + 16);
        if (document.depositDueDate) {
          pdf.setFont(FONT.sans, "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(...COLOR.slate);
          pdf.text(`Échéance : ${fmtDate(document.depositDueDate)}`, cx, cy + 20);
        }
        const cx2 = cx + halfW;
        pdf.setTextColor(...COLOR.body);
        pdf.setFont(FONT.sans, "bold");
        pdf.setFontSize(9);
        pdf.text(`Solde · ${schedule.balancePercent}%`, cx2, cy + 11);
        pdf.setFont(FONT.mono, "bold");
        pdf.setTextColor(...COLOR.accent);
        pdf.setFontSize(11);
        pdf.text(fmtGnf(schedule.balanceAmount), cx2, cy + 16);
        if (document.balanceDueDate) {
          pdf.setFont(FONT.sans, "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(...COLOR.slate);
          pdf.text(`Échéance : ${fmtDate(document.balanceDueDate)}`, cx2, cy + 20);
        }
      });
      state.y += 28;
    }
  }

  const bankLine = formatCompanyBankLine(company);
  if (bankLine) {
    ensureSpace(20);
    pdf.setFont(FONT.sans, "normal");
    pdf.setFontSize(8.5);
    const bankRows = pdf.splitTextToSize(bankLine, CONTENT_W - 12) as string[];
    const instrRows = company.paymentInstructions ? pdf.splitTextToSize(company.paymentInstructions, CONTENT_W - 12) as string[] : [];
    const cardH = 8 + bankRows.length * 4.5 + (instrRows.length ? 4 + instrRows.length * 4.5 : 0) + 4;
    drawCard(pdf, state.y, cardH, (cx, cy) => {
      pdf.setTextColor(...COLOR.kicker);
      pdf.setFont(FONT.sans, "bold");
      pdf.setFontSize(7.5);
      pdf.text("COORDONNÉES DE RÈGLEMENT", cx, cy + 5);
      pdf.setTextColor(...COLOR.slate);
      pdf.setFont(FONT.sans, "normal");
      pdf.setFontSize(8.5);
      let by = cy + 10;
      for (const row of bankRows) { pdf.text(row, cx, by); by += 4.5; }
      if (instrRows.length) {
        by += 2;
        for (const row of instrRows) { pdf.text(row, cx, by); by += 4.5; }
      }
    });
    state.y += cardH + 6;
  }

  if (document.notes) {
    ensureSpace(20);
    pdf.setFont(FONT.sans, "normal");
    pdf.setFontSize(9);
    const noteRows = pdf.splitTextToSize(document.notes, CONTENT_W - 12) as string[];
    const cardH = 8 + noteRows.length * 4.8 + 4;
    drawCard(pdf, state.y, cardH, (cx, cy) => {
      pdf.setTextColor(...COLOR.kicker);
      pdf.setFont(FONT.sans, "bold");
      pdf.setFontSize(7.5);
      pdf.text("CONDITIONS ET NOTES", cx, cy + 5);
      pdf.setTextColor(...COLOR.slate);
      pdf.setFont(FONT.sans, "normal");
      pdf.setFontSize(9);
      let ny = cy + 10;
      for (const row of noteRows) { pdf.text(row, cx, ny); ny += 4.8; }
    });
    state.y += cardH + 6;
  }

  const footerText = formatCompanyDocumentFooter(company.documentFooter);
  const legalLine = formatCompanyLegalLine(company);
  const regLine = formatCompanyRegistrationLine(company);
  const footerH = 4 + (legalLine || regLine ? 7 : 0) + 2;
  ensureSpace(footerH);
  pdf.setDrawColor(...COLOR.accent);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN, state.y, MARGIN + 22, state.y);
  state.y += 4.5;
  pdf.setFont(FONT.serif, "italic");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...COLOR.brand);
  pdf.text(footerText, PAGE_W / 2, state.y, { align: "center" });
  if (legalLine || regLine) {
    state.y += 5.5;
    ensureSpace(5);
    pdf.setDrawColor(...COLOR.cardBorder);
    pdf.setLineWidth(0.1);
    pdf.line(MARGIN, state.y - 2, PAGE_W - MARGIN, state.y - 2);
    pdf.setFont(FONT.sans, "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...COLOR.slateLight);
    pdf.text(legalLine || "", MARGIN, state.y);
    if (regLine) pdf.text(regLine, PAGE_W - MARGIN, state.y, { align: "right" });
  }

  const arrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function drawCard(pdf: jsPDF, y: number, height: number, render: (x: number, y: number) => void) {
  pdf.setFillColor(...COLOR.cardBg);
  pdf.setDrawColor(...COLOR.cardBorder);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(MARGIN, y, CONTENT_W, height, 1.5, 1.5, "FD");
  render(MARGIN + 4, y);
}
