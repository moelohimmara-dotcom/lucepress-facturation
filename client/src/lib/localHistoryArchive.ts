export type ArchivedSimulationDecision = {
  id: string;
  providerName: string;
  operation: string;
  payloadHash: string;
  createdAt: Date;
  decidedAt: Date;
  decision: "approve" | "reject";
};

export const LOCAL_HISTORY_ARCHIVE_COLUMNS = ["Statut", "Fournisseur", "Opération", "Empreinte", "Créée le", "Décidée le", "Portée"] as const;
const MAX_ARCHIVE_BYTES = 1_000_000;
const MAX_ARCHIVE_ROWS = 500;

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatFileStamp(value = new Date()) {
  return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, "0")}${String(value.getDate()).padStart(2, "0")}-${String(value.getHours()).padStart(2, "0")}${String(value.getMinutes()).padStart(2, "0")}${String(value.getSeconds()).padStart(2, "0")}`;
}

export function formatLocalArchiveFilename(value = new Date()) {
  return `lucepress-archive-historique-local-${formatFileStamp(value)}.csv`;
}

export function createLocalHistoryArchive(history: ArchivedSimulationDecision[], generatedAt = new Date()) {
  const rows = [
    ["Archive Lucepres — historique local des simulations"],
    [`Générée le ${generatedAt.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "medium" })}`],
    [],
    [...LOCAL_HISTORY_ARCHIVE_COLUMNS],
    ...history.map(entry => [entry.decision === "approve" ? "Approuvée" : "Refusée", entry.providerName, entry.operation, entry.payloadHash, entry.createdAt.toISOString(), entry.decidedAt.toISOString(), "Simulation locale · archive complète"]),
  ];
  return `\uFEFF${rows.map(row => row.map(value => csvCell(value ?? "")).join(";")).join("\n")}`;
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"') {
      if (quoted && content[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (char === ";" && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && content[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.length)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("L’archive CSV contient une cellule non fermée.");
  row.push(cell);
  if (row.some(value => value.length)) rows.push(row);
  return rows;
}

function parseDate(value: string, label: string, line: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`La ligne ${line} contient une ${label} invalide.`);
  return date;
}

export function parseLocalHistoryArchive(content: string): ArchivedSimulationDecision[] {
  if (new Blob([content]).size > MAX_ARCHIVE_BYTES) throw new Error("L’archive dépasse la taille maximale autorisée de 1 Mo.");
  const rows = parseCsv(content.replace(/^\uFEFF/, ""));
  const headerIndex = rows.findIndex(row => LOCAL_HISTORY_ARCHIVE_COLUMNS.every((column, index) => row[index] === column));
  if (headerIndex < 0) throw new Error("Le format de l’archive Lucepres n’est pas reconnu.");
  const contentRows = rows.slice(headerIndex + 1);
  if (!contentRows.length) throw new Error("Cette archive ne contient aucune décision à restaurer.");
  if (contentRows.length > MAX_ARCHIVE_ROWS) throw new Error("Cette archive contient trop de décisions à restaurer.");
  const unique = new Map<string, ArchivedSimulationDecision>();
  contentRows.forEach((row, rowIndex) => {
    const line = headerIndex + rowIndex + 2;
    const [status, providerName, operation, payloadHash, createdAt, decidedAt, scope] = row;
    if ((status !== "Approuvée" && status !== "Refusée") || scope !== "Simulation locale · archive complète") throw new Error(`La ligne ${line} ne correspond pas à une simulation locale valide.`);
    if (!providerName?.trim() || providerName.length > 120 || !operation?.trim() || operation.length > 300 || !payloadHash?.trim() || payloadHash.length > 300) throw new Error(`La ligne ${line} est incomplète ou dépasse la taille autorisée.`);
    const created = parseDate(createdAt, "date de création", line);
    const decided = parseDate(decidedAt, "date de décision", line);
    const decision: ArchivedSimulationDecision["decision"] = status === "Approuvée" ? "approve" : "reject";
    const entry = { id: `archive-${payloadHash}-${decided.getTime()}-${decision}`, providerName: providerName.trim(), operation: operation.trim(), payloadHash: payloadHash.trim(), createdAt: created, decidedAt: decided, decision };
    unique.set(`${entry.payloadHash}|${entry.decidedAt.toISOString()}|${entry.decision}`, entry);
  });
  return Array.from(unique.values());
}
