export type ProjectMarginExportRow = {
  name: string;
  reference: string | null;
  clientName: string;
  plannedRevenue: number;
  plannedBudget: number;
  plannedMargin: number | null;
  plannedMarginRate: number | null;
  revenueCollected: number;
  costTotal: number;
  margin: number;
  marginRate: number | null;
  marginVariance: number | null;
  minimumMarginRate: number | null;
  isMarginBelowTarget: boolean;
};

function csvCell(value: string | number | null) {
  const normalized = value === null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function createProjectMarginCsv(projects: ProjectMarginExportRow[]) {
  const header = ["Chantier", "Référence", "Client", "CA prévu (GNF)", "Budget initial (GNF)", "Marge prévue (GNF)", "Taux prévu (%)", "Encaissements (GNF)", "Coûts réels (GNF)", "Marge réalisée (GNF)", "Taux réalisé (%)", "Écart (GNF)", "Seuil minimal (%)", "Alerte seuil"].join(",");
  const rows = projects.map(project => [project.name, project.reference, project.clientName, project.plannedRevenue, project.plannedBudget, project.plannedMargin, project.plannedMarginRate, project.revenueCollected, project.costTotal, project.margin, project.marginRate, project.marginVariance, project.minimumMarginRate, project.isMarginBelowTarget ? "Oui" : "Non"].map(csvCell).join(","));
  return [header, ...rows].join("\n");
}
