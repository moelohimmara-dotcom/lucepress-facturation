export const CLIENT_ACTIVITY_TYPES = [
  "relance_preparee",
  "note",
  "statut_recouvrement",
  "responsable_recouvrement",
  "date_rappel_recouvrement",
  "email_envoye",
  "statut_document",
] as const;

export type ClientActivityType = (typeof CLIENT_ACTIVITY_TYPES)[number];

export const CLIENT_ACTIVITY_TYPE_LABELS: Record<ClientActivityType, string> = {
  relance_preparee: "Relance préparée",
  note: "Note",
  statut_recouvrement: "Suivi créance",
  responsable_recouvrement: "Responsable créance",
  date_rappel_recouvrement: "Rappel créance",
  email_envoye: "E-mail envoyé",
  statut_document: "Statut document",
};

/** Types mis en avant dans le journal d’audit direction. */
export const STAFF_AUDIT_FOCUS_TYPES = ["email_envoye", "statut_document", "relance_preparee"] as const;

export function isClientActivityType(value: string): value is ClientActivityType {
  return (CLIENT_ACTIVITY_TYPES as readonly string[]).includes(value);
}
