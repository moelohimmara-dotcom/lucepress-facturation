import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Mail, Plus, Eye, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type EmailTemplate = {
  id: number;
  tenantId: number | null;
  slug: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  enabled: boolean;
};

const emptyTemplate = { name: "", subject: "", html: "", text: "" };

export default function EmailTemplatesPage() {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.emailTemplates.list.useQuery();
  const [editing, setEditing] = useState<null | EmailTemplate>(null);
  const [draft, setDraft] = useState(emptyTemplate);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft({ name: editing.name, subject: editing.subject, html: editing.html, text: editing.text ?? "" });
    }
  }, [editing]);

  const createMut = trpc.emailTemplates.create.useMutation({
    onSuccess: () => { utils.emailTemplates.list.invalidate(); toast.success("Template créé."); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.emailTemplates.update.useMutation({
    onSuccess: () => { utils.emailTemplates.list.invalidate(); toast.success("Template mis à jour."); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.emailTemplates.delete.useMutation({
    onSuccess: () => { utils.emailTemplates.list.invalidate(); toast.success("Template supprimé."); setEditing(null); },
    onError: (e) => toast.error(e.message),
  });



  // Preview local (fallback si l'API preview n'existe pas)
  function renderLocalPreview(html: string): string {
    let result = html;
    const sampleVars: Record<string, string> = {
      inviteLink: "https://lucepress.com/invite/abc123",
      inviterName: "Malika Morgan",
      organization: "Lucepress SARL",
      expiresAt: "15 septembre 2026",
      resetLink: "https://lucepress.com/reset/xyz789",
    };
    for (const [key, value] of Object.entries(sampleVars)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
    }
    return result;
  }

  function startNew() {
    setEditing({ id: 0, tenantId: null, slug: "", name: "", subject: "", html: "", text: "", enabled: true });
    setDraft(emptyTemplate);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (editing.id === 0) {
      createMut.mutate({ ...draft, slug: draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    } else {
      updateMut.mutate({ id: editing.id, data: draft });
    }
  }

  function requestDelete(t: EmailTemplate) {
    if (confirm(`Supprimer le template "${t.name}" ?`)) deleteMut.mutate({ id: t.id });
  }

  return (
    <DashboardLayout title="Templates d'e-mail" subtitle="Modifiez les e-mails envoyés automatiquement (invitations, réinitialisation, etc.).">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
          <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> Nouveau template</Button>
        </div>

        {isLoading && <p>Chargement...</p>}

        {/* Liste des templates */}
        {!isLoading && templates.length > 0 && (
          <div className="grid gap-3">
            {templates.map((t) => (
              <div key={t.id} className="border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Mail className="h-4 w-4" />
                    {t.name}
                    {t.tenantId === null && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Global</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewHtml(renderLocalPreview(t.html))}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => requestDelete(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Éditeur */}
        {editing && (
          <form onSubmit={submit} className="border rounded-xl p-5 space-y-4 bg-card">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">{editing.id === 0 ? "Nouveau template" : `Modifier: ${editing.name}`}</h3>
              <button type="button" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nom *</label>
                <input className="w-full mt-1 px-3 py-2 border rounded-lg" value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium">Objet *</label>
                <input className="w-full mt-1 px-3 py-2 border rounded-lg" value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium">HTML * (variables: <code>{"{{inviteLink}}"}</code>, <code>{"{{inviterName}}"}</code>, <code>{"{{organization}}"}</code>, <code>{"{{expiresAt}}"}</code>, <code>{"{{resetLink}}"}</code>)</label>
                <textarea className="w-full mt-1 px-3 py-2 border rounded-lg font-mono text-xs" rows={10} value={draft.html}
                  onChange={(e) => setDraft({ ...draft, html: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium">Texte brut (fallback)</label>
                <textarea className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" rows={4} value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            </div>
          </form>
        )}

        {/* Prévisualisation */}
        {previewHtml && (
          <div className="border rounded-xl p-5 bg-card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Prévisualisation</h3>
              <button onClick={() => setPreviewHtml(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="border rounded-lg bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
