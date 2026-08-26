import React from "react";
import type { SavedClient } from "../../../shared/clientPrefill";

export function ClientPrefillCard({ client }: { client: SavedClient }) {
  const contactDetails = [client.contactName, client.email, client.phone].filter(Boolean).join(" · ");
  return <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4 sm:col-span-2" data-testid="client-prefill-card"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">Informations client préremplies</p><p className="mt-2 text-sm font-extrabold">{client.companyName}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{contactDetails || "Coordonnées à compléter dans le répertoire clients."}</p>{client.address && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">{client.address}</p>}<p className="mt-2 text-xs font-semibold text-primary">Ces informations seront reprises automatiquement dans l’aperçu et le PDF.</p></div>;
}
