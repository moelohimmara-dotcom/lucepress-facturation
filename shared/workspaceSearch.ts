export type WorkspaceSearchKind = "client" | "devis" | "facture" | "creance";
export type WorkspaceSearchSort = "relevance" | "date" | "status" | "amount";
export type WorkspaceSearchDirection = "asc" | "desc";

export type WorkspaceSearchFilters = {
  kind?: WorkspaceSearchKind;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  amountMin?: number;
  amountMax?: number;
  sortBy?: WorkspaceSearchSort;
  sortDirection?: WorkspaceSearchDirection;
};

export type WorkspaceSearchResult = {
  id: number;
  kind: WorkspaceSearchKind;
  title: string;
  subtitle: string;
  href: string;
  date?: Date | string | null;
  status?: string | null;
  amount?: number | null;
};

type SearchClient = { id: number; companyName: string; contactName?: string | null; email?: string | null; phone?: string | null; createdAt?: Date | string | null; updatedAt?: Date | string | null };
type SearchDocument = { id: number; kind: "devis" | "facture"; number: string; clientName: string; status: string; projectName?: string | null; issueDate?: Date | string | null; total?: number | null };
type SearchReceivable = { id: number; number: string; clientName: string; balanceDue: number; collectionStatus?: string | null; issueDate?: Date | string | null; dueDate?: Date | string | null };

type IndexedSearchEntry = {
  result: WorkspaceSearchResult;
  terms: (string | null | undefined)[];
};

export function normalizeWorkspaceSearch(value: string) {
  return value.trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function dayTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : new Date(timestamp).setHours(0, 0, 0, 0);
}

function matchesFilters(result: WorkspaceSearchResult, filters: WorkspaceSearchFilters) {
  if (filters.kind && result.kind !== filters.kind) return false;
  const timestamp = dayTimestamp(result.date);
  const from = dayTimestamp(filters.dateFrom);
  const to = dayTimestamp(filters.dateTo);
  if ((from !== null || to !== null) && timestamp === null) return false;
  if (from !== null && timestamp! < from) return false;
  if (to !== null && timestamp! > to) return false;
  if (filters.status && result.status !== filters.status) return false;
  if (filters.amountMin !== undefined && (result.amount === null || result.amount === undefined || result.amount < filters.amountMin)) return false;
  if (filters.amountMax !== undefined && (result.amount === null || result.amount === undefined || result.amount > filters.amountMax)) return false;
  return true;
}

function compareNullable(left: number | string | null | undefined, right: number | string | null | undefined, direction: WorkspaceSearchDirection) {
  const leftMissing = left === null || left === undefined || left === "";
  const rightMissing = right === null || right === undefined || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  const comparison = left < right ? -1 : left > right ? 1 : 0;
  return direction === "asc" ? comparison : -comparison;
}

export function buildWorkspaceSearchResults(input: { query: string; clients: readonly SearchClient[]; documents: readonly SearchDocument[]; receivables: readonly SearchReceivable[]; filters?: WorkspaceSearchFilters }) {
  const query = normalizeWorkspaceSearch(input.query);
  const filters = input.filters || {};
  if (query.length < 2) return [] as WorkspaceSearchResult[];
  const indexed: IndexedSearchEntry[] = [
    ...input.clients.map(client => ({ result: { id: client.id, kind: "client" as const, title: client.companyName, subtitle: ["Client", client.contactName || client.email || client.phone].filter(Boolean).join(" · "), href: `/clients?clientId=${client.id}`, date: client.updatedAt || client.createdAt || null, status: null, amount: null }, terms: [client.companyName, client.contactName, client.email, client.phone] })),
    ...input.documents.map(document => ({ result: { id: document.id, kind: document.kind, title: document.number, subtitle: [document.clientName, document.projectName, document.status].filter(Boolean).join(" · "), href: `/documents/${document.id}`, date: document.issueDate || null, status: document.status, amount: document.total ?? null }, terms: [document.number, document.clientName, document.projectName, document.status] })),
    ...input.receivables.map(receivable => ({ result: { id: receivable.id, kind: "creance" as const, title: receivable.number, subtitle: ["Créance", receivable.clientName, receivable.collectionStatus].filter(Boolean).join(" · "), href: `/creances?facture=${receivable.id}`, date: receivable.dueDate || receivable.issueDate || null, status: receivable.collectionStatus, amount: receivable.balanceDue }, terms: [receivable.number, receivable.clientName, receivable.collectionStatus] })),
  ];
  return indexed
    .map(entry => ({ ...entry, normalized: entry.terms.filter(Boolean).map(term => normalizeWorkspaceSearch(String(term))) }))
    .filter(entry => entry.normalized.some(term => term.includes(query)) && matchesFilters(entry.result, filters))
    .sort((left, right) => {
      const direction = filters.sortDirection || "desc";
      if (filters.sortBy === "date") return compareNullable(dayTimestamp(left.result.date), dayTimestamp(right.result.date), direction);
      if (filters.sortBy === "amount") return compareNullable(left.result.amount, right.result.amount, direction);
      if (filters.sortBy === "status") return compareNullable(normalizeWorkspaceSearch(left.result.status || ""), normalizeWorkspaceSearch(right.result.status || ""), direction);
      return Number(right.normalized.some(term => term.startsWith(query))) - Number(left.normalized.some(term => term.startsWith(query))) || left.result.title.localeCompare(right.result.title, "fr");
    })
    .slice(0, 24)
    .map(entry => entry.result);
}
