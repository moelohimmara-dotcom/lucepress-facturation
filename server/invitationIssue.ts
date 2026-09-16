import { TRPCError } from "@trpc/server";
import { getSmtpUser, isMailConfigured, sendMail } from "./_core/mailer";
import { LUCEPRES_PUBLIC_PROFILE } from "../shared/companyProfile";
import * as db from "./db";
import type { PersistedAppRole } from "../shared/roles";

/**
 * ÉMISSION D’UNE INVITATION — le seul chemin qui en crée une.
 *
 * Ce module a été extrait de `server/routers.ts` (où il vivait en fonction
 * privée) au moment où la console d’exploitation a eu besoin d’inviter à son
 * tour. Le choix est délibéré : les règles portées ici ne sont pas des détails
 * d’interface, et les réimplémenter aurait suffi à faire diverger deux écrans —
 * par exemple sur la révocation de l’invitation précédente.
 *
 * CE QUE L’ÉMISSION GARANTIT, POUR TOUS LES APPELANTS
 * - un SEUL compte par adresse : une adresse déjà pourvue d’un compte ne peut
 *   pas être invitée (sinon l’acceptation créerait un doublon, ou pire, viserait
 *   un compte existant) ;
 * - une SEULE invitation en attente par adresse : la précédente est révoquée
 *   avant l’émission de la nouvelle, sinon l’ancien lien resterait valide après
 *   un « renvoi » — exactement ce qu’on croit avoir annulé ;
 * - un jeton JAMAIS stocké en clair : seule son empreinte SHA-256 est écrite, et
 *   le jeton brut n’existe que le temps de composer le lien remis à l’appelant ;
 * - l’envoi d’e-mail n’est PAS une condition de succès : sans SMTP configuré, ou
 *   si l’envoi échoue, l’invitation existe et le lien est rendu à l’appelant, qui
 *   le transmet lui-même. Le dire (`emailed: false` + `emailError`) vaut mieux
 *   que de prétendre avoir envoyé.
 */
export type IssueInvitationInput = {
  email: string;
  /** Seuls les rôles portés par l’énumération `invitations.role` sont invitable. */
  role: PersistedAppRole;
  invitedById: number;
  invitedByName: string | null;
  tenantId: number;
  req: { protocol?: string; get?: (name: string) => string | undefined };
};

export type IssueInvitationResult = {
  success: true;
  invitationLink: string;
  email: string;
  role: PersistedAppRole;
  emailed: boolean;
  emailError: string | undefined;
  smtpConfigured: boolean;
};

/** Reconstruit l'origine publique (https://...) pour les liens e-mail. */
export function getRequestOrigin(req: { protocol?: string; get?: (name: string) => string | undefined }): string {
  const configured = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const proto = req.get?.("x-forwarded-proto") || req.protocol || "https";
  const host = req.get?.("x-forwarded-host") || req.get?.("host");
  if (!host || host.includes("localhost") || host.startsWith("127.")) {
    return "https://lucepress.213.156.135.139.sslip.io";
  }
  return `${proto}://${host}`;
}

export async function issueInvitation(opts: IssueInvitationInput): Promise<IssueInvitationResult> {
  const existant = await db.getUserByEmail(opts.email);
  if (existant) {
    throw new TRPCError({ code: "CONFLICT", message: "Un compte existe déjà avec cet e-mail." });
  }
  const enAttente = await db.listInvitations();
  for (const inv of enAttente) {
    if (inv.email === opts.email && inv.status === "pending") {
      await db.revokeInvitation(inv.id);
    }
  }
  const { createInvitationToken, hashInvitationToken } = await import("../shared/invitationToken");
  const token = createInvitationToken();
  const tokenHash = hashInvitationToken(token);
  await db.createInvitation({
    tokenHash,
    email: opts.email,
    role: opts.role,
    invitedBy: opts.invitedById,
    tenantId: opts.tenantId,
  });
  const origin = getRequestOrigin(opts.req);
  const inviteLink = `${origin}/invitation?token=${token}`;
  let emailed = false;
  let emailError: string | undefined;
  if (!isMailConfigured()) {
    emailError = "SMTP non configuré.";
  } else {
    try {
      const rendered = await db.renderEmailTemplate("invitation", {
        inviterName: opts.invitedByName ?? "Lucepres",
        inviteLink,
        organization: LUCEPRES_PUBLIC_PROFILE.legalName,
        expiresAt: new Date(Date.now() + db.INVITATION_TTL_MS).toLocaleString("fr-FR"),
      });
      await sendMail({
        to: opts.email,
        bcc: (() => {
          const smtpUser = getSmtpUser();
          if (!smtpUser) return undefined;
          if (smtpUser.toLowerCase() === opts.email.trim().toLowerCase()) return undefined;
          return smtpUser;
        })(),
        subject: rendered?.subject ?? `Invitation à rejoindre ${LUCEPRES_PUBLIC_PROFILE.legalName}`,
        html: rendered?.html ?? "",
        text: rendered?.text ?? `${opts.invitedByName ?? "Lucepres"} vous invite à rejoindre Lucepress.\n\nAccepter l'invitation : ${inviteLink}\n\nCe lien expirera dans 72 heures.`,
      });
      emailed = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Échec d'envoi d'e-mail";
      console.error("[invite] Échec d'envoi d'e-mail:", err);
    }
  }
  return {
    success: true as const,
    invitationLink: inviteLink,
    email: opts.email,
    role: opts.role,
    emailed,
    emailError,
    smtpConfigured: isMailConfigured(),
  };
}

/**
 * RENVOI D’UNE INVITATION ENCORE EN ATTENTE.
 *
 * Un renvoi N’EST PAS un simple rappel : le jeton est RÉGÉNÉRÉ, ce qui invalide
 * le lien précédent. C’est le comportement voulu — un lien qui a circulé par
 * erreur (mauvais destinataire, mauvaise adresse) cesse d’être utilisable — mais
 * il faut le dire à l’appelant, qui affiche « l’ancien lien est invalidé ».
 *
 * Les trois refus possibles sont distincts et le restent : SMTP absent
 * (`PRECONDITION_FAILED`), invitation introuvable / déjà utilisée / révoquée /
 * expirée (`BAD_REQUEST`), échec d’envoi (`INTERNAL_SERVER_ERROR`). Les confondre
 * priverait l’administrateur de l’information qui lui dit quoi faire.
 */
export type ResendInvitationOptions = {
  id: number;
  req: { protocol?: string; get?: (name: string) => string | undefined };
  inviterName: string | null;
};

export type ResendInvitationOutcome = {
  success: true;
  emailed: true;
  email: string;
  invitationLink: string;
};

export async function resendInvitationEmail(opts: ResendInvitationOptions): Promise<ResendInvitationOutcome> {
  if (!isMailConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SMTP non configuré. Impossible de renvoyer l’invitation par e-mail.",
    });
  }
  const rotated = await db.rotateInvitationToken(opts.id);
  if (!rotated) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invitation introuvable, déjà utilisée, révoquée ou expirée.",
    });
  }
  const origin = getRequestOrigin(opts.req);
  const inviteLink = `${origin}/invitation?token=${rotated.token}`;
  try {
    const rendered = await db.renderEmailTemplate("invitation", {
      inviterName: opts.inviterName ?? "Lucepres",
      inviteLink,
      organization: LUCEPRES_PUBLIC_PROFILE.legalName,
      expiresAt: rotated.expiresAt.toLocaleString("fr-FR"),
    });
    await sendMail({
      to: rotated.email,
      bcc: (() => {
        const smtpUser = getSmtpUser();
        if (!smtpUser) return undefined;
        if (smtpUser.toLowerCase() === rotated.email.trim().toLowerCase()) return undefined;
        return smtpUser;
      })(),
      subject: rendered?.subject ?? `Invitation à rejoindre ${LUCEPRES_PUBLIC_PROFILE.legalName}`,
      html: rendered?.html ?? "",
      text: rendered?.text ?? `Invitation Lucepress : ${inviteLink}`,
    });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Échec d’envoi de l’e-mail d’invitation.",
    });
  }
  return {
    success: true as const,
    emailed: true as const,
    email: rotated.email,
    invitationLink: inviteLink,
  };
}
