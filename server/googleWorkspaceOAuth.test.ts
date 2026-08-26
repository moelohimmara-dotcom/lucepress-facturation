import { describe, expect, it } from "vitest";
import { buildGoogleWorkspaceAuthorizationUrl, normalizeGoogleWorkspaceScopes } from "../shared/googleWorkspaceOAuth";

describe("parcours OAuth Google Workspace", () => {
  it("ne conserve que les scopes Google approuvés et exige au moins une autorisation", () => {
    expect(normalizeGoogleWorkspaceScopes(["https://www.googleapis.com/auth/calendar.readonly", "unsupported", "https://www.googleapis.com/auth/calendar.readonly"])).toEqual(["https://www.googleapis.com/auth/calendar.readonly"]);
    expect(() => normalizeGoogleWorkspaceScopes(["unsupported"])).toThrow("au moins une autorisation");
  });

  it("construit une autorisation serveur avec état, consentement et accès hors ligne", () => {
    const url = new URL(buildGoogleWorkspaceAuthorizationUrl({ clientId: "client.apps.googleusercontent.com", redirectUri: "https://lucepress.example/callback/google", scopes: ["https://www.googleapis.com/auth/calendar.readonly"], state: "csrf-state" }));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });
});
