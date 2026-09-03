#!/usr/bin/env bash
# Deploy Lucepress Gestion to VPS (tarball + pnpm + PM2).
# Usage: bash scripts/deploy-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:-213.156.135.139}"
DEPLOY_USER="${DEPLOY_USER:-remote}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519_kora_project}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/remote/lucepress-facturation}"
HEALTH_URL="${HEALTH_URL:-https://lucepress.213.156.135.139.sslip.io/api/health}"
PM2_NAME="${PM2_NAME:-lucepress}"

SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
STAMP="$(date +%Y%m%d-%H%M%S)"
TAR="/tmp/lucepress-deploy-${STAMP}-${SHA}.tar.gz"
REMOTE_TAR="/tmp/lucepress-deploy-${STAMP}.tar.gz"

echo "==> Packaging ${SHA}…"
tar -C "$ROOT" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  --exclude='*.tar.gz' \
  --exclude=.env \
  -czf "$TAR" .

SSH=(ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@${DEPLOY_HOST}")
SCP=(scp -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=accept-new)

echo "==> Uploading to ${DEPLOY_USER}@${DEPLOY_HOST}…"
"${SCP[@]}" "$TAR" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_TAR}"

echo "==> Installing & restarting on VPS…"
"${SSH[@]}" bash -s <<EOF
set -euo pipefail
mkdir -p "${DEPLOY_PATH}"
cd "${DEPLOY_PATH}"
tar -xzf "${REMOTE_TAR}"
rm -f "${REMOTE_TAR}"
export PATH="\$HOME/.local/share/pnpm:\$PATH"
corepack enable 2>/dev/null || true
pnpm install --frozen-lockfile || pnpm install
pnpm build
if pm2 describe "${PM2_NAME}" >/dev/null 2>&1; then
  pm2 restart "${PM2_NAME}" --update-env
else
  pm2 start dist/index.js --name "${PM2_NAME}" || pm2 start "pnpm" --name "${PM2_NAME}" -- start
fi
pm2 save || true
echo "DEPLOYED_SHA=${SHA}"
EOF

rm -f "$TAR"
echo "==> Healthcheck ${HEALTH_URL}…"
HTTP_CODE="$(curl -sS -o /tmp/lucepress-health.json -w "%{http_code}" "$HEALTH_URL" || true)"
echo "HTTP ${HTTP_CODE}"
head -c 400 /tmp/lucepress-health.json 2>/dev/null || true
echo
echo "==> Done. SHA ${SHA}"
