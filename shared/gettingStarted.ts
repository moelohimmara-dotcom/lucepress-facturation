export type GettingStartedMilestones = {
  hasClient: boolean;
  hasQuote: boolean;
  hasReviewedReceivables: boolean;
};

export type GettingStartedTaskId = "client" | "quote" | "receivables";

export const gettingStartedTasks: Array<{ id: GettingStartedTaskId; label: string; description: string; path: string }> = [
  { id: "client", label: "Ajoute un client", description: "Crée une fiche ou lance le jeu demo en un clic.", path: "/clients" },
  { id: "quote", label: "Crée un premier devis", description: "Pars d’un besoin de chantier ou d’un modèle.", path: "/devis/nouveau?assistant=1" },
  { id: "receivables", label: "Consulte le suivi", description: "Repère les encaissements, retards et rappels.", path: "/creances" },
];

export function isGettingStartedTaskComplete(id: GettingStartedTaskId, milestones: GettingStartedMilestones) {
  return id === "client" ? milestones.hasClient : id === "quote" ? milestones.hasQuote : milestones.hasReviewedReceivables;
}

export function countGettingStartedTasks(milestones: GettingStartedMilestones) {
  return gettingStartedTasks.filter(task => isGettingStartedTaskComplete(task.id, milestones)).length;
}
