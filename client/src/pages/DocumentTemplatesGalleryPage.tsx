import DashboardLayout from "@/components/DashboardLayout";
import { QUOTE_TEMPLATES, type QuoteTemplate } from "@/shared/quoteTemplates";
import { FileText, Building2, Droplets, Sparkles, Wrench } from "lucide-react";
import { useState } from "react";

const sectorLabels: Record<string, string> = {
  btp: "BTP",
  multiservices: "Multi-services",
};

const sectorColors: Record<string, string> = {
  btp: "bg-amber-500/10 text-amber-600",
  multiservices: "bg-blue-500/10 text-blue-600",
};

const iconMap: Record<string, typeof FileText> = {
  btp_gros_oeuvre: Building2,
  btp_renovation: Building2,
  btp_amenagement: Building2,
  hydraulique: Droplets,
  hygiene: Sparkles,
  maintenance: Wrench,
};

export default function DocumentTemplatesGalleryPage() {
  const [selected, setSelected] = useState<QuoteTemplate | null>(null);

  return (
    <DashboardLayout
      title="Modèles de documents"
      subtitle="Trames de devis prêtes à l'emploi. Sélectionnez un modèle pour préparer un nouveau devis."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUOTE_TEMPLATES.map((template) => {
          const Icon = iconMap[template.id] || FileText;
          const color = sectorColors[template.sector] || "bg-gray-500/10 text-gray-600";

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
                  <h3 className="font-semibold text-sm">{template.label}</h3>
                  <p className="text-xs text-muted-foreground">{sectorLabels[template.sector]}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{template.summary}</p>
              <div className="flex flex-wrap gap-1">
                {template.serviceCodes.slice(0, 3).map((code) => (
                  <span key={code} className="text-xs bg-muted px-2 py-0.5 rounded">{code}</span>
                ))}
                {template.serviceCodes.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{template.serviceCodes.length - 3}</span>
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
                <h2 className="text-lg font-bold">{selected.label}</h2>
                <p className="text-sm text-muted-foreground">{selected.summary}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notes</h4>
                <pre className="text-sm bg-muted rounded p-3 whitespace-pre-wrap">{selected.notes}</pre>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Codes prestations</h4>
                <div className="flex flex-wrap gap-1">
                  {selected.serviceCodes.map((code) => (
                    <span key={code} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{code}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
