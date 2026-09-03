import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { LUCEPRES_PUBLIC_PROFILE } from "@shared/companyProfile";
import { validateCompanyFinancialDetails } from "@shared/companySettingsValidation";
import { IDENTITY_KIND_LABELS, IDENTITY_KINDS, type IdentityKind } from "@shared/identityPaperwork";
import { isAdminRole } from "@shared/roles";
import { AlertTriangle, Building2, FileText, Landmark, Loader2, Mail, Save, ShieldCheck, UserCog } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SettingsDraft = {
  legalName: string;
  legalAddress: string;
  phone: string;
  email: string;
  website: string;
  identityKind: IdentityKind;
  taxId: string;
  registrationNumber: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swift: string;
  paymentInstructions: string;
  documentFooter: string;
};

const emptySettings: SettingsDraft = {
  legalName: LUCEPRES_PUBLIC_PROFILE.legalName,
  legalAddress: LUCEPRES_PUBLIC_PROFILE.location,
  phone: LUCEPRES_PUBLIC_PROFILE.phone,
  email: LUCEPRES_PUBLIC_PROFILE.email,
  website: "",
  identityKind: "immatriculee",
  taxId: "",
  registrationNumber: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  iban: "",
  swift: "",
  paymentInstructions: "",
  documentFooter: LUCEPRES_PUBLIC_PROFILE.documentFooter,
};

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.billing.settings.get.useQuery();
  const { data: mailStatus } = trpc.billing.mailStatus.useQuery();
  const [draft, setDraft] = useState<SettingsDraft>(emptySettings);
  const validationErrors = useMemo(() => validateCompanyFinancialDetails(draft), [draft]);
  const validationEntries = Object.entries(validationErrors);

  useEffect(() => {
    if (!settings) return;
    setDraft({
      legalName: settings.legalName,
      legalAddress: settings.legalAddress || "",
      phone: settings.phone || "",
      email: settings.email || "",
      website: settings.website || "",
      identityKind: settings.identityKind ?? "immatriculee",
      taxId: settings.taxId || "",
      registrationNumber: settings.registrationNumber || "",
      bankName: settings.bankName || "",
      accountName: settings.accountName || "",
      accountNumber: settings.accountNumber || "",
      iban: settings.iban || "",
      swift: settings.swift || "",
      paymentInstructions: settings.paymentInstructions || "",
      documentFooter: settings.documentFooter || LUCEPRES_PUBLIC_PROFILE.documentFooter,
    });
  }, [settings]);

  const save = trpc.billing.settings.save.useMutation({
    onSuccess: () => {
      utils.billing.settings.get.invalidate();
      toast.success("Paramètres entreprise enregistrés et validés.");
    },
    onError: error => toast.error(error.message),
  });

  function update(field: keyof SettingsDraft, value: string) {
    if (!isAdmin) return;
    setDraft(current => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      toast.error("Seuls les administrateurs peuvent modifier les paramètres entreprise.");
      return;
    }
    if (validationEntries.length) {
      return toast.error("Corrigez les coordonnées fiscales ou bancaires signalées avant l’enregistrement.");
    }
    save.mutate(draft);
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">{isAdmin ? "Administration" : "Entreprise"}</p>
            <h1 className="font-editorial mt-2 text-3xl font-semibold">Paramètres entreprise</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {isAdmin
                ? "Personnalisez les coordonnées affichées sur les documents Lucepres et validez les données nécessaires au règlement."
                : "Consultation des coordonnées affichées sur les documents. La modification est réservée à l’administrateur."}
            </p>
          </div>
          {isAdmin ? (
            <Button form="company-settings" type="submit" disabled={save.isPending} className="h-10 rounded-xl bg-primary font-bold text-primary-foreground">
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-950">
              Lecture seule · rôle {user?.role}
            </div>
          )}
        </header>

        {mailStatus && (
        <section className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${mailStatus.smtpConfigured ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          <Mail className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-6">
            {mailStatus.smtpConfigured
              ? "Envoi e-mail opérationnel (SMTP configuré). Devis, factures, relances et invitations partent depuis l’application."
              : "SMTP non configuré. Les envois e-mail (devis, relances, invitations) sont indisponibles jusqu’à renseignement de SMTP_HOST / SMTP_USER / SMTP_PASS."}
          </p>
        </section>
        )}

        {!isAdmin && (
          <section className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-xs leading-5">
              Les comptes, modèles d’e-mail et modèles de devis sont gérés uniquement par l’administrateur.
              Vous pouvez changer votre mot de passe ci-dessous.
            </p>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <SectionHeading icon={ShieldCheck} title="Mon compte" text="Sécurité de l'accès à cet espace." />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => { window.location.href = "/compte/mot-de-passe"; }}>
              <ShieldCheck className="mr-2 h-4 w-4" /> Changer mon mot de passe
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => { window.location.href = "/parametres/utilisateurs"; }}>
                  <UserCog className="mr-2 h-4 w-4" /> Gérer les comptes
                </Button>
                <Button variant="outline" onClick={() => { window.location.href = "/parametres/e-mails"; }}>
                  <Mail className="mr-2 h-4 w-4" /> Templates d'e-mail
                </Button>
                <Button variant="outline" onClick={() => { window.location.href = "/parametres/modeles/documents"; }}>
                  <FileText className="mr-2 h-4 w-4" /> Modèles de devis
                </Button>
              </>
            )}
          </div>
        </section>

        <form id="company-settings" onSubmit={submit} className="mt-6 space-y-6">
          <fieldset disabled={!isAdmin} className="space-y-6 disabled:opacity-90">
            <section className="card-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
              <SectionHeading icon={Building2} title="Identité et mentions légales" text="Ces éléments apparaissent dans l’en-tête et le pied des devis et factures." />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <SettingsField label="Raison sociale *"><input required value={draft.legalName} onChange={e => update("legalName", e.target.value)} readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Téléphone"><input value={draft.phone} onChange={e => update("phone", e.target.value)} placeholder="+224 …" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="E-mail"><input type="email" value={draft.email} onChange={e => update("email", e.target.value)} placeholder="contact@lucepres.com" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Site web"><input value={draft.website} onChange={e => update("website", e.target.value)} placeholder="https://…" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Situation administrative" full>
                  <select value={draft.identityKind} onChange={e => update("identityKind", e.target.value as IdentityKind)} disabled={!isAdmin}>
                    {IDENTITY_KINDS.map(kind => <option key={kind} value={kind}>{IDENTITY_KIND_LABELS[kind]}</option>)}
                  </select>
                </SettingsField>
                <SettingsField label="NIF (facultatif)" error={validationErrors.taxId}><input value={draft.taxId} onChange={e => update("taxId", e.target.value)} placeholder="Laisser vide si inconnu, en cours ou non applicable" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="RCCM (facultatif)" error={validationErrors.registrationNumber}><input value={draft.registrationNumber} onChange={e => update("registrationNumber", e.target.value)} placeholder="Laisser vide si inconnu, en cours ou non applicable" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Adresse légale" full><textarea value={draft.legalAddress} onChange={e => update("legalAddress", e.target.value)} placeholder="Adresse complète de l’entreprise" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Pied de document personnalisé" full><textarea value={draft.documentFooter} onChange={e => update("documentFooter", e.target.value)} placeholder="Conditions générales disponibles sur demande" readOnly={!isAdmin} /></SettingsField>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Vous pouvez enregistrer l’entreprise sans NIF ni RCCM : le PDF n’affichera que ce qui est renseigné, ou une mention du type « immatriculation en cours ». La signature « {LUCEPRES_PUBLIC_PROFILE.documentFooter} » reste intégrée automatiquement à tous les documents.
              </p>
            </section>
            <section className="card-shadow rounded-2xl border border-border bg-card p-5 sm:p-6">
              <SectionHeading icon={Landmark} title="Coordonnées bancaires" text="Facultatives tant qu’elles ne sont pas confirmées. Un NIF ou un RCCM incomplet n’empêche pas d’enregistrer l’identité ci-dessus." />
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Les coordonnées bancaires sont facultatives tant qu’elles ne sont pas confirmées. Dès qu’un élément est saisi, la banque, le titulaire et le numéro de compte deviennent obligatoires.
                </p>
              </div>
              {validationEntries.length > 0 && isAdmin && (
                <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-extrabold">Validation requise</p>
                    <p className="mt-1 text-xs leading-5">{validationEntries.map(([, message]) => message).join(" ")}</p>
                  </div>
                </div>
              )}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <SettingsField label="Banque" error={validationErrors.bankName}><input value={draft.bankName} onChange={e => update("bankName", e.target.value)} readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Titulaire du compte" error={validationErrors.accountName}><input value={draft.accountName} onChange={e => update("accountName", e.target.value)} readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Numéro de compte" error={validationErrors.accountNumber}><input value={draft.accountNumber} onChange={e => update("accountNumber", e.target.value)} readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="IBAN" error={validationErrors.iban}><input value={draft.iban} onChange={e => update("iban", e.target.value.toUpperCase())} placeholder="Facultatif selon la banque" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Code SWIFT / BIC" error={validationErrors.swift}><input value={draft.swift} onChange={e => update("swift", e.target.value.toUpperCase())} placeholder="8 ou 11 caractères" readOnly={!isAdmin} /></SettingsField>
                <SettingsField label="Instructions de règlement" full><textarea value={draft.paymentInstructions} onChange={e => update("paymentInstructions", e.target.value)} placeholder="Ex. Indiquez le numéro de facture en référence du règlement." readOnly={!isAdmin} /></SettingsField>
              </div>
            </section>
          </fieldset>
        </form>
      </div>
    </DashboardLayout>
  );
}

function SectionHeading({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-sm font-extrabold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function SettingsField({ label, children, full = false, error }: { label: string; children: React.ReactNode; full?: boolean; error?: string }) {
  return (
    <label className={`block text-xs font-extrabold ${full ? "sm:col-span-2" : ""}`}>
      {label}
      <div className="mt-2 [&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-border [&_input]:bg-card [&_input]:px-3 [&_input]:text-sm [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-border [&_select]:bg-card [&_select]:px-3 [&_select]:text-sm [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-border [&_textarea]:bg-card [&_textarea]:p-3 [&_textarea]:text-sm">
        {children}
      </div>
      {error && <p role="alert" className="mt-1 text-[11px] font-medium leading-4 text-destructive">{error}</p>}
    </label>
  );
}
