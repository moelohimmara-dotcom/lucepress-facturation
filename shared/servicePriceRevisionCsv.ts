export type ServicePriceRevisionCsvRow = {
  createdAt: Date | string;
  serviceCode: string;
  serviceName: string;
  previousUnitPrice: number;
  nextUnitPrice: number;
  previousTaxRate: number;
  nextTaxRate: number;
  changedByName: string | null;
};

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createServicePriceRevisionCsv(revisions: ServicePriceRevisionCsvRow[]) {
  const header = ["Date", "Code prestation", "Prestation", "Ancien prix (GNF)", "Nouveau prix (GNF)", "Ancienne taxe (%)", "Nouvelle taxe (%)", "Auteur"];
  const rows = revisions.map(revision => [
    new Date(revision.createdAt).toISOString().slice(0, 10),
    revision.serviceCode,
    revision.serviceName,
    revision.previousUnitPrice,
    revision.nextUnitPrice,
    revision.previousTaxRate,
    revision.nextTaxRate,
    revision.changedByName,
  ].map(escapeCsv).join(";"));
  return [header.map(escapeCsv).join(";"), ...rows].join("\r\n");
}
