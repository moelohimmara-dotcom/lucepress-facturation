import { describe, expect, it } from "vitest";
import { buildDocumentSharePdfBuffer, type SharePdfDocument } from "./documentSharePdf";
import { buildDocumentShareDocxBuffer } from "./documentShareDocx";

const sampleDoc: SharePdfDocument = {
  kind: "facture",
  number: "FAC-2026-0001",
  issueDate: "2026-09-13T00:00:00.000Z",
  dueDate: "2026-10-13T00:00:00.000Z",
  clientName: "Bati Guinée Sarl",
  contactName: "Mamadou Diallo",
  clientAddress: "Hamdallaye, Conakry",
  clientEmail: "contact@batiguinee.example",
  clientIdentityKind: "immatriculee",
  clientTaxId: "NIF12345",
  clientRegistrationNumber: "RCCM67890",
  projectName: "Forage Hamdallaye",
  notes: "Paiement par virement sous 30 jours.",
  subtotal: 5_000_000,
  taxTotal: 0,
  total: 5_000_000,
  paidAmount: 2_000_000,
  balanceDue: 3_000_000,
  lines: [
    { description: "Forage tubulaire", quantity: 1, unit: "pu", unitPrice: 4_000_000, lineTotal: 4_000_000 },
    { description: "Pompe immergée", quantity: 1, unit: "pu", unitPrice: 1_000_000, lineTotal: 1_000_000 },
  ],
};

const sampleQuote: SharePdfDocument = {
  kind: "devis",
  number: "DEV-2026-0002",
  issueDate: "2026-09-13T00:00:00.000Z",
  validUntil: "2026-10-13T00:00:00.000Z",
  clientName: "Construction Moderne",
  clientAddress: "Kipé, Conakry",
  subtotal: 10_000_000,
  taxTotal: 0,
  total: 10_000_000,
  depositPercent: 30,
  depositDueDate: "2026-09-20T00:00:00.000Z",
  balanceDueDate: "2026-10-20T00:00:00.000Z",
  lines: [
    { description: "Pompage solaire", quantity: 1, unit: "lot", unitPrice: 10_000_000, lineTotal: 10_000_000 },
  ],
};

const company = {
  legalName: "Lucepres Sarl",
  legalAddress: "Conakry, Guinée",
  phone: "+224 624 19 06 20",
  email: "Lucepres@gmail.com",
  bankName: "Ecobank",
  accountNumber: "SN99 0000 1234",
  paymentInstructions: "Virement bancaire uniquement.",
  documentFooter: "Solutions durables pour les communautés.",
};

describe("buildDocumentSharePdfBuffer", () => {
  it("génère un buffer PDF valide (en-tête %PDF-)", () => {
    const buf = buildDocumentSharePdfBuffer(sampleDoc, company);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("génère un PDF même sans entreprise fournie (fallback profil public)", () => {
    const buf = buildDocumentSharePdfBuffer(sampleDoc);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produit un PDF de devis avec échéancier", () => {
    const buf = buildDocumentSharePdfBuffer(sampleQuote, company);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("gère un document sans lignes", () => {
    const buf = buildDocumentSharePdfBuffer({ ...sampleDoc, lines: [] }, company);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("buildDocumentShareDocxBuffer", () => {
  it("génère un buffer DOCX valide (signature ZIP PK)", async () => {
    const buf = await buildDocumentShareDocxBuffer(sampleDoc, company);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("génère un DOCX de devis avec échéancier", async () => {
    const buf = await buildDocumentShareDocxBuffer(sampleQuote, company);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(buf.length).toBeGreaterThan(3000);
  });

  it("génère un DOCX sans entreprise fournie (fallback)", async () => {
    const buf = await buildDocumentShareDocxBuffer(sampleDoc);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
