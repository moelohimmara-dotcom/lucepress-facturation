export type GettingStartedMilestones = {
  hasClient: boolean;
  hasQuote: boolean;
  hasReviewedReceivables: boolean;
};

export type GettingStartedTaskId = "client" | "quote" | "receivables";

export const gettingStartedTasks: Array<{ id: GettingStartedTaskId; label: string; description: string; path: string }> = [
  { id: "client", label: "Ajoutez un client", description: "Créez une fiche ou préparez-la avec l’assistant.", path: "/clients" },
  { id: "quote", label: "Créez un premier devis", description: "Partez d’un besoin de chantier ou d’un modèle.", path: "/devis/nouveau?assistant=1" },
  { id: "receivables", label: "Consultez le suivi", description: "Repérez les encaissements, retards et rappels.", path: "/creances" },
];

export function isGettingStartedTaskComplete(id: GettingStartedTaskId, milestones: GettingStartedMilestones) {
  return id === "client" ? milestones.hasClient : id === "quote" ? milestones.hasQuote : milestones.hasReviewedReceivables;
}

export function countGettingStartedTasks(milestones: GettingStartedMilestones) {
  return gettingStartedTasks.filter(task => isGettingStartedTaskComplete(task.id, milestones)).length;
}
