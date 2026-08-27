export const AGENT_DELEGATION_MAX_DAYS = 90;
export const AGENT_DAILY_LIMIT = 60;
export const AGENT_CONTACT_COOLDOWN_DAYS = 7;
export const AGENT_SECOND_APPROVAL_THRESHOLD = 20;

export type AgentPurpose = "relance_facture" | "suivi_devis";
export type AgentChannel = "email" | "whatsapp";
export type AgentTone = "courtois" | "professionnel" | "ferme" | "commercial";

export type DelegationPolicyInput = {
  startsAt: Date;
  expiresAt: Date;
  dailyLimit: number;
  contactCooldownDays: number;
};

export function getDelegationPolicyErrors(input: DelegationPolicyInput) {
  const errors: Record<string, string> = {};
  const durationMs = input.expiresAt.getTime() - input.startsAt.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) errors.expiresAt = "La date d’expiration doit être postérieure au début de la délégation.";
  if (durationMs > AGENT_DELEGATION_MAX_DAYS * 86_400_000) errors.expiresAt = `Une délégation ne peut pas dépasser ${AGENT_DELEGATION_MAX_DAYS} jours.`;
  if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > AGENT_DAILY_LIMIT) errors.dailyLimit = `Le plafond doit être compris entre 1 et ${AGENT_DAILY_LIMIT} messages par jour.`;
  if (!Number.isInteger(input.contactCooldownDays) || input.contactCooldownDays < 1 || input.contactCooldownDays > 30) errors.contactCooldownDays = "Le délai minimal par contact doit être compris entre 1 et 30 jours.";
  return errors;
}

export function requiresSecondApproval(eligibleCount: number) {
  return eligibleCount > AGENT_SECOND_APPROVAL_THRESHOLD;
}

export function createAgentMessageDraft(input: {
  purpose: AgentPurpose;
  tone: AgentTone;
  documentNumber: string;
  clientName: string;
  balanceDue?: number;
  dueDate?: Date | string | null;
  validUntil?: Date | string | null;
}) {
  const politeIntro = input.tone === "ferme"
    ? "Nous vous invitons à nous indiquer sans délai la suite à donner."
    : "Nous restons à votre disposition pour toute précision utile.";
  if (input.purpose === "relance_facture") {
    const dueDate = input.dueDate ? new Date(input.dueDate).toLocaleDateString("fr-FR") : "à vérifier";
    return {
      subject: `Rappel — facture ${input.documentNumber}`,
      body: `Bonjour ${input.clientName},\n\nNous vous adressons un rappel concernant la facture ${input.documentNumber}, dont le solde enregistré est de ${(input.balanceDue ?? 0).toLocaleString("fr-FR")} GNF. Son échéance est fixée au ${dueDate}.\n\n${politeIntro}\n\nCordialement,\nLucepress Solutions Durables\n\nBrouillon IA — relecture administrateur obligatoire.`,
    };
  }
  const validUntil = input.validUntil ? new Date(input.validUntil).toLocaleDateString("fr-FR") : "à confirmer";
  return {
    subject: `Suivi — devis ${input.documentNumber}`,
    body: `Bonjour ${input.clientName},\n\nNous souhaitons savoir si vous avez pu examiner notre devis ${input.documentNumber}, valable jusqu’au ${validUntil}. Nous pouvons répondre à vos questions ou ajuster les éléments techniques après échange avec vous.\n\n${politeIntro}\n\nCordialement,\nLucepress Solutions Durables\n\nBrouillon IA — relecture administrateur obligatoire.`,
  };
}

export function isCampaignEligibleForSimulation(input: {
  purpose: AgentPurpose;
  kind: "facture" | "devis";
  status: string;
  balanceDue: number;
  isOverdue: boolean;
}) {
  if (input.purpose === "relance_facture") return input.kind === "facture" && input.balanceDue > 0 && input.isOverdue;
  return input.kind === "devis" && input.status === "envoye";
}
