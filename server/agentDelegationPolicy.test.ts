import { describe, expect, it } from "vitest";
import { AGENT_DAILY_LIMIT, AGENT_DELEGATION_MAX_DAYS, createAgentMessageDraft, getDelegationPolicyErrors, isCampaignEligibleForSimulation, requiresSecondApproval } from "../shared/agentDelegationPolicy";

describe("politique de délégation de l’agent", () => {
  it("borne les délégations à 90 jours et les envois à 60 messages par jour", () => {
    const start = new Date("2026-08-01T00:00:00Z");
    const errors = getDelegationPolicyErrors({ startsAt: start, expiresAt: new Date(start.getTime() + (AGENT_DELEGATION_MAX_DAYS + 1) * 86_400_000), dailyLimit: AGENT_DAILY_LIMIT + 1, contactCooldownDays: 7 });
    expect(errors.expiresAt).toContain("90");
    expect(errors.dailyLimit).toContain("60");
  });

  it("demande une seconde approbation au-delà de 20 destinataires", () => {
    expect(requiresSecondApproval(20)).toBe(false);
    expect(requiresSecondApproval(21)).toBe(true);
  });

  it("ne simule que les relances de factures impayées en retard et les devis envoyés", () => {
    expect(isCampaignEligibleForSimulation({ purpose: "relance_facture", kind: "facture", status: "en_retard", balanceDue: 40_000, isOverdue: true })).toBe(true);
    expect(isCampaignEligibleForSimulation({ purpose: "relance_facture", kind: "facture", status: "paye", balanceDue: 0, isOverdue: true })).toBe(false);
    expect(isCampaignEligibleForSimulation({ purpose: "suivi_devis", kind: "devis", status: "envoye", balanceDue: 0, isOverdue: false })).toBe(true);
  });

  it("étiquette obligatoirement chaque brouillon simulé comme nécessitant une relecture", () => {
    const draft = createAgentMessageDraft({ purpose: "relance_facture", tone: "courtois", documentNumber: "FAC-01", clientName: "Client test", balanceDue: 120_000, dueDate: "2026-08-15" });
    expect(draft.body).toContain("Brouillon IA — relecture administrateur obligatoire.");
    expect(draft.subject).toContain("FAC-01");
  });
});
