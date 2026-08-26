export const GOOGLE_WORKSPACE_SCOPE_OPTIONS = [
  { value: "https://www.googleapis.com/auth/calendar.readonly", label: "Lire les calendriers autorisés" },
  { value: "https://www.googleapis.com/auth/calendar.events", label: "Créer des échéances de chantier" },
  { value: "https://www.googleapis.com/auth/drive.file", label: "Archiver les documents créés par Lucepres" },
] as const;

const allowedScopes = new Set(GOOGLE_WORKSPACE_SCOPE_OPTIONS.map(scope => scope.value));

export function normalizeGoogleWorkspaceScopes(scopes: string[]) {
  const unique = Array.from(new Set(scopes.filter(scope => allowedScopes.has(scope as typeof GOOGLE_WORKSPACE_SCOPE_OPTIONS[number]["value"]))));
  if (!unique.length) throw new Error("Sélectionnez au moins une autorisation Google Workspace.");
  return unique;
}

export function buildGoogleWorkspaceAuthorizationUrl(input: { clientId: string; redirectUri: string; scopes: string[]; state: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: input.state,
  }).toString();
  return url.toString();
}
