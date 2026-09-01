import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexte de tenant par requête.
 *
 * Chaque requête authentifiée (procédure tRPC ou route Express) définit son
 * tenant via `runWithTenant` ; les accès aux tables métier dans `db.ts`
 * filtrent alors automatiquement par `tenantId` sans modifier chaque appelant.
 *
 * Hors contexte de requête (tâches de fond, tests), `currentTenant()` renvoie
 * `undefined` : les lectures renvoient alors ensemble vide (jamais une fuite
 * inter-tenant), et les écritures doivent être effectuées dans un contexte
 * explicitement défini.
 */
export type TenantStorage = AsyncLocalStorage<number | null>;

export const tenantStorage: TenantStorage = new AsyncLocalStorage<number | null>();

export function runWithTenant<T>(tenantId: number | null, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(tenantId, fn);
}

export function currentTenant(): number | undefined {
  const value = tenantStorage.getStore();
  return value == null ? undefined : value;
}
