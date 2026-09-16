import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_ROLE_LABELS, STAFF_ASSIGNABLE_ROLES, type StaffAssignableRole } from "@shared/roles";
import {
  Check,
  CircleCheck,
  ClipboardCopy,
  KeyRound,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

/**
 * BOÎTES DE DIALOGUE DE L’ÉCRAN « ACCÈS & COMPTES » — la partie qui agit.
 *
 * POURQUOI CE FICHIER EST SÉPARÉ DE `SystemAccess.tsx`
 * ---------------------------------------------------
 * `SystemAccess.tsx` rend l’état (qui a accès à quoi) ; ce fichier-ci rend les
 * GESTES. La séparation a une raison précise : ces composants ne connaissent NI
 * tRPC, NI routeur, NI session. Tout leur arrive par propriétés — ils sont donc
 * rendus tels quels en test, sans réseau ni contexte React. Les appels serveur
 * vivent dans `client/src/pages/SystemAccessPage.tsx`, qui les branche.
 *
 * CE QUI EST DÉCIDÉ ICI, ET CE QUI NE L’EST PAS
 * ---------------------------------------------
 * Aucune règle d’habilitation n’est décidée ici : le serveur refuse, l’écran
 * affiche le refus. Ce qui est décidé ici, en revanche, c’est le DEGRÉ DE
 * CONFIRMATION demandé à l’opérateur — et c’est une décision d’ergonomie de
 * sécurité, pas de la décoration :
 *
 *   - une SUPPRESSION exige la saisie de l’identité du compte (son adresse
 *     e-mail, ou « Compte #id » à défaut). Le cahier des charges § 5 demande
 *     « double confirmation + saisie du nom de la ressource » pour toute action
 *     destructive, et cette saisie est ce qui distingue « j’ai cliqué » de
 *     « j’ai désigné » ;
 *   - un CHANGEMENT DE RÔLE et une RÉVOCATION D’INVITATION passent par une
 *     confirmation explicite, qui nomme l’avant et l’après ;
 *   - un RENOMMAGE ne demande rien de tel : il ne retire aucun accès.
 */

/* ------------------------------------------------------------------ */
/* Vocabulaire partagé                                                 */
/* ------------------------------------------------------------------ */

/** Ce que ces dialogues ont besoin de savoir d’un compte. Jamais un secret. */
export type AccessActionAccount = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
};

/** Invitation en attente, telle que `system.invitations.list` la rend. */
export type AccessActionInvitation = {
  id: number;
  email: string;
  role: string;
  roleLabel: string;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
};

/**
 * Nom affichable d’un compte, sans jamais laisser une case vide. Même règle que
 * la liste : le nom, sinon l’adresse, sinon l’identifiant.
 */
export function accessAccountLabel(account: AccessActionAccount): string {
  return account.name?.trim() || account.email?.trim() || `Compte #${account.id}`;
}

/**
 * Ce qu’il faut RECOPIER pour confirmer une suppression.
 *
 * L’adresse e-mail quand elle existe — c’est l’identité de connexion, celle que
 * l’opérateur a sous les yeux. À défaut (comptes hérités sans adresse), la forme
 * technique `Compte #12`, qui reste unique et vérifiable dans la liste.
 */
export function removalConfirmationText(account: AccessActionAccount): string {
  return account.email?.trim() || `Compte #${account.id}`;
}

/** La saisie de confirmation correspond-elle exactement à ce qui est demandé ? */
export function removalConfirmed(account: AccessActionAccount, typed: string): boolean {
  return typed.trim() === removalConfirmationText(account);
}

/**
 * Libellé d’un rôle. Une valeur inconnue est affichée telle quelle : la masquer
 * ferait disparaître du regard un rôle qu’on ne sait pas nommer.
 */
export function roleLabel(role: string): string {
  return (APP_ROLE_LABELS as Record<string, string | undefined>)[role] ?? role;
}

/* ------------------------------------------------------------------ */
/* Retours d’action                                                    */
/* ------------------------------------------------------------------ */

export type AccessNoticeTone = "ok" | "warn" | "down";
/** Retour affiché après une écriture : succès, refus du serveur, ou échec. */
export type AccessNotice = { tone: AccessNoticeTone; message: string };

/**
 * Bandeau de retour. Il dit le RÉSULTAT RÉEL d’une écriture — y compris un
 * refus, dont le message vient du serveur (« dernier compte système », « vous ne
 * pouvez pas supprimer votre propre compte »). L’écran ne réécrit pas ces
 * messages : il les affiche.
 */
export function AccessNoticeBanner({ notice }: { notice: AccessNotice }) {
  const style =
    notice.tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
      : notice.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
        : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200";
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${style}`} data-testid="access-notice">
      {notice.tone === "ok" ? (
        <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" />
      ) : notice.tone === "warn" ? (
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
      )}
      <p className="text-sm font-semibold leading-5">{notice.message}</p>
    </div>
  );
}

/** Erreur d’une boîte de dialogue : le message du serveur, tel quel. */
function DialogError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200"
      data-testid="access-dialog-error"
      role="alert"
    >
      {message}
    </p>
  );
}

/** Rappel présent dans chaque boîte de dialogue : rien de tout ceci n’est discret. */
export function JournalisedMention({ className }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-4 text-muted-foreground ${className ?? ""}`}>
      Les actions sont journalisées : acteur, compte visé, action et résultat.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Secret affiché une fois                                             */
/* ------------------------------------------------------------------ */

/**
 * Mot de passe temporaire — MONTRÉ UNE FOIS, PUIS PERDU.
 *
 * Le serveur ne le rend qu’à cet instant, et n’en garde que l’empreinte : le
 * bouton « J’ai transmis » ne le « range » nulle part, il le fait disparaître.
 * L’écran le dit sans détour, parce qu’un opérateur qui ferme cette fenêtre en
 * croyant pouvoir la rouvrir devra recommencer toute l’opération.
 */
export function TemporaryPasswordPanel({
  accountLabel,
  password,
  onDone,
}: {
  accountLabel: string;
  password: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4" data-testid="temporary-password-panel">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/70">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div>
          <p className="text-sm font-extrabold text-amber-950 dark:text-amber-200">Mot de passe temporaire — affiché une seule fois</p>
          <p className="mt-1 text-xs leading-5 text-amber-950 dark:text-amber-200">
            Pour <strong>{accountLabel}</strong>. À communiquer par un canal sûr (de vive voix, téléphone, message chiffré) — jamais par
            e-mail en clair, jamais dans un document partagé. Dès que cette fenêtre est fermée, personne — pas même
            l’administrateur système — ne pourra le relire : la base n’en conserve que l’empreinte.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 py-2 font-mono text-sm font-bold tracking-[0.12em] text-foreground"
          data-testid="temporary-password-value"
        >
          {password}
        </code>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-border font-bold"
          onClick={() => {
            void navigator.clipboard?.writeText(password);
            setCopied(true);
          }}
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Demandez à la personne de changer ce mot de passe dès sa première connexion. Si vous le perdez avant de l’avoir
        transmis, il n’existe aucun moyen de le retrouver : il faudra en tirer un nouveau.
      </p>

      <DialogFooter>
        <Button type="button" onClick={onDone} className="h-10 rounded-xl font-bold" data-testid="temporary-password-done">
          J’ai transmis le mot de passe
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * Lien d’invitation — affiché lui aussi une seule fois.
 *
 * Même logique que le mot de passe temporaire : le jeton n’est stocké qu’en
 * empreinte, donc le lien ne peut pas être relu. Il est en revanche possible
 * d’en régénérer un par « Renvoyer », ce que le panneau dit — c’est la
 * différence avec un mot de passe perdu.
 */
export function InvitationLinkPanel({
  email,
  link,
  emailed,
  emailError,
  smtpConfigured,
  onDone,
}: {
  email: string;
  link: string;
  emailed: boolean;
  emailError?: string;
  smtpConfigured: boolean;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4" data-testid="invitation-link-panel">
      {emailed ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
          Le serveur de messagerie a accepté l’envoi vers <strong>{email}</strong>. Les filtres anti-spam classent souvent ces
          messages à tort : <strong>copiez le lien ci-dessous</strong> et transmettez-le par un autre canal pour être sûr.
        </p>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
          {smtpConfigured
            ? `E-mail non parti${emailError ? ` (${emailError})` : ""}. L’invitation existe : copiez le lien et transmettez-le vous-même.`
            : "SMTP non configuré : aucun e-mail n’a été envoyé. L’invitation existe — copiez le lien et transmettez-le par un canal sûr."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input readOnly value={link} className="min-w-0 flex-1 font-mono text-xs" data-testid="invitation-link-value" />
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-border font-bold"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Ce lien vaut 72 heures et ne sera plus affiché : la base n’en conserve que l’empreinte. Un « Renvoyer » en
        régénère un nouveau et invalide celui-ci.
      </p>

      <DialogFooter>
        <Button type="button" onClick={onDone} className="h-10 rounded-xl font-bold" data-testid="invitation-link-done">
          J’ai transmis le lien
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sélecteur de rôle                                                   */
/* ------------------------------------------------------------------ */

/**
 * Choix du rôle, par boutons plutôt que par liste déroulante : quatre valeurs,
 * toutes visibles, aucune manipulation à deux temps. `client` n’en fait pas
 * partie — un accès portail s’invite depuis la fiche client, et le serveur le
 * refuse de toute façon.
 */
export function RoleChoices({
  value,
  onChange,
  disabled,
}: {
  value: StaffAssignableRole;
  onChange: (role: StaffAssignableRole) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="role-choices">
      {STAFF_ASSIGNABLE_ROLES.map(role => (
        <Button
          key={role}
          type="button"
          size="sm"
          variant={value === role ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onChange(role)}
          className="rounded-xl font-bold"
          data-testid={`role-choice-${role}`}
          aria-pressed={value === role}
        >
          {roleLabel(role)}
        </Button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Créer un compte                                                     */
/* ------------------------------------------------------------------ */

export function CreateAccountDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { email: string; name?: string; password: string; role: StaffAssignableRole }) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffAssignableRole>("cadre");
  const [localError, setLocalError] = useState<string | null>(null);

  // Chaque ouverture repart d’un formulaire vierge : un mot de passe laissé
  // dans un champ après fermeture serait un secret qui traîne à l’écran.
  useEffect(() => {
    if (!open) {
      setEmail("");
      setName("");
      setPassword("");
      setRole("cadre");
      setLocalError(null);
    }
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setLocalError("Adresse e-mail invalide.");
    if (password.length < 8) return setLocalError("Le mot de passe doit faire au moins 8 caractères.");
    setLocalError(null);
    onSubmit({ email: email.trim(), name: name.trim() || undefined, password, role });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un compte</DialogTitle>
          <DialogDescription>
            Le compte est actif immédiatement. Transmettez le mot de passe par un canal sûr : il n’est jamais envoyé par
            la console.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sca-email">E-mail *</Label>
            <Input id="sca-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sca-name">Nom (optionnel)</Label>
            <Input id="sca-name" value={name} onChange={event => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sca-password">Mot de passe *</Label>
            <Input
              id="sca-password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">8 caractères minimum. Aucune autre exigence n’est imposée.</p>
          </div>
          <div className="space-y-2">
            <Label>Rôle</Label>
            <RoleChoices value={role} onChange={setRole} disabled={pending} />
          </div>
          <DialogError message={localError ?? error} />
          <JournalisedMention />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" className="h-10 rounded-xl font-bold" disabled={pending} data-testid="create-account-submit">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {pending ? "Création…" : "Créer le compte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Renommer                                                            */
/* ------------------------------------------------------------------ */

export function RenameAccountDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccessActionAccount | null;
  onSubmit: (name: string) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(account?.name ?? "");
  }, [account, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer le compte</DialogTitle>
          <DialogDescription>
            Le nom sert à identifier la personne dans les listes. Il ne change ni l’adresse de connexion, ni le rôle, ni
            le mot de passe.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            onSubmit(name);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="sra-name">Nom affiché</Label>
            <Input id="sra-name" value={name} onChange={event => setName(event.target.value)} placeholder="Laisser vide pour effacer" />
            <p className="text-[11px] text-muted-foreground">
              Compte : {account ? accessAccountLabel(account) : "—"} · {account?.email ?? "sans adresse"}
            </p>
          </div>
          <DialogError message={error} />
          <JournalisedMention />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" className="h-10 rounded-xl font-bold" disabled={pending} data-testid="rename-account-submit">
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Changer de rôle                                                     */
/* ------------------------------------------------------------------ */

/**
 * Changement de rôle — CONFIRMÉ, et l’écran dit ce que le changement fait perdre.
 *
 * La rétrogradation d’un compte système est le geste qui retire l’accès à la
 * console : il faut le nommer, sinon l’opérateur croit ajuster un libellé. Le
 * serveur, lui, refusera de toute façon de retirer le dernier compte système —
 * ce dialogue ne remplace pas ce garde-fou, il l’annonce.
 */
export function ChangeRoleDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccessActionAccount | null;
  onSubmit: (role: StaffAssignableRole) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [role, setRole] = useState<StaffAssignableRole>("cadre");

  useEffect(() => {
    const initial = account?.role;
    setRole(initial && initial !== "client" ? (initial as StaffAssignableRole) : "cadre");
  }, [account, open]);

  const perdLaConsole = account?.role === "systeme" && role !== "systeme";
  const gagneLaConsole = account?.role !== "systeme" && role === "systeme";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer le rôle</DialogTitle>
          <DialogDescription>
            Le rôle décide de ce que le compte peut ouvrir. Le changement prend effet à sa prochaine requête : les
            procédures vérifient le rôle à chaque appel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{account ? accessAccountLabel(account) : "—"}</strong>{" "}
            <span className="text-muted-foreground">
              · {account?.email ?? "sans adresse"} · rôle actuel : {account ? roleLabel(account.role) : "—"}
            </span>
          </p>
          <div className="space-y-2">
            <Label>Nouveau rôle</Label>
            <RoleChoices value={role} onChange={setRole} disabled={pending} />
          </div>
          {perdLaConsole && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
              Ce changement RETIRE l’accès à la console d’exploitation. Le serveur refusera si ce compte est le dernier
              à porter le rôle d’administration système.
            </p>
          )}
          {gagneLaConsole && (
            <p className="rounded-xl border border-border bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
              Ce changement OUVRE l’accès à la console d’exploitation — sous réserve que la double authentification soit
              activée sur ce compte, sans quoi la console lui restera fermée.
            </p>
          )}
          <DialogError message={error} />
          <JournalisedMention />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl font-bold"
              disabled={pending || role === account?.role}
              onClick={() => onSubmit(role)}
              data-testid="change-role-submit"
            >
              {pending ? "Enregistrement…" : "Confirmer le changement"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Réinitialiser le mot de passe                                       */
/* ------------------------------------------------------------------ */

export function ResetPasswordDialog({
  open,
  onOpenChange,
  account,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccessActionAccount | null;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            La console TIRE un mot de passe temporaire et vous le montre une seule fois. L’ancien cesse immédiatement de
            fonctionner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm">
            Compte visé : <strong>{account ? accessAccountLabel(account) : "—"}</strong>{" "}
            <span className="text-muted-foreground">· {account?.email ?? "sans adresse"}</span>
          </p>
          <p className="rounded-xl border border-border bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
            Les sessions DÉJÀ OUVERTES sur ce compte restent valides : un changement de mot de passe ne les ferme pas.
            Pour couper un accès immédiatement, révoquez-les depuis l’écran « Sessions actives ».
          </p>
          <DialogError message={error} />
          <JournalisedMention />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" className="h-10 rounded-xl font-bold" onClick={onConfirm} disabled={pending} data-testid="reset-password-submit">
              {pending ? "Réinitialisation…" : "Réinitialiser et afficher le mot de passe"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Supprimer un compte                                                 */
/* ------------------------------------------------------------------ */

/**
 * Suppression — LA PLUS GARDÉE.
 *
 * Le bouton n’existe pas tant que l’identité du compte n’a pas été recopiée
 * exactement. Ce n’est pas une formalité : c’est ce qui empêche une suppression
 * faite « sur la mauvaise ligne » d’un tableau où les noms se ressemblent.
 */
export function RemoveAccountDialog({
  open,
  onOpenChange,
  account,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccessActionAccount | null;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
  }, [account, open]);

  const attendu = account ? removalConfirmationText(account) : "";
  const confirme = account ? removalConfirmed(account, typed) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer le compte</DialogTitle>
          <DialogDescription>
            Cette action est IRRÉVERSIBLE : le compte est retiré, ses accès sont fermés, et rien ne le rétablit. Les
            documents qu’il a créés restent en place.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/70">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
            <p className="text-xs leading-5 text-rose-900 dark:text-rose-200">
              Compte visé : <strong>{account ? accessAccountLabel(account) : "—"}</strong>
              {account?.email ? ` · ${account.email}` : ""} · rôle {account ? roleLabel(account.role) : "—"}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sda-confirm">
              Pour confirmer, recopiez <span className="font-mono font-bold">{attendu}</span>
            </Label>
            <Input
              id="sda-confirm"
              value={typed}
              onChange={event => setTyped(event.target.value)}
              autoComplete="off"
              data-testid="remove-account-confirm-input"
            />
          </div>

          <DialogError message={error} />
          <JournalisedMention />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-10 rounded-xl font-bold"
              disabled={pending || !confirme}
              onClick={onConfirm}
              data-testid="remove-account-submit"
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

export function InviteDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { email: string; role: StaffAssignableRole }) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffAssignableRole>("cadre");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("cadre");
      setLocalError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter par e-mail</DialogTitle>
          <DialogDescription>
            L’invité choisit lui-même son mot de passe : l’administrateur n’en voit jamais aucun. Le lien vaut 72 heures.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setLocalError("Adresse e-mail invalide.");
            setLocalError(null);
            onSubmit({ email: email.trim(), role });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="sia-email">E-mail de la personne *</Label>
            <Input id="sia-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Rôle à l’acceptation</Label>
            <RoleChoices value={role} onChange={setRole} disabled={pending} />
          </div>
          <DialogError message={localError ?? error} />
          <JournalisedMention />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" className="h-10 rounded-xl font-bold" disabled={pending} data-testid="invite-submit">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              {pending ? "Émission…" : "Émettre l’invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Révocation d’une invitation : un accès qui n’a pas encore été ouvert. */
export function RevokeInvitationDialog({
  open,
  onOpenChange,
  invitation,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitation: AccessActionInvitation | null;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Révoquer l’invitation</DialogTitle>
          <DialogDescription>
            Le lien cesse immédiatement d’être utilisable. L’invité recevra un refus s’il clique dessus, et aucune
            explication ne lui sera donnée.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/70">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-xs leading-5 text-amber-950 dark:text-amber-200">
              Invitation visée : <strong>{invitation?.email ?? "—"}</strong>
              {invitation ? ` · rôle ${invitation.roleLabel}` : ""}. Si l’e-mail n’est simplement pas arrivé, préférez
              « Renvoyer » : la révocation oblige à repartir de zéro.
            </p>
          </div>
          <DialogError message={error} />
          <JournalisedMention />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={() => onOpenChange(false)} disabled={pending}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-10 rounded-xl font-bold"
              onClick={onConfirm}
              disabled={pending}
              data-testid="revoke-invitation-submit"
            >
              {pending ? "Révocation…" : "Révoquer l’invitation"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Rappel d’en-tête                                                    */
/* ------------------------------------------------------------------ */

/**
 * Bandeau de tête de l’écran AGISSANT. Il remplace le bandeau « consultation
 * seule » : l’écran n’est plus le même, il ne peut pas dire la même chose.
 */
export function AccessAdministrationBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-extrabold">Administration des comptes</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Créer, renommer, changer un rôle, réinitialiser un mot de passe, supprimer, inviter.{" "}
          <strong className="font-extrabold text-foreground">Les actions sont journalisées</strong> côté serveur avec leur
          auteur, le compte visé, l’action et le résultat — y compris les refus. Aucun mot de passe, aucun jeton n’est
          journalisé. Les garde-fous d’instance restent appliqués : le dernier compte d’administration système ne peut
          être ni rétrogradé ni supprimé, et personne ne peut se retirer soi-même.
        </p>
      </div>
    </div>
  );
}

/** Icône d’avertissement réutilisée par la liste des invitations en attente. */
export function ExpiredInvitationMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-900 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
      <TriangleAlert className="h-3 w-3" />
      Échue
    </span>
  );
}
