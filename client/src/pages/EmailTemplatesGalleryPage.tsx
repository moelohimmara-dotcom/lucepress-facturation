import DashboardLayout from "@/components/DashboardLayout";
import { EMAIL_TEMPLATES, type EmailTemplate } from "@/shared/emailTemplates";
import { Mail, FileText, MessageSquare, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, typeof Mail> = {
  invitation: Mail,
  "password-reset": CheckCircle2,
  "quote-sent": FileText,
  "invoice-sent": FileText,
  "payment-reminder": MessageSquare,
  welcome: CheckCircle2,
};

const colorMap: Record<string, string> = {
  invitation: "bg-blue-500/10 text-blue-600",
  "password-reset": "bg-amber-500/10 text-amber-600",
  "quote-sent": "bg-emerald-500/10 text-emerald-600",
  "invoice-sent": "bg-violet-500/10 text-violet-600",
  "payment-reminder": "bg-rose-500/10 text-rose-600",
  welcome: "bg-teal-500/10 text-teal-600",
};

export default function EmailTemplatesGalleryPage() {
  const [selected, setSelected] = useState<EmailTemplate | null>(null);

  return (
    <DashboardLayout
      title="Modèles d'e-mail"
      subtitle="Bibliothèque de modèles prêts à l'emploi pour vos communications."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EMAIL_TEMPLATES.map((template) => {
          const Icon = iconMap[template.id] || Mail;
          const color = colorMap[template.id] || "bg-gray-500/10 text-gray-600";

          return (
            <div
              key={template.id}
              className="border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all bg-card"
              onClick={() => setSelected(template)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{template.name}</h3>
                  <p className="text-xs text-muted-foreground">{template.id}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
              <div className="flex flex-wrap gap-1">
                {template.variables.slice(0, 3).map((v) => (
                  <span key={v} className="text-xs bg-muted px-2 py-0.5 rounded">{`{{${v}}}`}</span>
                ))}
                {template.variables.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{template.variables.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de détail */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Objet</h4>
                <p className="text-sm bg-muted rounded p-2">{selected.subject}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Variables</h4>
                <div className="flex flex-wrap gap-1">
                  {selected.variables.map((v) => (
                    <span key={v} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Aperçu HTML</h4>
                <div className="border rounded-lg bg-white overflow-hidden" dangerouslySetInnerHTML={{ __html: selected.html }} />
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Version texte</h4>
                <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap">{selected.text}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
