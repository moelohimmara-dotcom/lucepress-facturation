function requireEnv(name: string, value: string | undefined, minLen = 1): string {
  if (!value || value.trim().length < minLen) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[ENV] ${name} manquant ou trop court (min ${minLen}). Vérifie .env`);
    }
    console.warn(`[ENV] ${name} manquant — mode dev, valeur vide autorisée`);
    return value ?? "";
  }
  return value;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: requireEnv("JWT_SECRET", process.env.JWT_SECRET, 32),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
