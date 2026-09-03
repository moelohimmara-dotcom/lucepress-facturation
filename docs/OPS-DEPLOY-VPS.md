# Déploiement VPS — Lucepress Gestion

Script reproductible : `scripts/deploy-vps.sh`  
Cible typique : `/home/remote/lucepress-facturation`, PM2 `lucepress`, port `3001`.

## Prérequis

- Accès SSH (clé) vers le VPS
- Node.js + pnpm + PM2 sur le serveur
- Fichier `.env` déjà présent sur le VPS (ne pas écraser depuis le poste local sans revue)

## Usage (depuis la machine de build)

```bash
# Variables optionnelles
export DEPLOY_HOST=213.156.135.139
export DEPLOY_USER=remote
export DEPLOY_SSH_KEY=~/.ssh/id_ed25519_kora_project
export DEPLOY_PATH=/home/remote/lucepress-facturation
export HEALTH_URL=https://lucepress.213.156.135.139.sslip.io/api/health

bash scripts/deploy-vps.sh
```

Le script :

1. Construit un tarball du dépôt (sans `node_modules` / `.git`)
2. Copie vers le VPS
3. Installe les deps, build, redémarre PM2
4. Affiche le SHA déployé et appelle le healthcheck

Objectif : redeploy &lt; 10 min une fois le SSH et `.env` en place.

## Healthcheck

`GET /api/health` répond JSON `{ ok, db, uptimeSec, poolLimit, timestamp }`.  
`ok` suit le ping MySQL ; le statut HTTP reste 200 si le process Node répond (le moniteur VPS ne redémarre pas uniquement pour une DB courte).  
Si la route manque encore sur un ancien SHA, le script tente `/` et `/api/trpc/system.health`.
