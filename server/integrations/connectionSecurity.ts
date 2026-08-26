export type PreparedIntegrationConnectionValues = {
  status: "credentials_pending";
  grantedScopes: null;
  secretRef: null;
  lastError: null;
  lastHealthCheckAt: null;
  enabledById: number;
  connectedAt: null;
};

const opaqueReferencePattern = /^integrations\/[a-z0-9/_-]{3,255}$/i;

/** La préparation ne reçoit ni ne conserve jamais une valeur de secret. */
export function createPreparedIntegrationConnectionValues(userId: number): PreparedIntegrationConnectionValues {
  return {
    status: "credentials_pending",
    grantedScopes: null,
    secretRef: null,
    lastError: null,
    lastHealthCheckAt: null,
    enabledById: userId,
    connectedAt: null,
  };
}

/** Utilisable ultérieurement par un flux serveur OAuth ; les secrets réels restent dans le coffre. */
export function assertOpaqueIntegrationSecretReference(secretRef: string) {
  if (!opaqueReferencePattern.test(secretRef)) throw new Error("La connexion ne peut conserver qu’une référence de secret opaque.");
  return secretRef;
}
