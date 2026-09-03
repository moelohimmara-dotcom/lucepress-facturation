# Bench multi-utilisateurs — Lucepres Gestion

Objectif : **prouver** que 7 staff simultanés tiennent, puis viser une marge **15–20**.
Base : **MySQL sur le VPS** (pas Supabase). L’app est déjà multi-comptes (sessions, rôles, tenant).

## Seuils de succès

| Métrique | Cible 7 VU | Cible 15 VU |
| --- | --- | --- |
| p95 API lecture (hors IA / SMTP) | < 500 ms | < 800 ms |
| Erreurs HTTP 5xx / tRPC INTERNAL | 0 | 0 |
| Login (p95) | < 800 ms | < 1,2 s |
| CPU VPS pendant le run | < 70 % | < 80 % |
| RAM process `lucepress` | stable, pas de croissance linéaire | idem |
| Pool MySQL | pas de timeout `connect` / `queue` | idem |

Hors seuils (runs séparés) : assistant IA, lots SMTP.

## Scénarios

1. **read** (baseline) — login une fois, puis boucle : `auth.me`, `billing.documents.list`, `billing.receivables`, `billing.mailStatus`
2. **mixed** — 80 % lecture + 20 % `billing.clients.list` / `billing.collection.assignees` (toujours lecture métier, pas d’écritures)
3. **burst-ai** / **burst-smtp** — plus tard, isolés, pas dans le baseline

## Comment lancer

Identifiants **uniquement** via l’environnement — jamais dans le dépôt.

```bash
export LUCEPRESS_BENCH_BASE_URL=https://lucepress.213.156.135.139.sslip.io
export LUCEPRESS_BENCH_EMAIL='compte-staff@…'
export LUCEPRESS_BENCH_PASSWORD='…'
pnpm bench -- --users 7 --duration 60 --scenario read
```

Windows PowerShell :

```powershell
$env:LUCEPRESS_BENCH_BASE_URL="https://lucepress.213.156.135.139.sslip.io"
$env:LUCEPRESS_BENCH_EMAIL="compte-staff@…"
$env:LUCEPRESS_BENCH_PASSWORD="…"
pnpm bench -- --users 7 --duration 60 --scenario read
```

Pendant le run, sur le VPS : `pm2 monit`, `uptime`, `free -h`.

Coller le JSON résumé dans `docs/bench/` (fichier daté) après le premier run réel.

## Config déjà prévue dans le code

- `GET /api/health` → `{ ok, db, uptimeSec, poolLimit }` (HTTP 200 même si `db: "down"` — le process vit ; `ok` suit la DB)
- `DATABASE_POOL_SIZE` (défaut 10, min 2, max 50)

## Suite (pas dans ce premier livrable)

- Rate-limit API global (aujourd’hui commenté)
- Cluster PM2 seulement si le bench le justifie
- Optimistic locking édition document
- Compte dédié bench (ne pas marteler le compte DG du quotidien)
