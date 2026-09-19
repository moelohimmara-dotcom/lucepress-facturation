import { TRPCError } from "@trpc/server";
import { LUCEPRES_PUBLIC_PROFILE } from "../shared/companyProfile";
import * as db from "./db";

export type BootstrapDemoResult = {
  alreadySeeded: boolean;
  clientId?: number;
  projectId?: number;
  quoteId?: number;
  quoteNumber?: string;
  depositInvoiceId?: number;
  depositInvoiceNumber?: string;
  overdueInvoiceId?: number;
  overdueInvoiceNumber?: string;
};

function isoDaysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function bootstrapDemoDataset(actorId: number): Promise<BootstrapDemoResult> {
  const clients = await db.listClients();
  if (clients.length > 0) {
    return { alreadySeeded: true };
  }

  const company = await db.getCompanySettings();
  if (!company.id) {
    await db.saveCompanySettings({
      legalName: LUCEPRES_PUBLIC_PROFILE.legalName,
      legalAddress: "Kaloum, Conakry, Guinée",
      phone: LUCEPRES_PUBLIC_PROFILE.phone,
      email: LUCEPRES_PUBLIC_PROFILE.email,
      website: "",
      identityKind: "immatriculee",
      taxId: "NIF-DEMO-001",
      registrationNumber: "RCCM-DEMO-GN-001",
      bankName: "BICIGUI",
      accountName: LUCEPRES_PUBLIC_PROFILE.legalName,
      accountNumber: "00123456789",
      iban: "",
      swift: "BICIGUIX",
      paymentInstructions: "Virement GNF ou Mobile Money (Orange Money / MTN). Référence = numéro de facture.",
      documentFooter: LUCEPRES_PUBLIC_PROFILE.documentFooter,
    });
  }

  const client = await db.createClient({
    companyName: "Client Demo Kaloum SARL",
    contactName: "Aïssatou Diallo",
    email: "demo.kaloum@example.gn",
    phone: "+224 620 00 00 01",
    address: "Quartier Almamya, Kaloum, Conakry",
    identityKind: "immatriculee",
    taxId: "NIF-CLIENT-DEMO",
    notes: "Jeu demo Lucepress — bootstrap produit.",
  });

  const project = await db.createProject({
    clientId: client.id,
    name: "Forage demo Kaloum",
    reference: "DEMO-FOR-001",
    type: "forage",
    location: "Kaloum, Conakry",
    description: "Chantier demo — forage et raccordement hydraulique.",
  });
  await db.updateProjectPlannedBudget({ id: project.id, plannedBudget: 45_000_000 });

  const issueDate = isoDaysFromNow(-10);
  const quote = await db.createDocument({
    kind: "devis",
    clientId: client.id,
    projectId: project.id,
    status: "brouillon",
    issueDate,
    dueDate: isoDaysFromNow(20),
    validUntil: isoDaysFromNow(30),
    depositPercent: 30,
    depositDueDate: isoDaysFromNow(-3),
    balanceDueDate: isoDaysFromNow(20),
    notes: "Devis demo — forage et installation.",
    createdById: actorId,
    lines: [
      {
        description: "Forage et tubage — lot demo",
        quantity: 1,
        unit: "forfait",
        unitPrice: 18_000_000,
        taxRate: 0,
      },
      {
        description: "Pompe immergée et raccordements — lot demo",
        quantity: 1,
        unit: "forfait",
        unitPrice: 7_500_000,
        taxRate: 0,
      },
    ],
  });

  await db.updateDocumentStatus(quote.id, "envoye", actorId, {
    title: "Devis demo envoyé",
    description: quote.number,
  });
  await db.updateDocumentStatus(quote.id, "accepte", actorId, {
    title: "Devis demo accepté",
    description: quote.number,
  });

  const deposit = await db.createDepositInvoiceFromQuote(quote.id, actorId);
  await db.updateDocumentStatus(deposit.id, "envoye", actorId);
  const depositDoc = await db.getDocumentById(deposit.id);
  if (!depositDoc) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Facture d’acompte demo introuvable après création." });
  }
  await db.recordPayment({
    documentId: deposit.id,
    amount: depositDoc.total,
    paidAt: isoDaysFromNow(-2),
    method: "mobile_money",
    reference: "OM-DEMO-001",
    notes: "Paiement demo acompte",
    createdById: actorId,
  });

  const overdue = await db.createDocument({
    kind: "facture",
    clientId: client.id,
    projectId: project.id,
    status: "envoye",
    issueDate: isoDaysFromNow(-40),
    dueDate: isoDaysFromNow(-15),
    notes: "Facture demo en retard — suivi créances.",
    createdById: actorId,
    lines: [
      {
        description: "Maintenance préventive demo",
        quantity: 1,
        unit: "forfait",
        unitPrice: 2_400_000,
        taxRate: 0,
      },
    ],
  });

  return {
    alreadySeeded: false,
    clientId: client.id,
    projectId: project.id,
    quoteId: quote.id,
    quoteNumber: quote.number,
    depositInvoiceId: deposit.id,
    depositInvoiceNumber: deposit.number,
    overdueInvoiceId: overdue.id,
    overdueInvoiceNumber: overdue.number,
  };
}
