import { formatGnf } from "./billing";
import {
  formatCompanyBankLine,
  formatCompanyDocumentFooter,
  formatCompanyLegalLine,
  formatCompanyRegistrationLine,
  LUCEPRES_PUBLIC_PROFILE,
  type CompanyDocumentProfile,
} from "./companyProfile";
import { formatIdentityRegistrationLine } from "./identityPaperwork";
import { calculateQuotePaymentSchedule } from "./paymentSchedule";

export type DocumentTemplateLine = {
  description: string;
  quantity: number | string;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

export type DocumentTemplateData = {
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
  lines: DocumentTemplateLine[];
};

export type DocumentTemplateCompany = CompanyDocumentProfile & {
  legalName?: string | null;
  paymentInstructions?: string | null;
  documentFooter?: string | null;
};

export type DocumentTemplateFooter = {
  slogan: string;
  legalLine: string;
};

const BRAND = "#153f38";
const BRAND_DARK = "#0f2d28";
const BRAND_LIGHT = "#e8f2ee";
const ACCENT = "#d4a24e";
const ACCENT_SOFT = "#fbf3e2";
const ACCENT_LINE = "#ecd9a8";
const INK = "#243530";
const INK_SOFT = "#63706b";
const KICKER = "#4b746d";
const IVORY = "#fbf8f1";
const LINE = "#e4ddcb";
const CARD_BORDER = "#d8e7df";
const CARD_BG = "#f6faf8";
const TABLE_HEADER_BG = "#e8f2ee";
const TABLE_HEADER_TEXT = "#28534b";
const TABLE_BORDER = "#e2e8f0";
const ACCENT_DEEP = "#1e6051";
const SLATE_400 = "#94a3b8";
const FOOT_LEGAL = "#4a5752";
const WHITE = "#ffffff";

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-GN");
}

function fmtNumber(value: number): string {
  return new Intl.NumberFormat("fr-GN").format(value);
}

function fmtGnf(value: number): string {
  return formatGnf(value);
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function fmtGnfEscaped(value: number): string {
  return escapeHtml(fmtGnf(value));
}

function fmtNumberEscaped(value: number): string {
  return escapeHtml(fmtNumber(value));
}

const FOOT_LEGAL_DARK = "#3d4f49";
const FOOT_PAGINATION_BG = "#153f38";
const FOOT_PAGINATION_ACCENT = "#d4a24e";

function buildFooterHtml(footer: DocumentTemplateFooter): string {
  return `<!-- Pied de page -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
  <tr>
    <td style="height:4px;background:linear-gradient(90deg,${BRAND} 0%,${BRAND_DARK} 50%,${ACCENT} 100%);border-radius:2px;padding:0;font-size:0;line-height:0;">&nbsp;</td>
  </tr>
  <tr>
    <td style="padding:10px 0 4px 0;text-align:center;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-style:italic;font-weight:500;font-size:13px;color:${BRAND};letter-spacing:0.01em;">${escapeHtml(footer.slogan)}</td>
  </tr>
  <tr>
    <td style="padding:0 0 8px 0;text-align:center;font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:9.5px;color:${FOOT_LEGAL_DARK};line-height:1.6;">${escapeHtml(footer.legalLine)}</td>
  </tr>
  <tr>
    <td style="padding:0;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:separate;margin:0 auto;">
        <tr>
          <td style="background:${FOOT_PAGINATION_BG};color:${WHITE};font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:8.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 12px;border-radius:6px 0 0 6px;border:1px solid ${BRAND_DARK};">Page</td>
          <td style="background:${ACCENT_SOFT};color:${BRAND};font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:9px;font-weight:700;padding:4px 8px;border-top:1px solid ${ACCENT_LINE};border-bottom:1px solid ${ACCENT_LINE};">{{page}}</td>
          <td style="background:${ACCENT_SOFT};color:${FOOT_LEGAL_DARK};font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:9px;font-weight:600;padding:4px 8px;border-top:1px solid ${ACCENT_LINE};border-bottom:1px solid ${ACCENT_LINE};border-right:1px solid ${ACCENT_LINE};">/</td>
          <td style="background:${ACCENT_SOFT};color:${BRAND};font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:9px;font-weight:700;padding:4px 8px;border-radius:0 6px 6px 0;border:1px solid ${ACCENT_LINE};">{{total}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Pied de page ancré (reproduit sur chaque page par le moteur PDF).
 * Variables {{page}} / {{total}} sont substituées par PDFShift (et ignorées
 * par jsPDF qui ne les supporte pas — le pied de page jsPDF reste géré séparément).
 */
export function buildDocumentFooterHtml(footer: DocumentTemplateFooter): string {
  return buildFooterHtml(footer);
}

/**
 * Construit le HTML complet et autonome d'un document (devis/facture/reçu),
 * réplique exacte de l'aperçu rendu côté client (DocumentPreviewPage).
 * Utilise des tables HTML pour un rendu fiable quel que soit le moteur PDF.
 * Le pied de page est rendu via la classe .doc-footer (position fixed) et
 * aussi renvoyé séparément pour l'API footer des moteurs PDF externes.
 */
export function buildDocumentHtml(
  document: DocumentTemplateData,
  company: DocumentTemplateCompany = {},
  footer?: DocumentTemplateFooter,
): string {
  const companyName = company.legalName || LUCEPRES_PUBLIC_PROFILE.legalName;
  const kindLabel = document.kind === "facture" ? "Facture" : "Devis";
  const isInvoice = document.kind === "facture";

  const clientRegistrationLine = formatIdentityRegistrationLine({
    identityKind: document.clientIdentityKind,
    taxId: document.clientTaxId,
    registrationNumber: document.clientRegistrationNumber,
  });
  const bankLine = formatCompanyBankLine(company);
  const footerText = formatCompanyDocumentFooter(company.documentFooter);
  const legalLine = formatCompanyLegalLine(company);
  const regLine = formatCompanyRegistrationLine(company);
  const footerLegal = [legalLine, regLine].filter(Boolean).join(" · ") || `${companyName} · Conakry, République de Guinée`;
  const footerData: DocumentTemplateFooter = footer ?? { slogan: footerText, legalLine: footerLegal };

  const schedule = document.kind === "devis" && document.depositPercent ? calculateQuotePaymentSchedule(document.total, document.depositPercent) : null;

  // Lignes d'infos du document
  const infoRows: Array<[string, string]> = [
    ["Date d’émission", fmtDate(document.issueDate)],
    ...(document.kind === "devis" && document.validUntil ? [["Valide jusqu’au", fmtDate(document.validUntil)] as [string, string]] : []),
    ...(isInvoice && document.dueDate ? [["Échéance", fmtDate(document.dueDate)] as [string, string]] : []),
    ...(document.projectName ? [["Chantier", document.projectName] as [string, string]] : []),
  ];

  // Lignes du tableau
  const bodyRows = document.lines
    .map((line) => {
      const desc = escapeHtml(`${line.description} (${line.unit})`);
      return `      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid ${TABLE_BORDER};line-height:1.45;font-size:11px;color:${INK};">${desc}</td>
        <td style="padding:12px 8px;border-bottom:1px solid ${TABLE_BORDER};text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:11px;color:${INK_SOFT};">${escapeHtml(String(Number(line.quantity)))}</td>
        <td style="padding:12px 8px;border-bottom:1px solid ${TABLE_BORDER};text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:11px;color:${INK_SOFT};">${fmtNumberEscaped(line.unitPrice)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid ${TABLE_BORDER};text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:11px;font-weight:700;color:${INK};">${fmtNumberEscaped(line.lineTotal)}</td>
      </tr>`;
    })
    .join("\n");

  // Bloc totaux
  const totalRows = [
    `<tr><td style="padding:6px 0;font-size:12px;color:${INK_SOFT};">Sous-total</td><td style="padding:6px 0;text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:12px;color:${INK};">${fmtGnfEscaped(document.subtotal)}</td></tr>`,
    `<tr><td style="padding:6px 0;font-size:12px;color:${INK_SOFT};">Taxes</td><td style="padding:6px 0;text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:12px;color:${INK};">${fmtGnfEscaped(document.taxTotal)}</td></tr>`,
  ];
  if (document.discountAmount && document.discountAmount > 0) {
    totalRows.push(`<tr><td style="padding:6px 0;font-size:12px;color:${INK_SOFT};">Remise · ${escapeHtml(String(document.discountPercent ?? 0))}%</td><td style="padding:6px 0;text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:12px;color:${INK};">− ${fmtGnfEscaped(document.discountAmount)}</td></tr>`);
  }
  totalRows.push(`<tr><td style="padding:12px 0 8px 0;font-size:14px;font-weight:800;color:${BRAND};border-top:2px solid ${BRAND};">Total TTC</td><td style="padding:12px 0 8px 0;text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:14px;font-weight:800;color:${BRAND};border-top:2px solid ${BRAND};">${fmtGnfEscaped(document.total)}</td></tr>`);
  if (isInvoice) {
    totalRows.push(`<tr><td style="padding:4px 0;font-size:12px;color:${INK_SOFT};">Déjà encaissé</td><td style="padding:4px 0;text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:12px;color:${INK};">${fmtGnfEscaped(document.paidAmount ?? 0)}</td></tr>`);
    totalRows.push(`<tr><td style="padding:4px 0;font-size:12px;font-weight:800;color:${INK};">Solde dû</td><td style="padding:4px 0;text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:12px;font-weight:800;color:${BRAND};">${fmtGnfEscaped(document.balanceDue ?? 0)}</td></tr>`);
  } else if (document.kind === "devis") {
    totalRows.push(`<tr><td style="padding:4px 0;font-size:12px;font-weight:800;color:${INK};">Solde dû</td><td style="padding:4px 0;text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:12px;font-weight:800;color:${BRAND};">${fmtGnfEscaped(document.total)}</td></tr>`);
  }

  // Bandeau solde dû (facture)
  const dueBanner = isInvoice
    ? `      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:22px;">
        <tr>
          <td style="background:linear-gradient(135deg,${ACCENT_SOFT} 0%,${IVORY} 100%);border:1px solid ${ACCENT_LINE};border-radius:14px;padding:16px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${INK_SOFT};">Solde dû</td>
                <td style="text-align:right;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:22px;font-weight:800;color:${BRAND};">${fmtGnfEscaped(document.balanceDue ?? 0)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : "";

  // Échéancier (devis avec acompte)
  const scheduleBlock = schedule
    ? `      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:24px;">
        <tr><td style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:14px;padding:14px 16px;">
          <p style="margin:0 0 10px 0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:${KICKER};">Échéancier de règlement proposé</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:10px;">
                <p style="margin:0;font-size:11px;font-weight:800;color:${INK};">Acompte · ${escapeHtml(String(schedule.depositPercent))}%</p>
                <p style="margin:4px 0 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:13px;color:${ACCENT_DEEP};">${fmtGnfEscaped(schedule.depositAmount)}</p>
                ${document.depositDueDate ? `<p style="margin:4px 0 0 0;font-size:10px;color:${INK_SOFT};">Échéance : ${escapeHtml(fmtDate(document.depositDueDate))}</p>` : ""}
              </td>
              <td style="width:50%;vertical-align:top;padding-left:10px;">
                <p style="margin:0;font-size:11px;font-weight:800;color:${INK};">Solde · ${escapeHtml(String(schedule.balancePercent))}%</p>
                <p style="margin:4px 0 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:13px;color:${ACCENT_DEEP};">${fmtGnfEscaped(schedule.balanceAmount)}</p>
                ${document.balanceDueDate ? `<p style="margin:4px 0 0 0;font-size:10px;color:${INK_SOFT};">Échéance : ${escapeHtml(fmtDate(document.balanceDueDate))}</p>` : ""}
              </td>
            </tr>
          </table>
        </td></tr>
      </table>`
    : "";

  // Coordonnées + notes (deux colonnes)
  const bottomCards: string[] = [];
  if (bankLine) {
    const instr = company.paymentInstructions
      ? `<p style="margin:8px 0 0 0;white-space:pre-line;font-size:10px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(company.paymentInstructions)}</p>`
      : "";
    bottomCards.push(`          <td style="width:50%;vertical-align:top;padding-right:8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              <tr><td style="border:1px solid ${LINE};background:${IVORY};border-radius:14px;padding:14px 16px;">
                <p style="margin:0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${INK_SOFT};">Coordonnées de règlement</p>
                <p style="margin:8px 0 0 0;font-size:10px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(bankLine)}</p>
                ${instr}
              </td></tr>
            </table>
          </td>`);
  }
  if (document.notes) {
    bottomCards.push(`          <td style="width:50%;vertical-align:top;padding-left:8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
              <tr><td style="border:1px solid ${LINE};background:${IVORY};border-radius:14px;padding:14px 16px;">
                <p style="margin:0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${INK_SOFT};">Conditions &amp; garanties</p>
                <p style="margin:8px 0 0 0;white-space:pre-line;font-size:10px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(document.notes)}</p>
              </td></tr>
            </table>
          </td>`);
  }
  const bottomCardsBlock = bottomCards.length
    ? `      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:22px;">
        <tr>${bottomCards.join("")}</tr>
      </table>`
    : "";

  // Bandeau d'en-tête (hero gradient, reproduit à l'identique de l'aperçu)
  const hero = `    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_DARK} 100%);padding:36px 40px 32px 40px;color:${WHITE};font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;position:relative;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.75);">${escapeHtml(companyName)} · Hydraulique · Travaux · Services</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:22px;">
            <tr>
              <td style="vertical-align:bottom;">
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.24em;color:${ACCENT};">${escapeHtml(kindLabel)}</div>
                <div style="margin-top:8px;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;letter-spacing:-0.015em;color:${WHITE};line-height:1.2;">Votre ${escapeHtml(kindLabel.toLowerCase())} est disponible</div>
              </td>
              <td style="vertical-align:bottom;text-align:right;">
                <div style="font-size:11px;color:rgba(255,255,255,0.7);">N°</div>
                <div style="font-family:'JetBrains Mono','SF Mono',Menlo,Consolas,monospace;font-size:14px;font-weight:700;color:${WHITE};">${escapeHtml(document.number)}</div>
              </td>
            </tr>
          </table>
          <div style="position:absolute;left:0;right:0;bottom:0;height:5px;background:${ACCENT};"></div>
        </td>
      </tr>
    </table>`;

  // Bloc destinataire + infos
  const parties = `    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:50%;vertical-align:top;padding:32px 20px 16px 40px;font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${INK_SOFT};">Facturé à</div>
          <div style="margin-top:10px;font-size:15px;font-weight:700;color:${INK};">${escapeHtml(document.clientName)}</div>
          ${document.contactName ? `<div style="margin-top:2px;font-size:12px;color:${INK};">${escapeHtml(document.contactName)}</div>` : ""}
          ${document.clientAddress ? `<div style="margin-top:2px;white-space:pre-line;font-size:12px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(document.clientAddress)}</div>` : ""}
          ${document.clientEmail ? `<div style="margin-top:2px;font-size:12px;color:${INK_SOFT};">${escapeHtml(document.clientEmail)}</div>` : ""}
          ${clientRegistrationLine ? `<div style="margin-top:2px;font-size:12px;color:${INK_SOFT};">${escapeHtml(clientRegistrationLine)}</div>` : ""}
        </td>
        <td style="width:50%;vertical-align:top;padding:32px 40px 16px 20px;font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${INK_SOFT};">Détails du document</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:10px;border:1px solid ${LINE};border-radius:12px;overflow:hidden;background:${IVORY};">
            ${infoRows
              .map(
                ([label, value], i) =>
                  `            <tr><td style="padding:11px 18px;${i === infoRows.length - 1 ? "" : `border-bottom:1px solid ${LINE};`}font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${INK_SOFT};">${escapeHtml(label)}</td><td style="padding:11px 18px;${i === infoRows.length - 1 ? "" : `border-bottom:1px solid ${LINE};`}text-align:right;font-weight:700;color:${INK};font-size:12px;">${escapeHtml(value)}</td></tr>`,
              )
              .join("\n")}
          </table>
        </td>
      </tr>
    </table>`;

  // Tableau des prestations
  const itemsTable = `    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;padding:0 40px;">
      <tr><td style="padding:8px 0 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${TABLE_BORDER};border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:${TABLE_HEADER_BG};">
              <th style="padding:11px 14px;text-align:left;font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:${TABLE_HEADER_TEXT};width:50%;">Désignation</th>
              <th style="padding:11px 8px;text-align:right;font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:${TABLE_HEADER_TEXT};width:12%;">Qté</th>
              <th style="padding:11px 8px;text-align:right;font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:${TABLE_HEADER_TEXT};width:18%;">PU (GNF)</th>
              <th style="padding:11px 14px;text-align:right;font-family:'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:${TABLE_HEADER_TEXT};width:20%;">Total (GNF)</th>
            </tr>
          </thead>
          <tbody>
${bodyRows}
          </tbody>
        </table>
      </td></tr>
    </table>`;

  // Bloc totaux (aligné à droite)
  const totals = `    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:18px 40px 0 40px;" align="right">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:280px;margin-left:auto;">
          ${totalRows.join("\n")}
        </table>
      </td></tr>
    </table>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(document.number)} — ${escapeHtml(kindLabel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm 12mm 26mm 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color: ${INK};
    background: ${WHITE};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table { border-collapse: collapse; }
  .doc-footer { display: none; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
</style>
</head>
<body>
  <div class="doc-page">
${hero}
${parties}
    <div style="padding:0 40px;">
${dueBanner}
    </div>
${itemsTable}
${totals}
    <div style="padding:0 40px;">
${scheduleBlock}
${bottomCardsBlock}
    </div>
    <div class="doc-footer">${buildDocumentFooterHtml(footerData)}</div>
  </div>
</body>
</html>`;
}
