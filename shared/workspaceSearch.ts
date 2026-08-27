export type WorkspaceSearchResult = {
  id: number;
  kind: "client" | "devis" | "facture" | "creance";
  title: string;
  subtitle: string;
  href: string;
};

type SearchClient = { id: number; companyName: string; contactName?: string | null; email?: string | null; phone?: string | null };
type SearchDocument = { id: number; kind: "devis" | "facture"; number: string; clientName: string; status: string; projectName?: string | null };
type SearchReceivable = { id: number; number: string; clientName: string; balanceDue: number; collectionStatus?: string | null };

export function normalizeWorkspaceSearch(value: string) {
  return value.trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function buildWorkspaceSearchResults(input: { query: string; clients: readonly SearchClient[]; documents: readonly SearchDocument[]; receivables: readonly SearchReceivable[] }) {
  const query = normalizeWorkspaceSearch(input.query);
  if (query.length < 2) return [] as WorkspaceSearchResult[];
  const indexed = [
    ...input.clients.map(client => ({ result: { id: client.id, kind: "client" as const, title: client.companyName, subtitle: ["Client", client.contactName || client.email || client.phone].filter(Boolean).join(" · "), href: `/clients?clientId=${client.id}` }, terms: [client.companyName, client.contactName, client.email, client.phone] })),
    ...input.documents.map(document => ({ result: { id: document.id, kind: document.kind, title: document.number, subtitle: [document.clientName, document.projectName, document.status].filter(Boolean).join(" · "), href: `/documents/${document.id}` }, terms: [document.number, document.clientName, document.projectName, document.status] })),
    ...input.receivables.map(receivable => ({ result: { id: receivable.id, kind: "creance" as const, title: receivable.number, subtitle: ["Créance", receivable.clientName, receivable.collectionStatus].filter(Boolean).join(" · "), href: `/creances?facture=${receivable.id}` }, terms: [receivable.number, receivable.clientName, receivable.collectionStatus] })),
  ];
  return indexed
    .map(entry => ({ ...entry, normalized: entry.terms.filter(Boolean).map(term => normalizeWorkspaceSearch(String(term))) }))
    .filter(entry => entry.normalized.some(term => term.includes(query)))
    .sort((left, right) => Number(right.normalized.some(term => term.startsWith(query))) - Number(left.normalized.some(term => term.startsWith(query))) || left.result.title.localeCompare(right.result.title, "fr"))
    .slice(0, 24)
    .map(entry => entry.result);
}
