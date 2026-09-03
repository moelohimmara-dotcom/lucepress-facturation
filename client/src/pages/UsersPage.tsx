import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ShieldCheck, Trash2, UserCog, UserPlus, KeyRound, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { APP_ROLE_LABELS, type AppRole } from "@shared/roles";

type UserRow = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: AppRole;
  loginMethod: string | null;
  lastSignedIn: Date | string;
  createdAt: Date | string;
};

function formatDate(value: Date | string) {
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function UsersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: invitations = [] } = trpc.users.listInvitations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [openDialog, setOpenDialog] = useState<null | "create" | "reset" | "remove" | "invite">(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Compte collaborateur créé.");
      setOpenDialog(null);
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const inviteMutation = trpc.users.invite.useMutation({
    onSuccess: (data) => {
      setInviteLink(data.invitationLink);
      utils.users.listInvitations.invalidate();
      if (data.emailed) {
        toast.success(`Invitation envoyée à ${data.email}.`);
      } else if (!data.smtpConfigured) {
        toast.message("Invitation créée — SMTP non configuré, copiez le lien.");
      } else {
        toast.message(data.emailError ? `E-mail non envoyé : ${data.emailError}` : "Invitation créée — copiez le lien.");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const setRoleMutation = trpc.users.setRole.useMutation({
    onSuccess: () => {
      toast.success("Rôle mis à jour.");
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Mot de passe réinitialisé.");
      setOpenDialog(null);
      setSelected(null);
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.users.remove.useMutation({
    onSuccess: () => {
      toast.success("Compte supprimé.");
      setOpenDialog(null);
      setSelected(null);
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.users.revokeInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation révoquée.");
      utils.users.listInvitations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl py-20 text-center">
          <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="font-editorial text-2xl font-semibold">Accès réservé aux administrateurs</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seul un administrateur peut gérer les comptes de l'entreprise.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Administration</p>
            <h1 className="font-editorial mt-2 text-3xl font-semibold">Comptes collaborateurs</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Créez des comptes pour votre équipe, ajustez leurs droits, réinitialisez un mot de passe
              bloqué ou révoquez un accès.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setInviteLink(null); setOpenDialog("invite"); }} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground">
              <Mail className="mr-2 h-4 w-4" /> Inviter par e-mail
            </Button>
            <Button variant="outline" onClick={() => setOpenDialog("create")} className="h-10 rounded-xl font-bold">
              <UserPlus className="mr-2 h-4 w-4" /> Nouveau compte
            </Button>
          </div>
        </header>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Membres</CardTitle>
            <CardDescription>{users.length} compte(s) sur cette instance.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.name || u.email || "(sans nom)"}</span>
                        {u.role === "admin" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">Admin</span>
                        ) : (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{APP_ROLE_LABELS[u.role]}</span>
                        )}
                        {u.id === user?.id && <span className="text-[11px] text-muted-foreground">(vous)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Dernière connexion : {formatDate(u.lastSignedIn)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {u.id !== user?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRoleMutation.mutate({ userId: u.id, role: u.role === "admin" ? "cadre" : "admin" })}
                          disabled={setRoleMutation.isPending}
                        >
                          <UserCog className="mr-1 h-4 w-4" />
                          {u.role === "admin" ? "Rétrograder" : "Promouvoir admin"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelected(u); setOpenDialog("reset"); }}
                      >
                        <KeyRound className="mr-1 h-4 w-4" /> Réinitialiser le mot de passe
                      </Button>
                      {u.id !== user?.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { setSelected(u); setOpenDialog("remove"); }}
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Supprimer
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Invitations en attente</CardTitle>
            <CardDescription>
              Liens valables 72 heures. L’e-mail d’invitation part automatiquement si SMTP est configuré.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.filter((i) => i.status === "pending").length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune invitation en attente.</p>
            ) : (
              <ul className="divide-y divide-border">
                {invitations
                  .filter((i) => i.status === "pending")
                  .map((inv) => (
                    <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Expire le {formatDate(inv.expiresAt)} · {APP_ROLE_LABELS[inv.role]}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate({ id: inv.id })}
                        disabled={revokeMutation.isPending}
                      >
                        Révoquer
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog création */}
      <Dialog open={openDialog === "create"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau compte collaborateur</DialogTitle>
            <DialogDescription>Le collaborateur recevra ses identifiants directement de votre part.</DialogDescription>
          </DialogHeader>
          <CreateUserForm
            onSubmit={(values) => createMutation.mutate(values)}
            pending={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog invitation */}
      <Dialog open={openDialog === "invite"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un collaborateur</DialogTitle>
            <DialogDescription>
              Un e-mail d’invitation (valable 72 h) est envoyé si SMTP est configuré.
              Sinon, copiez le lien et transmettez-le vous-même.
            </DialogDescription>
          </DialogHeader>
          {inviteLink ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Lien d'invitation :</p>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="font-mono text-xs" />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    toast.success("Lien copié.");
                  }}
                >
                  Copier
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Conservez ce lien en secours. Ne le partagez pas publiquement.
              </p>
            </div>
          ) : (
            <InviteForm
              onSubmit={(values) => inviteMutation.mutate(values)}
              pending={inviteMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog réinitialisation */}
      <Dialog open={openDialog === "reset"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Pour {selected?.email}. Le nouveau mot de passe remplacera l'ancien immédiatement.
            </DialogDescription>
          </DialogHeader>
          <ResetForm
            email={selected?.email ?? ""}
            onSubmit={(newPassword) => resetMutation.mutate({ userId: selected!.id, newPassword })}
            pending={resetMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={openDialog === "remove"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le compte</DialogTitle>
            <DialogDescription>
              Confirmer la suppression de {selected?.email} ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => removeMutation.mutate({ userId: selected!.id })} disabled={removeMutation.isPending}>
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CreateUserForm({
  onSubmit,
  pending,
}: {
  onSubmit: (v: { email: string; name?: string; password: string; role: AppRole }) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("cadre");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Adresse e-mail invalide.");
    if (password.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
    setError(null);
    onSubmit({ email, name: name || undefined, password, role });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cu-email">E-mail *</Label>
        <Input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cu-name">Nom (optionnel)</Label>
        <Input id="cu-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cu-pw">Mot de passe temporaire *</Label>
        <Input id="cu-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Rôle</Label>
        <div className="flex gap-2">
          <Button type="button" variant={role === "cadre" ? "default" : "outline"} size="sm" onClick={() => setRole("cadre")}>Cadre</Button>
          <Button type="button" variant={role === "directeur" ? "default" : "outline"} size="sm" onClick={() => setRole("directeur")}>Directeur</Button>
          <Button type="button" variant={role === "admin" ? "default" : "outline"} size="sm" onClick={() => setRole("admin")}>Admin</Button>
        </div>
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Création…" : "Créer le compte"}
      </Button>
    </form>
  );
}

function ResetForm({
  email,
  onSubmit,
  pending,
}: {
  email: string;
  onSubmit: (newPassword: string) => void;
  pending: boolean;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
    setError(null);
    onSubmit(password);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rf-pw">Nouveau mot de passe pour {email} *</Label>
        <Input id="rf-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Réinitialisation…" : "Définir le nouveau mot de passe"}
      </Button>
    </form>
  );
}

function InviteForm({
  onSubmit,
  pending,
}: {
  onSubmit: (v: { email: string; name?: string; role: AppRole }) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("cadre");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Adresse e-mail invalide.");
    setError(null);
    onSubmit({ email, role });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inv-email">E-mail du collaborateur *</Label>
        <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Rôle</Label>
        <div className="flex gap-2">
          <Button type="button" variant={role === "cadre" ? "default" : "outline"} size="sm" onClick={() => setRole("cadre")}>Cadre</Button>
          <Button type="button" variant={role === "directeur" ? "default" : "outline"} size="sm" onClick={() => setRole("directeur")}>Directeur</Button>
          <Button type="button" variant={role === "admin" ? "default" : "outline"} size="sm" onClick={() => setRole("admin")}>Admin</Button>
        </div>
      </div>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Génération du lien…" : "Générer le lien d'invitation"}
      </Button>
    </form>
  );
}
