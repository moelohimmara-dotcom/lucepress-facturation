import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import {
  SystemAccessPanel,
  accountBusyKey,
  invitationBusyKey,
  type ConsoleAccessAccount,
} from "@/components/SystemAccess";
import {
  ChangeRoleDialog,
  CreateAccountDialog,
  InvitationLinkPanel,
  InviteDialog,
  RemoveAccountDialog,
  RenameAccountDialog,
  ResetPasswordDialog,
  RevokeInvitationDialog,
  TemporaryPasswordPanel,
  accessAccountLabel,
  type AccessActionInvitation,
  type AccessNotice,
} from "@/components/SystemAccessActions";
import { ConsoleModuleRail } from "@/components/SystemConsoleDashboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import type { StaffAssignableRole } from "@shared/roles";
import { RefreshCw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * Console d’exploitation — Phase 3 (module 4, étape C) : « Accès & comptes »,
 * désormais AGISSANT.
 *
 * CE QUI CHANGE PAR RAPPORT À L’ÉTAPE A
 * -------------------------------------
 * L’écran lisait les comptes et n’offrait rien. Il porte maintenant les huit
 * écritures : créer, renommer, changer un rôle, réinitialiser un mot de passe,
 * supprimer, inviter, renvoyer et révoquer une invitation.
 *
 * CE QUI NE CHANGE PAS : LE SERVEUR DÉCIDE
 * ----------------------------------------
 * Chaque geste part vers une procédure sous `systemProcedure` (rôle `systeme`
 * ET double authentification active) et c’est le serveur qui accepte ou refuse —
 * dernier compte système, auto-suppression, auto-rétrogradation, e-mail déjà
 * pris. L’interface n’anticipe rien : elle affiche le message du refus tel qu’il
 * arrive, sans le reformuler ni le cacher. Deux conséquences voulues :
 *
 *   - les garde-fous ne peuvent pas être contournés en agissant sur le DOM ;
 *   - l’écran ne peut pas se tromper sur ce que le serveur autorise, puisqu’il
 *     ne prétend rien savoir à l’avance.
 *
 * LES DEUX SECRETS AFFICHÉS UNE SEULE FOIS
 * ----------------------------------------
 * Le mot de passe temporaire et le lien d’invitation ne sont rendus qu’une fois
 * par le serveur. Ils vivent donc dans un état local qui est VIDÉ à la fermeture
 * de la fenêtre : les relire demanderait de recommencer l’opération. C’est ce
 * que les deux panneaux disent à l’opérateur, parce qu’un opérateur qui croit
 * pouvoir rouvrir une fenêtre fermée croira à une panne.
 */
export default function SystemAccessPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  /** Quelle boîte de dialogue est ouverte, et sur quoi. Un seul état, pas dix. */
  type OpenDialog =
    | { kind: "create" }
    | { kind: "invite" }
    | { kind: "rename"; account: ConsoleAccessAccount }
    | { kind: "role"; account: ConsoleAccessAccount }
    | { kind: "reset"; account: ConsoleAccessAccount }
    | { kind: "remove"; account: ConsoleAccessAccount }
    | { kind: "revokeInvitation"; invitation: AccessActionInvitation }
    | { kind: "temporaryPassword"; account: ConsoleAccessAccount; password: string }
    | { kind: "invitationLink"; email: string; link: string; emailed: boolean; emailError?: string; smtpConfigured: boolean }
    | null;

  const [open, setOpen] = useState<OpenDialog>(null);
  const [notice, setNotice] = useState<AccessNotice | null>(null);
  /** Clé de l’écriture en vol (`compte#2`, `creation`…). `null` si rien ne vole. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** Message d’erreur affiché DANS la boîte de dialogue concernée. */
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Cible de l’écriture en vol, pour nommer la personne dans le retour affiché.
  // Une référence, pas un état : elle ne doit déclencher aucun rendu, et elle
  // est lue au moment du retour, pas au moment du clic.
  const target = useRef<string | null>(null);

  const access = trpc.system.access.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const invitations = trpc.system.invitations.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  /** Relit tout ce qui a pu changer. Appelé après CHAQUE écriture, refus compris. */
  const refreshAll = useCallback(() => {
    void access.refetch();
    void invitations.refetch();
  }, [access, invitations]);

  /** Ferme la boîte ouverte et efface l’erreur qu’elle portait. */
  const closeDialog = useCallback(() => {
    setOpen(null);
    setDialogError(null);
  }, []);

  /**
   * Retour d’une écriture. Le message d’erreur est celui du SERVEUR, repris mot
   * pour mot : il dit quoi faire (« nommez d’abord un autre compte »), ce qu’un
   * code technique ne dirait pas.
   */
  const onWriteError = useCallback(
    (error: { message: string }) => {
      setDialogError(error.message);
      setNotice({ tone: "down", message: error.message });
      // Un refus n’a rien changé — mais on relit quand même, pour rester au plus
      // près de l’état réel plutôt que d’un état supposé.
      refreshAll();
    },
    [refreshAll],
  );

  const createAccount = trpc.system.accounts.create.useMutation({
    onSuccess: result => {
      closeDialog();
      setNotice({ tone: "ok", message: `Compte créé (compte #${result.id}). Transmettez le mot de passe par un canal sûr.` });
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  const renameAccount = trpc.system.accounts.rename.useMutation({
    onSuccess: () => {
      closeDialog();
      setNotice({ tone: "ok", message: `${target.current ?? "Le compte"} a été renommé.` });
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  const setRole = trpc.system.accounts.setRole.useMutation({
    onSuccess: result => {
      closeDialog();
      setNotice({ tone: "ok", message: `Rôle mis à jour (compte #${result.userId}). Il s’applique dès la prochaine requête du compte.` });
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  const resetPassword = trpc.system.accounts.resetPassword.useMutation({
    onSuccess: result => {
      // Le mot de passe passe du retour de la mutation à l’état de la boîte, et
      // nulle part ailleurs. Il n’est ni journalisé côté serveur, ni conservé ici
      // au-delà de la fermeture de la fenêtre.
      const account = targetAccount.current;
      setDialogError(null);
      targetAccount.current = null;
      setOpen(account ? { kind: "temporaryPassword", account, password: result.temporaryPassword } : null);
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  const removeAccount = trpc.system.accounts.remove.useMutation({
    onSuccess: () => {
      closeDialog();
      setNotice({ tone: "ok", message: `${target.current ?? "Le compte"} a été supprimé. Son accès est fermé.` });
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  const issueInvitation = trpc.system.invitations.issue.useMutation({
    onSuccess: result => {
      setDialogError(null);
      setOpen({
        kind: "invitationLink",
        email: result.email,
        link: result.invitationLink,
        emailed: result.emailed,
        emailError: result.emailError,
        smtpConfigured: result.smtpConfigured,
      });
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  const resendInvitation = trpc.system.invitations.resend.useMutation({
    onSuccess: result => {
      setDialogError(null);
      target.current = result.email;
      setOpen({
        kind: "invitationLink",
        email: result.email,
        link: result.invitationLink,
        emailed: true,
        smtpConfigured: true,
      });
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  const revokeInvitation = trpc.system.invitations.revoke.useMutation({
    onSuccess: result => {
      closeDialog();
      setNotice({ tone: "ok", message: `Invitation de ${result.email} révoquée. Le lien ne fonctionne plus.` });
      refreshAll();
    },
    onError: onWriteError,
    onSettled: () => setBusyKey(null),
  });

  // Compte visé par une réinitialisation : conservé le temps d’afficher le mot
  // de passe temporaire, puis oublié.
  const targetAccount = useRef<ConsoleAccessAccount | null>(null);

  const refresh = useCallback(() => {
    setNotice(null);
    refreshAll();
  }, [refreshAll]);

  const actions = {
    busyKey,
    onCreate: () => {
      setDialogError(null);
      setBusyKey(null);
      setOpen({ kind: "create" });
    },
    onInvite: () => {
      setDialogError(null);
      setBusyKey(null);
      setOpen({ kind: "invite" });
    },
    onRename: (account: ConsoleAccessAccount) => {
      setDialogError(null);
      setOpen({ kind: "rename", account });
    },
    onChangeRole: (account: ConsoleAccessAccount) => {
      setDialogError(null);
      setOpen({ kind: "role", account });
    },
    onResetPassword: (account: ConsoleAccessAccount) => {
      setDialogError(null);
      setOpen({ kind: "reset", account });
    },
    onRemove: (account: ConsoleAccessAccount) => {
      setDialogError(null);
      setOpen({ kind: "remove", account });
    },
    onResendInvitation: (invitation: AccessActionInvitation) => {
      setDialogError(null);
      target.current = invitation.email;
      setBusyKey(invitationBusyKey(invitation.id));
      resendInvitation.mutate({ id: invitation.id });
    },
    onRevokeInvitation: (invitation: AccessActionInvitation) => {
      setDialogError(null);
      setOpen({ kind: "revokeInvitation", invitation });
    },
  };

  /** Compte actuellement visé par la boîte ouverte, s’il y en a un. */
  const dialogAccount =
    open && (open.kind === "rename" || open.kind === "role" || open.kind === "reset" || open.kind === "remove")
      ? open.account
      : null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl pb-10">
        <PageHeader
          kicker="Exploitation · Administration système"
          title="Accès & comptes"
          description="Tous les comptes de l’instance (staff et portail client), invitations en attente, moyens d’accès et politique de mot de passe. Chaque action est journalisée ; les secrets ne sont affichés qu’une fois."
          actions={
            <Button variant="outline" onClick={refresh} className="h-10 rounded-xl border-border font-bold">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          }
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConsoleModuleRail activePath="/console/acces" onNavigate={path => setLocation(path)} />
          <SystemAccessPanel
            access={access.data}
            failed={Boolean(access.error)}
            isLoading={access.isLoading}
            actions={actions}
            notice={notice}
            invitations={invitations.data ?? (invitations.error ? null : undefined)}
            invitationsFailed={Boolean(invitations.error)}
            isLoadingInvitations={invitations.isLoading}
          />
        </div>
      </div>

      {/* --- Créer un compte ------------------------------------------- */}
      <CreateAccountDialog
        open={open?.kind === "create"}
        onOpenChange={value => (value ? undefined : closeDialog())}
        pending={createAccount.isPending}
        error={dialogError}
        onSubmit={values => {
          setDialogError(null);
          setBusyKey("creation");
          createAccount.mutate(values);
        }}
      />

      {/* --- Inviter ---------------------------------------------------- */}
      <InviteDialog
        open={open?.kind === "invite"}
        onOpenChange={value => (value ? undefined : closeDialog())}
        pending={issueInvitation.isPending}
        error={dialogError}
        onSubmit={values => {
          setDialogError(null);
          setBusyKey("invitation.creation");
          issueInvitation.mutate(values);
        }}
      />

      {/* --- Renommer --------------------------------------------------- */}
      <RenameAccountDialog
        open={open?.kind === "rename"}
        onOpenChange={value => (value ? undefined : closeDialog())}
        account={dialogAccount}
        pending={renameAccount.isPending}
        error={dialogError}
        onSubmit={name => {
          if (!dialogAccount) return;
          setDialogError(null);
          target.current = accessAccountLabel(dialogAccount);
          setBusyKey(accountBusyKey(dialogAccount.id));
          renameAccount.mutate({ userId: dialogAccount.id, name });
        }}
      />

      {/* --- Changer le rôle -------------------------------------------- */}
      <ChangeRoleDialog
        open={open?.kind === "role"}
        onOpenChange={value => (value ? undefined : closeDialog())}
        account={dialogAccount}
        pending={setRole.isPending}
        error={dialogError}
        onSubmit={(role: StaffAssignableRole) => {
          if (!dialogAccount) return;
          setDialogError(null);
          target.current = accessAccountLabel(dialogAccount);
          setBusyKey(accountBusyKey(dialogAccount.id));
          setRole.mutate({ userId: dialogAccount.id, role });
        }}
      />

      {/* --- Réinitialiser le mot de passe ------------------------------ */}
      <ResetPasswordDialog
        open={open?.kind === "reset"}
        onOpenChange={value => (value ? undefined : closeDialog())}
        account={dialogAccount}
        pending={resetPassword.isPending}
        error={dialogError}
        onConfirm={() => {
          if (!dialogAccount) return;
          setDialogError(null);
          target.current = accessAccountLabel(dialogAccount);
          targetAccount.current = dialogAccount;
          setBusyKey(accountBusyKey(dialogAccount.id));
          resetPassword.mutate({ userId: dialogAccount.id });
        }}
      />

      {/* --- Supprimer -------------------------------------------------- */}
      <RemoveAccountDialog
        open={open?.kind === "remove"}
        onOpenChange={value => (value ? undefined : closeDialog())}
        account={dialogAccount}
        pending={removeAccount.isPending}
        error={dialogError}
        onConfirm={() => {
          if (!dialogAccount) return;
          setDialogError(null);
          target.current = accessAccountLabel(dialogAccount);
          setBusyKey(accountBusyKey(dialogAccount.id));
          removeAccount.mutate({ userId: dialogAccount.id });
        }}
      />

      {/* --- Révoquer une invitation ------------------------------------ */}
      <RevokeInvitationDialog
        open={open?.kind === "revokeInvitation"}
        onOpenChange={value => (value ? undefined : closeDialog())}
        invitation={open?.kind === "revokeInvitation" ? open.invitation : null}
        pending={revokeInvitation.isPending}
        error={dialogError}
        onConfirm={() => {
          if (open?.kind !== "revokeInvitation") return;
          setDialogError(null);
          setBusyKey(invitationBusyKey(open.invitation.id));
          revokeInvitation.mutate({ id: open.invitation.id });
        }}
      />

      {/* --- Mot de passe temporaire : montré UNE fois ------------------ */}
      <Dialog open={open?.kind === "temporaryPassword"} onOpenChange={value => (value ? undefined : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mot de passe temporaire</DialogTitle>
            <DialogDescription>
              Il n’est affiché qu’ici, et une seule fois. Fermer cette fenêtre l’efface définitivement.
            </DialogDescription>
          </DialogHeader>
          {open?.kind === "temporaryPassword" && (
            <TemporaryPasswordPanel
              accountLabel={accessAccountLabel(open.account)}
              password={open.password}
              onDone={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* --- Lien d’invitation : montré UNE fois ------------------------ */}
      <Dialog open={open?.kind === "invitationLink"} onOpenChange={value => (value ? undefined : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lien d’invitation</DialogTitle>
            <DialogDescription>
              Valable 72 heures. Copiez-le et transmettez-le par un canal sûr : il ne sera plus affiché.
            </DialogDescription>
          </DialogHeader>
          {open?.kind === "invitationLink" && (
            <InvitationLinkPanel
              email={open.email}
              link={open.link}
              emailed={open.emailed}
              emailError={open.emailError}
              smtpConfigured={open.smtpConfigured}
              onDone={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
