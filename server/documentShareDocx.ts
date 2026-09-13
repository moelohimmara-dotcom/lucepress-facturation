import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatGnf } from "../shared/billing";
import {
  formatCompanyBankLine,
  formatCompanyDocumentFooter,
  formatCompanyLegalLine,
  formatCompanyRegistrationLine,
  LUCEPRES_PUBLIC_PROFILE,
} from "../shared/companyProfile";
import { formatIdentityRegistrationLine } from "../shared/identityPaperwork";
import { calculateQuotePaymentSchedule } from "../shared/paymentSchedule";
import type { SharePdfCompany, SharePdfDocument, SharePdfLine } from "./documentSharePdf";

export type { SharePdfDocument as ShareDocxDocument, SharePdfLine as ShareDocxLine, SharePdfCompany as ShareDocxCompany } from "./documentSharePdf";

const BRAND = "153F38";
const ACCENT = "1E6051";
const KICKER = "4B746D";
const TABLE_HEADER_BG = "EEF5F1";
const TABLE_HEADER_TEXT = "28534B";
const CARD_BG = "F6FAF8";
const CARD_BORDER = "D8E7DF";
const BODY = "183A35";
const SLATE = "64748B";
const SLATE_LIGHT = "94A3B8";

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-GN");
}

function fmtNumber(value: number) {
  return new Intl.NumberFormat("fr-GN").format(value);
}

const brandBorder = { style: BorderStyle.SINGLE, size: 18, color: BRAND };
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

function kicker(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, bold: true, size: 14, color: KICKER, font: "Arial" })],
  });
}

function bodyRun(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, color: opts.color ?? BODY, size: opts.size ?? 18, font: "Calibri" });
}

function monoRun(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, color: opts.color ?? BODY, size: opts.size ?? 18, font: "Courier New" });
}

export async function buildDocumentShareDocxBuffer(document: SharePdfDocument, company: SharePdfCompany = {}): Promise<Buffer> {
  const companyName = company.legalName || LUCEPRES_PUBLIC_PROFILE.legalName;
  const kindLabel = document.kind === "facture" ? "Facture" : "Devis";
  const isInvoice = document.kind === "facture";

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      border: { bottom: brandBorder },
      spacing: { after: 120 },
      children: [
        new TextRun({ text: companyName, bold: true, size: 44, color: "FFFFFF", font: "Georgia" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "HYDRAULIQUE  ·  TRAVAUX  ·  SERVICES", bold: true, size: 14, color: "C0D0CC", font: "Arial" }),
        new TextRun({ text: "\t" }),
        new TextRun({ text: kindLabel, bold: true, size: 48, color: "FFFFFF", font: "Georgia" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: document.number, bold: true, size: 22, color: "D6E0DC", font: "Courier New" }),
      ],
    }),
  ];

  const clientRegLine = formatIdentityRegistrationLine({
    identityKind: document.clientIdentityKind,
    taxId: document.clientTaxId,
    registrationNumber: document.clientRegistrationNumber,
  });

  const recipientChildren: TextRun[] = [];
  recipientChildren.push(new TextRun({ text: document.clientName, bold: true, size: 22, color: BODY, font: "Calibri" }));
  recipientChildren.push(new TextRun({ text: "\n", font: "Calibri" }));
  if (document.contactName) { recipientChildren.push(new TextRun({ text: document.contactName, size: 18, color: BODY, font: "Calibri" })); recipientChildren.push(new TextRun({ text: "\n", font: "Calibri" })); }
  if (document.clientAddress) { recipientChildren.push(new TextRun({ text: document.clientAddress, size: 18, color: BODY, font: "Calibri" })); recipientChildren.push(new TextRun({ text: "\n", font: "Calibri" })); }
  if (document.clientEmail) { recipientChildren.push(new TextRun({ text: document.clientEmail, size: 18, color: BODY, font: "Calibri" })); recipientChildren.push(new TextRun({ text: "\n", font: "Calibri" })); }
  if (clientRegLine) { recipientChildren.push(new TextRun({ text: clientRegLine, size: 18, color: BODY, font: "Calibri" })); }

  const infoRows: Array<[string, string]> = [
    ["Date d’émission", fmtDate(document.issueDate)],
    ...(document.kind === "devis" && document.validUntil ? [["Valide jusqu’au", fmtDate(document.validUntil)] as [string, string]] : []),
    ...(isInvoice && document.dueDate ? [["Échéance", fmtDate(document.dueDate)] as [string, string]] : []),
    ...(document.projectName ? [["Chantier", document.projectName] as [string, string]] : []),
  ];

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            children: [
              kicker("DESTINATAIRE"),
              new Paragraph({ children: recipientChildren }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            children: [
              kicker("INFORMATIONS"),
              ...infoRows.map(([label, value]) => new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 40 },
                children: [
                  new TextRun({ text: `${label}  `, size: 18, color: SLATE, font: "Calibri" }),
                  new TextRun({ text: value, bold: true, size: 18, color: BODY, font: "Calibri" }),
                ],
              })),
            ],
          }),
        ],
      }),
    ],
  });

  const descColW = 50;
  const qtyColW = 12;
  const puColW = 18;
  const totalColW = 20;

  const headerCell = (text: string, widthPct: number, align: Align): TableCell => new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: TABLE_HEADER_BG },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, bold: true, size: 16, color: TABLE_HEADER_TEXT, font: "Arial" })],
    })],
  });

  const dataCell = (children: TextRun[], widthPct: number, align: Align): TableCell => new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: { top: thinBorder, bottom: thinBorder, left: noBorder, right: noBorder },
    children: [new Paragraph({ alignment: align, children })],
  });

  const lineRows: TableRow[] = document.lines.map((line: SharePdfLine) => new TableRow({
    children: [
      dataCell([bodyRun(`${line.description} (${line.unit})`)], descColW, AlignmentType.LEFT),
      dataCell([monoRun(String(Number(line.quantity)))], qtyColW, AlignmentType.RIGHT),
      dataCell([monoRun(fmtNumber(line.unitPrice))], puColW, AlignmentType.RIGHT),
      dataCell([monoRun(fmtNumber(line.lineTotal), { bold: true })], totalColW, AlignmentType.RIGHT),
    ],
  }));

  const lineTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("DÉSIGNATION", descColW, AlignmentType.LEFT),
          headerCell("QTÉ", qtyColW, AlignmentType.RIGHT),
          headerCell("PU (GNF)", puColW, AlignmentType.RIGHT),
          headerCell("TOTAL (GNF)", totalColW, AlignmentType.RIGHT),
        ],
      }),
      ...lineRows,
    ],
  });

  const totalRow = (label: string, value: string, opts: { bold?: boolean; accent?: boolean; big?: boolean } = {}): Paragraph => new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: opts.big ? 60 : 30 },
    children: [
      new TextRun({ text: `${label}  `, bold: opts.bold, size: opts.big ? 24 : 18, color: opts.accent ? ACCENT : SLATE, font: "Calibri" }),
      new TextRun({ text: value, bold: opts.bold, size: opts.big ? 24 : 18, color: opts.accent ? ACCENT : BODY, font: "Courier New" }),
    ],
  });

  const totalsParagraphs: Paragraph[] = [
    new Paragraph({ spacing: { before: 120 }, children: [] }),
    totalRow("Sous-total", formatGnf(document.subtotal)),
    totalRow("Taxes", formatGnf(document.taxTotal)),
  ];
  if (document.discountAmount && document.discountAmount > 0) {
    totalsParagraphs.push(totalRow(`Remise · ${document.discountPercent ?? 0}%`, `− ${formatGnf(document.discountAmount)}`));
  }
  totalsParagraphs.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND } },
    spacing: { after: 40 },
    children: [],
  }));
  totalsParagraphs.push(totalRow("Total TTC", formatGnf(document.total), { bold: true, accent: true, big: true }));
  if (isInvoice) {
    totalsParagraphs.push(totalRow("Déjà encaissé", formatGnf(document.paidAmount ?? 0)));
    totalsParagraphs.push(totalRow("Solde dû", formatGnf(document.balanceDue ?? 0), { bold: true, accent: true }));
  }

  const afterTable: Array<Paragraph | Table> = [...totalsParagraphs];

  if (document.kind === "devis" && document.depositPercent) {
    const schedule = calculateQuotePaymentSchedule(document.total, document.depositPercent);
    if (schedule) {
      const scheduleTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
          left: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
          right: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
          insideHorizontal: noBorder, insideVertical: noBorder,
        },
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: CARD_BG },
              children: [
                kicker("ÉCHÉANCIER DE RÈGLEMENT PROPOSÉ"),
                new Paragraph({ spacing: { before: 60 }, children: [bodyRun(`Acompte · ${schedule.depositPercent}%`, { bold: true, size: 18 })] }),
                new Paragraph({ children: [monoRun(formatGnf(schedule.depositAmount), { bold: true, color: ACCENT, size: 22 })] }),
                ...(document.depositDueDate ? [new Paragraph({ children: [bodyRun(`Échéance : ${fmtDate(document.depositDueDate)}`, { color: SLATE, size: 16 })] })] : []),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, color: "auto", fill: CARD_BG },
              children: [
                new Paragraph({ spacing: { after: 80 }, children: [] }),
                new Paragraph({ children: [bodyRun(`Solde · ${schedule.balancePercent}%`, { bold: true, size: 18 })] }),
                new Paragraph({ children: [monoRun(formatGnf(schedule.balanceAmount), { bold: true, color: ACCENT, size: 22 })] }),
                ...(document.balanceDueDate ? [new Paragraph({ children: [bodyRun(`Échéance : ${fmtDate(document.balanceDueDate)}`, { color: SLATE, size: 16 })] })] : []),
              ],
            }),
          ],
        })],
      });
      afterTable.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
      afterTable.push(scheduleTable);
    }
  }

  const bankLine = formatCompanyBankLine(company);
  if (bankLine) {
    const bankChildren: TextRun[] = [new TextRun({ text: bankLine, size: 17, color: SLATE, font: "Calibri" })];
    if (company.paymentInstructions) {
      bankChildren.push(new TextRun({ text: "\n", font: "Calibri" }));
      bankChildren.push(new TextRun({ text: company.paymentInstructions, size: 17, color: SLATE, font: "Calibri" }));
    }
    afterTable.push(new Paragraph({ spacing: { before: 160 }, children: [] }));
    afterTable.push(buildCard("COORDONNÉES DE RÈGLEMENT", [new Paragraph({ children: bankChildren })]));
  }

  if (document.notes) {
    afterTable.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
    afterTable.push(buildCard("CONDITIONS ET NOTES", [new Paragraph({ children: [new TextRun({ text: document.notes, size: 18, color: SLATE, font: "Calibri" })] })]));
  }

  const footerChildren: TextRun[] = [new TextRun({ text: formatCompanyDocumentFooter(company.documentFooter), size: 15, color: SLATE_LIGHT, font: "Calibri" })];
  const legalLine = formatCompanyLegalLine(company);
  if (legalLine) { footerChildren.push(new TextRun({ text: "\n", font: "Calibri" })); footerChildren.push(new TextRun({ text: legalLine, size: 15, color: SLATE_LIGHT, font: "Calibri" })); }
  const regLine = formatCompanyRegistrationLine(company);
  if (regLine) { footerChildren.push(new TextRun({ text: "\n", font: "Calibri" })); footerChildren.push(new TextRun({ text: regLine, size: 15, color: SLATE_LIGHT, font: "Calibri" })); }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        ...headerParagraphs,
        infoTable,
        new Paragraph({ spacing: { before: 120 }, children: [] }),
        lineTable,
        ...afterTable,
        new Paragraph({ spacing: { before: 240 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: thinBorder },
          spacing: { before: 120 },
          children: footerChildren,
        }),
      ],
    }],
  });

  const packed = await Packer.toBuffer(doc);
  return Buffer.from(packed);
}

function buildCard(title: string, contentParagraphs: Array<Paragraph | Table>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
      left: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
      right: { style: BorderStyle.SINGLE, size: 4, color: CARD_BORDER },
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: CARD_BG },
        children: [kicker(title), ...contentParagraphs],
      })],
    })],
  });
}
