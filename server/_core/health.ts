import { parseDatabasePoolSize } from "./dbPool";

export type HealthPayload = {
  ok: boolean;
  db: "up" | "down";
  uptimeSec: number;
  poolLimit: number;
  timestamp: string;
};

export function buildHealthPayload(input: { dbOk: boolean; now?: Date; uptimeSec?: number; poolLimit?: number }): HealthPayload {
  const db = input.dbOk ? "up" : "down";
  return {
    ok: input.dbOk,
    db,
    uptimeSec: Math.max(0, Math.round(input.uptimeSec ?? process.uptime())),
    poolLimit: input.poolLimit ?? parseDatabasePoolSize(process.env.DATABASE_POOL_SIZE),
    timestamp: (input.now ?? new Date()).toISOString(),
  };
}
