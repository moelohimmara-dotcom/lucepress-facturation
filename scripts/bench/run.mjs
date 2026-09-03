#!/usr/bin/env node
/**
 * Bench HTTP tRPC — identifiants via LUCEPRESS_BENCH_EMAIL / LUCEPRESS_BENCH_PASSWORD.
 * Usage : pnpm bench -- --users 7 --duration 60 --scenario read
 */

function percentile(sortedMs, p) {
  if (!sortedMs.length) return 0;
  const rank = Math.min(sortedMs.length - 1, Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1));
  return sortedMs[rank] ?? 0;
}

function summarizeLatencies(samplesMs) {
  const sorted = [...samplesMs].filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const total = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: total,
    min: sorted[0] ?? 0,
    max: sorted[total - 1] ?? 0,
    mean: total ? Math.round(sum / total) : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

import { readFileSync } from "node:fs";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function loadAccounts() {
  const file = process.env.LUCEPRESS_BENCH_USERS_FILE ?? "";
  if (file) {
    return readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(line => {
        const comma = line.indexOf(",");
        if (comma < 1) return null;
        return { email: line.slice(0, comma).trim(), password: line.slice(comma + 1).trim() };
      })
      .filter(account => account?.email && account?.password);
  }
  const email = process.env.LUCEPRESS_BENCH_EMAIL ?? "";
  const password = process.env.LUCEPRESS_BENCH_PASSWORD ?? "";
  return email && password ? [{ email, password }] : [];
}

const baseUrl = (process.env.LUCEPRESS_BENCH_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const accounts = loadAccounts();
const users = Math.max(1, Number.parseInt(arg("users", String(accounts.length || 7)), 10) || 7);
const durationSec = Math.max(5, Number.parseInt(arg("duration", "30"), 10) || 30);
const scenario = arg("scenario", "read");
const cookieName = "app_session_id";

if (!accounts.length) {
  console.error("Définissez LUCEPRESS_BENCH_USERS_FILE (csv email,password) ou LUCEPRESS_BENCH_EMAIL / LUCEPRESS_BENCH_PASSWORD.");
  process.exit(1);
}

function trpcQueryUrl(procedure, input) {
  const path = `${baseUrl}/api/trpc/${procedure}`;
  if (input === undefined) return path;
  return `${path}?input=${encodeURIComponent(JSON.stringify(input))}`;
}

async function trpcMutation(procedure, payload, cookie) {
  const started = Date.now();
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${baseUrl}/api/trpc/${procedure}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, ms: Date.now() - started, text, headers: response.headers };
}

async function trpcQuery(procedure, cookie, input) {
  const started = Date.now();
  const response = await fetch(trpcQueryUrl(procedure, input), {
    headers: cookie ? { cookie } : {},
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, ms: Date.now() - started, text };
}

function sessionCookie(setCookie) {
  const raw = setCookie.getSetCookie?.() ?? (setCookie.get("set-cookie") ? [setCookie.get("set-cookie")] : []);
  for (const line of raw) {
    if (!line) continue;
    const match = line.match(new RegExp(`${cookieName}=([^;]+)`));
    if (match) return `${cookieName}=${match[1]}`;
  }
  return "";
}

function procedureFailed(body) {
  try {
    const parsed = JSON.parse(body);
    return Boolean(parsed.error || parsed[0]?.error);
  } catch {
    return true;
  }
}

const readProcedures = [
  "auth.me",
  "billing.documents.list",
  "billing.receivables",
  "billing.mailStatus",
];

const mixedExtra = ["billing.clients.list", "billing.collection.assignees"];

async function workerLoop(workerIndex, stopAt, latencies, errors) {
  await new Promise(resolve => setTimeout(resolve, workerIndex * 250));
  const account = accounts[workerIndex % accounts.length];
  const login = await trpcMutation("auth.login", { email: account.email, password: account.password });
  latencies.push(login.ms);
  if (!login.ok || procedureFailed(login.text)) {
    errors.push({ type: "login", status: login.status, sample: login.text.slice(0, 180) });
    return;
  }
  const cookie = sessionCookie(login.headers);
  if (!cookie) {
    errors.push({ type: "login", status: login.status, sample: "cookie de session absent" });
    return;
  }

  while (Date.now() < stopAt) {
    const procedures = scenario === "mixed" && Math.random() < 0.2
      ? [mixedExtra[Math.floor(Math.random() * mixedExtra.length)]]
      : readProcedures;
    for (const procedure of procedures) {
      if (Date.now() >= stopAt) break;
      const result = await trpcQuery(procedure, cookie);
      latencies.push(result.ms);
      if (!result.ok || procedureFailed(result.text)) {
        errors.push({ type: procedure, status: result.status, sample: result.text.slice(0, 180) });
      }
    }
  }
}

const healthStarted = Date.now();
const health = await fetch(`${baseUrl}/api/health`);
const healthMs = Date.now() - healthStarted;
let healthJson = null;
try {
  healthJson = await health.json();
} catch {
  healthJson = { parseError: true, status: health.status };
}

const latencies = [];
const errors = [];
const stopAt = Date.now() + durationSec * 1000;
await Promise.all(Array.from({ length: users }, (_, index) => workerLoop(index, stopAt, latencies, errors)));

const summary = {
  at: new Date().toISOString(),
  baseUrl,
  users,
  accounts: accounts.length,
  durationSec,
  scenario,
  health: { status: health.status, ms: healthMs, body: healthJson },
  requests: latencies.length,
  errors: errors.length,
  latencyMs: summarizeLatencies(latencies),
  errorSamples: errors.slice(0, 8),
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 2;
