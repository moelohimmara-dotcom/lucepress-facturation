import {
  buildDocumentFooterHtml,
  buildDocumentHtml,
  type DocumentTemplateCompany,
  type DocumentTemplateData,
  type DocumentTemplateFooter,
} from "../shared/documentTemplate";
import {
  formatCompanyDocumentFooter,
  formatCompanyLegalLine,
  formatCompanyRegistrationLine,
  LUCEPRES_PUBLIC_PROFILE,
} from "../shared/companyProfile";
import { buildDocumentSharePdfBuffer, type SharePdfCompany, type SharePdfDocument } from "./documentSharePdf";

const PDFSHIFT_ENDPOINT = "https://api.pdfshift.io/v3/convert/pdf";

export type { DocumentTemplateData, DocumentTemplateCompany };

export type BuildPdfOptions = {
  document: DocumentTemplateData;
  company?: DocumentTemplateCompany;
};

function buildFooter(document: DocumentTemplateData, company: DocumentTemplateCompany = {}): DocumentTemplateFooter {
  const companyName = company.legalName || LUCEPRES_PUBLIC_PROFILE.legalName;
  const slogan = formatCompanyDocumentFooter(company.documentFooter);
  const legalLine =
    [formatCompanyLegalLine(company), formatCompanyRegistrationLine(company)].filter(Boolean).join(" · ") ||
    `${companyName} · Conakry, République de Guinée`;
  return { slogan, legalLine };
}

/**
 * Génère un PDF haute-fidélité d'un document Lucepress.
 *
 * - Si PDFSHIFT_API_KEY est défini → appel au microservice Chromium PDFShift
 *   (rendu identique à l'aperçu, pied de page répété sur chaque page, pagination).
 * - Sinon → repli sur le générateur jsPDF existant (rendu simplifié) afin que les
 *   tests, le local et les environnements sans clé continuent de produire un PDF
 *   valide (%PDF-), sans dépendance réseau.
 *
 * Le repli est volontairement silencieux côté test : la magie %PDF- reste garantie.
 */
export async function buildDocumentPdfBuffer(options: BuildPdfOptions): Promise<Buffer> {
  const { document, company = {} } = options;
  const apiKey = process.env.PDFSHIFT_API_KEY;

  if (!apiKey) {
    return buildDocumentSharePdfBuffer(document as SharePdfDocument, company as SharePdfCompany);
  }

  const footer = buildFooter(document, company);
  const html = buildDocumentHtml(document, company, footer);
  const footerHtml = buildDocumentFooterHtml(footer);

  const body = {
    source: html,
    format: "A4",
    landscape: false,
    margin: { top: "12mm", right: "12mm", bottom: "26mm", left: "12mm" },
    footer: {
      source: footerHtml,
      height: "22mm",
      start_at: 1,
    },
    sandbox: process.env.PDFSHIFT_SANDBOX === "1",
  };

  const res = await fetch(PDFSHIFT_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await safeErrorDetail(res);
    throw new Error(`PDFShift a renvoyé une erreur (${res.status}). ${detail}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/pdf")) {
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Réponse JSON : le PDF peut être base64 (champ data) ou une URL S3 (champ url).
  const payload = (await res.json().catch(() => null)) as { data?: string; url?: string } | null;
  if (payload?.data) {
    return Buffer.from(payload.data, "base64");
  }
  if (payload?.url) {
    const pdfRes = await fetch(payload.url);
    if (!pdfRes.ok) throw new Error(`Récupération du PDF PDFShift échouée (${pdfRes.status}).`);
    const arrayBuffer = await pdfRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error("Réponse PDFShift inattendue : ni PDF binaire, ni base64, ni URL.");
}

async function safeErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 280);
  } catch {
    return "";
  }
}

/** Indique si le moteur Chromium PDFShift est activé (clé présente). */
export function isPdfShiftConfigured(): boolean {
  return Boolean(process.env.PDFSHIFT_API_KEY);
}
